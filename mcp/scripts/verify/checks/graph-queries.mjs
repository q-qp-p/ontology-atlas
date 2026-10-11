import { countMapFailure, numericFieldsFailure } from '../value-checks.mjs';
import { graphEdgeFailure, pathNodeFailure } from './graph-navigation.mjs';

export function neighborsFailure(parsed, expectedSlug) {
  if (parsed?.operation !== 'neighbors') {
    return `neighbors returned unexpected operation: ${parsed?.operation}`;
  }
  if (parsed.center !== expectedSlug) {
    return `neighbors center mismatch: expected ${expectedSlug}, got ${parsed.center}`;
  }
  if (!parsed.node || parsed.node.slug !== parsed.center) {
    return 'neighbors response missing center node';
  }
  if (!Number.isInteger(parsed.total) || parsed.total < 0) {
    return 'neighbors response missing total';
  }
  if (typeof parsed.limited !== 'boolean') {
    return 'neighbors response missing limited flag';
  }
  if (!Array.isArray(parsed.edges)) {
    return 'neighbors response missing edges array';
  }
  if (parsed.edges.length > parsed.total) {
    return `neighbors response edge count exceeds total: edges ${parsed.edges.length}, total ${parsed.total}`;
  }
  if (!parsed.limited && parsed.edges.length !== parsed.total) {
    return `neighbors response edge count mismatch: edges ${parsed.edges.length}, total ${parsed.total}`;
  }
  if (!Array.isArray(parsed.nodes)) {
    return 'neighbors response missing nodes array';
  }
  for (const [index, edge] of parsed.edges.entries()) {
    const edgeFailure = graphEdgeFailure('neighbors edge', edge, index);
    if (edgeFailure) return edgeFailure;
    if (!['incoming', 'outgoing'].includes(edge.direction)) {
      return `neighbors edge missing direction at index ${index}`;
    }
  }
  return null;
}

export function pathQueryFailure(parsed, expectedFrom, expectedTo = expectedFrom) {
  if (parsed?.operation !== 'path') {
    return `path returned unexpected operation: ${parsed?.operation}`;
  }
  if (parsed.from !== expectedFrom || parsed.to !== expectedTo) {
    return `path endpoint mismatch: expected ${expectedFrom}->${expectedTo}, got ${parsed.from}->${parsed.to}`;
  }
  if (parsed.found !== true) {
    return 'path response expected found:true';
  }
  if (!Number.isInteger(parsed.hopCount) || parsed.hopCount < 0) {
    return 'path response missing hopCount';
  }
  if (!Array.isArray(parsed.hops) || parsed.hops.length !== parsed.hopCount + 1) {
    return 'path response hop count mismatch';
  }
  if (parsed.hops[0] !== expectedFrom || parsed.hops.at(-1) !== expectedTo) {
    return 'path response endpoint hops mismatch';
  }
  if (!Array.isArray(parsed.edges) || parsed.edges.length !== parsed.hopCount) {
    return 'path response edge count mismatch';
  }
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length !== parsed.hops.length) {
    return 'path response node count mismatch';
  }
  for (const [index, row] of parsed.nodes.entries()) {
    const failure = pathNodeFailure(row, index);
    if (failure) return failure;
    if (row.slug !== parsed.hops[index]) {
      return `path response node/hop mismatch at index ${index}`;
    }
  }
  for (const [index, edge] of parsed.edges.entries()) {
    const edgeFailure = graphEdgeFailure('path edge', edge, index);
    if (edgeFailure) return edgeFailure;
    const fromHop = parsed.hops[index];
    const toHop = parsed.hops[index + 1];
    if (typeof edge.traversedFrom === 'string' || typeof edge.traversedTo === 'string') {
      if (edge.traversedFrom !== fromHop || edge.traversedTo !== toHop) {
        return `path response traversal mismatch at edge ${index}`;
      }
    } else if (!((edge.from === fromHop && edge.to === toHop) || (edge.from === toHop && edge.to === fromHop))) {
      return `path response edge/hop mismatch at edge ${index}`;
    }
  }
  return null;
}

