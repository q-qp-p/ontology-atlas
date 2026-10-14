import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { badgeClass, type BadgeShape } from "../../../src/shared/ui/badge-class";

/**
 * The static badge value-layer contract — it judges **the string cva composes**.
 *
 * This is a layer lint cannot see: the code carries only keys such as
 * `shape: 'pill'` and the real values are composed at runtime, so
 * `no-restricted-syntax` has no string to look at (same form and same reason as
 * `control-class.contract.test.ts`).
 *
 * Four properties locked:
 * 1. Every shape's output is **inside the ramp** — radius steps and type steps
 *    only. An off-ramp literal (`px-[3px]`, `#hex`, `text-sm`) fails.
 * 2. Axes do not grow quietly — one `shape`, three shapes.
 * 3. **Colour and tracking are not emitted by the value layer.** Measurement found
 *    60 distinct colour combinations (largest cluster 2), so there was no majority
 *    to converge on and adding a tone axis would create an option with 0 consumers.
 *    This assertion pins that judgement — adding tone later requires editing this
 *    line, and that diff demands evidence.
 * 4. The default is the quietest shape.
 */

const ROOT = process.cwd();
const SHAPES: BadgeShape[] = ["micro", "tag", "pill"];

/** The radius and type step names the ramp defines. `app/globals.css` owns the values. */
const RADIUS_STEPS = ["rounded-micro", "rounded-chip", "rounded-full"];
const TYPE_STEPS = ["text-caption", "text-label"];

describe("badgeClass — static badge value layer", () => {
  const all = SHAPES.map((shape) => ({ shape, out: badgeClass({ shape }) }));

  it("the detector does not idle — it really builds the three shapes", () => {
    expect(all).toHaveLength(3);
    for (const c of all) expect(c.out.length).toBeGreaterThan(20);
  });

  it("every combination emits values only inside the ramp", () => {
    const offenders: string[] = [];
    for (const { shape, out } of all) {
      const label = shape;
      // Exactly one radius ramp step.
      const radii = RADIUS_STEPS.filter((r) => new RegExp(`\\b${r}\\b`).test(out));
      if (radii.length !== 1) offenders.push(`${label}: ${radii.length} radius steps`);
      // Exactly one type ramp step.
      const types = TYPE_STEPS.filter((t) => new RegExp(`\\b${t}\\b`).test(out));
      if (types.length !== 1) offenders.push(`${label}: ${types.length} type steps`);
      // Colours must be tokens — no raw hex, no Tailwind palette.
      if (/#[0-9a-fA-F]{3,8}/.test(out)) offenders.push(`${label}: hex literal`);
      if (/\b(?:text|bg|border)-(?:white|black|slate|gray|zinc|red|amber|indigo)-\d/.test(out)) {
        offenders.push(`${label}: Tailwind palette`);
      }
      // No arbitrary length values (px-[3px] and friends).
      if (/\b(?:px|py|p|text|rounded)-\[[0-9.]/.test(out)) offenders.push(`${label}: literal outside the ramp`);
    }
    expect(offenders, "the value layer leaked outside the ramp").toEqual([]);
  });

  it("axes do not grow silently — shape has 3, and there are no colour or tracking axes", () => {
    const source = readFileSync(path.join(ROOT, "src/shared/ui/badge-class.ts"), "utf8");
    const variants = source.slice(source.indexOf("variants: {"), source.indexOf("defaultVariants"));
    const axes = (variants.match(/^\s{4}[a-z]+: \{/gm) ?? []).map((s) => s.trim().replace(": {", ""));
    expect(axes, "an axis was added or removed — convening the system council comes first").toEqual(["shape"]);
    const shapes = (variants.match(/^\s{6}[a-z]+:/gm) ?? []).length;
    expect(shapes, "shape left 3").toBe(3);
  });

  it("the value layer emits no colour or tracking — those axes were left out on purpose because the measurement has no majority", () => {
    for (const { shape, out } of all) {
      expect(out, `${shape}: colour entered the value layer`).not.toMatch(/\b(?:bg|text)-\[color:/);
      expect(out, `${shape}: tracking entered the value layer`).not.toMatch(/tracking-\[/);
      expect(out, `${shape}: upper-casing entered the value layer`).not.toMatch(/uppercase/);
    }
  });

  it("the default is the quietest shape — tag", () => {
    expect(badgeClass()).toBe(badgeClass({ shape: "tag" }));
  });

  it("className adds placement only and does not override the spec", () => {
    const out = badgeClass({ shape: "pill", className: "ml-2 max-w-[12ch] truncate" });
    expect(out).toContain("rounded-full");
    expect(out).toContain("truncate");
  });
});
