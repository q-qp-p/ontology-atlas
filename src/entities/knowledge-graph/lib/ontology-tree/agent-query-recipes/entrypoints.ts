import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "../../../model";
import type { AgentProjectEntrypoint, AgentQueryEntrypoint } from "./types";

/** Concrete hub entrypoints, which expose coupling faster than leaf nodes, instead of `<slug>` placeholders. */
export function selectAgentQueryEntrypoints(
  nodes: readonly KnowledgeGraphNode[],
  edges: readonly KnowledgeGraphEdge[],
  limit = 4,
): AgentQueryEntrypoint[] {
  const degrees = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (degrees.has(edge.from)) {
      degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
    }
    if (edge.to !== edge.from && degrees.has(edge.to)) {
      degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
    }
  }

  return nodes
    .filter((node) => ["domain", "capability", "element"].includes(node.kind))
    .map((node) => ({
      slug: node.id,
      title: node.title,
      kind: node.kind,
      degree: degrees.get(node.id) ?? 0,
    }))
    .filter((entrypoint) => entrypoint.degree > 0)
    .sort((a, b) => {
      if (b.degree !== a.degree) return b.degree - a.degree;
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, limit);
}

export function selectAgentProjectEntrypoint(
  nodes: readonly KnowledgeGraphNode[],
  edges: readonly KnowledgeGraphEdge[],
): AgentProjectEntrypoint | null {
  const degrees = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (degrees.has(edge.from)) {
      degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
    }
    if (edge.to !== edge.from && degrees.has(edge.to)) {
      degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
    }
  }

  const [project] = nodes
    .filter((node) => node.kind === "project")
    .map((node) => ({
      slug: node.id,
      title: node.title,
      degree: degrees.get(node.id) ?? 0,
    }))
    .sort((a, b) => {
      if (b.degree !== a.degree) return b.degree - a.degree;
      return a.slug.localeCompare(b.slug);
    });

  return project ?? null;
}
