import type { AgentReadinessStatus } from "../agent-readiness";
import { ATLAS_CLI, ATLAS_CLI_HINT_EN } from "@/shared/config/cli-invocation";
import { formatAgentMcpQueryPayload } from "./mcp-payloads";
import type {
  AgentMcpQueryCall,
  AgentProjectEntrypoint,
  AgentQueryEntrypoint,
  AgentQueryRecipe,
} from "./types";

export const ALL_PATHS_RESULT_CONTRACT = [
  "For all_paths, report limit, searchBudget, expandedStates, exhaustive, truncatedByBudget, totalPathsExact, evidence.status, evidence.reason, and evidence.pathsComplete.",
  "Treat returned paths as partial evidence unless evidence.pathsComplete is true; when evidence.status is partial, follow evidence.suggestedQuery or evidence.saferQuery before writing.",
  "Do not use a single returned path as proof when all_paths is limited, budget-truncated, or evidence.pathsComplete is false.",
];

export const SCAN_RESULT_CONTRACT = [
  "For match_nodes and match_edges, report totalMatches, limited, row count, and followUp details before treating scan rows as evidence.",
  "Run match_nodes followUp calls such as node_profile, match_edges, and blast_radius before using a node row for onboarding or refactor decisions.",
  "Run match_edges followUp calls such as explain_relation, path, and relation_check before using an edge row as write, refactor, or coupling evidence.",
];

export function formatAgentRecipePayload(recipe: AgentQueryRecipe): string {
  return formatAgentMcpQueryPayload(recipe);
}

export function formatAgentRunOrderPrompt(recipes: readonly AgentQueryRecipe[]): string {
  const payloads = recipes
    .map((recipe, index) => `${index + 1}. ${recipe.operation}\n${formatAgentRecipePayload(recipe)}`)
    .join("\n\n");
  const cliCommands = recipes
    .map(formatAgentRecipeCliCommand)
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
    "Use this ontology-atlas first-contact run order before answering from the codebase graph.",
    "Run the MCP calls in order. Report health, cite concrete slugs/edges, and run query_plan before heavier traversal or impact queries.",
    ...ALL_PATHS_RESULT_CONTRACT,
    ...SCAN_RESULT_CONTRACT,
    "",
    payloads,
    ...cliFallback,
  ].join("\n");
}

export function formatAgentRecipeCliCommand(recipe: AgentQueryRecipe): string | null {
  return formatAgentQueryArgumentsCliCommand(recipe.arguments);
}

export function formatAgentQueryCallCliCommand(payload: AgentMcpQueryCall): string | null {
  return formatAgentQueryArgumentsCliCommand(payload.arguments);
}

