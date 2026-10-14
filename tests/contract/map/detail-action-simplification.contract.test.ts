import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Node detail actions stay one primary action plus two edit/overflow menu items, not a tile grid.
 * The long CJK primary label truncates to one line and the full meaning stays in the aria-label.
 */
const FILE = "src/widgets/ontology-map/ui/OntologyMapDetailPanel.tsx";

describe("node detail action simplification", () => {
  const source = readFileSync(FILE, "utf8");

  it("the primary action and both disclosure menus all exist", () => {
    expect(source).toContain('data-action-role="primary"');
    expect(source).toContain('triggerTestId="map-detail-panel-edit-menu-trigger"');
    expect(source).toContain('triggerTestId="map-detail-panel-more-menu-trigger"');
  });

  it("does not bring back the old action-tile ink or the tile grid", () => {
    expect(source).not.toContain("ACTION_TILE_INK");
    expect(source).not.toContain('shape: "tile"');
  });

  it("the primary action's long label stays on one line and keeps its accessible name", () => {
    expect(source).toContain('<span className="truncate">{labels.actionAskAgent}</span>');
    expect(source).toContain('aria-label={labels.actionAskAgent}');
    expect(source).toContain('<span className="truncate">{labels.actionCopyHandoff}</span>');
    expect(source).toContain('aria-label={labels.handoff}');
  });
});
