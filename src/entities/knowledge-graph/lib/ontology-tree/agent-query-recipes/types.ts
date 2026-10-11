type AgentQueryRecipeId =
  | "all_paths"
  | "agent_brief"
  | "workspace_brief"
  | "query_plan"
  | "health"
  | "components"
  | "cycles"
  | "topological_order"
  | "growth_plan"
  | "maintenance_plan"
  | "node_profile"
  | "path"
  | "explain_relation"
  | "similar_nodes"
  | "relation_check"
  | "blast_radius"
  | "domain_matrix"
  | "pattern_walk";

export interface AgentQueryRecipe {
  id: AgentQueryRecipeId;
  operation: string;
  promptKey: string;
  tool: "query_ontology";
  arguments: Record<string, unknown>;
  priority: "primary" | "secondary";
}

export interface AgentMcpQueryCall {
  operation: string;
  tool: "query_ontology";
  arguments: Record<string, unknown>;
}

export interface AgentQueryEntrypoint {
  slug: string;
  title: string;
  kind: string;
  degree: number;
}

export interface AgentProjectEntrypoint {
  slug: string;
  title: string;
  degree: number;
}

type AgentInvestigationPlaybookId =
  | "refactor_impact"
  | "onboarding_map"
  | "coupling_audit"
  | "graph_traversal";

type AgentTraversalStrategyId =
  | "plan_before_enumeration"
  | "bounded_path_evidence"
  | "containment_cross_check";

type AgentWriteGuardrailId =
  | "preflight_relation"
  | "preflight_rename"
  | "post_change_sync";

type AgentGraphDbQueryPackId =
  | "graph_facets"
  | "node_scan"
  | "edge_scan"
  | "domain_coupling"
  | "path_evidence"
  | "business_questions";

type AgentPractitionerConcernId =
  | "context"
  | "tools"
  | "evidence"
  | "drift"
  | "workflow";

export interface AgentInvestigationPlaybook {
  id: AgentInvestigationPlaybookId;
  titleKey: string;
  promptKey: string;
  evidence: string[];
  stopWhen: string[];
  payloads: AgentMcpQueryCall[];
}

export interface AgentTraversalStrategy {
  id: AgentTraversalStrategyId;
  titleKey: string;
  promptKey: string;
  priority: "first" | "evidence" | "confirm";
  evidence: string[];
  stopWhen: string[];
  payloads: AgentMcpQueryCall[];
}

export interface AgentMcpToolCall {
  operation: string;
  tool: "query_ontology" | "find_backlinks" | "validate_vault";
  arguments: Record<string, unknown>;
}

export interface AgentWriteGuardrail {
  id: AgentWriteGuardrailId;
  titleKey: string;
  promptKey: string;
  payloads: AgentMcpToolCall[];
  cliFallbackCommands?: string[];
}

export interface AgentGraphDbQueryPackItem {
  id: AgentGraphDbQueryPackId;
  titleKey: string;
  promptKey: string;
  intent: string;
  payloads: AgentMcpQueryCall[];
}

export type AgentBusinessQuestionFocus = "outcome" | "boundary" | "claim" | "evidence";

export interface AgentPractitionerConcern {
  id: AgentPractitionerConcernId;
  title: string;
  body: string;
  gate: string;
  researchSignals: readonly string[];
  sourceUrls: readonly string[];
  productResponse: string;
}
