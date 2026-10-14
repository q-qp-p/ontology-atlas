import { expect, test } from "@playwright/test";

import { seedFirstRunSeen } from "../first-run-seed";

/** Lock the ratio, not the width: a pinned width breaks whenever the content height changes. */

/** The cap at which it still reads as a screen preview. Measured: legible up to 3.0 (at 1440 wide) and collapsing above that. */
const MAX_RATIO = 3.2;

test("the promise illustration in history setup does not turn into a strip on wide screens", async ({ page }) => {
  await seedFirstRunSeen(page);
  const measured: { width: number; ratio: number; w: number; h: number }[] = [];

  for (const width of [1280, 1680, 1920, 2560]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/ko/git/?guides=off");
    const preview = page.getByTestId("atlas-git-setup-preview");
    await expect(preview).toBeAttached({ timeout: 15_000 });
    const box = await preview.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(box.h, `the illustration height is 0 at ${width}px, so this test spins idle`).toBeGreaterThan(50);
    measured.push({ width, ratio: box.w / box.h, w: box.w, h: box.h });
  }

  expect(measured.length, "if no width could be measured, this test spins idle").toBe(4);
  const worst = measured.reduce((a, b) => (a.ratio > b.ratio ? a : b));
  expect(
    Number(worst.ratio.toFixed(2)),
    `at ${worst.width}px it is ${worst.w}×${worst.h} = ${worst.ratio.toFixed(2)}:1, a strip and not a screen`,
  ).toBeLessThanOrEqual(MAX_RATIO);
});
