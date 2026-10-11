import { ATLAS_CLI_HINT_EN } from "@/shared/config/cli-invocation";
import { formatAgentMcpQueryPayload } from "./mcp-payloads";
import {
  ALL_PATHS_RESULT_CONTRACT,
  SCAN_RESULT_CONTRACT,
  formatAgentQueryCallCliCommand,
  uniqueString,
} from "./query-recipes";
import type {
  AgentInvestigationPlaybook,
  AgentMcpQueryCall,
  AgentProjectEntrypoint,
  AgentQueryEntrypoint,
} from "./types";

export function formatAgentPlaybookPrompt(playbook: AgentInvestigationPlaybook): string {
  const payloads = playbook.payloads
    .map((payload, index) => `${index + 1}. ${payload.operation}\n${formatAgentMcpQueryPayload(payload)}`)
    .join("\n\n");
  const cliCommands = playbook.payloads
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
  const evidence = playbook.evidence.map((item) => `- ${item}`).join("\n");
  const stopWhen = playbook.stopWhen.map((item) => `- ${item}`).join("\n");

  return [
    "Use the ontology-atlas MCP server to answer this investigation intent before editing.",
    "Run the calls in order, cite the returned slugs/edges in your reasoning, and only write to the vault after the graph evidence is clear.",
    ...ALL_PATHS_RESULT_CONTRACT,
    ...SCAN_RESULT_CONTRACT,
    "",
    "Evidence to report:",
    evidence,
    "",
    "Stop and explain before writing if:",
    stopWhen,
    "",
    payloads,
    ...cliFallback,
  ].join("\n");
}

