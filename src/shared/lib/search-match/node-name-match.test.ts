import { describe, expect, it, vi } from "vitest";
import { findNameMatch, idSearchText, normalizeForMatch } from "./node-name-match";

const chosungCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock("./hangul-match", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./hangul-match")>();
  return {
    ...actual,
    chosungKey: (value: string) => {
      chosungCalls.count += 1;
      return actual.chosungKey(value);
    },
  };
});

const node = {
  title: "Shipping Fee Policy",
  display: "배송비 정책",
  displayLocales: { ko: "배송비 정책", en: "Shipping Fee Policy" },
};

describe("findNameMatch", () => {
  const ask = (query: string) => findNameMatch(node, normalizeForMatch(query));

  it("reports which name carried the match", () => {
    expect(ask("policy")).toEqual({ name: "Shipping Fee Policy", tier: "includes" });
    expect(ask("배송비")).toEqual({ name: "배송비 정책", tier: "prefix" });
  });

  it("an exact match is the strongest", () => {
    expect(ask("배송비 정책")).toEqual({ name: "배송비 정책", tier: "equals" });
  });

  it("the Hangul keyboard tier ranks below a literal match", () => {
    expect(ask("ㅂㅅㅂ")?.tier).toBe("hangul-prefix");
    expect(ask("배ㅅ")?.tier).toBe("hangul-prefix");
  });

  it("an empty query and no match give null", () => {
    expect(ask("")).toBeNull();
    expect(ask("zzz")).toBeNull();
  });

  it("the canonical title is always a candidate, whatever the display name is", () => {
    // The point of the whole module: widening never costs the original.
    expect(ask("Shipping Fee Policy")?.tier).toBe("equals");
  });
});

describe("idSearchText", () => {
  it("yields only the slug with the kind prefix removed", () => {
    expect(idSearchText("element:order-number", "order")).toBe("order-number");
    expect(idSearchText("capability:cart", "cart")).toBe("cart");
  });

  it("a query containing a colon is a whole id pasted in", () => {
    expect(idSearchText("element:order-number", "element:order")).toBe("element:order-number");
  });

  it("an id without a colon is taken whole", () => {
    expect(idSearchText("auth-logout", "logout")).toBe("auth-logout");
  });

  it("an empty slug yields nothing", () => {
    expect(idSearchText("element:", "x")).toBeNull();
  });
});

describe("name index", () => {
  it("builds each node's names once; a later keystroke re-derives none", () => {
    const nodes = Array.from({ length: 50 }, (_, i) => ({
      title: `회원 탈퇴 ${i}`,
      display: `Capability ${i}`,
      displayLocales: { ko: `회원 탈퇴 ${i}`, en: `Capability ${i}` },
    }));
    // Initials reach the last tier, so every name of every node is examined.
    const query = normalizeForMatch("ㅌㅌ");
    const pass = () => nodes.filter((node) => findNameMatch(node, query)).length;
    const normalize = vi.spyOn(String.prototype, "normalize");

    chosungCalls.count = 0;
    normalize.mockClear();
    expect(pass()).toBe(nodes.length);
    expect(chosungCalls.count, "initials are built once per distinct name").toBe(nodes.length * 2);
    expect(normalize, "the first query normalises every name").toHaveBeenCalled();

    chosungCalls.count = 0;
    normalize.mockClear();
    expect(pass()).toBe(nodes.length);
    expect(chosungCalls.count, "a repeated query rebuilt the initials").toBe(0);
    expect(normalize, "a repeated query re-normalised node names").not.toHaveBeenCalled();
    normalize.mockRestore();
  });
});
