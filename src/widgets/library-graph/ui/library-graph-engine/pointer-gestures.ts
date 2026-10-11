import type { PointerEvent as ReactPointerEvent } from "react";

import type { LayoutPoint } from "../../model/library-graph-layout";
import type { IslandsLayout } from "../../model/library-islands-layout";
import { pinIsland, releaseIsland } from "../../model/library-islands-physics";
import {
  pinLibraryNode,
  reheatLibrarySimulation,
  releaseLibraryNode,
} from "../../model/library-force-simulation";
import {
  isWheelZoomIntent,
  LIBRARY_ZOOM_MIN,
  panView,
  scaleBounds,
  screenToWorld,
  wheelPixelDelta,
  wheelZoomFactor,
  zoomViewAbout,
  type LibraryGraphView,
} from "../../model/library-graph-view";

import type { LibraryGraphEngineScope } from "./engine-scope";

/**
 * Travel before a press becomes a drag: the map's measured `--map-hysteresis-px`, as a
 * literal because that token is scoped to the topology surface.
 */
const DRAG_THRESHOLD_PX = 7;

/** The island under a canvas point on the overview; null off every island. */
function islandAt(
  islands: IslandsLayout["islands"] | undefined,
  view: LibraryGraphView,
  box: { width: number; height: number },
  point: LayoutPoint,
): IslandsLayout["islands"][number] | null {
  if (!islands) return null;
  const world = screenToWorld(point, view, box);
  return (
    islands.find((island) =>
      island.band
        ? Math.abs(world.x - island.x) <= island.band.width / 2 && Math.abs(world.y - island.y) <= island.band.height / 2
        : Math.hypot(world.x - island.x, world.y - island.y) <= island.r,
    ) ?? null
  );
}

/** An opened island zoomed out to this share of its fit scale gives way to the map. */
const ISLAND_LEAVES_BELOW_FIT = 0.6;
/**
 * After a wheel-out returns the map, further wheel-out of the same stream is ignored this
 * long, or it zooms the map past its fit into a small archipelago; wheel-in, press and drag
 * still act at once.
 */
const WHEEL_RETURN_SETTLE_MS = 700;

/** Trailing window over which a release's speed is measured, in milliseconds. */
const RELEASE_WINDOW_MS = 80;

/**
 * A released mark's speed in world units per tick, over a trailing window anchored at the
 * release, so a drag held still before letting go stops dead.
 */
function releaseVelocity(
  history: ReadonlyArray<{ x: number; y: number; t: number }>,
  releasedAt: number,
  scale: number,
): LayoutPoint | undefined {
  if (history.length < 2) return undefined;
  const from = history.find((sample) => releasedAt - sample.t <= RELEASE_WINDOW_MS);
  const to = history[history.length - 1]!;
  if (!from || from === to) return undefined;
  const span = to.t - from.t;
  if (span <= 0) return undefined;
  // Screen pixels per millisecond → world units per 60fps tick.
  const perTick = 16.7 / (span * Math.max(0.0001, scale));
  return { x: (to.x - from.x) * perTick, y: (to.y - from.y) * perTick };
}

