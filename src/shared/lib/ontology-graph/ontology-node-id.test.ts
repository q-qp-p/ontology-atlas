import { describe, it, expect } from "vitest";
import { isOntologyNodeId } from "./ontology-node-id";

describe("isOntologyNodeId", () => {
  it("exact kind: prefix plus tail gives true", () => {
    expect(isOntologyNodeId("capability:mcp-server")).toBe(true);
    expect(isOntologyNodeId("domain:auth")).toBe(true);
    expect(isOntologyNodeId("element:src/features/auth")).toBe(true);
    expect(isOntologyNodeId("project:ontology-atlas")).toBe(true);
    expect(isOntologyNodeId("document:setup")).toBe(true);
    expect(isOntologyNodeId("unknown:legacy-thing")).toBe(true);
  });

  it("a project slug (no `:`) gives false", () => {
    expect(isOntologyNodeId("ontology-atlas")).toBe(false);
    expect(isOntologyNodeId("auth-platform")).toBe(false);
  });

  it("a modern slug containing a colon but not a known kind gives false", () => {
    expect(isOntologyNodeId("oh-my:something")).toBe(false);
    expect(isOntologyNodeId("foo:bar")).toBe(false);
    expect(isOntologyNodeId("hub:platform")).toBe(false);
  });

  it("an empty tail (`capability:`) gives false, as it is not a meaningful id", () => {
    expect(isOntologyNodeId("capability:")).toBe(false);
    expect(isOntologyNodeId("domain:")).toBe(false);
  });

  it("empty, null and non-string give false without throwing", () => {
    expect(isOntologyNodeId("")).toBe(false);
    // @ts-expect-error — runtime guard
    expect(isOntologyNodeId(null)).toBe(false);
    // @ts-expect-error — runtime guard
    expect(isOntologyNodeId(undefined)).toBe(false);
    // @ts-expect-error — runtime guard
    expect(isOntologyNodeId(123)).toBe(false);
  });
});
