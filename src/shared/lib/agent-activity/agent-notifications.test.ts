import { describe, expect, it } from "vitest";
import {
  AGENT_NOTIFICATION_KINDS,
  AGENT_NOTIFICATION_LIMIT,
  countUnread,
  deriveTaskNotifications,
  filterNotifications,
  mergeNotifications,
  risenVaultProblems,
  type AgentNotification,
} from "./agent-notifications";
import type { AgentWorkSession } from "./agent-work-session";

function session(overrides: Partial<AgentWorkSession> = {}): AgentWorkSession {
  return {
    id: "task:1000",
    startAt: 1_000,
    endAt: 2_000,
    entryCount: 2,
    counts: { added: 3, edited: 0, removed: 1 },
    lastTarget: "capabilities/checkout",
    lastTool: "add_relation",
    agent: null,
    done: true,
    ...overrides,
  };
}

describe("deriveTaskNotifications", () => {
  it("one task yields a start and an end, exactly two", () => {
    const out = deriveTaskNotifications([session()]);
    expect(out.map((n) => n.kind)).toEqual(["task-start", "task-end"]);
    expect(out[1].counts).toEqual({ added: 3, edited: 0, removed: 1 });
    expect(out[1].node?.slug).toBe("capabilities/checkout");
  });

  it("when the task knows the name, both start and end notifications carry it", () => {
    const out = deriveTaskNotifications([session({ agent: "claude-code" })]);
    expect(out[0].agent).toBe("claude-code");
    expect(out[1].agent).toBe("claude-code");
  });

  it("a task with no known name has no agent field, so none is invented", () => {
    const out = deriveTaskNotifications([session({ agent: null })]);
    expect(out[0].agent).toBeUndefined();
    expect(out[1].agent).toBeUndefined();
  });

  it("a task that has not finished has no end notification", () => {
    const out = deriveTaskNotifications([session({ done: false })]);
    expect(out.map((n) => n.kind)).toEqual(["task-start"]);
  });

  it("a task that counted nothing emits no end summary", () => {
    const out = deriveTaskNotifications([
      session({ counts: { added: 0, edited: 0, removed: 0 } }),
    ]);
    expect(out.map((n) => n.kind)).toEqual(["task-start"]);
  });

  it("when the target is not a slug, the status shows without a link", () => {
    const out = deriveTaskNotifications([session({ lastTarget: null })]);
    expect(out[1].node).toBeNull();
  });

  it("a 53-line log with two tasks yields four notifications (53 if counted per line)", () => {
    const out = deriveTaskNotifications([
      session({ id: "task:1", startAt: 1, endAt: 2 }),
      session({ id: "task:2", startAt: 3, endAt: 4 }),
    ]);
    expect(out).toHaveLength(4);
  });
});

describe("mergeNotifications", () => {
  const make = (id: string, at: number): AgentNotification => ({
    id,
    kind: "task-start",
    at,
    node: null,
  });

  it("newest first, duplicate ids collapse to one", () => {
    const merged = mergeNotifications([make("a", 1), make("b", 3)], [make("b", 3), make("c", 2)]);
    expect(merged.map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("never exceeds the cap, because the inbox is not a substitute for the audit log", () => {
    const many = Array.from({ length: AGENT_NOTIFICATION_LIMIT + 20 }, (_, i) => make(`n${i}`, i));
    expect(mergeNotifications(many)).toHaveLength(AGENT_NOTIFICATION_LIMIT);
  });
});

describe("filterNotifications", () => {
  it("a branch that is switched off disappears", () => {
    const items: AgentNotification[] = [
      { id: "a", kind: "task-start", at: 1, node: null },
      { id: "b", kind: "vault-problem", at: 2, node: null },
    ];
    expect(filterNotifications(items, new Set(["vault-problem"])).map((n) => n.id)).toEqual(["b"]);
  });
});

describe("countUnread", () => {
  it("counts only what came after the read time", () => {
    const items: AgentNotification[] = [
      { id: "a", kind: "task-start", at: 10, node: null },
      { id: "b", kind: "task-end", at: 30, node: null },
    ];
    expect(countUnread(items, 20)).toBe(1);
    expect(countUnread(items, 0)).toBe(2);
  });
});

describe("AGENT_NOTIFICATION_KINDS", () => {
  it("has only the five branches agreed with the owner (six with end and start split), and no tool calls", () => {
    expect([...AGENT_NOTIFICATION_KINDS]).toEqual([
      "task-start",
      "task-end",
      "domain-added",
      "domain-removed",
      "bridge-inserted",
      "vault-problem",
    ]);
  });
});

describe("risenVaultProblems", () => {
  it("reports only what rose between two exact readings", () => {
    const before = { unresolvedEdges: 1, dependencyCycles: 4 };
    expect(risenVaultProblems(before, { unresolvedEdges: 3, dependencyCycles: 2 })).toEqual({
      unresolvedEdges: 2,
      dependencyCycles: 0,
    });
    expect(risenVaultProblems(before, before)).toBeNull();
  });

  it("reports a rise to a partial cycle count as a floor", () => {
    const after = { unresolvedEdges: 0, dependencyCycles: 500, dependencyCyclesPartial: true };
    expect(risenVaultProblems({ unresolvedEdges: 0, dependencyCycles: 3 }, after)).toEqual({
      unresolvedEdges: 0,
      dependencyCycles: 497,
      dependencyCyclesPartial: true,
    });
  });

  it("reads no cycle rise after a partial baseline", () => {
    const before = { unresolvedEdges: 0, dependencyCycles: 500, dependencyCyclesPartial: true };
    expect(risenVaultProblems(before, { unresolvedEdges: 0, dependencyCycles: 900 })).toBeNull();
  });
});
