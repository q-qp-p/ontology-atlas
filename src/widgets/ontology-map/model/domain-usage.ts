import { readContainmentTree, rollDomainDependencies, type TreeInputEdge, type TreeInputNode } from "./containment-tree";

const DRAWN_KINDS: ReadonlySet<string> = new Set(["project", "domain", "capability", "element"]);

export interface DomainUsageRow {
  domainId: string;
  label: string;
  links: number;
}

export interface DomainUsage {
  usedBy: DomainUsageRow[];
  needs: DomainUsageRow[];
}

export function readDomainUsage(
  nodes: readonly { id: string; label: string; kind: string }[],
  edges: readonly TreeInputEdge[],
  domainId: string,
): DomainUsage | null {
  const drawn = nodes.filter((node): node is TreeInputNode => DRAWN_KINDS.has(node.kind));
  const tree = readContainmentTree(drawn, edges);
  const labelOf = new Map(tree.domains.map((domain) => [domain.id, domain.label] as const));
  if (!labelOf.has(domainId)) return null;
  const usedBy = new Map<string, number>();
  const needs = new Map<string, number>();
  for (const dep of rollDomainDependencies(tree, edges)) {
    if (dep.fromDomain === dep.toDomain) continue;
    if (dep.toDomain === domainId) usedBy.set(dep.fromDomain, (usedBy.get(dep.fromDomain) ?? 0) + 1);
    if (dep.fromDomain === domainId) needs.set(dep.toDomain, (needs.get(dep.toDomain) ?? 0) + 1);
  }
  const rows = (tally: Map<string, number>): DomainUsageRow[] =>
    [...tally]
      .map(([id, links]) => ({ domainId: id, label: labelOf.get(id) ?? id, links }))
      .sort((a, b) => b.links - a.links || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  return { usedBy: rows(usedBy), needs: rows(needs) };
}