export function allPathsQueryFailure(parsed, expectedFrom, expectedTo = expectedFrom) {
  if (parsed?.operation !== 'all_paths') {
    return `all_paths returned unexpected operation: ${parsed?.operation}`;
  }
  if (parsed.from !== expectedFrom || parsed.to !== expectedTo) {
    return `all_paths endpoint mismatch: expected ${expectedFrom}->${expectedTo}, got ${parsed.from}->${parsed.to}`;
  }
  if (typeof parsed.found !== 'boolean') {
    return 'all_paths response missing found flag';
  }
  if (!Number.isInteger(parsed.searchBudget) || parsed.searchBudget < 1) {
    return 'all_paths response missing searchBudget';
  }
  if (!Number.isInteger(parsed.limit) || parsed.limit < 1) {
    return 'all_paths response missing limit';
  }
  if (!Number.isInteger(parsed.expandedStates) || parsed.expandedStates < 0) {
    return 'all_paths response missing expandedStates';
  }
  if (parsed.expandedStates > parsed.searchBudget) {
    return `all_paths response exceeded searchBudget: expanded ${parsed.expandedStates}, budget ${parsed.searchBudget}`;
  }
  if (typeof parsed.exhaustive !== 'boolean') {
    return 'all_paths response missing exhaustive flag';
  }
  if (typeof parsed.truncatedByBudget !== 'boolean') {
    return 'all_paths response missing truncatedByBudget flag';
  }
  if (parsed.exhaustive === parsed.truncatedByBudget) {
    return 'all_paths response exhaustive/truncatedByBudget mismatch';
  }
  if (typeof parsed.totalPathsExact !== 'boolean' || parsed.totalPathsExact !== parsed.exhaustive) {
    return 'all_paths response totalPathsExact/exhaustive mismatch';
  }
  if (!Number.isInteger(parsed.totalPaths) || parsed.totalPaths < 0) {
    return 'all_paths response missing totalPaths';
  }
  if (typeof parsed.limited !== 'boolean') {
    return 'all_paths response missing limited flag';
  }
  if (!Array.isArray(parsed.paths)) {
    return 'all_paths response missing paths array';
  }
  if (parsed.paths.length > parsed.limit) {
    return `all_paths response path count exceeds limit: paths ${parsed.paths.length}, limit ${parsed.limit}`;
  }
  if (parsed.paths.length > parsed.totalPaths) {
    return `all_paths response path count exceeds total: paths ${parsed.paths.length}, total ${parsed.totalPaths}`;
  }
  if (!parsed.limited && parsed.paths.length !== parsed.totalPaths) {
    return `all_paths response total mismatch: paths ${parsed.paths.length}, total ${parsed.totalPaths}`;
  }
  const evidenceFailure = allPathsEvidenceFailure(parsed.evidence, parsed);
  if (evidenceFailure) return evidenceFailure;
  for (const [index, row] of parsed.paths.entries()) {
    if (!Number.isInteger(row?.hopCount) || row.hopCount < 0) {
      return `all_paths path missing hopCount at index ${index}`;
    }
    if (!Array.isArray(row.hops) || row.hops.length !== row.hopCount + 1) {
      return `all_paths path hop count mismatch at index ${index}`;
    }
    if (row.hops[0] !== expectedFrom || row.hops.at(-1) !== expectedTo) {
      return `all_paths path endpoint mismatch at index ${index}`;
    }
    if (!Array.isArray(row.edges) || row.edges.length !== row.hopCount) {
      return `all_paths path edge count mismatch at index ${index}`;
    }
    if (!Array.isArray(row.nodes) || row.nodes.length !== row.hops.length) {
      return `all_paths path node count mismatch at index ${index}`;
    }
  }
  return null;
}

function allPathsEvidenceFailure(evidence, parsed) {
  if (!evidence || typeof evidence !== 'object') {
    return 'all_paths response missing evidence guidance';
  }
  const pathsComplete = parsed.exhaustive && !parsed.limited;
  const expectedReason = parsed.truncatedByBudget ? 'search_budget' : parsed.limited ? 'limit' : 'complete';
  if (evidence.status !== (pathsComplete ? 'complete' : 'partial')) {
    return 'all_paths evidence status mismatch';
  }
  if (evidence.reason !== expectedReason) {
    return 'all_paths evidence reason mismatch';
  }
  if (evidence.totalPathsExact !== parsed.totalPathsExact) {
    return 'all_paths evidence totalPathsExact mismatch';
  }
  if (evidence.pathsComplete !== pathsComplete) {
    return 'all_paths evidence pathsComplete mismatch';
  }
  if (evidence.nextStep !== (pathsComplete ? 'use' : 'narrow')) {
    return 'all_paths evidence nextStep mismatch';
  }
  if (typeof evidence.recommendation !== 'string' || evidence.recommendation.length === 0) {
    return 'all_paths evidence missing recommendation';
  }
  if (!evidence.suggestedQuery || typeof evidence.suggestedQuery !== 'object') {
    return 'all_paths evidence missing suggestedQuery';
  }
  if (pathsComplete && evidence.suggestedQuery.operation !== 'all_paths') {
    return 'all_paths evidence suggestedQuery should reuse all_paths when complete';
  }
  if (!pathsComplete && evidence.suggestedQuery.operation !== 'query_plan') {
    return 'all_paths evidence suggestedQuery should query_plan when partial';
  }
  if (!pathsComplete && evidence.suggestedQuery.targetOperation !== 'all_paths') {
    return 'all_paths evidence suggestedQuery missing all_paths target';
  }
  if (!pathsComplete && (!evidence.saferQuery || evidence.saferQuery.operation !== 'all_paths')) {
    return 'all_paths evidence missing saferQuery';
  }
  return null;
}