export function finishLibraryGraphGesture(
  {
    boxRef, canvasRef, coarsePointer, coarseTapRef, graphRef, islandFieldRef, islandsRef, onDismiss,
    onHoverRef, onPressIslandRef, onPressMark, pick, pictureRef, pointerRef, simRef, viewRef, wake,
  }: Pick<
    LibraryGraphEngineScope,
    "boxRef" | "canvasRef" | "coarsePointer" | "coarseTapRef" | "graphRef" | "islandFieldRef" |
    "islandsRef" | "onDismiss" | "onHoverRef" | "onPressIslandRef" | "onPressMark" | "pick" |
    "pictureRef" | "pointerRef" | "simRef" | "viewRef" | "wake"
  >,
  timeStamp: number,
  commit?: LayoutPoint,
) {
  const state = pointerRef.current;
  const sim = simRef.current;
  if (state.drag && sim) {
    releaseLibraryNode(sim, state.drag.nodeId, releaseVelocity(state.history, timeStamp, viewRef.current.scale));
    reheatLibrarySimulation(sim);
  }
  if (state.islandDrag && islandFieldRef.current) releaseIsland(islandFieldRef.current, state.islandDrag.id);
  const pressed = state.pressedNodeId;
  pointerRef.current = {
    phase: "idle",
    pointerId: null,
    down: null,
    last: null,
    pressedNodeId: null,
    drag: null,
islandDrag: null,
    history: [],
  };
  const canvas = canvasRef.current;
  if (canvas) canvas.style.cursor = "";
  if (commit) {
    const node = pressed
      ? graphRef.current.nodes.find((candidate) => candidate.id === pressed) ?? null
      : null;
    if (node) {
      // One tap at every pointer type: a press only opens a reversible card, never navigates.
      coarseTapRef.current = null;
      if (coarsePointer()) onHoverRef.current(node.id);
      onPressMark(node);
    } else {
      /* An island press opens it; an empty-canvas press dismisses what stands open. */
      const island = pictureRef.current === "islands" ? islandAt(islandsRef.current?.islands, viewRef.current, boxRef.current, commit) : null;
      if (island && onPressIslandRef.current) {
        onDismiss();
        onPressIslandRef.current(pick(island));
      } else onDismiss();
    }
  }
  wake();
}

export function pressLibraryGraphPointer(
  {
    canvasRef, hitTest, pinchRef, pointerRef, pointOf, rectRef, takeCamera, touchesRef,
  }: Pick<
    LibraryGraphEngineScope,
    "canvasRef" | "hitTest" | "pinchRef" | "pointerRef" | "pointOf" | "rectRef" | "takeCamera" |
    "touchesRef"
  >,
  event: ReactPointerEvent<HTMLCanvasElement>,
) {
  const canvas = canvasRef.current;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    rectRef.current = { left: rect.left, top: rect.top };
  }
  const point = pointOf(event);
  if (event.pointerType === "touch") {
    touchesRef.current.set(event.pointerId, point);
    if (touchesRef.current.size === 2) {
      // Two fingers abandon any press or drag in progress before the pinch starts.
      const [first, second] = [...touchesRef.current.values()];
      pointerRef.current = {
        phase: "idle",
        pointerId: null,
        down: null,
        last: null,
        pressedNodeId: null,
        drag: null,
islandDrag: null,
        history: [],
      };
      pinchRef.current = {
        distance: Math.hypot(second!.x - first!.x, second!.y - first!.y),
        mid: { x: (first!.x + second!.x) / 2, y: (first!.y + second!.y) / 2 },
      };
      takeCamera();
      return;
    }
    if (touchesRef.current.size > 2) return;
  }
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // jsdom and some test environments do not implement pointer capture; the
    // `buttons === 0` guard in the move handler covers the gesture either way.
  }
  const hit = hitTest(point);
  pointerRef.current = {
    phase: "pressed",
    pointerId: event.pointerId,
    down: point,
    last: point,
    pressedNodeId: hit?.id ?? null,
    drag: null,
islandDrag: null,
    history: [{ x: point.x, y: point.y, t: event.timeStamp }],
  };
}

