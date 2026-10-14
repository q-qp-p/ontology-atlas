import { describe, expect, it } from 'vitest';

import {
  COMPOSER_CEILING_ROWS,
  COMPOSER_MAX_ROWS,
  COMPOSER_MIN_ROWS,
  composerGrowth,
  composerMaxRows,
  composerTopIsHidden,
  snapScrollTop,
} from './composer-growth';

/**
 * Measured dimensions (1512×806, dark, Pretendard 12.5px/20px):
 * padding 8+8, border 1+1, line-height 20 — a two-line box is 58px.
 */
const BASE = { lineHeight: 20, paddingBlock: 16, borderBlock: 2 };
const rowsToContent = (rows: number) => rows * BASE.lineHeight + BASE.paddingBlock;

describe('composerGrowth', () => {
  it('even a one-line text keeps a box of at least two lines', () => {
    const growth = composerGrowth({ ...BASE, contentHeight: rowsToContent(1) });
    expect(growth).toEqual({ height: 58, rows: COMPOSER_MIN_ROWS, overflowing: false });
  });

  it('three lines grow the box to three lines, the sentence the old fixed height used to clip', () => {
    const growth = composerGrowth({ ...BASE, contentHeight: rowsToContent(3) });
    expect(growth).toEqual({ height: 78, rows: 3, overflowing: false });
  });

  it('the cap is six lines, and past it inner scroll takes over instead of the box', () => {
    const at = composerGrowth({ ...BASE, contentHeight: rowsToContent(6) });
    expect(at).toEqual({ height: 138, rows: COMPOSER_MAX_ROWS, overflowing: false });

    const over = composerGrowth({ ...BASE, contentHeight: rowsToContent(9) });
    expect(over).toEqual({ height: 138, rows: COMPOSER_MAX_ROWS, overflowing: true });
  });

  it('at any line count the height is whole lines plus chrome, leaving no room for half a line', () => {
    for (let rows = 1; rows <= 12; rows += 1) {
      const growth = composerGrowth({ ...BASE, contentHeight: rowsToContent(rows) });
      expect(growth).not.toBeNull();
      const text = growth!.height - BASE.paddingBlock - BASE.borderBlock;
      expect(text % BASE.lineHeight).toBe(0);
    }
  });

  it('produces no value when nothing can be measured (SSR, jsdom, before fonts load)', () => {
    expect(composerGrowth({ ...BASE, lineHeight: Number.NaN, contentHeight: 76 })).toBeNull();
    expect(composerGrowth({ ...BASE, contentHeight: 0 })).toBeNull();
    expect(composerGrowth({ ...BASE, lineHeight: 0, contentHeight: 76 })).toBeNull();
  });
});

describe('snapScrollTop', () => {
  it('an off-grid value snaps to the nearest line boundary', () => {
    // Measured defect: a 9px jump in one frame is not a multiple of the 20px line height, so
    // glyphs were sliced in half. 9 is nearer the first line, so it snaps back to it.
    expect(snapScrollTop(9, 20)).toBe(0);
    expect(snapScrollTop(13, 20)).toBe(20);
    expect(snapScrollTop(31, 20)).toBe(40);
  });

  it('a value already on the grid does not move', () => {
    expect(snapScrollTop(0, 20)).toBe(0);
    expect(snapScrollTop(40, 20)).toBe(40);
  });

  it('leaves the value alone when the line height is unknown', () => {
    expect(snapScrollTop(9, 0)).toBe(9);
    expect(snapScrollTop(9, Number.NaN)).toBe(9);
  });
});

describe('composerTopIsHidden', () => {
  it('at the cap but scrolled to the top, nothing is hidden', () => {
    expect(composerTopIsHidden(true, 0)).toBe(false);
  });

  it('true only at the cap and after actually being pushed upward', () => {
    expect(composerTopIsHidden(true, 20)).toBe(true);
  });

  it('while still growing (cap not reached) there is no signal at any scroll value', () => {
    expect(composerTopIsHidden(false, 20)).toBe(false);
  });
});

describe('composer cap, derived from its own height', () => {
  const LINE = 20;

  it('a tall box gets more room than the default', () => {
    // 900px slot: 900 * 0.4 / 20 = 18, clamped to the ceiling of 16.
    expect(composerMaxRows(900, LINE)).toBe(COMPOSER_CEILING_ROWS);
    // 500px slot: 500 * 0.4 / 20 = 10.
    expect(composerMaxRows(500, LINE)).toBe(10);
  });

  it('when the window shrinks the cap shrinks too, so the conversation is not pushed out', () => {
    // 200px slot: 200 * 0.4 / 20 = 4.
    expect(composerMaxRows(200, LINE)).toBe(4);
  });

  it('even a very small box **can grow**, at least one line past its start size', () => {
    expect(composerMaxRows(60, LINE)).toBe(COMPOSER_MIN_ROWS + 1);
  });

  it('falls back to the default cap when it cannot measure', () => {
    expect(composerMaxRows(0, LINE)).toBe(COMPOSER_MAX_ROWS);
    expect(composerMaxRows(Number.NaN, LINE)).toBe(COMPOSER_MAX_ROWS);
    expect(composerMaxRows(900, 0)).toBe(COMPOSER_MAX_ROWS);
  });

  it('actually uses the cap it is given, and inner scroll takes over past it', () => {
    const metrics = {
      lineHeight: LINE,
      paddingBlock: 0,
      borderBlock: 0,
      // Twelve lines of text.
      contentHeight: 12 * LINE,
    };
    expect(composerGrowth(metrics, 12)?.rows).toBe(12);
    expect(composerGrowth(metrics, 12)?.overflowing).toBe(false);
    expect(composerGrowth(metrics)?.rows).toBe(COMPOSER_MAX_ROWS);
    expect(composerGrowth(metrics)?.overflowing).toBe(true);
  });

  it('the box does not shrink even when the cap is below the start size', () => {
    const growth = composerGrowth(
      { lineHeight: LINE, paddingBlock: 0, borderBlock: 0, contentHeight: LINE },
      1,
    );
    expect(growth?.rows).toBe(COMPOSER_MIN_ROWS);
  });
});
