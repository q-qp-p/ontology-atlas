import type { PointerEvent as ReactPointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * jsdom checks only what the handler writes the cursor to; the real cascade needs layout.
 * Background shows `grab` (pannable), nodes `pointer`; release must restore the cursor on every path.
 */
// Wrapped **only to count** the function called once per edge while building
// candidates — the behaviour is left as the real implementation (feeding it fake
// values would make the hit test a lie).
vi.mock("../camera/topology-camera-math", async () => {
  const actual = await vi.importActual<typeof import("../camera/topology-camera-math")>(
    "../camera/topology-camera-math");
  return { ...actual, worldToScreen: vi.fn(actual.worldToScreen) };
});

vi.mock("../../tokens/topology-read-tokens", () => ({
  readOntologyMapTokensOrNull: vi.fn(() => ({
    hysteresisPx: 7,
    overviewEntryRatio: 0.95,
    cameraMaxZoomRatio: 2,
    cameraScaleMax: 2.6,
    cameraMinZoomRatio: 0.5,
    cameraScaleMin: 0.24,
    cameraDampingDefault: 1,
    cameraSpringAngFreqInteractive: 10,
    cameraReleaseVelocityWindowMs: 80,
    cameraFlickMinSpeed: 40,
    nodeReleaseSettleMs: 900,
  })),
}));

import { worldToScreen } from "../camera/topology-camera-math";
import { createTopologyPointerHandlers } from "./topology-pointer-handlers";
import type { PointerHandlerRefs } from "./topology-pointer-types";

function ref<T>(current: T): { current: T;
} {
  return { current };
}

function buildRefs(overrides: Partial<PointerHandlerRefs> = {}): PointerHandlerRefs {
  return {
    worldRef: ref({
      nodes: [],
      neighborMap: new Map(),
      nodeById: new Map(),
      bounds: { minX: -500, minY: -500, maxX: 500, maxY: 500 },
      spineBounds: { minX: -500, minY: -500, maxX: 500, maxY: 500 },
    } as unknown as PointerHandlerRefs["worldRef"]["current"]),
    cameraRef: ref({ x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 }, scale: { value: 1, velocity: 0 } }),
    cameraTargetRef: ref({ tx: 0, ty: 0, tscale: 1 }),
    dampingRef: ref(1),
    cameraAngularFreqRef: ref(null),
    viewportRef: ref({ width: 800, height: 600, dpr: 1 }),
    pointerMachineRef: ref({ phase: "idle" } as unknown as PointerHandlerRefs["pointerMachineRef"]["current"]),
    dragHistoryRef: ref([]),
    camStartAtDownRef: ref({ x: 0, y: 0 }),
    canvasRectRef: ref({ left: 0, top: 0 }),
    focusedSlugRef: ref(null),
    hoveredNodeIdRef: ref(null),
    rippleStartRef: ref(new Map()),
    reducedMotionRef: ref(false),
    simRef: ref(null),
    heatRef: ref(0),
    nodeDragRef: ref(null),
    dragAffectedSetRef: ref(null),
    dragStartPosRef: ref(null),
    overviewScaleRef: ref(1),
    ...overrides,
  };
}

/** The restore on release happens through `canvasRef`, so the test supplies the same canvas. */
function refsWithCanvas(canvas: ReturnType<typeof fakeCanvas>): PointerHandlerRefs {
  return buildRefs({
    canvasRef: ref(canvas) as unknown as PointerHandlerRefs["canvasRef"],
  });
}

