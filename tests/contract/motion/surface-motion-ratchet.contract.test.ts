import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  censusAppearingSurfaces,
  censusHardCuts,
  MOTION_MECHANISMS,
  walkTsx,
} from '../lib/surface-motion-census';
import { judgeRatchet } from '../lib/ratchet-base';

/**
 * Hard-cut surfaces can never grow. The census walks all of `src/` and `app/`, not a registry, so an
 * empty list cannot make zero a truth about nothing; the probes below prove the scanner is alive.
 */

/**
 * **A literal — not derived from the inventory.**
 *
 * The old `BASELINE = HARD_CUT_REGISTRY.length` made "it never grows" **impossible to
 * fail in principle** (adding a row raised the baseline with it). The control ratchet
 * pinned both its baselines as literals to avoid inheriting that defect, and the same
 * applies here — registering a new hard cut requires raising this number **by hand**,
 * and that diff is where the "why" goes.
 */
const BASELINE_HARD_CUTS = 0;

/**
 * The total of openable surfaces, also the denominator of `tests/e2e/design-audits/a11y-open-surfaces.spec.ts`.
 * Judged against the merge base (`tests/contract/lib/ratchet-base.ts`); a new surface is a
 * `tests/contract/ratchet-raises/appearing-surfaces/<slug>.json` record. The fallback is never edited.
 */
const APPEARING_SURFACES_FALLBACK = 57;

const SELF = 'tests/contract/motion/surface-motion-ratchet.contract.test.ts';
const FIXTURES = 'tests/fixtures/surface-motion';

const census = censusHardCuts(process.cwd());

describe('enter/exit ratchet over the whole source', () => {
  it('hard cuts do not grow, so a new surface is born carrying its way out', () => {
    expect(
      census.length,
      `Surfaces that appear conditionally with no way out grew from ${BASELINE_HARD_CUTS} to ${census.length}.\n` +
        `Wrapping in \`<Surface open={…}>\` brings the exit window, exit class, inert and focus return by default.\n` +
        `If this debt truly cannot be paid, raise BASELINE_HARD_CUTS by hand and say why in that diff.\n` +
        census.map((c) => `  [${c.kind}] ${c.what} — ${c.at.join(' · ')}`).join('\n'),
    ).toBeLessThanOrEqual(BASELINE_HARD_CUTS);
  });

  it('when one is paid off the baseline goes down too, leaving no free slack', () => {
    expect(
      census.length,
      `Hard cuts fell from ${BASELINE_HARD_CUTS} to ${census.length}. Lower this file's BASELINE_HARD_CUTS ` +
        `to ${census.length} as well; otherwise the difference stays as room to get worse again.`,
    ).toBeGreaterThanOrEqual(BASELINE_HARD_CUTS);
  });

  it('the baseline is a **literal**, since deriving it from the census would make "does not grow" unable to fail', () => {
    expect(
      /const BASELINE_HARD_CUTS = \d+;/.test(readFileSync(SELF, 'utf8')),
      'Setting BASELINE_HARD_CUTS to `census.length` loosens the pawl in both directions (a real defect of the old registry).',
    ).toBe(true);
  });
});

/**
 * **Detector probes** — the `/gate-probe` discipline.
 *
 * The three assertions above run only on "today's numbers", so everything stays green
 * even if the detector dies quietly — one regex matching nothing. That state is
 * indistinguishable on screen from "there are no violations". Here the predicate is
 * aimed at **in both directions**.
 *
 * ⚠️ That is exactly why this round exists, so the probes verify not "the function is
 * alive" but **"it really consumes the whole product"**.
 */
