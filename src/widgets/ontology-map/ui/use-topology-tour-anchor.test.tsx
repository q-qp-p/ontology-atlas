import { render } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CameraAxes } from "../engine/camera";
import type { DomeRuntime } from "../model/dome-view/runtime";
import type { TopologyWorld, WorldNode } from "./topology-world";
import { projectTourAnchor } from "./topology-tour-anchor";
import { useTopologyTourAnchor } from "./use-topology-tour-anchor";

const tokens = vi.hoisted(() => ({ radiusProject: 30, radiusDomain: 17 }));
vi.mock("./topology-read-tokens", () => ({ readOntologyMapTokensOrNull: () => tokens }));
const project = { id: "project:shop", kind: "project", x: 0, y: 0, magnitudeScale: 1 } as WorldNode;
const domain = { id: "domain:catalog", kind: "domain", x: 100, y: -70, magnitudeScale: 1 } as WorldNode;
const world = { nodeById: new Map([project, domain].map((node) => [node.id, node])) } as unknown as TopologyWorld;
const camera = { x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 }, scale: { value: 1, velocity: 0 } } as CameraAxes;

it("publishes the new canvas target before a sibling measures its opening layout", () => {
  const element = document.createElement("div");
  const sources = {
    tourAnchorRef: { current: element }, tourAnchorElRef: { current: null as HTMLDivElement | null },
    tourAnchorNodeIdRef: { current: null as string | null }, worldRef: { current: world },
    viewportRef: { current: { width: 1200, height: 863 } }, cameraRef: { current: camera },
    domeRuntimeRef: { current: null as DomeRuntime | null }, lastActiveMsRef: { current: 0 },
  };
  const reads: string[][] = [];
  function MapAnchor({ nodeId }: { nodeId: string | null }) {
    useTopologyTourAnchor({ ...sources, tourAnchorNodeId: nodeId });
    return null;
  }
  function OverlayReader({ nodeId }: { nodeId: string | null }) {
    useLayoutEffect(() => {
      reads.push([element.dataset.tourProjectedNode ?? "", element.style.transform]);
    }, [nodeId]);
    return null;
  }
  const frame = (nodeId: string | null) => <><MapAnchor nodeId={nodeId} /><OverlayReader nodeId={nodeId} /></>;
  const { rerender } = render(frame(project.id));
  rerender(frame(domain.id));
  expect(reads).toEqual([
    [project.id, "translate(-50%, -50%) translate(600px, 431.5px)"],
    [domain.id, "translate(-50%, -50%) translate(700px, 361.5px)"],
  ]);
  rerender(frame("domain:deleted"));
  expect(reads.at(-1)).toEqual(["", ""]);
  expect(element.style.getPropertyValue("--tour-anchor-r")).toBe("0px");
});

describe("canvas tour projection", () => {
  const input = () => ({ element: document.createElement("div"), nodeId: domain.id, world, camera, width: 1200, height: 863,
    tokens: tokens as Parameters<typeof projectTourAnchor>[0]["tokens"], dome: null as DomeRuntime | null });
  it("uses the canvas camera, perspective offset and radius together", () => {
    const source = input();
    source.dome = { frame: new Map([[domain.id, { dx: 20, dy: 10, s: 0.5 }]]) } as DomeRuntime;
    projectTourAnchor(source);
    expect(source.element.style.transform).toBe("translate(-50%, -50%) translate(720px, 371.5px)");
    expect(source.element.style.getPropertyValue("--tour-anchor-r")).toBe("18.5px");
    expect(source.element.dataset.tourProjectedNode).toBe(domain.id);
  });
  it.each([{ nodeId: null }, { world: null }, { tokens: null }, { width: 0 }])("clears an unavailable projection %j", (unavailable) => {
    const source = input();
    projectTourAnchor(source);
    projectTourAnchor({ ...source, ...unavailable });
    expect(source.element.dataset.tourProjectedNode).toBeUndefined();
    expect(source.element.style.getPropertyValue("--tour-anchor-r")).toBe("0px");
  });
});
