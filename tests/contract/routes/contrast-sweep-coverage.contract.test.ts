import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AUDITED_ROUTES, EXCLUDED_ROUTES } from "../../e2e/audited-routes";

/**
 * The contrast sweep must cover every route in `AUDITED_ROUTES`; an unmeasured screen is not a
 * passing screen. A new route breaks `audited-route-coverage` first, then this contract.
 */
const HARNESS = join(process.cwd(), "scripts/design/measure-contrast.mjs");

function harnessRoutes(): string[] {
  const source = readFileSync(HARNESS, "utf8");
  const block = /export const DEFAULT_ROUTES = \[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error("could not find DEFAULT_ROUTES in measure-contrast.mjs");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const normalize = (route: string) => (route.endsWith("/") ? route : `${route}/`);

describe("contrast sweep coverage", () => {
  it("misses no route that is in the audit", () => {
    const swept = new Set(harnessRoutes().map(normalize));
    const missing = AUDITED_ROUTES.map(normalize).filter((route) => !swept.has(route));
    expect(missing, `routes whose contrast is not measured: ${missing.join(", ")}`).toEqual([]);
  });

  it("an excluded route is not in the sweep either, so the exclusion reason cannot disagree between two places", () => {
    const swept = new Set(harnessRoutes().map(normalize));
    const leaked = Object.keys(EXCLUDED_ROUTES)
      .map(normalize)
      .filter((route) => swept.has(route));
    expect(leaked, `excluded routes that are in the sweep: ${leaked.join(", ")}`).toEqual([]);
  });

  /**
   * Checks the detector is not **running on an empty set** (`/gate-probe`). If the
   * regex silently matches nothing, both assertions above go green with "nothing is
   * missing".
   */
  it("actually reads the routes from the harness", () => {
    expect(harnessRoutes().length).toBeGreaterThanOrEqual(AUDITED_ROUTES.length);
  });
});
