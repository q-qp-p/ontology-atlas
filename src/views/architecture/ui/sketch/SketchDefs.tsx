import { EDGE_STROKE, VIOLATION_HALO_BLUR } from './ink';

export function SketchDefs({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <defs>
      <marker
        id="architecture-sketch-arrow"
        viewBox="0 0 8 8"
        refX="6"
        refY="4"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        {/* An explicit stroke, not `context-stroke`, which WebKit does not resolve on markers. */}
        <path
          d="M0,0.5 L7.5,4 L0,7.5"
          fill="none"
          stroke={EDGE_STROKE}
          strokeWidth={1.4}
        />
      </marker>
      <marker
        id="architecture-sketch-arrow-violation"
        viewBox="0 0 8 8"
        refX="6"
        refY="4"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path
          d="M0,0.5 L7.5,4 L0,7.5"
          fill="none"
          stroke="var(--color-danger-text)"
          strokeWidth={1.4}
        />
      </marker>
      {/* `userSpaceOnUse`: a vertical stroke has a zero-width bounding box, which would clip a percentage filter region to nothing. */}
      <filter
        id="architecture-violation-halo"
        filterUnits="userSpaceOnUse"
        x={0}
        y={0}
        width={width}
        height={height}
      >
        <feGaussianBlur stdDeviation={VIOLATION_HALO_BLUR} />
      </filter>
    </defs>
  );
}
