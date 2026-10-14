import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_GUIDE_AUTO_START,
  readGuideAutoStart,
  resolveGuideAutoStart,
  writeGuideAutoStart,
} from "./guide-auto-start";

/**
 * "Show screen guides automatically" — one switch that turns off all six guides.
 *
 * Each guide already appears once per screen, but there are six of them (the map
 * plus five destinations), so moving between screens brings up another one and it
 * **feels like they appear every time**. That is not fixable by editing individual
 * keys, hence a separate axis — and hence this switch's contract: **off stops the
 * automatic appearance only; asking for a guide still opens it.**
 */
describe("guide auto-start switch", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("the default is off, so only those who need it turn it on (owner confirmed 2026-08-13)", () => {
    expect(DEFAULT_GUIDE_AUTO_START).toBe(false);
    expect(readGuideAutoStart()).toBe(false);
  });

  it("turning it on saves it, and turning it off reverts", () => {
    writeGuideAutoStart(true);
    expect(readGuideAutoStart()).toBe(true);
    writeGuideAutoStart(false);
    expect(readGuideAutoStart()).toBe(false);
  });

  /**
   * Only an explicit choice is honoured: the "1" of someone who turned it on before
   * the default flipped to off must survive, while unknown, empty and corrupt
   * values all fall back to the default (off).
   */
  it("a stored on value of 1 survives and an unknown value means off", () => {
    expect(resolveGuideAutoStart("1")).toBe(true);
    expect(resolveGuideAutoStart("0")).toBe(false);
    for (const raw of [null, "", "yes", "true", "nope"]) {
      expect(resolveGuideAutoStart(raw)).toBe(false);
    }
  });
});
