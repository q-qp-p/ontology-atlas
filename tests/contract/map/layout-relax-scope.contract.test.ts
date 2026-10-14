import { describe, expect, it } from "vitest";

import {
  computeConcentricLayout,
  relaxNewlyVisible,
  type LayoutGraphNode,
  type LayoutPoint,
} from "@/widgets/ontology-map/model/layout/layout";
import { DENSITY_GATE_THRESHOLD } from "@/widgets/ontology-map/model/layout/density-gate";

/**
 * Layout relaxation must run only on nodes that will be drawn, since it dominates cost and the density
 * gate hides most elements. Counts and sets are locked, not milliseconds, which differ per machine.
 */

const RINGS = { domain: 250, capability: 145, element: 90 };
const RADII = { project: 30, domain: 17, capability: 11, element: 7 };

/** A vault where one parent exceeds the child threshold, so the gate really has something to fold. */
function denseVault(childCount: number): LayoutGraphNode[] {
  const nodes: LayoutGraphNode[] = [
    { id: "p", kind: "project", parentId: null },
    { id: "d0", kind: "domain", parentId: "p" },
    { id: "d1", kind: "domain", parentId: "p" },
    { id: "c0", kind: "capability", parentId: "d0" },
    { id: "c1", kind: "capability", parentId: "d1" },
  ];
  for (let i = 0; i < childCount; i += 1) {
    nodes.push({ id: `e${i}`, kind: "element", parentId: "c0" });
  }
  return nodes;
}

const place = (nodes: readonly LayoutGraphNode[], relaxScope?: ReadonlySet<string>) =>
  new Map(
    computeConcentricLayout(nodes, RINGS, { radii: RADII, relaxScope }).map((p) => [p.id, p]),
  );

const movedIds = (
  nodes: readonly LayoutGraphNode[],
  relaxScope?: ReadonlySet<string>,
): Set<string> => {
  const seeded = place(nodes.map((n) => ({ ...n })), new Set());
  const relaxed = place(nodes, relaxScope);
  const moved = new Set<string>();
  for (const [id, seed] of seeded) {
    const after = relaxed.get(id);
    if (!after) continue;
    if (Math.hypot(seed.x - after.x, seed.y - after.y) > 0.01) moved.add(id);
  }
  return moved;
};

