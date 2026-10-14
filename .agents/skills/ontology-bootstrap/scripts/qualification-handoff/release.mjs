import { evaluateConstructionLifecycle } from '../../../../../mcp/src/construction/construction-lifecycle.mjs';
import { CONTRACTS, EXIT } from './contracts.mjs';
import {
  artifactDigest,
  assert,
  digestJson,
  exactSet,
  isRecord,
  manifestProjection,
  same,
} from './primitives.mjs';
import { verifySeal } from './seal.mjs';

export function chunkWriterCalls(name, key, rows, { maxRows = 50, firstId = 1 } = {}) {
  assert(['add_concepts', 'add_relations'].includes(name), 'Unsupported writer call name.');
  assert(['concepts', 'relations'].includes(key), 'Unsupported writer argument key.');
  assert(Array.isArray(rows), `${key} must be an array.`);
  assert(Number.isInteger(maxRows) && maxRows > 0 && maxRows <= 50, 'Writer chunks must contain at most 50 rows.');
  assert(Number.isInteger(firstId) && firstId >= 0, 'firstId must be a non-negative integer.');
  const calls = [];
  for (let offset = 0; offset < rows.length; offset += maxRows) {
    calls.push({
      id: firstId + calls.length,
      name,
      args: { [key]: structuredClone(rows.slice(offset, offset + maxRows)) },
    });
  }
  return calls;
}

function releasedValidation(released) {
  return released?.structuredContent?.proposalValidation
    ?? released?.proposalValidation
    ?? released;
}

export function prepareRelease({
  candidate,
  seal,
  manifest,
  witnesses,
  acceptedQualification,
  acceptanceReceipt,
  analyzeRequest,
  released,
  firstCallId = 1,
} = {}) {
  verifySeal(candidate, seal, manifest, witnesses);
  assert(acceptanceReceipt?.contract === CONTRACTS.acceptance, 'Unknown acceptance receipt contract.');
  assert(acceptanceReceipt.acceptedQualificationDigest === artifactDigest(acceptedQualification), 'Accepted qualification digest drifted.');
  assert(acceptedQualification.acceptance?.decision === 'accepted', 'Release lacks human acceptance.');
  assert(acceptedQualification.acceptance.decidedBy === acceptanceReceipt.decidedBy, 'Release acceptance actor mismatch.');
  assert(same(acceptedQualification.claims, manifestProjection(manifest)), 'Release claim projection drifted.');
  assert(analyzeRequest?.name === 'analyze_repo_structure' && isRecord(analyzeRequest.args), 'Release needs the exact final analyze_repo_structure request.');
  assert(same(analyzeRequest.args.proposal, candidate.proposal), 'Final analyze request proposal drifted from the sealed original proposal.');
  assert(same(analyzeRequest.args.qualification, acceptedQualification), 'Final analyze request qualification drifted from the accepted qualification.');
  const recomputed = evaluateConstructionLifecycle({
    reviewPlan: candidate.reviewPlan,
    sourceDigest: candidate.sourceDigest,
    expectedProjectSlug: acceptedQualification.subject.projectSlug,
    qualification: acceptedQualification,
    proposalFindings: candidate.proposalValidation.findings ?? [],
  });
  assert(recomputed.writeEligibility === 'executable' && Object.hasOwn(recomputed, 'writePlan'), 'Recomputed lifecycle is not executable.', { exitCode: EXIT.GATE_BLOCKED, details: recomputed.diagnostics });
  const validation = releasedValidation(released);
  const lifecycle = validation?.constructionLifecycle;
  const writePlan = validation?.writePlan ?? lifecycle?.writePlan;
  assert(validation?.status === 'pass' && validation?.canWrite === true, 'Current analyzer release is non-executable.', { exitCode: EXIT.GATE_BLOCKED });
  assert(lifecycle?.writeEligibility === 'executable' && writePlan, 'Current analyzer omitted an executable writePlan.', { exitCode: EXIT.GATE_BLOCKED });
  assert(lifecycle.planDigest === candidate.planDigest, 'Released plan digest drifted.');
  assert(lifecycle.sourceDigest === candidate.sourceDigest, 'Released source digest drifted.');
  assert(lifecycle.planRevision === candidate.planRevision, 'Released plan revision drifted.');
  assert(same(writePlan, candidate.reviewPlan) && same(writePlan, recomputed.writePlan), 'Released writePlan drifted from the sealed reviewPlan.');
  assert(exactSet(lifecycle.requiredGapIds, acceptedQualification.acceptance.acceptedGapIds), 'Released required gaps drifted from acceptance.');
  const conceptCalls = chunkWriterCalls('add_concepts', 'concepts', writePlan.concepts, { firstId: firstCallId });
  const relationCalls = chunkWriterCalls('add_relations', 'relations', writePlan.relations, { firstId: firstCallId + conceptCalls.length });
  const receipt = {
    contract: CONTRACTS.release,
    status: 'prepared_not_executed',
    guard: 'This helper emitted scratch call data only; it did not invoke MCP or write a vault.',
    planDigest: candidate.planDigest,
    sourceDigest: candidate.sourceDigest,
    planRevision: candidate.planRevision,
    qualificationDigest: artifactDigest(acceptedQualification),
    acceptanceReceiptDigest: artifactDigest(acceptanceReceipt),
    analyzeRequestDigest: artifactDigest(analyzeRequest),
    writePlanDigest: digestJson(writePlan),
    rowCounts: { concepts: writePlan.concepts.length, relations: writePlan.relations.length },
    callCounts: { concepts: conceptCalls.length, relations: relationCalls.length },
    maxRowsPerCall: 50,
  };
  return {
    conceptCalls,
    relationCalls,
    receipt,
    files: {
      'concept-calls.json': conceptCalls,
      'relation-calls.json': relationCalls,
      'release-receipt.json': receipt,
    },
  };
}
