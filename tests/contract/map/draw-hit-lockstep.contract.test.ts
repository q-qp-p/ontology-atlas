import { describe, expect, it } from "vitest";

import {
  HITTABLE_MIN_TIER_ALPHA,
  isNodeHittable,
  type HittableNodeInput,
} from "@/widgets/ontology-map/model/visibility/tier-visibility";

/**
 * Draw and hit read the same value: hit reads the alpha map draw already builds, so they cannot
 * drift when a channel is added. If a node is drawn, it is hittable.
 */

const node = (id: string, kind: HittableNodeInput["kind"] = "element"): HittableNodeInput => ({
  id,
  kind,
  isHub: false,
});

/** Overview-entry zoom — the element/capability tiers are not open yet. */
const OVERVIEW_ZOOM = 1;

describe("draw/hit lockstep contract", () => {
  it("a node the draw lets through is hit whatever the channel is", () => {
    // Not enumerating channel names is the point — a value in the map is enough. A
    // sixth or seventh channel needs no edit here, and that is the evidence for
    // "cannot drift structurally".
    for (const alpha of [0.5, 0.75, 1]) {
      const drawn = new Map([["n", alpha]]);
      expect(
        isNodeHittable(node("n"), OVERVIEW_ZOOM, null, undefined, undefined, undefined, null, drawn),
        `alpha=${alpha}`,
      ).toBe(true);
    }
  });

  it("any alpha the draw paints is hittable, so what is drawn can be hit", () => {
    // A node is not painted at these alphas unless something deliberately revealed it, and a deliberate
    // reveal must answer the pointer, so every value in this band is hittable.
    for (const alpha of [0.03, 0.2, 0.49]) {
      const drawn = new Map([["n", alpha]]);
      expect(
        isNodeHittable(node("n"), OVERVIEW_ZOOM, null, undefined, undefined, undefined, null, drawn),
        `alpha=${alpha}`,
      ).toBe(true);
    }
  });

  it("the floor equals the value at which the draw paints nothing, one number rather than two", () => {
    // The draw pass skips at `alpha <= HITTABLE_MIN_TIER_ALPHA`, so the first
    // alpha that paints is the first alpha that answers the pointer. A future
    // edit that raises this floor without narrowing the reveal bands re-opens the
    // band and fails the sweep in `model/visibility/tier-visibility.test.ts`.
    expect(HITTABLE_MIN_TIER_ALPHA).toBe(0.02);
    const atFloor = new Map([["n", HITTABLE_MIN_TIER_ALPHA]]);
    expect(
      isNodeHittable(node("n"), OVERVIEW_ZOOM, null, undefined, undefined, undefined, null, atFloor),
    ).toBe(true);
    const belowFloor = new Map([["n", HITTABLE_MIN_TIER_ALPHA / 2]]);
    expect(
      isNodeHittable(node("n"), OVERVIEW_ZOOM, null, undefined, undefined, undefined, null, belowFloor),
    ).toBe(false);
  });

  it("a collapsed node is not hit whatever its alpha, so what is not drawn cannot be hit", () => {
    const drawn = new Map([["n", 1]]);
    expect(
      isNodeHittable(
        node("n"),
        OVERVIEW_ZOOM,
        null,
        undefined,
        undefined,
        new Set(["n"]),
        null,
        drawn,
      ),
    ).toBe(false);
  });

  it("an empty map falls back to the previous calculation, guarding the first frame", () => {
    // Before the first paint the map is empty. That one frame must behave as it does
    // today — a defence, not a regression (a user cannot click before paint).
    const empty = new Map<string, number>();
    // In overview the element tier is closed → not hittable (the pre-existing rule).
    expect(
      isNodeHittable(node("n"), OVERVIEW_ZOOM, null, undefined, undefined, undefined, null, empty),
    ).toBe(false);
    // But ego makes it hittable even under the pre-existing rule.
    expect(
      isNodeHittable(node("n"), OVERVIEW_ZOOM, "n", undefined, undefined, undefined, null, empty),
    ).toBe(true);
  });

  it("omitting the map entirely keeps the previous signature and behavior, so callers see no regression", () => {
    expect(isNodeHittable(node("n"), OVERVIEW_ZOOM, "n", undefined)).toBe(true);
    expect(isNodeHittable(node("n"), OVERVIEW_ZOOM, null, undefined)).toBe(false);
    // The spine tier is always open.
    expect(isNodeHittable(node("d", "domain"), OVERVIEW_ZOOM, null, undefined)).toBe(true);
  });
});
