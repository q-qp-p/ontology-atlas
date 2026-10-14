import { describe, expect, it, vi } from 'vitest';

import { resolvePickedVaultFolder } from './resolve-picked-vault-folder';

describe('finding the map inside a picked folder: a person picks a project and expects to see the map', () => {
  const vaultInside = (names: Record<string, string[]>) =>
    vi.fn(async (path: string) => names[path] ?? null);

  it('opens the map inside when a project was picked and holds one', async () => {
    const read = vaultInside({ '/Users/dana/my-product/atlas': ['orders.md', 'billing.md'] });
    const result = await resolvePickedVaultFolder('/Users/dana/my-product', read);

    expect(result.rootPath).toBe('/Users/dana/my-product/atlas');
    // ⚠️ Never silent. Opening a different folder from the one a person chose is only acceptable
    // while the screen says so.
    expect(result.redirected, 'silently opening another folder would not do what the product was told').toBe(true);
  });

  it('opens the picked folder as is when there is no map', async () => {
    const read = vaultInside({});
    const result = await resolvePickedVaultFolder('/Users/dana/plain-vault', read);
    expect(result.rootPath).toBe('/Users/dana/plain-vault');
    expect(result.redirected).toBe(false);
  });

  /*
   * The narrow half of the rule. A project with its own `atlas/` source module would otherwise open
   * an empty vault — the person sees nothing and has no idea why, which is worse than the failure
   * this whole function exists to fix.
   */
  it('does not redirect for a folder that merely shares the name; a map needs Markdown', async () => {
    const read = vaultInside({ '/Users/dana/my-product/atlas': ['index.ts', 'render.ts'] });
    const result = await resolvePickedVaultFolder('/Users/dana/my-product', read);
    expect(result.rootPath, 'opening a source folder as a vault would show an empty map').toBe(
      '/Users/dana/my-product',
    );
    expect(result.redirected).toBe(false);
  });

  it('does not treat an empty atlas folder as a map either', async () => {
    const read = vaultInside({ '/Users/dana/my-product/atlas': [] });
    const result = await resolvePickedVaultFolder('/Users/dana/my-product', read);
    expect(result.redirected).toBe(false);
  });

  it('leaves it alone when the map itself was picked directly', async () => {
    // The picked folder is the vault; there is no `atlas` inside it, so nothing moves.
    const read = vaultInside({});
    const result = await resolvePickedVaultFolder('/Users/dana/my-product/atlas', read);
    expect(result.rootPath).toBe('/Users/dana/my-product/atlas');
    expect(result.redirected).toBe(false);
  });

  it('treats an unreadable folder as "open as is", not an error', async () => {
    const read = vi.fn(async () => {
      throw new Error('permission denied');
    });
    const result = await resolvePickedVaultFolder('/Users/dana/my-product', read);
    expect(result.rootPath).toBe('/Users/dana/my-product');
    expect(result.redirected).toBe(false);
  });

  it('does not let a trailing separator corrupt the path', async () => {
    const read = vaultInside({ '/Users/dana/my-product/atlas': ['a.md'] });
    const result = await resolvePickedVaultFolder('/Users/dana/my-product/', read);
    expect(result.rootPath).toBe('/Users/dana/my-product/atlas');
  });
});
