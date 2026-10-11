import {
  CONSTRUCTION_QUALIFICATION_INPUT_SCHEMA,
  CONSTRUCTION_QUALITY_AXES,
} from '../../../../../mcp/src/construction-qualification.mjs';
import {
  COLD_START_REGRESSION_WITNESS_ID,
  CONTRACTS,
  EVIDENCE_PENDING_ID,
  HANDOFF_SCHEMA_ACCESS_BOUNDARIES,
  MANDATORY_AXES,
  PROTECTED_HIDDEN_FIELDS,
  QUALIFICATION_CORE_FIELDS,
  QUALITY_AXIS_GUIDANCE,
  ROLES,
} from './contracts.mjs';
import { isRecord } from './primitives.mjs';

const TRIMMED_NONBLANK_PATTERN = '^\\S(?:[\\s\\S]*\\S)?$';
const HANDOFF_ID_SCHEMA = Object.freeze({
  type: 'string',
  minLength: 1,
  maxLength: 500,
  pattern: TRIMMED_NONBLANK_PATTERN,
});
const HANDOFF_STRING_SCHEMA = Object.freeze({
  type: 'string',
  minLength: 1,
  maxLength: 2000,
  pattern: TRIMMED_NONBLANK_PATTERN,
});
const HANDOFF_STRING_ARRAY_SCHEMA = Object.freeze({
  type: 'array',
  uniqueItems: true,
  items: HANDOFF_ID_SCHEMA,
});

function qualificationCoreJsonSchema() {
  const properties = Object.fromEntries(QUALIFICATION_CORE_FIELDS.map((key) => [
    key,
    tightenQualificationSchema(CONSTRUCTION_QUALIFICATION_INPUT_SCHEMA.properties[key]),
  ]));
  properties.qualificationId.maxLength = 300;
  properties.competencyQuestions.items.properties.revision.properties.approvedAt = {
    type: 'string',
    format: 'date-time',
    pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
    examples: ['2026-01-02T03:00:00.000Z'],
  };
  properties.axisResults.items.properties.axis.enum = CONSTRUCTION_QUALITY_AXES.filter(
    (axis) => axis !== 'evidence_provenance',
  );
  properties.axisResults.items.properties.evidenceRefs.description = 'IDs from sealed source-witnesses.json only; claim ids, proposal refs, paths, and diagnostic ids are invalid here.';
  properties.axisResults.items.properties.findingIds.description = 'IDs from qualificationCore.diagnostics whose axis equals this row axis. Keep empty for a passing axis unless a same-axis diagnostic is intentionally retained.';
  properties.axisResults.minItems = CONSTRUCTION_QUALITY_AXES.length - 1;
  properties.axisResults.maxItems = CONSTRUCTION_QUALITY_AXES.length - 1;
  properties.axisResults.allOf = CONSTRUCTION_QUALITY_AXES
    .filter((axis) => axis !== 'evidence_provenance')
    .map((axis) => ({
      contains: {
        type: 'object',
        properties: { axis: { const: axis } },
        required: ['axis'],
      },
    }));
  properties.diagnostics.items.properties.axis.enum = CONSTRUCTION_QUALITY_AXES.filter(
    (axis) => axis !== 'evidence_provenance',
  );
  properties.diagnostics.items.properties.evidenceRefs.description = 'IDs from sealed source-witnesses.json only; claim ids, proposal refs, paths, and axis ids are invalid here.';
  properties.diagnostics.items.properties.id.not = { const: EVIDENCE_PENDING_ID };
  properties.purposeAuthority.properties.owners.minItems = 1;
  properties.purposeAuthority.properties.owners.maxItems = 1;
  return {
    type: 'object',
    properties,
    required: [...QUALIFICATION_CORE_FIELDS],
    additionalProperties: false,
  };
}

function tightenQualificationSchema(value) {
  if (Array.isArray(value)) return value.map(tightenQualificationSchema);
  if (!isRecord(value)) return value;
  const tightened = Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    tightenQualificationSchema(child),
  ]));
  if (tightened.type === 'string' && Number.isInteger(tightened.minLength) && tightened.minLength >= 1) {
    tightened.pattern = TRIMMED_NONBLANK_PATTERN;
    if (Number.isInteger(tightened.maxLength) && tightened.maxLength > 1000) tightened.maxLength = 1000;
  }
  return tightened;
}

