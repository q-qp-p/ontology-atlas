import {
  constructionPlanDigest,
  evaluateConstructionLifecycle,
  proposalCoverageRefs,
} from '../../../../../mcp/src/construction/construction-lifecycle.mjs';
import { CONTRACTS, EXIT, QUANTIFIER_RE } from './contracts.mjs';
import {
  artifactDigest,
  assert,
  digestJson,
  isRecord,
  manifestProjection,
  nonBlank,
  same,
  uniqueRows,
  uniqueStrings,
  validDigest,
} from './primitives.mjs';

export function validateCandidate(candidate) {
  assert(isRecord(candidate), 'candidate must be an object.');
  assert(nonBlank(candidate.builderId), 'candidate.builderId is required.');
  assert(isRecord(candidate.proposal), 'candidate.proposal must carry the exact original proposal.');
  assert(candidate.sourceHidden === true, 'candidate.sourceHidden must be true.');
  assert(candidate.canWrite === false, 'candidate.canWrite must be false before qualification.');
  assert(!Object.hasOwn(candidate, 'writePlan'), 'candidate must not contain a premature writePlan.');
  assert(isRecord(candidate.reviewPlan), 'candidate.reviewPlan is required.');
  assert(Array.isArray(candidate.reviewPlan.concepts), 'reviewPlan.concepts must be an array.');
  assert(Array.isArray(candidate.reviewPlan.relations), 'reviewPlan.relations must be an array.');
  assert(isRecord(candidate.reviewPlan.competencyAnswers), 'reviewPlan.competencyAnswers is required.');
  uniqueRows(candidate.reviewPlan.concepts, 'slug', 'reviewPlan.concepts');
  assert(candidate.reviewPlan.concepts.every(({ body }) => (
    typeof body === 'string' && body.trim().length > 0
  )), 'Every concept needs its complete body.');
  assert(candidate.reviewPlan.concepts.filter(({ kind }) => kind === 'project').length === 1, 'Review plan needs exactly one project concept.');
  const relationKeys = candidate.reviewPlan.relations.map(({ from, to, type }) => `${type}:${from}->${to}`);
  assert(candidate.reviewPlan.relations.every(({ from, to, type }) => [from, to, type].every(nonBlank)), 'Every relation needs from, to, and type.');
  assert(new Set(relationKeys).size === relationKeys.length, 'Review plan relations must be unique.');
  const computed = constructionPlanDigest(candidate.reviewPlan);
  assert(validDigest(candidate.planDigest) && candidate.planDigest === computed, 'candidate plan digest drifted.');
  assert(validDigest(candidate.sourceDigest), 'candidate.sourceDigest is required.');
  assert(Number.isInteger(candidate.planRevision) && candidate.planRevision > 0, 'candidate.planRevision must be positive.');
  assert(uniqueStrings(candidate.requiredGapIds), 'candidate.requiredGapIds must be unique strings.');
  assert(candidate.proposalValidation?.status === 'pass', 'candidate proposal validation did not pass.');
  assert(candidate.proposalValidation?.canWrite === false, 'candidate proposal validation must remain non-writing.');
  assert(!Object.hasOwn(candidate.proposalValidation, 'writePlan'), 'candidate proposal validation contains a premature writePlan.');
  assert(Array.isArray(candidate.proposalValidation.findings), 'candidate proposal findings must be an array.');
  const initialLifecycle = evaluateConstructionLifecycle({
    reviewPlan: candidate.reviewPlan,
    sourceDigest: candidate.sourceDigest,
    proposalFindings: candidate.proposalValidation.findings,
  });
  assert(initialLifecycle.writeEligibility === 'reviewable' && !Object.hasOwn(initialLifecycle, 'writePlan'), 'candidate lifecycle must be a non-writing review plan.');
  assert(candidate.planRevision === initialLifecycle.planRevision, 'candidate plan revision drifted.');
  assert(same(candidate.requiredGapIds, initialLifecycle.requiredGapIds), 'candidate required gap ids drifted.');
  const expectedRefs = proposalCoverageRefs(candidate.reviewPlan);
  if (Object.hasOwn(candidate, 'proposalCoverageRefs')) {
    assert(same(candidate.proposalCoverageRefs, expectedRefs), 'candidate proposal coverage refs drifted.');
  }
  return expectedRefs;
}