export function projectScopeFailure(parsed, expectedProject) {
  if (parsed?.operation !== 'project_scope') {
    return `project_scope returned unexpected operation: ${parsed?.operation}`;
  }
  if (parsed.project !== expectedProject) {
    return `project_scope project mismatch: expected ${expectedProject}, got ${parsed.project}`;
  }
  if (!parsed.node || parsed.node.slug !== parsed.project) {
    return 'project_scope response missing project node';
  }
  const summaryFailure = numericFieldsFailure('project_scope.summary', parsed.summary, [
    'nodes',
    'internalEdges',
    'boundaryEdges',
    'externalEdges',
    'unresolvedEdges',
  ]);
  if (summaryFailure) return summaryFailure;
  const byKindFailure = countMapFailure('project_scope', 'byKind', parsed.byKind);
  if (byKindFailure) return byKindFailure;
  if (!parsed.nodes || typeof parsed.nodes !== 'object' || Array.isArray(parsed.nodes)) {
    return 'project_scope response missing nodes bucket';
  }
  if (!Number.isInteger(parsed.nodes.total) || parsed.nodes.total < 0) {
    return 'project_scope nodes missing total';
  }
  if (parsed.nodes.total !== parsed.summary.nodes) {
    return `project_scope node total mismatch: summary ${parsed.summary.nodes}, bucket ${parsed.nodes.total}`;
  }
  if (typeof parsed.nodes.limited !== 'boolean') {
    return 'project_scope nodes missing limited flag';
  }
  if (!Array.isArray(parsed.nodes.rows)) {
    return 'project_scope nodes missing rows';
  }
  if (parsed.nodes.rows.length > parsed.nodes.total) {
    return `project_scope nodes exceed total: rows ${parsed.nodes.rows.length}, total ${parsed.nodes.total}`;
  }
  if (!parsed.nodes.limited && parsed.nodes.rows.length !== parsed.nodes.total) {
    return `project_scope node count mismatch: rows ${parsed.nodes.rows.length}, total ${parsed.nodes.total}`;
  }
  const byKindTotal = Object.values(parsed.byKind).reduce((sum, count) => sum + count, 0);
  if (byKindTotal !== parsed.summary.nodes) {
    return `project_scope byKind mismatch: nodes ${parsed.summary.nodes}, byKind ${byKindTotal}`;
  }
  if (!parsed.edges || typeof parsed.edges !== 'object' || Array.isArray(parsed.edges)) {
    return 'project_scope response missing edges';
  }
  const expectedTotals = {
    internal: parsed.summary.internalEdges,
    boundary: parsed.summary.boundaryEdges,
    external: parsed.summary.externalEdges,
    unresolved: parsed.summary.unresolvedEdges,
  };
  for (const [key, expectedTotal] of Object.entries(expectedTotals)) {
    const bucket = parsed.edges[key];
    const bucketFailure = scopeEdgeBucketFailure(`project_scope ${key}`, bucket);
    if (bucketFailure) return bucketFailure;
    if (bucket.total !== expectedTotal) {
      return `project_scope ${key} edge total mismatch: summary ${expectedTotal}, bucket ${bucket.total}`;
    }
  }
  return null;
}

function scopeEdgeBucketFailure(label, bucket) {
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) {
    return `${label} missing edge bucket`;
  }
  if (!Number.isInteger(bucket.total) || bucket.total < 0) {
    return `${label} missing total`;
  }
  if (typeof bucket.limited !== 'boolean') {
    return `${label} missing limited flag`;
  }
  if (!Array.isArray(bucket.edges)) {
    return `${label} missing edges array`;
  }
  if (bucket.edges.length > bucket.total) {
    return `${label} edges exceed total: edges ${bucket.edges.length}, total ${bucket.total}`;
  }
  if (!bucket.limited && bucket.edges.length !== bucket.total) {
    return `${label} edge count mismatch: edges ${bucket.edges.length}, total ${bucket.total}`;
  }
  for (const [index, edge] of bucket.edges.entries()) {
    const edgeFailure = graphEdgeFailure(label, edge, index);
    if (edgeFailure) return edgeFailure;
  }
  return null;
}