function accessJsonSchema(role) {
  const boundaryProperties = Object.fromEntries(HANDOFF_SCHEMA_ACCESS_BOUNDARIES.map((key) => [
    key,
    { type: 'boolean', const: role === ROLES.AUDITOR && key === 'subjectSourceAccessed' },
  ]));
  return {
    type: 'object',
    properties: {
      contract: { type: 'string', const: CONTRACTS.access },
      actorId: HANDOFF_ID_SCHEMA,
      role: { type: 'string', const: role },
      startedAt: { type: 'string', format: 'date-time' },
      endedAt: { type: 'string', format: 'date-time' },
      readScopes: HANDOFF_STRING_ARRAY_SCHEMA,
      writeScopes: HANDOFF_STRING_ARRAY_SCHEMA,
      boundaries: {
        type: 'object',
        properties: boundaryProperties,
        required: [...HANDOFF_SCHEMA_ACCESS_BOUNDARIES],
        additionalProperties: false,
      },
    },
    required: ['contract', 'actorId', 'role', 'startedAt', 'endedAt', 'readScopes', 'writeScopes', 'boundaries'],
    additionalProperties: false,
  };
}

function hiddenAccessJsonSchema() {
  return accessJsonSchema(ROLES.HIDDEN);
}

function auditAccessJsonSchema() {
  return accessJsonSchema(ROLES.AUDITOR);
}

function auditSourceFragmentJsonSchema({ catalog = false } = {}) {
  const properties = {
    ...(catalog ? { id: HANDOFF_ID_SCHEMA } : {}),
    sourceRef: { type: 'string', minLength: 1, pattern: TRIMMED_NONBLANK_PATTERN },
    digest: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
    startLine: { type: 'integer', minimum: 1 },
    endLine: { type: 'integer', minimum: 1 },
  };
  return {
    type: 'object',
    properties,
    required: [...(catalog ? ['id'] : []), 'sourceRef', 'digest'],
    additionalProperties: false,
    allOf: [{
      if: { anyOf: [{ required: ['startLine'] }, { required: ['endLine'] }] },
      then: { required: ['startLine', 'endLine'] },
    }],
  };
}

function auditCitationJsonSchema() {
  return {
    type: 'object',
    properties: {
      witnessRef: HANDOFF_ID_SCHEMA,
      status: { type: 'string', enum: ['verified', 'mismatch'] },
      sourceFragments: {
        type: 'array',
        minItems: 1,
        items: auditSourceFragmentJsonSchema(),
      },
      sourceFragmentRefs: {
        ...HANDOFF_STRING_ARRAY_SCHEMA,
        minItems: 1,
      },
    },
    required: ['witnessRef', 'status'],
    additionalProperties: false,
    allOf: [
      { anyOf: [{ required: ['sourceFragments'] }, { required: ['sourceFragmentRefs'] }] },
      { not: { required: ['sourceFragments', 'sourceFragmentRefs'] } },
    ],
  };
}

function auditClaimResultsJsonSchema() {
  return {
    type: 'array',
    minItems: 1,
    items: {
      type: 'object',
      properties: {
        claimId: HANDOFF_ID_SCHEMA,
        status: { type: 'string', enum: ['verified', 'mismatch'] },
        citations: {
          type: 'array',
          minItems: 1,
          items: auditCitationJsonSchema(),
        },
      },
      required: ['claimId', 'status', 'citations'],
      additionalProperties: false,
    },
  };
}

function auditSourceFragmentCatalogJsonSchema() {
  return {
    type: 'array',
    minItems: 1,
    items: auditSourceFragmentJsonSchema({ catalog: true }),
  };
}

