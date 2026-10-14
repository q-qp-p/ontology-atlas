import { describe, expect, it } from "vitest";
import { snippetAroundFirstMatch, splitHighlightSegments } from "./highlight-match";

describe("splitHighlightSegments", () => {
  it("an empty query gives one whole non-match segment", () => {
    expect(splitHighlightSegments("Auth Service", "")).toEqual([
      { text: "Auth Service", match: false },
    ]);
    expect(splitHighlightSegments("Auth Service", "   ")).toEqual([
      { text: "Auth Service", match: false },
    ]);
  });

  it("no match gives one whole non-match segment", () => {
    expect(splitHighlightSegments("Auth Service", "zzz")).toEqual([
      { text: "Auth Service", match: false },
    ]);
  });

  it("ignores case, preserves the original case, and splits at the match", () => {
    expect(splitHighlightSegments("Authentication", "auth")).toEqual([
      { text: "Auth", match: true },
      { text: "entication", match: false },
    ]);
  });

  it("a middle match gives three segments: before, match, after", () => {
    expect(splitHighlightSegments("login flow", "in")).toEqual([
      { text: "log", match: false },
      { text: "in", match: true },
      { text: " flow", match: false },
    ]);
  });

  it("matches every occurrence", () => {
    expect(splitHighlightSegments("aXaXa", "a")).toEqual([
      { text: "a", match: true },
      { text: "X", match: false },
      { text: "a", match: true },
      { text: "X", match: false },
      { text: "a", match: true },
    ]);
  });

  it("safely matches regex special characters as literals", () => {
    expect(splitHighlightSegments("a.b.c", ".")).toEqual([
      { text: "a", match: false },
      { text: ".", match: true },
      { text: "b", match: false },
      { text: ".", match: true },
      { text: "c", match: false },
    ]);
  });

  it("joining the matched segment texts equals the original, with no loss", () => {
    const segs = splitHighlightSegments("Capability: token issue", "token");
    expect(segs.map((s) => s.text).join("")).toBe("Capability: token issue");
  });

  // Landing defect: document bodies wrap around 80 characters (the AGENTS.md
  // convention), so a space in a phrase the user typed may be a newline in the
  // source. Literal substring matching found 0 hits there, producing no marks and no
  // scroll — whitespace runs (space, newline, tab) must match flexibly.
  it("a multi-token query matches a line break in the source like a space (line-wrapped phrase)", () => {
    const text = "Give it a local, git-backed\nmental model it can read.";
    const segs = splitHighlightSegments(text, "git-backed mental model");
    const matched = segs.filter((s) => s.match).map((s) => s.text);
    expect(matched).toEqual(["git-backed\nmental model"]);
    // The lossless-rejoin contract holds under whitespace-flexible matching too.
    expect(segs.map((s) => s.text).join("")).toBe(text);
  });

  it("a multi-token query also matches runs of spaces and tabs", () => {
    const text = "before  needle\tphrase  after";
    const segs = splitHighlightSegments(text, "needle phrase");
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual([
      "needle\tphrase",
    ]);
  });

  it("even with multiple tokens, special characters are still escaped as literals", () => {
    const segs = splitHighlightSegments("a.b c(d)", "a.b c(d)");
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual([
      "a.b c(d)",
    ]);
  });

  it("matches every occurrence, multi-token queries globally too", () => {
    const text = "needle phrase here, another needle phrase there";
    const segs = splitHighlightSegments(text, "needle phrase");
    expect(segs.filter((s) => s.match)).toHaveLength(2);
  });

  // `searchDocs` treats a multi-token query as AND over scattered tokens, so highlighting must match
  // individual tokens when the phrase is not contiguous.
  it("multi-token query: when the phrase is nowhere contiguous, individual tokens match as OR (scattered AND match landing)", () => {
    const text = "이 관계는 유용하다. 나중에 타입을 정의한다.";
    // The phrase "Relationship type" occurs nowhere contiguously in this text.
    const segs = splitHighlightSegments(text, "관계 타입");
    const matched = segs.filter((s) => s.match).map((s) => s.text);
    expect(matched).toEqual(["관계", "타입"]);
    // The lossless-rejoin contract still holds.
    expect(segs.map((s) => s.text).join("")).toBe(text);
  });

  it("multi-token scattered fallback: matches only the tokens that exist even if just some are present", () => {
    const text = "관계만 있고 다른 단어는 없다.";
    const segs = splitHighlightSegments(text, "관계 타입");
    const matched = segs.filter((s) => s.match).map((s) => s.text);
    expect(matched).toEqual(["관계"]);
  });

  it("multi-token scattered fallback: still no match when no token is present", () => {
    const text = "아무 관련도 없는 문장이다.";
    const segs = splitHighlightSegments(text, "관계 타입");
    expect(segs).toEqual([{ text, match: false }]);
  });

  it("a phrase match takes priority as is, without taking the fallback", () => {
    // When the phrase does occur contiguously the phrase-match path wins, even
    // though the individual tokens also appear elsewhere. Guards the
    // newline-flexible matching above against regression.
    const text = "먼저 관계 타입 순서로 쓴다. 그리고 타입만 다시 언급.";
    const segs = splitHighlightSegments(text, "관계 타입");
    const matched = segs.filter((s) => s.match).map((s) => s.text);
    expect(matched).toEqual(["관계 타입"]);
  });
});