describe('detector probes: what this gate actually catches', () => {
  const addOne = (fixture: string) => censusHardCuts(process.cwd(), ['src', 'app'], [`${FIXTURES}/${fixture}`]);

  it('(1) really consumes the whole source, and does not idle on an empty set', () => {
    /*
     * Aimed at the number of files scanned and the total of entering surfaces, not at a violation
     * existing, so repaying the debt to 0 cannot turn it red.
     */
    const scanned = [...walkTsx(join(process.cwd(), 'src')), ...walkTsx(join(process.cwd(), 'app'))];
    expect(scanned.length, 'if the scanner did not walk the product tree, every number is false').toBeGreaterThan(200);

    const appearing = censusAppearingSurfaces(process.cwd());
    expect(appearing.length, 'zero appearing surfaces means the scanner or the path is broken').toBeGreaterThan(0);
    expect(
      new Set(appearing.map((c) => c.file)).size,
      'if everything came from one file the scan range has collapsed',
    ).toBeGreaterThan(3);
  });

  it('(1-b) converted surfaces do not vanish from the denominator, a defect that blinds the gate as debt is paid', () => {
    /*
     * Converted `<Surface>` sites must stay in the denominator, else 0 hard cuts is indistinguishable from
     * not looking.
     */
    const appearing = censusAppearingSurfaces(process.cwd());
    const converted = appearing.filter((c) => c.what === '<Surface>');
    expect(
      converted.length,
      'no surface converted to `<Surface>` was counted, so detector (0) is dead',
    ).toBeGreaterThan(10);
    expect(
      new Set(converted.map((c) => c.file)).size,
      'if the converted surfaces are in one file only, the scan has collapsed',
    ).toBeGreaterThan(5);
  });

  it('(2) the exact shape the owner planted: catches an unnamed inline overlay', () => {
    const fixture = `${FIXTURES}/InlineOverlay.tsx.fixture`;
    expect(existsSync(fixture), 'if the probe fixture disappears the proof of the detector disappears too').toBe(true);
    const withProbe = addOne('InlineOverlay.tsx.fixture');
    expect(
      withProbe.length,
      'Did not catch `{open && <div className="fixed … z-50">}`, which is exactly the shape the old gate was green on.',
    ).toBe(census.length + 1);
    expect(withProbe.some((c) => c.file.endsWith('InlineOverlay.tsx.fixture') && c.kind === 'inline')).toBe(true);
  });

  it('(3) catches a named surface that the parent draws conditionally', () => {
    const withProbe = addOne('NamedHardCutHost.tsx.fixture');
    expect(withProbe.length).toBe(census.length + 1);
    expect(withProbe.some((c) => c.what === 'ProbeSurfacePanel' && c.kind === 'named')).toBe(true);
  });

  it('(4) does not count a content swap, since if this discriminator dies the gate turns into noise', () => {
    const withProbe = addOne('ContentSwap.tsx.fixture');
    expect(
      withProbe.length,
      'A content swap inside an already mounted container was counted as a hard cut. The gate would then ' +
        'start demanding an exit where there is nothing to fix; three real sites are of this kind.',
    ).toBe(census.length);
  });

  it('(5) lets a surface with the mechanism go, and a converted one that reverts is caught here', () => {
    const converted = [
      'src/widgets/ontology-map/ui/OntologyMapDetailPanel.tsx',
      'src/widgets/vault-agent-panel/ui/VaultAgentPanel.tsx',
      'src/widgets/project-drawer/ui/ProjectDrawer.tsx',
      'src/widgets/search-palette/ui/SearchPalette.tsx',
    ];
    for (const file of converted) {
      expect(existsSync(file), `${file} is gone, so the regression guard dies with it`).toBe(true);
      expect(
        MOTION_MECHANISMS.some((m) => readFileSync(file, 'utf8').includes(m)),
        `the enter/exit mechanism is gone from ${file}; this is a regression even if the census stays within 13`,
      ).toBe(true);
      expect(census.some((c) => c.file === file && c.kind === 'named')).toBe(false);
    }
  });

  it('(7) the **denominator** of openable surfaces does not silently grow, as the input of the accessibility measurement list', () => {
    /*
     * This number is the hard-cut inventory's denominator and also the 19 in
     * `tests/e2e/design-audits/a11y-open-surfaces.spec.ts`'s "measures 5/19". A new surface turns this
     * red first, and that is the moment to also ask **whether that surface is being
     * opened and measured**. Without a denominator, "0 violations on open surfaces" is
     * said without knowing how many were never opened.
     */
    const appearing = censusAppearingSurfaces(process.cwd());
    const verdict = judgeRatchet({
      gate: 'appearing-surfaces',
      measure: (root) => (root === process.cwd() ? appearing : censusAppearingSurfaces(root)).length,
      reads: ['src', 'app'],
      fallback: APPEARING_SURFACES_FALLBACK,
    });
    expect(
      appearing.length,
      `Conditionally appearing surfaces reached ${appearing.length}, over the ceiling ${verdict.ceiling}.\n${verdict.explain}\n` +
        `If you added a surface, check that OPENERS in a11y-open-surfaces.spec.ts has a way to open it,\n` +
        `and name that way in the raise record's why: when the denominator grows silently, nobody notices 5/19 has become 5/30.\n` +
        appearing.map((c) => `  [${c.kind}] ${c.what} — ${c.at[0]}`).join('\n'),
    ).toBeLessThanOrEqual(verdict.ceiling);
    expect(appearing.length, 'hard cuts are a subset of the appearing surfaces').toBeGreaterThanOrEqual(census.length);
  });

  it('(6) the mechanism list is alive, since if it is empty every surface becomes a hard cut', () => {
    expect(MOTION_MECHANISMS.length).toBeGreaterThan(3);
    // An enter-only class is not a mechanism — the missing exit path is the debt this
    // gate counts.
    expect(MOTION_MECHANISMS).not.toContain('map-overlay-in');
    expect(MOTION_MECHANISMS).not.toContain('animate-in');
    expect(MOTION_MECHANISMS).not.toContain('animate-out');
  });
});
