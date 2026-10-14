import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readGlobalCss } from "../../../scripts/lib/design/global-css.mjs";

// Calls **the same module** as the gate script. A copy would make the contract check
// the copy rather than the gate.
import {
  censusFor,
  diffCensus,
  parseTriggerFiles,
  SPEC_RULE_DOC,
  SPEC_RULE_SECTION,
} from "../../../scripts/lib/design/design-spec-census.mjs";

/**
 * Keeps the rule that changing the specification requires `design-contract` from living only in a
 * document: one authoritative trigger list the gate reads, every listed path exists, the detector
 * does not run on an empty set, and comment- or whitespace-only diffs are not spec changes.
 */

const TRIGGER_SECTION_DOC = SPEC_RULE_DOC as string;

function readDoc() {
  return readFileSync(TRIGGER_SECTION_DOC, "utf8");
}

describe("design spec → ledger gate", () => {
  it("the trigger list is derived from the canonical document (no copy in code)", () => {
    const gate = readFileSync("scripts/records/check-decision-record.mjs", "utf8");
    expect(gate).toContain("design-spec-census.mjs");
    expect(gate).toContain("parseTriggerFiles");
    // A gate holding its own list makes two copies, and drift becomes the default.
    for (const path of parseTriggerFiles(readDoc()) as string[]) {
      expect(
        gate.includes(`"${path}"`) || gate.includes(`'${path}'`),
        `${path} is hard-coded in the gate script — the list lives in ${TRIGGER_SECTION_DOC} only.`,
      ).toBe(false);
    }
  });

  it("every path in the list exists", () => {
    const files = parseTriggerFiles(readDoc()) as string[];
    expect(files.length).toBeGreaterThan(0);
    for (const path of files) {
      expect(existsSync(path), `${TRIGGER_SECTION_DOC} points at a missing file: ${path}`).toBe(
        true,
      );
    }
  });

  it("each trigger file really yields spec entries today (the detector does not idle)", () => {
    for (const path of parseTriggerFiles(readDoc()) as string[]) {
      const census = censusFor(path, path === "app/globals.css" ? readGlobalCss() : readFileSync(path, "utf8")) as Map<string, string>;
      expect(
        census.size,
        `The census of ${path} is empty: the file moved or the extraction rule is stale. ` +
          `An empty census cannot be told apart from a gate that catches nothing.`,
      ).toBeGreaterThan(0);
    }
  });

  it("the section heading is alive (the parser does not silently come back empty-handed)", () => {
    expect(readDoc()).toContain(SPEC_RULE_SECTION as string);
  });

  describe("what counts as a spec change", () => {
    const css = "app/globals.css";
    const control = "src/shared/ui/control-class.ts";

    it("catches adding, deleting and changing the value of a ramp token", () => {
      const before = censusFor(css, ":root { --text-body: 12.5px; --radius-chip: 6px; }");
      const added = censusFor(
        css,
        ":root { --text-body: 12.5px; --radius-chip: 6px; --text-mega: 40px; }",
      );
      const changed = censusFor(css, ":root { --text-body: 13px; --radius-chip: 6px; }");
      const removed = censusFor(css, ":root { --text-body: 12.5px; }");

      expect(diffCensus(before, added)).toHaveLength(1);
      expect(diffCensus(before, changed)).toHaveLength(1);
      expect(diffCensus(before, removed)).toHaveLength(1);
    });

    it("CSS with only comments, whitespace or declaration order changed is not a spec change", () => {
      const before = censusFor(css, ":root { --text-body: 12.5px; --radius-chip: 6px; }");
      const after = censusFor(
        css,
        ":root {\n  /* 기본 본문 — 설명을 고쳤다 */\n  --radius-chip:   6px;\n  --text-body: 12.5px;\n}",
      );
      expect(diffCensus(before, after)).toEqual([]);
    });

    it("surface-only colour tokens are not ramps (false-positive suppression)", () => {
      const before = censusFor(css, ":root { --color-indigo-a08: rgba(1,2,3,0.08); }");
      const after = censusFor(css, ":root { --color-indigo-a08: rgba(1,2,3,0.09); }");
      expect(before.size).toBe(0);
      expect(diffCensus(before, after)).toEqual([]);
    });

    it("a moved palette root is a spec change", () => {
      const before = censusFor(css, ":root { --color-indigo-brand: #5e6ad2; }");
      const after = censusFor(css, ":root { --color-indigo-brand: #6070e0; }");
      expect(diffCensus(before, after)).toHaveLength(1);
    });

    it("catches added or removed cva axes, options and defaults", () => {
      const base = `const c = cva('', { variants: { shape: { chip: 'a', icon: 'b' } }, defaultVariants: { shape: 'chip' } });`;
      const newOption = `const c = cva('', { variants: { shape: { chip: 'a', icon: 'b', tile: 'c' } }, defaultVariants: { shape: 'chip' } });`;
      const newAxis = `const c = cva('', { variants: { shape: { chip: 'a', icon: 'b' }, scope: { app: '', panel: '' } }, defaultVariants: { shape: 'chip' } });`;
      const newDefault = `const c = cva('', { variants: { shape: { chip: 'a', icon: 'b' } }, defaultVariants: { shape: 'icon' } });`;

      expect(diffCensus(censusFor(control, base), censusFor(control, newOption))).toHaveLength(1);
      expect(diffCensus(censusFor(control, base), censusFor(control, newAxis))).toHaveLength(1);
      expect(diffCensus(censusFor(control, base), censusFor(control, newDefault))).toHaveLength(1);
    });

    it("a change only in the class string an option emits is not a spec change", () => {
      const before = `const c = cva('', { variants: { shape: { chip: 'gap-1.5 rounded-chip' } } });`;
      const after = `const c = cva('', { variants: { shape: { chip: 'gap-2 rounded-chip' } } });`;
      expect(diffCensus(censusFor(control, before), censusFor(control, after))).toEqual([]);
    });

    it("example code inside a comment is not counted as a spec (the reason a TS parser is used)", () => {
      const withComment = `/** 예: variants: { ghost: { on: 'x' } } — 쓰지 말 것 */\nconst c = cva('', { variants: { shape: { chip: 'a' } } });`;
      const census = censusFor(control, withComment) as Map<string, string>;
      expect([...census.keys()]).toEqual(["axis shape"]);
    });
  });
});