function validateWitnesses(witnesses) {
  uniqueRows(witnesses, 'id', 'witnesses');
  for (const witness of witnesses) {
    assert(
      Object.keys(witness).every((key) => ['id', 'kind', 'current', 'provenance', 'payload'].includes(key)),
      `Witness ${witness.id ?? '(unknown)'} contains an unknown field.`,
    );
    assert(witness.id.length <= 500, `Witness ${witness.id} id is too long.`);
    assert(nonBlank(witness.kind) && witness.kind.length <= 500, `Witness ${witness.id} needs a kind.`);
    assert(typeof witness.current === 'boolean', `Witness ${witness.id} needs currentness.`);
    assert(isRecord(witness.provenance), `Witness ${witness.id} needs provenance.`);
    assert(
      Object.keys(witness.provenance).every((key) => ['sourceRef', 'digest'].includes(key)),
      `Witness ${witness.id} provenance contains an unknown field.`,
    );
    assert(
      nonBlank(witness.provenance.sourceRef) && witness.provenance.sourceRef.length <= 1000,
      `Witness ${witness.id} needs a portable sourceRef.`,
    );
    assert(!witness.provenance.sourceRef.startsWith('/') && !witness.provenance.sourceRef.startsWith('file:'), `Witness ${witness.id} sourceRef must be portable.`);
    assert(validDigest(witness.provenance.digest), `Witness ${witness.id} needs a digest.`);
    if (Object.hasOwn(witness, 'payload')) {
      assert(witness.provenance.digest === digestJson(witness.payload), `Witness ${witness.id} payload digest drifted.`);
    }
  }
}

function bindWitnessPayloadDigests(witnesses) {
  assert(Array.isArray(witnesses), 'witnesses must be an array.');
  return structuredClone(witnesses).map((witness) => {
    if (!isRecord(witness) || !isRecord(witness.provenance) || !Object.hasOwn(witness, 'payload')) return witness;
    const expected = digestJson(witness.payload);
    if (witness.provenance.digest === undefined) witness.provenance.digest = expected;
    else assert(witness.provenance.digest === expected, `Witness ${witness.id ?? '(unknown)'} payload digest drifted.`);
    return witness;
  });
}

function quantifierMatches(manifest) {
  const matches = [];
  for (const claim of manifest) {
    for (const match of claim.statement.matchAll(QUANTIFIER_RE)) {
      matches.push({ claimId: claim.id, term: match[1].toLowerCase() });
    }
  }
  return matches;
}

export function validateQuantifiers(manifest, classifications) {
  assert(Array.isArray(classifications), 'quantifierClassifications must be an array.');
  uniqueRows(classifications.map((row) => ({ ...row, key: `${row.claimId}\u0000${String(row.term).toLowerCase()}` })), 'key', 'quantifierClassifications');
  const matches = quantifierMatches(manifest);
  const required = new Set(matches.map(({ claimId, term }) => `${claimId}\u0000${term}`));
  const provided = new Set();
  for (const row of classifications) {
    assert(
      Object.keys(row).every((key) => ['claimId', 'term', 'classification', 'rationale', 'sourceRefs'].includes(key)),
      'Quantifier classification contains an unknown field.',
    );
    const key = `${row.claimId}\u0000${String(row.term).toLowerCase()}`;
    assert(required.has(key), `Quantifier classification ${key} is foreign.`);
    assert(['source_bounded', 'unsafe'].includes(row.classification), `Quantifier ${key} needs source_bounded or unsafe classification.`);
    assert(nonBlank(row.rationale) && row.rationale.length <= 1000, `Quantifier ${key} needs a rationale.`);
    assert(uniqueStrings(row.sourceRefs), `Quantifier ${key} needs sourceRefs.`);
    assert(row.sourceRefs.every((ref) => ref.length <= 500), `Quantifier ${key} sourceRefs are too long.`);
    if (row.classification === 'source_bounded') {
      assert(row.sourceRefs.length > 0, `Source-bounded quantifier ${key} needs a sourceRef.`);
    }
    provided.add(key);
  }
  assert(same([...provided].sort(), [...required].sort()), 'Every lexical quantifier needs an exact classification.');
  const unsafe = classifications.filter(({ classification }) => classification === 'unsafe');
  assert(unsafe.length === 0, 'Unsafe lexical quantifiers must be repaired before sealing.', {
    exitCode: EXIT.GATE_BLOCKED,
    details: unsafe,
  });
  return { matches, classifications: structuredClone(classifications) };
}

