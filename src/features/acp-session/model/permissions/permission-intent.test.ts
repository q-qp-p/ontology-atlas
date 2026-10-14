import { describe, expect, it } from 'vitest';

import { permissionIntent } from './permission-intent';

describe('says what it is about to do', () => {
  it('separates changing from reading', () => {
    expect(permissionIntent('read')).toBe('read');
    expect(permissionIntent('edit')).toBe('edit');
  });

  it('counts deleting separately, since undoing is the most expensive', () => {
    expect(permissionIntent('delete')).toBe('delete');
  });

  it('counts execution separately, a different kind of permission from touching files', () => {
    expect(permissionIntent('execute')).toBe('execute');
  });

  it('is not shaken by letter case or surrounding whitespace', () => {
    expect(permissionIntent(' Edit ')).toBe('edit');
    expect(permissionIntent('DELETE')).toBe('delete');
  });

  it('reads the same meaning the same when an adapter uses a different word', () => {
    // Variants the ACP adapters actually use. Not invented — the table was widened from measurement.
    expect(permissionIntent('write')).toBe('edit');
    expect(permissionIntent('move')).toBe('edit');
    expect(permissionIntent('fetch')).toBe('read');
    expect(permissionIntent('search')).toBe('read');
  });

  it('**says it does not know** what it does not know; guessing read would err on the most dangerous side', () => {
    expect(permissionIntent('something-new')).toBe('unknown');
    expect(permissionIntent(null)).toBe('unknown');
    expect(permissionIntent(undefined)).toBe('unknown');
    expect(permissionIntent('')).toBe('unknown');
  });

  it('does not fold the "other" branch into read', () => {
    // The adapter failing to classify is not the same statement as "read".
    expect(permissionIntent('other')).toBe('unknown');
  });
});
