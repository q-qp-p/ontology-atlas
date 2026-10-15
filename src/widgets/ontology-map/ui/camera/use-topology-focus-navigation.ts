"use client";

import {
  useCallback,
  useEffect,
  type RefObject
} from "react";
import type { CameraTarget } from "../../engine/camera";
import type { CameraTweenEase } from "../../model/camera/camera-easing";
import {
  IDLE_FLAT_SELECTION_CAMERA,
  flatDeselectCamera,
  recordFlight,
  recordNudge,
  selectionNudgeTarget,
  type FlatSelectionCamera
} from "../../model/camera/flat-selection-camera";
import { commitDomeEntrySweep } from "../../model/dome-view/frame";
import type { DomeRuntime } from "../../model/dome-view/runtime";
import { isPathTargetPick, type TopologyMapLensKind } from "../../model/visibility/path-lens";
import {
  type RealmTransitionState
} from "../../model/realm/realm-transition";
import { computeFocusCameraTarget, computeOverviewCameraTarget, focusTargetLeashPx, type FocusLeashPx } from "./topology-camera-math";
import {
  overviewBoundsFor
} from "./topology-overview-fit";
import type { OntologyMapTokens } from "../../tokens/read-map-tokens";
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

/** A selection this soon after a committed tap on the same node came from that click. */
const CLICK_SELECTION_WINDOW_MS = 1000;

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
  beginCameraTween: (target: CameraTarget, durationOverrideMs?: number, ease?: CameraTweenEase) => void;
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
  flatSelectionCameraRef: RefObject<FlatSelectionCamera>;
  lastTapRef: RefObject<{ nodeId: string; at: number; } | null>;
}

