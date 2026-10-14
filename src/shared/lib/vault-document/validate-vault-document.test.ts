import { describe, expect, it } from "vitest";
import {
  summarizeVaultValidation,
  validateVaultDocFrontmatter,
  validateVaultDocument,
} from "./validate-vault-document";

const VALID_UID = "00000000-0000-4000-8000-000000000001";

/**
 * A finished body per kind, so a case testing one frontmatter rule is not buried under meaning
 * findings.
 */
const FINISHED_BODY: Record<string, string> = {
  domain:
    "\n# Area\n\n" +
    "Owns how an outside coding agent reaches this folder and what it may change.\n\n" +
    "## Includes\n\n- The stdio child this product starts itself\n\n" +
    "## Excludes\n\n- The coding agent provider traffic, which nothing here sees\n\n" +
    "## Uncertainty\n\n- The Windows launcher path was never exercised\n",
  capability:
    "\n# Ability\n\n" +
    "Turns a reviewed folder of Markdown into a graph a reader can walk without opening code.\n\n" +
    "## Includes\n\n- Reading frontmatter relations from every document\n\n" +
    "## Excludes\n\n- Drawing the result on screen, which the map surface owns\n\n" +
    "## Uncertainty\n\n- The symlinked-subtree case was never measured\n",
  element:
    "\n# Role\n\n" +
    "Holds the one address every agent-facing link resolves to, so a moved surface renames once.\n\n" +
    "## Uncertainty\n\n- The older build deep-link fallback was not read\n",
};

