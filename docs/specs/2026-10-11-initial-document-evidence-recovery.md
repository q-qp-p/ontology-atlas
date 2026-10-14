---
title: Initial document evidence exposes omissions and the exact next read
doc_type: spec
status: current
area: analysis
date: 2026-10-11
decisions:
  - 264bdb0a-5df6-4504-b240-f7cd69560844
---

# Initial document evidence exposes omissions and the exact next read

## Person and moment

An agent user constructing an ontology asks what a repository permits. The owner
reported that the first document excerpt could omit a final approval condition.
The original reproduction, now covered by
`mcp/src/analyze-adversarial.test.mjs`, used a 1,781-character paragraph that
produced a 1,177-character excerpt, dropped its final human-approval clause, and returned
`trust: candidate-evidence` with no omission or recovery metadata. This is a
script observation, not an observed human walkthrough. Capture that walkthrough
before claiming the recovery works for a person.

This leads the two requested evidence slices because a missing condition can
invert an agent's answer. Separate-root date measurement follows: it restores
an unavailable comparison but currently refuses honestly. A learner and a
person working without an agent benefit when the resulting proposal retains
its unknowns; this slice adds no new UI for those readers.

The owner's PO route is `observed`, `public-contract`, review lenses
`moment/evidence/boundaries + spec`. Truth, transfer, agent-write and human
correction boundaries stay unchanged. This is the first read-contract slice.

## Baseline

The source references in this section describe the pre-contract behavior at
commit `a2cf7789a`. The implemented contract is specified in Flow and owned by
`mcp/README.md`.

- The initial packet admits up to six documents, eight headings per document,
  a 1,200-character excerpt and a 256 KiB input file
  (`mcp/src/analyze/constants.mjs:61-64`).
- The extractor distributes the excerpt budget between selected sections and
  truncates their text (`mcp/src/analyze/semantic-evidence.mjs:698-745`). Its
  returned public rows contain source, headings, excerpt and trust, but no
  coverage or follow-up coordinates (`mcp/src/analyze/semantic-evidence.mjs:177-190`).
- The risk scan sees the selected excerpt, and policy separation checks the
  visible prose (`mcp/src/analyze/semantic-evidence.mjs:579-597`, `621-669`). The RED fixture
  demonstrates a trailing condition that is outside that visible text.
- The existing `sourceReads` reader already returns exact lines, SHA-256,
  bounded continuations and typed refusals. `sourceOnly:true` avoids another
  candidate scan and returns `canWrite:false`
  (`mcp/src/tools/repo-analysis.mjs:50-65`). Hash mismatch returns no source text
  (`mcp/src/evidence-search/source-evidence.mjs:265-305`). Limits and guards remain owned by
  `mcp/README.md:1435-1506` and `source-evidence.mjs:16-28`.
- Full bodies read through the live MCP: `capabilities/repo-structure-analysis`,
  `capabilities/project-source-binding`, `capabilities/evidence-drift-detection`.
  They distinguish reading source from accepted meaning and writes; their own
  review currentness is `not-confirmed`. The MCP serves the main-checkout vault,
  not this worktree, so current code above governs this change.
- Standing authority: `docs/PRODUCT-DIRECTION.md:25-53`; the one-source receipt
  and visible-gap decisions in `docs/DECISIONS.md:4154-4169`. Their boundary
  remains valid in the current source; historical trial figures are not new
  measurements. No decision is reversed.

## Problem and alternatives

The cause is invisible excerpt loss, not a small display. An agent cannot tell
whether a permissive sentence lost the condition that qualifies it.

| Option | Value and usability | Feasibility and local-first fit | Decision and cost |
|---|---|---|---|
| Keep the current prefix | No extra tokens or calls; the condition remains invisible | Existing local read | Reject: reproduces the owner-observed incorrect basis |
| Return complete documents or raise the limit | More context without a follow-up, but still an arbitrary cutoff | Local but response size grows with source text | Reject: weakens the established bounded packet and merely moves the failure |
| Select only whole authored units | A returned paragraph does not lose its tail | Local; depends on reliable paragraph/list grouping, and one large unit may produce no excerpt | Defer: more parser work than this loss requires; preserve as a later alternative if readers repeatedly miss the warning |
| Expose typed omission, use the existing review-required trust and return one exact bounded read | Keeps the useful prefix while making missing conditions actionable | Reuses the local guarded reader and its caps | Choose: one additive coverage object and one existing trust-state demotion; a recovery call costs another read |

