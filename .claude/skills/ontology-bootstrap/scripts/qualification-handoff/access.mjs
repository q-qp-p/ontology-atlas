import { CONTRACTS, ROLES } from './contracts.mjs';
import {
  artifactDigest,
  assert,
  isRecord,
  nonBlank,
  uniqueStrings,
  validTimestamp,
} from './primitives.mjs';
import { HANDOFF_SCHEMA } from './schema.mjs';

export function validateAccess(accessRow, role) {
  assert(
    isRecord(accessRow)
      && Object.keys(accessRow).every((key) => (
        ['contract', 'actorId', 'role', 'startedAt', 'endedAt', 'readScopes', 'writeScopes', 'boundaries'].includes(key)
      )),
    'Access manifest contains an unknown field.',
  );
  assert(accessRow?.contract === CONTRACTS.access, 'Unknown access manifest contract.');
  assert(nonBlank(accessRow.actorId) && accessRow.actorId.length <= 500, 'Access manifest needs actorId.');
  assert(accessRow.role === role, `Access role must be ${role}.`);
  assert(validTimestamp(accessRow.startedAt) && validTimestamp(accessRow.endedAt), 'Access window needs timestamps.');
  assert(Date.parse(accessRow.endedAt) >= Date.parse(accessRow.startedAt), 'Access window ends before it starts.');
  assert(
    uniqueStrings(accessRow.readScopes)
      && uniqueStrings(accessRow.writeScopes)
      && [...accessRow.readScopes, ...accessRow.writeScopes].every((value) => value.length <= 500),
    'Access scopes must be unique strings.',
  );
  assert(isRecord(accessRow.boundaries), 'Access boundaries are required.');
  assert(
    Object.keys(accessRow.boundaries).every((key) => HANDOFF_SCHEMA.access.boundaries.includes(key)),
    'Access boundaries contain an unknown field.',
  );
  for (const key of HANDOFF_SCHEMA.access.boundaries) {
    assert(typeof accessRow.boundaries[key] === 'boolean', `Access boundary ${key} must be explicit.`);
  }
  assert(accessRow.boundaries.vaultAccessed === false, 'Qualification helpers cannot access a vault.');
  assert(accessRow.boundaries.networkUsed === false, 'Qualification helpers cannot use the network.');
  assert(accessRow.boundaries.otherAgentContacted === false, 'Qualification branches must remain independent.');
  assert(accessRow.boundaries.builderPrivateArtifactsAccessed === false, 'Builder-private artifacts are outside the handoff.');
  assert(accessRow.boundaries.auditorArtifactsAccessed === false, 'Qualification branch accessed auditor artifacts.');
  if (role === ROLES.HIDDEN) {
    assert(accessRow.boundaries.subjectSourceAccessed === false, 'Source-hidden evaluator accessed subject source.');
    assert(accessRow.boundaries.hiddenArtifactsAccessed === false, 'Source-hidden evaluator accessed prior hidden artifacts.');
  } else {
    assert(accessRow.boundaries.subjectSourceAccessed === true, 'Source-aware auditor did not access subject source.');
    assert(accessRow.boundaries.hiddenArtifactsAccessed === false, 'Source-aware auditor accessed hidden artifacts.');
  }
}

export function questionApprovalProjection(qualification) {
  const purpose = qualification?.purposeAuthority;
  assert(isRecord(purpose) && Array.isArray(purpose.owners), 'Qualification purpose owners are required.');
  assert(purpose.owners.length === 1, 'Qualification handoff requires exactly one named human CQ owner.');
  const [owner] = purpose.owners;
  assert(isRecord(owner) && nonBlank(owner.id) && owner.authority === 'human', 'Qualification CQ owner must be a named human.');
  const questions = qualification?.competencyQuestions;
  assert(Array.isArray(questions) && questions.length > 0, 'Qualification competency questions are required.');
  for (const question of questions) {
    assert(
      question?.owner?.id === owner.id && question.owner.authority === 'human',
      `CQ ${question?.id ?? '(unknown)'} owner must match the single purpose owner.`,
    );
    assert(
      question?.revision?.approvedBy === owner.id && validTimestamp(question.revision.approvedAt),
      `CQ ${question?.id ?? '(unknown)'} needs approval by the single purpose owner.`,
    );
  }
  const approvedAt = questions.map(({ revision }) => Date.parse(revision.approvedAt));
  return {
    ownerId: owner.id,
    latestApprovedAt: new Date(Math.max(...approvedAt)).toISOString(),
    purposeAuthority: structuredClone(purpose),
    competencyQuestions: structuredClone(questions),
    questionSetDigest: artifactDigest({ purposeAuthority: purpose, competencyQuestions: questions }),
  };
}

export function validatePreapprovedQuestions(qualification, candidate, accessRow) {
  const review = questionApprovalProjection(qualification);
  assert(
    review.ownerId !== candidate.builderId && review.ownerId !== accessRow.actorId,
    'Human CQ owner identity collides with a construction actor.',
  );
  assert(
    Date.parse(review.latestApprovedAt) < Date.parse(accessRow.startedAt),
    'Every CQ revision must be human-approved before source-hidden evaluation starts.',
  );
  return review;
}
