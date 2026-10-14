import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDocumentTitle } from "./use-document-title";

const ORIGINAL_TITLE = document.title;

afterEach(() => {
  document.title = ORIGINAL_TITLE;
});

describe("useDocumentTitle", () => {
  it("updates document.title when given a string", () => {
    renderHook(() => useDocumentTitle("Demo · demo"));
    expect(document.title).toBe("Demo · demo");
  });

  it("ignores null and empty values", () => {
    document.title = "Untouched";
    renderHook(() => useDocumentTitle(null));
    expect(document.title).toBe("Untouched");
    renderHook(() => useDocumentTitle(""));
    expect(document.title).toBe("Untouched");
  });

  it("on unmount it does not overwrite a title the next screen already wrote", () => {
    // The destination route owns the title from unmount on; restoring the mount-time title would
    // overwrite it.
    document.title = "Before";
    const { unmount } = renderHook(() => useDocumentTitle("During"));
    expect(document.title).toBe("During");
    document.title = "Next route";
    unmount();
    expect(document.title).toBe("Next route");
  });

  it("reflects the new value when the input changes", () => {
    const { rerender } = renderHook(
      ({ value }: { value: string }) => useDocumentTitle(value),
      { initialProps: { value: "First" } },
    );
    expect(document.title).toBe("First");
    rerender({ value: "Second" });
    expect(document.title).toBe("Second");
  });
});
