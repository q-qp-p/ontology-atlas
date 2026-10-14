import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Chips of the same kind in the same row use the same type step: `text-label` here, with
 * `text-caption` permitted only at the eyebrow (`editorEyebrow`). Lint cannot see it, since it needs
 * what the other chips use. Targets the chip shape: `rounded-micro` with `tracking-caps-*`.
 */

const EDITOR = "src/widgets/docs-vault/ui/DocsVaultEditor.tsx";

/**
 * Source with comments removed. This gate counts **classes that reach the
 * screen**, not sentences describing them — without stripping, a comment
 * documenting the spec is itself caught as a violation, creating the inverted
 * incentive that writing down the spec turns the gate red.
 */
function sourceWithoutComments(): string {
  return readFileSync(EDITOR, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The status chip's signature — a class string using both of these is a chip in this row. */
function statusChipClassStrings(source: string): string[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("rounded-micro") && line.includes("tracking-caps-"));
}

describe("editor top line: the status chip has one type dialect", () => {
  it("there is no `text-caption` (9.5px) anywhere in the status chip", () => {
    const chips = statusChipClassStrings(sourceWithoutComments());
    // Idling guard — if no chip is found, the "0 violations" below means nothing.
    expect(
      chips.length,
      "found no status chip at all, so the signature (rounded-micro + tracking-caps) is stale",
    ).toBeGreaterThanOrEqual(3);

    const offenders = chips.filter((chip) => chip.includes("text-caption"));
    expect(
      offenders.map((c) => c.slice(0, 100)),
      "Chips in this row are text-label (11px). By the ramp's definition 9.5px is " +
        "the step for micro labels, legends and timestamps, and chips standing side by side are none of those: " +
        "one chip a step smaller creates a hierarchy nobody decided.",
    ).toEqual([]);
  });

  it("the three status chips really use the same step", () => {
    const source = sourceWithoutComments();
    // Find each chip by its own i18n key and read the class on the span that opens it.
    const chipKeys = ["saveContractAriaLabel", "saveWorkflowAriaLabel"] as const;
    for (const key of chipKeys) {
      const idx = source.indexOf(key);
      expect(idx, `could not find ${key}, so the gate is stale`).toBeGreaterThan(0);
      const openTag = source.lastIndexOf("<span", idx);
      const chip = source.slice(openTag, idx);
      expect(chip, `the ${key} chip lost text-label`).toContain("text-label");
    }
    // The save-state chip has three tone branches — all three must use the same step.
    const toneBranches = source
      .split("\n")
      .filter((l) => l.includes("rounded-micro") && l.includes("tracking-caps-10"));
    expect(
      toneBranches.length,
      "could not find the tone branch of the save status chip, so the gate spins idle",
    ).toBeGreaterThanOrEqual(3);
    for (const branch of toneBranches) {
      expect(branch, "if the step splits per tone branch, the text size changes with the status").toContain(
        "text-label",
      );
    }
  });
});

/**
 * In this whole file `text-caption` appears at the eyebrow only, the one micro label the ramp
 * describes. A new place that needs caption grows this list with the reason written down.
 */
describe("the 9.5px in the editor is the eyebrow only", () => {
  it("no place other than the eyebrow uses `text-caption`", () => {
    const source = sourceWithoutComments();
    const lines = source.split("\n");
    const captionLines = lines
      .map((line, index) => ({ line: line.trim(), no: index + 1 }))
      .filter(({ line }) => line.includes("text-caption"));

    // Idling guard — if the eyebrow itself disappears, this test reports "0
    // violations" forever. At least one occurrence must exist.
    expect(
      captionLines.length,
      "there is no text-caption at all, so the eyebrow is gone or the gate is stale",
    ).toBeGreaterThanOrEqual(1);

    // The eyebrow renders its own i18n key on the next line; that is how it is told apart.
    const offenders = captionLines.filter(
      ({ no }) => !lines.slice(no - 1, no + 2).join(" ").includes("editorEyebrow"),
    );
    expect(
      offenders.map(({ no, line }) => `${no}: ${line.slice(0, 100)}`),
      "By the ramp's definition 9.5px is the step for micro labels, legends and timestamps. In the editor " +
        "only the eyebrow qualifies; descriptions, hints and footers are text-label (11px).",
    ).toEqual([]);
  });
});

describe("the \"Preview\" label is one per screen", () => {
  it("the editor split view toggle does not use the same name as the document header tab", () => {
    for (const locale of ["ko", "en"] as const) {
      const messages = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));
      const headerTab: string = messages.docsVault.editorHeader.previewTab;
      const splitToggle: string = messages.vaultWidgets.editor.preview;
      expect(headerTab.length, `${locale}: the header tab label is empty`).toBeGreaterThan(0);
      expect(splitToggle.length, `${locale}: the split toggle label is empty`).toBeGreaterThan(0);
      expect(
        splitToggle.trim().toLowerCase(),
        `${locale}: two controls drawn on one screen share a name. ` +
          `The header tab switches between reading and editing; this one puts the result beside the source.`,
      ).not.toBe(headerTab.trim().toLowerCase());
    }
  });
});
