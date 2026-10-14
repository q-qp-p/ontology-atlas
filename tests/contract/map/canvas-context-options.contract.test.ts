import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **The main canvas is opaque; offscreen buffers are not.**
 *
 * Per spec, `getContext("2d", { alpha: false })` pins every pixel's alpha to 1.0,
 * and Blink uses that to set `SetContentsOpaque()` on the compositor layer — a
 * hint that blending with page content behind the canvas can be skipped.
 *
 * **This contract is needed because the benefit is invisible where it happens.**
 * The saving occurs at composite, not in JS frame time, so it never shows up in a
 * `performance.mark` profile. That makes it easy for the next person to measure,
 * see no difference, and delete the option — and reverting it leaves the screen
 * looking exactly as fine.
 *
 * ⚠️ **The opposite direction matters just as much.** Offscreen buffers
 * (`render/grid.ts`, `render/animated-background.ts`) are **composited on top of**
 * the main canvas and therefore need alpha. Spreading `alpha: false` to them makes
 * background tiles occlude each other — "it's a good option, put it everywhere"
 * is exactly how that defect arrives.
 *
 * Hence a contract test rather than a global lint rule: `no-restricted-syntax`
 * sees one file's AST and cannot tell whether a canvas is attached to the screen
 * or is a buffer.
 */

const MAIN_CANVAS = "src/widgets/ontology-map/ui/frame-loop/use-topology-frame-loop.ts";
const COMPOSITION = "src/widgets/ontology-map/ui/loop/use-topology-loop.ts";
const OFFSCREEN = [
  "src/widgets/ontology-map/render/grid.ts",
  "src/widgets/ontology-map/render/animated-background.ts",
];

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("canvas 2d context options contract", () => {
  it("reads the source for real, so an empty scan is a defect rather than a pass", () => {
    expect(read(MAIN_CANVAS).length).toBeGreaterThan(1000);
    expect(read(COMPOSITION)).toMatch(/useTopologyFrameLoop\(\{\s*canvasRef,/);
    for (const rel of OFFSCREEN) expect(read(rel).length).toBeGreaterThan(200);
  });

  it("the main canvas is created with `alpha: false`", () => {
    const src = read(MAIN_CANVAS);
    expect(
      /getContext\(\s*["']2d["']\s*,\s*\{[^}]*alpha:\s*false/.test(src),
      "the main canvas is created without the opaque option, so the compositor blends it with the content behind it every frame",
    ).toBe(true);
  });

  it("offscreen buffers do not inherit `alpha: false`", () => {
    for (const rel of OFFSCREEN) {
      const src = read(rel);
      expect(
        /getContext\(\s*["']2d["']\s*,\s*\{[^}]*alpha:\s*false/.test(src),
        `${rel} is created opaque, but this buffer is composited over the main canvas and needs alpha`,
      ).toBe(false);
    }
  });

  it("does not turn on `willReadFrequently`, since we never read back", () => {
    // Per spec this hint steers toward CPU (software) raster to make readback fast.
    // A renderer that never calls `getImageData` and turns it on is discarding GPU
    // acceleration for nothing.
    const all = [MAIN_CANVAS, ...OFFSCREEN].map(read).join("\n");
    expect(all.includes("willReadFrequently")).toBe(false);
  });

  it("handles context loss, because otherwise the browser does not try to recover", () => {
    // Without preventDefault on `contextlost` there is no recovery and no
    // `contextrestored`. The rAF loop keeps running while the screen stays blank and
    // nothing throws.
    const src = read(MAIN_CANVAS);
    expect(src.includes('addEventListener("contextlost"'), "contextlost is not handled").toBe(true);
    expect(src.includes('addEventListener("contextrestored"'), "contextrestored is not handled").toBe(true);
    expect(src.includes("removeEventListener(\"contextlost\""), "listener cleanup is missing").toBe(true);
  });
});
