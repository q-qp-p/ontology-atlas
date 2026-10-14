import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FOOTPRINT_TONE_FALLBACK,
  FOOTPRINT_TONE_TOKEN,
} from "@/shared/lib/preferences/appearance-preferences";
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * Every trail tone reaches every consumer, including the settings preview, which must draw the same
 * picture as the canvas through the shared glyph module. The tokens are one exported table, so a new
 * tone fails here instead of shipping half-wired.
 */

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(repoRoot, rel), "utf8");

const TONES = Object.keys(FOOTPRINT_TONE_TOKEN);

describe("walked-path tone: every consumer knows every tone", () => {
  it("the token table and the fallback table hold the same tones", () => {
    expect(TONES.length).toBeGreaterThan(0);
    expect(read("src/widgets/ontology-map/ui/loop/use-topology-loop.ts")).toContain("useTopologyAppearanceEffects({");
    expect(Object.keys(FOOTPRINT_TONE_FALLBACK).sort()).toEqual([...TONES].sort());
  });

  it("every tone points at a CSS token that is actually defined", () => {
    const css = readGlobalCss();
    for (const [tone, cssVar] of Object.entries(FOOTPRINT_TONE_TOKEN)) {
      expect(
        new RegExp(`${cssVar}:\\s*#[0-9a-fA-F]{6}`).test(css),
        `tone ${tone}: ${cssVar} is missing from globals.css`,
      ).toBe(true);
    }
  });

  it("the fallback value is byte-identical to the token value", () => {
    const css = readGlobalCss();
    for (const [tone, cssVar] of Object.entries(FOOTPRINT_TONE_TOKEN)) {
      const hex = new RegExp(`${cssVar}:\\s*(#[0-9a-fA-F]{6})`).exec(css)![1];
      const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(
        [...FOOTPRINT_TONE_FALLBACK[tone as keyof typeof FOOTPRINT_TONE_FALLBACK]],
        `tone ${tone}: fallback differs from ${cssVar}, so a different color appears the moment the token disappears`,
      ).toEqual(rgb);
    }
  });

  /*
   * The two consumers must reach the tone through the shared table, not through a branch of
   * their own. A hand-written `tone === "..."` in either file is how the divergence happened.
   */
  it.each([
    ["src/widgets/ontology-map/ui/loop/use-topology-appearance-effects.ts", "the map canvas"],
    ["src/widgets/app-settings-menu/ui/FootprintSettings.tsx", "the settings preview"],
  ])("%s reads tones through the shared table", (rel) => {
    const source = read(rel);
    expect(source, `${rel} does not use FOOTPRINT_TONE_TOKEN`).toContain(
      "FOOTPRINT_TONE_TOKEN",
    );
    expect(
      /--color-footprint-trail(-indigo|-star)?['"]/.test(source),
      `${rel} spells a tone token name directly, and bypassing the table diverges again at the next tone`,
    ).toBe(false);
  });
});
