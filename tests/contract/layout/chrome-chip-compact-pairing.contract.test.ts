import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Folding a chip to icon-only needs both halves: label `sr-only` and the box narrowed to
 * `--chrome-tile-size`. Two class strings must agree, one behind a `ChromeChip` prop in another file,
 * which lint cannot see.
 */

const ROOT = process.cwd();

/** The responsive door — hiding the label by viewport instead of by the `compact` prop. */
const LABEL_HOOK = /(max-[a-z0-9]+):\[&_\[data-chip-label\]\]:hidden/g;

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, acc);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) acc.push(path);
  }
  return acc;
}

describe("chrome chip compaction — folding the label folds the box", () => {
  const files = sources(join(ROOT, "src"));

  it("the detector does not idle — responsive label folding exists", () => {
    const hooks = files.flatMap((file) => [...readFileSync(file, "utf8").matchAll(LABEL_HOOK)]);
    // When this reaches zero every caller folds through `compact` and this contract can be retired.
    expect(hooks.length, "could not find a single responsive label fold — the selector broke").toBeGreaterThan(0);
  });

  it("at every width where the label folds, the box also narrows to the tile size at the same width", () => {
    // The shared constant counts as the pair for the breakpoint its own value carries —
    // its literal lives in `chrome-chip.tsx` so Tailwind's scanner can see it, and the
    // third case below proves it is the same box the `compact` prop applies.
    const chip = readFileSync(join(ROOT, "src/shared/ui/controls/chrome-chip.tsx"), "utf8");
    const sharedBreakpoint = /export const CHROME_CHIP_COMPACT_BELOW_XL =\s*\n?\s*'(max-[a-z0-9]+):/.exec(chip)?.[1];
    expect(sharedBreakpoint, "could not read the breakpoint of the shared constant").toBeTruthy();

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(LABEL_HOOK)) {
        const breakpoint = match[1];
        const narrows =
          (source.includes(`${breakpoint}:w-[var(--chrome-tile-size)]`) &&
            source.includes(`${breakpoint}:px-0`)) ||
          (breakpoint === sharedBreakpoint && source.includes("CHROME_CHIP_COMPACT_BELOW_XL"));
        if (!narrows) {
          offenders.push(`${file.slice(ROOT.length + 1)} — at ${breakpoint} only the label folds and the box stays`);
        }
      }
    }
    expect(
      offenders,
      "a chip left with only an icon must be as square as the tile. Use `CHROME_CHIP_COMPACT_BELOW_XL` with it or fold it with the `compact` prop.",
    ).toEqual([]);
  });

  it("the shared constant uses the same value as the prop-side box — the two copies do not diverge", () => {
    const chip = readFileSync(join(ROOT, "src/shared/ui/controls/chrome-chip.tsx"), "utf8");
    const compactProp = /const COMPACT_CLASS =\s*'([^']+)'/.exec(chip)?.[1];
    const responsive = /export const CHROME_CHIP_COMPACT_BELOW_XL =\s*\n?\s*'([^']+)'/.exec(chip)?.[1];
    expect(compactProp, "could not read `COMPACT_CLASS`").toBeTruthy();
    expect(responsive, "could not read `CHROME_CHIP_COMPACT_BELOW_XL`").toBeTruthy();
    // Same declarations, one carrying a variant prefix. Comparing the stripped form
    // means a change to either side has to be a deliberate change to both.
    const strip = (value: string) =>
      value
        .split(/\s+/)
        .map((token) => token.replace(/^max-[a-z0-9]+:/, ""))
        .sort();
    expect(strip(responsive!), "the responsive compact box differs from the prop compact box").toEqual(
      strip(compactProp!),
    );
  });
});
