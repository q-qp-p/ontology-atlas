import {
  evaluateConstructionQualification,
} from '../../../../../mcp/src/construction-qualification.mjs';
import { evaluateConstructionLifecycle } from '../../../../../mcp/src/construction-lifecycle.mjs';
import { CONTRACTS, EXIT } from './contracts.mjs';
import {
  artifactDigest,
  assert,
  exactSet,
  isRecord,
  manifestProjection,
  nonBlank,
  same,
  validTimestamp,
} from './primitives.mjs';
import { verifySeal } from './seal.mjs';
import { questionApprovalProjection } from './access.mjs';

function verifyJoin(candidate, seal, manifest, joinRow) {
  const { qualification, request, receipt } = joinRow;
  assert(receipt?.contract === CONTRACTS.join && receipt.status === 'awaiting_human_acceptance', 'Join receipt is not awaiting acceptance.');
  assert(request?.contract === CONTRACTS.request, 'Unknown acceptance request contract.');
  assert(receipt.joinedQualificationDigest === artifactDigest(qualification), 'Joined qualification drifted.');
  assert(receipt.acceptanceRequestDigest === artifactDigest(request), 'Acceptance request drifted.');
  assert(request.joinedQualificationDigest === artifactDigest(qualification), 'Acceptance request qualification digest drifted.');
  assert(receipt.inputDigests.candidate === artifactDigest(candidate), 'Join candidate digest drifted.');
  assert(receipt.inputDigests.seal === artifactDigest(seal), 'Join seal digest drifted.');
  assert(receipt.inputDigests.manifest === artifactDigest(manifest), 'Join manifest digest drifted.');
  assert(same(qualification.claims, manifestProjection(manifest)), 'Joined claim projection drifted.');
  assert(same(request.questionApproval, questionApprovalProjection(qualification)), 'Acceptance request CQ approval drifted.');
  assert(same(request.requiredGapIds, receipt.requiredGapIds), 'Acceptance request gap set drifted.');
}

export function acceptQualification({ candidate, seal, manifest, witnesses, join: joinRow, human } = {}) {
  verifySeal(candidate, seal, manifest, witnesses);
  verifyJoin(candidate, seal, manifest, joinRow);
  assert(isRecord(human), 'human acceptance input is required.');
  assert(human.decision === 'accepted', 'Only explicit accepted decisions can release a plan.', { exitCode: EXIT.GATE_BLOCKED });
  assert(human.authority === 'human', 'Acceptance authority must be exactly human.');
  assert(nonBlank(human.id) && validTimestamp(human.decidedAt), 'Human acceptance needs id and decidedAt.');
  assert(!Object.values(joinRow.receipt.actors).includes(human.id), 'Human acceptance identity collides with a construction actor.');
  assert(human.id === joinRow.request.questionApproval.ownerId, 'Plan acceptor must match the preapproved CQ owner.');
  assert(Date.parse(human.decidedAt) >= Date.parse(joinRow.request.questionApproval.latestApprovedAt), 'Plan acceptance predates CQ approval.');
  assert(human.requestDigest === joinRow.receipt.acceptanceRequestDigest, 'Human acceptance request digest mismatch.');
  assert(human.planDigest === joinRow.request.planDigest, 'Acceptance request plan digest mismatch.');
  assert(human.planRevision === joinRow.request.planRevision, 'Acceptance request plan revision mismatch.');
  assert(exactSet(human.acceptedGapIds, joinRow.request.requiredGapIds), 'Acceptance must name the exact required gap set.');
  const accepted = structuredClone(joinRow.qualification);
  accepted.acceptance = {
    decision: 'accepted',
    decidedBy: human.id,
    authority: 'human',
    decidedAt: human.decidedAt,
    planDigest: human.planDigest,
    planRevision: human.planRevision,
    acceptedGapIds: [...human.acceptedGapIds],
  };
  assert(same(accepted.claims, manifestProjection(manifest)), 'Acceptance mutated protected claims.');
  const evaluation = evaluateConstructionQualification(accepted);
  assert(evaluation.findings.length === 0, 'Accepted qualification has findings.', { details: evaluation.findings });
  const lifecycle = evaluateConstructionLifecycle({
    reviewPlan: candidate.reviewPlan,
    sourceDigest: candidate.sourceDigest,
    expectedProjectSlug: accepted.subject.projectSlug,
    qualification: accepted,
    proposalFindings: candidate.proposalValidation.findings ?? [],
  });
  assert(lifecycle.writeEligibility === 'executable' && Object.hasOwn(lifecycle, 'writePlan'), 'Accepted qualification is not executable.', { exitCode: EXIT.GATE_BLOCKED, details: lifecycle.diagnostics });
  assert(same(lifecycle.writePlan, candidate.reviewPlan), 'Executable writePlan drifted from reviewPlan.');
  const receipt = {
    contract: CONTRACTS.acceptance,
    decision: 'accepted',
    decidedBy: human.id,
    authority: human.authority,
    decidedAt: human.decidedAt,
    requestDigest: human.requestDigest,
    questionSetDigest: joinRow.request.questionApproval.questionSetDigest,
    actors: structuredClone(joinRow.receipt.actors),
    acceptedGapIds: [...human.acceptedGapIds],
    planDigest: candidate.planDigest,
    planRevision: candidate.planRevision,
    joinedQualificationDigest: artifactDigest(joinRow.qualification),
    acceptedQualificationDigest: artifactDigest(accepted),
    lifecycleDigest: artifactDigest(lifecycle),
    writeEligibility: lifecycle.writeEligibility,
  };
  return {
    qualification: accepted,
    evaluation,
    lifecycle,
    receipt,
    files: {
      'qualification-accepted.json': accepted,
      'qualification-evaluation.json': evaluation,
      'lifecycle-release-preview.json': lifecycle,
      'acceptance-receipt.json': receipt,
    },
  };
}
