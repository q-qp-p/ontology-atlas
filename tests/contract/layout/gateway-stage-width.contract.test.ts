import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";
import { collectTokens } from '../../../scripts/design/design-tokens.mjs';
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * Gateway stage width: the 48rem floor is pinned, the vw slope at 1920 must not exceed the floor,
 * the cap must not exceed the 1512px clip source, and the token has one consumer.
 */

const repoRoot = join(import.meta.dirname, "..", "..", "..");

const TOKEN = "--gateway-stage-max";

/** Extracts the three clamp values from the token declaration in globals.css. */
function parseStageClamp(css: string): { floorRem: number; slopeVw: number; capRem: number } {
  const match = css.match(
    /--gateway-stage-max:\s*clamp\(\s*([\d.]+)rem\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)rem\s*\)/,
  );
  expect(
    match,
    `${TOKEN} must be declared in app/globals.css in the form clamp(<rem>, <vw>, <rem>)`,
  ).not.toBeNull();
  const [, floor, slope, cap] = match!;
  return { floorRem: Number(floor), slopeVw: Number(slope), capRem: Number(cap) };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(?:ts|tsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

describe("gateway stage width — invariants of --gateway-stage-max", () => {
  const css = readGlobalCss();
  const clamp = parseStageClamp(css);

  it("(a) the floor is 48rem — the value the owner approved in ledger entry (83)", () => {
    expect(clamp.floorRem).toBe(48);
  });

  it("(b) no regression up to 1920 — the slope does not exceed the floor at 1920", () => {
    const slopeAt1920 = (clamp.slopeVw / 100) * 1920;
    const floorPx = clamp.floorRem * 16;
    expect(
      slopeAt1920,
      `The slope ${clamp.slopeVw}vw is ${slopeAt1920}px at 1920; once it passes the floor (${floorPx}px), ` +
        "the render at the 1440–1920 widths this gate protects moves",
    ).toBeLessThanOrEqual(floorPx);
  });

  it("(c) the cap does not exceed the original clip width (1512px)", () => {
    const capPx = clamp.capRem * 16;
    expect(capPx).toBeGreaterThanOrEqual(clamp.floorRem * 16);
    expect(
      capPx,
      "a cap above the original clip (1512px wide) upscales the video at 1x density",
    ).toBeLessThanOrEqual(1512);
  });

  it("(d) the source of truth of stage width is one token — 1 consumer + 0 local 48rem", () => {
    const downloadFiles = walk(join(repoRoot, "src", "views", "download"));
    const consumers: string[] = [];
    const strays: string[] = [];
    for (const file of downloadFiles) {
      const text = readFileSync(file, "utf8");
      const rel = relative(repoRoot, file).replace(/\\/g, "/");
      if (text.includes("max-w-[var(--gateway-stage-max)]")) consumers.push(rel);
      // Catches hardcoded stage widths inside className strings, not in comments.
      if (/max-w-\[48rem\]/.test(text)) strays.push(rel);
    }
    expect(
      consumers.sort(),
      "only the demo stage (DemoStage) must consume the token — the agent scene stands on the grid of the basis section",
    ).toEqual(["src/views/download/ui/DemoStage.tsx"]);
    expect(strays, "a max-w-[48rem] that decides the stage width separately remains").toEqual([]);
  });

  it("(e) pnpm design:tokens prints the declared formula", () => {
    const printed = collectTokens().filter((token) => token.name === TOKEN);
    expect(printed.length, `${TOKEN} is not printed by pnpm design:tokens`).toBeGreaterThan(0);
    expect(
      printed.map((token) => token.value),
      "the printer and the stylesheet disagree",
    ).toContain(`clamp(${clamp.floorRem}rem, ${clamp.slopeVw}vw, ${clamp.capRem}rem)`);
  });
});
