import { expect, test } from "@playwright/test";

import { FIXTURE_VAULT } from "../../fixture-vault";
import { seedFirstRunSeen } from "../../first-run-seed";
import { stubDirectoryPicker } from "../../vault-picker-stub";

/**
 * The slug must exist only in the fixture:
 * a slug also in the sample vault cannot show which vault opened it.
 */
const DEEP_SLUG = "capabilities/deeplink-probe";
const DEEP_TITLE = /딥링크 표적 문서/;


/**
 * Click until the menu opens, but not when it is open: on dev a click before hydration is lost,
 * and clicking an open menu closes it.
 */
async function openVaultChipMenu(page: import("@playwright/test").Page): Promise<void> {
  /*
   * Pick the visible one: during a transition old and new trees are mounted together
   * and the testid matches twice.
   */
  const trigger = page.locator('[data-testid="vault-chip-menu-trigger"]:visible');
  const anyRow = page.locator('[data-testid="vault-chip-use-sample"]:visible');
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(
      async () => {
        if (await anyRow.isVisible().catch(() => false)) return true;
        await trigger.click({ timeout: 5_000 }).catch(() => undefined);
        return anyRow.isVisible().catch(() => false);
      },
      {
        timeout: 20_000,
        message:
          "the vault chip menu did not open; in dev a click before hydration is lost, so press again",
      },
    )
    .toBe(true);
}

async function switchToSample(page: import("@playwright/test").Page): Promise<void> {
  await openVaultChipMenu(page);
  await page.locator('[data-testid="vault-chip-use-sample"]:visible').click();
}

/** Is the current source local? Read from the radio state in the chip menu. */
async function expectSourceIsLocal(page: import("@playwright/test").Page): Promise<void> {
  await openVaultChipMenu(page);
  await expect(page.locator('[data-testid="vault-chip-use-local"]:visible')).toHaveAttribute(
    "aria-checked",
    "true",
    { timeout: 10_000 },
  );
  await page.keyboard.press("Escape");
  // Wait out the exit — a `Surface` stays in the DOM as inert while leaving, and a
  // text selector finds it too (this really caused a strict-mode conflict in
  // local-vault-picker).
  await expect(page.locator('[data-testid="vault-chip-use-sample"]:visible')).toBeHidden();
}

/** Is the current source the sample vault? */
async function expectSourceIsSample(page: import("@playwright/test").Page): Promise<void> {
  await openVaultChipMenu(page);
  await expect(page.locator('[data-testid="vault-chip-use-sample"]:visible')).toHaveAttribute(
    "aria-checked",
    "true",
    { timeout: 10_000 },
  );
  await page.keyboard.press("Escape");
  // Wait out the exit — a `Surface` stays in the DOM as inert while leaving, and a
  // text selector finds it too (this really caused a strict-mode conflict in
  // local-vault-picker).
  await expect(page.locator('[data-testid="vault-chip-use-sample"]:visible')).toBeHidden();
}

async function waitForIntegratedOntologyReader(
  page: import("@playwright/test").Page,
): Promise<string> {
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/ko/library/" &&
      url.searchParams.get("tab") === "ontology" &&
      Boolean(url.searchParams.get("slug")),
    { timeout: 20_000 },
  );
  await expect(
    page.locator('#library-workspace-tabpanel-ontology [data-docs-viewer]'),
  ).toBeVisible({ timeout: 20_000 });
  const slug = new URL(page.url()).searchParams.get("slug");
  expect(slug, "the unified Ontology reader became ready without a selected document").not.toBeNull();
  return slug!;
}

