import { expect, test } from "@playwright/test";
import { seedFirstRunSeen } from "../../first-run-seed";
import { waitForMapStill } from "../../settle";

/** One thing, one name inside a realm: the ledger header reads the localized `display`, not `title`. */
test("one name per thing, even inside a realm", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1512, height: 900 });
  await seedFirstRunSeen(page);
  await page.goto("/ko/topology/?e2e=1&guides=off&realm=domain%3Apayment", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean((window as unknown as { __atlasMap?: unknown }).__atlasMap), null, { timeout: 30_000 });
  await waitForMapStill(page, { what: "camera" });

  const ledgerTitle = page.getByTestId("topology-realm-title");
  const chipTitle = page.getByTestId("topology-realm-chip-title");
  await expect(ledgerTitle).toBeVisible();
  await expect(chipTitle).toBeVisible();

  const onCanvas = await page.evaluate(() => {
    const m = (window as unknown as { __atlasMap: { nodes: () => Array<{ id: string; label: string }> } }).__atlasMap;
    return m.nodes().find((n) => n.id === "domain:payment")?.label ?? null;
  });
  expect(onCanvas, "the payment node was not found on the map, so the spec spins idle").toBeTruthy();

  const chip = (await chipTitle.textContent())?.trim();
  const ledger = (await ledgerTitle.textContent())?.trim();
  expect(chip, "the chip uses a different name from the map").toBe(onCanvas);
  expect(ledger, "the ledger header uses a different name from the map and chip").toBe(onCanvas);
});
