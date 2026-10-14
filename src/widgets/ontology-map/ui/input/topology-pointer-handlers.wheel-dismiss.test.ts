import { describe, expect, it, vi } from "vitest";

// Edge hover cards lingering (panel2/3) — the moment a wheel or camera motion starts,
// the card must disappear. `handleWheel` reads tokens to compute the zoom, so only the
// numeric fields it needs are stubbed instead of a real token fixture, keeping this
// test independent of the camera maths.
vi.mock("../../tokens/topology-read-tokens", () => ({
  readOntologyMapTokensOrNull: vi.fn(() => ({
    overviewEntryRatio: 0.95,
    cameraMaxZoomRatio: 2,
    cameraScaleMax: 2.6,
    cameraMinZoomRatio: 0.5,
    cameraScaleMin: 0.24,
    cameraDampingDefault: 1,
    cameraSpringAngFreqInteractive: 10,
  })),
}));

import { createTopologyPointerHandlers } from "./topology-pointer-handlers";
import type { PointerHandlerRefs } from "./topology-pointer-types";

function ref<T>(current: T): { current: T } {
  return { current };
}

function buildRefs(overrides: Partial<PointerHandlerRefs> = {}): PointerHandlerRefs {
  return {
    worldRef: ref({ nodes: [], neighborMap: new Map() } as unknown as PointerHandlerRefs["worldRef"]["current"]),
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

function fakeWheelEvent(): WheelEvent {
  return {
    preventDefault: vi.fn(),
    clientX: 400,
    clientY: 300,
    deltaY: -120,
    deltaMode: 0,
    currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
  } as unknown as WheelEvent;
}

describe("createTopologyPointerHandlers — handleWheel dismisses transient hover cards", () => {
  it("the first wheel-zoom tick dismisses the edge hover card immediately (blocks leftovers across the three tiers)", () => {
    const hoveredEdgeRef = ref<{
      sourceId: string;
      targetId: string;
      relationType: string;
      declaredBySlug: string | null;
    } | null>({ sourceId: "a", targetId: "b", relationType: "contains", declaredBySlug: null });
    const onHoverEdge = vi.fn();

    const { handleWheel } = createTopologyPointerHandlers(
      buildRefs({ hoveredEdgeRef, onHoverEdge }),
    );

    handleWheel(fakeWheelEvent());

    expect(hoveredEdgeRef.current).toBeNull();
    expect(onHoverEdge).toHaveBeenCalledWith(null, null);
  });

  it("wheel zoom dismisses the cluster hover tooltip as well", () => {
    const hoveredClusterIdRef = ref<string | null>("domain:x");
    const onHoverCluster = vi.fn();

    const { handleWheel } = createTopologyPointerHandlers(
      buildRefs({ hoveredClusterIdRef, onHoverCluster }),
    );

    handleWheel(fakeWheelEvent());

    expect(hoveredClusterIdRef.current).toBeNull();
    expect(onHoverCluster).toHaveBeenCalledWith(null);
  });

  it("does not call the dismiss callback when no card is floating (avoids a needless re-render)", () => {
    const hoveredEdgeRef = ref<{
      sourceId: string;
      targetId: string;
      relationType: string;
      declaredBySlug: string | null;
    } | null>(null);
    const onHoverEdge = vi.fn();

    const { handleWheel } = createTopologyPointerHandlers(
      buildRefs({ hoveredEdgeRef, onHoverEdge }),
    );

    handleWheel(fakeWheelEvent());

    expect(onHoverEdge).not.toHaveBeenCalled();
  });
});
