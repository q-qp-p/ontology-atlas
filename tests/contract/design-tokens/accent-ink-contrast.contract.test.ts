import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { composite, contrastRatio, parseColor } from "../../../scripts/lib/design/contrast.mjs";
import { controlClass } from "../../../src/shared/ui/control-class";
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * Blank out comments before scanning, preserving line numbers, so prose cannot trip the
 * class-literal scan.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}


/**
 * Locks the licence of the two indigo ink steps with composite contrast (WCAG 2.2 1.4.3, AA 4.5:1)
 * from the real tokens in `app/globals.css`. The source scan resolves constants that lint selectors
 * cannot see.
 */

/** Reads a token value from `app/globals.css`, first definition wins. */
type Rgba = readonly number[];

function cssToken(css: string, name: string): Rgba {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`${name} is missing from globals.css`);
  const v = m[1].trim();
  if (v.startsWith("var(")) return cssToken(css, v.slice(4, -1).trim());
  const parsed = parseColor(v);
  if (!parsed) throw new Error(`cannot read the value of ${name} (${v}) as a colour`);
  return parsed as Rgba;
}

const css = readGlobalCss();

/** The app's three base backgrounds — the floor under every control host. */
const BASES = {
  canvas: cssToken(css, "--color-canvas"),
  panel: cssToken(css, "--color-panel"),
  elevated: cssToken(css, "--color-elevated"),
};

/**
 * The tints the 29 migrated places actually stood on. Putting accent on a new tint
 * not listed here requires widening this list and proving it under the licence
 * below.
 */
const TINTS = {
  "indigo-a06": cssToken(css, "--color-indigo-a06"),
  "indigo-a08": cssToken(css, "--color-indigo-a08"),
  "indigo-a10": cssToken(css, "--color-indigo-a10"),
  "indigo-a12": cssToken(css, "--color-indigo-a12"),
  "indigo-a14": cssToken(css, "--color-indigo-a14"),
  "indigo-a16": cssToken(css, "--color-indigo-a16"),
  "indigo-a18": cssToken(css, "--color-indigo-a18"),
  "indigo-a24": cssToken(css, "--color-indigo-a24"),
  "indigo-a26": cssToken(css, "--color-indigo-a26"),
  "indigo-a32": cssToken(css, "--color-indigo-a32"),
  "indigo-line-a13": cssToken(css, "--color-indigo-line-a13"),
  "amber-signal-a07": cssToken(css, "--color-amber-signal-a07"),
  "amber-signal-a16": cssToken(css, "--color-amber-signal-a16"),
  "danger-a10": cssToken(css, "--color-danger-a10"),
};

const ratioOn = (ink: Rgba, bg: Rgba) =>
  contrastRatio(composite(ink, bg), bg);