function validateManifest(manifest, witnesses, expectedRefs) {
  uniqueRows(manifest, 'id', 'manifest');
  const witnessIds = new Set(witnesses.map(({ id }) => id));
  for (const claim of manifest) {
    assert(
      Object.keys(claim).every((key) => ['id', 'statement', 'status', 'witnessRefs', 'proposalRefs'].includes(key)),
      `Claim ${claim.id ?? '(unknown)'} contains an unknown field.`,
    );
    assert(claim.id.length <= 500, `Claim ${claim.id} id is too long.`);
    assert(nonBlank(claim.statement) && claim.statement.length <= 1000, `Claim ${claim.id} needs a statement.`);
    assert(claim.status === 'supported', `Claim ${claim.id} must be supported before sealing.`);
    assert(
      uniqueStrings(claim.witnessRefs)
        && claim.witnessRefs.length > 0
        && claim.witnessRefs.every((ref) => ref.length <= 500),
      `Claim ${claim.id} needs witnesses.`,
    );
    assert(claim.witnessRefs.every((id) => witnessIds.has(id)), `Claim ${claim.id} has an unknown witness.`);
    assert(
      uniqueStrings(claim.proposalRefs)
        && claim.proposalRefs.length > 0
        && claim.proposalRefs.every((ref) => ref.length <= 500),
      `Claim ${claim.id} needs one or more exact proposal refs.`,
    );
  }
  const flattenedRefs = manifest.flatMap(({ proposalRefs }) => proposalRefs);
  const expected = new Set(expectedRefs);
  assert(flattenedRefs.every((ref) => expected.has(ref)), 'Manifest proposal coverage contains a foreign ref.');
  const firstSeen = [];
  const seen = new Set();
  for (const ref of flattenedRefs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    firstSeen.push(ref);
  }
  assert(same(firstSeen, expectedRefs), 'Manifest proposal coverage is missing or first-occurrence order drifted.');
}

export function verifySeal(candidate, seal, manifest, witnesses) {
  const expectedRefs = validateCandidate(candidate);
  validateWitnesses(witnesses);
  validateManifest(manifest, witnesses, expectedRefs);
  assert(seal?.contract === CONTRACTS.seal, 'Unknown candidate seal contract.');
  assert(seal.builderId === candidate.builderId, 'Candidate seal builder mismatch.');
  assert(seal.planDigest === candidate.planDigest && seal.sourceDigest === candidate.sourceDigest, 'Candidate seal plan/source digest mismatch.');
  assert(seal.candidateDigest === artifactDigest(candidate), 'Candidate artifact digest drifted.');
  assert(seal.manifestDigest === artifactDigest(manifest), 'Manifest artifact digest drifted.');
  assert(seal.witnessesDigest === artifactDigest(witnesses), 'Witness artifact digest drifted.');
  assert(same(seal.proposalCoverageRefs, expectedRefs), 'Sealed proposal coverage drifted.');
  const quantifiers = validateQuantifiers(manifest, seal.quantifiers?.classifications ?? []);
  assert(same(quantifiers, seal.quantifiers), 'Sealed quantifier receipt drifted.');
  return expectedRefs;
}

export function sealCandidate({ candidate, manifest, witnesses, quantifierClassifications = [] } = {}) {
  const packet = { ...structuredClone(candidate), contract: CONTRACTS.candidate };
  const expectedRefs = validateCandidate(packet);
  const sealedWitnesses = bindWitnessPayloadDigests(witnesses);
  validateWitnesses(sealedWitnesses);
  validateManifest(manifest, sealedWitnesses, expectedRefs);
  const quantifiers = validateQuantifiers(manifest, quantifierClassifications);
  packet.proposalCoverageRefs = expectedRefs;
  const sealedManifest = manifestProjection(manifest);
  const seal = {
    contract: CONTRACTS.seal,
    builderId: packet.builderId,
    planDigest: packet.planDigest,
    sourceDigest: packet.sourceDigest,
    planRevision: packet.planRevision,
    candidateDigest: artifactDigest(packet),
    manifestDigest: artifactDigest(sealedManifest),
    witnessesDigest: artifactDigest(sealedWitnesses),
    proposalCoverageRefs: expectedRefs,
    counts: {
      concepts: packet.reviewPlan.concepts.length,
      relations: packet.reviewPlan.relations.length,
      claims: sealedManifest.length,
      witnesses: sealedWitnesses.length,
      requiredGaps: packet.requiredGapIds.length,
    },
    quantifiers,
  };
  return {
    candidate: packet,
    manifest: sealedManifest,
    witnesses: sealedWitnesses,
    seal,
    files: {
      'candidate-packet.json': packet,
      'claim-manifest.json': sealedManifest,
      'source-witnesses.json': sealedWitnesses,
      'candidate-seal.json': seal,
    },
  };
}
