import { describe, expect, it } from "vitest";

import { hasAnyNodeOnScreen } from "./topology-camera-math";
import type { CameraAxes } from "../../engine/camera";

const cam = (x: number, y: number, scale: number): CameraAxes => ({
  x: { value: x, velocity: 0 },
  y: { value: y, velocity: 0 },
  scale: { value: scale, velocity: 0 },
});

describe("hasAnyNodeOnScreen (#71)", () => {
  const NODES = [
    { x: 0, y: 0 },
    { x: 100, y: 40 },
  ];

  it("visible when the camera is over the nodes", () => {
    expect(hasAnyNodeOnScreen(cam(0, 0, 1), 1512, 900, NODES)).toBe(true);
  });

  it("everything is off screen when the camera goes very far, the state that looks like an empty map", () => {
    expect(hasAnyNodeOnScreen(cam(100000, 100000, 1), 1512, 900, NODES)).toBe(false);
  });

  it("does not correct when even one node straddles the view, so the user's zoom and position intent is kept", () => {
    // Move the camera so only the second node stays on screen.
    expect(hasAnyNodeOnScreen(cam(100, 40, 1), 200, 200, NODES)).toBe(true);
  });

  it("inside the edge margin counts as visible, so the camera does not jump at the boundary", () => {
    // Put the node just outside the right edge (+10px) and give it a margin of 24.
    const width = 200;
    const justOutside = [{ x: width / 2 + 10, y: 0 }];
    expect(hasAnyNodeOnScreen(cam(0, 0, 1), width, 200, justOutside, 24)).toBe(true);
  });

  it("no nodes does not mean they vanished", () => {
    expect(hasAnyNodeOnScreen(cam(9999, 9999, 1), 1512, 900, [])).toBe(true);
  });

  it("makes no judgment before layout (viewport 0)", () => {
    expect(hasAnyNodeOnScreen(cam(9999, 9999, 1), 0, 0, NODES)).toBe(true);
  });
});