describe("indigo ink licence — contrast judges, not the value", () => {
  const accent = cssToken(css, "--color-indigo-accent");
  const soft = cssToken(css, "--color-indigo-text-soft");

  it("the tone → token mapping stands — accent is the marker indigo, accentOnTint is the text indigo", () => {
    /*
     * Contrast alone cannot lock this mapping: soft also passes on the base
     * backgrounds, so swapping `accent` ink for soft keeps the licence below green.
     * But at that moment the ramp and the 99 hand-written `--color-indigo-accent`
     * text lines across the app become two dialects — keeping them consistent is why
     * this mapping exists.
     */
    expect(controlClass({ tone: "accent" })).toContain("text-[color:var(--color-indigo-accent)]");
    expect(controlClass({ tone: "accentOnTint" })).toContain(
      "text-[color:var(--color-indigo-text-soft)]",
    );
  });

  it("licence of accent: AA (4.5:1) on all three bare backgrounds", () => {
    for (const [name, base] of Object.entries(BASES)) {
      const r = ratioOn(accent, base);
      expect(r, `accent(#7170ff) on bare ${name} is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("licence of accentOnTint: AA (4.5:1) on every background × every tint composite — an ink safe anywhere", () => {
    for (const [bn, base] of Object.entries(BASES)) {
      expect(ratioOn(soft, base), `soft falls short on bare ${bn}`).toBeGreaterThanOrEqual(4.5);
      for (const [tn, tint] of Object.entries(TINTS)) {
        const bg = composite(tint, base);
        const r = ratioOn(soft, bg);
        expect(r, `soft on the ${tn}/${bn} composite is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("the reason for the split still exists — accent really breaks AA on a tint", () => {
    /*
     * `/gate-probe`: no detector may idle on an empty set. The day this assertion
     * turns red is the day the tokens converged and accent passes everywhere, and on
     * that day the two tones can be folded into one — the same grammar as the scope
     * axis's "the two ramps really differ" gate.
     */
    expect(
      ratioOn(accent, composite(TINTS["indigo-a24"], BASES.canvas)),
      "accent passes AA on a24/canvas too — re-evaluate whether the tone split can be folded",
    ).toBeLessThan(4.5);
    expect(ratioOn(accent, composite(TINTS["indigo-line-a13"], BASES.elevated))).toBeLessThan(4.5);
  });
});

/**
 * Source scan — `tone accent` is never paired with a tint fill **in one control**.
 *
 * Window heuristic: within 12 lines either side of a tone declaration, it resolves
 * tint background literals and file constants (`const NAME = '…'`) applied to
 * className. The 3 remaining accent places today are all `link` on a base
 * background, so no tint falls inside the window — a new one turns this red, and
 * the prescription is `accentOnTint`, not a ban.
 */
describe("accent × tint pairing ban — including constant bypasses lint cannot see", () => {
  const TINT_RE = /bg-\[color:var\(--color-(indigo|amber)/;
  const TONE_RE = /tone(?::\s*|=)["']accent["']/;

  const walk = (dir: string, acc: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, acc);
      else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) acc.push(p);
    }
    return acc;
  };

  /**
   * Hand-written ink and tint pairs bypass the `tone` scan. Baseline 0: ink on a tint must be
   * `--color-indigo-text-soft`. Accent contrast depends on the host background, which a static scan
   * cannot know.
   */
  const HAND_WRITTEN_INK = /text-\[color:var\(--color-indigo-accent\)\]/;
  const HAND_WRITTEN_TINT = /bg-\[color:var\(--color-(indigo|amber)[a-z-]*-a\d+\)\]/;
  const BASELINE_HAND_WRITTEN_ACCENT_ON_TINT = 0;

  /** Terminates an opening tag by **brace depth** — the `=>` in `onClick={() => …}` is not the end of the tag. */
  const openingTags = (src: string): string[] => {
    const tags: string[] = [];
    for (const m of src.matchAll(/<[A-Za-z][\w.]*/g)) {
      let depth = 0;
      let quote: string | null = null;
      let i = m.index! + m[0].length;
      let closed = false;
      for (; i < src.length; i += 1) {
        const c = src[i];
        if (quote) {
          if (c === quote && src[i - 1] !== "\\") quote = null;
          continue;
        }
        if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{") depth += 1;
        else if (c === "}") depth -= 1;
        else if (c === ">" && depth === 0) {
          closed = true;
          break;
        }
      }
      // Something that never closes is not a tag. Without this guard the slice runs to
      // end of file and every following element lands inside the "tag", counting 30
      // instead of 24 (measured).
      if (closed) tags.push(src.slice(m.index!, i));
    }
    return tags;
  };

  const handWritten = (): string[] => {
    const hits: string[] = [];
    for (const file of walk(join(process.cwd(), "src"))) {
      const src = stripComments(readFileSync(file, "utf8"));
      if (!HAND_WRITTEN_INK.test(src)) continue;
      for (const tag of openingTags(src)) {
        if (HAND_WRITTEN_INK.test(tag) && HAND_WRITTEN_TINT.test(tag)) {
          hits.push(`${file.replace(process.cwd(), ".")}`);
        }
      }
    }
    return hits;
  };

  it("hand-written accent × tint does not grow — a layer this gate could not see when `tone` is unused", () => {
    const hits = handWritten();
    expect(
      hits.length,
      `Sites that hand-write accent ink beside its tint grew from ${BASELINE_HAND_WRITTEN_ACCENT_ON_TINT} to ${hits.length}.\n` +
        `Ink that sits on the tint is --color-indigo-text-soft (the same site goes from 4.27 to 8.39:1).\n` +
        hits.join("\n"),
    ).toBeLessThanOrEqual(BASELINE_HAND_WRITTEN_ACCENT_ON_TINT);
  });

  it("when paid off the baseline comes down too — slack is not left free", () => {
    expect(
      handWritten().length,
      "hand-written accent×tint shrank — lower BASELINE_HAND_WRITTEN_ACCENT_ON_TINT too.",
    ).toBeGreaterThanOrEqual(BASELINE_HAND_WRITTEN_ACCENT_ON_TINT);
  });

  it("the detector does not idle — it catches the synthetic probe and lets the proper pair go", () => {
    const offender = `<span className="rounded-full bg-[color:var(--color-indigo-a16)] text-[color:var(--color-indigo-accent)]">1</span>`;
    const fixed = `<span className="rounded-full bg-[color:var(--color-indigo-a16)] text-[color:var(--color-indigo-text-soft)]">1</span>`;
    const bare = `<span className="text-[color:var(--color-indigo-accent)]">1</span>`;
    const hit = (s: string) =>
      openingTags(s).some((t) => HAND_WRITTEN_INK.test(t) && HAND_WRITTEN_TINT.test(t));
    expect(hit(offender), "does not catch the deliberate violation — the detector is dead").toBe(true);
    expect(hit(fixed), "counts the fixed pair as a violation — then the reason to fix disappears").toBe(false);
    expect(hit(bare), "accent on a bare background is within the licence").toBe(false);
  });

  it("zero violations — the primary-action ink carrying a tint is accentOnTint", () => {
    const offenders: string[] = [];
    for (const file of walk(join(process.cwd(), "src"))) {
      const src = stripComments(readFileSync(file, "utf8"));
      if (!TONE_RE.test(src)) continue;
      const lines = src.split("\n");
      // Resolve string constants declared in the same file (e.g. INDIGO_CHIP).
      const consts = new Map<string, string>();
      for (const m of src.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*\n?\s*["'`]([^"'`]+)["'`]/g)) {
        consts.set(m[1], m[2]);
      }
      lines.forEach((line, i) => {
        if (!TONE_RE.test(line)) return;
        const window = lines.slice(Math.max(0, i - 12), i + 13).join("\n");
        let resolved = window;
        for (const [name, value] of consts) {
          if (window.includes(name)) resolved += `\n${value}`;
        }
        if (TINT_RE.test(resolved)) {
          offenders.push(`${file.replace(process.cwd(), ".")}:${i + 1}`);
        }
      });
    }
    expect(
      offenders,
      `tone accent shares a control with an indigo/amber tint fill — use accentOnTint:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
