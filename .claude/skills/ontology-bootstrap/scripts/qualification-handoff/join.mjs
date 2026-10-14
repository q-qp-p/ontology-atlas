import {
  evaluateConstructionQualification,
} from '../../../../../mcp/src/construction/construction-qualification.mjs';
import { evaluateConstructionLifecycle } from '../../../../../mcp/src/construction/construction-lifecycle.mjs';
import {
  CONTRACTS,
  EVIDENCE_PENDING_DIAGNOSTIC,
  EVIDENCE_PENDING_ID,
  EXIT,
  MANDATORY_AXES,
  ROLES,
} from './contracts.mjs';
import { artifactDigest, assert, manifestProjection, same } from './primitives.mjs';
import { verifySeal } from './seal.mjs';
import { validateAccess, validatePreapprovedQuestions } from './access.mjs';
import { evaluateHiddenShape, verifyRegressionBinding } from './hidden.mjs';
import { validateSourceFragmentRows } from './audit.mjs';

function verifyHidden(candidate, seal, manifest, witnesses, hidden) {
  validateAccess(hidden.access, ROLES.HIDDEN);
  const q = hidden.qualification;
  const receipt = hidden.receipt;
  assert(receipt?.contract === CONTRACTS.hiddenReceipt, 'Unknown hidden receipt contract.');
  assert(receipt.evaluatorId === hidden.access.actorId, 'Hidden actor/access mismatch.');
  assert(receipt.candidateDigest === artifactDigest(candidate), 'Hidden candidate digest drifted.');
  assert(receipt.sealDigest === artifactDigest(seal), 'Hidden seal digest drifted.');
  assert(receipt.manifestDigest === artifactDigest(manifest), 'Hidden manifest digest drifted.');
  assert(receipt.witnessesDigest === artifactDigest(witnesses), 'Hidden witness digest drifted.');
  assert(receipt.accessDigest === artifactDigest(hidden.access), 'Hidden access digest drifted.');
  assert(receipt.qualificationDigest === artifactDigest(q), 'Hidden qualification digest drifted.');
  const questionApproval = validatePreapprovedQuestions(q, candidate, hidden.access);
  assert(receipt.questionApprovalDigest === artifactDigest(questionApproval), 'Hidden CQ approval digest drifted.');
  assert(q.actors?.builder?.id === candidate.builderId && q.actors?.evaluator?.id === hidden.access.actorId, 'Hidden qualification actor mismatch.');
  assert(q.acceptance?.decision === 'pending' && q.acceptance.decidedBy === 'pending', 'Qualification was accepted before the join.');
  assert(q.citationChecks.every(({ status }) => status === 'missing'), 'Source-hidden evaluator pre-verified a citation.');
  assert(same(q.claims, manifestProjection(manifest)), 'Hidden claims were mutated or reordered.');
  verifyRegressionBinding(q, witnesses);
  evaluateHiddenShape(q, manifest);
}

function verifyAudit(candidate, seal, manifest, witnesses, audit) {
  validateAccess(audit.access, ROLES.AUDITOR);
  const fragment = audit.fragment;
  const receipt = audit.receipt;
  assert(receipt?.contract === CONTRACTS.auditReceipt, 'Unknown audit receipt contract.');
  assert(receipt.auditorId === audit.access.actorId && fragment.auditorId === audit.access.actorId, 'Auditor actor/access mismatch.');
  assert(receipt.candidateDigest === artifactDigest(candidate), 'Audit candidate digest drifted.');
  assert(receipt.sealDigest === artifactDigest(seal), 'Audit seal digest drifted.');
  assert(receipt.manifestDigest === artifactDigest(manifest), 'Audit manifest digest drifted.');
  assert(receipt.witnessesDigest === artifactDigest(witnesses), 'Audit witness digest drifted.');
  assert(receipt.accessDigest === artifactDigest(audit.access), 'Audit access digest drifted.');
  assert(receipt.fragmentDigest === artifactDigest(fragment), 'Audit fragment digest drifted.');
  assert(receipt.verdict === 'verified', 'Source-aware audit did not verify every claim and citation.', { exitCode: EXIT.GATE_BLOCKED, details: receipt.failures });
  assert(fragment.sourceDigest === candidate.sourceDigest, 'Audit source digest mismatches the candidate.');
  assert(same(fragment.manifestProjection, manifestProjection(manifest)), 'Audit claim projection was mutated or reordered.');
  const checks = validateSourceFragmentRows(manifest, fragment.claimResults);
  assert(checks.every(({ status }) => status === 'verified'), 'Audit includes a source mismatch.', { exitCode: EXIT.GATE_BLOCKED });
  assert(!Object.hasOwn(fragment, 'acceptance'), 'Source fragment cannot carry acceptance.');
}

