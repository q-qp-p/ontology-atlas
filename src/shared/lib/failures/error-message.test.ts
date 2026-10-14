import { describe, expect, it } from 'vitest';
import { toErrorMessage } from './error-message';

describe('toErrorMessage', () => {
  it('extracts the message of an Error instance as is', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('keeps a bare string rejection alive (Tauri invoke → Err(String))', () => {
    // The heart of the silent desktop failure: when a Tauri command returns
    // Err(String), the invoke Promise rejects with a string rather than an Error.
    expect(toErrorMessage('No such file or directory (os error 2)')).toBe(
      'No such file or directory (os error 2)',
    );
  });

  it('handles a plain object that has a message property', () => {
    expect(toErrorMessage({ message: 'plain object failure' })).toBe(
      'plain object failure',
    );
  });

  it('drops a whitespace-only message to null so the fallback shows', () => {
    expect(toErrorMessage(new Error('   '))).toBeNull();
    expect(toErrorMessage('   ')).toBeNull();
    expect(toErrorMessage('')).toBeNull();
  });

  it('a meaningless value gives null', () => {
    expect(toErrorMessage(null)).toBeNull();
    expect(toErrorMessage(undefined)).toBeNull();
    expect(toErrorMessage(42)).toBeNull();
    expect(toErrorMessage({ code: 500 })).toBeNull();
  });
});