test.describe("document box deep link: the URL wins", () => {
  test("?slug= survives a cold load after the local vault is restored", async ({ page }) => {
    test.setTimeout(120_000);
    await stubDirectoryPicker(page, FIXTURE_VAULT);

    // ① Open the vault from the map — the handle persists in IndexedDB.
    await seedFirstRunSeen(page);
    await page.goto("/ko/topology/?guides=off");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("first-run-starter-open").click();
    await expect(page.getByTestId("vault-guide-sheet")).toBeVisible();
    await page.getByTestId("vault-guide-pick-existing").click();
    // If the vault does not attach, everything below measures the sample instead — the same evidence a11y-vault-backed uses.
    await expect(page.getByTestId("first-run-starter")).toHaveCount(0, { timeout: 30_000 });

    // ② Open the docs surface **without** a slug to create the stored "last
    //    document" — the deep-link-vs-last-document contest needs that value to exist.
    await page.goto("/ko/docs/?guides=off", { waitUntil: "domcontentloaded" });
    await expect
      .poll(async () => new URL(page.url()).searchParams.get("slug"), { timeout: 20_000 })
      .not.toBeNull();
    const restedSlug = new URL(page.url()).searchParams.get("slug");
    expect(restedSlug, "the default selection opened no document, so this test spins idle").not.toBeNull();
    expect(restedSlug).not.toBe(DEEP_SLUG);

    // ③ Cold-load deep link — if the defect is alive, the URL is overwritten here with ②'s slug.
    await page.goto(`/ko/docs/?guides=off&slug=${encodeURIComponent(DEEP_SLUG)}`, {
      waitUntil: "domcontentloaded",
    });
    // The URL can wobble until the vault finishes loading — measure the final state.
    await expect
      .poll(async () => new URL(page.url()).searchParams.get("slug"), { timeout: 20_000 })
      .toBe(DEEP_SLUG);
    await expect(
      page.getByTestId("gateway-doc-title").or(page.locator("main")).first(),
    ).toContainText(DEEP_TITLE, { timeout: 20_000 });
  });

  test("switching to the sample after settling drops the vault-only slug, keeping the earlier guarantee", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await stubDirectoryPicker(page, FIXTURE_VAULT);
    await seedFirstRunSeen(page);
    await page.goto("/ko/topology/?guides=off");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("first-run-starter-open").click();
    await expect(page.getByTestId("vault-guide-sheet")).toBeVisible();
    await page.getByTestId("vault-guide-pick-existing").click();
    // If the vault does not attach, everything below measures the sample instead — the same evidence a11y-vault-backed uses.
    await expect(page.getByTestId("first-run-starter")).toHaveCount(0, { timeout: 30_000 });

    await page.goto(`/ko/docs/?guides=off&slug=${encodeURIComponent(DEEP_SLUG)}`, {
      waitUntil: "domcontentloaded",
    });
    await expect
      .poll(async () => new URL(page.url()).searchParams.get("slug"), { timeout: 20_000 })
      .toBe(DEEP_SLUG);

    // Switch the source to sample from a settled state — a genuine vault switch.
    await switchToSample(page);
    await expect
      .poll(async () => new URL(page.url()).searchParams.get("slug"), { timeout: 20_000 })
      .not.toBe(DEEP_SLUG);
  });

  /**
   * Covers a profile whose stored source preference is `server`: the sample window reads as settled and
   * the later landing auto-switch is mistaken for a user vault switch.
   */
  test("a local-only deep link survives a cold load even for a profile that used the sample first", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await stubDirectoryPicker(page, FIXTURE_VAULT);
    await seedFirstRunSeen(page);

    // Leave traces of the sample scope first: preference, sample tabs and recents.
    await page.goto("/ko/docs/?guides=off", { waitUntil: "domcontentloaded" });
    await waitForIntegratedOntologyReader(page);
    await page.evaluate(() => {
      window.localStorage.setItem("demo:docs-vault:source", "server");
    });

    // Use docs on local once to create a last document, which would fill the slot of a cleared deep link.
    await page.goto("/ko/topology/?guides=off");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("first-run-starter-open").click();
    await expect(page.getByTestId("vault-guide-sheet")).toBeVisible();
    await page.getByTestId("vault-guide-pick-existing").click();
    await expect(page.getByTestId("first-run-starter")).toHaveCount(0, { timeout: 30_000 });
    await page.goto("/ko/docs/?guides=off", { waitUntil: "domcontentloaded" });
    const localRestedSlug = await waitForIntegratedOntologyReader(page);
    expect(localRestedSlug).not.toBe(DEEP_SLUG);

    // ③ Cold-load deep link with the stored preference still on sample — the deep
    //    link must survive while boot passes through "sample settles → landing
    //    auto-switch".
    // The address contradicting the deep link **for even one moment** is a defect.
    //    Which race freezes that cleared instant differs per device (on the real device
    //    tab restoration froze it and left README), and polling only the final value
    //    turns green wherever it self-healed. So every replaceState call is recorded and
    //    the assertion is "zero calls lost the slug".
    await page.addInitScript(() => {
      const w = window as unknown as { __urlTrace?: string[] };
      w.__urlTrace = [];
      const orig = history.replaceState.bind(history);
      history.replaceState = (s, ti, url) => {
        w.__urlTrace?.push(String(url));
        return orig(s, ti, url);
      };
    });
    await page.evaluate(() => {
      window.localStorage.setItem("demo:docs-vault:source", "server");
    });
    await page.goto(`/ko/docs/?guides=off&slug=${encodeURIComponent(DEEP_SLUG)}`, {
      waitUntil: "domcontentloaded",
    });
    await expect
      .poll(async () => new URL(page.url()).searchParams.get("slug"), { timeout: 20_000 })
      .toBe(DEEP_SLUG);
    await expect(
      page.getByTestId("gateway-doc-title").or(page.locator("main")).first(),
    ).toContainText(DEEP_TITLE, { timeout: 20_000 });
    // Search the full record up to the end of boot for any call that dropped the slug.
    const trace = await page.evaluate(
      () => (window as unknown as { __urlTrace?: string[] }).__urlTrace ?? [],
    );
    expect(trace.length, "replaceState was never called, so the instrumentation spins idle").toBeGreaterThan(0);
    const dropped = trace.filter(
      (url) => !url.includes(`slug=${encodeURIComponent(DEEP_SLUG)}`),
    );
    expect(
      dropped,
      "the address lost the deep link during boot; if tab restore fixes this instant in place, it becomes a real-device incident",
    ).toEqual([]);
  });

  /**
   * With a stored `local` preference the one-shot landing ref is never spent and bounces
   * the first manual switch back; the landing decision must conclude once.
   */
  test("with a stored local preference at boot, the first switch to the sample takes effect immediately", async ({ page }) => {
    test.setTimeout(120_000);
    await stubDirectoryPicker(page, FIXTURE_VAULT);
    await seedFirstRunSeen(page);
    await page.goto("/ko/topology/?guides=off");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("first-run-starter-open").click();
    await expect(page.getByTestId("vault-guide-sheet")).toBeVisible();
    await page.getByTestId("vault-guide-pick-existing").click();
    await expect(page.getByTestId("first-run-starter")).toHaveCount(0, { timeout: 30_000 });

    await page.evaluate(() => {
      window.localStorage.setItem("demo:docs-vault:source", "local");
    });
    await page.goto("/ko/docs/?guides=off", { waitUntil: "domcontentloaded" });
    await expectSourceIsLocal(page);

    await switchToSample(page);
    // The bounce-back is immediate — once the switch takes, it must stay.
    // measurement window: the defect bounced back within 300-1800 ms, so the switch must hold across that stretch.
    await page.waitForTimeout(1_500);
    await expectSourceIsSample(page);
  });
});