/** A fake canvas whose cursor writes can be observed. */
function fakeCanvas() {
  return {
    style: { cursor: "" },
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
}

function pointerEvent(
  canvas: ReturnType<typeof fakeCanvas>,
  x: number,
  y: number): ReactPointerEvent<HTMLCanvasElement> {
  return {
    pointerId: 1,
    clientX: x,
    clientY: y,
    currentTarget: canvas,
  } as unknown as ReactPointerEvent<HTMLCanvasElement>;
}

describe("cursor affordance: each surface shows its own primary action", () => {
  // A world with no nodes at all, so every hover is background.
  it("hovering the empty background shows `grab`, since the primary action of this canvas is pan", () => {
    const refs = buildRefs();
    const canvas = fakeCanvas();
    const { handlePointerMove } = createTopologyPointerHandlers(refs);

    handlePointerMove(pointerEvent(canvas, 400, 300));

    expect(canvas.style.cursor).toBe("grab");
  });

  it("while pushing the background it shows `grabbing`", () => {
    const refs = buildRefs();
    const canvas = fakeCanvas();
    const { handlePointerDown, handlePointerMove } = createTopologyPointerHandlers(refs);

    handlePointerDown(pointerEvent(canvas, 400, 300));
    // Cross the hysteresis (7px) to transition into a drag.
    handlePointerMove(pointerEvent(canvas, 460, 340));

    expect(canvas.style.cursor).toBe("grabbing");
  });

  /**
   * This check is the exact reproduction of the defect — the old restore lived **only
   * inside the node-drag branch**, so pushing the background and then letting go left
   * `grabbing` behind while the mouse sat still. Clearing the inline style lets the
   * canvas class (`cursor-grab`) restore it.
   */
  it("releasing drops the grip shape, so the inline cursor is cleared", () => {
    const canvas = fakeCanvas();
    const refs = refsWithCanvas(canvas);
    const { handlePointerDown, handlePointerMove, handlePointerUp } =
      createTopologyPointerHandlers(refs);

    handlePointerDown(pointerEvent(canvas, 400, 300));
    handlePointerMove(pointerEvent(canvas, 460, 340));
    expect(canvas.style.cursor).toBe("grabbing");

    handlePointerUp(pointerEvent(canvas, 460, 340));

    expect(canvas.style.cursor).toBe("");
  });
});

/**
 * Pinned on a count, not milliseconds: `worldToScreen` is called three times per edge when candidates
 * are built, so zero calls means no rebuild while the camera is still.
 */
describe("edge candidate cache: zero recomputation on a still camera", () => {
  function worldWithEdges(): PointerHandlerRefs["worldRef"]["current"] {
    const nodes = [
      { id: "a", slug: "a", kind: "domain", x: 0, y: 0, magnitudeScale: 1 },
      { id: "b", slug: "b", kind: "domain", x: 100, y: 0, magnitudeScale: 1 }
        ];
    return {
      nodes,
      nodeById: new Map(nodes.map((n) => [n.id, n])),
      neighborMap: new Map(),
      edges: [{ sourceId: "a", targetId: "b", ax: 0, ay: 0, bx: 100, by: 0, relationType: "depends_on" }],
      bounds: { minX: -500, minY: -500, maxX: 500, maxY: 500 },
      spineBounds: { minX: -500, minY: -500, maxX: 500, maxY: 500 },
    } as unknown as PointerHandlerRefs["worldRef"]["current"];
  }

  it("repeated moves over the background build candidates only on the first frame", () => {
    const canvas = fakeCanvas();
    const refs = buildRefs({
      worldRef: ref(worldWithEdges()),
      canvasRef: ref(canvas) as unknown as PointerHandlerRefs["canvasRef"],
      hoveredEdgeRef: ref(null),
    });
    const { handlePointerMove } = createTopologyPointerHandlers({
      ...refs,
      onHoverEdge: () => {},
    } as unknown as Parameters<typeof createTopologyPointerHandlers>[0]);

    // Move several times with the same camera — only the coordinates differ, the candidate list is identical.
    for (let i = 0; i < 5; i += 1) {
      handlePointerMove(pointerEvent(canvas, 400 + i, 300 + i));
    }

    const firstPass = vi.mocked(worldToScreen).mock.calls.length;
    // If this path never runs at all, the comparison below is vacuously true.
    expect(firstPass, "candidates were never built, so this test guards nothing").toBeGreaterThan(0);
    handlePointerMove(pointerEvent(canvas, 410, 310));
    expect(
      vi.mocked(worldToScreen).mock.calls.length,
      "카메라가 그대로인데 후보를 다시 만들었다").toBe(firstPass);
  });
});

describe("leaving the canvas takes its hover cards with it", () => {
  it("clears the edge card and the cluster tooltip once, and only once", () => {
    const onHoverEdge = vi.fn();
    const onHoverCluster = vi.fn();
    const hoveredEdgeRef = ref<{ sourceId: string; targetId: string; relationType: string; declaredBySlug: string | null;
        } | null>({
      sourceId: "domain:a",
      targetId: "domain:b",
      relationType: "depends_on",
      declaredBySlug: null,
    });
    const hoveredClusterIdRef = ref<string | null>("domain:a");
    const { handlePointerLeave } = createTopologyPointerHandlers(
      buildRefs({
        hoveredEdgeRef: hoveredEdgeRef as unknown as PointerHandlerRefs["hoveredEdgeRef"],
        onHoverEdge,
        hoveredClusterIdRef: hoveredClusterIdRef as unknown as PointerHandlerRefs["hoveredClusterIdRef"],
        onHoverCluster,
      }));

    handlePointerLeave();

    expect(hoveredEdgeRef.current).toBeNull();
    expect(onHoverEdge).toHaveBeenCalledWith(null, null);
    expect(hoveredClusterIdRef.current).toBeNull();
    expect(onHoverCluster).toHaveBeenCalledWith(null);

    handlePointerLeave();
    expect(onHoverEdge).toHaveBeenCalledTimes(1);
    expect(onHoverCluster).toHaveBeenCalledTimes(1);
  });
});
