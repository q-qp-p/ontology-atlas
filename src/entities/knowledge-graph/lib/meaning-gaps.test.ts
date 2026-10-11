import { describe, expect, it } from "vitest";

import {
  detectMeaningGaps,
  type ConceptDocFacts,
} from "./meaning-gaps";

const doc = (partial: Partial<ConceptDocFacts> = {}): ConceptDocFacts => ({
  findings: [],
  domainRef: "billing",
  mtime: null,
  ...partial,
});

describe("detectMeaningGaps", () => {
  it("reports a missing meaning only for definition-missing findings", () => {
    expect(detectMeaningGaps({ kind: "capability" }, doc())).toEqual([]);
    expect(
      detectMeaningGaps({ kind: "capability" }, doc({ findings: ["definition-missing"] })),
    ).toEqual(["missing-definition"]);
  });

  it("does not treat other findings as missing meaning", () => {
    expect(
      detectMeaningGaps({ kind: "capability" }, doc({ findings: ["boundary-missing"] })),
    ).toEqual([]);
  });

  it("orders meaning before membership", () => {
    expect(
      detectMeaningGaps(
        { kind: "capability" },
        doc({ findings: ["definition-missing"], domainRef: null }),
      ),
    ).toEqual(["missing-definition", "missing-domain"]);
  });

  it("treats domains, projects and documents without a parent as complete", () => {
    expect(detectMeaningGaps({ kind: "domain" }, doc({ domainRef: null }))).toEqual([]);
  });
});
