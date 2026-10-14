import { describe, expect, it } from "vitest";

import { hitTestEdges, type EdgeHitCandidate } from "./topology-edge-hit";
import type { WorldEdge } from "../world/topology-world";

const edge = (id: string): WorldEdge => ({
  sourceId: `${id}-a`,
  targetId: `${id}-b`,
  kind: "contains",
  ax: 0, ay: 0, bx: 0, by: 0, controlX: 0, controlY: 0,
  t: 0,
  level: 1,
  relationType: "contains",
  declaredBySlug: null,
});

const straight = (id: string, y: number): EdgeHitCandidate => ({
  edge: edge(id),
  a: { x: 100, y },
  b: { x: 500, y },
  control: { x: 300, y },
});

describe("hitTestEdges", () => {
  it("picks the nearest edge within the threshold", () => {
    const hit = hitTestEdges([straight("far", 100), straight("near", 200)], 300, 204, 8);
    expect(hit?.sourceId).toBe("near-a");
  });

  it("null outside the threshold, because a click on empty space must not grab an edge", () => {
    expect(hitTestEdges([straight("e", 100)], 300, 130, 8)).toBeNull();
  });

  it("also hits a point on a curve (control-point offset), sampling the Bezier rather than approximating a line", () => {
    const bowed: EdgeHitCandidate = {
      edge: edge("bow"),
      a: { x: 100, y: 300 },
      b: { x: 500, y: 300 },
      control: { x: 300, y: 100 }, // A bow curving upward.
    };
    // The bezier's t=0.5 point is (300, 200) — not on the straight chord.
    expect(hitTestEdges([bowed], 300, 200, 6)?.sourceId).toBe("bow-a");
    // The chord's midpoint (y=300) is far from the curve — a hit here would mean a straight-line approximation.
    expect(hitTestEdges([bowed], 300, 296, 6)).toBeNull();
  });

  it("skipping candidates outside the AABB gives the same result (lossless pre-pass)", () => {
    const many = Array.from({ length: 400 }, (_, i) => straight(`e${i}`, 1000 + i * 10));
    many.push(straight("target", 200));
    expect(hitTestEdges(many, 300, 203, 8)?.sourceId).toBe("target-a");
  });

  // Hit-test inversion guard (panel3-S3) — the edge anchors a/b are the end nodes'
  // centres, so a click inside (or beside) a node's body radius must belong to the
  // node. The edge passes through the node's centre, so without radius information a
  // click dead centre on a node, or near it, leaks to the edge.
  describe("node body beats edge priority (aRadius/bRadius)", () => {
    const withRadii = (id: string, y: number, r: number): EdgeHitCandidate => ({
      edge: edge(id),
      a: { x: 100, y },
      b: { x: 500, y },
      control: { x: 300, y },
      aRadius: r,
      bRadius: r,
    });

    it("a click inside an end node's body (dead centre included) is excluded from the edge hit", () => {
      // 4px from node a's centre (100,200) — inside radius 14, so node territory. The
      // edge passes through this point (distance 0) but the node owns it, so this must be null.
      expect(hitTestEdges([withRadii("e", 200, 14)], 104, 200, 8)).toBeNull();
      // Dead centre (node a's centre) behaves the same way.
      expect(hitTestEdges([withRadii("e", 200, 14)], 100, 200, 8)).toBeNull();
    });

    it("without radius info (old behaviour) the same point hits the edge, the regression control", () => {
      // aRadius/bRadius omitted = backwards compatible. With no notion of a node, a
      // point on the edge line hits as before — this control proves the exclusion
      // above is due to the radius.
      expect(hitTestEdges([straight("e", 200)], 104, 200, 8)?.sourceId).toBe("e-a");
    });

    it("the middle of an edge (far from both end nodes) still hits even with radii", () => {
      // (300,204) — 200px from both node centres, outside radius 14, and 4px from the edge line (y=200).
      expect(hitTestEdges([withRadii("e", 200, 14)], 300, 204, 8)?.sourceId).toBe("e-a");
    });
  });
});
