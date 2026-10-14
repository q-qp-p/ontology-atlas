import { constructionPlanDigest } from '../../../../../mcp/src/construction/construction-lifecycle.mjs';
import { CONTRACTS } from './contracts.mjs';
import { assert, isRecord, nonBlank, same, uniqueStrings, validDigest } from './primitives.mjs';
import { validateCandidate } from './seal.mjs';

function analyzeCallFrom(analysis) {
  const candidates = [
    ...(Array.isArray(analysis.calls) ? analysis.calls : []),
    analysis.call,
    analysis.request,
    analysis.analyzeRequest,
  ].filter(isRecord);
  return candidates.find(({ name }) => name === 'analyze_repo_structure');
}

function analyzeStructuredContentFrom(analysis, call) {
  if (Array.isArray(analysis.responses)) {
    const response = analysis.responses.find(({ id }) => call?.id === undefined || id === call.id);
    if (response?.result?.structuredContent) return response.result.structuredContent;
  }
  if (isRecord(call?.response)) {
    return call.response.result?.structuredContent
      ?? call.response.structuredContent
      ?? (call.response.proposalValidation ? call.response : null);
  }
  return analysis.structuredContent
    ?? analysis.result?.structuredContent
    ?? analysis.response?.result?.structuredContent
    ?? (analysis.proposalValidation ? analysis : null);
}

export function deriveCandidateFromAnalysis(analysis, proposal, builderId) {
  assert(nonBlank(builderId), 'Derived seal input needs builderId.');
  const call = analyzeCallFrom(analysis);
  assert(call?.args && Object.hasOwn(call.args, 'proposal'), 'Analysis artifact must carry the exact analyze_repo_structure request proposal.');
  assert(same(call.args.proposal, proposal), 'Analysis request proposal drifted from proposalPath.');
  const structuredContent = analyzeStructuredContentFrom(analysis, call);
  assert(isRecord(structuredContent), 'Analysis artifact does not expose current analyze structuredContent.');
  const validation = structuredContent.proposalValidation;
  const lifecycle = validation?.constructionLifecycle;
  const reviewPlan = validation?.reviewPlan ?? lifecycle?.reviewPlan;
  assert(validation?.status === 'pass' && validation?.canWrite === false, 'Derived candidate analysis must be a passing non-writing review result.');
  assert(!Object.hasOwn(validation, 'writePlan'), 'Derived candidate analysis contains a premature writePlan.');
  assert(isRecord(lifecycle), 'Derived candidate analysis is missing constructionLifecycle.');
  assert(lifecycle.writeEligibility === 'reviewable' && !Object.hasOwn(lifecycle, 'writePlan'), 'Derived candidate lifecycle must remain reviewable and non-writing.');
  assert(isRecord(reviewPlan), 'Derived candidate analysis is missing reviewPlan.');
  assert(lifecycle.planDigest === constructionPlanDigest(reviewPlan), 'Derived candidate lifecycle plan digest drifted.');
  assert(validDigest(lifecycle.sourceDigest), 'Derived candidate lifecycle source digest is missing.');
  assert(Number.isInteger(lifecycle.planRevision) && lifecycle.planRevision > 0, 'Derived candidate lifecycle plan revision is invalid.');
  assert(uniqueStrings(lifecycle.requiredGapIds), 'Derived candidate lifecycle required gaps are invalid.');
  assert(Array.isArray(validation.findings), 'Derived candidate proposal findings are missing.');
  return {
    builderId,
    proposal: structuredClone(proposal),
    sourceHidden: true,
    canWrite: false,
    planDigest: lifecycle.planDigest,
    sourceDigest: lifecycle.sourceDigest,
    planRevision: lifecycle.planRevision,
    requiredGapIds: [...lifecycle.requiredGapIds],
    reviewPlan: structuredClone(reviewPlan),
    proposalValidation: {
      status: validation.status,
      canWrite: validation.canWrite,
      ...(validation.gates === undefined ? {} : { gates: structuredClone(validation.gates) }),
      findings: structuredClone(validation.findings),
    },
  };
}

export function prepareProposalCoverage({ analysis, proposal, builderId } = {}) {
  const candidate = deriveCandidateFromAnalysis(analysis, proposal, builderId);
  const refs = validateCandidate(candidate);
  const coverage = {
    contract: CONTRACTS.coverage,
    builderId: candidate.builderId,
    planDigest: candidate.planDigest,
    sourceDigest: candidate.sourceDigest,
    planRevision: candidate.planRevision,
    refs,
    counts: {
      concepts: candidate.reviewPlan.concepts.length,
      relations: candidate.reviewPlan.relations.length,
      competencies: Object.keys(candidate.reviewPlan.competencyAnswers).length,
      impacts: refs.filter((ref) => ref.startsWith('impact:')).length,
      total: refs.length,
    },
    guard: 'Exact coverage refs only; no claim, qualification, acceptance, MCP call, write plan, or vault write was created.',
  };
  return {
    coverage,
    files: { 'proposal-coverage.json': coverage },
  };
}
