---
title: Compact handoff gives each reader one self-sufficient channel
doc_type: spec
status: current
area: agents
date: 2026-10-14
decisions: [015a9731-f67d-4001-9013-a82342c08228]
---

# Compact handoff gives each reader one self-sufficient channel

Line numbers refer to `f13bb3501`. The 2026-10-14 host captures named below (`probe-channel/`,
`ac8-check/`) are quoted in the pull request; AC 8 reproduces them. The v3 figures come from
applying this shape to measured objects with the real prompt builder (built code may differ by tens of bytes).

## Person and moment

Someone who already uses a coding agent asks it to change Atlas. As the tool description says
(`mcp/src/server/tool-definitions/graph.mjs:329`), the agent calls `connection_info`, then compact
`agent_brief` with "Change the task-scoped compact agent brief projection.".

- **Codex 0.162.1** (gpt-6-astra, same config file and server commit in every run). At 21:29 it
  showed its model only `content[0].text`: NOT VISIBLE for `reviewRevision`, `primary.line` and
  every key (`probe-channel/codex-probe.txt`), while the text says "step 1 of 6 is
  meaningRepair.firstStep". In three runs after 22:30, one with the identical prompt, it showed
  the whole result, `content` and `structuredContent` (`ac8-check/codex-probe.txt`,
  `codex-old-rerun.txt`, `codex-new-rerun.txt`). Nothing on disk shows what decides this.
- **Claude Code 2.1.299**, in two runs, showed only `structuredContent` as one JSON text item with
  `handoffPrompt` inside (`probe-channel/claude-probe.txt`; `ac8-check/claude-probe.jsonl`, a
  `tool_result` of 11,606 characters).
- **The same person maintaining Atlas**: this call errored at 12,396 bytes and failed PR #2765's
  train (`docs/specs/2026-10-14-compact-meaning-repair.md`); after #2768 it fits by 110 bytes.

Not observed: how someone learning agents reads either channel, and what the in-app chat adapters
(claude-agent-acp 0.74.0, codex-acp 1.6.2) show their models. Someone who wants an ontology without
agents meets compact only through `agent-brief --compact`.

## Today

- **Two channels, one object.** For `agentBriefCompact:v2`, `ok()` sends `handoffPrompt` as the
  text and the whole object, prompt included, as `structuredContent` (`mcp/src/server/rpc.mjs:43-55`).
  The tool description says the structure "carries the typed facts once" (`graph.mjs:329`), and
  `mcp/README.md:85-88` calls compact "the versioned non-duplicating exception".
- **The text points into the structure.** Its repair line names `meaningRepair.firstStep`
  (`mcp/src/agent-brief-compact.mjs:719-724`), the ready branch ends `Full: detail=full` (`:777`),
  and neither branch states the approval policy in `safety` (`:746-798`, `:991-996`). No guard
  value (`expectedGraphHash`, `expectedSourceFingerprint`, `reviewRevision`) appears in the text.
- **One budget.** The whole serialized object, prompt included, may be at most 12,000 bytes (`:15`).
  The builder drops qualifier units until it fits, throws if it still does not, then adds each
  uncertainty unit that fits (`:1003-1052`).
- **Known task (probe).** 11,890 bytes: 9,338 of facts plus the 2,552-byte prompt field (text
  2,465). A host that shows both channels reads 14,355. The two-call wire is 21,086 characters, of
  which `connection_info` is 6,587; it carries the construction card (`mcp/src/tools/read.mjs:504`),
  1,936 characters against its 1,940 cap (`mcp/src/construction-card.mjs:14`). It delivers **0 of
  23 qualifier units and 0 of 10 uncertainty units**; unbounded, the same selection delivers 4 and 8.
- **CLI.** It accepts compact only when the text equals `structuredContent.handoffPrompt`, otherwise
  parses the text as JSON (`cli/src/lib/mcp-bridge/mcp-call.mjs:332-344`), and spawns the sibling server unless
  `OATLAS_MCP_PATH` is set (`:27-44`). The validator measures the whole object and requires the
  prompt facts in `handoffPrompt` (`cli/src/lib/query-result-contract/agent-brief/agent-brief-compact.mjs:38-40`,
  `:206-236`). `--json` prints the object, `--prompt` prints `.handoffPrompt`
  (`cli/src/commands/diagnosis/agent-brief.mjs:88-94`), and human output prints `purpose.statement` (PURPOSE,
  `:636`) and `verification.nextAction` (VERIFY, `:650`) but no qualifier unit. Integration tests
  compare `--prompt` and human output with `--json`'s `.handoffPrompt`
  (`cli/src/integration.test.mjs:6892`, `:6898`, `:6979`, `:7084`, `:7086`).
