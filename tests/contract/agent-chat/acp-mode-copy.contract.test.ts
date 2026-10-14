import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import ko from "../../../messages/ko.json";
import { MEASURED_MODE_IDS, modeCopyKey } from "@/features/acp-session/model/session-choices/mode-copy";

/**
 * Every translated mode id exists in both languages; an unknown id gets no translation key, since an
 * invented line is an unverified promise.
 */
type Bundle = { acpChat?: { modeName?: Record<string, string>; modeHint?: Record<string, string> } };

const bundles: Array<[string, Bundle]> = [
  ["ko", ko as unknown as Bundle],
  ["en", en as unknown as Bundle],
];

describe("work-mode copy", () => {
  it("the list of modes to translate is not empty — otherwise what follows idles", () => {
    expect(MEASURED_MODE_IDS.length).toBeGreaterThanOrEqual(5);
  });

  describe.each(bundles)("%s", (_locale, bundle) => {
    it("every id has a name and a one-line description", () => {
      for (const id of MEASURED_MODE_IDS) {
        expect(bundle.acpChat?.modeName?.[id], `${id} name`).toBeTruthy();
        expect(bundle.acpChat?.modeHint?.[id], `${id} description`).toBeTruthy();
      }
    });

    it("the description is one line — it is text read inside a list", () => {
      for (const id of MEASURED_MODE_IDS) {
        const hint = bundle.acpChat?.modeHint?.[id] ?? "";
        expect(hint.length, `${id}`).toBeLessThan(60);
        expect(hint).not.toContain("\n");
      }
    });

    it("both languages cover the same set of ids", () => {
      expect(Object.keys(bundle.acpChat?.modeName ?? {}).sort()).toEqual([...MEASURED_MODE_IDS].sort());
      expect(Object.keys(bundle.acpChat?.modeHint ?? {}).sort()).toEqual([...MEASURED_MODE_IDS].sort());
    });
  });

  it("an unknown mode is not translated — the adapter name is used as it is", () => {
    expect(modeCopyKey("bypassPermissions")).toBeNull();
    expect(modeCopyKey("acceptEdits")).toBeNull();
    expect(modeCopyKey("some-new-mode")).toBeNull();
    expect(modeCopyKey(null)).toBeNull();
  });

  it("it does not waver over differences in adapter notation", () => {
    expect(modeCopyKey("dontAsk")).toBe("dontask");
    expect(modeCopyKey(" Read-Only ")).toBe("read-only");
    expect(modeCopyKey("default")).toBe("default");
  });
});
