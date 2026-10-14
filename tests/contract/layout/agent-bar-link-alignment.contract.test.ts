import { describe, expect, it } from "vitest";

import { controlClass } from "@/shared/ui/control-class";

/**
 * `truncate: true` emits `block`, which tailwind-merge lets displace the shape's `inline-flex`; then
 * `items-center` has nothing to centre and text sticks to the top of the `min-h-6` box. Pins the
 * trap.
 */
describe("truncate axis and flex shape", () => {
  it("**trap reproduction** — turning truncate on removes the shape's flex", () => {
    const withTruncate = controlClass({ shape: "link", truncate: true });
    expect(withTruncate).toContain("block");
    expect(withTruncate).not.toContain("inline-flex");
  });

  it("without truncate the shape keeps its flex", () => {
    expect(controlClass({ shape: "link" })).toContain("inline-flex");
  });

  it("centre alignment only means something with flex", () => {
    // `items-center` is present in both cases, so the classes look fine and only the
    // screen is wrong. This check records that difference.
    expect(controlClass({ shape: "link", truncate: true })).toContain("items-center");
  });
});
