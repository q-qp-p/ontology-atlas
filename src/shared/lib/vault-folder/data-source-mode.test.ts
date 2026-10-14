import { describe, expect, it } from 'vitest';
import { getDataSourceMode } from './data-source-mode';

describe('getDataSourceMode', () => {
  it('vault loaded gives local (the user disk is the source of truth)', () => {
    expect(getDataSourceMode({ vaultLoaded: true })).toBe('local');
  });

  it('no vault selected gives static (build-time dogfood manifest)', () => {
    expect(getDataSourceMode({ vaultLoaded: false })).toBe('static');
  });
});