function formatAgentQueryArgumentsCliCommand(args: Record<string, unknown>): string | null {
  switch (args.operation) {
    case "agent_brief":
      return `${ATLAS_CLI} agent-brief [vault]`;
    case "workspace_brief":
      return `${ATLAS_CLI} workspace-brief [vault]`;
    case "health":
      return `${ATLAS_CLI} health [vault]`;
    case "facets":
      return withFlags(`${ATLAS_CLI} facets [vault]`, [
        positiveFlag("--limit", args.limit),
      ]);
    case "schema":
      return withFlags(`${ATLAS_CLI} schema [vault]`, [
        positiveFlag("--limit", args.limit),
      ]);
    case "components":
      return withFlags(`${ATLAS_CLI} components [vault]`, [
        positiveFlag("--limit", args.limit),
        positiveFlag("--node-limit", args.nodeLimit),
      ]);
    case "cycles":
      return withFlags(`${ATLAS_CLI} cycles [vault]`, [
        nonNegativeFlag("--max-hops", args.maxHops),
      ]);
    case "topological_order":
      return withFlags(`${ATLAS_CLI} topological-order [vault]`, [
        positiveFlag("--limit", args.limit),
      ]);
    case "growth_plan":
      return withFlags(`${ATLAS_CLI} growth [vault]`, [
        positiveFlag("--limit", args.limit),
      ]);
    case "maintenance_plan":
      return withFlags(`${ATLAS_CLI} maintenance [vault]`, [
        positiveFlag("--limit", args.limit),
      ]);
    case "query_plan": {
      if (args.targetOperation === "blast_radius") {
        const slug = stringArg(args.slug, "<slug>");
        return withFlags(`${ATLAS_CLI} blast-radius ${shellQuote(slug)} [vault]`, [
          "--plan",
          nonNegativeFlag("--depth", args.depth),
          stringFlag("--direction", args.direction),
        ]);
      }
      if (args.targetOperation === "centrality") {
        return withFlags(`${ATLAS_CLI} hubs [vault]`, [
          "--plan",
          positiveFlag("--limit", args.limit),
          csvFlag("--types", args.types),
        ]);
      }
      if (args.targetOperation === "match_edges") {
        return formatMatchEdgesCommand(args, { plan: true });
      }
      if (args.targetOperation === "match_nodes") {
        return formatMatchNodesCommand(args, { plan: true });
      }
      if (args.targetOperation === "all_paths") {
        const from = stringArg(args.from, "<from-slug>");
        const to = stringArg(args.to, "<to-slug>");
        return withFlags(`${ATLAS_CLI} all-paths ${shellQuote(from)} ${shellQuote(to)} [vault]`, [
          "--plan",
          allPathsPlanForceFlag(args),
          nonNegativeFlag("--max-hops", args.maxHops),
          csvFlag("--types", args.types),
          positiveFlag("--search-budget", args.searchBudget),
          positiveFlag("--limit", args.limit),
        ]);
      }
      return null;
    }
    case "node_profile": {
      const slug = stringArg(args.slug, "<slug>");
      return withFlags(`${ATLAS_CLI} node ${shellQuote(slug)} [vault]`, [
        positiveFlag("--limit", args.limit),
      ]);
    }
    case "path": {
      const from = stringArg(args.from, "<from-slug>");
      const to = stringArg(args.to, "<to-slug>");
      return withFlags(`${ATLAS_CLI} path ${shellQuote(from)} ${shellQuote(to)} [vault]`, [
        nonNegativeFlag("--max-hops", args.maxHops),
      ]);
    }
    case "explain_relation": {
      const from = stringArg(args.from, "<from-slug>");
      const to = stringArg(args.to, "<to-slug>");
      return withFlags(`${ATLAS_CLI} explain ${shellQuote(from)} ${shellQuote(to)} [vault]`, [
        stringFlag("--direction", args.direction),
        nonNegativeFlag("--max-hops", args.maxHops),
        csvFlag("--types", args.types),
        positiveFlag("--limit", args.limit),
      ]);
    }
    case "similar_nodes": {
      const title = stringArg(args.title, "<candidate-title>");
      return withFlags(`${ATLAS_CLI} similar ${shellQuote(title)} [vault]`, [
        stringFlag("--slug", args.candidateSlug),
        stringFlag("--kind", args.kind),
        positiveFlag("--limit", args.limit),
      ]);
    }
    case "relation_check": {
      const from = stringArg(args.from, "<from-slug>");
      const to = stringArg(args.to, "<to-slug>");
      const type = stringArg(args.type, "depends_on");
      return `${ATLAS_CLI} relation-check ${shellQuote(from)} ${shellQuote(to)} ${shellQuote(type)} [vault]`;
    }
    case "blast_radius": {
      const slug = stringArg(args.slug, "<slug>");
      return withFlags(`${ATLAS_CLI} blast-radius ${shellQuote(slug)} [vault]`, [
        nonNegativeFlag("--depth", args.depth),
        stringFlag("--direction", args.direction),
      ]);
    }
    case "all_paths": {
      const from = stringArg(args.from, "<from-slug>");
      const to = stringArg(args.to, "<to-slug>");
      return withFlags(`${ATLAS_CLI} all-paths ${shellQuote(from)} ${shellQuote(to)} [vault]`, [
        "--plan",
        allPathsPlanForceFlag(args),
        nonNegativeFlag("--max-hops", args.maxHops),
        csvFlag("--types", args.types),
        positiveFlag("--search-budget", args.searchBudget),
        positiveFlag("--limit", args.limit),
      ]);
    }
    case "centrality":
      return withFlags(`${ATLAS_CLI} hubs [vault]`, [
        positiveFlag("--limit", args.limit),
        csvFlag("--types", args.types),
      ]);
    case "match_edges":
      return formatMatchEdgesCommand(args);
    case "match_nodes":
      return formatMatchNodesCommand(args);
    case "domain_matrix":
      return withFlags(`${ATLAS_CLI} domain-matrix [vault]`, [
        stringFlag("--project", args.project),
        positiveFlag("--limit", args.limit),
        csvFlag("--types", args.types),
      ]);
    case "pattern_walk": {
      const slug = stringArg(args.slug, "<slug>");
      return withFlags(`${ATLAS_CLI} pattern-walk ${shellQuote(slug)} [vault]`, [
        csvFlag("--pattern", args.pattern),
        stringFlag("--direction", args.direction),
        positiveFlag("--limit", args.limit),
      ]);
    }
    case "project_map": {
      const project = stringArg(args.project ?? args.slug, "<project-slug>");
      return withFlags(`${ATLAS_CLI} project-map ${shellQuote(project)} [vault]`, [
        positiveFlag("--limit", args.limit),
        positiveFlag("--item-limit", args.itemLimit),
      ]);
    }
    default:
      return null;
  }
}

