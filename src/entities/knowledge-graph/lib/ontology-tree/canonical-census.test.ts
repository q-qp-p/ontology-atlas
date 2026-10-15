import { describe, expect, it } from "vitest";

import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "../../model";
import { computeCanonicalCensus } from "./canonical-census";

const node = (id: string, kind: string): KnowledgeGraphNode => ({
  id,
  title: id,
  kind,
  projectIds: [],
  evidenceIds: [],
  lastApprovedAt: new Date(0),
  lastApprovedBy: "",
});

describe("computeCanonicalCensus", () => {
  const nodes = [
    node("p", "project"),
    node("d", "domain"),
    node("c", "capability"),
    node("e", "element"),
    node("doc", "document"),
    node("readme", "vault-readme"),
  ];
  const edges = [{ id: "1", from: "p", to: "d", type: "contains" }] as KnowledgeGraphEdge[];

  it("counts the four kinds the map draws, not the document or the reader sentinel", () => {
    expect(computeCanonicalCensus(nodes, edges)).toEqual({ conceptCount: 4, relationCount: 1 });
  });

  it("returns zeros for an empty graph", () => {
    expect(computeCanonicalCensus([], [])).toEqual({ conceptCount: 0, relationCount: 0 });
  });
});
