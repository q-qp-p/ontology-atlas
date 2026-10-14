import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source files are text: one NUL byte makes git treat a file as binary, so diffs are unreviewable
 * and grep silently skips it. Use `JSON.stringify([...])` for composite keys; compare fields to sort.
 */

const ROOTS = ["src", "app", "cli", "mcp", "scripts", "tests"] as const;
const EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js", ".json", ".css", ".md"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "output", ".codegraph"]);

function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) found.push(path);
    }
  };
  for (const root of ROOTS) walk(root);
  return found;
}

describe("source is text — git and grep must be able to see it", () => {
  it("no source file has a NUL byte", () => {
    const files = sourceFiles();
    // Idling guard — with an empty list, the "0 violations" below proves nothing.
    expect(files.length, "no file scanned — the path list is stale").toBeGreaterThan(1_000);

    const offenders = files.filter((file) => readFileSync(file).includes(0x00));
    expect(
      offenders,
      "A single NUL makes git treat the file as binary: the pull request shows no diff " +
        "(it cannot be reviewed) and grep silently answers zero matches. Build composite keys with " +
        "JSON.stringify([...]), and sort by comparing fields in order instead of concatenating them.",
    ).toEqual([]);
  });
});
