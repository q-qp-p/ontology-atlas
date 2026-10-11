"use client";

import { useLayoutEffect, type RefObject } from "react";
import type { CameraAxes } from "../../engine/camera";
import type { DomeRuntime } from "../../model/dome-view/runtime";
import type { TopologyWorld } from "../world/topology-world";
import { readOntologyMapTokensOrNull } from "../../tokens/topology-read-tokens";
import { projectTourAnchor } from "../frame-loop/topology-tour-anchor";

/** Publish target changes before the overlay measures; a resting canvas may skip its next frame. */
export function useTopologyTourAnchor({
  tourAnchorRef, tourAnchorNodeId, tourAnchorElRef, tourAnchorNodeIdRef,
  worldRef, viewportRef, cameraRef, domeRuntimeRef, lastActiveMsRef,
}: {
  tourAnchorRef: RefObject<HTMLDivElement | null> | undefined;
  tourAnchorNodeId: string | null;
  tourAnchorElRef: RefObject<HTMLDivElement | null>;
  tourAnchorNodeIdRef: RefObject<string | null>;
  worldRef: RefObject<TopologyWorld | null>;
  viewportRef: RefObject<{ width: number; height: number }>;
  cameraRef: RefObject<CameraAxes>;
  domeRuntimeRef: RefObject<DomeRuntime | null>;
  lastActiveMsRef: RefObject<number>;
}) {
  useLayoutEffect(() => {
    tourAnchorElRef.current = tourAnchorRef?.current ?? null;
    tourAnchorNodeIdRef.current = tourAnchorNodeId;
    projectTourAnchor({
      element: tourAnchorElRef.current,
      nodeId: tourAnchorNodeId,
      world: worldRef.current,
      camera: cameraRef.current,
      ...viewportRef.current,
      tokens: tourAnchorNodeId ? readOntologyMapTokensOrNull() : null,
      dome: domeRuntimeRef.current,
    });
    lastActiveMsRef.current = performance.now();
  }, [tourAnchorRef, tourAnchorNodeId, tourAnchorElRef, tourAnchorNodeIdRef,
    worldRef, viewportRef, cameraRef, domeRuntimeRef, lastActiveMsRef]);
}
