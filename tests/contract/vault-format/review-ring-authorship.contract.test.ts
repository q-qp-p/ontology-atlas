import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/** `created_by` is provenance, never an inferred review state or primary map lens. */
const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("created_by UI boundary", () => {
  it("the provenance value is preserved down to the graph node", () => {
    const stages: [string, string, RegExp][] = [
      ["the derivation reads the frontmatter", "src/entities/docs-vault/lib/derive-ontology-from-vault.ts", /createdBy:\s*typeof fm\.created_by/],
      ["the graph node carries it", "src/features/vault-ontology/model/use-ontology-insight.ts", /createdBy:\s*stub\.createdBy/],
      ["the map adapter passes it on", "src/views/home/lib/map-canvas/map-adapter.ts", /createdBy:\s*node\.createdBy/],
      ["the world node receives it", "src/widgets/ontology-map/ui/world/topology-world.ts", /createdBy:\s*n\.createdBy/],
    ];
    const broken = stages.filter(([, file, pattern]) => !pattern.test(read(file)));
    expect(broken.map(([name]) => name)).toEqual([]);
  });

  it("does not promote authorship to review status or the INDEX lens", () => {
    const home = read("src/views/home/ui/HomePage.tsx");
    const panel = read("src/widgets/topology-index-panel/ui/TopologyIndexPanel.tsx");
    const frameDir = "src/widgets/ontology-map/ui/frame-draw";
    const frame = readdirSync(join(ROOT, frameDir))
      .map((name) => read(`${frameDir}/${name}`))
      .join("\n");
    const shapes = read("src/widgets/ontology-map/render/node-shapes.ts");
    const tokens = read("src/widgets/ontology-map/tokens/read-map-tokens.ts");
    const css = readGlobalCss();
    expect(home).not.toMatch(/humanAuthoredLens|segmentHuman/);
    expect(panel).not.toMatch(/humanAuthored|segmentHuman|lens === "human"/);
    expect(frame).not.toMatch(/reviewPending:\s*node\.createdBy === "human"/);
    expect(`${frame}\n${shapes}\n${tokens}\n${css}`).not.toMatch(
      /reviewPending|reviewRing|map-review-ring/,
    );
  });
});
