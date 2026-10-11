import { CONTRACTS, ROLES } from './contracts.mjs';
import {
  artifactDigest,
  assert,
  canonicalJson,
  isRecord,
  manifestProjection,
  nonBlank,
  same,
  uniqueRows,
  uniqueStrings,
  validDigest,
} from './primitives.mjs';
import { validateQuantifiers, verifySeal } from './seal.mjs';
import { validateAccess } from './access.mjs';

function citationKey(claimId, witnessRef) {
  return `${claimId}\u0000${witnessRef}`;
}

function validateSourceFragment(fragment) {
  assert(isRecord(fragment), 'Source fragments must be objects.');
  assert(
    Object.keys(fragment).every((key) => ['sourceRef', 'digest', 'startLine', 'endLine'].includes(key)),
    'Source fragment contains an unknown field.',
  );
  assert(nonBlank(fragment.sourceRef) && validDigest(fragment.digest), 'Source fragments need sourceRef and digest.');
  if (fragment.startLine !== undefined || fragment.endLine !== undefined) {
    assert(Number.isInteger(fragment.startLine) && fragment.startLine > 0, 'Source fragment startLine must be positive.');
    assert(Number.isInteger(fragment.endLine) && fragment.endLine >= fragment.startLine, 'Source fragment endLine is invalid.');
  }
}

function expandAuditSourceFragments(claimResults, sourceFragmentCatalog) {
  assert(Array.isArray(claimResults), 'claimResults must be an array.');
  const citations = claimResults.flatMap((result) => (
    Array.isArray(result.citations) ? result.citations : []
  ));
  const modes = new Set();
  for (const citation of citations) {
    const inline = Object.hasOwn(citation, 'sourceFragments');
    const referenced = Object.hasOwn(citation, 'sourceFragmentRefs');
    assert(inline !== referenced, `Citation ${citation.witnessRef ?? '(unknown)'} needs exactly one of sourceFragments or sourceFragmentRefs.`);
    modes.add(inline ? 'inline' : 'catalog');
  }
  assert(modes.size <= 1, 'Audit citations cannot mix inline sourceFragments with sourceFragmentRefs catalog mode.');

  if (!modes.has('catalog')) {
    assert(sourceFragmentCatalog === undefined, 'sourceFragmentCatalog is only valid with sourceFragmentRefs.');
    return structuredClone(claimResults);
  }

  assert(Array.isArray(sourceFragmentCatalog) && sourceFragmentCatalog.length > 0, 'sourceFragmentRefs require a non-empty sourceFragmentCatalog.');
  uniqueRows(sourceFragmentCatalog, 'id', 'sourceFragmentCatalog');
  const catalog = new Map();
  const bodies = new Set();
  const allowedKeys = new Set(['id', 'sourceRef', 'digest', 'startLine', 'endLine']);
  for (const row of sourceFragmentCatalog) {
    assert(Object.keys(row).every((key) => allowedKeys.has(key)), `Source fragment ${row.id ?? '(unknown)'} has unknown fields.`);
    const { id, ...fragment } = row;
    assert(nonBlank(id), 'Source fragment catalog ids must be nonblank.');
    assert(id.length <= 500, 'Source fragment catalog id is too long.');
    validateSourceFragment(fragment);
    const body = canonicalJson(fragment);
    assert(!bodies.has(body), 'sourceFragmentCatalog contains a duplicate source fragment body.');
    bodies.add(body);
    catalog.set(id, fragment);
  }

  const used = new Set();
  const expanded = structuredClone(claimResults);
  for (const result of expanded) {
    for (const citation of result.citations ?? []) {
      assert(
        Array.isArray(citation.sourceFragmentRefs)
          && citation.sourceFragmentRefs.length > 0
          && uniqueStrings(citation.sourceFragmentRefs),
        `Citation ${citationKey(result.claimId, citation.witnessRef)} needs unique nonblank sourceFragmentRefs.`,
      );
      assert(
        citation.sourceFragmentRefs.every((ref) => ref.length <= 500),
        `Citation ${citationKey(result.claimId, citation.witnessRef)} has a source fragment ref that is too long.`,
      );
      citation.sourceFragments = citation.sourceFragmentRefs.map((ref) => {
        assert(catalog.has(ref), `Citation ${citationKey(result.claimId, citation.witnessRef)} has unknown source fragment ref ${ref}.`);
        used.add(ref);
        return structuredClone(catalog.get(ref));
      });
      delete citation.sourceFragmentRefs;
    }
  }
  const unused = [...catalog.keys()].filter((id) => !used.has(id));
  assert(unused.length === 0, `sourceFragmentCatalog has unreferenced source fragment ids: ${unused.join(', ')}.`);
  return expanded;
}