function formatMatchEdgesCommand(
  args: Record<string, unknown>,
  options: { plan?: boolean } = {},
): string {
  return withFlags(`${ATLAS_CLI} match-edges [vault]`, [
    options.plan ? "--plan" : null,
    stringFlag("--from", args.from),
    stringFlag("--to", args.to),
    stringFlag("--from-kind", args.fromKind),
    stringFlag("--to-kind", args.toKind),
    stringFlag("--type", args.type),
    csvFlag("--types", args.types),
    booleanFlag("--include-external", args.includeExternal),
    booleanFlag("--include-unresolved", args.includeUnresolved),
    positiveFlag("--limit", args.limit),
  ]);
}

function formatMatchNodesCommand(
  args: Record<string, unknown>,
  options: { plan?: boolean } = {},
): string {
  return withFlags(`${ATLAS_CLI} match-nodes [vault]`, [
    options.plan ? "--plan" : null,
    stringFlag("--kind", args.kind),
    stringFlag("--domain", args.domain),
    stringFlag("--slug-contains", args.slugContains),
    nonNegativeFlag("--min-degree", args.minDegree),
    nonNegativeFlag("--max-degree", args.maxDegree),
    nonNegativeFlag("--min-in-degree", args.minInDegree),
    nonNegativeFlag("--min-out-degree", args.minOutDegree),
    booleanFlag("--has-incoming", args.hasIncoming),
    booleanFlag("--has-outgoing", args.hasOutgoing),
    stringFlag("--sort", args.sort),
    positiveFlag("--limit", args.limit),
  ]);
}

function withFlags(command: string, flags: Array<string | null>): string {
  const parts = [command, ...flags.filter((flag): flag is string => Boolean(flag))];
  return parts.join(" ");
}

function stringArg(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stringFlag(name: string, value: unknown): string | null {
  return typeof value === "string" && value.trim() ? `${name} ${shellQuote(value)}` : null;
}

function positiveFlag(name: string, value: unknown): string | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? `${name} ${value}`
    : null;
}

function nonNegativeFlag(name: string, value: unknown): string | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? `${name} ${value}`
    : null;
}

function allPathsPlanForceFlag(args: Record<string, unknown>): string | null {
  return typeof args.maxHops === "number" && Number.isInteger(args.maxHops) && args.maxHops > 1
    ? "--force"
    : null;
}

function csvFlag(name: string, value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return values.length > 0 ? `${name} ${values.map(shellQuote).join(",")}` : null;
}

function booleanFlag(name: string, value: unknown): string | null {
  return value === true ? name : null;
}

