import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ICON_SIZE } from '../../../src/shared/ui/tokens/icon-size';
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * Content icon sizes are a numeric JSX prop that value lints cannot see. Runtime-variable icons and
 * conditionals are invisible to this scan, so also measure `svg` in the browser.
 */

const ROOT = process.cwd();
const CSS = readGlobalCss();

/** Returns a ramp token's length in pixels at a 16px root; both `px` and `rem` are read. */
function cssPx(name: string): number {
  const m = CSS.match(new RegExp(`^\\s*${name}\\s*:\\s*([0-9.]+)(px|rem);`, 'm'));
  if (!m) throw new Error(`${name} is missing from app/globals.css`);
  return m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
}

/** Terminates an opening tag by brace depth — the trap the control ratchet stepped on twice. */
/**
 * Comments are blanked before tag parsing, preserving offsets: an apostrophe in a comment inside a JSX
 * opening tag opens a quote that never closes and the parser runs past the tag.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function openingTag(source: string, from: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (c === quote && source[i - 1] !== '\\') quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return source.slice(from, i);
  }
  return source.slice(from, from + 2000);
}

interface IconScan {
  /** Number of lucide opening tags (the denominator for the idling guard). */
  total: number;
  /** Off-ramp size literals per file (`size={N}` prop plus `size-N`/`h-N w-N` classes). */
  offRamp: Map<string, number>;
  /** Unspecified sizes per file (lucide renders those at its 24px default). */
  unsized: Map<string, number>;
}

/**
 * The size of an `icon={...}` slot is owned by the consumer: slots of the listed primitives set
 * `[&>svg]:size-` in CSS, so they do not count as unspecified. Unknown consumers still count.
 */
const SIZED_SLOT_OWNERS = new Set(['ChromeChip', 'ChromeTile', 'EmptyState']);

function slotOwner(source: string, tagIndex: number): string | null {
  const before = source.slice(0, tagIndex);
  if (!/icon=\{\s*$/.test(before)) return null;
  let owner: string | null = null;
  for (const m of before.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) owner = m[1];
  return owner;
}

function scanSource(rel: string, raw: string, ramp: Set<number>, acc: IconScan): void {
  // Tag parsing below must not see comment text — see `stripComments`.
  const source = stripComments(raw);
  // [^}] already spans newlines, so no /s flag is needed. Do not write it as
  // [\s\S]*? — the lazy quantifier swallows past another module's import and
  // contaminates the icon name set (it did, in a full scan: 9 files were silently
  // misclassified).
  /* Match both quote styles of the lucide import; a lazy `[\s\S]*?` would swallow other imports. */
  const importMatch = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/.exec(source);
  if (!importMatch) return;
  const lucide = new Set(
    importMatch[1]
      .split(',')
      .map((n) => n.trim().split(/\s+as\s+/).pop()?.trim() ?? '')
      .filter(Boolean),
  );
  for (const tagMatch of source.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
    if (!lucide.has(tagMatch[1])) continue;
    acc.total += 1;
    const tag = openingTag(source, tagMatch.index ?? 0);
    const prop = /\bsize=\{(\d+)\}/.exec(tag);
    const cls = /\bsize-(\d+(?:\.\d)?)\b/.exec(tag) ?? /\bh-(\d+(?:\.\d)?)\s+w-\1\b/.exec(tag);
    if (prop) {
      if (!ramp.has(Number(prop[1]))) acc.offRamp.set(rel, (acc.offRamp.get(rel) ?? 0) + 1);
    } else if (cls) {
      if (!ramp.has(Number(cls[1]) * 4)) acc.offRamp.set(rel, (acc.offRamp.get(rel) ?? 0) + 1);
    } else if (!tag.includes('size=') && !tag.includes('size-[') && !tag.includes('h-[')) {
      const owner = slotOwner(source, tagMatch.index ?? 0);
      if (owner !== null && SIZED_SLOT_OWNERS.has(owner)) continue;
      acc.unsized.set(rel, (acc.unsized.get(rel) ?? 0) + 1);
    }
  }
}

function scanProduction(ramp: Set<number>): IconScan {
  const acc: IconScan = { total: 0, offRamp: new Map(), unsized: new Map() };
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules' || name === '.next') continue;
        walk(p);
      } else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) {
        scanSource(path.relative(ROOT, p), readFileSync(p, 'utf8'), ramp, acc);
      }
    }
  };
  for (const root of ['src', 'app']) walk(path.join(ROOT, root));
  return acc;
}

/**
 * A literal ledger, not derived from the scan, so "it never grows" can fail. Listed files are debt,
 * not exemptions; delete a row when it reaches 0.
 */
const OFF_RAMP_DEBT: ReadonlyArray<readonly [string, number]> = [
  // An empty ledger does not idle the checks: the scanner still sweeps the repository and counts
  // the denominator, so one new off-ramp value fails as exceeding 0.
];

