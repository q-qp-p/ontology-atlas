import { describe, expect, it } from "vitest";
import {
  migrate,
  id,
  description,
} from "../../../scripts/migrations/2026-05-04-trim-frontmatter-values.mjs";

const fakeFile = (raw: string) => ({
  path: "/tmp/x.md",
  relativePath: "x.md",
  raw,
});

describe("migration: trim-frontmatter-values", () => {
  it("exposes id / description", () => {
    expect(id).toBe("2026-05-04-trim-frontmatter-values");
    expect(description).toMatch(/trailing/);
  });

  it("a file without frontmatter is a no-op (null)", () => {
    expect(migrate(fakeFile("# 그냥 마크다운"))).toBeNull();
  });

  it("frontmatter missing the closing --- is a no-op", () => {
    expect(migrate(fakeFile("---\nkind: project\n# unclosed"))).toBeNull();
  });

  it("already clean frontmatter is a no-op", () => {
    expect(
      migrate(fakeFile("---\nkind: project\nslug: foo\n---\nbody")),
    ).toBeNull();
  });

  it("a scalar with trailing whitespace is trimmed", () => {
    const result = migrate(
      fakeFile("---\nkind: project   \nslug: foo\t\n---\nbody"),
    );
    expect(result).not.toBeNull();
    expect(result?.raw).toBe("---\nkind: project\nslug: foo\n---\nbody");
  });

  it("idempotent: applying twice gives the same result", () => {
    const input = "---\nkind: project   \nslug: foo\t\n---\nbody";
    const first = migrate(fakeFile(input));
    expect(first).not.toBeNull();
    const second = migrate(fakeFile(first!.raw));
    expect(second).toBeNull();
  });

  it("block list dash item indentation is preserved", () => {
    const input = "---\ncaps:\n  - login\n  - reset\n---\n";
    expect(migrate(fakeFile(input))).toBeNull();
  });

  it("trailing whitespace in the body area is left alone", () => {
    const input =
      "---\nkind: project\n---\n\n# heading   \nparagraph with trailing   \n";
    expect(migrate(fakeFile(input))).toBeNull();
  });
});
