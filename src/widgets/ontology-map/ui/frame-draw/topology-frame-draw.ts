import { computeNodeAlpha } from "./node-alpha";
import { beginFrame } from "./frame-begin";
import { beginNodeLayer, paintStrataDust } from "./node-layer";
import { paintBackdrop } from "./paint-backdrop";
import { paintClusterChips } from "./paint-chips";
import { paintDial } from "./paint-dial";
import { paintDomeStage } from "./paint-dome-stage";
import { paintEdges } from "./paint-edges";
import { paintLabels } from "./paint-labels";
import { paintNodes } from "./paint-nodes";
import { paintRelationCaptions } from "./paint-captions";
import { paintWardingRing } from "./paint-warding";
import { prepareEdges } from "./edge-prep";
import { prepareFocus } from "./frame-focus";
import type { FrameDrawParams } from "./frame-draw-params";

export type { FrameDrawParams } from "./frame-draw-params";
export {
  lastDrawnLabelBoxes,
  lastDrawnLod,
  lastDrawnNodeAlphas,
  lastDrawnNodeCount,
  lastDrawnRelationCaptions,
  lastDrawnSkyTimeMs,
  lastHiddenDependencies,
  lastLitStateCounts,
  setMapComets,
} from "./frame-state";

// Order is paint order; each pass takes the stage results it reads.
export function drawTopologyFrame(params: FrameDrawParams): void {
  const frame = beginFrame(params);
  paintBackdrop(frame);
  if (paintDial(frame)) return;
  const focus = prepareFocus(frame);
  const alpha = computeNodeAlpha(frame, focus);
  const edges = prepareEdges(frame, focus, alpha);
  const stage = paintDomeStage(frame, focus, edges);
  paintEdges(frame, focus, alpha, edges, stage);
  const layer = beginNodeLayer(frame);
  paintStrataDust(frame, focus, layer);
  paintNodes(frame, focus, alpha, stage, layer);
  paintWardingRing(frame, focus, layer);
  const chipReservations = paintClusterChips(frame, focus, alpha, layer);
  const safeRect = paintLabels(frame, focus, alpha, layer, chipReservations);
  paintRelationCaptions(frame, edges, layer, chipReservations, safeRect);
}
