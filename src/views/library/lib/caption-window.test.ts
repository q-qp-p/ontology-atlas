import { describe, expect, it } from "vitest";

import { captionWindow } from "./caption-window";

/**
 * The window leaves some of the file's words out but never changes them; about 33 characters of the
 * unit are visible in the index column.
 */

const RECORD =
  "method,region,percent_fee,fixed_fee_krw,settles,card_domestic,KR,2.20,0,T+2";

describe("the search caption's window", () => {
  it("leaves a line alone when the phrase is already visible", () => {
    const line = "Card payments settle on T+2 business days.";
    expect(captionWindow(line, "t+2")).toBe(line);
  });

  it("windows onto the phrase, with a leading mark, when it sits past the line", () => {
    const windowed = captionWindow(RECORD, "t+2");
    expect(windowed).not.toBe(RECORD);
    expect(windowed.startsWith("…")).toBe(true);
    expect(windowed).toContain("T+2");
    // Every character after the mark is the file's own, in its own order.
    expect(RECORD).toContain(windowed.slice(1));
  });

  it("cuts on a word boundary rather than inside a word", () => {
    const windowed = captionWindow(RECORD, "t+2");
    expect(windowed).not.toMatch(/^…[a-z]/);
  });

  it("stands down when nothing was typed, or the phrase is not in the line", () => {
    expect(captionWindow(RECORD, "")).toBe(RECORD);
    expect(captionWindow(RECORD, "chargeback")).toBe(RECORD);
  });
});
