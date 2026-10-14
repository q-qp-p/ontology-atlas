import { statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  censusStaticSurfaces,
  isHandBadge,
} from "../../../scripts/lib/design/static-surface-census.mjs";

/**
 * Hand-written badge geometry (radius plus inset or type step) without `badgeClass` cannot grow.
 * Status dots, the `shared/ui` primitive layer and tests are not counted; colour is not counted.
 */

const ROOT = process.cwd();

/**
 * The scanner is `scripts/lib/design/static-surface-census.mjs`: the ledger and the gate must count with the
 * same function for the ledger-more-generous check to mean anything.
 */

/** Per-file ceilings: growth turns red, and a row reaching 0 is deleted. */
const DEBT: ReadonlyArray<readonly [file: string, count: number]> = [
  ["src/entities/project/ui/ProjectCard.tsx", 1],
  ["src/features/agent-activity/ui/AgentActivityChip.tsx", 1],
  ["src/features/first-run-starter/ui/FirstRunStarterModule.tsx", 1],
  ["src/features/project-edit/ui/DependencyPicker.tsx", 2],
  ["src/features/project-edit/ui/ProjectFormActions.tsx", 2],
  ["src/features/project-edit/ui/project-form-parts.tsx", 2],
  ["src/views/docs-vault/ui/parts/DocMetaBar.tsx", 2],
  ["src/views/docs-vault/ui/parts/DocsSidebarBody.tsx", 2],
  ["src/views/download/ui/DemoStage.tsx", 1],
  ["src/views/home/ui/TopologyCommandChrome.tsx", 1],
  ["src/views/project-detail/ui/construction-review/ConstructionReviewPanel.tsx", 1],
  ["src/views/project-editor/ui/ProjectEditorPage.tsx", 1],
  ["src/widgets/app-nav-rail/ui/AppNavRail.tsx", 1],
  ["src/widgets/atlas-git-panel/ui/SetupMode.tsx", 3],
  ["src/widgets/docs-vault/ui/DocsVaultEditor.tsx", 3],
  ["src/widgets/docs-vault/ui/DocsVaultViewer.tsx", 1],
  ["src/widgets/global-search/ui/GlobalSearch.tsx", 2],
  ["src/widgets/project-drawer/ui/ProjectDrawer.tsx", 3],
  ["src/widgets/search-palette/ui/SearchPalette.tsx", 1],
  ["src/widgets/ontology-map/ui/detail-panel/RelationGroupShell.tsx", 1],
  ["src/widgets/vault-agent-panel/ui/AgentLockedState.tsx", 1],
];

describe("static badge adoption ratchet", () => {
  const census = censusStaticSurfaces(ROOT);
  const found = census.badges;
  const ledger = new Map(DEBT);

  it("the detector does not idle — it really scans files and the ledger exists", () => {
    // Locks that enough files were scanned, not that the number of caught files is non-zero.
    expect(census.scanned, "too few files scanned — the worker died").toBeGreaterThan(100);
    for (const [file] of DEBT) {
      expect(statSync(path.join(ROOT, file)).isFile(), `${file} does not exist`).toBe(true);
    }
  });

  it("hand-written badge geometry cannot exceed the ledger — a new file starts at 0 on day one", () => {
    const over: string[] = [];
    for (const [file, count] of found) {
      const allowed = ledger.get(file) ?? 0;
      if (count > allowed) over.push(`${file}: ${count} > ledger ${allowed}`);
    }
    expect(
      over,
      "Do not hand-write badge geometry: `badgeClass({ shape })` (src/shared/ui/badge-class.ts) " +
        "owns the radius, inset and type step. Colour and tracking still go through className.",
    ).toEqual([]);
  });

  it("reclaimed ledger entries come down — a ledger more generous than the measurement is not a ratchet", () => {
    const stale: string[] = [];
    for (const [file, allowed] of DEBT) {
      const actual = found.get(file) ?? 0;
      if (actual < allowed) stale.push(`${file}: ledger ${allowed} > measured ${actual} — lower it`);
    }
    expect(stale).toEqual([]);
  });

  /* ── Standing probes (/gate-probe) ── */
  it("probe: hand badges are caught, badgeClass consumers and status dots are not", () => {
    expect(isHandBadge('<span className="rounded-full px-2 py-0.5 text-caption"')).toBe(true);
    expect(isHandBadge('<span className="rounded-micro text-label"')).toBe(true);
    expect(isHandBadge('<span className={badgeClass({ shape: "pill" })}')).toBe(false);
    expect(isHandBadge('<span className="size-2 rounded-full bg-[color:var(--color-status-success)]"')).toBe(false);
    expect(isHandBadge('<span className="flex items-center gap-2"')).toBe(false);
  });
});