function leashFor(width: number, height: number, tokens: OntologyMapTokens): FocusLeashPx {
  return focusTargetLeashPx(tokens, width, height);
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
  flatSelectionCameraRef,
  lastTapRef,
}: Dependencies) {

  const moveCamera = useCallback((target: CameraTarget, tokens: OntologyMapTokens, ease?: CameraTweenEase) => {
    dampingRef.current = tokens.cameraDampingDefault;
    cameraTargetRef.current = target;
    userDrivenCameraRef.current = false;
    cameraAngularFreqRef.current = tokens.cameraSpringAngFreqTransition;
    lastActiveMsRef.current = performance.now();
    beginCameraTween(target, undefined, ease);
  }, [beginCameraTween, cameraAngularFreqRef, cameraTargetRef, dampingRef, lastActiveMsRef, userDrivenCameraRef]);

  /** The flat map's zoom gesture (double-click, Enter): frame the node and its neighbours. */
  const flyToNode = useCallback((slug: string) => {
    if (view3dRef.current || realmTransitionRef.current.phase !== "idle") return;
    const raw = readOntologyMapTokensOrNull();
    const world = worldRef.current;
    const { width, height } = viewportRef.current;
    if (!raw || !world || width <= 0 || height <= 0 || !world.nodeById.has(slug)) return;
    const tokens = cameraTokens(raw);
    const target = computeFocusCameraTarget(
      world, tokens, width, height, slug,
      overviewScaleRef.current * raw.overviewEntryRatio,
      null,
      overviewBoundsFor(overviewFitRef.current, world, raw, expandedParentsRef.current, clusteredIdsRef.current),
      liveDialFocusFrame(world, slug));
    if (!target) return;
    flatSelectionCameraRef.current = recordFlight(flatSelectionCameraRef.current, slug, cameraTargetRef.current);
    focusLeashPxRef.current = leashFor(width, height, tokens);
    moveCamera(target, raw);
  }, [cameraTargetRef, cameraTokens, clusteredIdsRef, expandedParentsRef, flatSelectionCameraRef, focusLeashPxRef, moveCamera, overviewFitRef, overviewScaleRef, realmTransitionRef, view3dRef, viewportRef, worldRef]);

  useEffect(() => {
    if (lastFocusedSlugRef.current === focusedSlug) return;
    lastFocusedSlugRef.current = focusedSlug;
    // A new focus starts from the top-ranked neighbours again, discarding
    // batches opened by chip clicks.
    egoRevealBatchesRef.current = 1;
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
        dome.flyRequest = { slug: null, unnudge: true };
      }
      lastActiveMsRef.current = performance.now();
      return;
    }

    const effectTokens = readOntologyMapTokensOrNull();
    const world = worldRef.current;
    const { width, height } = viewportRef.current;
    if (!effectTokens || !world || width <= 0 || height <= 0) return;

    const realmActive = realmTransitionRef.current.phase !== "idle";
    const realmData = realmDataRef.current;
    const tap = lastTapRef.current;
    const clicked =
      focusedSlug !== null && tap !== null && tap.nodeId === focusedSlug && performance.now() - tap.at < CLICK_SELECTION_WINDOW_MS;
    // The panel this selection opens enters the DOM after this effect, so it is measured a frame later.
    const raf = requestAnimationFrame(() => {
      const tokens = readOntologyMapTokensOrNull() ?? effectTokens;
      const memory = flatSelectionCameraRef.current;
      const pathPick = focusedSlug !== null && isPathTargetPick(mapLensKindRef.current, focusedSlug, spotlightIdsRef.current);

      if (!realmActive && focusedSlug === null) {
        flatSelectionCameraRef.current = IDLE_FLAT_SELECTION_CAMERA;
        focusLeashPxRef.current = null;
        const back = flatDeselectCamera(memory, cameraTargetRef.current);
        if (back.kind === "return") moveCamera(back.target, tokens, memory.flight === null ? "spring" : undefined);
        if (back.kind !== "overview") return;
      }

      if (!realmActive && clicked && !pathPick && focusedSlug !== null) {
        if (memory.flight?.slug === focusedSlug) return;
        const node = world.nodeById.get(focusedSlug);
        const measured = cameraTokens(tokens);
        const current = cameraTargetRef.current;
        const nudge = node ? selectionNudgeTarget(current, node, width, { left: measured.safeInsetLeft, right: measured.safeInsetRight }) : null;
        const landed = nudge ?? current;
        flatSelectionCameraRef.current = nudge ? recordNudge(memory, focusedSlug, current, nudge) : { ...memory, clicked: focusedSlug };
        const leash = leashFor(width, height, measured);
        focusLeashPxRef.current = node
          ? { x: Math.max(leash.x, Math.abs(node.x - landed.tx) * landed.tscale + 1), y: Math.max(leash.y, Math.abs(node.y - landed.ty) * landed.tscale + 1) }
          : leash;
        if (nudge) moveCamera(nudge, tokens, "spring");
        return;
      }

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
        // A selection avoids the panel it just opened; a deselect aims at the area the closing panel frees.
        const focusTokens = focusedSlug === null ? tokens : cameraTokens(tokens);
        focusLeashPxRef.current = focusedSlug === null ? null : leashFor(width, height, focusTokens);
        const overviewBounds = overviewBoundsFor(overviewFitRef.current, world, tokens, expandedParentsRef.current, clusteredIdsRef.current);
        target =
          focusedSlug !== null && !realmActive && pathPick
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
      flatSelectionCameraRef.current = IDLE_FLAT_SELECTION_CAMERA;
      if (!target) return;
      moveCamera(target, tokens);
    });
    return () => cancelAnimationFrame(raf);
  }, [focusedSlug, beginCameraTween, cameraTokens, constellationFocusId, lastFocusedSlugRef, egoRevealBatchesRef, selectionPulseRef, view3dRef, realmTransitionRef, domeRuntimeRef, worldRef, viewportRef, overviewScaleRef, realmDataRef, cameraTargetRef, cameraGestureRevisionRef, userDrivenCameraRef, dampingRef, cameraAngularFreqRef, lastActiveMsRef, focusedSlugRef, canvasRef, expandedParentsRef, focusLeashPxRef, overviewFitRef, clusteredIdsRef, mapLensKindRef, spotlightIdsRef, flatSelectionCameraRef, lastTapRef, moveCamera]);

  return { flyToNode };
}
