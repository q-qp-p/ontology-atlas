import { describe, expect, it } from "vitest";
import {
  countRecentEntries,
  parseAgentActivityLog,
  toSlugTarget,
} from "./agent-activity-log";

const NOW = Date.parse("2026-08-01T12:00:00.000Z");

describe("parseAgentActivityLog", () => {
  it("restores only v1 audit facts, skipping broken lines and other versions", () => {
    const raw = [
      '{"v":1,"at":"2026-08-01T11:59:00.000Z","tool":"add_concept","target":"capabilities/a","summary":"add a","agent":"claude-code","why":null}',
      "broken",
      '{"v":2,"at":"2026-08-01T12:00:00.000Z","summary":"future"}',
    ].join("\n");
    expect(parseAgentActivityLog(raw)).toEqual([
      {
        v: 1,
        at: "2026-08-01T11:59:00.000Z",
        tool: "add_concept",
        target: "capabilities/a",
        summary: "add a",
        agent: "claude-code",
        why: null,
      },
    ]);
  });

  it("limit applies to the most recent tail", () => {
    const raw = [
      '{"v":1,"at":"2026-08-01T11:57:00.000Z","summary":"a"}',
      '{"v":1,"at":"2026-08-01T11:58:00.000Z","summary":"b"}',
      '{"v":1,"at":"2026-08-01T11:59:00.000Z","summary":"c"}',
    ].join("\n");
    expect(parseAgentActivityLog(raw, { limit: 2 }).map((entry) => entry.summary)).toEqual(["b", "c"]);
  });
});

describe("activity log facts", () => {
  it("counts only valid timestamps within 24 hours", () => {
    const entries = parseAgentActivityLog([
      `{"v":1,"at":"${new Date(NOW - 1_000).toISOString()}","summary":"recent"}`,
      `{"v":1,"at":"${new Date(NOW - 25 * 60 * 60 * 1000).toISOString()}","summary":"old"}`,
    ].join("\n"));
    expect(countRecentEntries(entries, NOW)).toBe(1);
  });

  it("passes only real node candidate shapes through as slugs", () => {
    expect(toSlugTarget("capabilities/checkout")).toBe("capabilities/checkout");
    expect(toSlugTarget("수납-정책")).toBe("수납-정책");
    expect(toSlugTarget("(batch)")).toBeNull();
    expect(toSlugTarget("docs/meeting.md")).toBeNull();
    expect(toSlugTarget("a b")).toBeNull();
  });
});
