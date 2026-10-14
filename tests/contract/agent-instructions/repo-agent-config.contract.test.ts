import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `ontology-atlas init` rewrites `.mcp.json` and `.codex/config.toml` with the current vault path, so
 * committing them here would leave one person absolute path. Nothing may point outside the repository.
 */

const ROOT = process.cwd();

/** Shapes that only mean something on one person's machine. */
const MACHINE_SPECIFIC = [
  { pattern: /\/Users\//, why: 'macOS home path — absent on anyone else\'s computer' },
  { pattern: /\/home\//, why: 'Linux home path — absent on anyone else\'s computer' },
  { pattern: /[A-Z]:\\\\/, why: 'Windows absolute path' },
  { pattern: /\/private\/tmp\/|\/tmp\//, why: 'temporary folder — meaningless once deleted' },
  { pattern: /scratchpad/, why: 'working temporary folder' },
  { pattern: /\.\.\/\.\.\/\.\./, why: 'climbs three or more levels out of the repository' },
];

const FILES = ['.mcp.json', '.codex/config.toml'] as const;

describe('connection settings the repository commits — work on anyone\'s computer', () => {
  for (const file of FILES) {
    it(`${file} has no path known only to one person's computer`, () => {
      const text = readFileSync(join(ROOT, file), 'utf8');
      const hits = MACHINE_SPECIFIC.filter(({ pattern }) => pattern.test(text)).map(
        ({ pattern, why }) => `${pattern} — ${why}`,
      );
      expect(
        hits,
        `${file} holds values that only work on this computer:\n  ${hits.join('\n  ')}\n` +
          '`init` and Connect agent rewrite this file automatically. If you ran them inside this repository, ' +
          'revert it before committing: `.mcp.json.example` is the canonical copy.',
      ).toEqual([]);
    });
  }

  it('both files point at the same vault — tools do not see different maps', () => {
    const mcp = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8')) as {
      mcpServers: Record<string, { env?: Record<string, string> }>;
    };
    const codex = readFileSync(join(ROOT, '.codex/config.toml'), 'utf8');
    const mcpVault = mcp.mcpServers['ontology-atlas']?.env?.OATLAS_VAULT;
    const codexVault = /OATLAS_VAULT\s*=\s*"([^"]+)"/.exec(codex)?.[1];

    expect(mcpVault, '.mcp.json has no vault path').toBeTruthy();
    expect(codexVault, '.codex/config.toml has no vault path').toBeTruthy();
    expect(
      codexVault,
      'The Claude side and the Codex side point at different folders, so in one repository the two tools ' +
        'read different maps',
    ).toBe(mcpVault);
  });

  it('the vault pointed at really exists inside this repository', () => {
    const mcp = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8')) as {
      mcpServers: Record<string, { env?: Record<string, string> }>;
    };
    const vault = mcp.mcpServers['ontology-atlas']?.env?.OATLAS_VAULT ?? '';
    // Must be a relative path, and a vault must really be at that location.
    expect(vault.startsWith('.'), `the vault path is not relative: ${vault}`).toBe(true);
    // Existence, stated as existence: a `.length > 0` check only fires if someone empties the file.
    expect(existsSync(join(ROOT, vault, 'README.md')), `no vault at ${vault}`).toBe(true);
  });
});
