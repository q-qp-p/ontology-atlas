/**
 * Arrow keys move focus to a neighbour; the camera follows only when focus would leave the screen.
 * Picks by projection plus an orthogonal penalty inside a 60 degree cone, the narrowest whose four
 * directions cover the plane. With nothing there it does nothing and never wraps around.
 */

export type WalkDirection = 'up' | 'down' | 'left' | 'right';

export interface WalkNode {
  readonly id: string;
  readonly x: number;
  /** Screen coordinates — **y grows downward** (canvas convention). `up` is the direction y decreases. */
  readonly y: number;
}

/** The penalty applied to orthogonal distance. At 1 it ties with straight ahead at 45°. */
export const ORTHOGONAL_PENALTY = 2;

/**
 * The tangent of the cone's half angle — ±60° (`Math.tan(Math.PI / 3)`).
 *
 * Frozen as a constant because computing the angle per call adds cost wherever this
 * function lands on a per-frame path, and because this value is the specification
 * and so has to be decided in one place.
 */
export const CONE_HALF_TANGENT = Math.tan(Math.PI / 3);

const AXIS: Record<WalkDirection, { readonly dx: number; readonly dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * The most «natural» neighbour in that direction, or `null` if there is none.
 *
 * `neighbors` may contain `from` itself — its projection is 0, so it is filtered out.
 */
export function pickNeighborInDirection(
  from: WalkNode,
  neighbors: readonly WalkNode[],
  direction: WalkDirection,
): string | null {
  const axis = AXIS[direction];
  let bestId: string | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const node of neighbors) {
    if (node.id === from.id) continue;
    const dx = node.x - from.x;
    const dy = node.y - from.y;

    // How far along the pressed direction, and how far off it at a right angle.
    const along = dx * axis.dx + dy * axis.dy;
    if (along <= 0) continue; // Behind, or exactly to the side.
    const across = Math.abs(dx * axis.dy - dy * axis.dx);
    if (across > along * CONE_HALF_TANGENT) continue; // Outside the cone.

    const cost = along + across * ORTHOGONAL_PENALTY;
    // On a tie, take **the lower id** — the same input has to give the same result
    // every time, and relying on array order makes the result shift whenever the
    // layout does.
    if (cost < bestCost || (cost === bestCost && bestId !== null && node.id < bestId)) {
      bestCost = cost;
      bestId = node.id;
    }
  }

  return bestId;
}

/**
 * The node to grab first when there is no focus — **the one nearest the screen
 * centre**.
 *
 * Picking «the first node» by array order can land off screen, and then pressing an
 * arrow key shows no visible change (the camera does follow, but the user cannot
 * tell what happened). Starting from what they are looking at is always right.
 */
export function pickInitialFocus(
  nodes: readonly WalkNode[],
  viewportCenter: { readonly x: number; readonly y: number },
): string | null {
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const dx = node.x - viewportCenter.x;
    const dy = node.y - viewportCenter.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance || (distance === bestDistance && bestId !== null && node.id < bestId)) {
      bestDistance = distance;
      bestId = node.id;
    }
  }
  return bestId;
}

/**
 * How often to say "dead end": a direction with no neighbour speaks once, then stays quiet for
 * a while, timed since the last notice rather than per direction, so alternating keys do not flood.
 */
export const DEAD_END_NOTICE_COOLDOWN_MS = 1200;

/** May the dead end be announced now? A `null` `lastAtMs` means it has never been said. */
export function shouldAnnounceDeadEnd(lastAtMs: number | null, nowMs: number): boolean {
  if (lastAtMs === null) return true;
  return nowMs - lastAtMs >= DEAD_END_NOTICE_COOLDOWN_MS;
}

/** Arrow key name → our direction. Any other key is `null` (not ours). */
export function walkDirectionForKey(key: string): WalkDirection | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}