- **Protocol.** The `outputSchema` requires only `operation` (`tool-definitions/graph.mjs:629-637`).
  Other tools send JSON text and `structuredContent`: the MCP specification asks for both, and
  Claude Code's SDK client rejects a success without `structuredContent` (`mcp/README.md:1463-1467`).
- **Gate and vault.** The known-task test asserts no error, ready navigation, at most 12,000 bytes
  and a wire under 22,000 characters (`mcp/src/integration.test.mjs:10735-10808`).
  `docs/ontology/elements/task-scoped-agent-brief-projection.md:34` states "A compact v2 opt-in
  response under a 12,000-byte UTF-8 JSON ceiling".
- **Unknown:** whether anything outside this repository reads `structuredContent.handoffPrompt`,
  and what makes Codex show one channel or both.

## Problem and alternatives

The design assumes a host shows its model both channels. Claude Code shows only the structure;
Codex showed only the text once and both channels three times. The JSON reader reads the facts
twice, typed and as prompt. The text-only reader lacks the guards that live only in the structure.
A reader shown both gets 14,355 bytes with the prompt twice. Only a shape where each channel stands
alone and both together fit 12,000 serves all three. The copy, and rows no first decision needs,
crowd out every recorded unit, the evidence the 12 KiB was spent on (2026-08-30).

Ranked by value against cost:
1. **A text-only reader cannot run repair step 1 under its guards or name the recovery call
   exactly** (Codex in one of four runs). Fixed here.
2. **110 bytes of headroom**: one more focused-test coordinate errors and blocks every PR that runs
   the MCP lane. Fixed here: 1,257 bytes.
3. **No recorded unit reaches either reader.** Partly fixed: 2 qualifier units on the known task.
4. **Over budget is an error, not a smaller handoff.** Later 1.
5. **A vault-only PR does not run the wire test.** Later 2.

### What each part is for

Readers: **X** a model shown only the text (Codex once), **C** a model shown only the structure
(Claude Code), **P** CLI program, **H** person reading CLI output. Bytes on the known task, keys
included.

**Every other row stays as today**, including `currentness` but its question rows, `validation`,
`safety`, `meaningRepair` but `writePolicy`, the qualifier coverage and units, `taskNavigation`,
`unknowns`, `uncertainty`, and the calls in `nextReads` and `fullDetail`.

**Moved out of compact.** Every row but one is off the 2026-08-30 mandatory list
(`docs/DECISIONS.md:1449`: currentness, validation, meaningRepair, approval/no-auto-write policy,
qualifiers, unknowns, the full-detail escape hatch) or a copy of a fact that stays in the same
channel. The exception is the meaning question rows, which the owner's 2026-10-14 answer moves.

| Row | Bytes | Read by | On the list? | Why it can go | Where it stays |
|---|---|---|---|---|---|
| `handoffPrompt` | 2,552 | X | — | C read the facts twice | is `content[0].text` |
| `focus.qualifiers.fullBodyRead` | 208 | MCP tests | qualifiers: copy | its `tool` and `arguments` equal `nextReads[0]`'s (`:911`) | `nextReads[0]` |
| `purpose` | 512 | H PURPOSE; X `Purpose:` when not ready | no | no first decision for a coding task | project body, always the first slug of `nextReads[0]` (`:900-911`) |
| `meaningRepair.writePolicy` | 94 | P | approval policy: copy | its three booleans repeat in `safety` (`mcp/src/meaning-repair.mjs:51-57`) | `safety`; the text's `Safety:` |
| `currentness.meaning.questions` | 359 | — | **yes**: currentness | five per-question status rows; the meaning status, top gap, next action and a new `questionCount` (18) stay | full detail, through the `Full:` call |
| `focus.selectionPolicy` | 135 | — | no | a constant (`:954`) | `readerRules` `Capability: selection, not proof.`; the text's `(selection, not proof)` |
| `verification.nextAction` | 132 | H VERIFY | no | one of three sentences chosen by paths and manifest (`:553-557`) | `readerRules` and the text's `Verify:` line |
| `fullDetail.reason` | 72 | — | the call stays | a constant (`:1000`) | full detail |
| `nextReads[].reason` | 135 | — | no | chosen by refusal reason and anchor paths (`:972-988`) | full detail |
| `evidenceAnchors[].relation` | 192 | P | no | `<capability> --elements--> <anchor>` (`:487`) | full detail |
| `project.scope` | 85 | 501-node test | no | vault counts | `project_scope` |
| `task.terms` | 52 | one unit test | no | the caller's own words, tokenized | the caller's task |

