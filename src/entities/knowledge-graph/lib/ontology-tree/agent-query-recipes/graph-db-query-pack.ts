import {
  AGENT_GRAPH_DB_CLI_SELF_CHECK_COMMAND,
  AGENT_GRAPH_DB_RUNTIME_GATE_COMMAND,
} from "../agent-readiness";
import { ATLAS_CLI_HINT_EN } from "@/shared/config/cli-invocation";
import { formatAgentMcpQueryPayload } from "./mcp-payloads";
import {
  ALL_PATHS_RESULT_CONTRACT,
  SCAN_RESULT_CONTRACT,
  formatAgentQueryCallCliCommand,
  uniqueString,
} from "./query-recipes";
import type { AgentGraphDbQueryPackItem, AgentMcpQueryCall, AgentQueryEntrypoint } from "./types";

const AGENT_MODE_GUIDE = [
  "Mode guide:",
  "- CLI-only: validate, workspace-brief, graph scans, graph DB pack, and fallback timing work from Terminal without MCP.",
  "- MCP-connected: Claude Code, Codex, or Cursor can call local read/write tools with structured repair fields and write guardrails.",
  "- Graph DB pack: bounded query plans, node/edge scans, domain matrix, paths, and relation explanations without a database server.",
  "- Setup gate: run the JSON fallback check before edits and read ok separately from performanceOk.",
];

export function formatAgentGraphDbQueryPackItemPrompt(
  item: AgentGraphDbQueryPackItem,
): string {
  const payloads = item.payloads
    .map((payload, index) => `${index + 1}. ${payload.operation}\n${formatAgentMcpQueryPayload(payload)}`)
    .join("\n\n");
  const cliCommands = item.payloads
    .map(formatAgentQueryCallCliCommand)
    .filter((command): command is string => command !== null)
    .filter(uniqueString);
  const cliFallback =
    cliCommands.length > 0
      ? [
          "",
          "CLI fallback commands when the MCP connector is unavailable:",
          // Every emitted `$ATLAS` command carries the hint for filling the placeholder.
          ATLAS_CLI_HINT_EN,
          ...cliCommands.map((command, index) => `${index + 1}. ${command}`),
        ]
      : [];

  return [
    "Use this ontology-atlas graph DB-style query pack before treating graph scan rows as evidence.",
    `Intent: ${item.intent}`,
    ...ALL_PATHS_RESULT_CONTRACT,
    ...SCAN_RESULT_CONTRACT,
    "",
    "MCP calls:",
    payloads,
    ...cliFallback,
  ].join("\n");
}

export function formatAgentGraphDbQueryPack(
  items: readonly AgentGraphDbQueryPackItem[],
): string {
  const sections = items
    .map(
      (item, index) =>
        `## ${index + 1}. ${item.id}\n${formatAgentGraphDbQueryPackItemPrompt(item)}`,
    )
    .join("\n\n");

  return [
    "Use this ontology-atlas graph DB query pack to scan the local markdown vault like a graph database, but keep evidence bounded and follow-up driven.",
    "Run plan calls before scans when provided. Report totalMatches, limited, row count, followUp details, and traversal completeness before making claims or writes.",
    "",
    sections,
  ].join("\n");
}

export function formatAgentGraphDbCliPack(
  items: readonly AgentGraphDbQueryPackItem[],
): string {
  const commands = agentGraphDbCliPackCommands(items);

  return [
    "Run these ontology-atlas CLI commands when the MCP connector is unavailable.",
    "They mirror the Graph DB query pack: plan scans first, keep traversal bounded, and use follow-up evidence before writing.",
    ...AGENT_MODE_GUIDE,
    "Gate first: Claude Code/Codex automation can parse ok, performanceOk, failed, timeoutMs, slowThresholdMs, slow, commands[].timedOut, commands[].slow, and slowest.elapsedMs; then the runtime gate replays the graph DB pack against docs/ontology.",
    `0. [self_check] ${AGENT_GRAPH_DB_CLI_SELF_CHECK_COMMAND}`,
    `1. [runtime_gate] ${AGENT_GRAPH_DB_RUNTIME_GATE_COMMAND}`,
    "Runtime replay includes: health --json, focused_blast_radius, scan follow-ups, relation_name_parity, pattern_walk/project_map containment, bounded all_paths evidence, relation_check, and relation explanation.",
    "",
    "Evidence rule: scan rows are candidates, not proof; cite follow-up detail before writing or refactoring.",
    "Proof checklist: report totalMatches/limited/row count, run node_profile or blast_radius for node rows, run explain/path/relation-check for edge rows, and report evidence.pathsComplete for paths.",
    "",
    ...commands.map(({ itemId, command }, index) => {
      const item = items.find((candidate) => candidate.id === itemId);
      const intent = item?.intent ? `\n   intent: ${item.intent}` : "";
      return `${index + 2}. [${itemId}] ${command}${intent}`;
    }),
  ].join("\n");
}

export function countAgentGraphDbCliPackCommands(
  items: readonly AgentGraphDbQueryPackItem[],
): number {
  return 2 + agentGraphDbCliPackCommands(items).length;
}

function agentGraphDbCliPackCommands(items: readonly AgentGraphDbQueryPackItem[]) {
  return items
    .flatMap((item) =>
      item.payloads
        .map(formatAgentQueryCallCliCommand)
        .filter((command): command is string => command !== null)
        .map((command) => ({ itemId: item.id, command })),
    )
    .filter(({ command }, index, values) =>
      values.findIndex((value) => value.command === command) === index,
    );
}

