import { agentBriefFailure, agentBriefSummary } from '../checks/agent-brief.mjs';
import {
  advisoryNextActionsSummary,
  diagnosisBlockingFailure,
  workspaceBriefSummary,
} from '../checks/diagnosis.mjs';
import {
  meaningRepairFullBodyReadsFailure,
  meaningRepairReviewChainFailure,
} from '../checks/meaning-repair.mjs';
import { structuredContentFailure } from '../checks/structured-content.mjs';
import { log } from '../output.mjs';

export function verifyBriefs(responses, {
  meaningRepairReviewRequests,
  meaningRepairReadRequests,
}) {
  const briefRes = responses.find((r) => r.id === 6);
  const agentBriefRes = responses.find((r) => r.id === 66);
  if (!briefRes || !briefRes.result) {
    log('fail', 'no query_ontology workspace_brief response');
    return false;
  }
  try {
    const text = briefRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const failure = diagnosisBlockingFailure('workspace_brief', parsed, 'workspace_brief');
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(briefRes, parsed, 'workspace_brief');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    log(
      'ok',
      `workspace_brief: ${parsed.status} (${workspaceBriefSummary(parsed)})`,
    );
    const advisory = advisoryNextActionsSummary(parsed.nextActions);
    if (advisory) log('info', `workspace_brief non-blocking advisory nextActions: ${advisory}`);
  } catch (err) {
    log('fail', `failed to parse workspace_brief response: ${err.message}`);
    return false;
  }

  if (!agentBriefRes || !agentBriefRes.result) {
    log('fail', 'no query_ontology agent_brief response');
    return false;
  }
  let agentBriefPayload = null;
  try {
    const text = agentBriefRes.result.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    agentBriefPayload = parsed;
    const failure = agentBriefFailure(parsed);
    if (failure) {
      log('fail', failure);
      return false;
    }
    const structuredFailure = structuredContentFailure(agentBriefRes, parsed, 'agent_brief');
    if (structuredFailure) {
      log('fail', structuredFailure);
      return false;
    }
    log('ok', `agent_brief: ${parsed.status} (${agentBriefSummary(parsed)})`);
  } catch (err) {
    log('fail', `failed to parse agent_brief response: ${err.message}`);
    return false;
  }

  const meaningRepairReviewPages = [];
  for (const request of meaningRepairReviewRequests) {
    const response = responses.find((row) => row.id === request.id);
    if (!response?.result) {
      log('fail', `no meaning_repair_review response for request ${request.id}`);
      return false;
    }
    try {
      const parsed = JSON.parse(response.result.content?.[0]?.text || '');
      const structuredFailure = structuredContentFailure(
        response,
        parsed,
        `meaning_repair_review page ${meaningRepairReviewPages.length + 1}`,
      );
      if (structuredFailure) {
        log('fail', structuredFailure);
        return false;
      }
      meaningRepairReviewPages.push(parsed);
    } catch (err) {
      log('fail', `failed to parse meaning_repair_review response: ${err.message}`);
      return false;
    }
  }
  const meaningRepairReviewFailure = meaningRepairReviewChainFailure(
    agentBriefPayload,
    meaningRepairReviewPages,
    meaningRepairReviewRequests.map((request) => request.arguments),
  );
  if (meaningRepairReviewFailure) {
    log('fail', meaningRepairReviewFailure);
    return false;
  }
  const meaningRepairReadPayloads = [];
  for (const pageRequest of meaningRepairReviewRequests) {
    const readRequest = meaningRepairReadRequests.find(
      (request) => request.reviewRequestId === pageRequest.id,
    );
    const response = readRequest
      ? responses.find((row) => row.id === readRequest.id)
      : null;
    if (!response?.result) {
      log('fail', `no meaning repair full-body read response for review request ${pageRequest.id}`);
      return false;
    }
    try {
      meaningRepairReadPayloads.push(JSON.parse(response.result.content?.[0]?.text || ''));
    } catch (err) {
      log('fail', `failed to parse meaning repair full-body read response: ${err.message}`);
      return false;
    }
  }
  const meaningRepairReadsFailure = meaningRepairFullBodyReadsFailure(
    meaningRepairReviewPages,
    meaningRepairReadPayloads,
  );
  if (meaningRepairReadsFailure) {
    log('fail', meaningRepairReadsFailure);
    return false;
  }
  if (meaningRepairReviewPages.length > 0) {
    const totalTargets = meaningRepairReviewPages
      .reduce((total, page) => total + page.targets.length, 0);
    const pageSummary = meaningRepairReviewPages
      .map((page) => `${page.targets.length}@${new TextEncoder().encode(JSON.stringify(page)).byteLength}B`)
      .join(' + ');
    log(
      'ok',
      `meaning_repair_review: ${meaningRepairReviewPages.length} page(s) (${pageSummary}), ${totalTargets}/${meaningRepairReviewPages[0].pagination.total} targets + full bodies`,
    );
  }
  return true;
}