describe('Hangul keyboard query highlighting', () => {
  it('an initial-consonant match is shown too', () => {
    expect(splitHighlightSegments('장바구니', 'ㅈㅂㄱㄴ')).toEqual([
      { text: '장바구니', match: true },
    ]);
  });

  it('keeps the text before and after an initial-consonant match in the middle of a name', () => {
    expect(splitHighlightSegments('신규 회원 탈퇴', 'ㅎㅇ')).toEqual([
      { text: '신규 ', match: false },
      { text: '회원', match: true },
      { text: ' 탈퇴', match: false },
    ]);
  });

  it('a last syllable still being composed is shown too', () => {
    expect(splitHighlightSegments('장바구니', '장바ㄱ')).toEqual([
      { text: '장바구', match: true },
      { text: '니', match: false },
    ]);
  });

  it('a literal character match wins when there is one', () => {
    expect(splitHighlightSegments('장바구니 담기', '장바')).toEqual([
      { text: '장바', match: true },
      { text: '구니 담기', match: false },
    ]);
  });

  it('a non-Hangul query does not take the Hangul path', () => {
    expect(splitHighlightSegments('장바구니', 'cart')).toEqual([
      { text: '장바구니', match: false },
    ]);
  });

  it('marks a two-set keystroke state only while Hangul reading is on', () => {
    expect(splitHighlightSegments('보상 규칙', '봇')).toEqual([
      { text: '보상', match: true },
      { text: ' 규칙', match: false },
    ]);
    expect(splitHighlightSegments('보상 규칙', '봇', false)).toEqual([
      { text: '보상 규칙', match: false },
    ]);
  });
});

describe('snippetAroundFirstMatch', () => {
  const sentence = 'Hands a packed parcel to the courier and keeps the tracking number';

  it('leaves the sentence as is when the match is near the start', () => {
    expect(snippetAroundFirstMatch(sentence, 'Hands')).toBe(sentence);
    expect(snippetAroundFirstMatch(sentence, 'packed')).toBe(sentence);
  });

  it('when the match is late, starts near it with an ellipsis', () => {
    const out = snippetAroundFirstMatch(sentence, 'tracking');
    expect(out.startsWith('…')).toBe(true);
    expect(out).toContain('tracking number');
    expect(out).not.toContain('Hands');
  });

  it('does not cut a word in half', () => {
    const out = snippetAroundFirstMatch(sentence, 'courier');
    expect(out).toBe('…to the courier and keeps the tracking number');
  });

  it('leaves it as is when there is no match', () => {
    expect(snippetAroundFirstMatch(sentence, 'zzz')).toBe(sentence);
    expect(snippetAroundFirstMatch(sentence, '')).toBe(sentence);
  });
});
