import { QUERY_ONTOLOGY_OPERATIONS } from '../../../src/ontology-engine.mjs';

import { hasNonEmptyString } from '../value-checks.mjs';

export function agentBusinessOntologyLensFailure(lens) {
  if (!lens || typeof lens !== 'object' || Array.isArray(lens)) {
    return 'agent_brief response missing business-first ontology lens';
  }
  if (lens.policy !== 'business-first') {
    return 'agent_brief response missing business-first ontology lens';
  }
  if (!Array.isArray(lens.readOrder) || lens.readOrder.join('\0') !== ['outcome', 'domain', 'capability', 'element'].join('\0')) {
    return 'agent_brief response missing business-first ontology lens';
  }
  for (const field of ['businessDomains', 'capabilityOutcomes', 'implementationEvidence']) {
    if (!Array.isArray(lens[field]) || lens[field].some((item) => typeof item !== 'string')) {
      return 'agent_brief response missing business-first ontology lens';
    }
  }
  if (
    !Array.isArray(lens.decisionQuestions) ||
    lens.decisionQuestions.length < 4 ||
    lens.decisionQuestions.some((item) => !hasNonEmptyString(item)) ||
    !lens.decisionQuestions.some((item) => /business outcome should this ontology explain or improve/i.test(item)) ||
    !lens.decisionQuestions.some((item) => /business\/product domain boundary/i.test(item)) ||
    !lens.decisionQuestions.some((item) => /capability claim/i.test(item)) ||
    !lens.decisionQuestions.some((item) => /implementation evidence proves or disproves that capability/i.test(item))
  ) {
    return 'agent_brief response missing business-first ontology lens';
  }
  if (
    !Array.isArray(lens.guidance) ||
    lens.guidance.some((item) => !hasNonEmptyString(item)) ||
    !lens.guidance.some((item) => /business outcome first/i.test(item)) ||
    !lens.guidance.some((item) => /do not treat paths, APIs, routes, or commands as the ontology root/i.test(item))
  ) {
    return 'agent_brief response missing business-first ontology lens';
  }
  return null;
}

export function agentTraversalStrategyFailure(strategies) {
  if (!Array.isArray(strategies) || strategies.length === 0) {
    return 'agent_brief response missing traversalStrategy';
  }
  const required = ['plan_before_enumeration', 'bounded_path_evidence', 'containment_cross_check'];
  const seen = new Set();
  for (const [index, strategy] of strategies.entries()) {
    if (!hasNonEmptyString(strategy?.id, strategy?.priority, strategy?.goal, strategy?.useWhen)) {
      return `agent_brief traversalStrategy malformed row at index ${index}`;
    }
    seen.add(strategy.id);
    if (
      !Array.isArray(strategy.evidence) ||
      strategy.evidence.length === 0 ||
      strategy.evidence.some((item) => !hasNonEmptyString(item))
    ) {
      return `agent_brief traversalStrategy ${strategy.id} missing evidence checklist`;
    }
    if (
      !Array.isArray(strategy.stopWhen) ||
      strategy.stopWhen.length === 0 ||
      strategy.stopWhen.some((item) => !hasNonEmptyString(item))
    ) {
      return `agent_brief traversalStrategy ${strategy.id} missing stopWhen checklist`;
    }
    const callFailure = agentToolCallsFailure(`agent_brief traversalStrategy ${strategy.id}`, strategy.calls);
    if (callFailure) return callFailure;
  }
  const missing = required.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    return `agent_brief traversalStrategy missing strategies: ${missing.join(', ')}`;
  }
  const plan = strategies.find((strategy) => strategy.id === 'plan_before_enumeration');
  if (!agentToolCallsIncludeOperation(plan?.calls, 'query_plan')) {
    return 'agent_brief traversalStrategy plan_before_enumeration missing query_plan';
  }
  const paths = strategies.find((strategy) => strategy.id === 'bounded_path_evidence');
  if (!agentToolCallsIncludeOperation(paths?.calls, 'all_paths')) {
    return 'agent_brief traversalStrategy bounded_path_evidence missing all_paths';
  }
  if (!paths.evidence.some((item) => /evidence\.pathsComplete/.test(item))) {
    return 'agent_brief traversalStrategy bounded_path_evidence missing pathsComplete evidence';
  }
  const containment = strategies.find((strategy) => strategy.id === 'containment_cross_check');
  for (const operation of ['pattern_walk', 'project_map']) {
    if (!agentToolCallsIncludeOperation(containment?.calls, operation)) {
      return `agent_brief traversalStrategy containment_cross_check missing ${operation}`;
    }
  }
  return null;
}

