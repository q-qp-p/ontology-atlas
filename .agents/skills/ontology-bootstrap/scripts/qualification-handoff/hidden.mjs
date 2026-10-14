import {
  CONSTRUCTION_QUALIFICATION_CONTRACT,
  CONSTRUCTION_QUALITY_AXES,
  evaluateConstructionQualification,
} from '../../../../../mcp/src/construction/construction-qualification.mjs';
import {
  COLD_START_REGRESSION_WITNESS_ID,
  CONTRACTS,
  EVIDENCE_PENDING_DIAGNOSTIC,
  EVIDENCE_PENDING_ID,
  EXIT,
  PROTECTED_HIDDEN_FIELDS,
  QUALIFICATION_CORE_FIELDS,
  ROLES,
} from './contracts.mjs';
import {
  artifactDigest,
  assert,
  digestJson,
  exactSet,
  isRecord,
  manifestProjection,
  nonBlank,
  qualificationWitnesses,
  same,
  uniqueRows,
  uniqueStrings,
} from './primitives.mjs';
import { verifySeal } from './seal.mjs';
import { validateAccess, validatePreapprovedQuestions } from './access.mjs';

function claimWitnessRefs(claimIds, manifestById) {
  return [...new Set(claimIds.flatMap((id) => manifestById.get(id)?.witnessRefs ?? []))];
}

function deriveCqResults(qualificationCore, answers, manifest) {
  assert(Array.isArray(answers), 'Compact hidden answers are required.');
  uniqueRows(answers, 'cqId', 'answers');
  const questions = qualificationCore.competencyQuestions ?? [];
  assert(same(answers.map(({ cqId }) => cqId), questions.map(({ id }) => id)), 'Compact answers must cover competency questions in exact order.');
  const manifestById = new Map(manifest.map((claim) => [claim.id, claim]));
  const coveredClaimIds = new Set();
  const results = answers.map((answer, index) => {
    const question = questions[index];
    assert(!Object.hasOwn(answer, 'witnessRefs') && !Object.hasOwn(answer, 'targetResults'), `Answer ${answer.cqId} cannot author derived witnessRefs or targetResults.`);
    assert(
      Object.keys(answer).every((key) => ['cqId', 'status', 'answer', 'gap', 'claimIds', 'targets'].includes(key)),
      `Answer ${answer.cqId ?? '(unknown)'} contains an unknown field.`,
    );
    assert(['answered', 'partial', 'unknown', 'refused'].includes(answer.status), `Answer ${answer.cqId} has an invalid status.`);
    if (answer.status === 'answered') {
      assert(!Object.hasOwn(answer, 'gap'), `Answered CQ ${answer.cqId} cannot carry a gap.`);
    } else {
      assert(nonBlank(answer.gap) && answer.gap.length <= 1000, `${answer.status} CQ ${answer.cqId} needs a nonblank gap.`);
    }
    if (Object.hasOwn(answer, 'answer')) {
      assert(
        nonBlank(answer.answer) && answer.answer.length <= 2000,
        `Answer ${answer.cqId} answer must be a nonblank string.`,
      );
    }
    assert(uniqueStrings(answer.claimIds), `Answer ${answer.cqId} needs unique claimIds.`);
    assert(answer.claimIds.every((id) => manifestById.has(id)), `Answer ${answer.cqId} references an unknown claim.`);
    answer.claimIds.forEach((id) => coveredClaimIds.add(id));
    assert(Array.isArray(answer.targets), `Answer ${answer.cqId} needs compact targets.`);
    assert(same(answer.targets.map(({ target }) => target), question.expectedAnswer?.targets ?? []), `Answer ${answer.cqId} target coverage is incomplete, foreign, or reordered.`);
    const answerClaimSet = new Set(answer.claimIds);
    const targetResults = answer.targets.map((target) => {
      assert(
        Object.keys(target).every((key) => ['target', 'claimIds'].includes(key)),
        `Answer ${answer.cqId} target contains an unknown field.`,
      );
      assert(!Object.hasOwn(target, 'witnessRefs'), `Answer ${answer.cqId} target ${target.target} cannot author derived witnessRefs.`);
      assert(uniqueStrings(target.claimIds), `Answer ${answer.cqId} target ${target.target} needs explicit claimIds.`);
      if (answer.status === 'answered') {
        assert(target.claimIds.length > 0, `Answered CQ ${answer.cqId} target ${target.target} needs claimIds.`);
      }
      assert(target.claimIds.every((id) => answerClaimSet.has(id)), `Answer ${answer.cqId} target ${target.target} references a claim outside its answer.`);
      return {
        target: target.target,
        witnessRefs: claimWitnessRefs(target.claimIds, manifestById),
        claimIds: [...target.claimIds],
      };
    });
    return {
      cqId: answer.cqId,
      status: answer.status,
      witnessRefs: claimWitnessRefs(answer.claimIds, manifestById),
      claimIds: [...answer.claimIds],
      targetResults,
      ...(answer.status === 'answered' ? {} : { gap: answer.gap }),
    };
  });
  const missingClaimIds = manifest
    .map(({ id }) => id)
    .filter((id) => !coveredClaimIds.has(id));
  assert(
    missingClaimIds.length === 0,
    `Compact answers do not cover every manifest claim; missing ${missingClaimIds.length}: ${missingClaimIds.join(', ')}.`,
    {
      details: {
        code: 'incomplete-manifest-claim-coverage',
        expectedClaimCount: manifest.length,
        coveredClaimCount: coveredClaimIds.size,
        missingClaimIds,
      },
    },
  );
  return results;
}