export function buildAgentGraphDbQueryPack(
  entrypoints: readonly AgentQueryEntrypoint[] = [],
): AgentGraphDbQueryPackItem[] {
  const impactSlug = entrypoints[0]?.slug ?? "<from-slug>";
  const pathTargetSlug =
    entrypoints.find((entrypoint) => entrypoint.slug !== impactSlug)?.slug ?? "<to-slug>";

  const query = (
    operation: string,
    argumentsPayload: Record<string, unknown>,
  ): AgentMcpQueryCall => ({
    operation: `query_ontology.${operation}`,
    tool: "query_ontology",
    arguments: argumentsPayload,
  });

  return [
    {
      id: "graph_facets",
      titleKey: "agentGraphDbFacetsTitle",
      promptKey: "agentGraphDbFacetsPrompt",
      intent: "MATCH graph RETURN kind/domain/degree/relation facets LIMIT 10",
      payloads: [
        query("facets", {
          operation: "facets",
          limit: 10,
        }),
        query("schema", {
          operation: "schema",
          limit: 20,
        }),
      ],
    },
    {
      id: "node_scan",
      titleKey: "agentGraphDbNodeScanTitle",
      promptKey: "agentGraphDbNodeScanPrompt",
      intent: "MATCH (n:capability) WHERE degree(n) >= 2 RETURN n ORDER BY degree(n) DESC LIMIT 10",
      payloads: [
        query("query_plan", {
          operation: "query_plan",
          targetOperation: "match_nodes",
          kind: "capability",
          minDegree: 2,
          sort: "degree",
          limit: 10,
        }),
        query("match_nodes", {
          operation: "match_nodes",
          kind: "capability",
          minDegree: 2,
          sort: "degree",
          limit: 10,
        }),
      ],
    },
    {
      id: "edge_scan",
      titleKey: "agentGraphDbEdgeScanTitle",
      promptKey: "agentGraphDbEdgeScanPrompt",
      intent: "MATCH ()-[r:depends_on]->() RETURN r LIMIT 20",
      payloads: [
        query("query_plan", {
          operation: "query_plan",
          targetOperation: "match_edges",
          types: ["depends_on"],
          limit: 20,
        }),
        query("match_edges", {
          operation: "match_edges",
          types: ["depends_on"],
          limit: 20,
        }),
      ],
    },
    {
      id: "domain_coupling",
      titleKey: "agentGraphDbDomainCouplingTitle",
      promptKey: "agentGraphDbDomainCouplingPrompt",
      intent: "MATCH (domain)-[depends_on|relates]->(domain) RETURN coupling_matrix LIMIT 6",
      payloads: [
        query("domain_matrix", {
          operation: "domain_matrix",
          types: ["depends_on", "relates"],
          limit: 6,
        }),
        query("query_plan", {
          operation: "query_plan",
          targetOperation: "centrality",
          types: ["depends_on", "relates"],
          limit: 10,
        }),
        query("centrality", {
          operation: "centrality",
          types: ["depends_on", "relates"],
          limit: 10,
        }),
      ],
    },
    {
      id: "path_evidence",
      titleKey: "agentGraphDbPathEvidenceTitle",
      promptKey: "agentGraphDbPathEvidencePrompt",
      intent: "MATCH p=(from)-[:depends_on|relates*..3]-(to) RETURN p LIMIT 10",
      payloads: [
        query("query_plan", {
          operation: "query_plan",
          targetOperation: "all_paths",
          from: impactSlug,
          to: pathTargetSlug,
          maxHops: 3,
          types: ["depends_on", "relates"],
          searchBudget: 1000,
          limit: 10,
        }),
        query("all_paths", {
          operation: "all_paths",
          from: impactSlug,
          to: pathTargetSlug,
          maxHops: 3,
          types: ["depends_on", "relates"],
          searchBudget: 1000,
          limit: 10,
        }),
        query("explain_relation", {
          operation: "explain_relation",
          from: impactSlug,
          to: pathTargetSlug,
          direction: "undirected",
          maxHops: 5,
          types: ["depends_on", "relates"],
          limit: 10,
        }),
      ],
    },
    {
      id: "business_questions",
      titleKey: "agentGraphDbBusinessQuestionsTitle",
      promptKey: "agentGraphDbBusinessQuestionsPrompt",
      intent:
        "MATCH business questions TO outcomes, domain boundaries, capability claims, and implementation evidence",
      payloads: [
        query("facets", {
          operation: "facets",
        }),
        query("query_plan", {
          operation: "query_plan",
          targetOperation: "match_nodes",
          kind: "domain",
          sort: "degree",
          limit: 10,
        }),
        query("match_nodes", {
          operation: "match_nodes",
          kind: "domain",
          sort: "degree",
          limit: 10,
        }),
        query("domain_matrix", {
          operation: "domain_matrix",
          types: ["depends_on", "relates"],
          limit: 6,
        }),
        query("query_plan", {
          operation: "query_plan",
          targetOperation: "match_nodes",
          kind: "capability",
          sort: "degree",
          limit: 10,
        }),
        query("match_nodes", {
          operation: "match_nodes",
          kind: "capability",
          sort: "degree",
          limit: 10,
        }),
        query("query_plan", {
          operation: "query_plan",
          targetOperation: "match_edges",
          fromKind: "capability",
          toKind: "element",
          types: ["elements", "depends_on", "relates"],
          limit: 20,
        }),
        query("match_edges", {
          operation: "match_edges",
          fromKind: "capability",
          toKind: "element",
          types: ["elements", "depends_on", "relates"],
          limit: 20,
        }),
      ],
    },
  ];
}
