import { expect, test } from "@playwright/test";
import { seedFirstRunSeen } from "../../first-run-seed";
import { waitForMapStill } from "../../settle";

/**
 * Both path ends take the top label band, since a greedy placer would otherwise hand the
 * space to the domain and project before the capability.
 */
type Probe = {
  nodes: () => Array<{ id: string; hidden: boolean; alpha: number }>;
  labels: () => Array<{ nodeId: string }>;
};
const FROM = "capability:exchange-request";
const TO = "capability:stock-reservation";

test("a path shows the names of both ends", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1512, height: 806 });
  await seedFirstRunSeen(page);
  await page.goto(
    `/ko/topology/?e2e=1&guides=off&mode=path&pathFrom=${encodeURIComponent(FROM)}&pathTo=${encodeURIComponent(TO)}`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(() => Boolean((window as unknown as { __atlasMap?: unknown }).__atlasMap), null, { timeout: 30_000 });
  await waitForMapStill(page, { what: "camera" });

  const read = () =>
    page.evaluate(
      ([from, to]) => {
        const m = (window as unknown as { __atlasMap: Probe }).__atlasMap;
        const named = new Set(m.labels().map((l) => l.nodeId));
        const node = (id: string) => m.nodes().find((n) => n.id === id) ?? null;
        return {
          from: node(from) && { drawn: !node(from)!.hidden, alpha: node(from)!.alpha, named: named.has(from) },
          to: node(to) && { drawn: !node(to)!.hidden, alpha: node(to)!.alpha, named: named.has(to) },
        };
      },
      [FROM, TO],
    );

  // The lens found the path: both ends are on the map at full ink.
  await expect.poll(async () => (await read()).to?.drawn, { timeout: 15_000, message: "the end of the path is not on the map" }).toBe(true);
  // The lens ramps its ends up on its own clock; poll until both have arrived at full ink.
  await expect
    .poll(async () => {
      const state = await read();
      return Math.min(state.from?.alpha ?? 0, state.to?.alpha ?? 0);
    }, { timeout: 15_000, message: "the end of the path was not drawn with full ink" })
    .toBeGreaterThan(0.8);

  await expect
    .poll(async () => [(await read()).from?.named, (await read()).to?.named], {
      timeout: 15_000,
      message: "one of the two ends of the path has no name",
    })
    .toEqual([true, true]);
});