function validateCoreAxes(qualificationCore) {
  uniqueRows(qualificationCore.axisResults, 'axis', 'qualificationCore.axisResults');
  const expected = CONSTRUCTION_QUALITY_AXES.filter((axis) => axis !== 'evidence_provenance');
  assert(exactSet(qualificationCore.axisResults.map(({ axis }) => axis), expected), 'qualificationCore must provide every axis except evidence_provenance.');
  assert(Array.isArray(qualificationCore.diagnostics), 'qualificationCore.diagnostics must be an array.');
  assert(!qualificationCore.diagnostics.some(({ id, axis }) => id === EVIDENCE_PENDING_ID || axis === 'evidence_provenance'), 'qualificationCore cannot author the audit-pending evidence axis or diagnostic.');
  const byAxis = new Map(qualificationCore.axisResults.map((row) => [row.axis, row]));
  return CONSTRUCTION_QUALITY_AXES.map((axis) => (
    axis === 'evidence_provenance'
      ? { axis, status: 'not_measured', evidenceRefs: [], findingIds: [EVIDENCE_PENDING_ID] }
      : structuredClone(byAxis.get(axis))
  ));
}

function prepareRegression(qualificationCore, sealedWitnesses) {
  const row = qualificationCore.regression;
  assert(isRecord(row), 'qualificationCore.regression is required.');
  assert(!sealedWitnesses.some(({ id }) => id === COLD_START_REGRESSION_WITNESS_ID), `Sealed witness id collides with reserved ${COLD_START_REGRESSION_WITNESS_ID}.`);
  if (row.baselineQualificationId === null) {
    assert(
      row.status === 'not_applicable'
        && Array.isArray(row.priorCqIds) && row.priorCqIds.length === 0
        && Array.isArray(row.rerunCqIds) && row.rerunCqIds.length === 0
        && Array.isArray(row.evidenceRefs) && row.evidenceRefs.length === 0,
      'Cold-start regression must use not_applicable with empty prior/rerun/evidence refs.',
    );
    const seed = {
      competencyQuestions: structuredClone(qualificationCore.competencyQuestions),
      regression: structuredClone(row),
    };
    const witness = {
      id: COLD_START_REGRESSION_WITNESS_ID,
      kind: 'regression',
      current: true,
      provenance: {
        sourceRef: 'qualification-handoff:cold-start-regression',
        digest: digestJson(seed),
      },
    };
    return {
      regression: { ...structuredClone(row), evidenceRefs: [COLD_START_REGRESSION_WITNESS_ID] },
      witnesses: [...qualificationWitnesses(sealedWitnesses), witness],
    };
  }
  const witnessById = new Map(sealedWitnesses.map((witness) => [witness.id, witness]));
  assert(uniqueStrings(row.evidenceRefs) && row.evidenceRefs.length > 0, 'Non-cold-start regression needs sealed regression evidence.');
  assert(row.evidenceRefs.every((id) => {
    const witness = witnessById.get(id);
    return witness?.kind === 'regression' && witness.current === true;
  }), 'Non-cold-start regression evidence must reference caller-sealed current regression witnesses.');
  return {
    regression: structuredClone(row),
    witnesses: qualificationWitnesses(sealedWitnesses),
  };
}

