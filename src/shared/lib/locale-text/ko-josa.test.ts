import { describe, expect, it } from "vitest";

import { josa } from "./ko-josa";

describe("josa for names ending in a final consonant", () => {
  it.each([
    ["주문", "object", "을"],
    ["주문", "subject", "이"],
    ["주문", "topic", "은"],
    ["주문", "with", "과"],
  ] as const)("%s + %s → %s", (word, kind, expected) => {
    expect(josa(word, kind)).toBe(expected);
  });
});

describe("josa for names without a final consonant", () => {
  it.each([
    ["결제 취소", "object", "를"],
    ["결제 취소", "subject", "가"],
    ["결제 취소", "topic", "는"],
    ["결제 취소", "with", "와"],
    ["결제 취소", "direction", "로"],
  ] as const)("%s + %s → %s", (word, kind, expected) => {
    expect(josa(word, kind)).toBe(expected);
  });
});

/**
 * The directional particle pair follows a different rule from the other four:
 * a rieul final consonant takes the no-final-consonant form. That exception is
 * why this pair is kept separate.
 */
describe("josa exception for a final rieul", () => {
  it("Seoul with direction takes the rieul form", () => {
    expect(josa("서울", "direction")).toBe("로");
  });
  it("Seoul with object is not an exception and takes the plain object form", () => {
    expect(josa("서울", "object")).toBe("을");
  });
});

describe("josa for names ending in a digit follows the spoken sound", () => {
  it.each([
    ["v1", "을"],
    ["v2", "를"],
    ["단계 3", "을"],
    ["단계 5", "를"],
    ["r6", "을"],
    ["항목 9", "를"],
    ["레벨 0", "을"],
  ] as const)("%s → %s", (word, expected) => {
    expect(josa(word, "object")).toBe(expected);
  });

  it("1 ends in a rieul sound, so it gets the direction exception", () => {
    expect(josa("v1", "direction")).toBe("로");
    expect(josa("v3", "direction")).toBe("으로");
  });
});

/**
 * **When it cannot be known, print both.** There is no settled reading for the
 * final consonant of a name ending in Latin letters, so picking one is wrong half
 * the time. This fallback is what makes the module honest rather than merely
 * tidy-looking.
 */
describe("josa falls back to a paired form when it cannot be decided", () => {
  it.each([
    ["order-create", "을(를)"],
    ["MCP", "을(를)"],
    ["", "을(를)"],
    ["※", "을(를)"],
  ] as const)("%s → %s", (word, expected) => {
    expect(josa(word, "object")).toBe(expected);
  });

  it("the paired form uses its own pair for each particle", () => {
    expect(josa("MCP", "subject")).toBe("이(가)");
    expect(josa("MCP", "topic")).toBe("은(는)");
    expect(josa("MCP", "direction")).toBe("으로(로)");
  });

  it("surrounding whitespace does not affect the decision", () => {
    expect(josa("  결제 취소  ", "object")).toBe("를");
  });
});