export function moveLibraryGraphPointer(
  {
    boxRef, canvasRef, finishGesture, hitTest, hoveredIslandRef, islandFieldRef, islandsRef,
    onHoverIslandRef, onHoverRef, pick, pictureRef, pinchRef, pointerRef, pointOf, rectRef, simRef,
    stateRef, takeCamera, touchesRef, viewRef, wake, zoomMaxRef,
  }: Pick<
    LibraryGraphEngineScope,
    "boxRef" | "canvasRef" | "finishGesture" | "hitTest" | "hoveredIslandRef" | "islandFieldRef" |
    "islandsRef" | "onHoverIslandRef" | "onHoverRef" | "pick" | "pictureRef" | "pinchRef" |
    "pointerRef" | "pointOf" | "rectRef" | "simRef" | "stateRef" | "takeCamera" | "touchesRef" |
    "viewRef" | "wake" | "zoomMaxRef"
  >,
  event: ReactPointerEvent<HTMLCanvasElement>,
) {
  /*
   * The box position is re-read on every move: a scroll moves the canvas with no event
   * here, so a cached offset hit-tests beside the pointer. The read forces no layout.
   */
  const canvas = canvasRef.current;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    rectRef.current = { left: rect.left, top: rect.top };
  }
  const point = pointOf(event);
  const state = pointerRef.current;
  const sim = simRef.current;
  const box = boxRef.current;

  if (event.pointerType === "touch" && touchesRef.current.has(event.pointerId)) {
    touchesRef.current.set(event.pointerId, point);
    const pinch = pinchRef.current;
    if (pinch && touchesRef.current.size >= 2) {
      const [first, second] = [...touchesRef.current.values()];
      const distance = Math.hypot(second!.x - first!.x, second!.y - first!.y);
      const mid = { x: (first!.x + second!.x) / 2, y: (first!.y + second!.y) / 2 };
      if (pinch.distance > 0) {
        const bounds = scaleBounds(zoomMaxRef.current);
        let next = zoomViewAbout(viewRef.current, box, mid, distance / pinch.distance, bounds);
        // The midpoint's own movement pans, so one gesture pinches and pans.
        next = panView(next, { x: mid.x - pinch.mid.x, y: mid.y - pinch.mid.y });
        viewRef.current = next;
      }
      pinchRef.current = { distance, mid };
      wake();
    }
    return;
  }

  // A release outside the canvas is only visible in `buttons`, so it is checked on every move.
  if (state.phase !== "idle" && event.buttons === 0) {
    finishGesture(event.timeStamp);
    return;
  }

  if (state.phase === "idle") {
    const hit = hitTest(point);
    if (hit?.id !== stateRef.current.hoveredId) onHoverRef.current(hit?.id ?? null);
    const island = hit || pictureRef.current !== "islands" ? null : islandAt(islandsRef.current?.islands, viewRef.current, boxRef.current, point);
    if ((island?.id ?? null) !== hoveredIslandRef.current) {
      hoveredIslandRef.current = island?.id ?? null;
      onHoverIslandRef.current?.(island ? pick(island) : null);
      wake();
    }
    // The cursor is the only press affordance on painted marks, which no DOM gate can see.
    event.currentTarget.style.cursor = hit || island ? "pointer" : "grab";
    return;
  }

  if (state.phase === "pressed") {
    const travelled = Math.hypot(point.x - (state.down?.x ?? point.x), point.y - (state.down?.y ?? point.y));
    if (travelled < DRAG_THRESHOLD_PX) return;
    state.phase = "dragging";
    takeCamera();
    // Decided once: what was under the pointer at pointerdown is what the gesture carries.
    const grabbed = state.pressedNodeId;
    state.pressedNodeId = null;
    // On the overview a hand carries the island; the physics shoves others aside and back.
    const heldIsland =
      !grabbed && pictureRef.current === "islands" && islandFieldRef.current
        ? islandAt(islandsRef.current?.islands, viewRef.current, boxRef.current, state.down ?? point)
        : null;
    if (heldIsland && islandFieldRef.current) {
      const world = screenToWorld(point, viewRef.current, box);
      state.islandDrag = { id: heldIsland.id, offset: { x: heldIsland.x - world.x, y: heldIsland.y - world.y } };
      pinIsland(islandFieldRef.current, heldIsland.id, { x: heldIsland.x, y: heldIsland.y });
    }
    // In the flow layout a mark has one place; a hand that moves it pans the picture.
    if (grabbed && sim && sim.index.has(grabbed) && pictureRef.current === "force") {
      const node = sim.nodes[sim.index.get(grabbed)!]!;
      const world = screenToWorld(point, viewRef.current, box);
      state.drag = { nodeId: grabbed, offset: { x: node.x - world.x, y: node.y - world.y } };
      pinLibraryNode(sim, grabbed, { x: node.x, y: node.y });
      reheatLibrarySimulation(sim);
    }
    event.currentTarget.style.cursor = "grabbing";
  }

  if (state.phase === "dragging") {
    if (state.islandDrag && islandFieldRef.current) {
      const world = screenToWorld(point, viewRef.current, box);
      pinIsland(islandFieldRef.current, state.islandDrag.id, { x: world.x + state.islandDrag.offset.x, y: world.y + state.islandDrag.offset.y });
    } else if (state.drag && sim) {
      const world = screenToWorld(point, viewRef.current, box);
      pinLibraryNode(sim, state.drag.nodeId, {
        x: world.x + state.drag.offset.x,
        y: world.y + state.drag.offset.y,
      });
      reheatLibrarySimulation(sim, 0.32);
    } else {
      const previous = state.last ?? point;
      viewRef.current = panView(viewRef.current, { x: point.x - previous.x, y: point.y - previous.y });
    }
    state.last = point;
    state.history.push({ x: point.x, y: point.y, t: event.timeStamp });
    if (state.history.length > 10) state.history.shift();
    wake();
  }
}

