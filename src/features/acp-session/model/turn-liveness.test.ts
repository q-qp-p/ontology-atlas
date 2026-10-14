import { describe, expect, it } from 'vitest';

import { TURN_SILENCE_LIMIT_MS, turnLiveness } from './turn-liveness';

/**
 * ⚠️ These hold the difference between "still working" and "stopped answering" — the distinction a
 * person could not make in the installed rc.11 build, where a finished turn looked exactly like a
 * running one and locked the composer for thirteen minutes.
 */
describe('turn-liveness: still working, or stopped answering', () => {
  it('does not judge when no turn is open', () => {
    for (const status of ['ready', 'idle', 'starting', 'error', 'exited']) {
      expect(turnLiveness(status, 0, Number.MAX_SAFE_INTEGER)).toBe('idle');
    }
  });

  /*
   * ⚠️ The turn opens before any update exists. Treating a missing timestamp as "silent since the
   * epoch" would flag every turn on its first frame, which is the opposite failure: the screen would
   * cry stall while the agent is starting normally.
   */
  it('a turn that just started with no news yet is not stalled', () => {
    expect(turnLiveness('thinking', null, 1_000_000)).toBe('working');
  });

  it('stays alive however long while updates keep coming', () => {
    const start = 1_000_000;
    // A sweep that has run twenty minutes but spoke one second ago is working, not stalled. The
    // no-timeout rule for `prompt` exists for exactly this turn.
    expect(turnLiveness('thinking', start + 20 * 60_000, start + 20 * 60_000 + 1_000)).toBe(
      'working',
    );
  });

  it('counts it stalled when quiet for the limit', () => {
    const t = 1_000_000;
    expect(turnLiveness('thinking', t, t + TURN_SILENCE_LIMIT_MS - 1)).toBe('working');
    expect(turnLiveness('thinking', t, t + TURN_SILENCE_LIMIT_MS)).toBe('silent');
    expect(turnLiveness('thinking', t, t + 13 * 60_000)).toBe('silent');
  });

  /*
   * ⚠️ Caught in the installed rc.12 build, by the fix's own first outing: a permission card sat on
   * screen while the notice below it said the agent had gone quiet for three minutes. Updates do
   * stop while an answer is awaited — but the person *is* the thing that has stopped, and the card
   * already explains the wait.
   */
  it('does not call it silence while waiting for human approval', () => {
    const t = 1_000_000;
    expect(turnLiveness('thinking', t, t + 13 * 60_000, true)).toBe('awaiting-answer');
    // Same clock, no card on screen: still a stall.
    expect(turnLiveness('thinking', t, t + 13 * 60_000, false)).toBe('silent');
  });

  it('lets the caller set the limit, so tests need not wait in real time', () => {
    expect(turnLiveness('thinking', 0, 50, false, 100)).toBe('working');
    expect(turnLiveness('thinking', 0, 100, false, 100)).toBe('silent');
  });

  /*
   * ⚠️ The limit guards a person's patience, not a machine's. Set it below the real gap between
   * steps and the screen calls a healthy sweep stalled, which teaches people to ignore the warning.
   */
  it('keeps the limit well above the real step interval', () => {
    expect(TURN_SILENCE_LIMIT_MS).toBeGreaterThanOrEqual(60_000);
  });
});
