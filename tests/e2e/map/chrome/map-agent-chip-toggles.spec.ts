import { expect, test } from "@playwright/test";
import { installDesktopRailRuntime } from "../../desktop-rail-arrival-harness";
import { waitForMapStill } from "../../settle";

test("pressing the agent chip again closes it and the map regains its width", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1512, height: 900 });
  await installDesktopRailRuntime(page);
  await page.goto("/ko/?guides=off&e2e=1", { waitUntil: "domcontentloaded" });
  await page.getByTestId("first-run-open").click().catch(() => {});
  await waitForMapStill(page).catch(() => {});

  const chip = page.getByTestId("topology-vault-agent-toggle");
  const canvasWidth = () =>
    page.evaluate(() => Math.round(document.querySelector('[data-testid="ontology-map-canvas"]')!.getBoundingClientRect().width));

  await expect(chip).toHaveAttribute("aria-expanded", "false");
  const wide = await canvasWidth();
  expect(wide, "the map is already narrow, so the spec spins idle").toBeGreaterThan(1200);

  await chip.click();
  await expect(chip).toHaveAttribute("aria-expanded", "true");
  await expect.poll(canvasWidth, { timeout: 10_000 }).toBeLessThan(wide - 100);

  await chip.click();
  await expect(chip, "it stays open even after pressing again").toHaveAttribute("aria-expanded", "false");
  await expect.poll(canvasWidth, { timeout: 10_000, message: "the map did not regain its width after closing" }).toBe(wide);
});
