import type { CameraTarget } from "../../engine/camera";

/**
 * On a flat map a click only selects. The camera may slide sideways so the panel does not cover
 * the node (`nudge`); zooming in is its own gesture, a double-click or Enter (`flight`). A deselect
 * undoes exactly what the selection did, so the map lands where the reader left it. `clicked` names a
 * selection a click on the map made; any other (search, INDEX, a link, a walk) is framed and its
 * deselect returns to the overview.
 */
export interface FlatSelectionCamera {
  nudge: { before: CameraTarget; landed: CameraTarget } | null;
  flight: { slug: string; returnCamera: CameraTarget } | null;
  clicked: string | null;
}

export const IDLE_FLAT_SELECTION_CAMERA: FlatSelectionCamera = { nudge: null, flight: null, clicked: null };

/** Room inside the free canvas for the node's disc, ring and the start of its name. */
export const SELECTION_NUDGE_MARGIN_PX = 64;

export function sameCameraTarget(a: CameraTarget, b: CameraTarget): boolean {
  return Math.abs(a.tx - b.tx) < 0.01 && Math.abs(a.ty - b.ty) < 0.01 && Math.abs(a.tscale - b.tscale) < 1e-4;
}

/**
 * The sideways slide, at the same scale, that brings the node's screen x inside the free span the
 * panels leave; null when it already sits there or the span is too narrow to promise anything.
 */
export function selectionNudgeTarget(
  camera: CameraTarget,
  node: { x: number },
  viewportWidth: number,
  insets: { left: number; right: number },
  margin = SELECTION_NUDGE_MARGIN_PX,
): CameraTarget | null {
  const lo = insets.left + margin;
  const hi = viewportWidth - insets.right - margin;
  if (hi <= lo) return null;
  const sx = (node.x - camera.tx) * camera.tscale + viewportWidth / 2;
  const shift = sx < lo ? sx - lo : sx > hi ? sx - hi : 0;
  if (Math.abs(shift) <= 0.5) return null;
  return { tx: camera.tx + shift / camera.tscale, ty: camera.ty, tscale: camera.tscale };
}

/** A chained click keeps the first view as the one a deselect returns to. */
export function recordNudge(memory: FlatSelectionCamera, slug: string, current: CameraTarget, landed: CameraTarget): FlatSelectionCamera {
  const before = memory.nudge !== null && sameCameraTarget(current, memory.nudge.landed) ? memory.nudge.before : { ...current };
  return { ...memory, nudge: { before, landed: { ...landed } }, clicked: slug };
}

/** The first flight remembers the reader's view, past any nudge the click before it made. */
export function recordFlight(memory: FlatSelectionCamera, slug: string, current: CameraTarget): FlatSelectionCamera {
  const returnCamera =
    memory.flight?.returnCamera ??
    (memory.nudge !== null && sameCameraTarget(current, memory.nudge.landed) ? memory.nudge.before : { ...current });
  return { nudge: null, flight: { slug, returnCamera: { ...returnCamera } }, clicked: memory.clicked };
}

export type FlatDeselectCamera = { kind: "return"; target: CameraTarget } | { kind: "overview" } | { kind: "stay" };

/** A view the reader moved since the nudge is theirs and is never taken back. */
export function flatDeselectCamera(memory: FlatSelectionCamera, current: CameraTarget): FlatDeselectCamera {
  if (memory.flight !== null) return { kind: "return", target: { ...memory.flight.returnCamera } };
  if (memory.nudge !== null) {
    return sameCameraTarget(current, memory.nudge.landed) ? { kind: "return", target: { ...memory.nudge.before } } : { kind: "stay" };
  }
  return memory.clicked === null ? { kind: "overview" } : { kind: "stay" };
}
