import {
  advisoryHealthChecksSummary,
  advisoryNextActionsSummary,
  diagnosisBlockingFailure,
  healthChecksSummary,
  healthSummary,
  tunedHealthScopeOutputSummary,
  tunedWorkspaceBriefScopeOutputSummary,
  workspaceBriefSummary,
} from '../checks/diagnosis.mjs';
import { structuredContentFailure } from '../checks/structured-content.mjs';
import { log } from '../output.mjs';

export function verifyDiagnosis(responses) {
  const healthRes = responses.find((r) => r.id === 7);
  const tunedHealthRes = responses.find((r) => r.id === 20);
  const tunedBriefRes = responses.find((r) => r.id === 21);
  if (!tunedBriefRes || !tunedBriefRes.result) {
    log('fail', 'no query_ontology tuned workspace_brief response');
    return false;
  }
  try {
    const text = tunedBriefRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = diagnosisBlockingFailure('workspace_brief_tuned', parsed, 'workspace_brief');
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(tunedBriefRes, parsed, 'workspace_brief_tuned');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    log(
      'ok',
      `workspace_brief_tuned: ${parsed.status} (${workspaceBriefSummary(parsed)}; ${tunedWorkspaceBriefScopeOutputSummary()})`,
    );
    const advisory = advisoryNextActionsSummary(parsed.nextActions);
    if (advisory) log('info', `workspace_brief_tuned non-blocking advisory nextActions: ${advisory}`);
  } catch (err) {
    log('fail', `failed to parse tuned workspace_brief response: ${err.message}`);
    return false;
  }

  if (!healthRes || !healthRes.result) {
    log('fail', 'no query_ontology health response');
    return false;
  }
  try {
    const text = healthRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = diagnosisBlockingFailure('health', parsed, 'health');
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(healthRes, parsed, 'health');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    const checksSummary = healthChecksSummary(parsed.checks);
    log(
      'ok',
      `health: ${parsed.status} (${healthSummary(parsed)}${
        checksSummary ? `: ${checksSummary}` : ''
      })`,
    );
    const advisory = advisoryHealthChecksSummary(parsed.checks);
    if (advisory) log('info', `health non-blocking advisory checks: ${advisory}`);
  } catch (err) {
    log('fail', `failed to parse health response: ${err.message}`);
    return false;
  }

  if (!tunedHealthRes || !tunedHealthRes.result) {
    log('fail', 'no query_ontology tuned health response');
    return false;
  }
  try {
    const text = tunedHealthRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = diagnosisBlockingFailure('health_tuned', parsed, 'health');
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(tunedHealthRes, parsed, 'health_tuned');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    const checksSummary = healthChecksSummary(parsed.checks);
    log(
      'ok',
      `health_tuned: ${parsed.status} (${healthSummary(parsed)}${
        checksSummary ? `: ${checksSummary}` : ''
      }; ${tunedHealthScopeOutputSummary()})`,
    );
    const advisory = advisoryHealthChecksSummary(parsed.checks);
    if (advisory) log('info', `health_tuned non-blocking advisory checks: ${advisory}`);
  } catch (err) {
    log('fail', `failed to parse tuned health response: ${err.message}`);
    return false;
  }
  return true;
}
