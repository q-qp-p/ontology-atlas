import type { AgentMcpQueryCall, AgentMcpToolCall } from "./types";

const AGENT_QUERY_OPERATIONS = new Set([
  "all_paths",
  "agent_brief",
  "workspace_brief",
  "query_plan",
  "health",
  "components",
  "cycles",
  "topological_order",
  "growth_plan",
  "maintenance_plan",
  "node_profile",
  "path",
  "explain_relation",
  "similar_nodes",
  "relation_check",
  "blast_radius",
  "domain_matrix",
  "centrality",
  "match_nodes",
  "match_edges",
  "facets",
  "pattern_walk",
  "project_map",
  "schema",
]);

const AGENT_QUERY_PLAN_TARGETS = new Set([
  "all_paths",
  "blast_radius",
  "centrality",
  "match_edges",
  "match_nodes",
]);

export function validateAgentMcpQueryCall(payload: AgentMcpQueryCall): string[] {
  const issues: string[] = [];
  if (payload.tool !== "query_ontology") {
    issues.push(`tool must be query_ontology, received ${payload.tool}`);
  }
  const operation = payload.arguments.operation;
  if (typeof operation !== "string" || !AGENT_QUERY_OPERATIONS.has(operation)) {
    issues.push(`unsupported query_ontology operation: ${String(operation)}`);
  }
  if (operation === "query_plan") {
    const targetOperation = payload.arguments.targetOperation;
    if (
      typeof targetOperation !== "string" ||
      !AGENT_QUERY_PLAN_TARGETS.has(targetOperation)
    ) {
      issues.push(`unsupported query_plan targetOperation: ${String(targetOperation)}`);
    }
  }
  if (payload.operation !== `query_ontology.${String(operation)}`) {
    issues.push(
      `operation label must be query_ontology.${String(operation)}, received ${payload.operation}`,
    );
  }
  return issues;
}

export function validateAgentMcpToolCall(payload: AgentMcpToolCall): string[] {
  if (payload.tool === "query_ontology") {
    return validateAgentMcpQueryCall(payload as AgentMcpQueryCall);
  }

  const issues: string[] = [];
  if (payload.tool === "find_backlinks") {
    if (payload.operation !== "find_backlinks") {
      issues.push(`operation label must be find_backlinks, received ${payload.operation}`);
    }
    const slug = payload.arguments.slug;
    if (typeof slug !== "string" || slug.trim() === "") {
      issues.push("find_backlinks.slug must be a non-empty string");
    }
    return issues;
  }

  if (payload.tool === "validate_vault") {
    if (payload.operation !== "validate_vault") {
      issues.push(`operation label must be validate_vault, received ${payload.operation}`);
    }
    const keys = Object.keys(payload.arguments);
    if (keys.length > 0) {
      issues.push(`validate_vault takes no UI guardrail arguments, received ${keys.join(", ")}`);
    }
    return issues;
  }

  issues.push(`unsupported MCP tool: ${(payload as { tool: string }).tool}`);
  return issues;
}

export function formatAgentMcpQueryPayload(payload: AgentMcpQueryCall): string {
  const issues = validateAgentMcpQueryCall(payload);
  if (issues.length > 0) {
    throw new Error(`Invalid agent MCP query payload: ${issues.join("; ")}`);
  }
  return JSON.stringify({ tool: payload.tool, arguments: payload.arguments }, null, 2);
}

export function formatAgentMcpToolPayload(payload: AgentMcpToolCall): string {
  const issues = validateAgentMcpToolCall(payload);
  if (issues.length > 0) {
    throw new Error(`Invalid agent MCP tool payload: ${issues.join("; ")}`);
  }
  return JSON.stringify({ tool: payload.tool, arguments: payload.arguments }, null, 2);
}