Existing clients keep source/headings/excerpt. A document with a cut excerpt
changes from clean candidate evidence to `claim-review-required`; that loss of a
clean label is intentional. No new approval condition or ontology schema is
introduced. Callers still need exact human acceptance for meaning changes.

## Flow

1. When the agent asks for initial repository analysis, Atlas returns the same
   bounded document selection and excerpt with an additive `excerptInfo` object
   for authored document rows; package-manifest contracts are unchanged.
2. When selected prose does not fit, Atlas sets `excerptInfo.truncated:true`,
   adds risk flag `excerpt-truncated`, and returns `trust:claim-review-required`
   unless an existing hostile flag already requires `untrusted-instruction`.
   It retains the excerpt and all other risk flags. Truncation is not approval.
3. When the agent needs the omitted condition, Atlas supplies the first exact
   `sourceReads` selector in `excerptInfo.nextSourceRead`, using the document's
   existing `source` path, the first affected physical line, at most 200 lines,
   and `expectedSha256` of the same file bytes that produced the excerpt.
   A partly shown line is reread from its beginning, never from a character
   cursor. The object is directly usable in
   `analyze_repo_structure({rootPath,sourceOnly:true,sourceReads:[selector]})`.
4. When the file still matches, the existing reader returns complete lines and
   its server-minted citation. The agent follows its existing `next` while the
   authored condition remains incomplete; it then corrects its proposal and
   shows the person the recovered condition before any acceptance or write.
5. When the agent is wrong about currentness, Atlas's existing `hash_mismatch`,
   `file_changed`, `not_found` or bounded-read refusal returns no false citation.
   The agent preserves the proposal, reports the missing evidence, and reruns
   initial analysis or reads the named original before retrying. Atlas neither
   authorizes a write nor silently substitutes new bytes into an old citation.

The exact minimal coverage shape is
`{scope:"selected_prose",truncated:boolean,firstOmittedLine:number|null,nextSourceRead:object|null}`.
The selector is `{path,startLine,maxLines,expectedSha256}`. With no excerpt
budget loss, both nullable fields are null. `scope:selected_prose` means only
the authored prose considered for this excerpt; `truncated:false` never claims
complete document, repository or business meaning. Selection/exclusion policy
and the six-document cap do not change. Only the first recovery selector is
returned; the existing reader owns all subsequent bounds and continuation.

## States

| State | Web | macOS app | Agent / CLI read contract and next action |
|---|---|---|---|
| Empty | Out of scope — no new screen | Out of scope — no new screen | Existing absent-document result; inspect another known source |
| Loading | Out of scope — no new screen | Out of scope — no new screen | Existing tool-call progress; wait for its result |
| Selected prose fits | Out of scope — no new screen | Out of scope — no new screen | `excerptInfo.truncated:false`; inspect the evidence without inferring whole-document coverage |
| Partial | Out of scope — no new screen | Out of scope — no new screen | `excerpt-truncated`, review-required trust, exact next selector; run the bounded read |
| Recovery succeeds | Out of scope — no new screen | Out of scope — no new screen | Existing `sourceEvidence` lines/citation; inspect the full condition and correct the proposal |
| Error or changed source | Out of scope — no new screen | Out of scope — no new screen | Existing refusal reason; refresh analysis or open the original, retain the draft |
| Largest measured count | Out of scope — no new screen | Out of scope — no new screen | Six document rows and multi-range recovery are covered by the bounded recovery regression; this is fixture evidence, not a scale benchmark |

## Copy

None — no human UI text is introduced. The exact machine values are specified
above; source text remains untrusted evidence, not tool instructions. Do not add
unused catalogue keys for a future screen. The public contract belongs in
`mcp/README.md`, with the existing source-only example as the recovery action.

## Edge cases

- Empty, one short paragraph and a heading-only document preserve their existing
  selection behavior. A single long physical line gets its own starting line;
  if it exceeds 8 KiB the existing reader refuses `line_too_large` honestly.