export function verifyRegressionBinding(qualification, sealedWitnesses) {
  assert(!sealedWitnesses.some(({ id }) => id === COLD_START_REGRESSION_WITNESS_ID), `Sealed witness id collides with reserved ${COLD_START_REGRESSION_WITNESS_ID}.`);
  const row = qualification.regression;
  const sealedProjection = qualificationWitnesses(sealedWitnesses);
  if (row?.baselineQualificationId === null) {
    assert(
      row.status === 'not_applicable'
        && Array.isArray(row.priorCqIds) && row.priorCqIds.length === 0
        && Array.isArray(row.rerunCqIds) && row.rerunCqIds.length === 0
        && same(row.evidenceRefs, [COLD_START_REGRESSION_WITNESS_ID]),
      'Cold-start regression binding drifted.',
    );
    const seed = {
      competencyQuestions: structuredClone(qualification.competencyQuestions),
      regression: { ...structuredClone(row), evidenceRefs: [] },
    };
    const reserved = {
      id: COLD_START_REGRESSION_WITNESS_ID,
      kind: 'regression',
      current: true,
      provenance: {
        sourceRef: 'qualification-handoff:cold-start-regression',
        digest: digestJson(seed),
      },
    };
    assert(same(qualification.witnesses, [...sealedProjection, reserved]), 'Cold-start regression witness drifted.');
    return;
  }
  assert(same(qualification.witnesses, sealedProjection), 'Non-cold-start qualification witnesses drifted from the sealed set.');
  const witnessById = new Map(sealedWitnesses.map((witness) => [witness.id, witness]));
  assert(uniqueStrings(row?.evidenceRefs) && row.evidenceRefs.length > 0 && row.evidenceRefs.every((id) => {
    const witness = witnessById.get(id);
    return witness?.kind === 'regression' && witness.current === true;
  }), 'Non-cold-start regression evidence drifted from caller-sealed current regression witnesses.');
}

export function evaluateHiddenShape(qualification, manifest) {
  const claimIds = new Set(manifest.map(({ id }) => id));
  const witnessIds = new Set(qualification.witnesses.map(({ id }) => id));
  const results = new Map((qualification.cqResults ?? []).map((row) => [row.cqId, row]));
  for (const question of qualification.competencyQuestions ?? []) {
    const result = results.get(question.id);
    assert(result, `Hidden qualification is missing CQ result ${question.id}.`);
    assert(result.claimIds.every((id) => claimIds.has(id)), `CQ ${question.id} references an unknown claim.`);
    assert(result.witnessRefs.every((id) => witnessIds.has(id)), `CQ ${question.id} references an unknown witness.`);
    const expectedTargets = question.expectedAnswer?.targets ?? [];
    const observedTargets = (result.targetResults ?? []).map(({ target }) => target);
    assert(same(observedTargets, expectedTargets), `CQ ${question.id} target coverage is incomplete, foreign, or reordered.`);
    for (const target of result.targetResults ?? []) {
      assert(target.claimIds.every((id) => claimIds.has(id)), `CQ ${question.id} target references an unknown claim.`);
      assert(target.witnessRefs.every((id) => witnessIds.has(id)), `CQ ${question.id} target references an unknown witness.`);
    }
  }
  const result = evaluateConstructionQualification(qualification);
  const errors = result.findings.filter(({ severity }) => severity === 'error');
  assert(errors.length === 0, 'Hidden qualification has invalid schema or incomplete claim/target rows.', { details: errors });
  const failedCqs = result.competencyQuestions.filter(({ status }) => status === 'failed');
  assert(failedCqs.length === 0, 'Source-hidden qualification has failed competency questions; repair witness kinds or evidence before join.', {
    exitCode: EXIT.GATE_BLOCKED,
    details: failedCqs,
  });
  assert(qualification.sourceHiddenTask.status === 'passed', 'Source-hidden task must pass before join.', { exitCode: EXIT.GATE_BLOCKED });
  assert(same(qualification.sourceHiddenTask.claimIds, manifest.map(({ id }) => id)), 'Source-hidden claim coverage is incomplete or reordered.');
  const evidenceAxis = qualification.axisResults.find(({ axis }) => axis === 'evidence_provenance');
  assert(same(evidenceAxis, { axis: 'evidence_provenance', status: 'not_measured', evidenceRefs: [], findingIds: [EVIDENCE_PENDING_ID] }), 'Prejoin evidence axis must remain audit-pending.');
  assert(qualification.diagnostics.filter(({ id }) => id === EVIDENCE_PENDING_ID).length === 1, 'Prejoin qualification needs exactly one audit-pending evidence diagnostic.');
  return result;
}

