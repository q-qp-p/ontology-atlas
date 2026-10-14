import { expect, test, type Page } from "@playwright/test";

import { AUDITED_ROUTES } from "../audited-routes";
import { seedFirstRunSeen } from "../first-run-seed";
import { waitForPageSettled } from "../settle";

/**
 * Measured on the rendered result because a missing cursor rule leaves no value in the code.
 * Disabled controls, the canvas and scrims are deliberately not measured.
 */
const VIEWPORT = { width: 1512, height: 900 };

/** Measures only controls that are really rendered, not disabled, and not over the canvas. */
async function measure(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button, summary, a[href]")]
      .filter((el) => {
        const c = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return false;
        if (c.visibility === "hidden" || c.display === "none" || Number(c.opacity) < 0.05) return false;
        if (r.top >= innerHeight || r.bottom <= 0 || r.left >= innerWidth || r.right <= 0) return false;
        if (el.closest("details:not([open])")) return false;
        if ((el as HTMLButtonElement).disabled) return false;
        if (el.getAttribute("aria-disabled") === "true") return false;
        return true;
      })
      .map((el) => ({
        cursor: getComputedStyle(el).cursor,
        tag: el.tagName.toLowerCase(),
        label: (el.textContent || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 28),
      })),
  );
}

for (const route of AUDITED_ROUTES) {
  test(`cursor affordance: every active control on ${route} is pointer`, async ({ page }) => {
    await seedFirstRunSeen(page);
    await page.setViewportSize(VIEWPORT);
    const destination = route === "/ko/docs/" ? "/ko/library/?tab=ontology" : route;
    await page.goto(`${destination}${destination.includes("?") ? "&" : "?"}guides=off`, {
      waitUntil: "domcontentloaded",
    });
    if (route === "/ko/docs/") {
      await expect(page).toHaveURL(
        (url) => url.pathname === "/ko/library/" && url.searchParams.get("tab") === "ontology",
      );
      await expect(
        page.locator('#library-workspace-tabpanel-ontology [data-docs-viewer]'),
      ).toBeVisible();
    }
    await page.waitForSelector("main", { timeout: 20_000 });
    await waitForPageSettled(page);

    const controls = await measure(page);

    // The detector must not run on an empty set — with 0 controls this assertion is a free pass.
    expect(controls.length, "zero controls were measured on this screen, so the gate spins idle").toBeGreaterThan(0);

    const offenders = controls.filter((c) => c.cursor !== "pointer");
    expect(
      offenders.map((c) => `${c.tag}«${c.label}» → ${c.cursor}`),
      "an active control is not pointer; check the base cursor rule in app/globals.css",
    ).toEqual([]);
  });
}

/**
 * Confirms the method itself distinguishes "not pointer" (`/gate-probe`).
 *
 * The check above passes on an empty list. If the filter quietly over-excludes
 * (say, every control is classified as disabled), it stays green while the defect
 * lives. So **a deliberately non-pointer button** is planted on the same page and
 * the probe confirms it is caught.
 */
test("the verdict method really catches a non-pointer button, so the check does not spin idle", async ({ page }) => {
  await seedFirstRunSeen(page);
  await page.setViewportSize(VIEWPORT);
  await page.goto("/ko/?guides=off", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 20_000 });

  const before = (await measure(page)).filter((c) => c.cursor !== "pointer");
  expect(before, "if a violation exists before planting, the probe is meaningless").toEqual([]);

  await page.evaluate(() => {
    const b = document.createElement("button");
    b.textContent = "probe";
    b.style.cursor = "default";
    b.style.width = "40px";
    b.style.height = "20px";
    document.body.prepend(b);
  });

  const after = (await measure(page)).filter((c) => c.cursor !== "pointer");
  expect(after.length, "the planted violation is not caught, so the filter is excluding too much").toBe(1);
});
