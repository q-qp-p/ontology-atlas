import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * Scope gate for the control-height ladder: `control-class.contract.test.ts` sees only the string
 * `controlClass()` emits, so places outside the value layer where a chrome token owns the dimension
 * are held here. Source table: `docs/DESIGN-SYSTEM.md`.
 */
describe('control height ladder — scope of application', () => {
  const GLOBALS = readGlobalCss();

  /** The first `--name: <value>;` declaration. Multi-line values (`max(\n …\n)`) read as one. */
  const cssVar = (name: string): string | undefined =>
    new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(GLOBALS)?.[1].trim();

  /**
   * Extracts the **base px** from a value. This app's dimension tokens take only
   * three forms:
   *   `36px` · `max(36px, var(--touch-target-min))` · `calc(32px * var(--scale))`
   * All three are "base value + promotion/scale", so the thing judged is the **first
   * px literal**. The promotion ceiling (44) and the scale factor are carried by their
   * own contracts (the touch-target e2e and the map zoom).
   */
  function basePx(value: string): number | null {
    const px = /(\d+(?:\.\d+)?)px/.exec(value);
    return px ? Number(px[1]) : null;
  }

  /** The height vocabulary — derived from the ladder tokens rather than written by hand. */
  function heightVocabulary(): Set<number> {
    const WCAG_TARGET_FLOOR_PX = 24;
    const tokenPx = (name: string): number => {
      const px = basePx(cssVar(name) ?? '');
      expect(px, `could not read \`${name}\` as px — the vocabulary cannot be derived`).not.toBeNull();
      return px as number;
    };
    const vocabulary = new Set([
      WCAG_TARGET_FLOOR_PX,
      tokenPx('--control-h-sm'),
      tokenPx('--control-h-md'),
      tokenPx('--chrome-tile-size'),
      tokenPx('--control-h-lg'),
      tokenPx('--touch-target-min'),
    ]);
    // If tokens converge and the vocabulary shrinks, the derivation itself loses its
    // signal.
    expect([...vocabulary].sort((a, b) => a - b), 'the height vocabulary is not six steps').toEqual([
      24, 28, 32, 36, 40, 44,
    ]);
    return vocabulary;
  }

  /** Every `--*-tile-size` and `--*-tile-height` declaration. (width is not a height axis.) */
  const TILE_DIMENSION_DECL = /^[ \t]*(--[a-z0-9-]*tile-(?:size|height))\s*:\s*([^;]+);/gm;

  function tileDimensionOffenders(css: string, vocabulary: Set<number>): string[] {
    const offenders: string[] = [];
    for (const match of css.matchAll(TILE_DIMENSION_DECL)) {
      const [, name, value] = match;
      const px = basePx(value);
      if (px === null) {
        offenders.push(`${name}: could not read the default px — \`${value.replace(/\s+/g, ' ')}\``);
        continue;
      }
      if (!vocabulary.has(px)) {
        offenders.push(`${name}: ${px}px is outside the height vocabulary`);
      }
    }
    return offenders;
  }

  it('every default of the tile size tokens is inside the height vocabulary — the hole 34 was born in', () => {
    const vocabulary = heightVocabulary();

    // Idling guard — a scan returning 0 means a broken regex or path, not "no
    // violations".
    const scanned = [...GLOBALS.matchAll(TILE_DIMENSION_DECL)];
    expect(
      scanned.length,
      'could not count a single tile size declaration — the selector or file path broke',
    ).toBeGreaterThanOrEqual(3);
    // **Both** the base declaration and the coarse promotion must be caught (blocking
    // the accident where only the promotion is off-vocabulary).
    expect(
      scanned.filter(([, , value]) => value.includes('max(')).length,
      'the coarse promotion declaration was missed by the scan — multi-line values are being skipped',
    ).toBeGreaterThan(0);

    expect(
      tileDimensionOffenders(GLOBALS, vocabulary),
      'a tile size token is off the ladder. If a new value is needed, fix the ladder table instead of adding an axis.',
    ).toEqual([]);
  });

  it('a vertically stacked control puts its **inner tile** on the ladder — the outer total is not the ladder\'s business', () => {
    /*
     * Nav rail items render at **62px** on every route (measured at 1440×900):
     * `py-1.5`(12) + tile 32 + `gap-1`(4) + label line box 14. 62 is not in the
     * vocabulary but it is not a defect — with two vertical axes it is right that
     * **content** decides the height, and pinning the outer total to the ladder would
     * let label length decide the spec, making the ladder break its own first rule
     * ("padding must not decide height").
     *
     * The rule applies to the **inner square tile** instead. That is this assertion.
     */
    const railTile = basePx(cssVar('--app-nav-rail-tile-height') ?? '');
    const controlMd = basePx(cssVar('--control-h-md') ?? '');
    expect(railTile, 'could not read `--app-nav-rail-tile-height` as px').not.toBeNull();
    expect(
      railTile,
      'the inner tile of a vertical control came off the ladder — it must equal `--control-h-md`',
    ).toBe(controlMd);
  });

  it('the document library header tile does not rebuild its own size token', () => {
    /*
     * The way this comes back has exactly this shape: "this one surface needs slightly
     * different density" → a new `--<surface>-tile-size` → the day the chrome token
     * moves, only that value stays behind. The vocabulary gate above catches the value,
     * but **whether the consumer reads the chrome token** is something the source says.
     */
    const source = readFileSync(
      join(process.cwd(), 'src/views/docs-vault/ui/parts/DocsHeaderTile.tsx'),
      'utf8',
    );
    expect(source, 'the document library header tile does not read the chrome size token').toContain(
      'size-[var(--chrome-tile-size)]',
    );
    expect(
      /--docs-header-tile-size\s*\)/.test(source),
      'it references the deleted `--docs-header-tile-size` again',
    ).toBe(false);
  });

  it('the gate really catches violations — probed with three forms and 34', () => {
    const vocabulary = heightVocabulary();

    // Violation — the exact declaration that produced 34.
    expect(
      tileDimensionOffenders('  --docs-header-tile-size: 34px;\n', vocabulary),
    ).toHaveLength(1);
    // Violation — the coarse promotion's **base value** is off-vocabulary (looking at
    // the promotion alone it is 44 and appears fine).
    expect(
      tileDimensionOffenders(
        '  --foo-tile-size: max(\n    34px,\n    var(--touch-target-min)\n  );\n',
        vocabulary,
      ),
      'missed an out-of-vocabulary default inside a multi-line max()',
    ).toHaveLength(1);
    // Violation — the base value of the scale form is off-vocabulary.
    expect(
      tileDimensionOffenders(
        '  --foo-tile-height: calc(30px * var(--topology-ui-scale-factor));\n',
        vocabulary,
      ),
    ).toHaveLength(1);

    // Clean — all three forms pass when they are in the vocabulary.
    expect(
      tileDimensionOffenders(
        [
          '  --a-tile-size: 36px;',
          '  --b-tile-size: max(36px, var(--touch-target-min));',
          '  --c-tile-height: calc(32px * var(--topology-ui-scale-factor));',
          '',
        ].join('\n'),
        vocabulary,
      ),
    ).toEqual([]);

    // Width is not a height axis — nav rail tiles are 38×32 by design (catching it
    // would be a false positive).
    expect(
      tileDimensionOffenders(
        '  --app-nav-rail-tile-width: calc(38px * var(--topology-ui-scale-factor));\n',
        vocabulary,
      ),
      'a width token is being measured against the height vocabulary',
    ).toEqual([]);
  });
});
