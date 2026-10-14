import { describe, expect, it } from "vitest";
import { replaceVaultBody } from "./replace-vault-body";
import { parseFrontmatter } from "./parse-frontmatter";

const RAW = ["---", "slug: capabilities/auth", "kind: capability", "domain: iam", "---", "", "# Auth", "", "old explanation"].join("\n");

describe("replaceVaultBody", () => {
  it("keeps frontmatter and replaces the body", () => {
    const next = replaceVaultBody(RAW, "# Auth\n\nnew explanation");
    expect(next).toBe(
      ["---", "slug: capabilities/auth", "kind: capability", "domain: iam", "---", "", "# Auth", "", "new explanation", ""].join("\n"),
    );
  });

  it("round trip: frontmatter is unchanged under parseFrontmatter and the body is new", () => {
    const next = replaceVaultBody(RAW, "completely new body");
    const parsed = parseFrontmatter(next);
    expect(parsed.frontmatter).toEqual({
      slug: "capabilities/auth",
      kind: "capability",
      domain: "iam",
    });
    expect(parsed.body.trim()).toBe("completely new body");
  });

  it("trims whitespace around the body", () => {
    const next = replaceVaultBody(RAW, "\n\n  spaced  \n\n");
    expect(next).toBe(
      ["---", "slug: capabilities/auth", "kind: capability", "domain: iam", "---", "", "spaced", ""].join("\n"),
    );
  });

  it("an empty body leaves frontmatter only", () => {
    const next = replaceVaultBody(RAW, "   ");
    expect(next).toBe(["---", "slug: capabilities/auth", "kind: capability", "domain: iam", "---", ""].join("\n"));
    expect(parseFrontmatter(next).frontmatter.slug).toBe("capabilities/auth");
  });

  it("without frontmatter the whole body is replaced", () => {
    expect(replaceVaultBody("just text", "new text")).toBe("new text\n");
  });
});

/** Frontmatter must survive BOM and CRLF files, and the original line endings and BOM are restored. */
describe("BOM and CRLF originals", () => {
  it("keeps frontmatter even with a BOM", () => {
    const raw = "﻿---\nkind: capability\ntitle: T\n---\n옛 본문\n";
    const next = replaceVaultBody(raw, "새 본문");
    expect(next).toContain("kind: capability");
    expect(next).toContain("새 본문");
    expect(next.startsWith("﻿")).toBe(true);
  });

  it("a CRLF file is saved back as CRLF", () => {
    const raw = "---\r\nkind: capability\r\ntitle: T\r\n---\r\n옛 본문\r\n";
    const next = replaceVaultBody(raw, "새 본문");
    expect(next).toContain("kind: capability");
    expect(next).toContain("새 본문");
    expect(next.includes("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(next)).toBe(false);
  });

  it("an LF file stays LF, so restoring never changes the original", () => {
    const raw = "---\nkind: capability\n---\n옛 본문\n";
    const next = replaceVaultBody(raw, "새 본문");
    expect(next.includes("\r")).toBe(false);
    expect(next.startsWith("﻿")).toBe(false);
  });
});
