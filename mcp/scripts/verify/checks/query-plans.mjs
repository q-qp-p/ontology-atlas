import { countMapFailure, numericFieldsFailure } from '../value-checks.mjs';

export function overviewFailure(parsed) {
  if (parsed?.operation !== 'overview') {
    return `overview returned unexpected operation: ${parsed?.operation}`;
  }
  const graph = parsed.graph;
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    return 'overview response missing graph summary';
  }
  const graphFailure = numericFieldsFailure('overview.graph', graph, [
    'nodes',
    'edges',
    'resolvedEdges',
    'externalEdges',
    'unresolvedEdges',
    'aliases',
    'ambiguousAliases',
    'issues',
  ]);
  if (graphFailure) return graphFailure;
  if (typeof graph.graphHash !== 'string' || graph.graphHash.length === 0) {
    return 'overview response missing graphHash';
  }
  if (!Number.isFinite(graph.maxMtime) || graph.maxMtime < 0) {
    return 'overview response missing maxMtime';
  }
  const edgeTotal = graph.resolvedEdges + graph.externalEdges + graph.unresolvedEdges;
  if (edgeTotal !== graph.edges) {
    return `overview response edge count mismatch: edges ${graph.edges}, resolved+external+unresolved ${edgeTotal}`;
  }
  const byKindFailure = countMapFailure('overview', 'byKind', parsed.byKind);
  if (byKindFailure) return byKindFailure;
  const byKindTotal = Object.values(parsed.byKind).reduce((sum, count) => sum + count, 0);
  if (byKindTotal !== graph.nodes) {
    return `overview response byKind mismatch: nodes ${graph.nodes}, byKind ${byKindTotal}`;
  }
  if (!Array.isArray(parsed.hubs)) {
    return 'overview response missing hubs array';
  }
  return null;
}

function aggregateQueryPlanFailure(parsed, targetOperation, label = `${targetOperation} query_plan`) {
  if (parsed?.operation !== 'query_plan') {
    return `${label} returned unexpected operation: ${parsed?.operation}`;
  }
  if (parsed.targetOperation !== targetOperation) {
    return `${label} returned unexpected targetOperation: ${parsed.targetOperation}`;
  }
  if (parsed.sideEffect !== false) {
    return `${label} must be side-effect-free`;
  }
  if (!parsed.normalized || parsed.normalized.targetOperation !== targetOperation) {
    return `${label} missing normalized targetOperation`;
  }
  if (!parsed.estimate || parsed.estimate.strategy !== 'aggregate_scan') {
    return `${label} missing aggregate_scan estimate`;
  }
  if (!Number.isInteger(parsed.estimate.nodeScans) || parsed.estimate.nodeScans < 0) {
    return `${label} missing nodeScans`;
  }
  if (!Number.isInteger(parsed.estimate.edgeScans) || parsed.estimate.edgeScans < 0) {
    return `${label} missing edgeScans`;
  }
  if (!['low', 'medium', 'high'].includes(parsed.estimate.costClass)) {
    return `${label} missing costClass`;
  }
  if (!Array.isArray(parsed.indexesUsed) || !parsed.indexesUsed.includes('compiled_artifact')) {
    return `${label} missing compiled_artifact index hint`;
  }
  if (!Array.isArray(parsed.warnings)) {
    return `${label} missing warnings array`;
  }
  const executionFailure = queryPlanExecutionFailure(parsed.execution, targetOperation, label);
  if (executionFailure) return executionFailure;
  return null;
}

function queryPlanExecutionFailure(execution, targetOperation, label = `${targetOperation} query_plan`) {
  if (!execution || typeof execution !== 'object') {
    return `${label} missing execution advice`;
  }
  if (typeof execution.shouldRun !== 'boolean') {
    return `${label} execution missing shouldRun`;
  }
  if (!['run', 'narrow', 'review'].includes(execution.nextStep)) {
    return `${label} execution missing nextStep`;
  }
  if (typeof execution.recommendation !== 'string' || execution.recommendation.trim() === '') {
    return `${label} execution missing recommendation`;
  }
  if (!execution.suggestedQuery || execution.suggestedQuery.operation !== targetOperation) {
    return `${label} execution missing suggestedQuery`;
  }
  if (execution.nextStep === 'narrow' && !execution.saferQuery) {
    return `${label} execution missing saferQuery for narrow advice`;
  }
  return null;
}

export function overviewQueryPlanFailure(parsed) {
  return aggregateQueryPlanFailure(parsed, 'overview', 'overview query_plan');
}

export function projectMapQueryPlanFailure(parsed) {
  return aggregateQueryPlanFailure(parsed, 'project_map', 'project_map query_plan');
}
