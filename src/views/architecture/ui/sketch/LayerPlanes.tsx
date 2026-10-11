import { PAD_X, PLANE_INSET_Y, PLANE_STEP } from './geometry';
import type { ArchitectureSketchProps, Placed } from './types';

export function LayerPlanes({
  graph,
  ranks,
  observationEmpty,
  pairedGutterW,
  contractBoxW,
  observationBoxW,
  boxH,
  planeLean,
  planeDrift,
  planeRoom,
  layoutLeadRoom,
  placed,
}: {
  graph: ArchitectureSketchProps['graph'];
  ranks: number;
  observationEmpty: boolean;
  pairedGutterW: number;
  contractBoxW: number;
  observationBoxW: number;
  boxH: number;
  planeLean: number;
  planeDrift: number;
  planeRoom: number;
  layoutLeadRoom: number;
  placed: ReadonlyMap<string, Placed>;
}) {
  return (
    <g
      aria-hidden
      pointerEvents="none"
      data-testid="architecture-layer-planes"
      data-layer-step={PLANE_STEP}
    >
      {graph.boxes.map((box) => {
        const at = placed.get(box.id);
        if (!at) return null;
        const depth =
          ranks === 1 ? 1 : (ranks - 1 - box.column) / (ranks - 1);
        /* The left edge steps one `PLANE_STEP` per rank and every plane ends on one right edge, so the stagger reads as depth, not misalignment (`ArchitectureSketch.test.tsx`, "every layer plane ends on one line"). */
        const stagger = (ranks - 1 - box.column) * PLANE_STEP;
        const x = PAD_X + layoutLeadRoom - planeRoom + stagger;
        /* Before an inspection the planes end at the contract faces instead of running under the empty panel. */
        const planeW =
          contractBoxW +
          (observationEmpty ? 0 : pairedGutterW + observationBoxW) +
          planeRoom * 2 -
          planeDrift -
          planeLean -
          stagger;
        const top = at.y - PLANE_INSET_Y;
        const bottom = at.y + boxH + PLANE_INSET_Y;
        return (
          <g
            key={`plane-${box.id}`}
            className="architecture-layer-plane architecture-role-reveal"
            data-testid={`architecture-layer-plane-${box.id}`}
            data-layer-rank={box.column}
            data-layer-depth={Math.round(depth * 100) / 100}
          >
            <path
              d={`M ${x} ${bottom} H ${x + planeW} L ${x + planeW + planeLean} ${top} H ${
                x + planeLean
              } Z`}
              fill="var(--architecture-plane-fill)"
            />
            {/* The lit top face, the same one-flat-line device a raised node already uses. */}
            <line
              x1={x + planeLean}
              x2={x + planeLean + planeW}
              y1={top}
              y2={top}
              stroke="var(--architecture-plane-edge)"
              strokeWidth={1}
            />
          </g>
        );
      })}
    </g>
  );
}
