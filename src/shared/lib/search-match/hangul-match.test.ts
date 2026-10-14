import { describe, expect, it } from "vitest";
import {
  findHangulMatch,
  hangulIncludes,
  hangulStartsWith,
  isChosungQuery,
  toChosung,
} from "./hangul-match";

describe("toChosung", () => {
  it("reduces a syllable to its single initial consonant", () => {
    expect(toChosung("장바구니")).toBe("ㅈㅂㄱㄴ");
    expect(toChosung("주문서 작성")).toBe("ㅈㅁㅅ ㅈㅅ");
    expect(toChosung("회원 탈퇴")).toBe("ㅎㅇ ㅌㅌ");
  });

  it("leaves non-Hangul characters as they are (length preserved)", () => {
    expect(toChosung("MCP 서버")).toBe("MCP ㅅㅂ");
    expect(toChosung("auth-login")).toBe("auth-login");
    expect(toChosung("결제 API v2")).toBe("ㄱㅈ API v2");
  });

  it("leaves an already isolated consonant as it is", () => {
    expect(toChosung("ㅈㅂㄱㄴ")).toBe("ㅈㅂㄱㄴ");
  });
});

describe("isChosungQuery", () => {
  it("only a query made purely of isolated consonants is an initial-consonant query", () => {
    expect(isChosungQuery("ㅈㅂㄱㄴ")).toBe(true);
    expect(isChosungQuery("ㅈㅁㅅ ㅈㅅ")).toBe(true);
    expect(isChosungQuery("ㄱ")).toBe(true);
  });

  it("a query mixing complete syllables, vowels or Latin is not an initial-consonant query", () => {
    expect(isChosungQuery("장바구니")).toBe(false);
    expect(isChosungQuery("장바ㄱ")).toBe(false);
    expect(isChosungQuery("ㅏㅏ")).toBe(false);
    expect(isChosungQuery("abc")).toBe(false);
    expect(isChosungQuery("")).toBe(false);
    expect(isChosungQuery("   ")).toBe(false);
  });
});

describe("findHangulMatch with an initial-consonant query", () => {
  it("finds a name from its initial consonants alone", () => {
    expect(findHangulMatch("장바구니", "ㅈㅂㄱㄴ")).toEqual({ start: 0, end: 4 });
    expect(findHangulMatch("주문서 작성", "ㅈㅁㅅ")).toEqual({ start: 0, end: 3 });
  });

  it("initial consonants match in the middle of a name too", () => {
    expect(findHangulMatch("신규 회원 탈퇴", "ㅎㅇ")).toEqual({ start: 3, end: 5 });
  });

  it("does not match when the initial consonants differ", () => {
    expect(findHangulMatch("장바구니", "ㅈㅁㅅ")).toBeNull();
  });

  it("an initial-consonant query with a space matches the space in the name", () => {
    expect(findHangulMatch("주문서 작성", "ㅅ ㅈ")).toEqual({ start: 2, end: 5 });
  });

  it("initials typed without a space find a two-word name", () => {
    // Nobody types the space between the words they are reducing to initials.
    expect(findHangulMatch("회원 탈퇴", "ㅎㅇㅌㅌ")).toEqual({ start: 0, end: 5 });
    expect(findHangulMatch("주문서 작성", "ㅅㅈ")).toEqual({ start: 2, end: 5 });
  });
});

describe("findHangulMatch with a last syllable still being composed", () => {
  it("a syllable mid-typing matches the leading part of the next syllable", () => {
    // The first query is what the IME shows halfway through the name's first
    // syllable; it must already find it.
    expect(findHangulMatch("장바구니", "자")).toEqual({ start: 0, end: 1 });
    // The second is the state right after the third syllable's initial is pressed.
    expect(findHangulMatch("장바구니", "장바ㄱ")).toEqual({ start: 0, end: 3 });
  });

  it("compound final consonants and compound vowels are split and treated as a leading part", () => {
    // A medial written as one code point is typed as two keys, so the syllable
    // that stops at the first of them is a genuine prefix.
    expect(findHangulMatch("결과 보기", "고")).toEqual({ start: 1, end: 2 });
    // A syllable with no final is a prefix of the same syllable with one; a
    // different final is not.
    expect(findHangulMatch("돌아갔다", "가")).toEqual({ start: 2, end: 3 });
    expect(findHangulMatch("돌아갔다", "각")).toBeNull();
  });

  it("only the last syllable matches partially, and earlier ones must match exactly", () => {
    expect(findHangulMatch("장바구니", "바구")).toEqual({ start: 1, end: 3 });
    expect(findHangulMatch("장바구니", "바고")).toBeNull();
  });

  it("works on names mixed with Latin letters and digits", () => {
    expect(findHangulMatch("MCP 서버 v2", "서ㅂ")).toEqual({ start: 4, end: 6 });
  });
});

describe("findHangulMatch on a two-set keyboard", () => {
  it("matches while the next syllable's initial shows as the last syllable's final", () => {
    expect(findHangulMatch("장바구니", "장박")).toEqual({ start: 0, end: 3 });
    expect(findHangulMatch("장바구니", "장바군")).toEqual({ start: 0, end: 4 });
    expect(findHangulMatch("주문서", "줌")).toEqual({ start: 0, end: 2 });
  });

  it("keeps the first half of a compound final and moves the second to the next syllable", () => {
    expect(findHangulMatch("달걀", "닭")).toEqual({ start: 0, end: 2 });
  });

  it("rejects a final that is not the next syllable's initial", () => {
    expect(findHangulMatch("주문서", "줄")).toBeNull();
    expect(findHangulMatch("장바구니", "장밥")).toBeNull();
    expect(findHangulMatch("달걀", "닮")).toBeNull();
  });

  it("carries a final neither across a space nor past the last syllable", () => {
    expect(findHangulMatch("가 게", "각")).toBeNull();
    expect(findHangulMatch("장바구니", "장바구닌")).toBeNull();
  });

  it("treats a double consonant as one key", () => {
    expect(findHangulMatch("가까", "갂")).toEqual({ start: 0, end: 2 });
    expect(findHangulMatch("가까", "각")).toBeNull();
  });

  it("carries a final after a compound medial", () => {
    expect(findHangulMatch("과일", "광")).toEqual({ start: 0, end: 2 });
  });
});

describe("findHangulMatch with a query that has no Hangul", () => {
  it("without Hangul it does not take the Hangul path", () => {
    expect(findHangulMatch("auth-login", "login")).toBeNull();
    expect(findHangulMatch("장바구니", "cart")).toBeNull();
  });

  it("an empty query is not a match", () => {
    expect(findHangulMatch("장바구니", "")).toBeNull();
    expect(findHangulMatch("장바구니", "  ")).toBeNull();
  });
});

describe("hangulStartsWith / hangulIncludes", () => {
  it("startsWith is true only at the start of the name", () => {
    expect(hangulStartsWith("장바구니", "ㅈㅂ")).toBe(true);
    expect(hangulStartsWith("신규 회원 탈퇴", "ㅎㅇ")).toBe(false);
    expect(hangulIncludes("신규 회원 탈퇴", "ㅎㅇ")).toBe(true);
  });
});

describe("NFD input", () => {
  it("gives the same result when the jamo arrive decomposed", () => {
    expect(findHangulMatch("장바구니".normalize("NFD"), "ㅈㅂㄱㄴ")).toEqual({
      start: 0,
      end: 4,
    });
    expect(hangulIncludes("장바구니", "ㅈㅂㄱㄴ".normalize("NFD"))).toBe(true);
  });
});
