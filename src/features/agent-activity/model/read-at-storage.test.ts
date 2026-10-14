import { afterEach, describe, expect, it } from 'vitest';
import {
  LEGACY_UNSCOPED_READ_AT_KEY,
  forgetLegacyUnscopedReadAt,
  readAtStorageKey,
  readReadAt,
  writeReadAt,
} from './read-at-storage';

afterEach(() => {
  window.localStorage.clear();
});

describe('notification read time: a slot per vault', () => {
  it('puts the vault in the key', () => {
    expect(readAtStorageKey('local:alpha')).toBe('atlas.agentActivity.readAt:local:alpha');
  });

  it('leaves other vaults as they are when one vault is marked read', () => {
    writeReadAt('local:alpha', 1_700_000_000_000);

    expect(readReadAt('local:alpha')).toBe(1_700_000_000_000);
    expect(readReadAt('local:bravo')).toBe(0);
  });

  it('treats the two samples as different slots too, the very axis vaultScopeKey lumps together', () => {
    writeReadAt('sample:dogfood', 42);

    expect(readReadAt('sample:dogfood')).toBe(42);
    expect(readReadAt('sample:storefront')).toBe(0);
  });

  it('does not read the old global key, since it is unknown which vault it belonged to', () => {
    window.localStorage.setItem(LEGACY_UNSCOPED_READ_AT_KEY, '999');

    expect(readReadAt('local:alpha')).toBe(0);
  });

  it('clears the old global key once', () => {
    window.localStorage.setItem(LEGACY_UNSCOPED_READ_AT_KEY, '999');
    forgetLegacyUnscopedReadAt();

    expect(window.localStorage.getItem(LEGACY_UNSCOPED_READ_AT_KEY)).toBeNull();
  });
});
