import { expect, test } from "@playwright/test";

import { FIXTURE_VAULT } from "../../fixture-vault";
import { seedFirstRunSeen } from "../../first-run-seed";
import { waitForMapSettled } from "../../settle";
import { stubDirectoryPicker } from "../../vault-picker-stub";

/**
 * Locks that the first-screen fit (`computeOverviewCameraTarget`) shows nearly all nodes; an
 * off-screen node highlights nothing. `__atlasMap.nodes()` already returns screen coordinates,
 * so do not apply the camera transform again.
 */

/** Minimum share that must be visible on the first screen. Measured 19/20 = 95%. */
const MIN_ON_SCREEN_RATIO = 0.8;

test("the first screen shows almost every node", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1512, height: 900 });
  await stubDirectoryPicker(page, { ...FIXTURE_VAULT });
  await seedFirstRunSeen(page);
  await page.goto("/ko/topology/?e2e=1&guides=off");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("first-run-starter-open").click();
  await expect(page.getByTestId("vault-guide-sheet")).toBeVisible();
  await page.getByTestId("vault-guide-pick-existing").click();
  await expect(page.getByTestId("first-run-starter")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId("ontology-map-canvas")).toBeVisible({ timeout: 30_000 });
  /*
   * Waits for layout to settle by value (node coordinates barely move between consecutive frames),
   * since counting while nodes move gives a different number every run.
   */
  await waitForMapSettled(page, { timeout: 60_000 });

  const census = await page.evaluate(() => {
    const map = (
      window as unknown as {
        __atlasMap?: {
          nodes: () => Array<{ id: string; x: number; y: number }>;
          camera: () => { x: number; y: number; scale: number; width: number; height: number } | null;
        };
      }
    ).__atlasMap;
    if (!map) return null;
    const cam = map.camera();
    if (!cam) return null;
    const nodes = map.nodes();
    // ⚠️ `nodes()` already returns **screen coordinates** (its implementation applies
    // the camera transform internally). Transforming again here puts everything off
    // screen — measuring that way really did produce a false "0 of 20 on screen".
    const inside = nodes.filter(
      (n) => n.x >= 0 && n.x <= cam.width && n.y >= 0 && n.y <= cam.height,
    );
    return { total: nodes.length, inside: inside.length, outside: nodes.length - inside.length, cam };
  });

  expect(census, "the map hook did not open and nothing was measured").not.toBeNull();
  const { total, inside, outside } = census as { total: number; inside: number; outside: number };
  console.log(`[census] nodes ${total} · on screen ${inside} · off screen ${outside}`);
  expect(total, "no node could be read, so this test measures nothing").toBeGreaterThan(3);
  expect(
    inside / total,
    `The first screen shows only ${Math.round((inside / total) * 100)}% of the nodes ` +
      `(${outside} off screen). The first-screen fit is off or the layout scattered.`,
  ).toBeGreaterThanOrEqual(MIN_ON_SCREEN_RATIO);
});
