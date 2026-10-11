/**
 * Work still arriving shimmers (`.acp-working-shimmer`, `app/globals.css`); landed work is still.
 * These functions pick the state, so every caller asks the same question and tests need no render.
 */
export const WORKING_SHIMMER_CLASS = 'acp-working-shimmer';

/** The shimmer class for text whose work is still in flight, or nothing once it has landed. */
export function workingShimmer(live: boolean): string | undefined {
  return live ? WORKING_SHIMMER_CLASS : undefined;
}

/**
 * Whether the composer's status words are the agent working.
 *
 * Only `thinking` is. `awaiting` is the agent blocked on the person's answer — the work is
 * waiting on *them*, and a sweeping band there would say the opposite. A turn that has gone
 * silent has its own sentence; animating over it would claim output that is not arriving.
 */
export function composerStatusLive(footerStatus: string, silent: boolean): boolean {
  return footerStatus === 'thinking' && !silent;
}

/**
 * What a tool row is doing right now.
 *
 * `running` sweeps. `awaiting` is a call the agent opened and cannot continue until the person
 * answers its permission request: it is still open, but the work is in the person's hands, so it
 * is still and says so — the same state the composer shows as 「waiting for you」. `settled` is
 * every row whose call has landed or was abandoned.
 */
export type ToolRowPhase = 'running' | 'awaiting' | 'settled';

export function toolRowPhase(running: boolean, awaitingPermission: boolean): ToolRowPhase {
  if (!running) return 'settled';
  return awaitingPermission ? 'awaiting' : 'running';
}
