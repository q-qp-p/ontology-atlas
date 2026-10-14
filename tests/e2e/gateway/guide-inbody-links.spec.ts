import { expect, test } from "@playwright/test";

/**
 * Source links are written without a locale prefix and the renderer must attach it;
 * contract tests on source strings cannot see that, so the links are opened in a browser.
 */

/** Both locales are checked — baking a locale into one drags the other with it. */
const LOCALES = ["ko", "en"] as const;

test.describe("guide in-body links", () => {
  for (const locale of LOCALES) {
    test(`/${locale}: in-body internal links carry the locale and really open`, async ({ page, baseURL }) => {
      test.setTimeout(180_000);

      await page.goto(`/${locale}/guide/`, { waitUntil: "domcontentloaded" });
      const chapters = await page.evaluate(
        (loc) => [
          ...new Set(
            [...document.querySelectorAll(`a[href^="/${loc}/guide/"]`)].map((a) =>
              a.getAttribute("href"),
            ),
          ),
        ],
        locale,
      );
      // Idling guard — with no chapter found, the loop below never runs at all.
      expect(chapters.length, "no guide chapter was found, so the table-of-contents selector is stale").toBeGreaterThan(5);

      const missingLocale: string[] = [];
      const dead: string[] = [];
      let checked = 0;

      for (const chapter of chapters) {
        await page.goto(`${chapter}`, { waitUntil: "domcontentloaded" });
        const hrefs = await page.evaluate(() => {
          const body = document.querySelector("article") ?? document.querySelector("main");
          if (!body) return [];
          return [...body.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute("href") ?? "");
        });
        for (const href of hrefs) {
          checked += 1;
          if (!new RegExp(`^/(ko|en)/`).test(href)) {
            missingLocale.push(`${chapter} → ${href}`);
            continue;
          }
          if (!href.startsWith(`/${locale}/`)) {
            missingLocale.push(`${chapter} → ${href} (leaks to another locale)`);
            continue;
          }
          const res = await page.request.get(`${baseURL}${href}`);
          if (!res.ok()) dead.push(`${chapter} → ${href} (${res.status()})`);
        }
      }

      // With 0 links the two assertions above pass as "nothing diverged" — that is not a pass.
      expect(checked, "no in-body internal link was found, so this test spins idle").toBeGreaterThan(10);

      expect(
        missingLocale,
        "The body link has no locale: the renderer does not send internal links through Link. " +
          "Pressing it as it is gives a 404.",
      ).toEqual([]);
      expect(dead, "in-body links do not open").toEqual([]);
    });
  }
});
