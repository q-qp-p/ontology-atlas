import { describe, expect, it } from "vitest";


import {
  FOOTPRINT_MIN_SIZE,
  FOOTPRINT_NODE_RATIO,
  FOOTPRINT_SCALE_RANGE,
  footprintAnchor,
  footprintPairRadius,
  footprintScaleFor,
  footprintSizeFor,
  formatStepNumbers,
} from "./footprint-glyph";

/**
 * The print is capped by a ratio to the node it marks, so a print scaling with the square root of
 * zoom cannot outgrow a node shrinking linearly. This gate locks the ratio, not pixels.
 */
describe("footprintSizeFor never lets a footprint outgrow its node", () => {
  it("on a large node the default size is used as is, leaving untroubled spots alone", () => {
    // Domain radius 17px gives a cap of 18.9, above the base 13 — nothing is clamped.
    expect(footprintSizeFor(13, 17)).toBe(13);
  });

  it("on a small node it is clipped to the node radius", () => {
    const size = footprintSizeFor(13, 7);
    expect(footprintPairRadius(size)).toBeCloseTo(FOOTPRINT_NODE_RATIO * 7, 5);
  });

  it("does not drop below the lower bound even when zoomed far out, since a vanished footprint cannot say that someone walked here", () => {
    expect(footprintSizeFor(13, 0.4)).toBe(FOOTPRINT_MIN_SIZE);
  });

  it("the ratio to the node never exceeds 2.5 across the whole range", () => {
    for (const cameraScale of [1, 0.8, 0.6, 0.4, 0.3, 0.2]) {
      const k = footprintScaleFor(cameraScale);
      const nodeRadius = 7 * cameraScale;
      const ratio = footprintPairRadius(footprintSizeFor(13 * k, nodeRadius)) / nodeRadius;
      expect(ratio).toBeLessThanOrEqual(2.5);
    }
  });

  it("falls back to the default size when the node radius is missing or odd", () => {
    expect(footprintSizeFor(13, 0)).toBe(13);
    expect(footprintSizeFor(13, Number.NaN)).toBe(13);
  });
});



describe("formatStepNumbers", () => {
  it("three or fewer are joined as they are", () => {
    expect(formatStepNumbers([1])).toBe("1");
    expect(formatStepNumbers([1, 3, 5])).toBe("1·3·5");
  });

  /**
   * Abbreviating without the total erases "I keep coming back here" — the very fact this
   * notation carries, which makes it loss rather than abbreviation.
   */
  it("four or more are shortened and keep the total count alongside", () => {
    expect(formatStepNumbers([1, 3, 5, 9])).toBe("1·…·9 (총 4회)");
  });

  it("an empty list gives an empty string", () => {
    expect(formatStepNumbers([])).toBe("");
  });
});

/** `gap` must measure to the print's edge, not its centre: overlap is an edge condition. */
describe("footprintAnchor does not overlap the node", () => {
  it.each([
    [13, 8, 13],
    [26, 8, 13],
    [17, 0, 26],
    [40, 0, 9],
  ])("node radius %d, margin %d, footprint %d", (nodeRadius, gap, size) => {
    const at = footprintAnchor(0, 0, nodeRadius, gap, size);
    const centerDistance = Math.hypot(at.x, at.y);
    const clearance = centerDistance - nodeRadius - footprintPairRadius(size);
    expect(clearance, `dug into the node (clearance ${clearance.toFixed(2)}px)`).toBeGreaterThanOrEqual(gap - 1e-6);
  });

  it("sits in the upper-right quadrant, away from the label", () => {
    const at = footprintAnchor(100, 100, 13, 8, 13);
    expect(at.x).toBeGreaterThan(100);
    expect(at.y).toBeLessThan(100);
  });
});

/**
 * Overlap is worst when zoomed out, so prints shrink with zoom rather than staying at a fixed pixel
 * size.
 */
describe("footprintScaleFor", () => {
  it("at scale 1 it is the original size", () => {
    expect(footprintScaleFor(1)).toBeCloseTo(1, 6);
  });

  it("the footprint shrinks as the map zooms out, monotonically", () => {
    const samples = [0.05, 0.2, 0.5, 1, 2].map(footprintScaleFor);
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });

  it("stops at the lower bound, since a single dot cannot say that someone walked here", () => {
    expect(footprintScaleFor(0.0001)).toBe(FOOTPRINT_SCALE_RANGE.min);
    expect(footprintScaleFor(9999)).toBe(FOOTPRINT_SCALE_RANGE.max);
  });

  it("does not erase the footprint on a broken scale", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(footprintScaleFor(bad)).toBeGreaterThan(0);
    }
  });
});