export function agentResultContractsFailure(contracts) {
  if (!Array.isArray(contracts)) {
    return 'agent_brief response missing resultContracts';
  }
  const allPaths = contracts.find((contract) => contract?.operation === 'all_paths');
  if (!allPaths || typeof allPaths !== 'object' || Array.isArray(allPaths)) {
    return 'agent_brief resultContracts missing all_paths contract';
  }
  const requiredFields = [
    'limit',
    'searchBudget',
    'expandedStates',
    'exhaustive',
    'truncatedByBudget',
    'totalPathsExact',
    'evidence.status',
    'evidence.reason',
    'evidence.pathsComplete',
  ];
  if (!Array.isArray(allPaths.mustReport)) {
    return 'agent_brief all_paths resultContract missing mustReport';
  }
  const missingFields = requiredFields.filter((field) => !allPaths.mustReport.includes(field));
  if (missingFields.length > 0) {
    return `agent_brief all_paths resultContract missing mustReport fields: ${missingFields.join(', ')}`;
  }
  if (
    !Array.isArray(allPaths.partialWhen) ||
    !allPaths.partialWhen.some((condition) => /exhaustive=false/.test(condition)) ||
    !allPaths.partialWhen.some((condition) => /totalPathsExact=false/.test(condition)) ||
    !allPaths.partialWhen.some((condition) => /evidence\.status=partial/.test(condition)) ||
    !allPaths.partialWhen.some((condition) => /evidence\.pathsComplete=false/.test(condition))
  ) {
    return 'agent_brief all_paths resultContract missing partial evidence conditions';
  }
  if (
    !hasNonEmptyString(allPaths.policy) ||
    !/partial evidence/.test(allPaths.policy) ||
    !/maxHops\/types/.test(allPaths.policy)
  ) {
    return 'agent_brief all_paths resultContract missing partial-evidence policy';
  }
  return null;
}

export function agentGraphDbQueryPackFailure(pack) {
  if (!Array.isArray(pack) || pack.length === 0) {
    return 'agent_brief response missing graphDbQueryPack';
  }
  const required = ['graph_facets', 'node_scan', 'edge_scan', 'domain_coupling', 'path_evidence', 'business_questions'];
  const seen = new Set();
  for (const [index, item] of pack.entries()) {
    if (!hasNonEmptyString(item?.id, item?.intent, item?.goal)) {
      return `agent_brief graphDbQueryPack malformed row at index ${index}`;
    }
    seen.add(item.id);
    const callFailure = agentToolCallsFailure(`agent_brief graphDbQueryPack ${item.id}`, item.calls);
    if (callFailure) return callFailure;
  }
  const missing = required.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    return `agent_brief graphDbQueryPack missing packs: ${missing.join(', ')}`;
  }
  const graphFacets = pack.find((item) => item.id === 'graph_facets');
  if (!agentToolCallsIncludeOperation(graphFacets?.calls, 'facets')) {
    return 'agent_brief graphDbQueryPack graph_facets missing facets';
  }
  if (!agentToolCallsIncludeOperation(graphFacets?.calls, 'schema')) {
    return 'agent_brief graphDbQueryPack graph_facets missing schema';
  }
  const nodeScan = pack.find((item) => item.id === 'node_scan');
  if (!agentToolCallsIncludeQueryPlanTarget(nodeScan?.calls, 'match_nodes')) {
    return 'agent_brief graphDbQueryPack node_scan missing match_nodes query_plan';
  }
  if (!agentToolCallsIncludeOperation(nodeScan?.calls, 'match_nodes')) {
    return 'agent_brief graphDbQueryPack node_scan missing match_nodes';
  }
  const edgeScan = pack.find((item) => item.id === 'edge_scan');
  if (!agentToolCallsIncludeQueryPlanTarget(edgeScan?.calls, 'match_edges')) {
    return 'agent_brief graphDbQueryPack edge_scan missing match_edges query_plan';
  }
  if (!agentToolCallsIncludeOperation(edgeScan?.calls, 'match_edges')) {
    return 'agent_brief graphDbQueryPack edge_scan missing match_edges';
  }
  const domainCoupling = pack.find((item) => item.id === 'domain_coupling');
  if (!agentToolCallsIncludeOperation(domainCoupling?.calls, 'domain_matrix')) {
    return 'agent_brief graphDbQueryPack domain_coupling missing domain_matrix';
  }
  if (!agentToolCallsIncludeQueryPlanTarget(domainCoupling?.calls, 'centrality')) {
    return 'agent_brief graphDbQueryPack domain_coupling missing centrality query_plan';
  }
  if (!agentToolCallsIncludeOperation(domainCoupling?.calls, 'centrality')) {
    return 'agent_brief graphDbQueryPack domain_coupling missing centrality';
  }
  const pathEvidence = pack.find((item) => item.id === 'path_evidence');
  if (!agentToolCallsIncludeQueryPlanTarget(pathEvidence?.calls, 'all_paths')) {
    return 'agent_brief graphDbQueryPack path_evidence missing all_paths query_plan';
  }
  if (!agentToolCallsIncludeOperation(pathEvidence?.calls, 'all_paths')) {
    return 'agent_brief graphDbQueryPack path_evidence missing all_paths';
  }
  if (!agentToolCallsIncludeOperation(pathEvidence?.calls, 'explain_relation')) {
    return 'agent_brief graphDbQueryPack path_evidence missing explain_relation';
  }
  const businessQuestions = pack.find((item) => item.id === 'business_questions');
  if (!agentToolCallsIncludeOperation(businessQuestions?.calls, 'facets')) {
    return 'agent_brief graphDbQueryPack business_questions missing facets';
  }
  if (!agentToolCallsIncludeQueryPlanTarget(businessQuestions?.calls, 'match_nodes')) {
    return 'agent_brief graphDbQueryPack business_questions missing match_nodes query_plan';
  }
  if (!agentToolCallsIncludeOperation(businessQuestions?.calls, 'match_nodes')) {
    return 'agent_brief graphDbQueryPack business_questions missing match_nodes';
  }
  if (!agentToolCallsIncludeOperation(businessQuestions?.calls, 'domain_matrix')) {
    return 'agent_brief graphDbQueryPack business_questions missing domain_matrix';
  }
  if (!agentToolCallsIncludeQueryPlanTarget(businessQuestions?.calls, 'match_edges')) {
    return 'agent_brief graphDbQueryPack business_questions missing match_edges query_plan';
  }
  if (!agentToolCallsIncludeOperation(businessQuestions?.calls, 'match_edges')) {
    return 'agent_brief graphDbQueryPack business_questions missing match_edges';
  }
  return null;
}