**The question rows** are the one narrow overturn of 2026-08-30. Currentness still states the
meaning state (`status`, `topGap`, `nextAction`) and how many questions it covers. No other compact
field repeats the rows (`meaningRepair.questions` holds different rows), and the reader recovers
them through `Full:`.

**Added or changed.** Text: `Safety:` (+105), the repair line without a field path (−24),
`Repair step 1:` (+336), the exact `Full:` call (+74); the not-ready `Purpose:` line goes with
`purpose`. Structure: `readerRules` (+407) carries the text's rule lines: quoted evidence, the
`Verify:` line and tests when navigation is ready, and body recovery. It adds two rules the
structure would otherwise lose: `Capability: selection, not proof.` when a capability is selected,
and a repair rule when review is required. `safety` already carries the Safety line. Ids become
`agentBriefCompact:v3` and `meaningRepairCompact:v2` (v1 without `writePolicy`). Structure 9,338 →
7,787 bytes; text 2,465 → 2,956.

### Ways to give the ability back

| Option | Gives back | Cost and fit | Choice |
|---|---|---|---|
| Status quo | Nothing | The next selected-document edit errors; a text-only reader still cannot run step 1 | Reject |
| A. Dedupe inside one channel | 208 bytes (`fullBodyRead`) | Nothing else goes without removing some reader's only copy | Keep its removal |
| B. Split by reader under one 12,000 bound; rows without a first decision move to full detail | Guards and exact calls in the text; no copy in the structure; 11,608 bytes for a reader shown both; 1,257 headroom; 2 units | Contracts `v3`/`v2`, CLI work; overturns the 2026-09-05 accounting | **Choose** |
| B2. Split with a budget per channel (12,000 + 4,500, 14,000 together) | 3 units, nothing moved | A host showing both, as Codex did three times, reads up to 14,000: the raise 2026-08-30 forbids | Reject (owner) |
| MCP-letter: text is `JSON.stringify(structure)`, the CLI renders a prompt | MCP's SHOULD to the letter | A text-only reader reads 7,787 bytes of JSON instead of a 2,956-byte prompt; both channels count 15,574, so the structure must lose about 1,800 more bytes of facts; 2026-08-31 (`docs/DECISIONS.md:1431`) names the text "the ready prompt" | Reject |
| C. Choose by `clientInfo` | One channel per host | Codex varied within one version and config; names are self-reported; `clientInfo` serves attribution only (2026-08-13, 2026-09-07) | Reject |
| D. Caller-chosen `format` | The agent picks | A model cannot know what its host shows; a new public argument | Reject |
| E. Bounded by construction | Never an error | Needs an omission order for the coordinates v2 exists for and caps on open schema strings | Later 1 |
| F. Vault-only PRs run the wire test | Catches a vault edit before main | A `/gate-probe` | Later 2 |

**Bound.** UTF-8 bytes of `JSON.stringify(structuredContent)` plus UTF-8 bytes of the text ≤ 12,000:
the 2026-08-30 ceiling, now over everything one response carries. No per-channel budget: units fill
both channels identically, so a sub-cap would decide nothing the bound does not. The transport
bound stays: `connection_info` plus the compact response, with the text counted as a JSON-escaped
string in characters (2,956 bytes → 3,054), under 22,000 characters.

| Known task | Today | v3 without units | v3 delivered | Bound |
|---|---|---|---|---|
| `structuredContent` | 11,890 | 7,787 | 8,327 | — |
| Text | 2,465 | 2,956 | 3,281 | — |
| Both | 14,355 | 10,743 | 11,608 | 12,000 |
| Two-call wire (characters) | 21,086 | 17,520 | 18,393 | < 22,000 |
| Units (qualifier + uncertainty) | 0 + 0 | 0 + 0 | 2 + 0 | — |