export function buildHiddenPacket({
  candidate,
  seal,
  manifest,
  witnesses,
  access: accessRow,
  qualificationCore,
  answers,
} = {}) {
  verifySeal(candidate, seal, manifest, witnesses);
  validateAccess(accessRow, ROLES.HIDDEN);
  assert(accessRow.actorId !== candidate.builderId, 'Builder and source-hidden evaluator identities collide.');
  assert(isRecord(qualificationCore), 'qualificationCore is required.');
  for (const key of PROTECTED_HIDDEN_FIELDS) {
    assert(!Object.hasOwn(qualificationCore, key), `qualificationCore cannot set protected field ${key}.`);
  }
  const qualificationCoreKeys = Object.keys(qualificationCore);
  assert(
    QUALIFICATION_CORE_FIELDS.every((key) => Object.hasOwn(qualificationCore, key)),
    `qualificationCore requires exactly ${QUALIFICATION_CORE_FIELDS.join(', ')}.`,
  );
  assert(
    qualificationCoreKeys.every((key) => QUALIFICATION_CORE_FIELDS.includes(key)),
    'qualificationCore contains an unknown field.',
  );
  const questionApproval = validatePreapprovedQuestions(qualificationCore, candidate, accessRow);
  const cqResults = deriveCqResults(qualificationCore, answers, manifest);
  const axisResults = validateCoreAxes(qualificationCore);
  const regressionState = prepareRegression(qualificationCore, witnesses);
  const pending = {
    contract: CONSTRUCTION_QUALIFICATION_CONTRACT,
    ...structuredClone(qualificationCore),
    subject: {
      projectSlug: candidate.reviewPlan.concepts.find(({ kind }) => kind === 'project')?.slug,
      graphDigest: candidate.planDigest,
      sourceDigest: candidate.sourceDigest,
    },
    actors: {
      builder: { id: candidate.builderId, authority: 'agent' },
      evaluator: { id: accessRow.actorId, authority: 'agent' },
    },
    witnesses: regressionState.witnesses,
    claims: manifestProjection(manifest),
    cqResults,
    citationChecks: manifest.map(({ id }) => ({ claimId: id, witnessRef: null, status: 'missing' })),
    axisResults,
    diagnostics: [...structuredClone(qualificationCore.diagnostics), structuredClone(EVIDENCE_PENDING_DIAGNOSTIC)],
    regression: regressionState.regression,
    sourceHiddenTask: {
      status: 'passed',
      evaluatorId: accessRow.actorId,
      claimIds: manifest.map(({ id }) => id),
    },
    acceptance: {
      decision: 'pending',
      decidedBy: 'pending',
      authority: 'human',
      decidedAt: new Date(Date.parse(accessRow.endedAt)).toISOString(),
      planDigest: candidate.planDigest,
      planRevision: candidate.planRevision,
      acceptedGapIds: [],
    },
  };
  assert(nonBlank(pending.subject.projectSlug), 'Review plan needs one project concept.');
  const evaluation = evaluateHiddenShape(pending, manifest);
  const receipt = {
    contract: CONTRACTS.hiddenReceipt,
    evaluatorId: accessRow.actorId,
    candidateDigest: artifactDigest(candidate),
    sealDigest: artifactDigest(seal),
    manifestDigest: artifactDigest(manifest),
    witnessesDigest: artifactDigest(witnesses),
    accessDigest: artifactDigest(accessRow),
    qualificationDigest: artifactDigest(pending),
    questionApprovalDigest: artifactDigest(questionApproval),
    claimCount: manifest.length,
    sourceHiddenStatus: pending.sourceHiddenTask.status,
    evidenceProvenance: 'audit_pending',
    schemaErrorCount: evaluation.findings.filter(({ severity }) => severity === 'error').length,
    canWrite: false,
    writePlanAbsent: !Object.hasOwn(pending, 'writePlan'),
  };
  return {
    qualification: pending,
    access: structuredClone(accessRow),
    receipt,
    files: {
      'qualification-pending.json': pending,
      'hidden-access.json': accessRow,
      'hidden-receipt.json': receipt,
      'hidden-answers.json': answers,
    },
  };
}
