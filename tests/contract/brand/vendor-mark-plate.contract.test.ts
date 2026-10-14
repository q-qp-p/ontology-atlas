import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * The light plate under third-party product marks is not widened. The app is a single dark screen;
 * vendor marks can be black, so only the 32px runtime tiles use a light plate. The value must be
 * neutral, have exactly one consumer, and be recorded in the document.
 */

const ROOT = join(import.meta.dirname, '..', '..', '..');
const GLOBALS = readGlobalCss();

const TOKENS = ['--color-vendor-plate', '--color-vendor-plate-edge', '--color-vendor-mark-ink'];

/** Extracts R, G, B from `#rrggbb` or `rgba(r,g,b,a)`. */
function rgb(value: string): [number, number, number] | null {
  const hex = /#([0-9a-f]{6})\b/i.exec(value);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const fn = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  return fn ? [Number(fn[1]), Number(fn[2]), Number(fn[3])] : null;
}

function tokenValue(name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(GLOBALS);
  if (!match) throw new Error(`${name} is missing from app/globals.css`);
  return match[1].trim();
}

/** Every source file under `src/**` and `app/**`. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    // Test files are not consumers — they write the token name in order to **assert**
    // it, so counting them makes this gate catch itself as a violation.
    else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('third-party product mark plate — the exception stays an exception', () => {
  it('the three tokens exist', () => {
    for (const token of TOKENS) expect(tokenValue(token)).toBeTruthy();
  });

  it('both plate and ink are neutral — this exception does not bring in a new colour', () => {
    /*
     * This exception is justified by "the dark-screen rule was inverted in one place",
     * not by "a new colour was introduced". The moment the value leaves neutral that
     * justification disappears, so it is locked here. The only colour entering the screen
     * is the vendor mark's **own** brand colour, and that value lives in generated data
     * rather than in code.
     */
    for (const token of TOKENS) {
      const parsed = rgb(tokenValue(token));
      expect(parsed, `could not read the value of ${token}`).not.toBeNull();
      const [r, g, b] = parsed!;
      expect(
        Math.max(r, g, b) - Math.min(r, g, b),
        `${token} is not neutral — rgb(${r}, ${g}, ${b})`,
      ).toBeLessThanOrEqual(4);
    }
  });

  it('the plate is light and the default ink is dark — that contrast is why this exception exists', () => {
    const [pr] = rgb(tokenValue('--color-vendor-plate'))!;
    const [ir] = rgb(tokenValue('--color-vendor-mark-ink'))!;
    expect(pr, 'if the plate is not light the black mark becomes invisible again').toBeGreaterThan(200);
    expect(ir, 'if the default ink is not dark it is invisible on the light plate').toBeLessThan(60);
  });

  it('the plate is painted in one file only — even with more consumers the picture is one', () => {
    const users = sourceFiles(join(ROOT, 'src'))
      .concat(sourceFiles(join(ROOT, 'app')))
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return TOKENS.some((token) => text.includes(token));
      })
      .map((file) => file.slice(ROOT.length + 1));

    // globals.css always appears, since it is the definition site. The only other file
    // allowed to remain is the one that draws the mark tile.
    /*
     * Exactly one file paints the light plate and every consumer goes through it; a second copy of
     * the painting is what this test must keep catching.
     */
    expect(users.sort()).toEqual(['app/styles/tokens.css', 'src/shared/ui/marks/vendor-mark.tsx']);
  });

  it('brand colours come from generated data, not from code', () => {
    /*
     * Writing colours into the component makes this list live in two places from that
     * day, and the two diverge. Both the artwork and the colour come from one build
     * output.
     */
    const tile = readFileSync(
      join(ROOT, 'src', 'widgets', 'app-settings-menu', 'ui', 'settings-primitives.tsx'),
      'utf8',
    );
    // No hex literal anywhere in an opening tag or inline style. Comments are excluded —
    // a place recording **why** ("they were black through #2D2D2D") is not a value.
    const code = tile.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/#[0-9a-fA-F]{6}\b/);

    const registry = JSON.parse(
      readFileSync(join(ROOT, 'src-tauri', 'src', 'acp-registry.json'), 'utf8'),
    ) as { agents: Array<{ id: string; brandInk: string | null }> };
    const colored = registry.agents.filter((a) => a.brandInk !== null);
    expect(colored.length, 'no confirmed brand colour at all').toBeGreaterThan(0);
    for (const agent of colored) {
      expect(agent.brandInk, `the colour of ${agent.id} is not #RRGGBB`).toMatch(
        /^#[0-9A-Fa-f]{6}$/,
      );
    }
    // Codex deliberately has no colour — the vendor asked that its mark not be
    // distributed.
    const codex = registry.agents.find((a) => a.id === 'codex-acp');
    expect(codex?.brandInk, 'a colour must not be attached to the OpenAI mark').toBeNull();
  });
});
