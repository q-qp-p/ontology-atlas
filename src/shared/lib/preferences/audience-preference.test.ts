import { beforeEach, describe, expect, it } from "vitest";

import { readAudiencePlain, writeAudiencePlain } from "./audience-preference";

describe("audience-preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("the default is developer mode, where chrome such as the record shows", () => {
    expect(readAudiencePlain()).toBe(false);
  });

  it("saving plain mode is still alive on the next read", () => {
    writeAudiencePlain(true);
    expect(readAudiencePlain()).toBe(true);
  });

  it("reverting returns to developer mode", () => {
    writeAudiencePlain(true);
    writeAudiencePlain(false);
    expect(readAudiencePlain()).toBe(false);
  });

  // If the shell and the map each read localStorage independently, only one of
  // them updates and they drift apart. An event for same-tab subscribers is what
  // makes the rail and the map change together.
  it("a write notifies subscribers in the same tab", () => {
    let fired = 0;
    const onChange = () => { fired += 1; };
    window.addEventListener("ontology-atlas:audience-preference-change", onChange);
    writeAudiencePlain(true);
    window.removeEventListener("ontology-atlas:audience-preference-change", onChange);
    expect(fired).toBe(1);
  });
});
