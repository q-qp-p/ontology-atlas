import { expect, test, type Page } from "@playwright/test";

import { seedFirstRunSeen } from "../../first-run-seed";
import { waitForAnimationsDone } from "../../settle";

/**
 * Measures the rendered box, not the class string or token: a height nobody wrote shows only in
 * layout. The roster is named, not swept, so no content-driven exemption has to be encoded.
 */

/** Derived from the ladder tokens at runtime, exactly as the token contract derives it. */
async function ladder(page: Page): Promise<number[]> {
  const steps = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const px = (name: string) => Number.parseFloat(cs.getPropertyValue(name));
    return [24, px("--control-h-sm"), px("--control-h-md"), px("--chrome-tile-size"), px("--control-h-lg"), px("--touch-target-min")];
  });
  return [...new Set(steps)].sort((a, b) => a - b);
}

async function openMap(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await seedFirstRunSeen(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("demo:sample-source:v1", "storefront");
    window.sessionStorage.setItem("demo:first-run-starter-dismissed:v1", "1");
  });
  await page.goto("/en/topology/?e2e=1&guides=off", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("topology-index-panel")).toBeVisible({ timeout: 30_000 });
  // The chrome's entrances have finished, so every control is measured at its resting size.
  await waitForAnimationsDone(page.locator("body"));
}

/** Height of the first rendered element for each roster entry. */
async function heights(page: Page, roster: readonly string[]) {
  return page.evaluate((ids) => {
    const out: Record<string, number | null> = {};
    for (const id of ids) {
      const el = [...document.querySelectorAll(`[data-testid="${id}"]`)].find(
        (candidate) => candidate.getBoundingClientRect().height > 0,
      );
      out[id] = el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null;
    }
    return out;
  }, roster as string[]);
}

/** Single-line controls whose height comes from their own padding, not their content. */
const MAP_ROSTER = [
  "topology-index-fold",
  "topology-index-search",
  "topology-index-segment-all",
  "topology-index-segment-recent",
] as const;

test("every map INDEX control height is a step on the ladder", async ({ page }) => {
  test.setTimeout(90_000);
  await openMap(page, 1440, 900);
  const steps = await ladder(page);
  expect(steps, "could not derive the ladder from tokens").toEqual([24, 28, 32, 36, 40, 44]);

  const measured = await heights(page, MAP_ROSTER);
  // An idling roster is the same as no gate: every name must actually render.
  for (const id of MAP_ROSTER) {
    expect(measured[id], `${id} was not rendered, so the list spins idle`).not.toBeNull();
  }
  const offenders = Object.entries(measured)
    .filter(([, h]) => h !== null && !steps.includes(h))
    .map(([id, h]) => `${id}=${h}px`);
  expect(offenders, "Height off the ladder. Do not add an axis; move it to the nearest step.").toEqual([]);
});

test("search palette result rows sit on a ladder step", async ({ page }) => {
  test.setTimeout(90_000);
  await openMap(page, 1440, 900);
  const steps = await ladder(page);

  await page.getByTestId("topology-concept-search").click();
  const rows = page.locator("[cmdk-item]");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });

  const measured = await page.evaluate(() =>
    [...document.querySelectorAll("[cmdk-item]")]
      .map((el) => Math.round(el.getBoundingClientRect().height * 10) / 10)
      .filter((h) => h > 0),
  );
  expect(measured.length, "no result row could be measured").toBeGreaterThan(3);
  expect([...new Set(measured)].filter((h) => !steps.includes(h)), "result row heights").toEqual([]);
});
