"use client";

import {
  useEffect,
  type RefObject
} from "react";
import type { CameraTarget } from "../../engine/camera";
import { commitDomeEntrySweep } from "../../model/dome-view/frame";
import type { DomeRuntime } from "../../model/dome-view/runtime";
import { isPathTargetPick, type TopologyMapLensKind } from "../../model/visibility/path-lens";
import {
  type RealmTransitionState
} from "../../model/realm/realm-transition";
import { computeFocusCameraTarget, computeOverviewCameraTarget, focusLeashPx, type FocusLeashPx } from "./topology-camera-math";
import {
  overviewBoundsFor
} from "./topology-overview-fit";
import { readOntologyMapTokensOrNull } from "../../tokens/topology-read-tokens";
import { realmCameraTarget, realmVisibleBounds, type RealmRuntimeData } from "../world/topology-realm-runtime";
import { computePathPickBounds, dialFocusFrame, type DialFocusFrame, type TopologyWorld } from "../world/topology-world";
import { lastDialFrame } from "../../dial/frame/frame";
import { readDialTokens } from "../../dial/tokens";

export function liveDialFocusFrame(world: TopologyWorld, focusId: string): DialFocusFrame | undefined {
  if (lastDialFrame() === null) return undefined;
  try {
    return dialFocusFrame(world, focusId, readDialTokens());
  } catch {
    return undefined;
  }
}

interface Dependencies {
  lastFocusedSlugRef: RefObject<string | null>;
  focusedSlug: string | null;
  egoRevealBatchesRef: RefObject<number>;
  selectionPulseRef: RefObject<{ nodeId: string; startAtMs: number; } | null>;
    cameraTargetRef: RefObject<CameraTarget>;
  constellationFocusId: string | null;
  cameraGestureRevisionRef: RefObject<number>;
  userDrivenCameraRef: RefObject<boolean>;
  dampingRef: RefObject<number>;
  cameraAngularFreqRef: RefObject<number | null>;
  lastActiveMsRef: RefObject<number>;
  beginCameraTween: (target: CameraTarget, durationOverrideMs?: number) => void;
  focusedSlugRef: RefObject<string | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  worldRef: RefObject<TopologyWorld | null>;
  viewportRef: RefObject<{ width: number; height: number; dpr: number; }>;
  overviewScaleRef: RefObject<number>;
  view3dRef: RefObject<boolean>;
  realmTransitionRef: RefObject<RealmTransitionState>;
  domeRuntimeRef: RefObject<DomeRuntime | null>;
  realmDataRef: RefObject<RealmRuntimeData | null>;
  expandedParentsRef: RefObject<ReadonlySet<string>>;
  cameraTokens: <T extends { safeInsetLeft: number; safeInsetRight: number; }>(tokens: T) => T;
  focusLeashPxRef: RefObject<FocusLeashPx | null>;
  overviewFitRef: RefObject<"full" | "spine">;
  clusteredIdsRef: RefObject<ReadonlySet<string>>;
  mapLensKindRef: RefObject<TopologyMapLensKind>;
  spotlightIdsRef: RefObject<ReadonlySet<string> | null>;
}

