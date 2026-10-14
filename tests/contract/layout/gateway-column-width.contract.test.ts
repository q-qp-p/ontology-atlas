import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";
import { collectTokens } from '../../../scripts/design/design-tokens.mjs';
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * Gateway body column cap: at or below 1920 origin and column must equal the old `--page-max`
 * formula, and origin, column and `PAGE_COLUMN` must all read this one token.
 */

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(repoRoot, rel), "utf8");

const TOKEN = "--gateway-page-max";

function parsePx(css: string, token: string): number {
  const match = css.match(new RegExp(`${token}:\\s*([\\d.]+)px\\s*;`));
  expect(match, `${token} must be declared in app/globals.css as <number>px`).not.toBeNull();
  return Number(match![1]);
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

describe("gateway body column cap — invariants of --gateway-page-max", () => {
  const css = readGlobalCss();
  const gatewayMax = parsePx(css, TOKEN);
  const pageMax = parsePx(css, "--page-max");

  it("(a) the value is 1920px — the owner's choice ([320][1920][320] at 2560)", () => {
    expect(gatewayMax).toBe(1920);
  });

  it("(b) no regression up to 1920 — the cap never drops below --page-max", () => {
    expect(
      gatewayMax,
      `With the cap (${gatewayMax}) below --page-max (${pageMax}), the origin and columns for vw ≤ ${pageMax + 400} ` +
        "differ from the previous formula, so the render at the 1440–1920 widths this gate protects moves",
    ).toBeGreaterThanOrEqual(pageMax);
  });

  it("(c) the alignment origin formula consumes the same cap — column and origin are a pair", () => {
    const origin = css.match(/--gateway-origin:\s*max\(([\s\S]*?)\);/);
    expect(origin, "--gateway-origin must be declared in the form max(…)").not.toBeNull();
    expect(
      origin![1],
      "the origin formula does not read --gateway-page-max — only the column widens, the centre stays at the old cap and left and right turn asymmetric",
    ).toContain(`var(${TOKEN})`);
    expect(
      origin![1],
      "--page-max remains in the origin formula — the source of truth of the cap must be one",
    ).not.toContain("var(--page-max)");
  });

  it("(d) the source of truth of the column cap is one token — PAGE_COLUMN consumes it + --page-max appears in 0 places of gateway code", () => {
    const frame = read("src/shared/lib/public-pages/gateway-frame.ts");
    expect(
      frame,
      "PAGE_COLUMN must consume max-w-[var(--gateway-page-max)]",
    ).toContain(`max-w-[var(${TOKEN})]`);

    const gatewayDirs = [
      join(repoRoot, "src", "views", "download"),
      join(repoRoot, "src", "views", "gateway-doc"),
      join(repoRoot, "src", "widgets", "gateway-chrome"),
    ];
    const strays: string[] = [];
    for (const dir of gatewayDirs) {
      for (const file of walk(dir)) {
        // Catches consumption in className strings, not lineage described in comments.
        if (readFileSync(file, "utf8").includes("max-w-[var(--page-max)]")) {
          strays.push(relative(repoRoot, file).replace(/\\/g, "/"));
        }
      }
    }
    expect(
      strays,
      "a gateway surface directly consumes --page-max as a column cap — a half migration",
    ).toEqual([]);
  });

  it("(e) pnpm design:tokens prints the declared value", () => {
    const printed = collectTokens().filter((token) => token.name === TOKEN);
    expect(printed.length, `${TOKEN} is not printed by pnpm design:tokens`).toBeGreaterThan(0);
    expect(printed.map((token) => token.value), "the printer and the stylesheet disagree").toContain(`${gatewayMax}px`);
  });
});
