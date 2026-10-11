import { findNeighborsFailure, findPathFailure } from '../checks/graph-navigation.mjs';
import { structuredContentFailure } from '../checks/structured-content.mjs';
import { formatCount, formatHopCount, log } from '../output.mjs';

export function verifyGraphNavigation(responses, { graphSmokeArgs }) {
  const findNeighborsRes = responses.find((r) => r.id === 35);
  const findPathRes = responses.find((r) => r.id === 36);
  let directGraphReadsVerified = false;
  if (graphSmokeArgs?.hasNode) {
    if (!findNeighborsRes || !findNeighborsRes.result) {
      log('fail', 'no find_neighbors response');
      return false;
    }
    try {
      const text = findNeighborsRes.result.content?.[0]?.text || '';
      const parsed = JSON.parse(text);
      const failure = findNeighborsFailure(parsed, graphSmokeArgs.slug);
      if (failure) {
        log('fail', failure);
        return false;
      }
      const structuredFailure = structuredContentFailure(findNeighborsRes, parsed, 'find_neighbors');
      if (structuredFailure) {
        log('fail', structuredFailure);
        return false;
      }
      log('ok', `find_neighbors: ${parsed.center} (${parsed.edges.length}/${parsed.totalEdges} edges, limited ${parsed.limited})`);
    } catch (err) {
      log('fail', `failed to parse find_neighbors response: ${err.message}`);
      return false;
    }

    if (!findPathRes || !findPathRes.result) {
      log('fail', 'no find_path response');
      return false;
    }
    try {
      const text = findPathRes.result.content?.[0]?.text || '';
      const parsed = JSON.parse(text);
      const failure = findPathFailure(parsed, graphSmokeArgs.slug, graphSmokeArgs.pathTarget || graphSmokeArgs.slug);
      if (failure) {
        log('fail', failure);
        return false;
      }
      const structuredFailure = structuredContentFailure(findPathRes, parsed, 'find_path');
      if (structuredFailure) {
        log('fail', structuredFailure);
        return false;
      }
      directGraphReadsVerified = true;
      log('ok', `find_path: ${parsed.from} → ${parsed.to} (${formatHopCount(parsed.hopCount)}, ${formatCount(parsed.edges.length, 'edge')})`);
    } catch (err) {
      log('fail', `failed to parse find_path response: ${err.message}`);
      return false;
    }
  }
  return { directGraphReadsVerified };
}
