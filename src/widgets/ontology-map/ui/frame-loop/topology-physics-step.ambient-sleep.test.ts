import { describe, expect, it, vi } from "vitest";

/**
 * `updateParticles` is mocked so the test observes only the speed it receives, verifying the ambient
 * factor multiplies comet speed.
 */
vi.mock("../../render/edge-fireflies", async () => {
  const actual = await vi.importActual<typeof import("../../render/edge-fireflies")>(
    "../../render/edge-fireflies",
  );
  return { ...actual, updateParticles: vi.fn() };
});

import { updateParticles } from "../../render/edge-fireflies";
import { stepTopologyPhysics, type PhysicsStepInput } from "./topology-physics-step";
import type { OntologyMapTokens } from "../../tokens/read-map-tokens";

// All this test looks at is the comet speed, so it stands up only the values it needs
// rather than running the real resolver (the drift guard that demands every token
// exists) — the house pattern `topology-camera-math.test.ts` already uses.
const tokens = {
  edgePulseSpeed: 0.075,
  edgePulseSpeedEgo: 0.16,
  emphasisRiseTau: 0.1,
  emphasisDecayTau: 0.2,
  focusDimTau: 0.2,
  egoRevealRiseTau: 0.1,
  egoRevealDecayTau: 0.2,
  cameraDampingDefault: 1,
  cameraScaleMin: 0.2,
  cameraScaleMax: 4,
  breatheAmplitude: 0.02,
  breatheFreqRad: 1,
  rippleStaggerMs: 30,
  rippleStaggerMaxMs: 300,
  nodeHomeSpringAngFreq: 7.5,
  dragTug1Hop: 0.22,
  dragTug2Hop: 0.07,
  dragTugRadius: 400,
} as unknown as OntologyMapTokens;

function baseInput(overrides: Partial<PhysicsStepInput> = {}): PhysicsStepInput {
  const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const world = {
    nodes: [
      { id: "a", x: 0, y: 0, vx: 0, vy: 0, kind: "domain", slug: "a" },
      { id: "b", x: 100, y: 0, vx: 0, vy: 0, kind: "domain", slug: "b" },
    ],
    edges: [{ sourceId: "a", targetId: "b", kind: "depends", t: 0 }],
    bounds,
    spineBounds: bounds,
  } as unknown as PhysicsStepInput["world"];

  return {
    world,
    camera: { x: { value: 0 }, y: { value: 0 }, scale: { value: 1 } },
    target: { tx: 0, ty: 0, tscale: 1 },
    damping: 1,
    overviewScale: 1,
    tokens,
    cameraAngularFrequency: 10,
    dt: 1 / 60,
    now: 1000,
    focusedNodeId: null,
    pairFocusActive: false,
    hoveredNodeId: null,
    panelEmphasisNodeId: null,
    isDragging: false,
    reducedMotion: false,
    freezeCamera: false,
    emphasisById: new Map(),
    rippleStartById: new Map(),
    egoRevealById: new Map(),
    focusRampById: new Map(),
    appearById: new Map(),
    ...overrides,
  } as PhysicsStepInput;
}

/** Applies the speedOf the mocked `updateParticles` received to a real edge to extract the speed. */
function capturedSpeed(): number {
  const mock = vi.mocked(updateParticles);
  expect(mock).toHaveBeenCalled();
  const call = mock.mock.calls[mock.mock.calls.length - 1];
  const edges = call[0] as ReadonlyArray<{ sourceId: string; targetId: string; kind: string }>;
  const speedOf = call[3] as (edge: (typeof edges)[number]) => number;
  return speedOf(edges[0]);
}

describe("stepTopologyPhysics: ambient sleep wiring", () => {
  it("awake (factor 1) keeps the old speed, so the screen of someone watching does not change by one pixel", () => {
    vi.mocked(updateParticles).mockClear();
    stepTopologyPhysics(baseInput({ ambientFactor: 1 }));
    const awake = capturedSpeed();

    vi.mocked(updateParticles).mockClear();
    stepTopologyPhysics(baseInput()); // Parameter omitted = an existing call site.
    const legacy = capturedSpeed();

    expect(awake).toBeGreaterThan(0);
    expect(legacy).toBe(awake);
  });

  it("asleep (factor 0) means comet speed 0, and the phase does not advance", () => {
    vi.mocked(updateParticles).mockClear();
    stepTopologyPhysics(baseInput({ ambientFactor: 0 }));
    expect(capturedSpeed()).toBe(0);
  });

  // Without the ramp the comets **stop dead** mid-orbit, and a frozen particle reads
  // as "is it broken?". The factor has to multiply linearly for them to flow and then
  // gradually come to rest.
  it("mid-ramp (0 < factor < 1) the speed shrinks proportionally", () => {
    vi.mocked(updateParticles).mockClear();
    stepTopologyPhysics(baseInput({ ambientFactor: 1 }));
    const full = capturedSpeed();

    vi.mocked(updateParticles).mockClear();
    stepTopologyPhysics(baseInput({ ambientFactor: 0.5 }));
    const half = capturedSpeed();

    expect(half).toBeCloseTo(full * 0.5, 6);
  });
});
