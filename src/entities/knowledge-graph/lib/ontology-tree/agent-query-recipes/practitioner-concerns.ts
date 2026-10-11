import { AGENT_GRAPH_DB_RUNTIME_GATE_COMMAND } from "../agent-readiness";
import type { AgentPractitionerConcern } from "./types";

const AGENT_PRACTITIONER_RESEARCH_NODE = "documents/agent-practice-research";

export const AGENT_PRACTITIONER_CONCERNS: readonly AgentPractitionerConcern[] = [
  {
    id: "context",
    title: "Context reliability",
    body: "Cite AGENTS.md, CLAUDE.md, an ontology node, or an MCP result before the agent guesses.",
    gate: "agent_brief or workspace_brief names the entrypoint and current blockers.",
    researchSignals: [
      "Anthropic: simple workflows and explicit context beat broad autonomy when the task path is knowable.",
      "OpenAI Codex: AGENTS.md-style persistent repo guidance and issue-shaped prompts give agents stable workspace context.",
    ],
    sourceUrls: [
      "https://www.anthropic.com/engineering/building-effective-agents",
      "https://cdn.openai.com/pdf/6a2631dc-783e-479b-b1a4-af0cfbd38630/how-openai-uses-codex.pdf",
    ],
    productResponse:
      "Make ontology entrypoints, blockers, and project memory copyable before any long-running agent task starts.",
  },
  {
    id: "tools",
    title: "Tool boundary",
    body: "Show MCP setup, tool filtering, approval boundary, duplicate tool names, and connection failures before writes.",
    gate: "Claude Code /mcp or Codex codex mcp list confirms the live server.",
    researchSignals: [
      "OpenAI Agents SDK: MCP servers can be stdio, streamable HTTP, or hosted, and sensitive tool calls can require approval.",
      "MCP security guidance: use explicit consent and progressive least-privilege scopes.",
    ],
    sourceUrls: [
      "https://openai.github.io/openai-agents-js/guides/mcp/",
      "https://modelcontextprotocol.io/docs/tutorials/security/authorization",
    ],
    productResponse:
      "Expose MCP server status, first calls, approval boundary, and write guardrails before the user trusts agent actions.",
  },
  {
    id: "evidence",
    title: "Evidence loop",
    body: "Make health, graph DB pack, relation_check, and post-change sync runnable and comparable.",
    gate: "The UI offers a copyable proof command, not only an explanatory label.",
    researchSignals: [
      "Cognition: async agent work becomes unmanageable unless it returns end-to-end verification artifacts.",
      "Codex: real product verification includes native app evidence, not only code edits.",
    ],
    sourceUrls: [
      "https://cognition.ai/blog/testing-development",
      "https://cdn.openai.com/pdf/6a2631dc-783e-479b-b1a4-af0cfbd38630/how-openai-uses-codex.pdf",
    ],
    productResponse:
      "Turn graph DB checks, route smoke, desktop verification, and post-change sync into repeatable proof packets.",
  },
  {
    id: "drift",
    title: "Memory drift",
    body: "Reveal stale markdown memory, skills, hooks, duplicate ontology concepts, and unresolved graph references.",
    gate: "health or maintenance_plan names the drift, or the feature should not claim it fixed memory.",
    researchSignals: [
      "LangChain: semantic memory, episodic memory, and procedural skills need explicit storage and retrieval paths.",
      "MCP threat models call out stale permissions, broad scopes, and indirect context manipulation.",
    ],
    sourceUrls: [
      "https://docs.langchain.com/oss/python/deepagents/memory",
      "https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices",
    ],
    productResponse:
      "Surface stale ontology nodes, unresolved references, duplicate concepts, and risky MCP assumptions as named graph issues.",
  },
  {
    id: "workflow",
    title: "Workflow fit",
    body: "Keep the loop simple and composable before long autonomous runs or subagent handoff.",
    gate: "one small read-check-write-sync loop works before parallel or long-running agent work.",
    researchSignals: [
      "Anthropic: use workflows for predictable paths and agents for open-ended loops that need environmental feedback.",
      "OpenAI Agents SDK: MCP approval interruptions keep humans in the loop for sensitive actions.",
    ],
    sourceUrls: [
      "https://www.anthropic.com/engineering/building-effective-agents",
      "https://openai.github.io/openai-agents-js/guides/mcp/",
    ],
    productResponse:
      "Prefer one small ontology read-check-write-sync loop before exposing broader automation or multi-agent handoff.",
  },
];

export function formatAgentPractitionerConcernsChecklist(): string {
  return [
    "# Ontology Atlas agent feature decision checklist",
    "Use this before adding a Claude Code, Codex, or MCP-facing feature.",
    "",
    `Ontology research anchor: ${AGENT_PRACTITIONER_RESEARCH_NODE}`,
    `MCP read: get_concept({"slug":"${AGENT_PRACTITIONER_RESEARCH_NODE}"})`,
    "",
    ...AGENT_PRACTITIONER_CONCERNS.flatMap((concern, index) => [
      `${index + 1}. ${concern.title}: ${concern.body}`,
      `   Gate: ${concern.gate}`,
      `   Research signal: ${concern.researchSignals.join(" / ")}`,
      `   Sources: ${concern.sourceUrls.join(" / ")}`,
      `   Ontology Atlas response: ${concern.productResponse}`,
    ]),
    "",
    "Minimum proof before shipping:",
    '1. query_ontology({"operation":"health"})',
    '2. query_ontology({"operation":"agent_brief"})',
    `3. ${AGENT_GRAPH_DB_RUNTIME_GATE_COMMAND}`,
  ].join("\n");
}
