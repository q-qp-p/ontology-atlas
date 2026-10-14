import { describe, expect, it } from "vitest";
import {
  CONE_HALF_TANGENT,
  DEAD_END_NOTICE_COOLDOWN_MS,
  shouldAnnounceDeadEnd,
  ORTHOGONAL_PENALTY,
  pickInitialFocus,
  pickNeighborInDirection,
  walkDirectionForKey,
  type WalkNode,
} from "./keyboard-walk";

/** y is in screen coordinates — it grows downward. */
const at = (id: string, x: number, y: number): WalkNode => ({ id, x, y });

describe("pickNeighborInDirection", () => {
  const center = at("c", 0, 0);

  it("picks the neighbour directly up, down, left and right", () => {
    const neighbors = [at("up", 0, -100), at("down", 0, 100), at("left", -100, 0), at("right", 100, 0)];
    expect(pickNeighborInDirection(center, neighbors, "up")).toBe("up");
    expect(pickNeighborInDirection(center, neighbors, "down")).toBe("down");
    expect(pickNeighborInDirection(center, neighbors, "left")).toBe("left");
    expect(pickNeighborInDirection(center, neighbors, "right")).toBe("right");
  });

  it("does nothing when there is no neighbour that way, and does not wrap around", () => {
    // The only neighbour is below. Pressing up does not jump down to it.
    expect(pickNeighborInDirection(center, [at("only", 0, 200)], "up")).toBeNull();
  });

  it("ignores what lies behind", () => {
    expect(pickNeighborInDirection(center, [at("behind", 0, 100)], "up")).toBeNull();
  });

  it("picks the nearer one", () => {
    const neighbors = [at("far", 0, -400), at("near", 0, -80)];
    expect(pickNeighborInDirection(center, neighbors, "up")).toBe("near");
  });

  /**
   * What the orthogonal penalty does — «almost beside, slightly above» must not
   * beat «directly above». Without the penalty only distance is compared and
   * `sideways` wins (90 < 100).
   */
  it("the one straight ahead beats a closer one that is off to the side", () => {
    const straight = at("straight", 0, -100);
    const sideways = at("sideways", 80, -40); // straight-line distance ≈ 89
    const picked = pickNeighborInDirection(center, [sideways, straight], "up");
    expect(picked, "the orthogonal penalty was not applied").toBe("straight");
    // Confirm by arithmetic that the penalty is what split the result (a changed value breaks here).
    expect(100 + 0 * ORTHOGONAL_PENALTY).toBeLessThan(40 + 80 * ORTHOGONAL_PENALTY);
  });

  it("discards anything outside the cone (+/-60 degrees)", () => {
    // 10 up, 100 across → across/along = 10 > tan(60°) ≈ 1.73
    expect(pickNeighborInDirection(center, [at("wide", 100, -10)], "up")).toBeNull();
    // Just inside the cone's boundary — it has to pass.
    const inside = at("inside", 100 * (CONE_HALF_TANGENT - 0.05), -100);
    expect(pickNeighborInDirection(center, [inside], "up")).toBe("inside");
  });

  /**
   * **The four directions cover the plane with no gap** — any neighbour is
   * reachable by at least one arrow key. That property is why ±60° was chosen, and
   * narrowing the angle breaks here first.
   */
  it("a neighbour in any direction is reachable with at least one arrow key", () => {
    const DIRECTIONS = ["up", "down", "left", "right"] as const;
    const unreachable: number[] = [];
    for (let degrees = 0; degrees < 360; degrees += 3) {
      const radians = (degrees * Math.PI) / 180;
      const neighbor = at("n", Math.cos(radians) * 150, Math.sin(radians) * 150);
      const reached = DIRECTIONS.some(
        (direction) => pickNeighborInDirection(center, [neighbor], direction) === "n",
      );
      if (!reached) unreachable.push(degrees);
    }
    expect(unreachable, `no arrow key reaches the neighbour at these angles: ${unreachable.join(", ")}`).toEqual(
      [],
    );
  });

  it("does not count itself", () => {
    expect(pickNeighborInDirection(center, [center], "up")).toBeNull();
  });

  it("ties are broken by id, not by array order", () => {
    const a = at("aaa", 0, -100);
    const b = at("bbb", 0, -100);
    expect(pickNeighborInDirection(center, [b, a], "up")).toBe("aaa");
    expect(pickNeighborInDirection(center, [a, b], "up")).toBe("aaa");
  });

  it("null when there is no neighbour", () => {
    expect(pickNeighborInDirection(center, [], "up")).toBeNull();
  });
});

describe("pickInitialFocus", () => {
  it("picks the node nearest the screen centre", () => {
    const nodes = [at("far", 500, 500), at("near", 10, 10), at("mid", 200, 0)];
    expect(pickInitialFocus(nodes, { x: 0, y: 0 })).toBe("near");
  });

  it("picks by distance rather than array order, since the first node may be off screen", () => {
    const nodes = [at("first", 9_000, 9_000), at("visible", 5, 5)];
    expect(pickInitialFocus(nodes, { x: 0, y: 0 })).toBe("visible");
  });

  it("equal distances are broken by id", () => {
    expect(pickInitialFocus([at("b", 10, 0), at("a", -10, 0)], { x: 0, y: 0 })).toBe("a");
  });

  it("null when there are no nodes", () => {
    expect(pickInitialFocus([], { x: 0, y: 0 })).toBeNull();
  });
});

describe("shouldAnnounceDeadEnd", () => {
  it("announces on the first call", () => {
    expect(shouldAnnounceDeadEnd(null, 0)).toBe(true);
  });

  it("does not announce again right after announcing", () => {
    expect(shouldAnnounceDeadEnd(1_000, 1_000 + DEAD_END_NOTICE_COOLDOWN_MS - 1)).toBe(false);
  });

  it("announces again once it has cooled down", () => {
    expect(shouldAnnounceDeadEnd(1_000, 1_000 + DEAD_END_NOTICE_COOLDOWN_MS)).toBe(true);
  });

  it("the quiet period is a length a person can read", () => {
    expect(DEAD_END_NOTICE_COOLDOWN_MS).toBeGreaterThanOrEqual(600);
    expect(DEAD_END_NOTICE_COOLDOWN_MS).toBeLessThanOrEqual(4_000);
  });
});

describe("walkDirectionForKey", () => {
  it("only the four arrow keys are ours", () => {
    expect(walkDirectionForKey("ArrowUp")).toBe("up");
    expect(walkDirectionForKey("ArrowDown")).toBe("down");
    expect(walkDirectionForKey("ArrowLeft")).toBe("left");
    expect(walkDirectionForKey("ArrowRight")).toBe("right");
  });

  it("other keys are not ours, so another shortcut is never swallowed", () => {
    for (const key of ["Enter", "Escape", "Tab", "g", "p", "PageUp", "Home", " "]) {
      expect(walkDirectionForKey(key), `${key} was treated as an arrow key`).toBeNull();
    }
  });
});
