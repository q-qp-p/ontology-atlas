import { expect, test } from "@playwright/test";

import { seedFirstRunSeen } from "../first-run-seed";
import { waitForAnimationsDone, waitForBoxStill } from "../settle";
import { stubDirectoryPicker } from "../vault-picker-stub";

/** The dialog is resized while open; measuring only at open time leaves a shrunk window unmeasured. */

const WIDTHS = [1512, 1040] as const;
const DIALOG_W_SM = 420;
const VIEWPORT_INSET = 32; // calc(100vw - 2rem)

test("the center Dialog keeps its scrim, width formula and containment at three widths", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  await seedFirstRunSeen(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Choose the actual FileSystemDirectoryHandle (OPFS), but place one document in advance
  // to avoid going through the starter scaffold, which is not the subject of this test.
  await stubDirectoryPicker(page, {
    "capabilities/dialog-fixture.md": [
      "---",
      "uid: 22222222-2222-4222-8222-222222222222",
      "kind: capability",
      "title: Dialog fixture",
      "slug: capabilities/dialog-fixture",
      "---",
      "",
      "# Dialog fixture",
      "",
    ].join("\n"),
  });
  await page.goto("/ko/topology/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("first-run-starter-open").click();
  await expect(page.getByTestId("vault-guide-sheet")).toBeVisible();
  await page.getByTestId("vault-guide-pick-existing").click();
  await expect(page.getByTestId("first-run-starter")).toHaveCount(0, { timeout: 30_000 });

  // Open the small Ontology new-node dialog after the reader sees the same local handle.
  await page.goto("/ko/docs/", { waitUntil: "domcontentloaded" });
  const treeButton = page.getByRole("navigation", { name: "문서 목록" }).getByRole("button").first();
  await expect(treeButton).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("docs-sidebar-new-doc").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog, `pageerrors: ${pageErrors.join(" | ") || "(none)"}`).toBeVisible();

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    // Wait for the layout that applies the resize — a rect is a fact that follows layout.
    await waitForAnimationsDone(page.getByRole("dialog"));
    await waitForBoxStill(page.getByRole("dialog"));

    const rects = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('[role="dialog"]');
      const scrim = panel?.parentElement ?? null;
      if (!panel || !scrim) return null;
      const p = panel.getBoundingClientRect();
      const s = scrim.getBoundingClientRect();
      return {
        panel: { x: p.x, y: p.y, w: p.width, h: p.height },
        scrim: { x: s.x, y: s.y, w: s.width, h: s.height },
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });
    expect(rects, `${width}px: the dialog disappeared`).not.toBeNull();
    if (!rects) return;

    // ① The scrim covers the whole viewport.
    expect(rects.scrim.x, `${width}px scrim x`).toBe(0);
    expect(rects.scrim.y, `${width}px scrim y`).toBe(0);
    expect(Math.round(rects.scrim.w), `${width}px scrim width`).toBe(rects.vw);
    expect(Math.round(rects.scrim.h), `${width}px scrim height`).toBe(rects.vh);

    // ② The width formula min(420, vw − 2rem), tolerating 1px of sub-pixel error.
    const expected = Math.min(DIALOG_W_SM, rects.vw - VIEWPORT_INSET);
    expect(
      Math.abs(rects.panel.w - expected),
      `${width}px panel width ${rects.panel.w} ≠ formula ${expected}`,
    ).toBeLessThanOrEqual(1);

    // ③ The panel sits entirely inside the viewport.
    expect(rects.panel.x, `${width}px panel left`).toBeGreaterThanOrEqual(0);
    expect(rects.panel.y, `${width}px panel top`).toBeGreaterThanOrEqual(0);
    expect(rects.panel.x + rects.panel.w, `${width}px panel right`).toBeLessThanOrEqual(rects.vw + 1);
    expect(rects.panel.y + rects.panel.h, `${width}px panel bottom`).toBeLessThanOrEqual(rects.vh + 1);
  }
});