| Reader on the known task | `v2` | `v3` |
|---|---|---|
| Structure only (Claude Code) | 11,890 bytes, facts twice | 8,327, once, with `readerRules` |
| Text only (Codex once) | 2,465, without guards | 3,281, with the step-1 call, `Safety:` and `Full:` |
| Both channels (Codex three times) | 14,355 | 11,608 |

The old CLI fails closed against `v3` with exit 2 (`mcp tool structuredContent text is not JSON
(query_ontology)`), reachable only through `OATLAS_MCP_PATH`; the new CLI keeps a `v2` path. No
other tool changes, and `structuredContent` and `outputSchema` stay conformant.

## Flow

1. When the agent calls compact for a known task, Atlas returns `structuredContent` as
   `agentBriefCompact:v3` and a separate handoff text; neither contains the other. The dispatch
   that passes a `v2` result through unchanged (`mcp/src/tools/graph.mjs:374`) passes `v3` the same way.
2. Atlas builds both from one set of facts: the text adds `Safety:`, `Repair step 1:` copying
   `firstStep.calls[0]`, and the exact `Full:` call; the structure drops the moved rows and adds
   `readerRules`.
3. Atlas fills both channels with the same optional units in today's order: from up to four
   qualifier units it drops the lowest priority until both channels together fit 12,000 bytes,
   then adds each uncertainty unit that still fits. Both channels report the same coverage.
4. When a host shows its model only the text, the agent reads the named batch and can run
   `Repair step 1`; the text says to read `Full` before step 2.
5. When a host shows only the structure, the agent finds the same calls at
   `meaningRepair.firstStep`, `nextReads` and `fullDetail`, and the rules in `readerRules`; when it
   shows both, the agent reads at most 12,000 bytes, where today it reads 14,355.
6. When the agent is wrong and asks for approval, or writes, from compact alone, Atlas cannot see
   it; `patch_concept` still requires `expected_mtime`, the text said `Safety:` and the structure
   carries `safety`.
7. When evidence is missing (no capability, or missing or stale coordinates), the text uses today's
   not-ready branch without `Purpose:`; the structure carries `focus.refusal` or blocked navigation.
8. When the source changes during navigation, both channels withdraw every coordinate; `firstStep`
   is null, so neither `Repair step 1:` nor the repair rule appears.
9. When the projection without optional units exceeds 12,000 bytes, Atlas returns the error.
10. When `agent-brief --compact` runs, the CLI checks the text against the structure and the bound.
    `--prompt` prints the text, `--json` prints the structure as received, human output drops
    PURPOSE and the VERIFY sentence (NEXT READ already names the project body), and an older MCP's
    `v2` passes the legacy path.

**Documents that change with it:** `mcp/README.md:85-88`, `:748-751` and `:1980`,
`docs/features/mcp-server.md:259-262`, `cli/README.md:183-184` (v3; `--json` is the structure,
`--prompt` the text, 12,000 bytes together), the `query_ontology` description and its `detail`
parameter description (`mcp/src/server/tool-definitions/graph.mjs:329` and `:376`), one decision
and one changes record; after merge, `/ontology-sync` updates `task-scoped-agent-brief-projection.md:34`.

## States

| State | Text | Structure | CLI | Web | macOS app |
|---|---|---|---|---|---|
| Partial: `human_review_required` | Repair line, `Repair step 1:`, `Full:`. Next: run step 1, read `Full` before step 2 | `firstStep`, `omitted`, repair rule. Next: the same | `REPAIR READ`, `REPAIR OMITTED`, unchanged | Out of scope — the static build serves no MCP | The bundled MCP sends both channels to the in-app agent; no screen renders them |
| Empty: `not_needed` | No repair lines. Next: `Next read:` | `firstStep` null; no repair rule | `MEANING REPAIR not_needed` | Out of scope — no MCP | Same channels; no screen |
| Error: first run, source not current (`blocked`) | `Current source: <status>/<currentness>`; coordinates `unknown`. Next: `Next read:` | As today, `blockedBy` kept | `MEANING REPAIR … · blocked <reason>` | Out of scope — no MCP | Same channels; no screen |
| Error: source changed during navigation | `Task navigation: blocked/stale (source_changed_during_navigation)` and its `Unknown:` | As today | As today | Out of scope — no MCP | Same channels; no screen |
| Refusal: no match, conflict, ambiguous | `Task match: not recorded`, `Task refusal:`; no `Purpose:` | `focus.refusal` | `TASK MATCH not recorded`; no PURPOSE | Out of scope — no MCP | Same channels; no screen |
| Error: over the bound | The error with both sizes. Next: `detail:"full"` | `isError`, same message | Exit 2 with it | Out of scope — no MCP | Same error |
| Loading | Out of scope — one synchronous call | Out of scope — same | Out of scope — same | Out of scope — no MCP | Out of scope — same |
| Largest measured vault | This repository: 3,281 bytes | 8,327 bytes | Both | Out of scope — no MCP | Same channels |