- The six-document maximum and 1,200-character excerpt remain bounded. The
  six-document regression checks these limits and continuation progress; no
  scale claim follows.
- On first run, no prior receipt is required; the selector hash comes from the
  current initial read. Hangul, CRLF and supplementary Unicode preserve exact
  source line coordinates and the raw reader's UTF-8 byte limits.
- A moved/renamed/unreadable file or concurrent edit returns refusal rather than
  different text under the prior hash. Source read access is unchanged.
- Offline use works with local files; this adds no network, copied source store
  or background read. Code fences/comments/quoted text remain task1's parser
  responsibility and do not become authored evidence through this metadata.

## Out of scope

- Full-document mode, larger limits and a new recovery tool: the existing reader
  already owns exact source delivery, byte caps and guards.
- Automatic source reads, new ontology nodes, write approvals or meaning
  acceptance: the person retains those existing decisions.
- Whole-document completeness, new language understanding and a complete
  Markdown parser: none follows from an honest excerpt bound.
- A new Insights surface or localization strings: this slice changes the
  agent-facing read contract only.

## Acceptance criteria

1. Given the retained RED script and no human walkthrough, when the builder
   replays the owner moment, then a scratch transcript records the original
   incorrect basis and the later recovered approval condition. Verify with
   the approval-condition regression in `mcp/src/analyze-adversarial.test.mjs`
   plus an actual source-only recovery transcript; do not
   label the transcript human-tested unless a person performed it.
2. Given the long approval paragraph, when initial analysis runs, then the
   response retains its bounded excerpt, declares truncation and the correct
   first affected line, carries the exact-byte hash selector, and cannot return
   clean candidate trust. Verify in `mcp/src/analyze-adversarial.test.mjs` with
   an assertion on typed fields, source hash and recovered source bytes.
3. Given the returned selector, when the agent submits it unchanged through
   `sourceOnly:true`, then it retrieves the previously omitted approval clause
   with a valid complete-line citation and `canWrite:false`. Verify in
   `mcp/src/integration.test.mjs`; the test must make the real public tool call,
   not call only the parser.
4. Given the document changes, is replaced or becomes unsafe before replay,
   when recovery runs, then existing guards return no body/citation under the
   old hash and the draft is not written. Verify `mcp/src/evidence-search/source-evidence.test.mjs`
   plus the same public-tool replay fixture, retaining current symlink/escape
   and oversized-line guards.
5. Given short content, Hangul, a multiline paragraph and a partly selected
   physical line, when analysis and recovery run, then the coverage scope is
   accurate, no-loss fields are null, and the selector starts at the first
   affected line. Verify parameterized adversarial/source-read fixtures; do not
   pin descriptive prose.
6. Given six admitted documents, maximum excerpt budgets and a recovery beyond
   one 200-line or 8 KiB range, when the flow runs, then initial limits remain
   unchanged, subsequent `next` makes progress, and unrecovered text stays
   explicitly incomplete. Verify existing bounded-source tests plus the new
   excerpt fixture; record packet bytes in scratch.
7. Given a recovered condition, when analysis is used for a proposal, then no
   omission field acts as acceptance, no write is emitted, and qualification
   still requires the exact current evidence and existing human acceptance.
   Verify the existing construction lifecycle tests and the bounded field-trial
   recovery proof required by the PO pass.

## Risks

1. The omission coordinate skips the qualifying line. Probe paragraphs spanning
   several source lines and a cutoff inside one line; always start at that
   affected line and use the reader's existing complete-line citation.
2. A client ignores additive metadata and treats the prefix as complete. Keep
   the existing review-required trust state on truncated excerpts and preserve
   the visible unknown through the recovery walkthrough.
3. The hash describes different bytes or recovery bypasses guards. Hash the same
   read used by extraction; replay only through `sourceReads`, with a changed-file
   negative case and no new raw-source path.

## Later

1. Whole authored-unit selection, only if the field trial still produces answers
   that omit conditions despite the explicit warning and exact recovery.
2. Coverage across document selection limits, only if a separate trial attributes
   an incorrect answer to an entirely unselected document or section.

## Owner question

None — the owner authorized this read-contract fix. Keep the bounded prefix,
make loss explicit and recover with the existing reader; whole-unit selection
remains the reversible next choice if the recovery proof fails.
