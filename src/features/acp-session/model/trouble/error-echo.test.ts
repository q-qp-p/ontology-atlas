import { describe, expect, it } from 'vitest';

import { isErrorEcho, withoutErrorEcho } from './error-echo';

const AGENT_ECHO = 'Failed to authenticate: OAuth session expired and could not be refreshed';
const RPC_ERROR =
  '{"code":-32603,"message":"Internal error: Failed to authenticate: OAuth session expired and could not be refreshed","data":{"errorKind":"authentication_failed"}}';

const agent = (text: string) => ({ kind: 'agent' as const, id: 'a', text });

describe('error repetition: the same failure is not said twice', () => {
  it('treats the measured pair as an echo', () => {
    expect(isErrorEcho(AGENT_ECHO, RPC_ERROR)).toBe(true);
  });

  it('removes the last line, since the card already says the same in human words', () => {
    const events = [
      { kind: 'user' as const, id: 'u', text: '물어봄' },
      agent(AGENT_ECHO),
    ];
    expect(withoutErrorEcho(events, RPC_ERROR)).toEqual([events[0]]);
  });

  it('does not remove a genuine answer', () => {
    const events = [agent('내 프로젝트 노드는 예시 영역을 담고 있어요.')];
    expect(withoutErrorEcho(events, RPC_ERROR)).toEqual(events);
  });

  it('removes nothing when there is no error', () => {
    const events = [agent(AGENT_ECHO)];
    expect(withoutErrorEcho(events, null)).toEqual(events);
  });

  it('does not remove a short remark even if it happens to be contained', () => {
    // `Error` is contained in any error text. Starting to erase what the agent said for that reason is
    // not echo removal but censorship.
    expect(isErrorEcho('Error', RPC_ERROR)).toBe(false);
    expect(isErrorEcho('authenticate', RPC_ERROR)).toBe(false);
  });

  it('leaves it alone when the last event is not words from the agent', () => {
    const events = [
      agent(AGENT_ECHO),
      { kind: 'user' as const, id: 'u', text: '다시 해줘' },
    ];
    expect(withoutErrorEcho(events, RPC_ERROR)).toEqual(events);
  });

  it('keeps an old error echo in the middle, since it was the words of that moment then', () => {
    const events = [
      agent(AGENT_ECHO),
      { kind: 'user' as const, id: 'u', text: '다시' },
      agent('이제 됐어요. 두 노드는 포함 관계예요.'),
    ];
    expect(withoutErrorEcho(events, RPC_ERROR)).toEqual(events);
  });

  it('is not shaken by line-break and whitespace differences, since adapters wrap at different widths', () => {
    expect(isErrorEcho(`Failed to authenticate:\n  OAuth session expired and could not be refreshed`, RPC_ERROR)).toBe(true);
  });

  it('passes an empty list and odd values through unchanged', () => {
    expect(withoutErrorEcho([], RPC_ERROR)).toEqual([]);
    expect(isErrorEcho(undefined, RPC_ERROR)).toBe(false);
    expect(isErrorEcho(AGENT_ECHO, undefined)).toBe(false);
  });
});