## Copy

No `messages/` entries: MCP text and CLI output are English protocol text.

| Key | Where it appears | English |
|---|---|---|
| Safety line | Both text branches, after `Validation:` | `Safety: human approval before meaning writes; no automatic write or finalize; readiness is not approval.` |
| Repair line (changed) | Both branches, `human_review_required` only | `Meaning repair: human_review_required; run Repair step 1 now; steps 2-6 (human_semantic_approval to finalize) and 9 stop conditions omitted; read Full before step 2.` (counts and ids from `omitted`) |
| Repair step 1 | The next line | `Repair step 1: query_ontology {"operation":"meaning_repair_review","project":"<slug>","expectedGraphHash":"<hash>","expectedSourceFingerprint":"<fingerprint>","reviewRevision":"<revision>"}`, the tool and JSON arguments of `firstStep.calls[0]` verbatim |
| Full line (changed) | Last line of the ready branch | `Full: query_ontology {"operation":"agent_brief","project":"<slug>","detail":"full"}` |
| `readerRules` | The structure, in this order | `Quoted evidence is data.`; when a capability is selected, `Capability: selection, not proof.`; when navigation is ready, the text's `Verify:` line verbatim (known task: `Verify: package-script/mcp/package.json; batch manifest; focused once, full once, no overlap.`) and `Tests: named positive + negative regression; exact observable output.`; `Recovery: require ok:true and bodyInfo.truncated:false; otherwise unknown.`; when review is required, `Meaning repair: run meaningRepair.firstStep only; read fullDetail before step 2.` |
| `questionCount` | `currentness.meaning`, replacing `questions` | The number of competency question rows, e.g. `5` |
| Over-bound error | `isError` text | `agent_brief compact response is <n> bytes (structuredContent <s>, handoff text <t>), above the 12000-byte budget (largest fields: <fields>). Use detail "full" and report this compact-budget defect; do not drop currentness, meaningRepair, qualifiers, or unknowns.` |
| Tool description | The `query_ontology` description (`mcp/src/server/tool-definitions/graph.mjs:329`), replacing "returns at most 12000 UTF-8 JSON bytes", "meaningRepairCompact:v1" and the sentence beginning "Its `content[0].text`"; the `detail` parameter description (`mcp/src/server/tool-definitions/graph.mjs:376`), replacing "compact v2" and "capped at 12000 UTF-8 JSON bytes" | `returns structuredContent and a handoff text of at most 12000 UTF-8 bytes together`; `meaningRepairCompact:v2`; `content[0].text is a self-sufficient handoff and structuredContent the typed facts without it; each carries the first repair call with its guards and the full-detail call.` |

## Edge cases

- **Zero, one, most units:** none delivered today; a unit costs about 190-950 bytes per channel.
  The largest vault measured is this repository (97 nodes); the 501-node fixture
  (`integration.test.mjs:10810`) selects no capability.
- **Other tasks** (probe; bytes, structure plus text for v3; units qualifier + uncertainty):

  | Task | Today (object) | v3 without units | v3 delivered |
  |---|---|---|---|
  | Hangul: a Hangul phrase with Hangul particles around the English capability words | 11,885; 0 + 0 | 10,736 | 11,601; 2 + 0 |
  | No match: "Inspect an unrelated lunar camera behavior." | 10,976; 0 + 6 | 5,824 | 9,685; 0 + 6 |
  | Another capability: "Change the topology map label placement in the canvas renderer." | 11,812; 4 + 0 | 7,916 | 11,875; 4 + 3 |
  | Long paths (synthetic): each `mcp/src/` replaced by an 88-character directory | 12,930, an error | 11,783 | 11,783; 0 + 0 |

