import type { CameraAxes } from "../engine/camera";
import type { DomeRuntime } from "../model/dome-view/runtime";
import type { OntologyMapTokens } from "../tokens/read-map-tokens";
import { worldToScreen } from "./topology-camera-math";
import { radiusForKind, type TopologyWorld } from "./topology-world";

export function projectTourAnchor({ element, nodeId, world, camera, width, height, tokens, dome }: {
  element: HTMLDivElement | null;
  nodeId: string | null;
  world: TopologyWorld | null;
  camera: CameraAxes;
  width: number;
  height: number;
  tokens: OntologyMapTokens | null;
  dome: DomeRuntime | null;
}): void {
  if (!element) return;
  const node = nodeId ? world?.nodeById.get(nodeId) : undefined;
  if (!node || !tokens || width <= 0 || height <= 0) {
    delete element.dataset.tourProjectedNode;
    element.style.removeProperty("transform");
    element.style.setProperty("--tour-anchor-r", "0px");
    return;
  }
  const frame = dome?.frame.get(node.id);
  const radius = radiusForKind(node.kind, tokens) * node.magnitudeScale * (frame?.s ?? 1) * camera.scale.value;
  const point = worldToScreen(camera, width, height, node.x + (frame?.dx ?? 0), node.y + (frame?.dy ?? 0));
  element.style.transform = `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`;
  element.style.setProperty("--tour-anchor-r", `${radius + 10}px`);
  element.dataset.tourProjectedNode = node.id;
}
