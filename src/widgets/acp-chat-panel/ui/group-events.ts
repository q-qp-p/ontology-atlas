import type { AcpEvent } from '@/features/acp-session';
import { stringHash } from '@/shared/lib/string-hash';

type AcpWorkEvent = Extract<AcpEvent, { kind: 'thought' }>;

type AcpToolEvent = Extract<AcpEvent, { kind: 'tool' }>;

/**
 * One drawn line of a tool run.
 *
 * `repeat` is how many calls that line stands for — always `1` unless a run of identical
 * calls was folded onto it (see `REPEAT_THRESHOLD`).
 */
interface TranscriptToolRow {
  event: AcpToolEvent;
  repeat: number;
}

export type TranscriptItem =
  | { kind: 'event'; event: Exclude<AcpEvent, AcpWorkEvent | AcpToolEvent> }
  | { kind: 'workGroup'; id: string; events: AcpWorkEvent[] }
  /**
   * Consecutive tool calls, drawn as one block. Nothing is hidden: `count` is how many calls
   * happened and `rows` is how many lines draw them, and the two differ only where a run of
   * identical calls folded onto one row that says `×N`.
   */
  | { kind: 'toolRun'; id: string; rows: TranscriptToolRow[]; count: number };

/**
 * **Three is where a repeat stops being a step and becomes a texture.**
 *
 * Two identical rows still read as two things that happened, and a reader counts them without
 * effort. From the third the column stops carrying information and starts carrying rhythm: the
 * eye reports "a lot of the same" and the *next*, different call — the one that might explain a
 * wrong answer — loses its place in the run. Below this number nothing is folded, because folding
 * a pair would cost a `×2` badge to save one line.
 */
const REPEAT_THRESHOLD = 3;

/** Length and hash: tells two values apart without holding either (a slice would pin its parent). */
function fingerprint(value: unknown): string {
  if (value === undefined || value === null) return '-';
  let text: string;
  try {
    text = JSON.stringify(value) ?? '';
  } catch {
    text = String(value);
  }
  return `${text.length}:${stringHash(text)}`;
}

/** An event is replaced whenever its call changes, so a key cached per event never goes stale. */
const repeatKeys = new WeakMap<AcpToolEvent, string>();

/**
 * **Two calls are the same call only when nothing a reader could act on differs.**
 *
 * The name is the label, the input is the target, and the answer is the outcome — the three
 * things the row actually draws. Comparing the name alone would fold four reads of four different
 * concepts into "read a concept ×4", which deletes exactly the evidence the standing tool row was
 * kept for. Comparing the answer too is what keeps `nothing found` from being absorbed by three
 * neighbours that found something: a distinct outcome never merges.
 *
 * `id` is deliberately absent — every call has its own, so including it would make the key unique
 * and the fold unreachable.
 */
function repeatKey(event: AcpToolEvent): string {
  const cached = repeatKeys.get(event);
  if (cached !== undefined) return cached;
  const key = JSON.stringify([
    event.title,
    event.toolKind,
    event.status,
    fingerprint(event.rawInput),
    fingerprint(event.rawOutput),
  ]);
  repeatKeys.set(event, key);
  return key;
}

/**
 * Fold only runs that reach the threshold, and only while they are adjacent. A later identical
 * call after something else happened is a second attempt, not a repetition, so the run restarts.
 */
function foldRepeats(events: readonly AcpToolEvent[]): TranscriptToolRow[] {
  const rows: TranscriptToolRow[] = [];
  let index = 0;
  while (index < events.length) {
    const key = repeatKey(events[index]);
    let end = index + 1;
    while (end < events.length && repeatKey(events[end]) === key) end += 1;
    const run = end - index;
    if (run >= REPEAT_THRESHOLD) {
      rows.push({ event: events[index], repeat: run });
    } else {
      for (let at = index; at < end; at += 1) rows.push({ event: events[at], repeat: 1 });
    }
    index = end;
  }
  return rows;
}

/**
 * Separates the answer from the agent's work stream. Consecutive thought chunks fold into one
 * disclosure, closed by any non-thought. Tool calls stand, consecutive ones forming a run; only
 * byte-identical repeats collapse onto one row with `×N`. A later user message starts a new group.
 */
export function groupEvents(events: readonly AcpEvent[]): TranscriptItem[] {
  const out: TranscriptItem[] = [];
  let workGroup: Extract<TranscriptItem, { kind: 'workGroup' }> | null = null;
  /** Collected raw calls for the open run; folded into rows when the run closes. */
  let toolRun: { item: Extract<TranscriptItem, { kind: 'toolRun' }>; events: AcpToolEvent[] } | null =
    null;
  const closeRun = () => {
    if (!toolRun) return;
    toolRun.item.rows = foldRepeats(toolRun.events);
    toolRun.item.count = toolRun.events.length;
    toolRun = null;
  };

  for (const event of events) {
    if (event.kind === 'user') {
      workGroup = null;
      closeRun();
      out.push({ kind: 'event', event });
      continue;
    }

    if (event.kind === 'thought') {
      closeRun();
      if (!workGroup) {
        workGroup = { kind: 'workGroup', id: event.id, events: [] };
        out.push(workGroup);
      }
      workGroup.events.push(event);
      continue;
    }

    if (event.kind === 'tool') {
      workGroup = null;
      if (!toolRun) {
        const item: Extract<TranscriptItem, { kind: 'toolRun' }> = {
          kind: 'toolRun',
          id: event.id,
          rows: [],
          count: 0,
        };
        toolRun = { item, events: [] };
        out.push(item);
      }
      toolRun.events.push(event);
      continue;
    }

    workGroup = null;
    closeRun();
    out.push({ kind: 'event', event });
  }

  closeRun();
  return out;
}
