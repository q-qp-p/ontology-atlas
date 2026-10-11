export const EXIT = Object.freeze({
  OK: 0,
  GATE_BLOCKED: 2,
  USAGE: 64,
  DATA: 65,
  SOFTWARE: 70,
  IO: 74,
});

export const CONTRACTS = Object.freeze({
  candidate: 'qualificationHandoffCandidate:v1',
  coverage: 'qualificationHandoffProposalCoverage:v1',
  seal: 'qualificationHandoffSeal:v1',
  access: 'qualificationHandoffAccess:v1',
  hidden: 'qualificationHandoffHidden:v1',
  hiddenReceipt: 'qualificationHandoffHiddenReceipt:v1',
  audit: 'qualificationHandoffSourceFragment:v1',
  auditReceipt: 'qualificationHandoffAuditReceipt:v1',
  join: 'qualificationHandoffJoin:v1',
  request: 'qualificationHandoffAcceptanceRequest:v1',
  acceptance: 'qualificationHandoffAcceptance:v1',
  release: 'qualificationHandoffRelease:v1',
});

export const ROLES = Object.freeze({
  HIDDEN: 'source_hidden_evaluator',
  AUDITOR: 'source_aware_auditor',
});
export const QUANTIFIER_RE = /\b(all|always|any|each|every|exactly|never|none|only|solely)\b/gi;
export const DIGEST_RE = /^sha256:[a-f0-9]{64}$/;
export const MANDATORY_AXES = Object.freeze([
  'semantic',
  'structural',
  'evidence_provenance',
  'maintainability',
  'interoperability',
]);
export const EVIDENCE_PENDING_ID = 'qualification-handoff:audit-pending';
export const COLD_START_REGRESSION_WITNESS_ID = 'qualification-handoff:cold-start-regression';
export const HANDOFF_SCHEMA_ACCESS_BOUNDARIES = Object.freeze([
  'subjectSourceAccessed',
  'hiddenArtifactsAccessed',
  'auditorArtifactsAccessed',
  'builderPrivateArtifactsAccessed',
  'vaultAccessed',
  'networkUsed',
  'otherAgentContacted',
]);
export const EVIDENCE_PENDING_DIAGNOSTIC = Object.freeze({
  id: EVIDENCE_PENDING_ID,
  axis: 'evidence_provenance',
  category: 'evidence',
  message: 'Source-aware claim and citation verification is pending.',
  evidenceRefs: [],
});
export const QUALITY_AXIS_GUIDANCE = Object.freeze({
  semantic: {
    question: 'Are kind, boundary, and relation meanings defensible without conflating implementation structure with product meaning?',
    evidence: ['definitions and boundaries', 'includes and excludes', 'examples and counterexamples', 'relation rationale'],
  },
  structural: {
    question: 'Does the candidate graph satisfy its declared structure with resolved references?',
    evidence: ['schema validation', 'resolved concept and relation endpoints', 'candidate seal and proposal coverage'],
  },
  functional: {
    question: 'Can the candidate answer the human-approved competency questions at their declared quantifiers and targets?',
    evidence: ['expected answers', 'target-level claim coverage', 'required witness-kind coverage'],
  },
  evidence_provenance: {
    question: 'Can every business claim be traced to current source evidence and approval lineage?',
    evidence: ['claim citations', 'source fragments and digests', 'witness currentness', 'approval and receipt lineage'],
  },
  pragmatic: {
    question: 'Can each approved audience make the intended decision from the source-hidden handoff?',
    evidence: ['source-hidden task result', 'complete claim ledger coverage', 'resource-use receipt'],
  },
  maintainability: {
    question: 'Can the candidate change be reviewed and its meaning retested against current source?',
    evidence: ['exact review plan or diff', 'explicit impact boundary including honest gaps', 'cold-start or prior-CQ regression receipt', 'source-currentness binding'],
  },
  interoperability: {
    question: 'Are format, export, and standards claims bounded to what the candidate actually preserves?',
    evidence: ['declared format or profile boundary', 'candidate round-trip receipt', 'rejected missing, foreign, and truncated artifact mutations'],
  },
});
export const PROTECTED_HIDDEN_FIELDS = Object.freeze([
  'contract',
  'subject',
  'actors',
  'witnesses',
  'claims',
  'citationChecks',
  'sourceHiddenTask',
  'acceptance',
  'cqResults',
  'canWrite',
  'writePlan',
]);
export const QUALIFICATION_CORE_FIELDS = Object.freeze([
  'qualificationId',
  'purposeAuthority',
  'scenarios',
  'competencyQuestions',
  'axisResults',
  'diagnostics',
  'regression',
  'resourceUse',
]);
