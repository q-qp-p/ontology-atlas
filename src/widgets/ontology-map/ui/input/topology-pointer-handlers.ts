import { hitTestEdges } from "./topology-edge-hit";
import { createPointerContext } from "./topology-pointer-context";
import { createPointerHitTests } from "./topology-pointer-hit-tests";
import { createPointerMoveHandler } from "./topology-pointer-move";
import { createPointerPressHandlers } from "./topology-pointer-press";
import { createPointerReleaseHandlers } from "./topology-pointer-release";
import type { PointerHandlerRefs, TopologyPointerHandlers } from "./topology-pointer-types";
import { createPointerZoomHandlers } from "./topology-pointer-zoom";

/** Builds the pointer/wheel handlers, closing over the hook's refs (cheap — plain closures, no hook rules to satisfy). */
export function createTopologyPointerHandlers(refs: PointerHandlerRefs): TopologyPointerHandlers {
  const ctx = createPointerContext(refs);
  const hits = createPointerHitTests(ctx);
  const { handlePointerUp, handlePointerCancel, handlePointerLeave } = createPointerReleaseHandlers(ctx, hits);
  const { handlePointerDown, handleContextMenu } = createPointerPressHandlers(ctx, hits, handlePointerCancel);
  const handlePointerMove = createPointerMoveHandler(ctx, hits, handlePointerUp);
  const { handleWheel, handleGesturePinch } = createPointerZoomHandlers(ctx);
  const { buildEdgeCandidates } = hits;

  /**
   * ★ **Expose the app's own edge decision verbatim** (2026-08-03).
   *
   * Why: nodes can be driven from outside through `__atlasMap.nodes()`, which gives
   * coordinates and `draggable`, but **edges could not be.** Measured — clicking 101
   * points along a curve's midline across 3 offsets still left `selection().edge`
   * null. The threshold is 7px and the inside of a node body is excluded, so from
   * outside there is no way to guess "where do I have to press".
   *
   * The result was that **no change involving edges could be verified automatically** —
   * attaching entry and exit to the edge panel hit that wall and was reverted
   * (2026-08-03).
   *
   * It does not recompute the coordinates but calls **the same functions**
   * (`buildEdgeCandidates` plus `hitTestEdges`). An instrument using a different
   * formula from the app measures its own imagination rather than the screen.
   */
  const probeEdgeAt = (screenX: number, screenY: number, thresholdPx = 7) => hitTestEdges(buildEdgeCandidates(), screenX, screenY, thresholdPx);
  return { handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, handlePointerLeave, handleWheel, handleGesturePinch, handleContextMenu, probeEdgeAt };
}
