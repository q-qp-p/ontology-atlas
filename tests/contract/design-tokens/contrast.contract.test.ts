import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  composite,
  contrastRatio,
  isLargeText,
  judgeAdjacentMarks,
  judgeText,
  parseColor,
  relativeLuminance,
} from "../../../scripts/lib/design/contrast.mjs";

/**
 * **Probes** for the contrast instrument.
 *
 * `/gate-probe`: a gate that only ever passes is indistinguishable from no gate.
 * Contrast especially so — **any two colours produce a number**, so a wrong
 * calculation still looks plausible. Every fixture here is therefore a value
 * **verifiable from outside**: the extremes WCAG states explicitly, and the
 * arithmetic answers for alpha compositing.
 */

const SRC_DIR = join(process.cwd(), "scripts/lib");

/**
 * `judgeText` returns `null` when it cannot read a colour. Passing that through with
 * `!` means **this whole file passes vacuously on the day parsing silently breaks**,
 * because the comparisons become undefined rather than judgements. So it is cut off
 * once here.
 */
const judged = (input: Parameters<typeof judgeText>[0]) => {
  const r = judgeText(input);
  expect(r, `could not read the colour: ${input.fg} on ${input.bg}`).not.toBeNull();
  return r!;
};

describe("colour parsing", () => {
  it.each([
    ["#fff", [255, 255, 255, 1]],
    ["#000000", [0, 0, 0, 1]],
    ["rgb(94, 106, 210)", [94, 106, 210, 1]],
    ["rgba(255, 255, 255, 0.5)", [255, 255, 255, 0.5]],
    ["transparent", [0, 0, 0, 0]],
  ])("`%s`", (input, expected) => {
    expect(parseColor(input)).toEqual(expected);
  });

  it("an unknown format is null — padding it with 0 would misjudge it as black", () => {
    // Folding a parse failure into black (luminance 0) makes contrast look **better** than it is.
    expect(parseColor("color(display-p3 1 0 0)")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});

describe("WCAG reference values", () => {
  it("white against black is 21:1 — if this ceiling does not appear the luminance formula is wrong", () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
  });

  it("the same colour against itself is 1:1", () => {
    expect(contrastRatio([94, 106, 210], [94, 106, 210])).toBeCloseTo(1, 5);
  });

  it("order does not change the result — the lighter side is the numerator", () => {
    const a = [94, 106, 210];
    const b = [8, 9, 10];
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it("relative luminance matches the spec extremes", () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 10);
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 10);
    // Below the linearisation breakpoint, small values take the division path — using the exponent path there diverges.
    expect(relativeLuminance([1, 1, 1])).toBeCloseTo(1 / 255 / 12.92, 10);
  });
});

describe("alpha compositing — without it the instrument is optimistic", () => {
  it("50% white over black is grey 127.5", () => {
    expect(composite([255, 255, 255, 0.5], [0, 0, 0, 1])).toEqual([127.5, 127.5, 127.5, 1]);
  });

  it("an opaque foreground ignores the background", () => {
    expect(composite([94, 106, 210, 1], [255, 255, 255, 1])).toEqual([94, 106, 210, 1]);
  });

  it("semi-transparent text measures **lower** contrast than before compositing — that is the real screen", () => {
    const bg = "rgb(8, 9, 10)"; // --color-canvas
    const solid = judged({ fg: "rgb(255,255,255)", bg, fontSizePx: 14, fontWeight: 400 });
    const faded = judged({ fg: "rgba(255,255,255,0.45)", bg, fontSizePx: 14, fontWeight: 400 });
    expect(solid.ratio).toBeGreaterThan(faded.ratio);
    // Omitting compositing would turn the faded case into a pass.
    expect(solid.passes).toBe(true);
    expect(faded.passes).toBe(false);
  });
});

describe("threshold judgement", () => {
  it("body text requires 4.5:1 and large text 3:1", () => {
    const bg = "rgb(8, 9, 10)";
    const fg = "rgb(110, 110, 110)"; // A grey that falls between 4.5 and 3
    const body = judged({ fg, bg, fontSizePx: 14, fontWeight: 400 });
    const large = judged({ fg, bg, fontSizePx: 30, fontWeight: 400 });
    expect(body.required).toBe(4.5);
    expect(large.required).toBe(3);
    expect(body.ratio).toBe(large.ratio); // Same colour…
    expect(body.passes).toBe(false);
    expect(large.passes).toBe(true);
  });

  it("the large-text definition equals the WCAG boundary — 18.66px+bold or 24px", () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(23, 400)).toBe(false);
    expect(isLargeText(18.66, 700)).toBe(true);
    expect(isLargeText(18.66, 400)).toBe(false); // Not without bold
    expect(isLargeText(18, 700)).toBe(false);
  });
});

describe("adjacent marks — catches designs separated only by hue", () => {
  /** A readable colour **never falls through to unmeasured** — that is itself the contract. */
  const measured = (input: { a: string; b: string; over: string }) => {
    const r = judgeAdjacentMarks(input);
    if (!r) throw new Error(`a readable colour came back unmeasured: ${JSON.stringify(input)}`);
    return r;
  };

  it("measuring the pair of 2026-07-26 again falls far short of 3:1", () => {
    // Amber and eucalyptus differ clearly in hue but were nearly identical in
    // luminance. That hue axis is the one red-green colour blindness separates worst,
    // so the premise that colour carries identity was wrong.
    const r = measured({ a: "#d4b478", b: "#7fa88c", over: "rgb(8,9,10)" });
    expect(r.passes).toBe(false);
    expect(r.needsNonColorChannel).toBe(true);
    expect(r.ratio).toBeLessThan(2); // Completely different colours to the eye
  });

  it("a pair separated by luminance passes — it does not reject everything", () => {
    expect(measured({ a: "#ffffff", b: "#3a3a3a", over: "rgb(8,9,10)" }).passes).toBe(true);
  });

  /**
   * An unreadable colour is unmeasured, not a pass: `parseColor` cannot read wide colour spaces or
   * `color-mix()` output such as `color(srgb ...)` and `oklch(...)`.
   */
  it("a colour it cannot read returns null instead of throwing", () => {
    for (const bad of ["oklch(0.7 0.1 250)", "color(srgb 0.2 0.3 0.4)", "wat"]) {
      expect(judgeAdjacentMarks({ a: bad, b: "#ffffff", over: "rgb(8,9,10)" })).toBeNull();
      expect(judgeAdjacentMarks({ a: "#ffffff", b: bad, over: "rgb(8,9,10)" })).toBeNull();
    }
  });
});

describe("the instrument explains itself", () => {
  const SOURCE = readFileSync(join(SRC_DIR, "design", "contrast.mjs"), "utf8");

  it("alpha compositing is not dropped from the calculation", () => {
    /*
     * What stops the next person "simplifying" compositing away is **the code**, not
     * a sentence about it. `composite` must be exported, and the ratio computation
     * must actually call it — measuring a pre-composite colour reports better than
     * reality, which is the defect this module exists to prevent.
     */
    expect(SOURCE).toMatch(/export function composite\b/);
    const callsInRatio = [...SOURCE.matchAll(/composite\s*\(/g)].length;
    expect(callsInRatio, "the compositing function is defined but unused").toBeGreaterThan(1);
  });

  it("the basis is cited as a WCAG clause — it is a standard, not taste", () => {
    expect(SOURCE).toContain("1.4.3");
    expect(SOURCE).toContain("1.4.11");
  });
});