/**
 * Empty because an `icon={...}` slot is sized by its container (`SIZED_SLOT_OWNERS` plus the
 * CSS assertion on those primitives). A stray unspecified icon elsewhere fails.
 */
const UNSIZED_DEBT: ReadonlyArray<readonly [string, number]> = [];

describe('content icon size ramp', () => {
  const ramp = new Set<number>(Object.values(ICON_SIZE));

  it('the CSS ramp (--icon-*) and the JS mirror (ICON_SIZE) are the same value', () => {
    expect(cssPx('--icon-sm')).toBe(ICON_SIZE.sm);
    expect(cssPx('--icon-md')).toBe(ICON_SIZE.md);
    expect(cssPx('--icon-lg')).toBe(ICON_SIZE.lg);
  });

  it('the mirror name set stays within 3 steps (sm/md/lg), and adding a step starts with the ledger', () => {
    expect(Object.keys(ICON_SIZE).sort()).toEqual(['lg', 'md', 'sm']);
  });

  it('ramp steps stand on their partner of the type ramp: sm is about label/body, md=body-lg, lg=title', () => {
    // If the pairing is redefined (a type ramp revision), this assertion forces a re-decision.
    expect(ICON_SIZE.md).toBe(cssPx('--text-body-lg'));
    expect(ICON_SIZE.lg).toBe(cssPx('--text-title'));
    expect(ICON_SIZE.sm).toBeGreaterThan(cssPx('--text-label'));
    expect(ICON_SIZE.sm).toBeLessThan(cssPx('--text-body-lg'));
  });

  const scan = scanProduction(ramp);

  it('the detector does not spin idle, since it really consumes the product', () => {
    // Floor so that a vanished scan target cannot read as zero violations.
    expect(scan.total).toBeGreaterThanOrEqual(120);
  });

  it('size literals outside the ramp cannot exceed the ledger, and a new file is 0 from day one', () => {
    const ledger = new Map(OFF_RAMP_DEBT);
    const over: string[] = [];
    for (const [file, count] of scan.offRamp) {
      const allowed = ledger.get(file) ?? 0;
      if (count > allowed) over.push(`${file}: ${count} > ledger ${allowed}`);
    }
    expect(over, 'icon sizes outside the ramp increased; use ICON_SIZE (12/14/16), or convene the type system group and add to the ledger if a new step is needed').toEqual([]);
  });

  it('a line whose count is back to 0 is deleted, since a ledger more generous than the measurement loosens the ratchet', () => {
    const stale: string[] = [];
    for (const [file, allowed] of OFF_RAMP_DEBT) {
      const actual = scan.offRamp.get(file) ?? 0;
      if (actual < allowed) stale.push(`${file}: ledger ${allowed} > measured ${actual}; lower the ledger to ${actual}`);
    }
    expect(stale).toEqual([]);
  });

  it('unsized lucide (default 24px) cannot exceed the ledger', () => {
    const ledger = new Map(UNSIZED_DEBT);
    const over: string[] = [];
    for (const [file, count] of scan.unsized) {
      const allowed = ledger.get(file) ?? 0;
      if (count > allowed) over.push(`${file}: ${count} > ledger ${allowed}`);
    }
    expect(over, 'unsized lucide increased; the default 24 is an omission rather than a choice').toEqual([]);
    const stale: string[] = [];
    for (const [file, allowed] of UNSIZED_DEBT) {
      const actual = scan.unsized.get(file) ?? 0;
      if (actual < allowed) stale.push(`${file}: ledger ${allowed} > measured ${actual}`);
    }
    expect(stale).toEqual([]);
  });

  /**
   * **The slot exemption holds only while the consumer really owns the size.** If
   * the classification trusted the `SIZED_SLOT_OWNERS` names alone, the day
   * `[&>svg]:size-*` is deleted from one of those primitives every slot icon would
   * fall back to 24px with nothing turning red. So the name set and the real CSS are
   * tied together here.
   */
  it('a slot owner really owns the svg size of its slot ([&>svg]:size-*)', () => {
    const OWNER_FILES: Record<string, string> = {
      ChromeChip: 'src/shared/ui/controls/chrome-chip.tsx',
      ChromeTile: 'src/shared/ui/controls/chrome-tile.tsx',
      EmptyState: 'src/shared/ui/status/empty-state.tsx',
    };
    expect(Object.keys(OWNER_FILES).sort()).toEqual([...SIZED_SLOT_OWNERS].sort());
    for (const [owner, rel] of Object.entries(OWNER_FILES)) {
      const src = readFileSync(path.join(ROOT, rel), 'utf8');
      expect(
        src.includes('[&>svg]:size-'),
        `${owner}(${rel}) lost the slot svg size, which breaks the premise of the slot exemption (SIZED_SLOT_OWNERS)`,
      ).toBe(true);
    }
  });

  /*
   * ── Standing probes: is the detector itself alive? Synthetic sources are fed to
   * the same function. (The gate-probe discipline: prove the detector consumes real
   * defects, not merely that violations exist.)
   */
  it('probe: props and classes outside the ramp are caught, while ramp values, string sizes and non-lucide pass', () => {
    const probe = (body: string): IconScan => {
      const acc: IconScan = { total: 0, offRamp: new Map(), unsized: new Map() };
      scanSource(
        'probe.tsx',
        `import { Check, Search } from 'lucide-react';\nimport { Select } from './x';\n${body}`,
        ramp,
        acc,
      );
      return acc;
    };
    // Violation — off-ramp numeric prop (also exercises multi-line tags and callback braces)
    const bad = probe('<Check\n  size={13}\n  onClick={() => {}}\n/>');
    expect(bad.offRamp.get('probe.tsx')).toBe(1);
    // Violation — off-ramp class notation
    expect(probe('<Check className="h-5 w-5" />').offRamp.get('probe.tsx')).toBe(1);
    // Healthy — the three ramp values
    const good = probe('<Check size={12} /><Check size={14} /><Search size={16} />');
    expect(good.offRamp.size).toBe(0);
    expect(good.total).toBe(3);
    // Healthy — ramp class notation (size-3 = 12px)
    expect(probe('<Check className="size-3" />').offRamp.size).toBe(0);
    // Unspecified — caught as the 24px default
    expect(probe('<Check aria-hidden />').unsized.get('probe.tsx')).toBe(1);
    // Unspecified in a slot — not unspecified when the slot belongs to a size-owning primitive
    const owned = probe('<ChromeChip icon={<Check aria-hidden />} />');
    expect(owned.unsized.size).toBe(0);
    expect(owned.total, 'if the slot exemption also erases the denominator, the idle assertion loosens').toBe(1);
    // A slot on an **unknown consumer** still counts as unspecified (the exemption errs toward over-reporting)
    expect(probe('<Mystery icon={<Check aria-hidden />} />').unsized.get('probe.tsx')).toBe(1);
    // Off-ramp literals are still caught inside a slot
    expect(probe('<ChromeChip icon={<Check size={13} />} />').offRamp.get('probe.tsx')).toBe(1);
    // Correctly out of view — numeric size on a non-lucide tag, and string sizes
    expect(probe('<Select size={13} />').total).toBe(0);
    // A token reference is neither unspecified nor a violation
    const varRef = probe('<Check className="size-[var(--icon-sm)]" />');
    expect(varRef.offRamp.size).toBe(0);
    expect(varRef.unsized.size).toBe(0);
  });

  /**
   * Probe with double-quoted imports: probes written with single quotes only would share the
   * scanner's blind spot and prove nothing.
   */
  it('probe: also sees a double-quoted lucide import (reproducing the blindness that missed 73%)', () => {
    const acc: IconScan = { total: 0, offRamp: new Map(), unsized: new Map() };
    scanSource(
      'double.tsx',
      `import { Check } from "lucide-react";\n<Check size={13} />`,
      ramp,
      acc,
    );
    expect(acc.total, 'without seeing double-quoted imports this ratchet does not exist for 73% of the repository').toBe(1);
    expect(acc.offRamp.get('double.tsx')).toBe(1);
  });

  /**
   * **Real coverage — the layer synthetic probes cannot prove.**
   *
   * "Not an empty set" and "sees the whole set" are different. The old denominator
   * assertion (≥120) proved only the former, so it stayed green while the scanner
   * skipped 73% of the files. This assertion checks that icons are actually being
   * counted in **both notations that exist in the repository**.
   */
  it('real coverage: counts icons in files of both quote styles', () => {
    const seen = { single: 0, double: 0 };
    const walkAll = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === 'node_modules' || name === '.next') continue;
          walkAll(p);
          continue;
        }
        if (!name.endsWith('.tsx') || name.endsWith('.test.tsx')) continue;
        const src = readFileSync(p, 'utf8');
        const acc: IconScan = { total: 0, offRamp: new Map(), unsized: new Map() };
        scanSource(path.relative(ROOT, p), src, ramp, acc);
        if (acc.total === 0) continue;
        if (/from\s*'lucide-react'/.test(src)) seen.single += acc.total;
        else if (/from\s*"lucide-react"/.test(src)) seen.double += acc.total;
      }
    };
    for (const root of ['src', 'app']) walkAll(path.join(ROOT, root));

    expect(seen.single, "0 icons counted in single-quoted files, so the scanner lost one notation").toBeGreaterThan(50);
    expect(seen.double, "0 icons counted in double-quoted files, so the old blindness came back").toBeGreaterThan(50);
  });

  it('probe: fails when the scan root is an empty set', () => {
    const acc: IconScan = { total: 0, offRamp: new Map(), unsized: new Map() };
    scanSource('empty.tsx', '', ramp, acc);
    expect(acc.total).toBe(0); // Empty source is 0 — the denominator assertion (≥120) above blocks empty-set idling
  });
});
