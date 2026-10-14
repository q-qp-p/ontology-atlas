import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Another company's product name is used only in the form they permit. The agent list display names
 * use `Claude Agent`, never `Claude Code`. Sentences naming a separately installed product by its real
 * name are not checked.
 */

const ROOT = join(import.meta.dirname, '..', '..', '..');

interface RegistryAgent {
  id: string;
  name: string;
}

const REGISTRY = JSON.parse(
  readFileSync(join(ROOT, 'src-tauri', 'src', 'acp-registry.json'), 'utf8'),
) as { agents: RegistryAgent[] };

/** Names that must not appear as display names in our list. The authority is each vendor's brand guide. */
const FORBIDDEN_DISPLAY_NAMES = [
  { pattern: /^claude code( agent)?$/i, source: 'Anthropic Claude Agent SDK · Branding guidelines' },
];

describe('third-party product names — only in the form they allow', () => {
  it('the display names in the agent list are not in a forbidden form', () => {
    for (const agent of REGISTRY.agents) {
      for (const rule of FORBIDDEN_DISPLAY_NAMES) {
        expect(
          rule.pattern.test(agent.name.trim()),
          `the display name "${agent.name}" of ${agent.id} is not allowed (${rule.source})`,
        ).toBe(false);
      }
    }
  });

  it('**the copy describing our own list** follows the same rule', () => {
    /*
     * Only the copy describing our own runner list is checked, not all copy: more than 20 legitimate
     * places name someone else's product, and widening the rule would bury the real violation in noise.
     */
    const NAMESPACES = [
      ['nav', 'settingsMenu', 'runtimes'],
      ['topology', 'startSteps', 'agent'],
    ];
    for (const locale of ['ko', 'en']) {
      const catalog = JSON.parse(
        readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8'),
      ) as Record<string, unknown>;
      for (const path of NAMESPACES) {
        let node: unknown = catalog;
        for (const key of path) node = (node as Record<string, unknown>)?.[key];
        const found: string[] = [];
        const walk = (value: unknown, trail: string) => {
          if (typeof value === 'string') {
            if (/claude code/i.test(value)) found.push(`${trail}: ${value}`);
            return;
          }
          if (value && typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) walk(v, `${trail}.${k}`);
          }
        };
        walk(node, `${locale}.${path.join('.')}`);
        expect(
          found,
          'Copy that describes our list of runners uses the same names as the registry ' +
            '(Anthropic Claude Agent SDK · Branding guidelines)',
        ).toEqual([]);
      }
    }
  });

  it('the claude adapter uses the allowed name from the registry as it is', () => {
    const claude = REGISTRY.agents.find((a) => a.id === 'claude-acp');
    expect(claude, 'if claude-acp disappeared from the list it is time to revisit this contract').toBeDefined();
    // Allowed: "Claude Agent", and "Claude" when the list itself is named Agents.
    expect(claude!.name).toMatch(/^Claude( Agent)?$/);
  });

  it('the build script does not overwrite that name again', () => {
    /*
     * Blocks the **path**, not the value. `DISPLAY_NAME` is the only place a display
     * name can be changed, and a claude entry appearing there can break this again at
     * the next update even while the check above passes — and by then nobody is
     * watching.
     */
    const script = readFileSync(join(ROOT, 'scripts', 'registry-snapshots', 'build-acp-registry.mjs'), 'utf8');
    const block = /const DISPLAY_NAME = \{([\s\S]*?)\};/.exec(script);
    expect(block, 'if DISPLAY_NAME disappeared it is time to revisit this contract').not.toBeNull();
    expect(
      /claude/i.test(block![1]),
      'DISPLAY_NAME gained a claude entry — check the brand guide first',
    ).toBe(false);
  });

  it('the rationale remains in the documentation', () => {
    // A rule with no cited source gets reverted by the next person as needless inconvenience.
    const script = readFileSync(join(ROOT, 'scripts', 'registry-snapshots', 'build-acp-registry.mjs'), 'utf8');
    expect(script).toContain('code.claude.com/docs/en/agent-sdk/overview');
  });
});
