import type { KnowledgeGraphNode } from "../../model";

export interface OntologyTreeNode {
  node: KnowledgeGraphNode;
  /** 0 at a root. */
  depth: number;
  children: OntologyTreeNode[];
  /** A node repeated in a `contains` chain is skipped and recorded in `warnings`. */
}

export interface OntologyTreeBuildResult {
  /** Tree roots, typically `kind: project`. */
  roots: OntologyTreeNode[];
  /** Nodes no tree reached, usually documents or a broken containment chain. */
  orphans: KnowledgeGraphNode[];
  /** Data problems found while building: cycles, multiple parents, disconnects. */
  warnings: string[];
}
