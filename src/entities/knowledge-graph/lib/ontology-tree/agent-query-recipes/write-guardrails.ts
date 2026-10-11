import { buildAgentPostChangeSyncCliCommands } from "../agent-readiness";
import { formatAgentMcpToolPayload } from "./mcp-payloads";
import type { AgentMcpToolCall, AgentQueryEntrypoint, AgentWriteGuardrail } from "./types";

export function formatAgentGuardrailPrompt(guardrail: AgentWriteGuardrail): string {
  const payloads = guardrail.payloads
    .map((payload, index) => `${index + 1}. ${payload.operation}\n${formatAgentMcpToolPayload(payload)}`)
    .join("\n\n");
  const cliFallback =
    guardrail.cliFallbackCommands && guardrail.cliFallbackCommands.length > 0
      ? [
          "",
          "CLI fallback:",
          ...guardrail.cliFallbackCommands.map((command, index) => `${index + 1}. ${command}`),
        ]
      : [];

  return [
    "Use this ontology-atlas MCP write gate before changing the vault.",
    "Run the reads/preflights in order, cite the evidence, then perform the write only when the target relation or rename is still justified.",
    "For relation_check, follow recommendation.decision first: skip_existing means do not add, review_inverse or review_new_schema means pause and explain before writing.",
    "",
    payloads,
    ...cliFallback,
  ].join("\n");
}

export function buildAgentWriteGuardrails(
  entrypoints: readonly AgentQueryEntrypoint[] = [],
): AgentWriteGuardrail[] {
  const impactSlug = entrypoints[0]?.slug ?? "<from-slug>";
  const targetSlug =
    entrypoints.find((entrypoint) => entrypoint.slug !== impactSlug)?.slug ?? "<to-slug>";

  const query = (
    operation: string,
    argumentsPayload: Record<string, unknown>,
  ): AgentMcpToolCall => ({
    operation: `query_ontology.${operation}`,
    tool: "query_ontology",
    arguments: argumentsPayload,
  });

  return [
    {
      id: "preflight_relation",
      titleKey: "agentGuardrailRelationTitle",
      promptKey: "agentGuardrailRelationPrompt",
      payloads: [
        query("relation_check", {
          operation: "relation_check",
          from: impactSlug,
          to: targetSlug,
          type: "depends_on",
        }),
        query("explain_relation", {
          operation: "explain_relation",
          from: impactSlug,
          to: targetSlug,
          direction: "undirected",
          maxHops: 5,
          types: ["depends_on", "relates"],
          limit: 10,
        }),
        query("path", {
          operation: "path",
          from: impactSlug,
          to: targetSlug,
          maxHops: 5,
        }),
      ],
    },
    {
      id: "preflight_rename",
      titleKey: "agentGuardrailRenameTitle",
      promptKey: "agentGuardrailRenamePrompt",
      payloads: [
        {
          operation: "find_backlinks",
          tool: "find_backlinks",
          arguments: { slug: impactSlug },
        },
        query("node_profile", {
          operation: "node_profile",
          slug: impactSlug,
          depth: 1,
          limit: 12,
        }),
      ],
    },
    {
      id: "post_change_sync",
      titleKey: "agentGuardrailSyncTitle",
      promptKey: "agentGuardrailSyncPrompt",
      payloads: [
        query("health", { operation: "health" }),
        query("cycles", { operation: "cycles", maxHops: 8 }),
        query("growth_plan", { operation: "growth_plan", limit: 20 }),
        query("maintenance_plan", { operation: "maintenance_plan", limit: 20 }),
        {
          operation: "validate_vault",
          tool: "validate_vault",
          arguments: {},
        },
      ],
      cliFallbackCommands: buildAgentPostChangeSyncCliCommands().map((item) => item.command),
    },
  ];
}
