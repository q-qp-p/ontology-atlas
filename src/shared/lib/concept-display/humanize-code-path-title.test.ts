import { describe, expect, it } from "vitest";
import {
  humanizeCodePathTitle,
  looksLikeCodePath,
} from "./humanize-code-path-title";

describe("looksLikeCodePath", () => {
  it("recognizes a path with a known extension as a code path", () => {
    expect(looksLikeCodePath("src/widgets/ontology-map/ui/topology-world.ts")).toBe(
      true,
    );
  });

  it("recognizes a path with a known root folder prefix as a code path", () => {
    expect(looksLikeCodePath("cli/src/commands/agent-brief.mjs")).toBe(true);
  });

  it("a path containing whitespace is not a code path", () => {
    expect(looksLikeCodePath("MCP Server")).toBe(false);
  });

  it("a string without a slash is not a code path", () => {
    expect(looksLikeCodePath("readme.md")).toBe(false);
  });

  it("a slash path with no known prefix or extension is not a code path", () => {
    expect(looksLikeCodePath("elements/agent-activity-hooks")).toBe(false);
  });
});

describe("humanizeCodePathTitle", () => {
  it("turns a kebab-case filename into a human-readable title", () => {
    expect(
      humanizeCodePathTitle(
        "src/widgets/ontology-map/ui/topology-world.ts",
      ),
    ).toBe("Topology World");
  });

  it("turns a kebab-case .mjs filename into a human-readable title", () => {
    expect(humanizeCodePathTitle("cli/src/commands/agent-brief.mjs")).toBe(
      "Agent Brief",
    );
  });

  it("index.ts promotes its parent segment", () => {
    expect(humanizeCodePathTitle("src/features/user-auth/index.ts")).toBe(
      "User Auth",
    );
  });

  it("splits a camelCase filename into words at word boundaries", () => {
    expect(humanizeCodePathTitle("src/lib/parseFrontmatter.ts")).toBe(
      "Parse Frontmatter",
    );
  });

  it("returns null when it does not look like a code path", () => {
    expect(humanizeCodePathTitle("MCP Server")).toBeNull();
  });

  it("returns null for a folder-prefixed path whose prefix is not in the list", () => {
    expect(humanizeCodePathTitle("elements/agent-activity-hooks")).toBeNull();
  });

  it("returns null for a string containing whitespace", () => {
    expect(humanizeCodePathTitle("src/foo bar.ts")).toBeNull();
  });

  it("returns null for a string without a slash", () => {
    expect(humanizeCodePathTitle("topology-world.ts")).toBeNull();
  });

  it("is deterministic, giving the same output for the same input", () => {
    const input = "src/widgets/ontology-map/ui/topology-world.ts";
    expect(humanizeCodePathTitle(input)).toBe(humanizeCodePathTitle(input));
  });

  it("SKILL.md is absorbed as generic after its extension is removed, so the parent directory name is used", () => {
    expect(
      humanizeCodePathTitle(".claude/skills/ontology-sync/SKILL.md"),
    ).toBe("Ontology Sync");
  });

  it("when even the parent of index.ts is generic (lib), it promotes one more level (at most two)", () => {
    expect(humanizeCodePathTitle("src/lib/index.ts")).toBe("Src");
  });

  it("a short leftover segment of three characters or fewer (a word outside the list) promotes to the parent segment", () => {
    expect(
      humanizeCodePathTitle("src/widgets/ontology-map/db.ts"),
    ).toBe("Ontology Map");
  });

  it("words newly added to the generic list (src/lib/ui/api/util and so on) are promoted too", () => {
    // A promoted segment that is an acronym is fully capitalised: "Cli"
    // contradicted every other screen in the app, which says "CLI".
    expect(humanizeCodePathTitle("cli/src")).toBe("CLI");
  });

  it("an acronym is written fully in capitals, not just its first letter", () => {
    expect(humanizeCodePathTitle("mcp/src/index.js")).toBe("MCP");
    expect(humanizeCodePathTitle("src/features/vault-api/index.ts")).toBe("Vault API");
  });

  it("a word outside the acronym list still gets only its first letter raised, as before", () => {
    expect(humanizeCodePathTitle("src/shared/lib/vault-document/parse-frontmatter.ts")).toBe("Parse Frontmatter");
  });
});
