import { describe, expect, it } from "vitest";

import {
  advanceParticlePhase,
  edgePairKey,
  EGO_CONTAINS_COMET_LIMIT,
  fireflySeed,
  PULSE_DURATION_MS,
  PULSE_TRAIL_LAG,
  pulseHeadTrail,
  pulseScale,
  edgePairMeta,
  selectAmbientDependsComets,
  selectEgoContainsComets,
  spawnHoverPulses,
  updateParticles,
  updatePulses,
  type ParticleEdge,
  type Pulse,
} from "./edge-fireflies";

/**
 * The pure contract of the always-on comets and hover pulses: phase-advance
 * determinism, the reduced-motion stop, pulse lifetime and direction. The pixels
 * themselves are verified on a real screen.
 */
describe("fireflySeed", () => {
  it("deterministic: the same edge always gets the same seed", () => {
    expect(fireflySeed("a", "b")).toBe(fireflySeed("a", "b"));
  });

  it("within [0,1)", () => {
    for (const [s, t] of [["a", "b"], ["capability:x", "element:y"], ["z", "z"]]) {
      const seed = fireflySeed(s, t);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(1);
    }
  });

  it("directional: swapping source and target gives a different seed (in general)", () => {
    expect(fireflySeed("a", "b")).not.toBe(fireflySeed("b", "a"));
  });
});

describe("advanceParticlePhase", () => {
  it("deterministic: the same input gives the same result", () => {
    expect(advanceParticlePhase(0.2, 0.016, 0.075)).toBe(advanceParticlePhase(0.2, 0.016, 0.075));
  });

  it("always within [0,1), wrapping even after many laps with a large dt", () => {
    for (const dt of [0.016, 0.05, 1, 100]) {
      const t = advanceParticlePhase(0.9, dt, 0.075);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(1);
    }
  });

  it("advances forward (monotonically increasing until it wraps)", () => {
    const t0 = advanceParticlePhase(0.1, 0.016, 0.075);
    expect(t0).toBeGreaterThan(0.1);
  });

  it("wraps around past 1", () => {
    const t = advanceParticlePhase(0.98, 0.5, 0.075); // 0.98 + 0.0375 = 1.0175 → 0.0175
    expect(t).toBeCloseTo(0.0175, 6);
  });

  it("guards against negative speed and stays within [0,1)", () => {
    const t = advanceParticlePhase(0.02, 0.5, -0.075); // 0.02 - 0.0375 = -0.0175 → 0.9825
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThan(1);
    expect(t).toBeCloseTo(0.9825, 6);
  });
});

describe("updateParticles", () => {
  const makeEdges = (): ParticleEdge[] => [
    { kind: "depends", t: 0.1, sourceId: "a", targetId: "b" },
    { kind: "contains", t: 0.1, sourceId: "a", targetId: "c" },
    { kind: "depends", t: 0.9, sourceId: "b", targetId: "c" },
  ];

  it("only depends edges advance, contains stays fixed", () => {
    const edges = makeEdges();
    updateParticles(edges, 0.016, false, () => 0.075);
    expect(edges[0].t).toBeGreaterThan(0.1); // depends advances
    expect(edges[1].t).toBe(0.1); // contains does not
  });

  it("under reduced-motion nothing advances (stopped)", () => {
    const edges = makeEdges();
    updateParticles(edges, 0.016, true, () => 0.075);
    expect(edges[0].t).toBe(0.1);
    expect(edges[2].t).toBe(0.9);
  });

  it("speed is per edge via speedOf, and an edge at 0 stands still", () => {
    const edges = makeEdges();
    updateParticles(edges, 0.016, false, (e) => (e.sourceId === "a" ? 0 : 0.2));
    expect(edges[0].t).toBe(0.1); // speed 0 → stationary
    expect(edges[2].t).not.toBe(0.9); // speed 0.2 → advances
  });

  it("a contains edge for which isEgoContainsEligible is true advances like depends", () => {
    const edges = makeEdges();
    updateParticles(
      edges,
      0.016,
      false,
      () => 0.075,
      (e) => e.kind === "contains" && e.sourceId === "a" && e.targetId === "c",
    );
    expect(edges[1].t).toBeGreaterThan(0.1); // an eligible contains edge now advances too
  });

  it("a contains edge for which isEgoContainsEligible is false stays fixed", () => {
    const edges = makeEdges();
    updateParticles(edges, 0.016, false, () => 0.075, () => false);
    expect(edges[1].t).toBe(0.1);
  });

  it("omitting the argument keeps the existing contract (contains always fixed)", () => {
    const edges = makeEdges();
    updateParticles(edges, 0.016, false, () => 0.075);
    expect(edges[1].t).toBe(0.1);
  });
});

