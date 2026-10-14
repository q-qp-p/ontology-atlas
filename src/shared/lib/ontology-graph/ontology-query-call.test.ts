import { describe, expect, it } from "vitest";
import { formatQueryOntologyCall } from "./ontology-query-call";

describe("formatQueryOntologyCall", () => {
  it("turns a payload into a query_ontology(...) JSON call string", () => {
    expect(
      formatQueryOntologyCall({ operation: "path", from: "a", to: "b" }),
    ).toBe('query_ontology({"operation":"path","from":"a","to":"b"})');
  });

  it("an empty payload gives query_ontology({})", () => {
    expect(formatQueryOntologyCall({})).toBe("query_ontology({})");
  });

  it("preserves key (insertion) order, a stable output that is easy for an agent to read", () => {
    expect(formatQueryOntologyCall({ z: 1, a: 2 })).toBe(
      'query_ontology({"z":1,"a":2})',
    );
  });

  it("serializes nested values and arrays too", () => {
    expect(
      formatQueryOntologyCall({ operation: "all_paths", types: ["x", "y"], maxHops: 5 }),
    ).toBe('query_ontology({"operation":"all_paths","types":["x","y"],"maxHops":5})');
  });
});
