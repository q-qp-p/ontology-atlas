import {
  allPathsQueryFailure,
  neighborsFailure,
  pathQueryFailure,
  projectScopeFailure,
} from '../checks/graph-queries.mjs';
import { structuredContentFailure } from '../checks/structured-content.mjs';
import { formatCount, formatHopCount, log } from '../output.mjs';

export function verifyGraphQueries(responses, { graphSmokeArgs }) {
  const neighborsRes = responses.find((r) => r.id === 13);
  const pathRes = responses.find((r) => r.id === 14);
  const allPathsRes = responses.find((r) => r.id === 67);
  const projectScopeRes = responses.find((r) => r.id === 15);
  let allPathsVerified = false;
  if (graphSmokeArgs?.hasNode) {
    if (!neighborsRes || !neighborsRes.result) {
      log('fail', 'no query_ontology neighbors response');
      return false;
    }
    try {
      const text = neighborsRes.result.content?.[0]?.text || '';
      const parsed = JSON.parse(text);
      const expectedSlug = graphSmokeArgs.slug;
      const failure = neighborsFailure(parsed, expectedSlug);
      if (failure) {
        log('fail', failure);
        return false;
      }
      const structuredFailure = structuredContentFailure(neighborsRes, parsed, 'neighbors');
      if (structuredFailure) {
        log('fail', structuredFailure);
        return false;
      }
      log('ok', `neighbors: ${parsed.center} (${parsed.edges.length}/${parsed.total} edges, limited ${parsed.limited})`);
    } catch (err) {
      log('fail', `failed to parse neighbors response: ${err.message}`);
      return false;
    }

    if (!pathRes || !pathRes.result) {
      log('fail', 'no query_ontology path response');
      return false;
    }
    try {
      const text = pathRes.result.content?.[0]?.text || '';
      const parsed = JSON.parse(text);
      const expectedSlug = graphSmokeArgs.slug;
      const failure = pathQueryFailure(parsed, expectedSlug, graphSmokeArgs.pathTarget || expectedSlug);
      if (failure) {
        log('fail', failure);
        return false;
      }
      const structuredFailure = structuredContentFailure(pathRes, parsed, 'path');
      if (structuredFailure) {
        log('fail', structuredFailure);
        return false;
      }
      log('ok', `path: ${parsed.from} → ${parsed.to} (${formatHopCount(parsed.hopCount)}, ${formatCount(parsed.edges.length, 'edge')})`);
    } catch (err) {
      log('fail', `failed to parse path response: ${err.message}`);
      return false;
    }

    if (!allPathsRes || !allPathsRes.result) {
      log('fail', 'no query_ontology all_paths response');
      return false;
    }
    try {
      const text = allPathsRes.result.content?.[0]?.text || '';
      const parsed = JSON.parse(text);
      const expectedSlug = graphSmokeArgs.slug;
      const expectedTarget = graphSmokeArgs.pathTarget || expectedSlug;
      const failure = allPathsQueryFailure(parsed, expectedSlug, expectedTarget);
      if (failure) {
        log('fail', failure);
        return false;
      }
      const structuredFailure = structuredContentFailure(allPathsRes, parsed, 'all_paths');
      if (structuredFailure) {
        log('fail', structuredFailure);
        return false;
      }
      allPathsVerified = true;
      log(
        'ok',
        `all_paths: ${parsed.from} → ${parsed.to} (${parsed.paths.length}/${parsed.totalPaths} paths, budget ${parsed.searchBudget}, expanded ${parsed.expandedStates}, exhaustive ${parsed.exhaustive}, evidence ${parsed.evidence.status})`,
      );
    } catch (err) {
      log('fail', `failed to parse all_paths response: ${err.message}`);
      return false;
    }
  } else {
    log('info', 'neighbors/path/all_paths: skipped (vault has no nodes)');
  }

  if (graphSmokeArgs?.hasProject) {
    if (!projectScopeRes || !projectScopeRes.result) {
      log('fail', 'no query_ontology project_scope response');
      return false;
    }
    try {
      const text = projectScopeRes.result.content?.[0]?.text || '';
      const parsed = JSON.parse(text);
      const expectedProject = graphSmokeArgs.project;
      const failure = projectScopeFailure(parsed, expectedProject);
      if (failure) {
        log('fail', failure);
        return false;
      }
      const structuredFailure = structuredContentFailure(projectScopeRes, parsed, 'project_scope');
      if (structuredFailure) {
        log('fail', structuredFailure);
        return false;
      }
      log('ok', `project_scope: ${parsed.project} (${parsed.summary.nodes} nodes, internalEdges ${parsed.summary.internalEdges})`);
    } catch (err) {
      log('fail', `failed to parse project_scope response: ${err.message}`);
      return false;
    }
  } else {
    log('info', 'project_scope: skipped (no project node in vault)');
  }
  return { allPathsVerified };
}
