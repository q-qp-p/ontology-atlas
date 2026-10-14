import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Do not draw a door where nothing can be done.**
 *
 * "Create linked" appears only on domain nodes. Domain → capability is linked by a
 * single `domain:` key on the new document, so no new write semantics are needed.
 * Other combinations (capability → element, and so on) require **editing the parent
 * document's list**, which makes it "editing somebody else's document" rather than
 * "creating" — a different job.
 *
 * Three things this gate locks: ① the domain condition ② pre-selecting the domain (a
 * person is not made to re-pick the node they just clicked) ③ the `created_by` stamp
 * on person-created nodes.
 */
const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("\"create next\" — affordance contract", () => {
  const inspector = read("src/views/home/ui/TopologyInspectorSurfaces.tsx");
  const composer = read("src/views/home/ui/TopologyBlockingOverlays.tsx");
  const authoring = read("src/views/home/model/authoring/use-topology-authoring.tsx");

  it("appears only on domain nodes — other kinds cannot be linked on", () => {
    expect(inspector).toMatch(/canCreateNode && canvasSelectedGraphNode\?\.kind === "domain"/);
    // Without the condition the tile appears where nothing can be linked.
    expect(inspector).toMatch(/onCreateLinked=\{/);
  });

  it("the chosen domain is preselected — it does not ask again about the node just pressed", () => {
    // Seeded with the domain's own vault ref, the value the picker offers; the bare graph-id tail would
    // write a second spelling of the relation.
    expect(inspector).toMatch(/setCreateNodeSeedDomain\(resolveNodeVaultRef\(canvasSelectedGraphNode\)\)/);
    expect(authoring).toMatch(/value: resolveNodeVaultRef\(node\)/);
    expect(composer).toMatch(/defaultDomain=\{props\.createNodeSeedDomain\}/);
    expect(read("src/views/home/ui/CreateNodeForm.tsx")).toMatch(
      /useState\(defaultDomain\)/,
    );
  });

  it("a node created on screen gets the `human` stamp", () => {
    /*
     * The `human` stamp is applied at write time and only for an actor the call path proves; this is the
     * screen's single create-concept path.
     */
    expect(authoring).toMatch(/buildNewNodeDoc\(\{ \.\.\.input, createdBy: "human" \}\)/);
    expect(read("src/entities/docs-vault/lib/authoring/build-vault-markdown.ts")).toMatch(
      /createdBy: args\.createdBy,/,
    );
  });

  it("the tile is drawn only when a handler exists — a label without a door must not happen", () => {
    const panel = read("src/widgets/ontology-map/ui/OntologyMapDetailPanel.tsx");
    expect(panel).toMatch(/onCreateLinked && labels\.actionCreateLinked/);
  });
});

it("keeps the protected topology owners connected to the route", () => {
  const route = readFileSync("src/views/home/ui/HomePage.tsx", "utf8");
  expect(route).toContain('<TopologyInspectorSurfaces');
  expect(route).toContain('<TopologyBlockingOverlays');
  expect(route).toContain('useTopologyAuthoring({');
});
