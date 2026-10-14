import { describe, expect, it } from "vitest";
import { shouldShowGetAppTile } from "./show-get-app-tile";

describe("get-app tile shows only on the web and only after mount", () => {
  it("shows once mounted on the web", () => {
    expect(shouldShowGetAppTile({ mounted: true, isDesktopApp: false })).toBe(true);
  });

  // Offering "get the app" to someone who installed it is misinformation in itself.
  it("does not show in the installed app", () => {
    expect(shouldShowGetAppTile({ mounted: true, isDesktopApp: true })).toBe(false);
  });

  /**
   * Prerendered HTML has no window, so it always decides "web". If the app loads
   * that HTML and hydration then removes the tile, **app users see a one-frame
   * flicker** — appearing one frame late is better than showing a wrong state and
   * correcting it.
   */
  it("renders neither before mount", () => {
    expect(shouldShowGetAppTile({ mounted: false, isDesktopApp: false })).toBe(false);
    expect(shouldShowGetAppTile({ mounted: false, isDesktopApp: true })).toBe(false);
  });
});
