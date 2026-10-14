import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * One node gets one reveal ramp: the child alpha must not be the product of two exponentials.
 * This locks the structural premise; frame measurement belongs to `/ui-proof`.
 */

const DRAW = join(process.cwd(), "src/widgets/ontology-map/ui/frame-draw/paint-nodes.ts");
const REVEAL = join(process.cwd(), "src/widgets/ontology-map/ui/frame-loop/topology-reveal-frame-stage.ts");
const SCHEDULER = join(process.cwd(), "src/widgets/ontology-map/ui/frame-loop/use-topology-frame-loop.ts");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("there is one reveal ramp per node", () => {
  it("reads the source for real, so an empty scan is a defect rather than a pass", () => {
    expect(read(DRAW).length).toBeGreaterThan(1000);
    expect(read(REVEAL).length).toBeGreaterThan(1000);
    expect(read(SCHEDULER)).toContain("createRevealFrameStage(configuration.revealFrameStage)");
    expect(read(SCHEDULER)).toMatch(/runRevealFrameStage\(\s*now,\s*dt,/);
  });

  it("every branch of `revealMul` **replaces** the group fade rather than multiplying it", () => {
    const src = read(DRAW);
    const start = src.indexOf("const revealMul =");
    expect(start, "could not find the `revealMul` computation; if it was renamed, update this test too").toBeGreaterThan(0);
    const expr = src.slice(start, src.indexOf(";", start));

    // It must be a ternary chain. `nearestExpandedRevealMul` may appear **only once,
    // as the final fallback**, and must never be combined with another ramp by
    // multiplication (`*`).
    const groupFadeUses = expr.split("nearestExpandedRevealMul").length - 1;
    expect(groupFadeUses, `the group fade appears ${groupFadeUses} times, but it should be the fallback only once`).toBe(1);
    expect(expr.includes("*"), "there is a multiplication inside `revealMul`, and multiplying ramps is a double fade").toBe(false);
  });

  it("**every tier-crossing channel has a replacing branch in `revealMul`**", () => {
    // This list is the reach. A new piercing channel goes in here too, and this test
    // then asks whether `revealMul` has an alternative branch for it.
    const src = read(DRAW);
    const start = src.indexOf("const revealMul =");
    const expr = src.slice(start, src.indexOf(";", start));
    for (const channel of ["batchAppear", "chipExpandReveal"]) {
      expect(expr.includes(channel), `${channel} is not in a branch of revealMul, so it is multiplied with the group fade`).toBe(true);
    }
  });

  it("**the path a chip click really takes** (place-then-reveal) has the same tau as the chip", () => {
    // Every child of a chip click is registered on the batch path, and the `revealMul` ternary checks
    // `batchAppear` first. So what is measured is which tau the branch actually taken uses.
    const src = read(REVEAL);
    const anchor = src.indexOf("const appearMap = batchAppearRef.current;");
    expect(anchor, "could not find the place-then-reveal step; if it was renamed, update this test too").toBeGreaterThan(0);
    // Only the first `stepEmphasis` call inside that block is inspected.
    const block = src.slice(anchor, anchor + 2500);
    const call = block.slice(block.indexOf("stepEmphasis("));
    const args = call.slice(0, call.indexOf("\n", call.indexOf("stepEmphasis(")) + 1);
    expect(
      args.includes("clusterRevealTau"),
      "the place-then-reveal ramp does not use clusterRevealTau, so it rises at a different rhythm from the chip",
    ).toBe(true);
    expect(
      args.includes("egoRevealRiseTau"),
      "the place-then-reveal ramp went back to the tau of an ego click, which is the rhythm of a different event",
    ).toBe(false);
  });

  it("the chip and its children move on the **same tau**: one input, one event", () => {
    // The chip's pill/badge fade and the ramp of the children it reveals are born of
    // the same click. Different taus make the chip finish first with children
    // trailing, which reads as two events.
    const src = read(REVEAL);
    // No attempt is made to capture a whole `stepEmphasis(…)` call by regex — the
    // arguments span lines and nest parentheses such as `revealMap.get(id) ?? 0`, so
    // they cannot be balanced. Counting references is enough: two ramp steps must read
    // this token.
    const uses = src.split("tokens.clusterRevealTau").length - 1;
    expect(
      uses,
      "clusterRevealTau must be referenced at least twice: the chip shape (chipRevealRef) and its children (expandRevealRef) read it as rise/decay",
    ).toBeGreaterThanOrEqual(2);

    // Check the child ramp has not borrowed ego's tau again — that is another event's rhythm.
    const expandBlock = src.slice(src.indexOf("const revealMap = expandRevealRef.current;"));
    const stepCall = expandBlock.slice(0, expandBlock.indexOf(";", expandBlock.indexOf("stepEmphasis(")));
    expect(
      stepCall.includes("egoRevealRiseTau"),
      "the child ramp went back to egoRevealRiseTau, but an ego click is a different event",
    ).toBe(false);
  });
});
