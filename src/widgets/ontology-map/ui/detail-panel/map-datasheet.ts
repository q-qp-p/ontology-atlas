/**
 * Pure view-model helpers for the component datasheet panel (`docs/design/ontology-map.md` section
 * 5): no React, i18n or DOM. Groups use the same connection set as the metric line, so counts
 * agree. Base derivation lives in `entities/knowledge-graph`, re-exported here under `V2` names.
 */
export {
  buildConnections as buildV2Connections,
  type DatasheetConnection as V2DatasheetConnection,
} from "@/entities/knowledge-graph";
import { groupConnectionsByRole } from "@/entities/knowledge-graph";
import type { DatasheetConnection as V2DatasheetConnection } from "@/entities/knowledge-graph";
import type { DomainUsage } from "../../model/domain-usage";

/**
 * S2 part 3 — when the "Contains" (what this contains) list is long (>15), show an
 * aggregate summary by kind and path prefix instead of individual rows (e.g.
 * "cli/src/commands 48 · .claude/skills 6 · Other 12"). Pure and deterministic:
 * count per prefix → descending count, ties by key alphabetically → only the top
 * `maxGroups` are named, and the rest plus prefix-less rows become `otherCount`
 * ("Other", other).
 */
export interface V2ContainsGroupSummary {
  groups: { key: string; count: number }[];
  otherCount: number;
  total: number;
  /**
   * B4 (the H1 non-developer language layer) — does the summary actually carry
   * information? `false` means it collapsed into a single "Other" lump and
   * carries nothing, so the panel renders the individual list instead. `true` as
   * soon as one named group exists.
   */
  usable: boolean;
}

/** The threshold that turns the "Contains" group summary on — a total **above** this shows the summary. */
export const V2_CONTAINS_SUMMARY_THRESHOLD = 15;

/** Take only the slug part of a node id (`kind:slug`), dropping the `kind:` prefix. */
function idToSlug(id: string): string {
  const colon = id.indexOf(":");
  return colon === -1 ? id : id.slice(colon + 1);
}

/** The directory prefix up to the last slash — null with no slash (folds into "Other").
 * e.g. `cli/src/commands/add` → `cli/src/commands`. */
function deepPrefixKey(id: string): string | null {
  const slug = idToSlug(id);
  const slash = slug.lastIndexOf("/");
  if (slash === -1) return null;
  return slug.slice(0, slash);
}

/**
 * The first path segment (one level), or null with no slash. Re-splits more coarsely when deep
 * prefixes all scatter to count 1 and collapse into "Other".
 */
function coarsePrefixKey(id: string): string | null {
  const slug = idToSlug(id);
  const slash = slug.indexOf("/");
  if (slash === -1) return null;
  return slug.slice(0, slash);
}

/** Build prefix buckets from one key function (pure). Descending count, ties by key
 * alphabetically. Only the top `cap` are named; the rest plus prefix-less rows become `otherCount`. */