describe("layout relax scope contract", () => {
  it("a node outside the scope does not move at all, since it is dropped from relaxation", () => {
    const nodes = denseVault(DENSITY_GATE_THRESHOLD * 4);
    // Exclude the subtree the gate will fold (all of c0's children) from the scope.
    const scope = new Set(nodes.filter((n) => n.parentId !== "c0").map((n) => n.id));
    const moved = movedIds(nodes, scope);
    const outsideMoved = [...moved].filter((id) => !scope.has(id));
    expect(outsideMoved).toEqual([]);
  });

  it("omitting the scope keeps the previous behavior, so everything is relaxed", () => {
    const nodes = denseVault(DENSITY_GATE_THRESHOLD * 4);
    const withScope = movedIds(nodes, new Set(nodes.map((n) => n.id)));
    const withoutScope = movedIds(nodes);
    expect([...withoutScope].sort()).toEqual([...withScope].sort());
  });

  it("there is no coordinate hole, and an out-of-scope node also keeps its seed coordinates", () => {
    // If coordinates are empty when a tier opens or a chip expands, nodes pile up at
    // the origin. This design assumes placement always runs and only relaxation is
    // skipped.
    const nodes = denseVault(DENSITY_GATE_THRESHOLD * 4);
    const scope = new Set(["p", "d0", "d1", "c0", "c1"]);
    const placed = place(nodes, scope);
    expect(placed.size).toBe(nodes.length);
    const atOrigin = [...placed.values()].filter((p) => p.x === 0 && p.y === 0);
    // Only the project may sit at the origin — anything else there means the seed never ran.
    expect(atOrigin.map((p) => p.id)).toEqual(["p"]);
  });

  it("an empty scope skips relaxation entirely, so nobody moves", () => {
    const nodes = denseVault(DENSITY_GATE_THRESHOLD * 4);
    expect(movedIds(nodes, new Set()).size).toBe(0);
  });

  it("out-of-scope nodes do not remain as obstacles either, so in-scope coordinates are the same with or without them", () => {
    // The first attempt left out-of-scope nodes in items as `pinned: true`. Movement
    // was blocked but grid rebuilds and pair enumeration still ran, so **the cost did
    // not fall at all** (measured: N=3,000 stayed at 2,081ms; excluding them gave
    // 21ms).
    //
    // The observable invariant is this: **however many** out-of-scope nodes exist, the
    // coordinates of in-scope nodes do not change. Leaving them as obstacles changes
    // those coordinates immediately, so reverting is caught here — without relying on
    // incidental geometry such as whether an overlap happens to occur.
    const scope = new Set(["p", "d0", "d1", "c0", "c1"]);
    const few = place(denseVault(DENSITY_GATE_THRESHOLD * 2), scope);
    const many = place(denseVault(DENSITY_GATE_THRESHOLD * 20), scope);
    for (const id of scope) {
      const a = few.get(id);
      const b = many.get(id);
      expect(a, id).toBeDefined();
      expect(b, id).toBeDefined();
      expect(Math.hypot(a!.x - b!.x, a!.y - b!.y), id).toBeLessThan(0.001);
    }
  });

  it("in-scope nodes still get their overlaps resolved, so narrowing loses no quality", () => {
    const nodes = denseVault(DENSITY_GATE_THRESHOLD * 4);
    const scope = new Set(nodes.filter((n) => n.parentId !== "c0").map((n) => n.id));
    const placed = place(nodes, scope);
    let collisions = 0;
    const inScope = [...placed.values()].filter((p) => scope.has(p.id));
    for (let i = 0; i < inScope.length; i += 1) {
      for (let j = i + 1; j < inScope.length; j += 1) {
        const a = inScope[i];
        const b = inScope[j];
        const kindOf = (id: string) => nodes.find((n) => n.id === id)!.kind;
        const min = RADII[kindOf(a.id)] + RADII[kindOf(b.id)];
        if (Math.hypot(a.x - b.x, a.y - b.y) < min) collisions += 1;
      }
    }
    expect(collisions).toBe(0);
  });

  describe("local re-relaxation on expand (relaxNewlyVisible)", () => {
    /**
     * Within one parent, phyllotaxis spacing already prevents collisions (measured 0
     * overlaps), but **fans of different parents do overlap** — 5 cases when 3 expand,
     * 18 at 6, 70 at 12. Relaxing everything accumulates cost (341ms at 24) and
     * **moves nodes the user was already looking at** (up to 15 units). So only the
     * newly visible ones are relaxed, locally.
     */
    /** A vault where two parents sit close enough that their fans really overlap. */
    function twoFans(childCount: number): LayoutGraphNode[] {
      const nodes: LayoutGraphNode[] = [
        { id: "p", kind: "project", parentId: null },
        { id: "d0", kind: "domain", parentId: "p" },
        { id: "c0", kind: "capability", parentId: "d0" },
        { id: "c1", kind: "capability", parentId: "d0" },
      ];
      for (let i = 0; i < childCount; i += 1) {
        nodes.push({ id: `a${i}`, kind: "element", parentId: "c0" });
        nodes.push({ id: `b${i}`, kind: "element", parentId: "c1" });
      }
      return nodes;
    }

    const seedAll = (nodes: readonly LayoutGraphNode[]) =>
      new Map<string, LayoutPoint>(
        computeConcentricLayout(nodes, RINGS, { radii: RADII, relaxScope: new Set() }).map((p) => [
          p.id,
          { ...p },
        ]),
      );

    it("a far node outside the bbox does not affect the result, which is why the cost is independent of the click count", () => {
      // Neighbours influence each other; what is pinned is that distant nodes are never looked at, so
      // per-click cost is independent of how many clusters are expanded.
      const near = twoFans(DENSITY_GATE_THRESHOLD * 3);
      // One more fan of the same size in the opposite domain — spatially distant.
      const withFar: LayoutGraphNode[] = [
        ...near,
        { id: "dFar", kind: "domain", parentId: "p" },
        { id: "cFar", kind: "capability", parentId: "dFar" },
        ...Array.from({ length: DENSITY_GATE_THRESHOLD * 3 }, (_, i) => ({
          id: `f${i}`,
          kind: "element" as const,
          parentId: "cFar",
        })),
      ];
      const newly = new Set(near.filter((n) => n.parentId === "c0").map((n) => n.id));
      const placedNear = new Set(near.filter((n) => n.parentId !== "c0").map((n) => n.id));
      const placedAll = new Set(withFar.filter((n) => n.parentId !== "c0").map((n) => n.id));

      const a = seedAll(withFar);
      relaxNewlyVisible(a, withFar, newly, placedNear, { radii: RADII });
      const b = seedAll(withFar);
      relaxNewlyVisible(b, withFar, newly, placedAll, { radii: RADII });

      for (const id of newly) {
        expect(
          Math.hypot(a.get(id)!.x - b.get(id)!.x, a.get(id)!.y - b.get(id)!.y),
          id,
        ).toBeLessThan(0.001);
      }
    });

    it("an already placed node does not move at all, so the ground under the user stays steady", () => {
      const nodes = twoFans(DENSITY_GATE_THRESHOLD * 3);
      const placed = new Set(nodes.filter((n) => n.parentId !== "c0").map((n) => n.id));
      const newly = new Set(nodes.filter((n) => n.parentId === "c0").map((n) => n.id));

      const before = seedAll(nodes);
      const after = seedAll(nodes);
      relaxNewlyVisible(after, nodes, newly, placed, { radii: RADII });

      for (const id of placed) {
        const a = before.get(id)!;
        const b = after.get(id)!;
        expect(Math.hypot(a.x - b.x, a.y - b.y), id).toBeLessThan(0.001);
      }
    });

    it("a newly visible node gets its overlap with neighbors resolved", () => {
      const nodes = twoFans(DENSITY_GATE_THRESHOLD * 3);
      const placed = new Set(nodes.filter((n) => n.parentId !== "c0").map((n) => n.id));
      const newly = new Set(nodes.filter((n) => n.parentId === "c0").map((n) => n.id));
      const kindOf = (id: string) => nodes.find((n) => n.id === id)!.kind;
      const count = (pts: Map<string, LayoutPoint>) => {
        let c = 0;
        for (const id of newly) {
          for (const other of [...newly, ...placed]) {
            if (other === id) continue;
            const a = pts.get(id)!;
            const b = pts.get(other)!;
            if (Math.hypot(a.x - b.x, a.y - b.y) < RADII[kindOf(id)] + RADII[kindOf(other)]) c += 1;
          }
        }
        return c;
      };
      const pts = seedAll(nodes);
      const seeded = count(pts);
      relaxNewlyVisible(pts, nodes, newly, placed, { radii: RADII });
      const relaxed = count(pts);
      // The seed state must really contain overlaps for this contract to guard anything (no vacuous assertion).
      expect(seeded).toBeGreaterThan(0);
      expect(relaxed).toBeLessThan(seeded);
    });

    it("does nothing when nothing is newly visible", () => {
      const nodes = twoFans(DENSITY_GATE_THRESHOLD * 3);
      const before = seedAll(nodes);
      const after = seedAll(nodes);
      relaxNewlyVisible(after, nodes, new Set(), new Set(nodes.map((n) => n.id)), { radii: RADII });
      for (const [id, a] of before) {
        const b = after.get(id)!;
        expect(Math.hypot(a.x - b.x, a.y - b.y), id).toBeLessThan(0.001);
      }
    });
  });
});
