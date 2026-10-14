import type { IndexPanelState } from "./index-panel-state";

/**
 * Mirrors `TopologyAnalysisMode` (`src/views/home/model/route-state/url-state.ts`) by
 * value, not by import — FSD forbids `widgets` importing from `views`
 * (`.claude/rules/architecture.md`).
 */
type LeftSlotAnalysisMode = "overview" | "focus" | "path" | "health";

/**
 * INDEX owns the topology's left slot unconditionally. `resolveLeftSlotOwner` stays a named seam
 * because `resolveRenderedIndexPanelState` reads it.
 */
export type LeftSlotOwner = "index" | "analysis-rail";

export interface LeftSlotInputs {
  analysisMode: LeftSlotAnalysisMode;
}

export function resolveLeftSlotOwner(inputs: LeftSlotInputs): LeftSlotOwner {
  void inputs;
  return "index";
}

/**
 * The rendered INDEX state, distinct from the persisted preference; currently always
 * the preferred state, kept as a function for the same seam.
 */
export function resolveRenderedIndexPanelState(
  owner: LeftSlotOwner,
  preferredState: IndexPanelState,
): IndexPanelState {
  return owner === "index" ? preferredState : "collapsed";
}