export function attachLibraryGraphWheel(
  {
    boxRef, canvasRef, fitScaleRef, islandsRef, onLeaveIslandRef, overviewRef, pictureRef, rectRef,
    takeCamera, viewRef, wake, wheelReturnedAtRef, zoomAimRef, zoomMaxRef,
  }: Pick<
    LibraryGraphEngineScope,
    "boxRef" | "canvasRef" | "fitScaleRef" | "islandsRef" | "onLeaveIslandRef" | "overviewRef" |
    "pictureRef" | "rectRef" | "takeCamera" | "viewRef" | "wake" | "wheelReturnedAtRef" |
    "zoomAimRef" | "zoomMaxRef"
  >,
) {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const onWheel = (event: WheelEvent): void => {
    // A native listener: React's delegated `wheel` is passive, so `preventDefault` there cannot stop page scroll.
    const pixels = wheelPixelDelta(event, typeof window === "undefined" ? 800 : window.innerHeight);
    if (!isWheelZoomIntent(pixels, event.ctrlKey)) return;
    event.preventDefault();
    if (pixels > 0 && overviewRef.current && event.timeStamp - wheelReturnedAtRef.current < WHEEL_RETURN_SETTLE_MS) return;
    const rect = canvas.getBoundingClientRect();
    rectRef.current = { left: rect.left, top: rect.top };
    takeCamera();
    const about = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    // The island under the pointer at the start of a zoom-in run is the aim; later steps
    // keep it, since the edge clamp slides the view under the pointer.
    if (pixels >= 0) zoomAimRef.current = null;
    else if (pictureRef.current === "islands" && zoomAimRef.current === null) {
      zoomAimRef.current = islandAt(islandsRef.current?.islands, viewRef.current, boxRef.current, about)?.id ?? null;
    }
    viewRef.current = zoomViewAbout(
      viewRef.current,
      boxRef.current,
      about,
      wheelZoomFactor(pixels),
      scaleBounds(zoomMaxRef.current),
    );
    /*
     * Zooming out of an opened island past a margin below its fit returns to the map; the
     * margin stops an overshoot bouncing out. The zoom floor counts, since a wide island fits there.
     */
    const scaleNow = viewRef.current.scale;
    if (pixels > 0 && !overviewRef.current && (scaleNow <= fitScaleRef.current * ISLAND_LEAVES_BELOW_FIT || scaleNow <= LIBRARY_ZOOM_MIN + 1e-6)) {
      wheelReturnedAtRef.current = event.timeStamp;
      onLeaveIslandRef.current?.();
    }
    wake();
  };
  canvas.addEventListener("wheel", onWheel, { passive: false });
  return () => canvas.removeEventListener("wheel", onWheel);
}
