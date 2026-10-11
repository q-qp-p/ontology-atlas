import type { LibraryWorkActivity, LibraryWorkEvent } from "@/features/library";

import type { LibraryGraph } from "../../model/build-library-graph";
import type { LibraryGraphActivityMark } from "../../render/draw-library-graph";

/**
 * Maps a Library work target to an existing page or source node, stricter than a label
 * match, or a model's mention would look like a file read.
 */
function activityNodeId(event: LibraryWorkEvent, graph: LibraryGraph): string | null {
  if (!event.target) return null;
  const nodeId = event.target.kind === "source" ? `source:${event.target.ref}` : `page:${event.target.ref}`;
  return graph.nodes.some((node) => node.id === nodeId) ? nodeId : null;
}

/**
 * Resolves the finite overlay from epoch receipts, apart from the rAF clock. Each `at`
 * is an epoch `Date.now()`, or every receipt reads as fresh after a reload.
 */
export function libraryGraphActivityMarks(
  activity: LibraryWorkActivity | undefined,
  graph: LibraryGraph,
  nowEpochMs: number,
  trailMs: number,
  activeCycleMs: number,
  reducedMotion: boolean,
): LibraryGraphActivityMark[] {
  if (!activity) return [];
  const marks: LibraryGraphActivityMark[] = [];
  const occupied = new Set<string>();
  const append = (event: LibraryWorkEvent): void => {
    const nodeId = activityNodeId(event, graph);
    if (!nodeId || occupied.has(nodeId)) return;
    occupied.add(nodeId);
    const moves = !reducedMotion && (event.kind === "read" || event.kind === "proposal");
    marks.push({
      nodeId,
      kind: event.kind,
      phase: event.phase,
      progress: 0,
      turn: moves ? (Math.max(0, nowEpochMs - event.at) % Math.max(1, activeCycleMs)) / Math.max(1, activeCycleMs) : 0,
    });
  };

  if (activity.isActive && activity.current?.phase === "active") append(activity.current);

  for (const event of activity.recent) {
    if (event.phase !== "complete" || event.kind === "waiting") continue;
    const elapsed = Math.max(0, nowEpochMs - event.at);
    if (elapsed >= trailMs) continue;
    const nodeId = activityNodeId(event, graph);
    if (!nodeId || occupied.has(nodeId)) continue;
    occupied.add(nodeId);
    marks.push({
      nodeId,
      kind: event.kind,
      phase: "complete",
      // Reduced motion receives the settled mark in its single paint, never a frame loop.
      progress: reducedMotion ? 1 : elapsed / Math.max(1, trailMs),
      settled: reducedMotion,
    });
  }
  return marks;
}

/** Only completed receipts can keep the canvas clock awake; a pending wait is intentionally still. */
export function hasActivityTrail(
  activity: LibraryWorkActivity | undefined,
  graph: LibraryGraph,
  nowEpochMs: number,
  trailMs: number,
  activeCycleMs: number,
  reducedMotion: boolean,
): boolean {
  if (reducedMotion) return false;
  return libraryGraphActivityMarks(activity, graph, nowEpochMs, trailMs, activeCycleMs, false).some(
    (mark) => mark.phase === "complete" || (mark.phase === "active" && (mark.kind === "read" || mark.kind === "proposal")),
  );
}

/** A primitive dependency: unrelated parent renders must not wake a settled canvas. */
export function activitySignature(activity: LibraryWorkActivity | undefined): string {
  if (!activity) return "";
  const event = (value: LibraryWorkEvent | null): string =>
    value
      ? `${value.id}:${value.kind}:${value.phase}:${value.target?.kind ?? ""}:${value.target?.ref ?? ""}:${value.at}`
      : "";
  return `${activity.isActive ? "1" : "0"}|${event(activity.current)}|${activity.recent.map(event).join(",")}`;
}
