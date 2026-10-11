/**
 * Viewport culling: pure screen-space rejection tests, no canvas/DOM. Edges are culled on bbox
 * intersection, not when both endpoints are off-screen: a long edge can cross the viewport with
 * both ends outside.
 */

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * True when a node's disc lies entirely outside the viewport. `radius` is the
 * already-scaled SCREEN radius (`effRadius * camera.scale`), so the test stays
 * correct at every zoom level.
 */
export function isNodeCulled(
  screen: ScreenPoint,
  radius: number,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  return (
    screen.x + radius < 0 ||
    screen.y + radius < 0 ||
    screen.x - radius > viewportWidth ||
    screen.y - radius > viewportHeight
  );
}

/**
 * True when a quadratic curve's control polygon lies entirely outside the
 * viewport. A quadratic Bézier is contained in the convex hull of its three
 * control points, so an off-screen hull guarantees an off-screen curve — the
 * test can never cull something that would have been painted.
 *
 * `margin` absorbs stroke width and the comet-tail arcs drawn along the curve.
 */
export function isEdgeCulled(
  a: ScreenPoint,
  b: ScreenPoint,
  control: ScreenPoint,
  margin: number,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  const minX = Math.min(a.x, b.x, control.x) - margin;
  if (minX > viewportWidth) return true;
  const maxX = Math.max(a.x, b.x, control.x) + margin;
  if (maxX < 0) return true;
  const minY = Math.min(a.y, b.y, control.y) - margin;
  if (minY > viewportHeight) return true;
  const maxY = Math.max(a.y, b.y, control.y) + margin;
  return maxY < 0;
}

/**
 * True when NEITHER endpoint's disc is on screen while the curve still crosses
 * the viewport (the hull test kept it). Such a pass-through edge shows a line
 * but can't show a relation — B2 residual: demote its ink instead of culling
 * (culling would pop real geometry; demotion keeps continuity, kills the yarn).
 */
export function isPassthroughEdge(
  a: ScreenPoint,
  b: ScreenPoint,
  endpointRadius: number,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  return (
    isNodeCulled(a, endpointRadius, viewportWidth, viewportHeight) &&
    isNodeCulled(b, endpointRadius, viewportWidth, viewportHeight)
  );
}
