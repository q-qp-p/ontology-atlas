import { describe, expect, it } from "vitest";

import {
  describeChangePath,
  describeSnapshotSubject,
  parseUnifiedDiff,
  splitConceptChanges,
} from "./atlas-git-record";

describe("splitConceptChanges", () => {
  it("counts only changes that have a kind as concepts, separating judged items from companion files", () => {
    const { concepts, others } = splitConceptChanges([
      { status: "added", kind: "capability", slug: "capabilities/foo" },
      { status: "modified", kind: null, slug: ".gitignore" },
      { status: "modified", kind: "element", slug: "elements/bar" },
      { status: "added", kind: undefined, slug: "package.json" },
    ]);
    expect(concepts.map((c) => c.slug)).toEqual(["capabilities/foo", "elements/bar"]);
    expect(others.map((c) => c.slug)).toEqual([".gitignore", "package.json"]);
  });

  it("keeps order of appearance, so the reading order of the list is the file order", () => {
    const { concepts } = splitConceptChanges([
      { status: "added", kind: "domain", slug: "b" },
      { status: "added", kind: "domain", slug: "a" },
    ]);
    expect(concepts.map((c) => c.slug)).toEqual(["b", "a"]);
  });
});

describe("describeChangePath", () => {
  it("separates the name from the location", () => {
    expect(describeChangePath("capabilities/map-label-budget")).toEqual({
      name: "map-label-budget",
      place: "capabilities",
    });
  });

  it("the .md extension of a concept path is not part of the name", () => {
    expect(describeChangePath("docs/ontology/elements/foo.md", { isConcept: true })).toEqual({
      name: "foo",
      place: "docs/ontology/elements",
    });
  });

  it("a file that is not a concept keeps its extension, as it is part of its identity", () => {
    expect(describeChangePath("scripts/perf-graph.mjs")).toEqual({
      name: "perf-graph.mjs",
      place: "scripts",
    });
  });

  it("with no folder the location is an empty string", () => {
    expect(describeChangePath(".gitignore")).toEqual({ name: ".gitignore", place: "" });
  });
});

describe("parseUnifiedDiff", () => {
  const DIFF = [
    "diff --git a/docs/a.md b/docs/a.md",
    "index 4a1c0de..8b71f92 100644",
    "--- a/docs/a.md",
    "+++ b/docs/a.md",
    "@@ -12,6 +12,9 @@ relations:",
    "   depends_on:",
    "-    - elements/old",
    "+    - elements/new",
    "@@ -30,2 +33,2 @@",
    " tail",
    "diff --git a/docs/b.md b/docs/b.md",
    "new file mode 100644",
    "index 0000000..1111111",
    "--- /dev/null",
    "+++ b/docs/b.md",
    "@@ -0,0 +1,2 @@",
    "+first",
    "+second",
    "\\ No newline at end of file",
    "",
  ].join("\n");

  it("splits per file and uses the new path", () => {
    expect(parseUnifiedDiff(DIFF).map((f) => f.path)).toEqual(["docs/a.md", "docs/b.md"]);
  });

  it("leaves no git plumbing line (diff --git, index, ---, +++, new file mode)", () => {
    const text = parseUnifiedDiff(DIFF)
      .flatMap((f) => f.lines.map((l) => l.text))
      .join("\n");
    expect(text).not.toContain("diff --git");
    expect(text).not.toContain("index 4a1c0de");
    expect(text).not.toContain("new file mode");
    expect(text).not.toContain("No newline");
  });

  it("drops hunk coordinates but keeps the fact that something was omitted", () => {
    const [first] = parseUnifiedDiff(DIFF);
    expect(first!.lines.map((l) => l.kind)).toEqual([
      "context",
      "removed",
      "added",
      "skip",
      "context",
    ]);
    // No elision marker before the first hunk means the diff starts at the top of the file.
    expect(first!.lines[0]!.kind).not.toBe("skip");
  });

  it("counts added and removed lines", () => {
    const [a, b] = parseUnifiedDiff(DIFF);
    expect({ added: a!.added, removed: a!.removed }).toEqual({ added: 1, removed: 1 });
    expect({ added: b!.added, removed: b!.removed }).toEqual({ added: 2, removed: 0 });
  });

  it("empty input gives an empty array", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
    expect(parseUnifiedDiff("   ")).toEqual([]);
  });

  it("does not count `+++`/`---` as added or removed lines, since the header is decided before line classification", () => {
    // Regression guard: if the header filter runs **after** the `+`/`-` test, the two file
    // path lines count as one added and one removed line, inflating every file's totals by
    // +1 / −1.
    const [file] = parseUnifiedDiff(DIFF);
    expect(file!.lines.some((l) => l.text.includes("docs/a.md"))).toBe(false);
  });

  it("also reads a short diff without a hunk header (@@)", () => {
    // Some tools and fixtures emit a `+` line directly after `diff --git`. The header filter is
    // explicit, so this is safe even without a hunk check.
    const files = parseUnifiedDiff("diff --git a/docs/x.md b/docs/x.md\n+new line\n");
    expect(files).toHaveLength(1);
    expect(files[0]!.lines).toEqual([{ kind: "added", text: "new line" }]);
  });
});

describe("describeSnapshotSubject", () => {
  it("reads our own commit subject format back into a number and a name", () => {
    const parsed = describeSnapshotSubject(
      "ontology snapshot: +2 concepts, ~1 updated (capabilities/foo, elements/bar, +3)",
    );
    expect(parsed.matched).toBe(true);
    expect(parsed.added).toBe(2);
    expect(parsed.updated).toBe(1);
    expect(parsed.slugs).toEqual(["capabilities/foo", "elements/bar"]);
    expect(parsed.overflow).toBe(3);
  });

  it("reads renames and deletions too", () => {
    const parsed = describeSnapshotSubject(
      "ontology snapshot: →1 renamed, -2 removed (elements/gone)",
    );
    expect(parsed).toMatchObject({ matched: true, renamed: 1, removed: 2, overflow: 0 });
  });

  it("the singular form (+1 concept) has the same format", () => {
    expect(describeSnapshotSubject("ontology snapshot: +1 concept (domains/record)")).toMatchObject({
      matched: true,
      added: 1,
      slugs: ["domains/record"],
    });
  });

  it("a snapshot with no changes is also our format", () => {
    expect(describeSnapshotSubject("ontology snapshot: no concept changes")).toMatchObject({
      matched: true,
      added: 0,
      updated: 0,
      slugs: [],
    });
  });

  it("leaves a subject alone when it is not our format, since a human-written sentence is the human's word", () => {
    const parsed = describeSnapshotSubject("fix: 라벨 예산 상한 회귀 정정");
    expect(parsed.matched).toBe(false);
    expect(parsed.raw).toBe("fix: 라벨 예산 상한 회귀 정정");
    expect(parsed.slugs).toEqual([]);
  });
});