- **Path length:** on the known task an `mcp/src/` path appears 13 times across both channels, and
  each coordinate path can grow by 96 characters before the response without units exceeds
  12,000. In the long-path fixture each can grow by 16 more. Beyond that it errors (Later 1).

- **First run:** the source is unbound, navigation is not ready, there are no repair lines.
- **Moved, renamed or unreadable folder:** the receipt goes stale and coordinates are withheld.
- **Two edits at once:** a vault change between compact and step 1 makes `meaning_repair_review`
  answer blocked/provenance-changed, as today; a source change mid-call follows Flow 8.
- **Offline:** unaffected; everything runs over local stdio.

## Out of scope

- **Raising the bound or the wire guard:** forbidden by 2026-08-30, 2026-09-05 and 2026-10-14.
- **Cutting any unit:** forbidden by 2026-09-14.
- **Moving the rest of `currentness`:** status, top gap, next action and the question count state
  the mandatory meaning and source state.
- **Content chosen by host or caller:** options C and D, rejected above.
- **Full detail and `meaning_repair_review`:** recovery reads them as is.
- **Other tools' text:** stays serialized JSON (`mcp/README.md:1463-1467`).
- **Compact-by-default:** needs its own trial (2026-08-30).

## Acceptance criteria

1. **Recovery proof and bound** (`mcp/src/integration.test.mjs`, known-task test). Given a copy
   of this repository's `docs/ontology` connected to this checkout, when compact runs for the
   known task, then it returns `agentBriefCompact:v3`, not `isError`, with `ready`/`current`
   navigation; structure plus text ≤ 12,000 bytes and the wire < 22,000 characters; the
   assertions at `:10785-10796` pass, with `:10786` expecting `meaningRepairCompact:v2`; the test
   prints both sizes and the units delivered. The PR's probe shows at least 1,000 bytes under the
   bound without optional units and 2 qualifier units.
2. **Each channel stands alone** (`mcp/src/agent-brief-compact.test.mjs`). Given fixtures for
   review required, not_needed, blocked, source changed during navigation and refusal: the text
   holds every line the CLI checks today plus `Safety:`; the repair line and `Repair step 1:` appear
   only when review is required, with JSON equal to `firstStep.calls[0].arguments`; the ready
   `Full:` JSON equals `fullDetail.arguments`; no text has `Purpose:`; the structure has no
   `handoffPrompt` and no moved row; every `readerRules` entry but the capability and repair rules
   is a text line, the `Verify:` rule included; both channels report the same coverage. A fixture over the bound throws the error with both sizes.
3. **The CLI rejects drift** (`cli/src/lib/query-result-contract/agent-brief/agent-brief-compact.test.mjs`,
   `cli/src/lib/mcp-bridge/mcp-call.test.mjs`). A `v3` pair passes. It fails when the text's guard, `Full:`
   call, a coordinate or a coverage count differs from the structure, when the structure carries
   `handoffPrompt` or a moved row, or when the bound is exceeded. A legacy `v2` still passes.
4. **CLI output** (`cli/src/integration.test.mjs`). `--prompt` prints `content[0].text` byte for
   byte and `--json` prints `structuredContent` unchanged, with no `handoffPrompt`; the compact
   assertions that read `--json`'s `.handoffPrompt` (`:6892`, `:6898`, `:6979`, `:6985`, `:7084`,
   `:7086`) read the text the server sent instead; human output has no PURPOSE line and the lines
   asserted at `:6883-6890` still match. In the PR, the new CLI passes
   against the old server through `OATLAS_MCP_PATH`, and the old CLI exits 2 against the new one.
5. **No fact lost; full detail unchanged** (PR probe on the known, Hangul, no-match and map tasks).
   Without optional units, every `v2` leaf outside `handoffPrompt` and the moved rows has the same
   path and value in `v3`; `fullBodyRead`'s `tool` and `arguments` equal `nextReads[0]`'s;
   `writePolicy`'s booleans equal `safety`'s; each `relation` equals `<capability.slug>
   --elements--> <anchor.slug>`; `nextReads[0].arguments.slugs[0]` is the project;
   `questionCount` equals the number of full detail's `meaningAssessment.dimensions.competency.questions`,
   whose `id`, `status` and `witnessStatus` equal `v2`'s rows; each task delivers at least today's
   units; full `agent_brief` is byte-identical to main.
