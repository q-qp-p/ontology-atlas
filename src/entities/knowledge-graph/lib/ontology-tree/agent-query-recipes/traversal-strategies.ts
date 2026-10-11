import { ATLAS_CLI_HINT_EN } from "@/shared/config/cli-invocation";
import { formatAgentMcpQueryPayload } from "./mcp-payloads";
import {
  ALL_PATHS_RESULT_CONTRACT,
  SCAN_RESULT_CONTRACT,
  formatAgentQueryCallCliCommand,
  uniqueString,
} from "./query-recipes";
import type {
  AgentMcpQueryCall,
  AgentProjectEntrypoint,
  AgentQueryEntrypoint,
  AgentTraversalStrategy,
} from "./types";

export function formatAgentTraversalStrategyPrompt(strategy: AgentTraversalStrategy): string {
  const payloads = strategy.payloads
    .map((payload, index) => `${index + 1}. ${payload.operation}\n${formatAgentMcpQueryPayload(payload)}`)
    .join("\n\n");
  const evidence = strategy.evidence.map((item) => `- ${item}`).join("\n");
  const stopWhen = strategy.stopWhen.map((item) => `- ${item}`).join("\n");

  return [
    "Use this ontology-atlas MCP traversal strategy before treating graph paths as evidence.",
    "Run the calls in order. Plan first, enumerate only with bounds, then cross-check containment when ownership or direction matters.",
    ...ALL_PATHS_RESULT_CONTRACT,
    "",
    "Evidence to report:",
    evidence,
    "",
    "Stop and narrow before writing if:",
    stopWhen,
    "",
    payloads,
  ].join("\n");
}

export function formatAgentTraversalPacket(
  strategies: readonly AgentTraversalStrategy[],
): string {
  const gates = strategies
    .map((strategy, index) => {
      const evidence = strategy.evidence.map((item) => `  - ${item}`).join("\n");
      const stopWhen = strategy.stopWhen.map((item) => `  - ${item}`).join("\n");
      return [
        `${index + 1}. ${strategy.id} (${strategy.priority})`,
        "Evidence to report:",
        evidence,
        "Stop and narrow before writing if:",
        stopWhen,
      ].join("\n");
    })
    .join("\n\n");
  const payloads = strategies
    .flatMap((strategy) =>
      strategy.payloads.map((payload) => ({
        strategyId: strategy.id,
        payload,
      })),
    )
    .map(
      ({ strategyId, payload }, index) =>
        `${index + 1}. ${strategyId} / ${payload.operation}\n${formatAgentMcpQueryPayload(payload)}`,
    )
    .join("\n\n");
  const cliCommands = strategies
    .flatMap((strategy) => strategy.payloads)
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
    "Use this ontology-atlas graph traversal packet before treating graph paths as evidence.",
    "Run query_plan before all_paths, keep traversal bounded, and cross-check containment before changing ownership, domain boundaries, or relation direction.",
    ...ALL_PATHS_RESULT_CONTRACT,
    ...SCAN_RESULT_CONTRACT,
    "",
    "Execution gates:",
    gates,
    "",
    "MCP calls:",
    payloads,
    ...cliFallback,
  ].join("\n");
}

export function buildAgentTraversalStrategies(
  entrypoints: readonly AgentQueryEntrypoint[] = [],
  projectEntrypoint: AgentProjectEntrypoint | null = null,
): AgentTraversalStrategy[] {
  const impactSlug = entrypoints[0]?.slug ?? "<from-slug>";
  const pathTargetSlug =
    entrypoints.find((entrypoint) => entrypoint.slug !== impactSlug)?.slug ?? "<to-slug>";
  const projectSlug = projectEntrypoint?.slug ?? "<project-slug>";
  const traversalBudget = {
    maxHops: 3,
    limit: 10,
    searchBudget: 1000,
    types: ["depends_on", "relates"],
  };

  const query = (
    operation: string,
    argumentsPayload: Record<string, unknown>,
  ): AgentMcpQueryCall => ({
    operation: `query_ontology.${operation}`,
    tool: "query_ontology",
    arguments: argumentsPayload,
  });

  const traversalPlan = query("query_plan", {
    operation: "query_plan",
    targetOperation: "all_paths",
    from: impactSlug,
    to: pathTargetSlug,
    ...traversalBudget,
  });
  const boundedPaths = query("all_paths", {
    operation: "all_paths",
    from: impactSlug,
    to: pathTargetSlug,
    ...traversalBudget,
  });

  return [
    {
      id: "plan_before_enumeration",
      titleKey: "agentTraversalStrategyPlanTitle",
      promptKey: "agentTraversalStrategyPlanPrompt",
      priority: "first",
      evidence: [
        "query_plan.execution.nextStep",
        "query_plan.execution.suggestedQuery",
        "query_plan.execution.saferQuery when present",
      ],
      stopWhen: [
        "execution.nextStep is narrow or review and the saferQuery still lacks maxHops/types/searchBudget bounds.",
      ],
      payloads: [traversalPlan],
    },
    {
      id: "bounded_path_evidence",
      titleKey: "agentTraversalStrategyBoundedTitle",
      promptKey: "agentTraversalStrategyBoundedPrompt",
      priority: "evidence",
      evidence: [
        "all_paths.evidence.status",
        "all_paths.evidence.reason",
        "all_paths.evidence.pathsComplete",
        "all_paths.totalPathsExact",
      ],
      stopWhen: [
        "evidence.status is partial, evidence.pathsComplete is false, or totalPathsExact is false; follow evidence.suggestedQuery or evidence.saferQuery before writing.",
      ],
      payloads: [boundedPaths],
    },
    {
      id: "containment_cross_check",
      titleKey: "agentTraversalStrategyContainmentTitle",
      promptKey: "agentTraversalStrategyContainmentPrompt",
      priority: "confirm",
      evidence: [
        "pattern_walk rows for project -> domains -> capabilities",
        "project_map domain placement and boundary edges",
      ],
      stopWhen: [
        "pattern_walk and project_map disagree on project/domain placement.",
      ],
      payloads: [
        query("pattern_walk", {
          operation: "pattern_walk",
          slug: projectSlug,
          pattern: ["domains", "capabilities"],
          direction: "outgoing",
          limit: 20,
        }),
        query("project_map", {
          operation: "project_map",
          project: projectSlug,
          limit: 10,
          itemLimit: 20,
        }),
      ],
    },
  ];
}
