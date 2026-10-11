import { formatAgentGraphDbQueryPack } from "./graph-db-query-pack";
import { formatAgentRunOrderPrompt } from "./query-recipes";
import type {
  AgentGraphDbQueryPackItem,
  AgentProjectEntrypoint,
  AgentQueryEntrypoint,
  AgentQueryRecipe,
  AgentTraversalStrategy,
  AgentWriteGuardrail,
} from "./types";
import { formatAgentGuardrailPrompt } from "./write-guardrails";

function formatAgentKindClassificationGuidance(): string {
  return [
    "Kind classification contract before writing frontmatter:",
    "- Do not classify from the label alone. Treat kind as an evidence-backed role in the shared conceptualization.",
    "- Classify from evidence in this order: project scope -> domain boundary -> capability behavior -> implementation element; use unknown only as a temporary review state.",
    "- project: product/system scope root; use sparingly, usually one per repo.",
    "- domain: shared vocabulary boundary or product/business area that owns capabilities.",
    "- capability: user-visible behavior, workflow, or coherent system ability.",
    "- element: concrete implementation part such as UI component, API, CLI command, script, module, schema, or file-level unit.",
    "- unknown: temporary review signal; use similar_nodes and relation_check evidence before leaving it permanent.",
    "- High-confidence gate: write a new or changed kind only when another agent could repeat the same choice from the cited evidence; otherwise keep the node unknown/reviewed and ask for more evidence.",
    "- Decision questions: project asks 'is this the whole product/system scope?', domain asks 'does this own a vocabulary boundary?', capability asks 'what behavior or workflow does this enable?', element asks 'which concrete code artifact implements or supports it?'.",
    "- Common near-miss rule: if the evidence is only a file path, start as element; promote to capability only when behavior/workflow evidence exists, and promote to domain only when multiple capabilities share the boundary.",
    "- Containment spine: project contains domains, domains contain capabilities, and capabilities realize through elements; use depends_on/relates only after that ownership path is clear.",
    "- For capability and element nodes, set or verify domain before writing so browse/map/edit colors carry a meaningful ownership boundary.",
    "- Color contract: kind hue communicates ontology layer, while domain tint communicates ownership; a wrong color is evidence that kind/domain should be rechecked.",
    "- Before writing, report source path, symbol, route, command, or MCP tool evidence; then state why not the nearest adjacent kind.",
    "If the resulting ontology color feels wrong in browse/map/edit surfaces, re-check the kind against evidence and patch the frontmatter instead of leaving a misleading category.",
  ].join("\n");
}

export function buildAgentHandoffPrompt(
  recipes: AgentQueryRecipe[],
  entrypoints: readonly AgentQueryEntrypoint[] = [],
  projectEntrypoint: AgentProjectEntrypoint | null = null,
  traversalStrategies: readonly AgentTraversalStrategy[] = [],
  graphDbQueryPack: readonly AgentGraphDbQueryPackItem[] = [],
  guardrails: readonly AgentWriteGuardrail[] = [],
): string {
  const runOrder = formatAgentRunOrderPrompt(recipes);
  const projectIndexingCheckpoint = formatAgentProjectIndexingCheckpoint();
  const graphDbPackSection =
    graphDbQueryPack.length > 0
      ? [
          "",
          "Graph DB query pack for local markdown graph scans:",
          formatAgentGraphDbQueryPack(graphDbQueryPack),
        ]
      : [];
  const guardrailSection =
    guardrails.length > 0
      ? [
          "",
          "Write guardrails before changing the markdown vault:",
          "Relation decision guide: skip_existing means do not add; review_inverse and review_new_schema require explicit justification; safe_to_add still requires citing relation_check evidence.",
          ...guardrails.map(
            (guardrail, index) =>
              `## Guardrail ${index + 1}. ${guardrail.id}\n${formatAgentGuardrailPrompt(guardrail)}`,
          ),
        ]
      : [];
  const suggestedSlugs =
    entrypoints.length > 0 || projectEntrypoint
      ? [
          "",
          "Suggested starting slugs for impact/path queries:",
          ...(projectEntrypoint
            ? [
                `- ${projectEntrypoint.slug} (project, degree ${projectEntrypoint.degree})`,
              ]
            : []),
          ...entrypoints.map(
            (entrypoint) =>
              `- ${entrypoint.slug} (${entrypoint.kind}, degree ${entrypoint.degree})`,
          ),
        ]
      : [];

  return [
    "Use the ontology-atlas MCP server as the codebase graph memory before editing.",
    "Start with the first-contact calls below, inspect health before writes, and run query_plan before heavier impact queries.",
    "For relation_check results, follow recommendation.decision before using proposedAction; review_inverse and review_new_schema require an explicit human-readable justification before add_relation.",
    "For match_nodes and match_edges, run the returned followUp calls before treating scan rows as graph evidence.",
    traversalStrategies.length > 0
      ? `Traversal strategy: ${traversalStrategies.map((strategy) => strategy.id).join(" -> ")}.`
      : "Traversal strategy: plan_before_enumeration -> bounded_path_evidence -> containment_cross_check.",
    formatAgentKindClassificationGuidance(),
    "When code changes introduce or rename a domain, capability, element, or relation, sync the docs/ontology vault before finishing.",
    "",
    runOrder,
    "",
    projectIndexingCheckpoint,
    ...graphDbPackSection,
    ...guardrailSection,
    ...suggestedSlugs,
  ].join("\n");
}

function formatAgentProjectIndexingCheckpoint(): string {
  return [
    "Project ontology indexing checkpoint (side effect 0):",
    "Use this when the task depends on understanding a whole codebase root, especially before adding source-shaped capabilities.",
    "MCP: index_project({\"rootPath\":\"[codebase-root]\"})",
    "CLI fallback: node cli/src/index.mjs index [codebase-root] --vault docs/ontology --json --threshold 2",
    "Report these fields before proposing writes:",
    "- meaningGate.businessOntology.evidenceRows: README/docs/ontology rows that justify domains or capabilities.",
    "- meaningGate.implementationEvidence.reviewRequiredRows: source folders that still need human product meaning.",
    "- plan.concepts, plan.suggestedRelations, plan.importRelations, validation.problemFiles, validation.pathDrift.",
    "Do not promote source folders into capabilities when existing ontology evidence maps them through matching slugs or capability elements.",
  ].join("\n");
}