function hiddenAnswersJsonSchema() {
  return {
    type: 'array',
    minItems: 1,
    items: {
      type: 'object',
      properties: {
        cqId: HANDOFF_ID_SCHEMA,
        status: { type: 'string', enum: ['answered', 'partial', 'unknown', 'refused'] },
        answer: HANDOFF_STRING_SCHEMA,
        gap: { ...HANDOFF_STRING_SCHEMA, maxLength: 1000 },
        claimIds: {
          ...HANDOFF_STRING_ARRAY_SCHEMA,
          description: 'IDs from sealed claim-manifest.json assigned to this CQ. Across all answers their union must equal the complete manifest id set.',
        },
        targets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              target: HANDOFF_ID_SCHEMA,
              claimIds: {
                ...HANDOFF_STRING_ARRAY_SCHEMA,
                description: 'A subset of this answer claimIds supporting this exact expected target.',
              },
            },
            required: ['target', 'claimIds'],
            additionalProperties: false,
          },
        },
      },
      required: ['cqId', 'status', 'claimIds', 'targets'],
      additionalProperties: false,
      allOf: [
        {
          if: { properties: { status: { const: 'answered' } }, required: ['status'] },
          then: {
            not: { required: ['gap'] },
            properties: {
              targets: {
                items: {
                  properties: {
                    claimIds: { ...HANDOFF_STRING_ARRAY_SCHEMA, minItems: 1 },
                  },
                },
              },
            },
          },
        },
        {
          if: {
            properties: { status: { enum: ['partial', 'unknown', 'refused'] } },
            required: ['status'],
          },
          then: { required: ['gap'] },
        },
      ],
    },
  };
}

function sealManifestJsonSchema() {
  return {
    type: 'array',
    minItems: 1,
    items: {
      type: 'object',
      properties: {
        id: HANDOFF_ID_SCHEMA,
        statement: { ...HANDOFF_STRING_SCHEMA, maxLength: 1000 },
        status: { type: 'string', const: 'supported' },
        witnessRefs: { ...HANDOFF_STRING_ARRAY_SCHEMA, minItems: 1 },
        proposalRefs: { ...HANDOFF_STRING_ARRAY_SCHEMA, minItems: 1 },
      },
      required: ['id', 'statement', 'status', 'witnessRefs', 'proposalRefs'],
      additionalProperties: false,
    },
  };
}

function sealWitnessesJsonSchema() {
  return {
    type: 'array',
    minItems: 1,
    items: {
      type: 'object',
      properties: {
        id: HANDOFF_ID_SCHEMA,
        kind: HANDOFF_ID_SCHEMA,
        current: { type: 'boolean' },
        provenance: {
          type: 'object',
          properties: {
            sourceRef: {
              type: 'string',
              minLength: 1,
              maxLength: 1000,
              pattern: '^(?!/|file:)\\S(?:[\\s\\S]*\\S)?$',
            },
            digest: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
          },
          required: ['sourceRef'],
          additionalProperties: false,
        },
        payload: {},
      },
      required: ['id', 'kind', 'current', 'provenance'],
      additionalProperties: false,
      allOf: [{
        if: { not: { required: ['payload'] } },
        then: { properties: { provenance: { required: ['digest'] } } },
      }],
    },
  };
}

function sealQuantifierClassificationsJsonSchema() {
  return {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        claimId: HANDOFF_ID_SCHEMA,
        term: HANDOFF_ID_SCHEMA,
        classification: { type: 'string', enum: ['source_bounded', 'unsafe'] },
        rationale: { ...HANDOFF_STRING_SCHEMA, maxLength: 1000 },
        sourceRefs: HANDOFF_STRING_ARRAY_SCHEMA,
      },
      required: ['claimId', 'term', 'classification', 'rationale', 'sourceRefs'],
      additionalProperties: false,
      allOf: [{
        if: { properties: { classification: { const: 'source_bounded' } }, required: ['classification'] },
        then: { properties: { sourceRefs: { ...HANDOFF_STRING_ARRAY_SCHEMA, minItems: 1 } } },
      }],
    },
  };
}

