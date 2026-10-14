import { expect, test } from "@playwright/test";
import { seedFirstRunSeen } from "../../first-run-seed";
import { waitForMapStill } from "../../settle";

/** A focused capability keeps its cross-domain needs drawn and named beside the detail panel. */
type DialProbe = {
  owns: boolean;
  discs: Array<{ id: string; x: number; y: number; r: number }>;
  texts: Array<{ id: string | null; text: string }>;
};
type Probe = {
  dial: () => DialProbe;
  selection: () => { nodeId: string | null };
  camera: () => { x: number; y: number };
  cameraTarget: () => { x: number; y: number };
};

const NEEDS = ["capability:return-pickup", "capability:stock-reservation"];

test("a selected concept also shows its neighbors from other domains on the map", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1512, height: 900 });
  await seedFirstRunSeen(page);
  await page.goto("/ko/topology/?e2e=1&guides=off&p=capability%3Aexchange-request", { waitUntil: "domcontentloaded" });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __atlasMap?: Probe }).__atlasMap?.selection().nodeId ?? null), { timeout: 15_000 })
    .toBe("capability:exchange-request");
  // Under a selection the focus ring keeps breathing, so node stillness never
  // arrives; the camera coming to rest is the frame this spec reads.
  await waitForMapStill(page, { what: "camera" });

  const read = await page.evaluate((needs) => {
    const m = (window as unknown as { __atlasMap: Probe }).__atlasMap;
    const c = m.camera();
    const t = m.cameraTarget();
    const dial = m.dial();
    const box = document.querySelector('[data-testid="ontology-map-canvas"]')!.getBoundingClientRect();
    const panel = document.querySelector('[data-testid="map-detail-panel"]')!.getBoundingClientRect();
    return {
      gap: Math.hypot(c.x - t.x, c.y - t.y),
      owns: dial.owns,
      panelLeft: panel.left,
      canvasLeft: box.left,
      discs: needs.map((id) => {
        const d = dial.discs.find((p) => p.id === id);
        return d ? { id, left: box.left + d.x - d.r, right: box.left + d.x + d.r } : null;
      }),
      named: needs.filter((id) => dial.texts.some((text) => text.id === id)),
    };
  }, NEEDS);

  // The camera has arrived: the focus target lies inside its leash, so the idle
  // gate can close. Before, the target sat 370 world units out and the loop ran
  // at full frame rate for as long as the node stayed selected.
  expect(read.gap, "the camera is not reaching its target").toBeLessThan(0.5);
  expect(read.owns, "the flat dial does not draw this screen").toBe(true);
  for (const [i, id] of NEEDS.entries()) {
    const disc = read.discs[i];
    expect(disc, `${id} was not drawn`).not.toBeNull();
    // Drawn is not seen: before the screen-sized leash the two dependencies
    // landed under the panel (x 1349 and 1369, panel from 1128).
    expect(disc!.right, `${id} is under the detail panel`).toBeLessThan(read.panelLeft);
    expect(disc!.left, `${id} was pushed outside the left edge of the canvas`).toBeGreaterThan(read.canvasLeft);
  }
  expect(read.named, "the names of neighbors from other domains are missing").toEqual(NEEDS);
});
