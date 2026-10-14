import { describe, expect, it } from "vitest";

import { isContainmentRelation, isDirectionalRelation } from "@/entities/knowledge-graph/lib/ontology-tree/relations";

/**
 * The map must not claim a direction that does not exist. Most non-containment relations are
 * `related_to`, which is symmetric, so a directional taper asserted false causality. Lint cannot see
 * the relation type lists in another file.
 */
describe("relation directionality contract", () => {
  it("`related_to` has no direction — in both spellings", () => {
    // derive uses `related_to` while MCP and the schema use the key `relates`; the result must be the
    // same through either path.
    expect(isDirectionalRelation("related_to")).toBe(false);
    expect(isDirectionalRelation("relates")).toBe(false);
  });

  it("dependency and parent concept have a direction", () => {
    // `is_a` (SKOS broader) runs narrower → broader, so its direction is real.
    for (const type of ["depends_on", "is_a", "describes"]) {
      expect(isDirectionalRelation(type), type).toBe(true);
    }
  });

  it("an unknown type defaults to directed — a new type is not silently demoted to symmetric", () => {
    for (const type of ["implements", "uses", "some_future_relation", ""]) {
      expect(isDirectionalRelation(type), type).toBe(true);
    }
  });

  it("the directionality axis and the containment axis are independent of each other", () => {
    // Containment asks "is it structural"; directional asks "does it have a direction" —
    // different questions. In the renderer, contains is a solid line and never enters the
    // taper branch at all, but mistaking the two predicates for equivalents leads the next
    // person to merge them.
    expect(isContainmentRelation("contains")).toBe(true);
    expect(isDirectionalRelation("contains")).toBe(true);
    expect(isContainmentRelation("related_to")).toBe(false);
    expect(isDirectionalRelation("related_to")).toBe(false);
  });

  it("in the measured distribution of the dogfood vault the majority is symmetric — the size of what this contract protects", () => {
    // Counts from `docs/ontology/`: dependencies 27, relates 62. A large change in those numbers means
    // this contract's priority evidence should be re-examined.
    const observed = { depends_on: 27, related_to: 62 };
    const symmetric = Object.entries(observed)
      .filter(([type]) => !isDirectionalRelation(type))
      .reduce((sum, [, n]) => sum + n, 0);
    const total = Object.values(observed).reduce((sum, n) => sum + n, 0);
    expect(symmetric / total).toBeGreaterThan(0.5);
  });
});
