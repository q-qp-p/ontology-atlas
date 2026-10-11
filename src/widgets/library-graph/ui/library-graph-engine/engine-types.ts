import type { PointerEvent as ReactPointerEvent } from "react";

import type { LibraryGraphCardSide } from "../../model/library-graph-card";
import type { LayoutPoint } from "../../model/library-graph-layout";

type PointerPhase = "idle" | "pressed" | "dragging";

export interface PointerState {
  phase: PointerPhase;
  pointerId: number | null;
  down: LayoutPoint | null;
  last: LayoutPoint | null;
  /** What was under the pointer when it went down. Cleared the moment a drag starts. */
  pressedNodeId: string | null;
  /** Non-null while a mark is being carried; the offset keeps the grab point under the hand. */
  drag: { nodeId: string; offset: LayoutPoint } | null;
  /** Non-null while an island of the overview is being carried, with its own grab offset. */
  islandDrag: { id: string; offset: LayoutPoint } | null;
  history: Array<{ x: number; y: number; t: number }>;
}

/** Where the open card stands, for the surface to read and for a gate to measure. */
export interface LibraryGraphCardBox {
  nodeId: string;
  left: number;
  top: number;
  side: LibraryGraphCardSide;
  width: number;
  /** The tallest it may be here; past that it scrolls inside. */
  maxHeight: number;
  /** The mark the card is hung from, in canvas CSS pixels. */
  mark: { x: number; y: number; radius: number };
}

/** An island a press picked: what it stands for and who is on it. */
export interface LibraryIslandPick {
  id: string;
  kind: "concept" | "folder" | "unsorted" | "unread";
  label: string;
  conceptId: string | null;
  pages: readonly string[];
  sources: readonly string[];
}

export interface LibraryGraphEngine {
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
  onDoubleClick: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  /** Frames the whole picture again. The corner control and a double-click both call it. */
  fitToView: () => void;
  /** Whether the camera already sits where {@link LibraryGraphEngine.fitToView} would put it (`isSameView`). */
  framed: boolean;
  /** The settled picture's width over its height, for `data-picture-aspect`. */
  pictureAspect: number | null;
  /** The picture the folder got: `flow` names everything, `islands` is the overview past `ISLANDS_MIN_MARKS`. */
  picture: "flow" | "force" | "islands";
  /** The islands of the overview, largest first, for the keyboard to step over; empty on any other picture. */
  islands: readonly LibraryIslandPick[];
  /**
   * The marks in reading order, column by column, top to bottom, for the keyboard; empty
   * without columns, and the caller falls back to graph order.
   */
  walkOrder: readonly string[];
  /** Places the open card synchronously; a layout effect passes the id, since the state ref fills later. */
  placeCard: (openNow?: string | null) => void;
}