export function validateSourceFragmentRows(manifest, claimResults) {
  uniqueRows(claimResults, 'claimId', 'claimResults');
  assert(same(claimResults.map(({ claimId }) => claimId), manifest.map(({ id }) => id)), 'Source audit claim coverage is incomplete or reordered.');
  const citationChecks = [];
  for (const [index, result] of claimResults.entries()) {
    const claim = manifest[index];
    assert(
      Object.keys(result).every((key) => ['claimId', 'status', 'citations'].includes(key)),
      `Claim result ${result.claimId ?? '(unknown)'} contains an unknown field.`,
    );
    assert(['verified', 'mismatch'].includes(result.status), `Claim ${claim.id} needs verified or mismatch status.`);
    assert(Array.isArray(result.citations), `Claim ${claim.id} needs citations.`);
    assert(same(result.citations.map(({ witnessRef }) => witnessRef), claim.witnessRefs), `Claim ${claim.id} citation coverage is incomplete, foreign, or reordered.`);
    for (const citation of result.citations) {
      assert(
        Object.keys(citation).every((key) => ['witnessRef', 'status', 'sourceFragments'].includes(key)),
        `Citation ${citationKey(claim.id, citation.witnessRef)} contains an unknown field.`,
      );
      assert(['verified', 'mismatch'].includes(citation.status), `Citation ${citationKey(claim.id, citation.witnessRef)} needs a status.`);
      assert(Array.isArray(citation.sourceFragments) && citation.sourceFragments.length > 0, `Citation ${citationKey(claim.id, citation.witnessRef)} needs a source fragment.`);
      for (const fragment of citation.sourceFragments) {
        validateSourceFragment(fragment);
      }
      citationChecks.push({
        claimId: claim.id,
        witnessRef: citation.witnessRef,
        status: citation.status === 'verified' ? 'verified' : 'mismatch',
      });
    }
  }
  return citationChecks;
}

export function buildAuditFragment({
  candidate,
  seal,
  manifest,
  witnesses,
  access: accessRow,
  claimResults,
  sourceFragmentCatalog,
  quantifierClassifications = [],
  sourceDigest,
} = {}) {
  verifySeal(candidate, seal, manifest, witnesses);
  validateAccess(accessRow, ROLES.AUDITOR);
  assert(accessRow.actorId !== candidate.builderId, 'Builder and source-aware auditor identities collide.');
  assert(sourceDigest === candidate.sourceDigest, 'Source-aware audit source digest mismatches the sealed source.');
  const quantifiers = validateQuantifiers(manifest, quantifierClassifications);
  assert(same(quantifiers.classifications, seal.quantifiers.classifications), 'Source audit quantifier classifications drifted from the seal.');
  const expandedClaimResults = expandAuditSourceFragments(claimResults, sourceFragmentCatalog);
  const citationChecks = validateSourceFragmentRows(manifest, expandedClaimResults);
  const failures = [
    ...expandedClaimResults.filter(({ status }) => status !== 'verified').map(({ claimId }) => `claim:${claimId}`),
    ...citationChecks.filter(({ status }) => status !== 'verified').map(({ claimId, witnessRef }) => `citation:${citationKey(claimId, witnessRef)}`),
  ];
  const fragment = {
    contract: CONTRACTS.audit,
    auditorId: accessRow.actorId,
    builderId: candidate.builderId,
    sourceDigest,
    manifestProjection: manifestProjection(manifest),
    claimResults: structuredClone(expandedClaimResults),
    citationChecks,
    quantifierClassifications: quantifiers.classifications,
  };
  const receipt = {
    contract: CONTRACTS.auditReceipt,
    auditorId: accessRow.actorId,
    candidateDigest: artifactDigest(candidate),
    sealDigest: artifactDigest(seal),
    manifestDigest: artifactDigest(manifest),
    witnessesDigest: artifactDigest(witnesses),
    accessDigest: artifactDigest(accessRow),
    fragmentDigest: artifactDigest(fragment),
    verdict: failures.length === 0 ? 'verified' : 'failed',
    failures,
    counts: {
      claims: expandedClaimResults.length,
      citations: citationChecks.length,
      verifiedClaims: expandedClaimResults.filter(({ status }) => status === 'verified').length,
      verifiedCitations: citationChecks.filter(({ status }) => status === 'verified').length,
    },
  };
  return {
    fragment,
    access: structuredClone(accessRow),
    receipt,
    files: {
      'qualification-source-fragment.json': fragment,
      'auditor-access.json': accessRow,
      'audit-receipt.json': receipt,
    },
  };
}
