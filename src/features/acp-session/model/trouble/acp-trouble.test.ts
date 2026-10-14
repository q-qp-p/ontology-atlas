import { describe, expect, it } from 'vitest';

import { isDiagnosticStderr, readAcpTrouble } from './acp-trouble';

/**
 * Tested against measured strings only — tuned to an invented error, it would fail to recognize a
 * real one.
 */
describe('translating errors: translates only what is known and folds the original when not', () => {
  it('recognizes a lapsed login (exactly as measured 2026-08-16)', () => {
    const raw =
      '{"code":-32603,"message":"Internal error: Failed to authenticate: OAuth session expired and could not be refreshed","data":{"errorKind":"authentication_failed"}}';
    expect(readAcpTrouble(raw).kind).toBe('auth');
    // The original is never discarded — it is folded away and shown under "details".
    expect(readAcpTrouble(raw).detail).toContain('authentication_failed');
  });

  it('reads a different sentence from another tool into the same branch', () => {
    expect(readAcpTrouble('Authentication required').kind).toBe('auth');
    expect(readAcpTrouble('Error: unauthorized (401)').kind).toBe('auth');
  });

  it('a limit we set was hit', () => {
    expect(readAcpTrouble('acp-timeout: initialize').kind).toBe('timeout');
  });

  it('could not even be launched', () => {
    expect(readAcpTrouble('spawn npx ENOENT').kind).toBe('launch');
    expect(readAcpTrouble('cli-missing:claude').kind).toBe('launch');
  });

  it('a half-left npx cache: when the error string says nothing, stderr speaks (real machine 2026-08-19)', () => {
    const raw = 'acp session closed';
    // and every clue was on stderr.
    const stderr = [
      'npm error code ENOENT',
      'npm error path /Users/me/.npm/_npx/8757e2301903ae53/package.json',
      'npm error enoent Could not read package.json: Error: ENOENT: no such file or directory',
    ];
    expect(readAcpTrouble(raw, stderr).kind).toBe('install');
    // The original stays folded — it is not swapped out for the stderr.
    expect(readAcpTrouble(raw, stderr).detail).toBe(raw);
    // Carried in the error string itself, it is the same kind.
    expect(readAcpTrouble('npm error enoent Could not read package.json').kind).toBe('install');
    // With no stderr this error string still says unknown — nothing is invented.
    expect(readAcpTrouble(raw).kind).toBe('unknown');
  });

  it('install comes before launch, since the same ENOENT calls for different work', () => {
    expect(
      readAcpTrouble(
        "npm error enoent Could not read package.json: ENOENT '/Users/me/.npm/_npx/8757e2301903ae53/package.json'",
      ).kind,
    ).toBe('install');
  });

  it('stderr takes part only in the install verdict, so a passing word never makes another branch', () => {
    expect(readAcpTrouble('acp session closed', ['npm warn network is slow today']).kind).toBe(
      'unknown',
    );
  });

  it('could not get out', () => {
    expect(readAcpTrouble('FetchError: getaddrinfo ENOTFOUND api.example').kind).toBe('network');
  });

  it('**invents nothing** for what it could not recognize', () => {
    const raw = 'Error: something we have never seen';
    expect(readAcpTrouble(raw)).toEqual({ kind: 'unknown', detail: raw });
  });

  it('reads it as auth even when other words mix into an auth problem, since that is the work to do', () => {
    expect(readAcpTrouble('network error: oauth token refresh failed').kind).toBe('auth');
  });
});

describe('choosing diagnostic lines: what always appears is not a diagnosis', () => {
  it('does not include npm warnings (the one the owner first saw on screen)', () => {
    expect(
      isDiagnosticStderr(
        'npm warn Unknown env config "_jsr-registry". This will stop working in the next major version of npm.',
      ),
    ).toBe(false);
    expect(isDiagnosticStderr('npm notice New minor version available')).toBe(false);
  });

  it('does not include install progress or blank lines either', () => {
    expect(isDiagnosticStderr('')).toBe(false);
    expect(isDiagnosticStderr('   ')).toBe(false);
    expect(isDiagnosticStderr('... 42%')).toBe(false);
  });

  it('includes a real clue', () => {
    expect(isDiagnosticStderr('Authentication required')).toBe(true);
    expect(isDiagnosticStderr('Error: Cannot find module @agentclientprotocol/x')).toBe(true);
  });
});

describe('a tool that ran out of plan', () => {
  it('is named as a limit, not a generic problem, so the retry is not pressed into a wall', () => {
    const raw = '{"code":-32603,"message":"Internal error: You\'ve hit your session limit · resets 1am (Asia/Seoul)","data":{"errorKind":"rate_limit"}}';
    expect(readAcpTrouble(raw).kind).toBe('limit');
    expect(readAcpTrouble('429 Too Many Requests').kind).toBe('limit');
    const codex = '{"code":-32603,"message":"Internal error","data":{"message":"You\'ve hit your usage limit. Visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Sep 12th, 2026 1:07 PM.","codexErrorInfo":"usageLimitExceeded"}}';
    expect(readAcpTrouble(codex).kind).toBe('limit');
    // The limit is read before the other kinds: it is the most specific fact about what the
    // person can do next, and the message names the hour it lifts.
  });
});