export function uniqueString(value: string, index: number, values: string[]): boolean {
  return values.indexOf(value) === index;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** A narrow, status-aware set of `query_ontology` recipes, so users need not learn 30+ operations first. */
export function buildAgentQueryRecipes(
  status: AgentReadinessStatus,
  entrypoints: readonly AgentQueryEntrypoint[] = [],
  projectEntrypoint: AgentProjectEntrypoint | null = null,
): AgentQueryRecipe[] {
  const impactSlug = entrypoints[0]?.slug ?? "<slug>";
  const impactTitle = entrypoints[0]?.title ?? "<candidate-title>";
  const impactKind = entrypoints[0]?.kind ?? "capability";
  const pathTargetSlug = entrypoints.find((entrypoint) => entrypoint.slug !== impactSlug)?.slug ?? "<other-slug>";
  const projectSlug = projectEntrypoint?.slug ?? "<project-slug>";
  const common: AgentQueryRecipe[] = [
    {
      id: "agent_brief",
      operation: "query_ontology.agent_brief",
      promptKey: "agentRecipePromptAgentBrief",
      tool: "query_ontology",
      arguments: { operation: "agent_brief" },
      priority: "primary",
    },
    {
      id: "workspace_brief",
      operation: "query_ontology.workspace_brief",
      promptKey: "agentRecipePromptWorkspaceBrief",
      tool: "query_ontology",
      arguments: { operation: "workspace_brief" },
      priority: "primary",
    },
    {
      id: "query_plan",
      operation: "query_ontology.query_plan",
      promptKey: "agentRecipePromptQueryPlan",
      tool: "query_ontology",
      arguments: {
        operation: "query_plan",
        targetOperation: "blast_radius",
        slug: impactSlug,
        depth: 2,
      },
      priority: "secondary",
    },
    {
      id: "health",
      operation: "query_ontology.health",
      promptKey: "agentRecipePromptHealth",
      tool: "query_ontology",
      arguments: { operation: "health" },
      priority: status === "ready" ? "secondary" : "primary",
    },
    {
      id: "node_profile",
      operation: "query_ontology.node_profile",
      promptKey: "agentRecipePromptNodeProfile",
      tool: "query_ontology",
      arguments: {
        operation: "node_profile",
        slug: impactSlug,
        depth: 2,
        limit: 12,
      },
      priority: "secondary",
    },
    {
      id: "components",
      operation: "query_ontology.components",
      promptKey: "agentRecipePromptComponents",
      tool: "query_ontology",
      arguments: { operation: "components", limit: 20 },
      priority: "secondary",
    },
    {
      id: "path",
      operation: "query_ontology.path",
      promptKey: "agentRecipePromptPath",
      tool: "query_ontology",
      arguments: {
        operation: "path",
        from: impactSlug,
        to: pathTargetSlug,
        maxHops: 5,
      },
      priority: "secondary",
    },
    {
      id: "explain_relation",
      operation: "query_ontology.explain_relation",
      promptKey: "agentRecipePromptExplainRelation",
      tool: "query_ontology",
      arguments: {
        operation: "explain_relation",
        from: impactSlug,
        to: pathTargetSlug,
        direction: "undirected",
        maxHops: 5,
        types: ["depends_on", "relates"],
        limit: 10,
      },
      priority: "secondary",
    },
    {
      id: "similar_nodes",
      operation: "query_ontology.similar_nodes",
      promptKey: "agentRecipePromptSimilarNodes",
      tool: "query_ontology",
      arguments: {
        operation: "similar_nodes",
        title: impactTitle,
        candidateSlug: impactSlug,
        kind: impactKind,
        limit: 10,
      },
      priority: "secondary",
    },
    {
      id: "relation_check",
      operation: "query_ontology.relation_check",
      promptKey: "agentRecipePromptRelationCheck",
      tool: "query_ontology",
      arguments: {
        operation: "relation_check",
        from: impactSlug,
        to: pathTargetSlug,
        type: "depends_on",
      },
      priority: "secondary",
    },
    {
      id: "blast_radius",
      operation: "query_ontology.blast_radius",
      promptKey: "agentRecipePromptBlastRadius",
      tool: "query_ontology",
      arguments: {
        operation: "blast_radius",
        slug: impactSlug,
        depth: 2,
        direction: "incoming",
      },
      priority: "secondary",
    },
    {
      id: "domain_matrix",
      operation: "query_ontology.domain_matrix",
      promptKey: "agentRecipePromptDomainMatrix",
      tool: "query_ontology",
      arguments: { operation: "domain_matrix" },
      priority: "secondary",
    },
    {
      id: "all_paths",
      operation: "query_ontology.all_paths",
      promptKey: "agentRecipePromptAllPaths",
      tool: "query_ontology",
      arguments: {
        operation: "all_paths",
        from: impactSlug,
        to: pathTargetSlug,
        maxHops: 3,
        types: ["depends_on", "relates"],
        searchBudget: 1000,
        limit: 10,
      },
      priority: "secondary",
    },
    {
      id: "pattern_walk",
      operation: "query_ontology.pattern_walk",
      promptKey: "agentRecipePromptPatternWalk",
      tool: "query_ontology",
      arguments: {
        operation: "pattern_walk",
        slug: projectSlug,
        pattern: ["domains", "capabilities"],
        direction: "outgoing",
        limit: 20,
      },
      priority: "secondary",
    },
    {
      id: "cycles",
      operation: "query_ontology.cycles",
      promptKey: "agentRecipePromptCycles",
      tool: "query_ontology",
      arguments: { operation: "cycles", maxHops: 8 },
      priority: "secondary",
    },
    {
      id: "topological_order",
      operation: "query_ontology.topological_order",
      promptKey: "agentRecipePromptTopologicalOrder",
      tool: "query_ontology",
      arguments: {
        operation: "topological_order",
        types: ["depends_on"],
        includeIsolated: false,
        limit: 20,
      },
      priority: "secondary",
    },
    {
      id: "growth_plan",
      operation: "query_ontology.growth_plan",
      promptKey: "agentRecipePromptGrowthPlan",
      tool: "query_ontology",
      arguments: { operation: "growth_plan", limit: 20 },
      priority: "secondary",
    },
    {
      id: "maintenance_plan",
      operation: "query_ontology.maintenance_plan",
      promptKey: "agentRecipePromptMaintenancePlan",
      tool: "query_ontology",
      arguments: { operation: "maintenance_plan", limit: 20 },
      priority: "secondary",
    },
  ];

  if (status === "ready") return common;
  return [...common].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "primary" ? -1 : 1;
    return common.indexOf(a) - common.indexOf(b);
  });
}
