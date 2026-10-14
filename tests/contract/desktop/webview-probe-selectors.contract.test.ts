import { describe, expect, it } from "vitest";

import { collectProbeSelectors, findDeadSelectors, readProbeSources } from "../lib/probe-selectors";

/**
 * Every `data-testid` the Rust probes query must exist in `src/` or `app/`: deleting UI does not
 * delete its probe, and a gate whose target is gone rots silently. Runs without an installed app, so
 * always on.
 */

/**
 * Optional evidence selectors that point at removed UI but **do not hard-fail**.
 *
 * Being listed here means "to be cleaned up", not "this is fine". Before adding an
 * entry, confirm the probe really degrades gracefully (it records a `reason` when
 * absent and the contract does not reject).
 */
const KNOWN_STALE_OPTIONAL = new Set<string>();

describe("WebView probe selectors contract", () => {
  const probeSources = readProbeSources(process.cwd());
  const selectors = collectProbeSelectors(probeSources);

  it("the probe really queries testid (the parser itself is not dead)", () => {
    // If the parser returns 0, this whole test passes meaninglessly — that trap is blocked here.
    expect(selectors.length).toBeGreaterThan(10);
  });

  it("every testid the probe looks for points at live UI", () => {
    const dead = findDeadSelectors(selectors, process.cwd());
    const unexpected = dead.filter((id) => !KNOWN_STALE_OPTIONAL.has(id));

    expect(
      unexpected,
      [
        "The Rust WebView probe queries a data-testid that does not exist.",
        "If the UI was removed, fix the probe with it; otherwise the gate fails silently and permanently.",
        `Dead selectors: ${unexpected.join(", ")}`,
      ].join("\n"),
    ).toEqual([]);
  });

  it("the allowlist holds only what is really dead (remove revived entries)", () => {
    // If the UI came back but the allowlist entry remains, the next deletion is silent.
    const dead = new Set(findDeadSelectors(selectors, process.cwd()));
    const revived = [...KNOWN_STALE_OPTIONAL].filter((id) => !dead.has(id));
    expect(revived, `entries to remove from the allowlist: ${revived.join(", ")}`).toEqual([]);
  });

  it("selectors from the Sigma era do not remain in the probe (pins the regression)", () => {
    // The two that actually killed a gate cannot return, not even via the allowlist.
    expect(probeSources).not.toContain(".sigma-mouse");
    expect(probeSources).not.toContain("canvas.sigma-nodes");
    expect(probeSources).not.toContain("sigma-topology-viewport");
  });
});
