import {
  compileFullArtifactFailure,
  compileIndexesFailure,
  compileIndexesSummary,
  compileSummaryFailure,
} from '../checks/compile.mjs';
import { structuredContentFailure } from '../checks/structured-content.mjs';
import { log } from '../output.mjs';

export function verifyCompile(responses) {
  const compileRes = responses.find((r) => r.id === 8);
  const compilePageRes = responses.find((r) => r.id === 41);
  const compileIndexesRes = responses.find((r) => r.id === 42);
  let compilePayload = null;
  if (!compileRes || !compileRes.result) {
    log('fail', 'no compile_ontology response');
    return false;
  }
  try {
    const text = compileRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = compileSummaryFailure(parsed);
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(compileRes, parsed, 'compile_ontology');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    compilePayload = parsed;
    log('ok', `compile_ontology: graph ${parsed.graphHash.slice(0, 12)} (${parsed.nodeCount} nodes, ${parsed.edgeCount} edges, issues ${parsed.issueCount})`);
  } catch (err) {
    log('fail', `failed to parse compile_ontology response: ${err.message}`);
    return false;
  }

  if (!compilePageRes || !compilePageRes.result) {
    log('fail', 'no compile_ontology paginated full-artifact response');
    return false;
  }
  try {
    const text = compilePageRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = compileFullArtifactFailure(parsed);
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(compilePageRes, parsed, 'compile_ontology_page');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    log('ok', `compile_ontology page: ${parsed.nodes.length}/${parsed.nodeCount} nodes, ${parsed.edges.length}/${parsed.edgeCount} edges`);
  } catch (err) {
    log('fail', `failed to parse compile_ontology paginated response: ${err.message}`);
    return false;
  }

  if (!compileIndexesRes || !compileIndexesRes.result) {
    log('fail', 'no compile_ontology indexes response');
    return false;
  }
  try {
    const text = compileIndexesRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = compileIndexesFailure(parsed);
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(compileIndexesRes, parsed, 'compile_ontology_indexes');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    log(
      'ok',
      `compile_ontology indexes: ${compileIndexesSummary(parsed)}`,
    );
  } catch (err) {
    log('fail', `failed to parse compile_ontology indexes response: ${err.message}`);
    return false;
  }
  return { compilePayload };
}
