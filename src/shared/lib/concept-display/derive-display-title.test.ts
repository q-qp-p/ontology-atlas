import { describe, expect, it } from "vitest";
import { deriveDisplayTitle } from "./derive-display-title";

describe("deriveDisplayTitle", () => {
  it("prefers the frontmatter display field over title when present", () => {
    expect(
      deriveDisplayTitle({ display: "짧은 이름" }, "CLI Developer Entry (52 commands)"),
    ).toBe("짧은 이름");
  });

  it("ignores a display field that is only whitespace and falls back to the title rule", () => {
    expect(deriveDisplayTitle({ display: "   " }, "Short Title")).toBe(
      "Short Title",
    );
  });

  it("cuts the parenthetical note from an English title", () => {
    expect(
      deriveDisplayTitle(
        undefined,
        "CLI Developer Entry (52 commands — vault + MCP verify + ...)",
      ),
    ).toBe("CLI Developer Entry");
  });

  it("cuts the parenthetical note from a Korean title by the same rule", () => {
    expect(
      deriveDisplayTitle(null, "MCP 서버 (25개 도구 — 읽기 16 + 쓰기 9)"),
    ).toBe("MCP 서버");
  });

  it("returns a title without parentheses unchanged", () => {
    expect(deriveDisplayTitle(undefined, "Auth Platform")).toBe("Auth Platform");
  });

  it("works from the title rule alone even without frontmatter (undefined/null)", () => {
    expect(deriveDisplayTitle(undefined, "Vault (Local-First)")).toBe("Vault");
    expect(deriveDisplayTitle(null, "Vault (Local-First)")).toBe("Vault");
  });

  it("the cut rule does not apply when the parenthesis opens the title (no leading space)", () => {
    expect(deriveDisplayTitle(undefined, "(주의) 임시 이름")).toBe(
      "(주의) 임시 이름",
    );
  });

  it("with several parentheses, cuts at the first one only", () => {
    expect(deriveDisplayTitle(undefined, "A (b) (c)")).toBe("A");
  });

  it("ignores frontmatter.display when it is not a string (for example an array)", () => {
    expect(
      deriveDisplayTitle({ display: ["짧은 이름"] }, "Full Title (extra)"),
    ).toBe("Full Title");
  });
});
