import { describe, expect, it } from "vitest";
import { shellArg } from "./shell-arg";

describe("shellArg", () => {
  it("wraps a plain value in single quotes", () => {
    expect(shellArg("capabilities/mcp-server")).toBe("'capabilities/mcp-server'");
  });

  it("escapes an inner single quote the POSIX way ('\\'')", () => {
    expect(shellArg("a'b")).toBe("'a'\\''b'");
  });

  it("an empty string gives an empty pair of quotes", () => {
    expect(shellArg("")).toBe("''");
  });

  it("whitespace and special characters are safe inside the quotes", () => {
    expect(shellArg("a b; rm -rf")).toBe("'a b; rm -rf'");
  });
});
