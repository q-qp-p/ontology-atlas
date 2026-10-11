import { EDGE_STROKE } from './ink';
import type { FlowAxis, Placed } from './types';

/**
 * Where a currently drawn dependency meets a role face; created only when a visible edge enters or
 * leaves that side. Hollow-to-solid mirrors focus without a second selection colour.
 */
export function ConnectionPort({
  axis,
  at,
  boxW,
  boxH,
  direction,
  active,
  lane,
  side,
}: {
  axis: FlowAxis;
  at: Placed;
  boxW: number;
  boxH: number;
  direction: 'incoming' | 'outgoing';
  active: boolean;
  lane: 'contract' | 'observation';
  /** A ladder skip leaves and arrives at the face's side; the port sits there, mid-height. */
  side?: 'left' | 'right';
}) {
  const incoming = direction === 'incoming';
  const cx = side
    ? side === 'left' ? at.x : at.x + boxW
    : axis === 'across' ? at.x + (incoming ? 0 : boxW) : at.x + boxW / 2;
  const cy = side || axis === 'across' ? at.y + boxH / 2 : at.y + (incoming ? 0 : boxH);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={active ? EDGE_STROKE : 'var(--color-canvas)'}
      stroke={EDGE_STROKE}
      strokeWidth={1.5}
      opacity={active ? 1 : 0.42}
      className="architecture-node-port"
      aria-hidden
      pointerEvents="none"
      data-architecture-port={lane}
      data-port-direction={direction}
      data-port-side={side}
    />
  );
}