describe("validateVaultDocument", () => {
  it("a docs file with no frontmatter at all is ok", () => {
    const r = validateVaultDocument("# Heading\n\n그냥 메모.");
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("valid frontmatter (canonical kind) is ok", () => {
    const raw = `---\nuid: ${VALID_UID}\nkind: project\nslug: foo\ntitle: Foo\n---\n# Foo`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("a missing closing --- gives an unclosed-frontmatter error", () => {
    const raw = `---\nkind: project\nslug: foo\n# 어, 닫힘 빠짐`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].code).toBe("unclosed-frontmatter");
    expect(r.issues[0].severity).toBe("error");
  });

  it("an empty kind value gives an empty-kind error", () => {
    const raw = `---\nkind:\nslug: foo\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("empty-kind");
  });

  it("frontmatter with no kind at all gives a missing-kind warning (ok)", () => {
    const raw = `---\nslug: foo\ntitle: Foo\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("missing-kind");
    expect(r.issues[0].severity).toBe("warning");
  });

  it("a non-canonical kind value gives an unknown-kind warning (ok)", () => {
    const raw = `---\nuid: ${VALID_UID}\nkind: bogus\nslug: foo\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("unknown-kind");
    expect(r.issues[0].message).toMatch(/bogus/);
  });

  it("a frontmatter block that yields zero keys gives a parse-zero-keys warning", () => {
    // Every key line is invalid (leading colon, comment).
    const raw = `---\n: bad\n# comment\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("parse-zero-keys");
  });

  it("a trimmed kind that is canonical is ok (capability + domain)", () => {
    // capability/element warn with `missing-expected-field` when `domain` is
    // absent; this case is about recognising the kind, so `domain` is supplied
    // to keep the result clean.
    const raw = `---\nuid: ${VALID_UID}\nkind:    capability   \ndomain: domains/auth\n---\n${FINISHED_BODY.capability}`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("recognizes all six (project / domain / capability / element / document / vault-readme)", () => {
    // capability/element need `domain` to come back clean — the schema warns
    // advisorily on a missing parent.
    const cases: Array<{ kind: string; extra?: string }> = [
      { kind: "project" },
      { kind: "domain" },
      { kind: "capability", extra: "domain: domains/auth" },
      { kind: "element", extra: "domain: domains/auth" },
      { kind: "document" },
      { kind: "vault-readme" },
    ];
    for (const c of cases) {
      const extraLine = c.extra ? `\n${c.extra}` : "";
      const r = validateVaultDocument(
        `---\nuid: ${VALID_UID}\nkind: ${c.kind}${extraLine}\n---\n${FINISHED_BODY[c.kind] ?? ""}`,
      );
      expect(r.ok, `kind=${c.kind}`).toBe(true);
      expect(r.issues, `kind=${c.kind}`).toHaveLength(0);
    }
  });

  it("a capability/element without a domain gives a missing-expected-field warning", () => {
    const r = validateVaultDocument(
      `---\nuid: ${VALID_UID}\nkind: capability\ntitle: X\n---\n`,
    );
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("missing-expected-field");
  });

  it("a duplicated or unsorted graph array gives a non-canonical-graph-array warning", () => {
    const r = validateVaultDocument(
      `---\nuid: ${VALID_UID}\nkind: project\ntitle: X\ndependencies: [z, a, z]\n---\n`,
    );
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain(
      "non-canonical-graph-array",
    );
  });

  it("with both an error and a warning ok is false (error takes priority)", () => {
    // `unclosed` returns immediately, so the concurrent case is built
    // differently: check only that an `empty-kind` error alone gives ok=false.
    const raw = `---\nkind:\n---\n`;
    const r = validateVaultDocument(raw);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.severity === "error")).toBe(true);
  });
});

describe("validateVaultDocFrontmatter (parsed-only fast path)", () => {
  it("empty frontmatter has zero ontology signals and is fine (docs-only)", () => {
    const r = validateVaultDocFrontmatter({});
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("frontmatter with only a title has zero ontology signals and is fine (docs-only)", () => {
    const r = validateVaultDocFrontmatter({
      title: "Just a doc",
      tags: ["foo"],
    });
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("an ontology signal (capabilities) without a kind gives a missing-kind warning", () => {
    const r = validateVaultDocFrontmatter({
      title: "X",
      capabilities: ["foo"],
    });
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("missing-kind");
  });

  it("an empty kind string gives an empty-kind error", () => {
    const r = validateVaultDocFrontmatter({ kind: "", title: "X" });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("empty-kind");
  });

  it("a canonical kind is ok (capability with domain)", () => {
    const r = validateVaultDocFrontmatter({
      uid: VALID_UID,
      kind: "capability",
      title: "X",
      domain: "domains/auth",
    });
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("R14 — capability without domain → missing-expected-field warning", () => {
    const r = validateVaultDocFrontmatter({
      uid: VALID_UID,
      kind: "capability",
      title: "X",
    });
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("missing-expected-field");
  });

  it("a duplicated or unsorted graph array gives a non-canonical-graph-array warning", () => {
    const r = validateVaultDocFrontmatter({
      uid: VALID_UID,
      kind: "project",
      title: "X",
      dependencies: ["z", "a", "z"],
    });
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain(
      "non-canonical-graph-array",
    );
  });

  it("a non-canonical kind gives an unknown-kind warning", () => {
    const r = validateVaultDocFrontmatter({
      uid: VALID_UID,
      kind: "weird",
      title: "X",
    });
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("unknown-kind");
  });
});

describe("summarizeVaultValidation", () => {
  it("appends identity conflicts after existing issues without changing row order", () => {
    const summary = summarizeVaultValidation([
      { slug: "b", frontmatter: { uid: VALID_UID, kind: "project", title: "B" } },
      { slug: "a", frontmatter: { uid: VALID_UID, kind: "weird" } },
      { slug: "c", frontmatter: { uid: "00000000-0000-4000-8000-000000000002", merged_uids: [VALID_UID], kind: "project", title: "C" } },
    ]);
    expect(summary.issuesBySlug.map(row => row.slug)).toEqual(["a", "b", "c"]);
    expect(summary.issuesBySlug.map(row => row.issues.map(issue => issue.code))).toEqual([
      ["unknown-kind", "duplicate-uid"], ["duplicate-uid"], ["duplicate-uid"],
    ]);
    expect(summary.errorCount).toBe(3);
    expect(summary.warningCount).toBe(1);
    expect(summary.ok).toBe(false);
  });

  it("attaches repeated-slug conflicts to the first pre-existing issue row", () => {
    const summary = summarizeVaultValidation([
      { slug: "same", frontmatter: { uid: VALID_UID, kind: "weird" } },
      { slug: "same", frontmatter: { uid: VALID_UID, kind: "weird" } },
    ]);
    expect(summary.issuesBySlug.map(row => row.issues.map(issue => issue.code))).toEqual([
      ["unknown-kind", "duplicate-uid", "duplicate-uid"], ["unknown-kind"],
    ]);
    expect(summary.errorCount).toBe(2);
    expect(summary.warningCount).toBe(2);
  });

  it("clean docs — ok / counts 0", () => {
    const summary = summarizeVaultValidation([
      {
        slug: "a",
        frontmatter: { uid: VALID_UID, kind: "project", title: "A" },
      },
      { slug: "b", frontmatter: {} }, // docs-only
    ]);
    expect(summary.ok).toBe(true);
    expect(summary.total).toBe(0);
    expect(summary.errorCount).toBe(0);
    expect(summary.warningCount).toBe(0);
    expect(summary.issuesBySlug).toHaveLength(0);
  });

  it("with only warnings, ok=true, errorCount=0 and warningCount > 0", () => {
    const summary = summarizeVaultValidation([
      { slug: "a", frontmatter: { uid: VALID_UID, kind: "weird" } },
      { slug: "b", frontmatter: { capabilities: ["x"] } },
    ]);
    expect(summary.ok).toBe(true);
    expect(summary.errorCount).toBe(0);
    expect(summary.warningCount).toBe(2);
    expect(summary.issuesBySlug).toHaveLength(2);
  });

  it("a single error makes ok=false", () => {
    const summary = summarizeVaultValidation([
      { slug: "a", frontmatter: { kind: "" } },
      {
        slug: "b",
        frontmatter: { uid: VALID_UID, kind: "project", title: "OK" },
      },
    ]);
    expect(summary.ok).toBe(false);
    expect(summary.errorCount).toBe(1);
  });

  it("issuesBySlug is returned grouped by slug", () => {
    const summary = summarizeVaultValidation([
      { slug: "a", frontmatter: { uid: VALID_UID, kind: "weird" } },
    ]);
    expect(summary.issuesBySlug).toEqual([
      {
        slug: "a",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "unknown-kind" }),
        ]),
      },
    ]);
  });
});

describe("lines the parser could not read are reported as document problems", () => {
  const malformed = [
    { code: "malformed-frontmatter-line", message: "3행을 읽지 못했습니다" },
    { code: "malformed-quoted-scalar", message: "따옴표가 닫히지 않았습니다" },
  ];

  it("raises parse diagnostics as errors", () => {
    const r = validateVaultDocFrontmatter(
      { uid: VALID_UID, kind: "project", title: "X" },
      malformed,
    );
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual([
      "malformed-frontmatter-line",
      "malformed-quoted-scalar",
    ]);
    expect(r.issues.every((i) => i.severity === "error")).toBe(true);
  });

  it("a document that is not an ontology node still reports unreadable lines", () => {
    // Being a docs-only file is a reason to stay quiet about kinds. It is not a reason to stay
    // quiet about a line nobody can read.
    const r = validateVaultDocFrontmatter({ title: "Just a doc" }, malformed);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("malformed-frontmatter-line");
  });

  it("with no diagnostics nothing increases", () => {
    const r = validateVaultDocFrontmatter({ uid: VALID_UID, kind: "project", title: "X" });
    expect(r.issues).toHaveLength(0);
  });

  it("parser codes unrelated to diagnostics are not raised", () => {
    const r = validateVaultDocFrontmatter({ uid: VALID_UID, kind: "project", title: "X" }, [
      { code: "some-other-note", message: "무시되어야 한다" },
    ]);
    expect(r.issues).toHaveLength(0);
  });

  it("the summary counts the same facts, the single point for every document the map draws", () => {
    const summary = summarizeVaultValidation([
      { slug: "a", frontmatter: { uid: VALID_UID, kind: "project" }, diagnostics: malformed },
      { slug: "b", frontmatter: { uid: "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607", kind: "project" } },
    ]);
    expect(summary.ok).toBe(false);
    expect(summary.errorCount).toBe(2);
    expect(summary.issuesBySlug.map((entry) => entry.slug)).toEqual(["a"]);
  });
});
