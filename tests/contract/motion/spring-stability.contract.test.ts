import { describe, expect, it } from "vitest";
import {
  MAX_FRAME_DELTA_SECONDS,
  SPRING_STABILITY_LIMIT,
  stepSpring,
} from "@/widgets/ontology-map/engine/spring";
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * Spring stability margin: semi-implicit Euler diverges as `w*dt` reaches 1.0, and a NaN camera kills
 * the canvas. The token and the dt clamp live in different files, so both are read here.
 */

const CSS = readGlobalCss();

/** Every angular-frequency token declared on the ramp — names are never hand-listed (a missed one is a blind spot). */
function angularFrequencyTokens(): Array<{ name: string; value: number }> {
  return [...CSS.matchAll(/(--map-[a-z0-9-]*angfreq[a-z0-9-]*)\s*:\s*([\d.]+)\s*;/g)]
    .map((m) => ({ name: m[1], value: Number(m[2]) }))
    // By convention the same token is declared twice, in `@theme` and `:root`, so duplicates are folded.
    .filter((entry, index, all) => all.findIndex((o) => o.name === entry.name) === index);
}

/** Converging on the target is stable; a non-finite or growing value is unstable. */
function converges(angularFrequency: number, dt: number): boolean {
  let state = { value: 1000, velocity: 0 };
  for (let i = 0; i < 2000; i += 1) {
    state = stepSpring(state, 0, dt, angularFrequency, 1.0);
    if (!Number.isFinite(state.value) || !Number.isFinite(state.velocity)) return false;
  }
  return Math.abs(state.value) < 1;
}

describe("spring stability margin: token times frame clamp", () => {
  it("actually found the angular-frequency tokens of the ramp", () => {
    // If the regex silently matches nothing, the checks below pass vacuously.
    expect(angularFrequencyTokens().length).toBeGreaterThan(0);
  });

  it("every angular-frequency token stays inside the stability bound even multiplied by the clamp", () => {
    const violations = angularFrequencyTokens()
      .map((token) => ({ ...token, product: token.value * MAX_FRAME_DELTA_SECONDS }))
      .filter((token) => token.product >= SPRING_STABILITY_LIMIT);

    expect(
      violations,
      `if omega*dt reaches the stability bound (${SPRING_STABILITY_LIMIT}) the camera becomes NaN and the canvas dies`,
    ).toEqual([]);
  });

  it("the product really converges, verified by integration rather than arithmetic", () => {
    for (const token of angularFrequencyTokens()) {
      expect(
        converges(token.value, MAX_FRAME_DELTA_SECONDS),
        `${token.name} = ${token.value} diverges at dt=${MAX_FRAME_DELTA_SECONDS}`,
      ).toBe(true);
    }
  });

  /**
   * The probe proving the boundary claim is true. Without it the checks above stand on
   * the **unverified premise** that the boundary is 1.0.
   */
  it("probe: just below the bound converges and at the bound diverges", () => {
    const dt = MAX_FRAME_DELTA_SECONDS;
    expect(converges((SPRING_STABILITY_LIMIT * 0.75) / dt, dt)).toBe(true);
    expect(converges(SPRING_STABILITY_LIMIT / dt, dt)).toBe(false);
  });
});
