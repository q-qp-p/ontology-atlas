import { expect, test } from "@playwright/test";
import { seedFirstRunSeen } from "../first-run-seed";
import { stubDirectoryPicker } from "../vault-picker-stub";

test("the activity row exists in one place only, and the inbox is fully visible when opened", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1512, height: 900 });

  // A completed log inside the 24-hour window with no heartbeat — the "last activity" state.
  const at = new Date(Date.now() - 20 * 60_000).toISOString();
  const line = JSON.stringify({
    v: 1,
    at,
    tool: "add_concept",
    target: "capabilities/pay",
    summary: "add_concept capability:capabilities/pay",
    agent: "codex-acp",
    why: null,
  });

  await seedFirstRunSeen(page);
  await stubDirectoryPicker(page, {
    "shop.md": `---\nuid: 11111111-1111-4111-8111-111111111111\nslug: shop\nkind: project\ntitle: Chip Shop\ncontains:\n  - capabilities/pay\n---\n\n# Chip Shop\n`,
    "capabilities/pay.md": `---\nuid: 22222222-2222-4222-8222-222222222222\nslug: capabilities/pay\nkind: capability\ntitle: Pay\n---\n\n# Pay\n`,
    ".ontology-atlas/activity.jsonl": `${line}\n`,
  });

  await page.goto("/ko/topology/?e2e=1&guides=off", { waitUntil: "domcontentloaded" });
  await page.getByTestId("first-run-starter-open").click();
  await page.getByTestId("vault-guide-pick-existing").click();

  const bell = page.getByTestId("agent-activity-bell");
  await expect(bell, "the bell did not appear; a write from 20 minutes ago lives inside the inbox").toBeVisible({
    timeout: 30_000,
  });

  // ① The same fact must not appear in two places.
  await expect(
    page.getByTestId("agent-activity-chip"),
    "the activity row is drawn in two places; one must go",
  ).toHaveCount(1);

  // ② The bell is a control holding a single icon — a text-row box stretches it horizontally.
  const bellBox = (await bell.boundingBox())!;
  expect(
    +(bellBox.width / bellBox.height).toFixed(2),
    `the bell stretched horizontally (${Math.round(bellBox.width)}×${Math.round(bellBox.height)})`,
  ).toBeLessThanOrEqual(1.35);

  // The bell's status cell is not inside the row, but in the rightmost single cell of the top-right toolbar.
  const utilityRow = page.getByTestId('topology-utility-action-row');
  const utilityRowBox = (await utilityRow.boundingBox())!;
  expect(Math.abs(bellBox.y - utilityRowBox.y), 'the bell is not on the same row as the utility row above').toBeLessThanOrEqual(1);
  expect(
    Math.abs(bellBox.x + bellBox.width - (utilityRowBox.x + utilityRowBox.width)),
    'the bell is not at the far right of the utility row',
  ).toBeLessThanOrEqual(1);
  const statusBox = (await page.getByTestId('agent-activity-status-trigger').boundingBox())!;
  expect(Math.abs(statusBox.y - bellBox.y), 'the job status is not on the same line as the bell').toBeLessThanOrEqual(1);
  expect(
    Math.abs(statusBox.x + statusBox.width - bellBox.x),
    'the job status is not attached to the bell',
  ).toBeLessThanOrEqual(1);
  const statusLabelFits = await page.getByTestId('agent-activity-status').evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  );
  expect(statusLabelFits, 'Codex and the last job time were clipped by the utility row width').toBe(true);

  // ③ When opened, everything must be visible — it must not go off-screen or cover the utility bar.
  await bell.click();
  const inbox = page.getByTestId("agent-activity-inbox");
  await expect(inbox).toBeVisible();
  const inboxBox = (await inbox.boundingBox())!;
  const view = page.viewportSize()!;

  expect(inboxBox.width, 'the inbox stayed at the old narrow 280px width').toBeGreaterThanOrEqual(340);

  expect(Math.round(inboxBox.y), "the top edge of the inbox is cut off above the screen").toBeGreaterThanOrEqual(0);
  expect(
    Math.round(inboxBox.y + inboxBox.height),
    "the bottom edge of the inbox is cut off below the screen",
  ).toBeLessThanOrEqual(view.height);
  expect(Math.round(inboxBox.x), "the left edge of the inbox is outside the screen").toBeGreaterThanOrEqual(0);
  expect(
    Math.round(inboxBox.x + inboxBox.width),
    "the right edge of the inbox is outside the screen",
  ).toBeLessThanOrEqual(view.width);

  // Covering the utility row (agents, recent changes) makes those buttons unreadable.
  const lane = page.getByTestId("topology-utility-action-lane").locator("> div").first();
  const laneBox = (await lane.boundingBox())!;
  const overlaps =
    inboxBox.x < laneBox.x + laneBox.width &&
    laneBox.x < inboxBox.x + inboxBox.width &&
    inboxBox.y < laneBox.y + laneBox.height &&
    laneBox.y < inboxBox.y + inboxBox.height;
  expect(overlaps, "the inbox covers the utility button row above").toBe(false);

  /*
   * Judged by what is actually hit at the point (elementFromPoint);
   * computed z-index misleads across stacking contexts.
   */
  const topAtInbox = await page.evaluate(() => {
    const inbox = document.querySelector('[data-testid="agent-activity-inbox"]');
    if (!inbox) return { ok: false, reason: "there is no inbox" };
    const r = inbox.getBoundingClientRect();
    /*
     * ⚠️ **Sample all the way to the edges.** The first version sampled only
     * 0.15–0.85, and the tool tile actually covering the tray sat within 36px of its
     * right edge, so the probe **missed by 6px** and returned green with the defect
     * intact. Overlap usually happens at the edges, so a probe that samples only the
     * interior cannot see this defect in principle.
     */
    const fractions = [0.02, 0.25, 0.5, 0.75, 0.98];
    const points = fractions.flatMap((fx) =>
      fractions.map((fy) => ({ x: r.x + r.width * fx, y: r.y + r.height * fy })),
    );
    const covered = points
      .map((p) => ({ p, el: document.elementFromPoint(p.x, p.y) }))
      .filter(({ el }) => !el || !inbox.contains(el))
      .map(({ p, el }) => ({
        at: { x: Math.round(p.x), y: Math.round(p.y) },
        by: el ? `${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}]` : ""}` : "null",
      }));
    return { ok: true, covered };
  });
  expect(topAtInbox.ok, topAtInbox.reason).toBe(true);
  expect(
    topAtInbox.covered,
    "something else is drawn over the inbox, trapped in the utility lane's stacking context",
  ).toEqual([]);

  // On a translucent panel, even a winning z-index shows the control behind it
  // through the surface, so its icon reads as a row action. The geometry itself must
  // not overlap controls outside the card.
  const outsideControlOverlaps = await page.evaluate(() => {
    const inbox = document.querySelector('[data-testid="agent-activity-inbox"]');
    if (!inbox) return [{ reason: "inbox-missing" }];
    const a = inbox.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('button, a')]
      .filter((element) => !inbox.contains(element) && !element.contains(inbox))
      .map((element) => {
        const b = element.getBoundingClientRect();
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return width > 0.5 && height > 0.5
          ? { aria: element.getAttribute('aria-label'), width, height }
          : null;
      })
      .filter(Boolean);
  });
  expect(
    outsideControlOverlaps,
    "map tools behind the inbox show through and look like row actions; the tool column and rect must be separated",
  ).toEqual([]);
});
