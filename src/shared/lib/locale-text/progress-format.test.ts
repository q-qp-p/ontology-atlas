import { describe, expect, it } from 'vitest';

import { formatDownloadProgress } from './progress-format';

/**
 * **Never pretend to know progress you do not know.**
 *
 * The function moved down to `shared/lib` once this rule had two consumers (app
 * updates and agent-tool installation). The test moves with it — where a spec
 * has no check, the next consumer writes its own copy.
 */
describe('formatDownloadProgress', () => {
  it('does not invent a percentage when the total is unknown', () => {
    expect(formatDownloadProgress(1_000, null)).toBeNull();
    // Putting a division by zero on screen draws an arithmetic accident, not progress.
    expect(formatDownloadProgress(1_000, 0)).toBeNull();
    expect(formatDownloadProgress(1_000, -1)).toBeNull();
  });

  it('speaks in whole percentages, only within 0 to 100', () => {
    expect(formatDownloadProgress(0, 200)).toBe('0%');
    expect(formatDownloadProgress(50, 200)).toBe('25%');
    expect(formatDownloadProgress(200, 200)).toBe('100%');
    // Never draw 101%, even when the server under-reports Content-Length.
    expect(formatDownloadProgress(400, 200)).toBe('100%');
    expect(formatDownloadProgress(-5, 200)).toBe('0%');
  });

  it('digit counts stay steady on real values such as a Node distribution size', () => {
    // Measured: node-v24.18.0-darwin-arm64.tar.gz is 52,087,559B.
    expect(formatDownloadProgress(26_043_779, 52_087_559)).toBe('50%');
  });
});
