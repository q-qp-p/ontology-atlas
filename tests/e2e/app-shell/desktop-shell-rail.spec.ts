import { expect, test } from "@playwright/test";
import { seedFirstRunSeen } from "../first-run-seed";
import { waitForBoxStill } from "../settle";

const DESKTOP_INIT = () => {
  (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
    invoke: () => Promise.reject(new Error("stub")),
    transformCallback: (cb: unknown) => cb,
  };
  (window as unknown as { isTauri?: boolean }).isTauri = true;
};

/**
 * The rail is present and has stopped moving.
 *
 * `networkidle` says the network is quiet, not that the shell has decided whether this
 * visitor gets a rail — the decision arrives with the vault state and then the rail
 * animates to its width. Waiting for the box to repeat across frames reads the width the
 * shell settled on; 1.5 s was one machine's guess at when that would be.
 */
async function railSettled(page: import("@playwright/test").Page) {
  const rail = page.locator('[data-testid="app-nav-rail"]');
  await expect(rail).toHaveCount(1, { timeout: 20_000 });
  await waitForBoxStill(rail);
}

async function railState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const rail = document.querySelector('[data-testid="app-nav-rail"]');
    if (!rail) return { present: false, width: 0, hidden: null as string | null };
    return {
      present: true,
      width: Math.round(rail.getBoundingClientRect().width),
      hidden: rail.getAttribute("data-hidden"),
    };
  });
}

test.describe("left rail of the desktop shell", () => {
  test("`/` in the installed app without a vault shows only first run and hides the rail", async ({ page }) => {
    await page.addInitScript(DESKTOP_INIT);
    await page.setViewportSize({ width: 1512, height: 949 });
    await seedFirstRunSeen(page);
    await page.goto("/ko/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("first-run-open")).toBeVisible();
    await railSettled(page);
    await expect(page.getByText("Storefront Services")).toHaveCount(0);
    const rail = await railState(page);
    expect(rail.present, "the rail is not in the DOM").toBe(true);
    expect(
      rail.width,
      "workbench destinations that cannot be reached yet are exposed on the first-run screen without a vault",
    ).toBe(0);
    expect(rail.hidden).toBe("true");
  });

  test("`/` on the web gateway still hides the rail, so the fix did not break the other side", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1512, height: 949 });
    await seedFirstRunSeen(page);
    await page.goto("/ko/", { waitUntil: "networkidle" });
    await railSettled(page);

    const rail = await railState(page);
    expect(rail.present, "the rail must stay in the DOM (hidden, not unmounted)").toBe(true);
    expect(
      rail.width,
      "the workbench rail appeared on the gateway for a web visitor without a vault, seven doors that lead nowhere yet",
    ).toBe(0);
  });

  test("the map address has the rail on both surfaces", async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 949 });
    await seedFirstRunSeen(page);
    await page.goto("/ko/topology/", { waitUntil: "networkidle" });
    await railSettled(page);
    expect((await railState(page)).width).toBeGreaterThan(0);
  });

  /** Measures the rendered border width; no value lint can see a border that a shape adds. */
  test("rail destination tiles have no drawn border", async ({ page }) => {
    await page.goto("/ko/topology/?guides=off");
    await expect(page.getByTestId("app-nav-rail-item-map")).toBeVisible();

    const tiles = await page.evaluate(() => {
      return [...document.querySelectorAll('[data-testid^="app-nav-rail-item-"]')].map((el) => {
        const c = getComputedStyle(el);
        return {
          id: el.getAttribute("data-testid"),
          borderWidth: c.borderTopWidth,
          borderStyle: c.borderTopStyle,
        };
      });
    });

    // Idling guard — if no tiles are found, the 0 violations below are not "because it is
    // clean".
    expect(tiles.length, "rail tiles were not found, so the selector is stale").toBeGreaterThan(4);

    const bordered = tiles.filter((t) => t.borderWidth !== "0px" && t.borderStyle !== "none");
    expect(
      bordered,
      "A border was drawn on a rail tile: the hairline the value-layer shape brought along. " +
        "This tile borrows only the focus-ring geometry from card (border-0)",
    ).toEqual([]);
  });
});