describe("edgePairKey", () => {
  it("joins in source-target order", () => {
    expect(edgePairKey("a", "b")).toBe("a b");
  });
});

type CometTestEdge = { sourceId: string; targetId: string; kind: "contains" | "depends" };

/** The world build's `edgeIndexByNode`: every edge index under both endpoints. */
function indexByNode(edges: readonly CometTestEdge[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  edges.forEach((edge, i) => {
    for (const id of [edge.sourceId, edge.targetId]) index.set(id, [...(index.get(id) ?? []), i]);
  });
  return index;
}

/** The per-frame ranking the cached selectors replace: sort by seed then pair key, keep `limit`. */
function rankedKeysByFullSort(edges: readonly CometTestEdge[], limit: number): Set<string> {
  const ranked = [...edges].sort((a, b) => {
    const seedDiff = fireflySeed(a.sourceId, a.targetId) - fireflySeed(b.sourceId, b.targetId);
    if (seedDiff !== 0) return seedDiff;
    const ka = edgePairKey(a.sourceId, a.targetId);
    const kb = edgePairKey(b.sourceId, b.targetId);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return new Set(ranked.slice(0, Math.max(0, limit)).map((e) => edgePairKey(e.sourceId, e.targetId)));
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("selectEgoContainsComets", () => {
  const hubEdges = (count: number): CometTestEdge[] =>
    Array.from({ length: count }, (_, i) => ({ sourceId: "hub", targetId: `n${i}`, kind: "contains" }));

  it("caps a node's incident contains edges at the limit, taking them in rank order", () => {
    const edges = hubEdges(40);
    const { keys, edges: cometEdges } = selectEgoContainsComets(edges, indexByNode(edges).get("hub"));
    expect(keys).toEqual(rankedKeysByFullSort(edges, EGO_CONTAINS_COMET_LIMIT));
    expect(cometEdges.size).toBe(EGO_CONTAINS_COMET_LIMIT);
  });

  it("ignores depends edges and edges that do not touch the node", () => {
    const edges: CometTestEdge[] = [
      { sourceId: "hub", targetId: "a", kind: "contains" },
      { sourceId: "hub", targetId: "b", kind: "depends" },
      { sourceId: "c", targetId: "d", kind: "contains" },
    ];
    const { keys } = selectEgoContainsComets(edges, indexByNode(edges).get("hub"));
    expect([...keys]).toEqual(["hub a"]);
  });

  it("counts a self-loop once although the node lists it under both endpoints", () => {
    const edges: CometTestEdge[] = [...hubEdges(24), { sourceId: "hub", targetId: "hub", kind: "contains" }];
    const { keys } = selectEgoContainsComets(edges, indexByNode(edges).get("hub"));
    expect(keys).toEqual(rankedKeysByFullSort(edges, EGO_CONTAINS_COMET_LIMIT));
  });

  it("answers a repeated question for the same edge list and node with the same object", () => {
    const edges = hubEdges(5);
    const incident = indexByNode(edges).get("hub");
    expect(selectEgoContainsComets(edges, incident)).toBe(selectEgoContainsComets(edges, incident));
  });

  it("is empty for a node with no edges", () => {
    expect(selectEgoContainsComets(hubEdges(3), undefined).keys.size).toBe(0);
  });
});

describe("selectAmbientDependsComets", () => {
  it("replaces the previous frame's keys with the first candidates in rank order", () => {
    const edges: CometTestEdge[] = Array.from({ length: 30 }, (_, i) => ({ sourceId: `s${i}`, targetId: `t${i}`, kind: "depends" }));
    const into = new Set(["stale key"]);
    const selected = selectAmbientDependsComets(edges, (i) => i % 2 === 0, into, 5);
    expect(selected).toBe(into);
    expect(selected).toEqual(rankedKeysByFullSort(edges.filter((_, i) => i % 2 === 0), 5));
  });
});

describe("edgePairMeta", () => {
  it("matches fireflySeed and edgePairKey and reuses one meta per edge object", () => {
    const edge = { sourceId: "kind:alpha", targetId: "kind:beta" };
    const meta = edgePairMeta(edge);
    expect(meta.seed).toBe(fireflySeed(edge.sourceId, edge.targetId));
    expect(meta.key).toBe(edgePairKey(edge.sourceId, edge.targetId));
    expect(edgePairMeta(edge)).toBe(meta);
  });
});

describe("cached comet selection against the per-frame sort it replaces", () => {
  it("picks the same keys on random graphs with duplicate pairs, self-loops and hidden edges", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = seededRandom(seed);
      const nodeCount = 2 + Math.floor(random() * 40);
      const edges: CometTestEdge[] = Array.from({ length: Math.floor(random() * 300) }, () => ({
        sourceId: `n${Math.floor(random() * nodeCount)}`,
        targetId: `n${Math.floor(random() * nodeCount)}`,
        kind: random() < 0.5 ? "contains" : "depends",
      }));
      const visible = edges.map(() => random() < 0.6);
      const limit = [0, 1, 24, 400][seed % 4];
      const isCandidate = (i: number) => edges[i].kind === "depends" && visible[i];
      const ambient = selectAmbientDependsComets(edges, isCandidate, new Set(), limit);
      expect(ambient).toEqual(rankedKeysByFullSort(edges.filter((_, i) => isCandidate(i)), limit));

      const focused = `n${Math.floor(random() * nodeCount)}`;
      const incidentContains = edges.filter(
        (edge) => edge.kind === "contains" && (edge.sourceId === focused || edge.targetId === focused),
      );
      const ego = selectEgoContainsComets(edges, indexByNode(edges).get(focused), limit);
      const wantKeys = rankedKeysByFullSort(incidentContains, limit);
      expect(ego.keys).toEqual(wantKeys);
      expect(ego.edges).toEqual(new Set(incidentContains.filter((edge) => wantKeys.has(edgePairKey(edge.sourceId, edge.targetId)))));
    }
  });
});

describe("spawnHoverPulses", () => {
  const edges = [
    { sourceId: "hub", targetId: "x" },
    { sourceId: "y", targetId: "hub" },
    { sourceId: "p", targetId: "q" }, // does not touch the hub
  ];

  it("one pulse per edge touching the hovered node", () => {
    const pulses = spawnHoverPulses("hub", edges, 1000, false);
    expect(pulses).toHaveLength(2);
  });

  it("direction: +1 when the hovered node is the source, -1 when it is the target (outward)", () => {
    const pulses = spawnHoverPulses("hub", edges, 1000, false);
    expect(pulses.find((p) => p.targetId === "x")?.dir).toBe(1); // hub=source
    expect(pulses.find((p) => p.sourceId === "y")?.dir).toBe(-1); // hub=target
  });

  it("t0 is the launch time", () => {
    const pulses = spawnHoverPulses("hub", edges, 4242, false);
    expect(pulses.every((p) => p.t0 === 4242)).toBe(true);
  });

  it("launches 0 under reduced-motion", () => {
    expect(spawnHoverPulses("hub", edges, 1000, true)).toHaveLength(0);
  });
});

describe("updatePulses", () => {
  const pulses: Pulse[] = [
    { sourceId: "a", targetId: "b", dir: 1, t0: 0 },
    { sourceId: "c", targetId: "d", dir: -1, t0: 500 },
  ];

  it("removes pulses past their lifetime", () => {
    // now=600 → the first has run 600 > 420 (expired), the second 100 < 420 (alive)
    const alive = updatePulses(pulses, 600);
    expect(alive).toHaveLength(1);
    expect(alive[0].t0).toBe(500);
  });

  it("returns the input array itself when all are alive (avoids allocation)", () => {
    const alive = updatePulses(pulses, 100);
    expect(alive).toBe(pulses);
  });

  it("an empty array when everything has expired", () => {
    expect(updatePulses(pulses, 10000)).toHaveLength(0);
  });

  it("empty input is returned as is", () => {
    const empty: Pulse[] = [];
    expect(updatePulses(empty, 1000)).toBe(empty);
  });

  it("lifetime boundary at PULSE_DURATION_MS", () => {
    const at: Pulse[] = [{ sourceId: "a", targetId: "b", dir: 1, t0: 0 }];
    expect(updatePulses(at, PULSE_DURATION_MS - 1)).toHaveLength(1);
    expect(updatePulses(at, PULSE_DURATION_MS)).toHaveLength(0);
  });
});

describe("pulseScale / pulseHeadTrail", () => {
  it("size shrinks as raw grows, with a floor of 0.35", () => {
    expect(pulseScale(0)).toBe(1);
    expect(pulseScale(0.5)).toBeCloseTo(0.5, 6);
    expect(pulseScale(1)).toBe(0.35); // max(0.35, 0)
  });

  it("forward (dir=1): head=raw, trail=head-lag", () => {
    const { head, trail } = pulseHeadTrail(1, 0.5);
    expect(head).toBe(0.5);
    expect(trail).toBeCloseTo(0.5 - PULSE_TRAIL_LAG, 6);
  });

  it("backward (dir=-1): head=1-raw, trail=head+lag", () => {
    const { head, trail } = pulseHeadTrail(-1, 0.2);
    expect(head).toBeCloseTo(0.8, 6);
    expect(trail).toBeCloseTo(0.8 + PULSE_TRAIL_LAG, 6);
  });

  it("null when the trail falls outside [0,1] (just after a forward start)", () => {
    const { trail } = pulseHeadTrail(1, 0); // head 0, trail -0.05
    expect(trail).toBeNull();
  });
});