function bucketByKey(
  rows: readonly V2DatasheetConnection[],
  keyOf: (id: string) => string | null,
  cap: number,
): { groups: { key: string; count: number }[]; otherCount: number } {
  const counts = new Map<string, number>();
  let noPrefix = 0;
  for (const row of rows) {
    const key = keyOf(row.id);
    if (key === null) {
      noPrefix += 1;
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
  const named = sorted.slice(0, cap);
  let otherCount = noPrefix;
  for (const [, c] of sorted.slice(cap)) otherCount += c;
  return { groups: named.map(([key, count]) => ({ key, count })), otherCount };
}

/**
 * Aggregate "Contains" rows by path prefix. Deterministic: descending count, ties by
 * key alphabetically. Only the top `maxGroups` are named; the remaining prefixes plus
 * prefix-less rows fold into `otherCount`.
 *
 * B4 (H1) — when the deep prefixes all scatter and "Other" takes the majority (zero
 * information), re-split more coarsely on the first path segment and take whichever
 * actually divides. If still no group is named (no row has a slash), mark
 * `usable: false` so the panel renders the individual list instead.
 */
export function summarizeContainsByPathPrefix(
  rows: readonly V2DatasheetConnection[],
  maxGroups: number = 4,
): V2ContainsGroupSummary {
  const total = rows.length;
  const cap = Math.max(0, maxGroups);
  const deep = bucketByKey(rows, deepPrefixKey, cap);

  // If "Other" takes the majority or no group is named, retry with the coarser one-level prefix.
  let chosen = deep;
  if (deep.groups.length === 0 || deep.otherCount * 2 > total) {
    const coarse = bucketByKey(rows, coarsePrefixKey, cap);
    // Take whichever has the larger named coverage (= total - otherCount), keeping the
    // more specific deep split on a tie.
    const deepCovered = total - deep.otherCount;
    const coarseCovered = total - coarse.otherCount;
    if (coarseCovered > deepCovered) chosen = coarse;
  }

  return {
    groups: chosen.groups,
    otherCount: chosen.otherCount,
    total,
    usable: chosen.groups.length > 0,
  };
}

/** One relation-role group as the panel renders it: a capped preview of rows +
 * the group's TRUE total (so the header can say "Uses 23" while showing 6). */
export interface V2ConnectionGroupView {
  rows: V2DatasheetConnection[];
  total: number;
  /**
   * The uncapped full rows, so "+N" is a door opened in place rather than a dead number.
   * It references the pre-cap array directly, so the extra cost is one reference.
   */
  allRows?: V2DatasheetConnection[];
  /**
   * S2 part 3 — the path-prefix aggregate, filled only for the "Contains" group (shown
   * instead of the individual list once the total exceeds the threshold). Computed
   * over all rows, before the cap.
   */
  summary?: V2ContainsGroupSummary;
}
export interface V2ConnectionGroupsView {
  /** Outgoing containment — plain "Contains" (what this node contains). */
  contains: V2ConnectionGroupView;
  /** Incoming directed relations — plain "Used by". */
  usedBy: V2ConnectionGroupView;
  /** Outgoing directed relations — plain "Leans on". */
  dependsOn: V2ConnectionGroupView;
  /** Incoming containment, plain "Belongs To", so a node with only a parent is not "Connected 0". */
  belongsTo: V2ConnectionGroupView;
  /** `relates` either way, plain "Related": it names no direction, so it joins neither side. */
  related: V2ConnectionGroupView;
}

/** Default rows shown per group before the typed "+N" overflow. */
const V2_CONNECTION_ROW_CAP = 6;

/**
 * The full connection set by role, each group capped to `perGroupCap` rows with its true total.
 * `groupConnectionsByRole` is the split full detail uses too, so the two surfaces cannot disagree,
 * and the handoff's counts are these totals.
 */
export function buildV2ConnectionGroups(
  connections: readonly V2DatasheetConnection[],
  perGroupCap: number = V2_CONNECTION_ROW_CAP,
): V2ConnectionGroupsView {
  const grouped = groupConnectionsByRole(connections);
  const cap = Math.max(0, perGroupCap);
  const toView = (rows: readonly V2DatasheetConnection[]): V2ConnectionGroupView => ({
    rows: rows.slice(0, cap),
    total: rows.length,
    allRows: rows.slice(),
  });
  return {
    // Past the threshold the panel draws this summary instead of the rows.
    contains: { ...toView(grouped.contains), summary: summarizeContainsByPathPrefix(grouped.contains) },
    usedBy: toView(grouped.usedBy),
    dependsOn: toView(grouped.dependsOn),
    belongsTo: toView(grouped.belongsTo),
    related: toView(grouped.related),
  };
}

export interface V2MetricValues {
  /** Outgoing containment — plain "Contains" (what this node contains). Only
   *  rendered when > 0 (leaf nodes contain nothing, so the segment is hidden
   *  for them rather than showing a noisy "Contains 0"). */
  contains: number;
  /** Direct incoming non-containment — plain "Uses" (places that use this). */
  usedBy: number;
  /** Direct outgoing non-containment — plain "Is Used By" (places this leans on). */
  dependsOn: number;
  /**
   * Direct incoming containment — plain "Belongs To" (the parent(s) this node sits
   * inside). Most nodes have nothing but a parent, so leaving this out zeroes the
   * total (see the `V2ConnectionGroupsView.belongsTo` comment).
   */
  belongsTo: number;
  /** Node-level evidence references — plain "Evidence". */
  evidence: number;
}

export interface V2MetricLabels {
  contains: string;
  usedBy: string;
  dependsOn: string;
  belongsTo: string;
  evidence: string;
}

/** One typed segment of the engraved metric line — `key` matches the
 * connection-group id below it (`data-datasheet-group`), so the strip and the
 * groups stay reconciled by construction. */
export interface V2MetricSegment {
  key: "contains" | "usedBy" | "dependsOn" | "belongsTo" | "evidence";
  label: string;
  value: number;
}

/**
 * The engraved metric line's segments, e.g. "Contains 18, Uses 4, Is Used By 2, Evidence 1".
 * The "Contains" segment appears only for container nodes (`contains > 0`). Segments are
 * structured so the panel can set label ink apart from value ink.
 */
export function buildV2MetricSegments(
  values: V2MetricValues,
  labels: V2MetricLabels,
): V2MetricSegment[] {
  const segments: V2MetricSegment[] = [];
  if (values.contains > 0)
    segments.push({ key: "contains", label: labels.contains, value: values.contains });
  segments.push({ key: "usedBy", label: labels.usedBy, value: values.usedBy });
  segments.push({ key: "dependsOn", label: labels.dependsOn, value: values.dependsOn });
  // "Belongs To" follows the same rule as "Contains" — hidden only at 0, so a root or
  // orphan node never carries "Belongs To 0". Hiding it when it exists is the defect above.
  if (values.belongsTo > 0)
    segments.push({ key: "belongsTo", label: labels.belongsTo, value: values.belongsTo });
  segments.push({ key: "evidence", label: labels.evidence, value: values.evidence });
  return segments;
}

/** Joined-string form of `buildV2MetricSegments` — kept for handoff/plain
 * text consumers and as the single source of the "label value · …" grammar. */
export function formatV2MetricLine(
  values: V2MetricValues,
  labels: V2MetricLabels,
): string {
  return buildV2MetricSegments(values, labels)
    .map((s) => `${s.label} ${s.value}`)
    .join(" · ");
}

/**
 * One row in the promoted evidence group, from `KnowledgeGraphNode.evidenceIds` (a vault slug naming
 * the node's backing `.md`), split into `title` (last segment) and `path` prefix. Read-only: vault
 * slugs are not canvas node ids, so rows are not wired to `onSelectConnection`.
 */
export interface V2EvidenceRow {
  id: string;
  title: string;
  path: string | null;
}

/**
 * Formats raw `evidenceIds` into display rows, one per non-blank id,
 * preserving input order. Pure/no dedup beyond blank-skipping — a node's
 * evidenceIds are already a short, mostly-single-entry list.
 */
export function buildV2EvidenceRows(
  evidenceIds: readonly string[],
): V2EvidenceRow[] {
  const rows: V2EvidenceRow[] = [];
  for (const raw of evidenceIds) {
    const id = raw.trim();
    if (!id) continue;
    const lastSlash = id.lastIndexOf("/");
    if (lastSlash === -1) {
      rows.push({ id, title: id, path: null });
    } else {
      rows.push({ id, title: id.slice(lastSlash + 1), path: id.slice(0, lastSlash + 1) });
    }
  }
  return rows;
}

/**
 * The last segment of a path-like string (a slug or vault path); with no `/` the source is
 * returned unchanged. Same last-slash split as `buildV2EvidenceRows`. The full source folds
 * into `title=`.
 */
export function slugDisplaySegment(slug: string): string {
  const lastSlash = slug.lastIndexOf("/");
  return lastSlash === -1 ? slug : slug.slice(lastSlash + 1);
}

export interface V2HandoffInput {
  /** The graph facts and the MCP write target must describe the same source. */
  source: "loaded-vault" | "read-only-sample";
  slug: string;
  /**
   * Does this node have its own `.md` document? Without one, `slug` is the raw
   * reference text another document wrote down, so `get_concept` / `patch_concept`
   * do not apply — the handoff then offers the call that creates the document first.
   * (Unset reads as documented, as before.)
   */
  documented?: boolean;
  kind: string;
  domainTitle: string | null;
  /** The same typed counts the panel's group headers show. */
  contains: number;
  usedBy: number;
  dependsOn: number;
  /** The parent, or a node with only a parent reads as an orphan. */
  belongsTo: number;
  related: number;
  evidence: number;
  /** Each group's shown row names. */
  containsNames: readonly string[];
  usedByNames: readonly string[];
  dependsNames: readonly string[];
  belongsToNames: readonly string[];
  relatedNames: readonly string[];
  /** A domain's partners as the panel lists them; absent for every other kind. */
  domainUsage?: DomainUsage | null;
}

/**
 * Agent-ready handoff payload for a single node: stable English field keys plus a suggested MCP call,
 * so it pastes into a coding agent in any UI locale (the button label is localized, this is not).
 * Deterministic; carries the typed buckets, and a domain's partners as the panel lists them.
 */
export function formatV2HandoffText(input: V2HandoffInput): string {
  const list = (names: readonly string[]) =>
    names.length > 0 ? names.join(", ") : "-";
  const documented = input.documented !== false;
  const next =
    input.source !== "loaded-vault"
      ? "next: open a markdown vault, then copy a node handoff from that loaded vault"
      : documented
        ? `next: get_concept("${input.slug}") → review context, then patch_concept / add_relation as needed`
        // A derived node with no document — `get_concept` would look up a name that does
        // not exist and stop there. The only form the vault knows this concept in is a
        // reference string written by another document, so the first step is creating a
        // document under that name.
        : `next: add_concept({slug:"${input.slug}", kind:"${input.kind}"}) — this concept has no document yet; it exists only as a reference written in another doc`;
  return [
    `source: ${input.source}`,
    `node: ${input.slug}`,
    `has_document: ${documented ? "yes" : "no"}`,
    `kind: ${input.kind}`,
    `domain: ${input.domainTitle ?? "-"}`,
    `contains: ${input.contains}`,
    `used_by: ${input.usedBy}`,
    `depends_on: ${input.dependsOn}`,
    `belongs_to: ${input.belongsTo}`,
    `related: ${input.related}`,
    `evidence: ${input.evidence}`,
    `contains_names: ${list(input.containsNames)}`,
    `used_by_names: ${list(input.usedByNames)}`,
    `depends_names: ${list(input.dependsNames)}`,
    `belongs_to_names: ${list(input.belongsToNames)}`,
    `related_names: ${list(input.relatedNames)}`,
    ...(input.domainUsage
      ? [
          `used_by_domains: ${list(input.domainUsage.usedBy.map((row) => `${row.label} (${row.links})`))}`,
          `needs_domains: ${list(input.domainUsage.needs.map((row) => `${row.label} (${row.links})`))}`,
          "domains_basis: depends_on links between the two domains' concepts, counted as the map draws them",
        ]
      : []),
    ...(input.source === "read-only-sample"
      ? [
          "write_guard: do not run get_concept / patch_concept / add_relation for this sample node",
        ]
      : []),
    next,
  ].join("\n");
}
