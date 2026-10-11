import {
  overviewFailure,
  overviewQueryPlanFailure,
  projectMapQueryPlanFailure,
} from '../checks/query-plans.mjs';
import { structuredContentFailure } from '../checks/structured-content.mjs';
import { log } from '../output.mjs';

export function verifyQueryPlans(responses) {
  const overviewRes = responses.find((r) => r.id === 9);
  const overviewPlanRes = responses.find((r) => r.id === 10);
  const projectMapPlanRes = responses.find((r) => r.id === 12);
  let overviewPayload = null;
  if (!overviewRes || !overviewRes.result) {
    log('fail', 'no query_ontology overview response');
    return false;
  }
  try {
    const text = overviewRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = overviewFailure(parsed);
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(overviewRes, parsed, 'overview');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    overviewPayload = parsed;
    log('ok', `overview: graph ${parsed.graph.graphHash.slice(0, 12)} (${parsed.graph.nodes} nodes, ${parsed.graph.edges} edges, hubs ${(parsed.hubs || []).length})`);
  } catch (err) {
    log('fail', `failed to parse overview response: ${err.message}`);
    return false;
  }

  if (!overviewPlanRes || !overviewPlanRes.result) {
    log('fail', 'no query_ontology overview query_plan response');
    return false;
  }
  try {
    const text = overviewPlanRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = overviewQueryPlanFailure(parsed);
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(overviewPlanRes, parsed, 'overview query_plan');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    log('ok', `overview query_plan: ${parsed.estimate.strategy} (${parsed.estimate.costClass}, nodes ${parsed.estimate.nodeScans}, edges ${parsed.estimate.edgeScans})`);
  } catch (err) {
    log('fail', `failed to parse overview query_plan response: ${err.message}`);
    return false;
  }

  if (!projectMapPlanRes || !projectMapPlanRes.result) {
    log('fail', 'no query_ontology project_map query_plan response');
    return false;
  }
  try {
    const text = projectMapPlanRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = projectMapQueryPlanFailure(parsed);
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(projectMapPlanRes, parsed, 'project_map query_plan');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    log('ok', `project_map query_plan: ${parsed.estimate.strategy} (${parsed.estimate.costClass}, nodes ${parsed.estimate.nodeScans}, edges ${parsed.estimate.edgeScans})`);
  } catch (err) {
    log('fail', `failed to parse project_map query_plan response: ${err.message}`);
    return false;
  }
  return { overviewPayload };
}
