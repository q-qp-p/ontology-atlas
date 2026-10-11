/**
 * Node pin-drag world-coordinate math: grabbing pins the node 1:1 to the cursor in world space,
 * keeping the grab offset (no centre snap, `docs/design/interaction.md` section 1); the force sim
 * reflows its neighbours.
 */

export interface WorldOffset {
  x: number;
  y: number;
}

/** Offset from the pointer's world position to the node's world position at grab time. */
export function computeGrabOffsetWorld(
  nodeWorldX: number,
  nodeWorldY: number,
  pointerWorldX: number,
  pointerWorldY: number,
): WorldOffset {
  return { x: nodeWorldX - pointerWorldX, y: nodeWorldY - pointerWorldY };
}

/** World position the node should be pinned to for the current pointer world position, preserving the grab offset. */
export function computePinWorld(
  pointerWorldX: number,
  pointerWorldY: number,
  grabOffset: WorldOffset,
): WorldOffset {
  return { x: pointerWorldX + grabOffset.x, y: pointerWorldY + grabOffset.y };
}
