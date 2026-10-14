import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { stripComments } from "../../../scripts/lib/design/static-surface-census.mjs";
import { judgeRatchet } from "../lib/ratchet-base";

/**
 * Hand-written hover declarations inside a `controlClass({ ... })` call block may not grow; the
 * unit is a declaration, not a file, since a coarser unit misses that much.
 */

/**
 * Judged against the merge base (`tests/contract/lib/ratchet-base.ts`); only growth fails.
 * `FALLBACK_CEILING` serves a clone with no merge base and is never edited.
 */
const FALLBACK_CEILING = 280;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
      continue;
    }
    if (/\.tsx$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(p);
  }
  return out;
}

/** Terminates `controlClass({ … })` by brace depth, so it is not cut short at a `=>`. */
function callBlocks(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/controlClass\(\{/g)) {
    let depth = 0;
    let quote: string | null = null;
    let i = m.index! + "controlClass(".length;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== "\\") quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (!depth) {
          i += 1;
          break;
        }
      }
    }
    out.push(src.slice(m.index!, i));
  }
  return out;
}

const HAND_HOVER = /hover:(?:text|bg|border)-\[color:var\(/g;

function scan(root = process.cwd()) {
  const byFile = new Map<string, number>();
  let total = 0;
  let callsSeen = 0;
  let axisUsers = 0;

  for (const dir of ["src", "app"]) {
    for (const file of walk(path.join(root, dir))) {
      const rel = path.relative(root, file).split(path.sep).join("/");
      const src = stripComments(readFileSync(file, "utf8"));
      for (const block of callBlocks(src)) {
        callsSeen += 1;
        if (/hover(?:Ink|Surface|Border):/.test(block)) axisUsers += 1;
        const n = [...block.matchAll(HAND_HOVER)].length;
        if (n) {
          byFile.set(rel, (byFile.get(rel) ?? 0) + n);
          total += n;
        }
      }
    }
  }
  return { byFile, total, callsSeen, axisUsers };
}

describe("hover axis adoption ratchet", () => {
  const census = scan();

  it("the detector does not idle — it really splits calls and axis consumers exist", () => {
    expect(census.callsSeen, "could not split the controlClass calls — the parser is dead").toBeGreaterThan(200);
    /*
     * **The axis must have consumers.** The discipline this repository adopted after
     * killing three components with zero consumers: an option with no consumer is
     * misinformation, not a spec. The day this assertion reaches 0 is the day the axis
     * died.
     */
    expect(census.axisUsers, "no call uses the hover axis — the axis has zero consumers").toBeGreaterThan(20);
  });

  it("hand-written hover does not grow", () => {
    const verdict = judgeRatchet({
      gate: "hand-hover-declarations",
      measure: (root) => (root === process.cwd() ? census : scan(root)).total,
      reads: ["src", "app"],
      fallback: FALLBACK_CEILING,
    });
    expect(
      verdict.current,
      `Hand-written hover declarations reached ${verdict.current}, over the ceiling ${verdict.ceiling}.\n${verdict.explain}\n` +
        "The value layer has three axes: `hoverInk`('strong'|'secondary') · " +
        "`hoverSurface`('lift') · `hoverBorder`('strong'). For those values use the axis;\n" +
        "for another value, first say **why it differs** (an indigo tint step is a hierarchy verdict, not a value).\n" +
        [...census.byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => `  ${n} ${f}`).join("\n"),
    ).toBeLessThanOrEqual(verdict.ceiling);
  });

  it("the detector catches the planted violation and not axis usage", () => {
    const hand = `controlClass({ shape: 'chip', className: 'hover:text-[color:var(--color-text-primary)]' })`;
    const axis = `controlClass({ shape: 'chip', hoverInk: 'strong' })`;
    const outside = `<button className="hover:text-[color:var(--color-text-primary)]" />`;
    const count = (s: string) =>
      callBlocks(s).reduce((a, b) => a + [...b.matchAll(HAND_HOVER)].length, 0);

    expect(count(hand), "does not catch hand hover").toBe(1);
    expect(count(axis), "counts axis usage as a violation — then the reason to use it disappears").toBe(0);
    expect(count(outside), "outside a call is not this ratchet's jurisdiction").toBe(0);
  });
});
