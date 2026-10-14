import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Whether the snapshot is current needs the network and is not checked here; what is guarded is that
 * `pnpm acp:registry:check` stays on the release path. It runs at release, not per PR, because it goes
 * red when upstream publishes and would randomly block unrelated PRs.
 */

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const workflow = readFileSync(
  path.join(repoRoot, '.github', 'workflows', 'release-macos.yml'),
  'utf8',
);

/**
 * Keeps only lines that actually **execute** — comments (`#`) are dropped.
 *
 * ⚠️ **The first version was a fake gate** (caught by a probe the same day). It
 * searched the whole file for a string, and this workflow's **comments** also contain
 * the command name (explaining why the step is there), so **deleting the step still
 * passed.** What the check measures is whether it executes, not whether the
 * characters appear somewhere.
 */
const executableLines = workflow
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
) as { scripts?: Record<string, string> };

describe('ACP registry freshness before release', () => {
  it('the check script exists', () => {
    expect(manifest.scripts?.['acp:registry:check']).toBeDefined();
    // Registered without `--check` it is an **overwrite**, not a check — running that on
    // the release path silently updates and passes.
    expect(manifest.scripts?.['acp:registry:check']).toContain('--check');
  });

  it('the release workflow really calls that check', () => {
    expect(
      /run:\s*pnpm acp:registry:check/.test(executableLines),
      'Nothing on the release path asks whether the registry is fresh. ' +
        'This script once existed with no caller, and nine entries went stale meanwhile',
    ).toBe(true);
  });

  it('asks **before** the build, since asking after building wastes time', () => {
    const checkAt = executableLines.search(/run:\s*pnpm acp:registry:check/);
    const buildAt = executableLines.indexOf('build-macos:');
    expect(checkAt).toBeGreaterThan(-1);
    expect(buildAt).toBeGreaterThan(-1);
    expect(checkAt, 'the freshness check comes after the build job').toBeLessThan(buildAt);
  });

  it('the checker does not spin idle, since it really read the workflow', () => {
    // If the file cannot be read or its path changes, every test above can pass silently.
    expect(executableLines).toContain('admit-release:');
    expect(executableLines.length).toBeGreaterThan(2000);
    // Content must remain after comments are stripped — an over-eager filter collapses
    // every test above into silent passing.
    expect(executableLines).toContain('pnpm desktop:release-tag');
  });
});