/** Own focus camera transitions and reversible inspection targets. */
export function useTopologyFocusNavigation({
  lastFocusedSlugRef,
  focusedSlug,
  egoRevealBatchesRef,
  selectionPulseRef, cameraTargetRef,
  constellationFocusId,
  cameraGestureRevisionRef,
  userDrivenCameraRef,
  dampingRef,
  cameraAngularFreqRef,
  lastActiveMsRef,
  beginCameraTween,
  focusedSlugRef,
  canvasRef,
  worldRef,
  viewportRef,
  overviewScaleRef,
  view3dRef,
  realmTransitionRef,
  domeRuntimeRef,
  realmDataRef,
  expandedParentsRef,
  cameraTokens,
  focusLeashPxRef,
  overviewFitRef,
  clusteredIdsRef,
  mapLensKindRef,
  spotlightIdsRef,
}: Dependencies) {

  // --- focused slug change — spring-dive to the ego bbox, or back to overview when cleared ---
  useEffect(() => {
    if (lastFocusedSlugRef.current === focusedSlug) return;
    lastFocusedSlugRef.current = focusedSlug;
    // A new focus starts from the top-ranked neighbours again, discarding
    // batches opened by chip clicks.
    egoRevealBatchesRef.current = 1;

    // A NEW selection (never a deselect) starts
    // the one-shot commit pulse. Captured unconditionally (before the
    // tokens/world early-return below) so the pulse timestamp is never
    // skipped even if the camera-target computation bails out for some
    // reason.
    selectionPulseRef.current = focusedSlug !== null ? { nodeId: focusedSlug, startAtMs: performance.now() } : null;
        /*
         * In 3D a click only selects: the camera and pose stay put, and flying to a node is its own gesture
         * (double-click or Enter, consumed by the dome frame, `DOME_FLY_MS`). A selection stops the attention
         * spin; the nudge off the inspector is undone on deselect. Esc and Home fly back, a click does not.
         */
        if (view3dRef.current && realmTransitionRef.current.phase === "idle" && domeRuntimeRef.current !== null) {
      const dome = domeRuntimeRef.current;
      if (focusedSlug !== null) {
        dome.spinArmed = false;
        commitDomeEntrySweep(dome);
      } else if (dome.nudgeReturn !== null) {
        // The one exception: a click's nudge off the inspector is undone with the selection.
        dome.flyRequest = { slug: null, unnudge: true };
      }
      lastActiveMsRef.current = performance.now();
      return;
    }

    const effectTokens = readOntologyMapTokensOrNull();
    const world = worldRef.current;
    const { width, height } = viewportRef.current;
    if (!effectTokens || !world || width <= 0 || height <= 0) return;

    // Inside a realm the ego bbox is restricted to realm members, so a
    // flung-out neighbour beyond the warding ring cannot inflate the bbox and
    // throw the camera off screen. The focus dive stays inside the ring.
    const realmActive = realmTransitionRef.current.phase !== "idle";
    const realmData = realmDataRef.current;
    // Deselecting inside a realm returns to the realm's content bbox over its visible members, not
    // the global spineBounds (a different coordinate space, origin 0,0) and not `entryCamera`,
    // which is for leaving the realm.
    /*
     * ⚠️ **The target computation itself waits one frame.**
     *
     * The popover to avoid is opened by *this very selection*, so it is not in
     * the DOM while this effect runs. Measuring insets then reports 0 on the
     * right and the correction vanishes — which the gate caught exactly ("free
     * 127px, screen 64px"). So measuring and computing happen in the same
     * frame.
     *
     * One frame (≈16 ms) ahead of a 200–420 ms move is invisible, and the
     * one-input-one-event gate holds that gap to a frame count.
     */
    const raf = requestAnimationFrame(() => {
      /*
       * The lanes are read in this frame too: a selection folds INDEX and the page refreshes
       * `--map-safe-inset-left` in an effect that runs after this one, so an earlier read still sees
       * INDEX open.
       */
      const tokens = readOntologyMapTokensOrNull() ?? effectTokens;
      const overviewEntryScale = overviewScaleRef.current * tokens.overviewEntryRatio;
      let target: CameraTarget | null;
      if (focusedSlug === null && realmActive && realmData) {
        const bounds = realmVisibleBounds(
          world,
          realmData,
          new Set([...expandedParentsRef.current, realmData.rootId]),
          tokens);
        target = realmCameraTarget(bounds, tokens, width, height);
      } else {
        const realmMembers = realmActive ? realmData?.memberIds ?? null : null;
        /*
         * Selection entry avoids the actual width of the just-opened inspector. Conversely, selection exit
         // must not avoid the final overview even if the inspector **still remains in the DOM during
         // its exit animation**. Previously both directions recalculated via `cameraTokens()`,
         // leaving the graph left by half the inspector's width (measured approx. 192px) after closing.
         *
         // The exit destination is the safe area after the panel disappears, so use the canonical CSS token;
         // the selection destination uses measured tokens including current actual obstacles. This is a
         // difference in entry/exit states for one condition, not a separate correction value.
         */
        const focusTokens = focusedSlug === null ? tokens : cameraTokens(tokens);
        // The physics keeps the same leash this target is clamped to: half the
        // free width less the edge pad, measured against the panels open now.
        focusLeashPxRef.current =
          focusedSlug === null
            ? null
            : focusLeashPx(width, height, {
              left: focusTokens.safeInsetLeft,
              right: focusTokens.safeInsetRight,
              top: focusTokens.safeInsetTop,
              bottom: focusTokens.safeInsetBottom,
            });
        const overviewBounds = overviewBoundsFor(overviewFitRef.current, world, tokens, expandedParentsRef.current, clusteredIdsRef.current);
        target =
          focusedSlug !== null && !realmActive && isPathTargetPick(mapLensKindRef.current, focusedSlug, spotlightIdsRef.current)
            ? // A path's source waits for its target: frame the map the target is picked
              // from, the source's own neighbours included, rather than dive into them.
              computeOverviewCameraTarget(
                computePathPickBounds(world, tokens, focusedSlug, overviewBounds, expandedParentsRef.current),
                width,
                height,
                focusTokens,
                world.nodes.length)
            : computeFocusCameraTarget(world, focusTokens, width, height, focusedSlug, overviewEntryScale, realmMembers, overviewBounds, realmActive || focusedSlug === null ? undefined : liveDialFocusFrame(world, focusedSlug));
      }
      if (!target) return;
      /*
       * Aim at a spot the panel does not cover: the popover opens on the right, so the free area's
       * centre is left of the screen centre. The panel width is measured from the DOM, not pinned,
       * once per selection.
       */
      const finalTarget = target;
      dampingRef.current = tokens.cameraDampingDefault;
      cameraTargetRef.current = finalTarget;
      userDrivenCameraRef.current = false;
      // Dive-zoom fix — focus dive AND deselect-return are both PROGRAMMATIC
      // camera moves (this effect fires for both directions of `focusedSlug`
      // changing), so both ease via the cubic transition tween (reduced-motion →
      // spring/snap).
      cameraAngularFreqRef.current = tokens.cameraSpringAngFreqTransition;
      lastActiveMsRef.current = performance.now();
      beginCameraTween(finalTarget);
    });
    return () => cancelAnimationFrame(raf);
  }, [focusedSlug, beginCameraTween, cameraTokens, constellationFocusId, lastFocusedSlugRef, egoRevealBatchesRef, selectionPulseRef, view3dRef, realmTransitionRef, domeRuntimeRef, worldRef, viewportRef, overviewScaleRef, realmDataRef, cameraTargetRef, cameraGestureRevisionRef, userDrivenCameraRef, dampingRef, cameraAngularFreqRef, lastActiveMsRef, focusedSlugRef, canvasRef, expandedParentsRef, focusLeashPxRef, overviewFitRef, clusteredIdsRef, mapLensKindRef, spotlightIdsRef]);

}