export function buildAgentInvestigationPlaybooks(
  entrypoints: readonly AgentQueryEntrypoint[] = [],
  projectEntrypoint: AgentProjectEntrypoint | null = null,
): AgentInvestigationPlaybook[] {
  const impactSlug = entrypoints[0]?.slug ?? "<slug>";
  const pathTargetSlug =
    entrypoints.find((entrypoint) => entrypoint.slug !== impactSlug)?.slug ?? "<other-slug>";
  const projectSlug = projectEntrypoint?.slug ?? "<project-slug>";

  const recipe = (
    operation: string,
    argumentsPayload: Record<string, unknown>,
  ): AgentMcpQueryCall => ({
    operation: `query_ontology.${operation}`,
    tool: "query_ontology",
    arguments: argumentsPayload,
  });

  return [
    {
      id: "refactor_impact",
      titleKey: "agentPlaybookRefactorTitle",
      promptKey: "agentPlaybookRefactorPrompt",
      evidence: [
        "Target node profile, incoming blast radius groups, and the highest-risk affected slugs.",
        "Whether an existing direct edge, path, or common-neighbor explanation already explains the proposed relation.",
        "The relation_check recommendation.decision before any add_relation.",
      ],
      stopWhen: [
        "health reports failing checks or actionable nextActions.",
        "relation_check returns skip_existing, review_inverse, or review_new_schema.",
        "blast radius crosses domains that are outside the requested change.",
      ],
      payloads: [
        recipe("workspace_brief", { operation: "workspace_brief" }),
        recipe("query_plan", {
          operation: "query_plan",
          targetOperation: "blast_radius",
          slug: impactSlug,
          depth: 2,
        }),
        recipe("node_profile", {
          operation: "node_profile",
          slug: impactSlug,
          depth: 2,
          limit: 12,
        }),
        recipe("blast_radius", {
          operation: "blast_radius",
          slug: impactSlug,
          depth: 2,
          direction: "incoming",
        }),
        recipe("path", {
          operation: "path",
          from: impactSlug,
          to: pathTargetSlug,
          maxHops: 5,
        }),
        recipe("explain_relation", {
          operation: "explain_relation",
          from: impactSlug,
          to: pathTargetSlug,
          direction: "undirected",
          maxHops: 5,
          types: ["depends_on", "relates"],
          limit: 10,
        }),
        recipe("relation_check", {
          operation: "relation_check",
          from: impactSlug,
          to: pathTargetSlug,
          type: "depends_on",
        }),
      ],
    },
    {
      id: "onboarding_map",
      titleKey: "agentPlaybookOnboardingTitle",
      promptKey: "agentPlaybookOnboardingPrompt",
      evidence: [
        "Workspace status, project/domain map, and the main high-degree entrypoints.",
        "Domain coupling rows that explain where codebase knowledge clusters.",
        "Graph DB-style node scan results that surface high-degree capability starting points.",
        "One concrete hub profile to anchor the first mental model.",
      ],
      stopWhen: [
        "workspace_brief reports unresolved graph health issues.",
        "query_plan(match_nodes) asks for a narrower kind/domain/limit before scanning.",
        "node_profile cannot resolve the selected high-degree entrypoint.",
      ],
      payloads: [
        recipe("workspace_brief", { operation: "workspace_brief" }),
        recipe("domain_matrix", { operation: "domain_matrix" }),
        recipe("query_plan", {
          operation: "query_plan",
          targetOperation: "match_nodes",
          kind: "capability",
          minDegree: 2,
          sort: "degree",
          limit: 10,
        }),
        recipe("match_nodes", {
          operation: "match_nodes",
          kind: "capability",
          minDegree: 2,
          sort: "degree",
          limit: 10,
        }),
        recipe("node_profile", {
          operation: "node_profile",
          slug: impactSlug,
          depth: 2,
          limit: 12,
        }),
      ],
    },
    {
      id: "coupling_audit",
      titleKey: "agentPlaybookCouplingTitle",
      promptKey: "agentPlaybookCouplingPrompt",
      evidence: [
        "Domain-to-domain coupling hot spots.",
        "Central nodes and dependency edges that create boundary pressure.",
        "Any cycles, disconnected components, or health failures that weaken the audit.",
      ],
      stopWhen: [
        "health fails or reports dependency cycles.",
        "centrality and match_edges point to conflicting boundary conclusions.",
      ],
      payloads: [
        recipe("health", { operation: "health" }),
        recipe("domain_matrix", { operation: "domain_matrix" }),
        recipe("query_plan", {
          operation: "query_plan",
          targetOperation: "centrality",
          types: ["depends_on", "relates"],
          limit: 10,
        }),
        recipe("centrality", {
          operation: "centrality",
          types: ["depends_on", "relates"],
          limit: 10,
        }),
        recipe("query_plan", {
          operation: "query_plan",
          targetOperation: "match_edges",
          types: ["depends_on"],
          limit: 20,
        }),
        recipe("match_edges", {
          operation: "match_edges",
          types: ["depends_on"],
          limit: 20,
        }),
      ],
    },
    {
      id: "graph_traversal",
      titleKey: "agentPlaybookTraversalTitle",
      promptKey: "agentPlaybookTraversalPrompt",
      evidence: [
        "Schema patterns that make the traversal legal and meaningful.",
        "Bounded all_paths alternatives plus evidence.status, evidence.reason, and evidence.pathsComplete.",
        "Pattern-walk containment evidence and the project_map domain placement.",
      ],
      stopWhen: [
        "query_plan marks all_paths as high cost for the requested bounds.",
        "all_paths evidence.status is partial or evidence.pathsComplete is false; run evidence.suggestedQuery or saferQuery before writing.",
        "pattern_walk and project_map disagree on project/domain containment.",
      ],
      payloads: [
        recipe("schema", { operation: "schema", limit: 20 }),
        recipe("query_plan", {
          operation: "query_plan",
          targetOperation: "all_paths",
          from: impactSlug,
          to: pathTargetSlug,
          maxHops: 3,
          types: ["depends_on", "relates"],
          searchBudget: 1000,
          limit: 10,
        }),
        recipe("all_paths", {
          operation: "all_paths",
          from: impactSlug,
          to: pathTargetSlug,
          maxHops: 3,
          types: ["depends_on", "relates"],
          searchBudget: 1000,
          limit: 10,
        }),
        recipe("pattern_walk", {
          operation: "pattern_walk",
          slug: projectSlug,
          pattern: ["domains", "capabilities"],
          direction: "outgoing",
          limit: 20,
        }),
        recipe("project_map", {
          operation: "project_map",
          project: projectSlug,
          limit: 10,
          itemLimit: 20,
        }),
      ],
    },
  ];
}