export const HANDOFF_SCHEMA = Object.freeze({
  contract: 'qualificationHandoffCli:v1',
  purpose: 'Validate and package an ontology construction qualification without invoking MCP or writing a vault.',
  invocation: 'qualification-handoff.mjs <schema|coverage|seal|hidden|audit|join|accept|release> [--input file] [--output new-directory]',
  schemaDiscovery: {
    preferredInvocation: 'qualification-handoff.mjs schema --output <absent-directory>',
    completeContractPath: '<output-directory>/schema.json',
    completeContractRequiresFileOutput: true,
    stdoutRule: 'Do not use displayed stdout as the complete agent contract; transports may truncate this large schema.',
  },
  io: {
    schema: 'No input. For agent use, write schema.json to a new directory with --output and read that file; displayed stdout may truncate the contract.',
    otherCommands: 'Require one JSON --input and an absent --output directory. Each input embeds the previous stage artifacts as JSON values.',
    atomicity: 'Files are staged in a new sibling directory and renamed. Existing output paths are refused.',
  },
  exits: {
    0: 'success',
    2: 'a well-formed packet failed a release or semantic safety gate',
    64: 'command-line usage error',
    65: 'input contract, digest, coverage, actor, access, or mutation error',
    70: 'unexpected software error',
    74: 'input/output filesystem error',
  },
  commands: {
    coverage: {
      input: ['analysis', 'proposal', 'builderId'],
      compactInput: ['analysisPath', 'proposalPath', 'builderId'],
      output: ['proposal-coverage.json'],
      guard: 'Derives exact ordered proposal refs from the current reviewable analyzer response. It does not author claims, qualify, invoke MCP, or write a vault.',
    },
    seal: {
      input: ['candidate', 'manifest', 'witnesses', 'quantifierClassifications'],
      compactInput: ['candidatePath', 'manifestPath', 'witnessesPath', 'quantifierClassifications'],
      derivedCompactInput: ['analysisPath', 'proposalPath', 'manifestPath', 'witnessesPath', 'builderId', 'quantifierClassifications'],
      candidate: 'Must carry the exact original proposal as candidate.proposal.',
      proposalCoverage: {
        source: 'mcp/src/construction-lifecycle.mjs#proposalCoverageRefs',
        patterns: {
          concept: 'concept:<slug>',
          relation: 'relation:<type>:<from>-><to>',
          competency: 'competency:<id>',
          dependencyImpact: 'impact:relation:<type>:<from>-><to>',
          competencyImpact: 'impact:competency:<id>',
        },
        order: 'Deduplicate exact refs, then apply JavaScript Array.prototype.sort(). Manifest first-occurrence coverage must equal that ordered list.',
      },
      witnessPayloadDigest: {
        algorithm: 'sha256',
        canonicalization: 'Recursively sort object keys, preserve array order, then JSON.stringify with no whitespace and no trailing newline.',
        deriveWhenPayloadPresent: true,
        providedDigestMustMatch: true,
        requiredWithoutPayload: true,
        output: 'Every sealed witness has provenance.digest; caller-owned input objects are not mutated.',
      },
      jsonSchemas: {
        manifest: sealManifestJsonSchema(),
        witnesses: sealWitnessesJsonSchema(),
        quantifierClassifications: sealQuantifierClassificationsJsonSchema(),
      },
      output: ['candidate-packet.json', 'claim-manifest.json', 'source-witnesses.json', 'candidate-seal.json'],
    },
    hidden: {
      input: ['candidate', 'seal', 'manifest', 'witnesses', 'access', 'qualificationCore', 'answers'],
      compactInput: ['handoffDir', 'access', 'qualificationCore', 'answers'],
      siblingPathInput: ['handoffDir', 'access', 'qualificationCorePath', 'answersPath'],
      siblingPathRule: 'qualificationCorePath and answersPath must both be plain sibling .json filenames beside the CLI input. Absolute, nested, parent-traversal, and inline/path mixed inputs are rejected before any file is read.',
      siblingFileRule: 'The stable input directory may not contain symlinked ancestors. Both sibling inputs must be regular, non-symlink files with exactly one filesystem link; special files and redirected inodes fail closed.',
      answers: 'Compact rows {cqId,status,claimIds,targets:[{target,claimIds}],answer?,gap?}; witness refs and cqResults are derived. Partial/unknown/refused require gap and may leave explicit targets empty; answered targets require claims. Across all rows, the union of claimIds must cover every sealed manifest claim.',
      claimCoverage: {
        source: 'manifest[*].id',
        collector: 'union(answers[*].claimIds)',
        requirement: 'exact_set',
        duplicatesAcrossAnswers: 'allowed',
        unassignableClaimRule: 'If an approved CQ cannot truthfully carry a manifest claim, stop before hidden invocation and revise the question set through human approval; never pad an unrelated answer.',
      },
      qualificationCore: 'Omits cqResults and the evidence_provenance axis; the helper injects an audit-pending diagnostic and axis. Exactly one named human owns purpose and every CQ revision, every revision approval predates source-hidden evaluation, and that owner must later accept the exact request. Required witness kinds must match the sealed witness kinds used by each answer; a failed CQ blocks instead of becoming a human gap. Maintainability remains the evaluator judgment supplied here and is never auto-promoted.',
      qualificationCoreShape: {
        required: [...QUALIFICATION_CORE_FIELDS],
        forbidden: [...PROTECTED_HIDDEN_FIELDS],
        additionalProperties: false,
      },
      jsonSchemas: {
        access: hiddenAccessJsonSchema(),
        qualificationCore: qualificationCoreJsonSchema(),
        answers: hiddenAnswersJsonSchema(),
      },
      unknownPolicy: {
        required: ['allowed', 'response'],
        allowed: 'boolean; true permits an explicit partial/unknown/refusal gap, false does not',
        response: 'nonblank refusal or bounded unknown behavior returned when evidence cannot close the CQ',
      },
      output: ['qualification-pending.json', 'hidden-access.json', 'hidden-receipt.json', 'hidden-answers.json'],
    },
    audit: {
      input: ['candidate', 'seal', 'manifest', 'witnesses', 'access', 'claimResults', 'sourceFragmentCatalog?', 'quantifierClassifications'],
      compactInput: ['handoffDir', 'access', 'claimResults', 'sourceFragmentCatalog?', 'quantifierClassifications', 'sourceDigest'],
      claimResults: 'Each citation uses either legacy inline sourceFragments or sourceFragmentRefs into one deduplicated sourceFragmentCatalog. Catalog mode expands to the exact legacy output shape and rejects mixed, duplicate, foreign, or unused evidence.',
      sourceFragmentDigest: 'The source-aware auditor supplies a sha256 binding for each exact current source fragment; the helper validates shape and receipt binding but does not select or interpret source evidence.',
      quantifierClassifications: 'The source-aware auditor independently accepts or rejects each sealed quantifier classification. If accepted, return the exact sealed row, including rationale, sourceRefs, and their order. If unsupported, stop and reject/reseal; an equal-in-meaning rewrite is still seal drift.',
      runtimeOnlyChecks: [
        'access timestamps are valid and endedAt is not before startedAt',
        'source-aware auditor identity differs from the sealed builder identity',
        'claim ids and order equal the sealed manifest',
        'citation witness ids and order equal each claim witnessRefs',
        'source fragment catalog ids and bodies are unique and every row is referenced',
        'catalog refs are complete, known, and not mixed with inline fragments',
        'endLine is greater than or equal to startLine',
        'sourceDigest equals the sealed candidate sourceDigest',
        'quantifier classifications exactly match sealed lexical coverage and contain no unsafe row',
      ],
      jsonSchemas: {
        access: auditAccessJsonSchema(),
        claimResults: auditClaimResultsJsonSchema(),
        sourceFragmentCatalog: auditSourceFragmentCatalogJsonSchema(),
        quantifierClassifications: sealQuantifierClassificationsJsonSchema(),
      },
      output: ['qualification-source-fragment.json', 'auditor-access.json', 'audit-receipt.json'],
    },
    join: {
      input: ['candidate', 'seal', 'manifest', 'witnesses', 'hidden', 'audit'],
      compactInput: ['handoffDir', 'hiddenDir', 'auditorDir'],
      output: ['qualification-joined-pending.json', 'qualification-evaluation.json', 'lifecycle-pending.json', 'acceptance-request.json', 'join-receipt.json'],
    },
    accept: {
      input: ['candidate', 'seal', 'manifest', 'witnesses', 'join', 'human'],
      compactInput: ['handoffDir', 'joinedDir', 'human'],
      human: ['id=preapproved CQ owner', 'authority=human', 'decidedAt', 'decision=accepted', 'requestDigest', 'planDigest', 'planRevision', 'acceptedGapIds'],
      output: ['qualification-accepted.json', 'qualification-evaluation.json', 'lifecycle-release-preview.json', 'acceptance-receipt.json'],
    },
    release: {
      input: ['candidate', 'seal', 'manifest', 'witnesses', 'acceptedQualification', 'acceptanceReceipt', 'analyzeRequest', 'released'],
      compactInput: ['handoffDir', 'acceptedDir', 'analyzeRequestPath', 'releasedPath', 'firstCallId?'],
      analyzeRequest: 'The exact final analyze_repo_structure call; args.proposal and args.qualification are verified before the response is trusted.',
      released: 'The current analyzer proposalValidation (directly or nested under structuredContent.proposalValidation).',
      output: ['concept-calls.json', 'relation-calls.json', 'release-receipt.json'],
    },
  },
  access: {
    contract: CONTRACTS.access,
    roles: {
      hidden: ROLES.HIDDEN,
      audit: ROLES.AUDITOR,
    },
    required: ['contract', 'actorId', 'role', 'startedAt', 'endedAt', 'readScopes', 'writeScopes', 'boundaries'],
    boundaries: [...HANDOFF_SCHEMA_ACCESS_BOUNDARIES],
  },
  quantifiers: {
    lexicalTerms: [...new Set('all always any each every exactly never none only solely'.split(' '))],
    rule: 'Every lexical match needs a claimId/term classification of source_bounded or unsafe. Source-bounded rows need rationale and sourceRefs; unsafe rows block the stage.',
  },
  qualityAxes: {
    authority: 'docs/FOUNDATIONS.md#quality-is-a-vector-no-green-total-may-hide-a-red-dimension',
    evaluatorRule: 'Use passed only when current sealed evidence answers the axis question. A mandatory unknown, not_measured, or failed result blocks join; only measured functional or pragmatic gaps can proceed to exact human acceptance.',
    mandatory: [...MANDATORY_AXES],
    humanGapEligible: ['functional', 'pragmatic'],
    referenceNamespaces: {
      axisEvidenceRefs: 'sealed source-witnesses.json[*].id only',
      diagnosticEvidenceRefs: 'sealed source-witnesses.json[*].id only',
      axisFindingIds: 'qualificationCore.diagnostics[*].id with the same axis',
      answerClaimIds: 'sealed claim-manifest.json[*].id; the union across answers is the exact manifest id set',
      targetClaimIds: 'subset of the containing answer claimIds for that exact expected target',
    },
    dimensions: QUALITY_AXIS_GUIDANCE,
  },
  compactPaths: {
    resolution: 'Relative paths resolve against the directory containing the CLI --input JSON. Absolute paths remain absolute.',
    handoffDir: ['candidate-packet.json', 'claim-manifest.json', 'source-witnesses.json', 'candidate-seal.json'],
    hiddenDir: ['qualification-pending.json', 'hidden-access.json', 'hidden-receipt.json'],
    auditorDir: ['qualification-source-fragment.json', 'auditor-access.json', 'audit-receipt.json'],
    joinedDir: ['qualification-joined-pending.json', 'acceptance-request.json', 'join-receipt.json'],
    acceptedDir: ['qualification-accepted.json', 'acceptance-receipt.json'],
    rule: 'Compact and embedded artifact forms are mutually exclusive. Missing, malformed, or digest-drifted files fail closed.',
  },
  derivedCandidate: {
    rule: 'analysisPath must carry the exact analyze_repo_structure request plus current structuredContent. The helper binds proposalPath to that request and derives only lifecycle/review-plan fields; it does not generate claims.',
    supportedAnalysisForms: [
      'batch calls[] plus responses[] envelope',
      'recorded calls[] entry { name, args, response: <direct structuredContent> }',
      'call/request plus result.structuredContent',
      'call/request plus structuredContent',
    ],
  },
  coldStartRegression: {
    reservedWitnessId: COLD_START_REGRESSION_WITNESS_ID,
    rule: 'For baselineQualificationId:null + not_applicable + empty prior/rerun/evidence refs, hidden adds a current regression witness digest-bound to the exact CQ set and regression row. Any sealed ID collision is rejected. Non-cold-start rows must cite caller-sealed current regression witnesses.',
    maintainability: 'The reserved witness does not promote maintainability. The evaluator-authored maintainability axis must independently pass for an executable join.',
  },
});
