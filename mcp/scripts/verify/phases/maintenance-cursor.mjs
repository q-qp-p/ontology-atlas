import {
  maintenanceBucketOutputSummary,
  maintenanceMissingCursorFailure,
  maintenanceNextActionOutputSummary,
  maintenanceReadyCursorFailure,
  maintenanceResumeCursorFailure,
} from '../checks/maintenance-cursor.mjs';
import { structuredContentFailure } from '../checks/structured-content.mjs';
import { formatCount, log } from '../output.mjs';

export function verifyMaintenanceCursor(responses) {
  const maintenanceMissingCursorRes = responses.find((r) => r.id === 25);
  const maintenanceReadyCursorRes = responses.find((r) => r.id === 26);
  const maintenanceResumeCursorRes = responses.find((r) => r.id === 30);
  let maintenanceResumeVerified = false;
  if (!maintenanceMissingCursorRes || !maintenanceMissingCursorRes.result) {
    log('fail', 'no query_ontology maintenance missing-cursor response');
    return false;
  }
  try {
    const text = maintenanceMissingCursorRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = maintenanceMissingCursorFailure(parsed);
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(maintenanceMissingCursorRes, parsed, 'maintenance cursor');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    log('ok', `maintenance cursor: missing afterActionId reported (${parsed.cursor.reason}; ${maintenanceBucketOutputSummary(parsed)}; ${maintenanceNextActionOutputSummary(parsed)})`);
  } catch (err) {
    log('fail', `failed to parse maintenance missing-cursor response: ${err.message}`);
    return false;
  }

  if (!maintenanceReadyCursorRes || !maintenanceReadyCursorRes.result) {
    log('fail', 'no query_ontology maintenance ready-cursor response');
    return false;
  }
  let maintenanceReadyCursorPayload = null;
  try {
    const text = maintenanceReadyCursorRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = maintenanceReadyCursorFailure(parsed);
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(maintenanceReadyCursorRes, parsed, 'maintenance cursor');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    maintenanceReadyCursorPayload = parsed;
    log('ok', `maintenance cursor: ready page stable (${formatCount(parsed.summary.remainingActions, 'remaining action')}; ${maintenanceBucketOutputSummary(parsed)}; ${maintenanceNextActionOutputSummary(parsed)})`);
  } catch (err) {
    log('fail', `failed to parse maintenance ready-cursor response: ${err.message}`);
    return false;
  }

  const resumeAfterActionId = maintenanceReadyCursorPayload?.actions?.[0]?.id;
  let maintenanceResumeSkipped = false;
  if (typeof resumeAfterActionId === 'string' && resumeAfterActionId.length > 0) {
    if (!maintenanceResumeCursorRes || !maintenanceResumeCursorRes.result) {
      log('fail', 'no query_ontology maintenance resume-cursor response');
      return false;
    }
    try {
      const text = maintenanceResumeCursorRes.result.content?.[0]?.text || '';
      const parsed = JSON.parse(text);
      const failure = maintenanceResumeCursorFailure(maintenanceReadyCursorPayload, parsed, resumeAfterActionId);
      if (failure) {
        log('fail', failure);
        return false;
      }
      const structuredFailure = structuredContentFailure(maintenanceResumeCursorRes, parsed, 'maintenance cursor');
      if (structuredFailure) {
        log('fail', structuredFailure);
        return false;
      }
      maintenanceResumeVerified = true;
      log('ok', `maintenance cursor: resume afterActionId advanced (${resumeAfterActionId}; ${formatCount(parsed.summary.remainingActions, 'remaining action')}; ${maintenanceBucketOutputSummary(parsed)}; ${maintenanceNextActionOutputSummary(parsed)})`);
    } catch (err) {
      log('fail', `failed to parse maintenance resume-cursor response: ${err.message}`);
      return false;
    }
  } else {
    maintenanceResumeSkipped = true;
    log('info', 'maintenance cursor: resume skipped (ready page has no actions)');
  }
  return { maintenanceResumeVerified, maintenanceResumeSkipped };
}
