import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readLedgerSource } from '../../../scripts/lib/records/record-ledgers.mjs';

import { describe, expect, it } from "vitest";

/**
 * Em-dash ratchet: the dash must not appear in user-facing text, since it is a sentence shape models
 * default to. A lone empty-value glyph is excluded as a symbol, not prose.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/**
 * Zero is a ban, not a cap. Bulk machine replacement breaks sentences (`downloads: with their real
 * sizes and checksums: appear here`), so fixes are by hand. A lone dash meaning no value is excluded.
 */
const BASELINE = { ko: 0, en: 0 } as const;

/**
 * **A symbol, not prose** — a lone dash meaning "no value". Not a sentence, so
 * this ratchet does not count it.
 */
function isPlaceholderGlyph(value: string): boolean {
  return value.trim() === "—";
}

function countEmDash(locale: "ko" | "en"): { strings: number; withDash: number } {
  const raw = JSON.parse(
    readFileSync(join(REPO_ROOT, "messages", `${locale}.json`), "utf8"),
  ) as unknown;
  let strings = 0;
  let withDash = 0;
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      strings += 1;
      if (node.includes("—") && !isPlaceholderGlyph(node)) withDash += 1;
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === "object") {
      for (const value of Object.values(node)) walk(value);
    }
  };
  walk(raw);
  return { strings, withDash };
}

describe("em-dash ratchet — user-facing copy", () => {
  for (const locale of ["ko", "en"] as const) {
    it(`${locale}: copy using an em dash does not grow`, () => {
      const { strings, withDash } = countEmDash(locale);
      // Idling guard — failing to read the file and passing with "0 hits" is the worst failure here.
      expect(strings, `${locale}: could not read a single string — this ratchet idles`).toBeGreaterThan(
        2_000,
      );
      expect(
        withDash,
        `${locale} copy gained ${withDash} strings with a dash.\n` +
          "\"Short lead — long explanation\" is a model's default sentence shape. End a finished sentence with a period, " +
          "join a continuation with a colon, and put an aside in parentheses.\n" +
          "A string that is only \"—\" (meaning no value) is a symbol and is not counted.",
      ).toBeLessThanOrEqual(BASELINE[locale]);
      // At 0 the "lower the cap when it falls" clause is unnecessary — there is nowhere lower.
    });
  }
});

/**
 * The sample vault carries no dash either: it is the only data a first-time visitor reads, and at 0
 * a ban fits better than a cap.
 */
/**
 * Documents rendered on screen carry no dash: `samples/storefront/**`, `docs/guide/**`,
 * `docs/ontology/**`, `docs/CHANGELOG.md`. The boundary is whether a user reads it; the append-only
 * decisions ledger and agent-facing docs are excluded.
 */
describe("em dash — documents rendered on screen", () => {
  const RENDERED_DOC_ROOTS = [
    join(REPO_ROOT, "samples", "storefront"),
    join(REPO_ROOT, "docs", "guide"),
    join(REPO_ROOT, "docs", "ontology"),
  ];
  const RENDERED_DOC_FILES = [join(REPO_ROOT, "docs", "CHANGELOG.md")];

  const markdownFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...markdownFiles(full));
      else if (entry.name.endsWith(".md")) out.push(full);
    }
    return out;
  };

  it("no document rendered on screen has an em dash", () => {
    const files = [...RENDERED_DOC_ROOTS.flatMap(markdownFiles), ...RENDERED_DOC_FILES];
    expect(files.length, "could not read a single document. This test idles").toBeGreaterThan(0);
    // Each root really produced files — one root at 0 can still clear the total.
    for (const root of RENDERED_DOC_ROOTS) {
      expect(markdownFiles(root).length, `could not read documents from ${root}`).toBeGreaterThan(0);
    }
    /**
     * Code blocks are exempt: guide transcripts record what the CLI actually prints, dashes included, and
     * editing them would document output the program does not produce. Fix the CLI first, then the docs.
     */
    const proseHasDash = (text: string): boolean => {
      let inFence = false;
      for (const line of text.split("\n")) {
        if (line.trimStart().startsWith("```")) {
          inFence = !inFence;
          continue;
        }
        if (!inFence && line.includes("—")) return true;
      }
      return false;
    };

    const offenders = files
      .filter((file) => proseHasDash(file === RENDERED_DOC_FILES[0]
        ? readLedgerSource('docs/CHANGELOG.md')!.content
        : readFileSync(file, "utf8")))
      .map((file) => file.slice(REPO_ROOT.length + 1));
    expect(
      offenders,
      "A dash entered the **prose** of a document the screen renders. End a finished sentence with a period, " +
        "join a continuation with a colon, put an aside in parentheses. (Code blocks transcribe program output and are exempt.)\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