6. **A text-only reader can act** (source-hidden reader before merge; result in the PR). Given only
   the known task's text, a reader that has not seen the code names the primary and test
   coordinates, writes the step-1 call with all three guards equal to the structure's, names the
   `Full` call, and says it will not approve, write or finalize before reading it. Fails if it
   needs a field it cannot see or proposes any of those three.
7. **A JSON-only reader can act** (same, given only `structuredContent`): the same conditions, met
   from `firstStep`, `fullDetail`, `safety` and `readerRules`.
8. **Real hosts on the branch** (captures pasted as text into the PR body, not committed).
   Precondition: `P` is a checkout of the built branch with no modified or untracked file
   (`git -C "$P" status --porcelain` prints nothing). `V` is a copy of its `docs/ontology`, connected
   by running `connect_project_source` with `confirm: true` immediately before both probes:

   ```sh
   A='{"operation":"agent_brief","project":"ontology-atlas","detail":"compact","task":"Change the task-scoped compact agent brief projection."}'
   Q='Then answer from the tool result only, never guessing: (1) Was the result you received a JSON object or plain text lines? (2) Quote the first two lines of the result verbatim. (3) Give the exact reviewRevision value you would pass to the first meaning repair call, or NOT VISIBLE. (4) Give the line number of the primary coordinate, or NOT VISIBLE. (5) List the top-level JSON keys you can see, or NONE. (6) Quote verbatim the call that returns full detail, or NOT VISIBLE.'
   printf '{"mcpServers":{"atlas":{"command":"node","args":["%s/mcp/src/index.js"],"env":{"OATLAS_VAULT":"%s","OATLAS_REPO_ROOT":"%s","OATLAS_READ_ONLY":"1"}}}}' "$P" "$V" "$P" > mcp.json
   claude -p --model sonnet --mcp-config mcp.json --strict-mcp-config --allowedTools=mcp__atlas__query_ontology --output-format stream-json --verbose "Call the tool mcp__atlas__query_ontology exactly once with arguments $A. $Q" < /dev/null > claude-probe.jsonl
   codex exec --skip-git-repo-check --sandbox read-only -c 'approval_policy="never"' -c 'mcp_servers.atlasprobe.command="node"' -c "mcp_servers.atlasprobe.args=[\"$P/mcp/src/index.js\"]" -c "mcp_servers.atlasprobe.env={OATLAS_VAULT=\"$V\",OATLAS_REPO_ROOT=\"$P\",OATLAS_READ_ONLY=\"1\"}" "Call the MCP tool query_ontology on the atlasprobe server exactly once with arguments $A. Do not run shell commands or read files. $Q" < /dev/null > codex-probe.txt
   ```

   A run that reports `meaningRepair.blockedBy` `source_not_current` does not count toward (3).
   The 22:52 run on main reported it while `P` held an untracked file, so its `reviewRevision` was
   null (`ac8-check/claude-probe.jsonl`). Expected on the branch:
   - Claude Code's `tool_result` block has no `handoffPrompt`.
   - Answers (1) and (5) record which channels each model saw.
   - Whichever it saw, (3) equals the structure's `reviewRevision`, (4) its `primary.line` and (6)
     its `fullDetail` call. Any NOT VISIBLE fails.
   - When no Codex run is text-only, AC 6 is the text-only proof.

## Risks

1. **Hosts change which channel they show.** Codex already varied within one version and config,
   and the app's adapters are unmeasured. Each channel stands alone and both together fit 12,000
   bytes, so every observed presentation gets a complete handoff: today's 14,355 bytes becomes at
   most 12,000. AC 8 records the presentation on each run, and Later 5 measures the adapters.
2. **The channels drift.** A later change adds a fact to one channel only. The text is built from
   the structure object, and the CLI rejects every mismatch in AC 3 on each run.
3. **Headroom erodes again.** Without units the known task keeps 1,257 bytes. Each coordinate path
   can grow by 96 characters on the known task and by 16 in the long-path fixture, because every
   path counts in both channels, as today. Units shrink before any error, the PR reports headroom
   without units, and Later 1 and 2 have triggers.

## Later

