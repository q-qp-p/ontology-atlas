import { describe, expect, it } from "vitest";
import {
  IDLE_FLAT_SELECTION_CAMERA,
  SELECTION_NUDGE_MARGIN_PX,
  flatDeselectCamera,
  recordFlight,
  recordNudge,
  selectionNudgeTarget,
} from "./flat-selection-camera";

const view = { tx: 0, ty: 0, tscale: 1 };
const insets = { left: 300, right: 400 };

describe("flat selection camera", () => {
  it("slides only sideways, at the same scale, and only when the panel would cover the node", () => {
    expect(selectionNudgeTarget(view, { x: 0 }, 1600, insets)).toBeNull();
    const nudge = selectionNudgeTarget(view, { x: 600 }, 1600, insets)!;
    expect(nudge.ty).toBe(0);
    expect(nudge.tscale).toBe(1);
    expect((600 - nudge.tx) * nudge.tscale + 800).toBe(1600 - insets.right - SELECTION_NUDGE_MARGIN_PX);
    expect(selectionNudgeTarget(view, { x: 0 }, 600, insets)).toBeNull();
  });

  it("a chain of clicks returns to the view before the first one", () => {
    const first = recordNudge(IDLE_FLAT_SELECTION_CAMERA, "a", view, { tx: 50, ty: 0, tscale: 1 });
    const second = recordNudge(first, "b", { tx: 50, ty: 0, tscale: 1 }, { tx: 90, ty: 0, tscale: 1 });
    expect(flatDeselectCamera(second, { tx: 90, ty: 0, tscale: 1 })).toEqual({ kind: "return", target: view });
  });

  it("a view the reader moved stays, and a click that did not move the camera leaves it alone", () => {
    const nudged = recordNudge(IDLE_FLAT_SELECTION_CAMERA, "a", view, { tx: 50, ty: 0, tscale: 1 });
    expect(flatDeselectCamera(nudged, { tx: 50, ty: 0, tscale: 1.4 })).toEqual({ kind: "stay" });
    expect(flatDeselectCamera({ ...IDLE_FLAT_SELECTION_CAMERA, clicked: "a" }, view)).toEqual({ kind: "stay" });
  });

  it("a selection made off the map keeps its overview return", () => {
    expect(flatDeselectCamera(IDLE_FLAT_SELECTION_CAMERA, view)).toEqual({ kind: "overview" });
  });

  it("a zoom after a click returns past the click's slide", () => {
    const nudged = recordNudge(IDLE_FLAT_SELECTION_CAMERA, "a", view, { tx: 50, ty: 0, tscale: 1 });
    const flown = recordFlight(nudged, "a", { tx: 50, ty: 0, tscale: 1 });
    expect(flatDeselectCamera(flown, { tx: 80, ty: 20, tscale: 1.6 })).toEqual({ kind: "return", target: view });
  });
});
