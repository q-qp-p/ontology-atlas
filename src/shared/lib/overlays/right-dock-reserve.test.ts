import { describe, expect, it } from 'vitest';

import { floatingRightBound } from './right-dock-reserve';

/**
 * Floating surfaces over the map must stop at the left edge of a right-docked panel, not at
 * `window.innerWidth`.
 */
describe('right-hand wall for floating things', () => {
  it('with no dock the screen edge is the wall, zero regression', () => {
    expect(floatingRightBound(1512, 0)).toBe(1512);
  });

  it('when a dock stands, things stop that far short', () => {
    expect(floatingRightBound(1512, 420)).toBe(1092);
    // Widening the dock moves the wall in by the same amount — this is not a constant.
    expect(floatingRightBound(1512, 968)).toBe(544);
  });

  it('never goes negative even if the dock reports wider than the screen', () => {
    expect(floatingRightBound(800, 1200)).toBe(0);
  });

  it('an unmeasurable value makes no wall', () => {
    expect(floatingRightBound(Number.NaN, 420)).toBe(0);
    expect(floatingRightBound(1512, Number.NaN)).toBe(1512);
  });
});