1. **Over the bound returns a smaller handoff (E)**, navigation `blocked: compact_budget` with exact coverage; next if any real vault errors under v3.
2. **A `docs/ontology` change runs the known-task wire test (F, `/gate-probe`)**; next if a vault-only PR breaks main.
3. **Return the question rows to compact** (341 bytes net); next if a reader given compact misses an unassessed question that would have changed its first step.
4. **Impact edges in the text** (at most three, about 180 bytes); next if a text-only trial misses a dependent capability.
5. **Probe the in-app adapters** (claude-agent-acp, codex-acp); next when the app's chat requests compact or an adapter pin moves.
6. **Qualifier units in CLI human output**; next if a person misses an exclusion only the JSON shows.

## Owner question

None. On 2026-10-14 the owner chose one 12,000-byte bound over both channels and named the rows
that leave compact, the meaning question list among them; the lead applies that answer literally.
The question rows are the one 2026-08-30 item narrowed, and `questionCount` keeps the meaning
state. To reverse, follow Later 3.

## Decision record (for `pnpm record:new`)

```md
## 2026-10-14 — Compact handoff gives each reader one self-sufficient channel under one 12,000-byte bound

**Why**: On 2026-10-14 Claude Code 2.1.299 showed its model only `structuredContent`; Codex 0.162.1 showed only `content[0].text` once and both channels in three later runs with the same version and config. Compact v2 put the prompt inside the structure, so a JSON reader read the facts twice, typed and as prompt; a text-only reader met repair guards it could not see; a reader shown both read 14,355 bytes. On the known task the 12,000-byte object had 110 bytes to spare and delivered 0 of 23 qualifier and 0 of 10 uncertainty units.
**Prior**: Upholds 2026-08-30 "Compact v2 spends 12 KiB on exact evidence": its 12,000-byte ceiling on the response now bounds the whole response, structure plus text, and never rises; every item on its mandatory list (currentness, validation, meaningRepair, approval/no-auto-write policy, qualifiers, unknowns, the full-detail escape hatch) stays in both channels. Overturns that list narrowly for currentness's five per-question status rows only, on the owner's 2026-10-14 answer naming the meaning question list among the rows that leave compact: they move to full detail, while meaning status, top gap, next action and a question count stay. Upholds "never answer by raising the budget" (2026-09-05, 2026-10-14), whole units (2026-09-14), the 22,000-character two-call wire, full default and compact opt-in. 2026-08-31's falsifier "compact reaches 12,000 bytes" now reads on the combined response. Overturns the accounting clause of 2026-09-05 "Budget compact handoffs by transmitted JSON, preserving every fact" and its every-fact condition for rows off that list or copied in the same channel: handoffPrompt (now the text), fullBodyRead (= nextReads[0] call), writePolicy (= safety), anchor relation, nextReads and fullDetail reasons (computed from fields that stay), selectionPolicy and verification.nextAction (now `readerRules`), purpose (first slug of nextReads[0]), project.scope and task.terms. Overturns 2026-10-14 "Compact meaning repair carries its first step" for writePolicy only. Fulfils 2026-08-31's "one versioned non-duplicated form" with the text as "the ready prompt".
**Decision**: `agentBriefCompact:v3` with `meaningRepairCompact:v2`. `structuredContent` carries each typed fact once and adds `readerRules`. `content[0].text` is a self-sufficient handoff that adds `Safety:`, the verbatim repair step-1 call with its guards, and the exact full-detail call. Structure plus text ≤12,000 UTF-8 bytes; optional units fill both channels identically. The CLI checks the text against the structure; `--json` prints the structure and `--prompt` the text.
**Dissent**: Compact says less: a reader no longer sees which competency questions are unassessed without reading full detail, and `agent-brief --compact` loses its PURPOSE line. Headroom without units is 1,257 bytes on the known task; each coordinate path can grow by only 16 characters on a synthetic long-path project. What makes Codex show one channel or both is unexplained, and the in-app adapters are unmeasured.
**Falsifier**: Reopen if a text-only or JSON-only reader cannot run repair step 1, or approves, writes or finalizes from compact; if one channel carries a fact the other lacks beyond the declared differences; if structure plus text exceeds 12,000 bytes or the two-call wire reaches 22,000 characters; if the known task keeps under 1,000 bytes without units; or if a reader given compact misses an unassessed question that would have changed its first step. Never answer by raising the bound or cutting a unit.
**Owner**: Project owner; chose one 12,000-byte bound over both channels and moving rows that serve no first decision, the meaning question list among them.
```
