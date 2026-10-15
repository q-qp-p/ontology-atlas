import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "../../model";

/** The single count behind every "N concepts, M relations"; a different scope needs a different word. */
export interface CanonicalCensus {
  conceptCount: number;
  relationCount: number;
}

export function isCanonicalConcept(node: Pick<KnowledgeGraphNode, 'kind'>): boolean {
  return node.kind !== 'vault-readme';
}

const MAP_CONCEPT_KINDS: ReadonlySet<string> = new Set(['project', 'domain', 'capability', 'element']);

/** What the map draws; a document is evidence, not a concept on the map. */
export function isMapConcept(node: Pick<KnowledgeGraphNode, 'kind'>): boolean {
  return MAP_CONCEPT_KINDS.has(node.kind);
}

export function computeCanonicalCensus(
  nodes: readonly KnowledgeGraphNode[],
  edges: readonly KnowledgeGraphEdge[],
): CanonicalCensus {
  return {
    conceptCount: nodes.filter(isMapConcept).length,
    relationCount: edges.length,
  };
}