export function joinQualification({ candidate, seal, manifest, witnesses, hidden, audit } = {}) {
  verifySeal(candidate, seal, manifest, witnesses);
  verifyHidden(candidate, seal, manifest, witnesses, hidden);
  verifyAudit(candidate, seal, manifest, witnesses, audit);
  const actors = [candidate.builderId, hidden.access.actorId, audit.access.actorId];
  assert(new Set(actors).size === actors.length, 'Builder, hidden evaluator, and source auditor must be distinct.');
  const questionApproval = validatePreapprovedQuestions(hidden.qualification, candidate, hidden.access);
  assert(!actors.includes(questionApproval.ownerId), 'Human CQ owner identity collides with a construction actor.');
  const overlapStart = Math.max(Date.parse(hidden.access.startedAt), Date.parse(audit.access.startedAt));
  const overlapEnd = Math.min(Date.parse(hidden.access.endedAt), Date.parse(audit.access.endedAt));
  assert(overlapEnd > overlapStart, 'Hidden and source-aware branches did not overlap in time.');
  const joined = structuredClone(hidden.qualification);
  const pendingDiagnostics = joined.diagnostics.filter(({ id }) => id === EVIDENCE_PENDING_ID);
  assert(pendingDiagnostics.length === 1 && same(pendingDiagnostics[0], EVIDENCE_PENDING_DIAGNOSTIC), 'Join found a mutated audit-pending diagnostic.');
  const pendingAxis = joined.axisResults.find(({ axis }) => axis === 'evidence_provenance');
  assert(same(pendingAxis, { axis: 'evidence_provenance', status: 'not_measured', evidenceRefs: [], findingIds: [EVIDENCE_PENDING_ID] }), 'Join found a mutated audit-pending evidence axis.');
  joined.citationChecks = structuredClone(audit.fragment.citationChecks);
  joined.diagnostics = joined.diagnostics.filter(({ id }) => id !== EVIDENCE_PENDING_ID);
  const evidenceRefs = [...new Set(manifest.flatMap(({ witnessRefs }) => witnessRefs))];
  joined.axisResults = joined.axisResults.map((row) => (
    row.axis === 'evidence_provenance'
      ? { axis: 'evidence_provenance', status: 'passed', evidenceRefs, findingIds: [] }
      : row
  ));
  assert(same(joined.claims, manifestProjection(manifest)), 'Join mutated protected claims.');
  assert(joined.acceptance.decision === 'pending', 'Join must remain pending human acceptance.');
  const evaluation = evaluateConstructionQualification(joined);
  assert(evaluation.findings.length === 0, 'Joined qualification has findings.', { details: evaluation.findings });
  assert(MANDATORY_AXES.every((axis) => evaluation.axes[axis]?.status === 'passed'), 'Joined qualification has a red mandatory axis.', { exitCode: EXIT.GATE_BLOCKED });
  const lifecycle = evaluateConstructionLifecycle({
    reviewPlan: candidate.reviewPlan,
    sourceDigest: candidate.sourceDigest,
    expectedProjectSlug: joined.subject.projectSlug,
    qualification: joined,
    proposalFindings: candidate.proposalValidation.findings ?? [],
  });
  assert(lifecycle.proposalCoverage.status === 'complete', 'Joined proposal coverage is incomplete.');
  assert(lifecycle.writeEligibility === 'blocked' && !Object.hasOwn(lifecycle, 'writePlan'), 'Join produced a premature writePlan/canWrite state.');
  assert(lifecycle.firstBlockingPhase === 'human_plan_approval', 'Join has a non-acceptance blocking phase.', { exitCode: EXIT.GATE_BLOCKED, details: lifecycle.diagnostics });
  const request = {
    contract: CONTRACTS.request,
    decision: 'accepted',
    planDigest: candidate.planDigest,
    planRevision: candidate.planRevision,
    requiredGapIds: [...lifecycle.requiredGapIds],
    actors: {
      builderId: candidate.builderId,
      hiddenEvaluatorId: hidden.access.actorId,
      sourceAuditorId: audit.access.actorId,
    },
    questionApproval,
    joinedQualificationDigest: artifactDigest(joined),
  };
  const receipt = {
    contract: CONTRACTS.join,
    status: 'awaiting_human_acceptance',
    actors: request.actors,
    overlap: {
      startedAt: new Date(overlapStart).toISOString(),
      endedAt: new Date(overlapEnd).toISOString(),
      durationMs: overlapEnd - overlapStart,
    },
    inputDigests: {
      candidate: artifactDigest(candidate),
      seal: artifactDigest(seal),
      manifest: artifactDigest(manifest),
      witnesses: artifactDigest(witnesses),
      hiddenQualification: artifactDigest(hidden.qualification),
      hiddenReceipt: artifactDigest(hidden.receipt),
      hiddenAccess: artifactDigest(hidden.access),
      sourceFragment: artifactDigest(audit.fragment),
      auditReceipt: artifactDigest(audit.receipt),
      auditAccess: artifactDigest(audit.access),
    },
    joinedQualificationDigest: artifactDigest(joined),
    acceptanceRequestDigest: artifactDigest(request),
    claimProjectionDigest: artifactDigest(manifestProjection(manifest)),
    proposalCoverage: lifecycle.proposalCoverage,
    requiredGapIds: [...lifecycle.requiredGapIds],
    preAcceptance: {
      decision: joined.acceptance.decision,
      writeEligibility: lifecycle.writeEligibility,
      writePlanAbsent: !Object.hasOwn(lifecycle, 'writePlan'),
    },
  };
  return {
    qualification: joined,
    evaluation,
    lifecycle,
    request,
    receipt,
    files: {
      'qualification-joined-pending.json': joined,
      'qualification-evaluation.json': evaluation,
      'lifecycle-pending.json': lifecycle,
      'acceptance-request.json': request,
      'join-receipt.json': receipt,
    },
  };
}