export function agentRelationDecisionGuideFailure(guide) {
  const required = ['skip_existing', 'review_inverse', 'safe_to_add', 'review_new_schema'];
  if (!Array.isArray(guide)) {
    return 'agent_brief response missing relationDecisionGuide';
  }
  const seen = new Set();
  for (const [index, row] of guide.entries()) {
    if (!hasNonEmptyString(row?.decision, row?.severity, row?.meaning)) {
      return `agent_brief relationDecisionGuide malformed row at index ${index}`;
    }
    if (!required.includes(row.decision)) {
      return `agent_brief relationDecisionGuide unsupported decision at index ${index}: ${row.decision}`;
    }
    if (!['info', 'warn'].includes(row.severity)) {
      return `agent_brief relationDecisionGuide unsupported severity at index ${index}: ${row.severity}`;
    }
    seen.add(row.decision);
  }
  const missing = required.filter((decision) => !seen.has(decision));
  if (missing.length > 0) {
    return `agent_brief relationDecisionGuide missing decisions: ${missing.join(', ')}`;
  }
  return null;
}

export function agentToolCallsIncludeOperation(calls, operation) {
  return Array.isArray(calls) && calls.some((call) => call?.tool === 'query_ontology' && call?.arguments?.operation === operation);
}

function agentToolCallsIncludeQueryPlanTarget(calls, targetOperation) {
  return Array.isArray(calls) && calls.some((call) =>
    call?.tool === 'query_ontology' &&
    call?.arguments?.operation === 'query_plan' &&
    call?.arguments?.targetOperation === targetOperation
  );
}

export function agentToolCallsFailure(label, calls) {
  if (!Array.isArray(calls) || calls.length === 0) {
    return `${label} missing tool calls`;
  }
  for (const [index, call] of calls.entries()) {
    if (call?.tool !== 'query_ontology') {
      return `${label} tool mismatch at index ${index}`;
    }
    const operation = call?.arguments?.operation;
    if (typeof operation !== 'string' || operation.trim() === '') {
      return `${label} missing query_ontology operation at index ${index}`;
    }
    if (!QUERY_ONTOLOGY_OPERATIONS.includes(operation)) {
      return `${label} unsupported query_ontology operation at index ${index}: ${operation}`;
    }
  }
  return null;
}

export function agentGuardrailCallsFailure(label, calls) {
  if (!Array.isArray(calls) || calls.length === 0) {
    return `${label} missing tool calls`;
  }
  for (const [index, call] of calls.entries()) {
    if (call?.tool === 'query_ontology') {
      const operation = call?.arguments?.operation;
      if (typeof operation !== 'string' || operation.trim() === '') {
        return `${label} missing query_ontology operation at index ${index}`;
      }
      if (!QUERY_ONTOLOGY_OPERATIONS.includes(operation)) {
        return `${label} unsupported query_ontology operation at index ${index}: ${operation}`;
      }
      continue;
    }
    if (call?.tool === 'find_backlinks') {
      if (typeof call?.arguments?.slug !== 'string' || call.arguments.slug.trim() === '') {
        return `${label} missing find_backlinks slug at index ${index}`;
      }
      continue;
    }
    if (call?.tool === 'validate_vault') {
      if (!call.arguments || typeof call.arguments !== 'object' || Array.isArray(call.arguments) || Object.keys(call.arguments).length > 0) {
        return `${label} validate_vault must have empty arguments at index ${index}`;
      }
      continue;
    }
    return `${label} unsupported tool at index ${index}: ${call?.tool}`;
  }
  return null;
}
