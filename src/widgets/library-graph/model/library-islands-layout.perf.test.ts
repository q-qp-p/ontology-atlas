import { describe, expect, it } from "vitest";

import type { LibraryGraph } from "./build-library-graph";
import { islandsLayout } from "./library-islands-layout";

/**
 * Bounds are over ten times the measured cost (10,000 files in 36 ms): hang detectors, not budgets
 * (`.claude/rules/testing.md`).
 */
function folder(sources: number, pages: number, concepts: number): LibraryGraph {
  const nodes = [
    ...Array.from({ length: sources }, (_, i) => ({ id: `source:s${i}`, kind: "source" as const, label: `s${i}.md`, ref: `s${i}.md`, href: null })),
    ...Array.from({ length: pages }, (_, i) => ({ id: `page:p${i}`, kind: "page" as const, label: `p${i}`, ref: `wiki/p${i}`, href: null })),
    ...Array.from({ length: concepts }, (_, i) => ({ id: `concept:c${i}`, kind: "concept" as const, label: `c${i}`, ref: `c${i}`, href: null })),
  ];
  const edges = [];
  let cursor = 0;
  for (let p = 0; p < pages; p += 1) {
    const n = 2 + (p % 5);
    for (let k = 0; k < n && cursor < sources * 0.6; k += 1, cursor += 1) {
      edges.push({ id: `c${p}-${k}`, source: `page:p${p}`, target: `source:s${cursor}`, relation: "cites" as const, certainty: (p % 5 === 0 ? "unverified" : "current") as "unverified" | "current" });
    }
    if (p < pages * 0.95) edges.push({ id: `m${p}`, source: `page:p${p}`, target: `concept:c${Math.floor(Math.pow(p / (pages * 0.95), 1.6) * concepts)}`, relation: "mentions" as const, certainty: "current" as const });
  }
  return { nodes, edges, counts: { sources, pages, concepts, cites: edges.length, mentions: 0 } };
}

const WORLD = { width: 1300, height: 700 };
const LABELS = { unsorted: "Unsorted", unread: "Unread" };

function bestOfThree(graph: LibraryGraph): number {
  islandsLayout(graph, WORLD, LABELS);
  let best = Infinity;
  for (let i = 0; i < 3; i += 1) {
    const t0 = performance.now();
    islandsLayout(graph, WORLD, LABELS);
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

describe("islands layout at scale", () => {
  it("lays ten thousand files with their pages in well under a frame's worth of frames", () => {
    const graph = folder(10_000, 1_200, 40);
    const ms = bestOfThree(graph);
    const layout = islandsLayout(graph, WORLD, LABELS);
    console.log(`[islands-layout] 10,000 files · 1,200 pages · 40 concepts: ${ms.toFixed(1)} ms · ${layout.islands.length} islands`);
    expect(layout.positions.size).toBe(graph.nodes.length);
    expect(ms).toBeLessThan(500);
  });

  it("lays thirty thousand files in well under a second", () => {
    const graph = folder(30_000, 3_600, 60);
    const ms = bestOfThree(graph);
    const layout = islandsLayout(graph, WORLD, LABELS);
    console.log(`[islands-layout] 30,000 files · 3,600 pages · 60 concepts: ${ms.toFixed(1)} ms · ${layout.islands.length} islands`);
    expect(layout.positions.size).toBe(graph.nodes.length);
    expect(ms).toBeLessThan(1_500);
  });
});
