import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCodexConfigToml,
  buildCodexConfigTomlTemplate,
  buildCodexMcpAddCommandTemplate,
  buildAgentSetupCliCommandTemplate,
  buildAgentSetupCheckCliCommandTemplate,
  buildMcpConfigJson,
  buildVaultMcpConfigJson,
  materializeStarterFiles,
  starterFilesForLocale,
} from "./ontology-starter";

const ROOT = path.resolve(__dirname, "../../../..");
const ONTOLOGY_STARTER_FILES = starterFilesForLocale("en");

describe("ONTOLOGY_STARTER_FILES", () => {
  it("ships 5 seed files: README, project, and 3 examples (domain/capability/element)", () => {
    expect(ONTOLOGY_STARTER_FILES).toHaveLength(5);
    const paths = ONTOLOGY_STARTER_FILES.map((f) => f.relPath);
    expect(paths).toContain("README.md");
    expect(paths).toContain("project.md");
    expect(paths).toContain("domains/example-domain.md");
    expect(paths).toContain("capabilities/example-capability.md");
    expect(paths).toContain("elements/example-element.md");
  });

  it("starts every file with frontmatter (---) and includes a kind key", () => {
    for (const f of ONTOLOGY_STARTER_FILES) {
      expect(f.content.startsWith("---\n")).toBe(true);
      expect(f.content).toMatch(/^kind:\s/m);
    }
  });

  it("leaves UID unpinned in the static template and mints a new UID for every node on each scaffold", () => {
    const firstUids = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
    ];
    const secondUids = Array.from(
      { length: 5 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 6).padStart(12, "0")}`,
    );
    const uidFactory = (uids: string[]) => () => uids.shift()!;

    for (const template of starterFilesForLocale("en")) {
      expect(template.content).not.toMatch(/^uid:/m);
    }

    const first = materializeStarterFiles("en", uidFactory([...firstUids]));
    const second = materializeStarterFiles("en", uidFactory([...secondUids]));
    const extractUids = (files: ReadonlyArray<{ content: string }>) =>
      files.map(({ content }) => content.match(/^uid:\s*(.+)$/m)?.[1]);

    expect(extractUids(first)).toEqual(firstUids);
    expect(new Set(extractUids(first)).size).toBe(5);
    expect(new Set([...extractUids(first), ...extractUids(second)]).size).toBe(10);
    expect(first.find(({ relPath }) => relPath === "README.md")?.content).toContain(
      `uid: ${firstUids[0]}`,
    );
  });

  it("starter prose never teaches a node example or file copy that reuses or omits identity", () => {
    for (const locale of ["en", "ko"] as const) {
      const files = starterFilesForLocale(locale);
      const readme = files.find(({ relPath }) => relPath === "README.md")?.content ?? "";
      const project = files.find(({ relPath }) => relPath === "project.md")?.content ?? "";
      const markdownBlocks = [...readme.matchAll(/```markdown\n([\s\S]*?)```/g)].map(
        (match) => match[1],
      );

      expect(
        markdownBlocks.filter((value) => /^\s*kind:\s*\S+/m.test(value)),
      ).toHaveLength(0);
      expect(readme).toContain("node $ATLAS/cli/src/index.mjs add domain auth");
      expect(project).not.toMatch(/rename or copy starters|바꾸거나\s+복사합니다/i);
    }
  });

  it("gives each of the 3 example files exactly one line with the example slug (domain/capability/element convention)", () => {
    const example = ONTOLOGY_STARTER_FILES.find(
      (f) => f.relPath === "domains/example-domain.md",
    );
    expect(example?.content).toMatch(/^slug:\s+domains\/example-domain/m);
  });

  it("gives the app starter and the CLI template the same vault README and setup guidance", () => {
    for (const starterFile of ONTOLOGY_STARTER_FILES) {
      const template = readFileSync(
        path.join(ROOT, "cli/templates/vault", starterFile.relPath),
        "utf8",
      );
      expect(starterFile.content).toBe(template);
    }
  });

  it("has the starter README cover only two channels (installed app, source checkout)", () => {
    const readme = ONTOLOGY_STARTER_FILES.find(
      (f) => f.relPath === "README.md",
    )?.content;

    expect(readme).toContain("## AI agent setup");
    expect(readme).toContain("Claude Code / Cursor");
    expect(readme).toContain("Codex");
    expect(readme).toContain(".codex/config.toml");
    expect(readme).toContain("installed Ontology Atlas app");
    expect(readme).toContain("press the connect button");
    expect(readme).toContain(
      "cli/src/index.mjs agent-setup <this vault folder> --root . --write",
    );
    expect(readme).toContain(".mcp.json.example");
    expect(readme).toContain("OATLAS_VAULT");
  });

  it("keeps unrunnable commands out of the starter README", () => {
    for (const locale of ["en", "ko"] as const) {
      const readme = starterFilesForLocale(locale).find(
        (f) => f.relPath === "README.md",
      )?.content;

      expect(readme).not.toContain("npx");
      expect(readme).not.toContain("codex mcp add");
      expect(readme).not.toContain("/absolute/path/to/");
      expect(readme).not.toContain("/소스/절대/경로");
      expect(readme).not.toContain("/이-문서함의/절대/경로");
    }
  });

  it("has the starter README show the live MCP inventory and a read-first starting point", () => {
    for (const locale of ["en", "ko"] as const) {
      const readme = starterFilesForLocale(locale).find(
        (f) => f.relPath === "README.md",
      )?.content ?? "";

      expect(readme).toContain("tools/list");
      expect(readme).toContain("mcp-verify");
      expect(readme).toContain("connection_info");
      expect(readme).toContain("list_kinds");
      expect(readme).toContain("validate_vault");
      expect(readme).toContain('operation: "agent_brief"');
      expect(readme).not.toMatch(/\b\d+\s+(?:read|write|tools?)\b/i);
      expect(readme).not.toMatch(/(?:읽기|쓰기|도구)\s*\d+\s*개/);
    }
  });

  it("has the starter README show a first agent connection verification loop", () => {
    const readme = ONTOLOGY_STARTER_FILES.find(
      (f) => f.relPath === "README.md",
    )?.content;

    expect(readme).toContain("## Verify the agent loop");
    expect(readme).toContain("validate_vault");
    expect(readme).toContain('"operation": "workspace_brief"');
    expect(readme).toContain('"operation": "agent_brief"');
    expect(readme).toContain('"operation": "health"');
    expect(readme).toContain('"operation": "cycles"');
    expect(readme).toContain('"operation": "growth_plan"');
    expect(readme).toContain('"operation": "maintenance_plan"');
    expect(readme).toContain("From an Ontology Atlas source checkout");
    expect(readme).toContain("export ATLAS=<path to your ontology-atlas source checkout>");
    expect(readme).toContain("node $ATLAS/cli/src/index.mjs validate .");
    expect(readme).toContain("node $ATLAS/cli/src/index.mjs agent-brief . --graph-db-pack");
    expect(readme).toContain("node $ATLAS/cli/src/index.mjs agent-brief . --verify-fallbacks");
    expect(readme).toContain("node $ATLAS/cli/src/index.mjs cycles . --max-hops 8");
    expect(readme).toContain("node $ATLAS/cli/src/index.mjs growth . --limit 20");
    expect(readme).toContain("node $ATLAS/cli/src/index.mjs maintenance . --limit 20");
    expect(readme).toContain("node $ATLAS/cli/src/index.mjs agent-brief . --verify-fallbacks --json --exit-zero --fallback-timeout-ms 15000 --fallback-slow-ms 5000 --fallback-concurrency 4");
    expect(readme).toContain("node $ATLAS/cli/src/index.mjs mcp-verify . --timeout-ms 15000");
    expect(readme).toMatch(/before it edits\s+anything/);
  });
});

describe("buildMcpConfigJson", () => {
  it("includes the MCP server 'ontology-atlas' entry and the OATLAS_VAULT env placeholder", () => {
    const json = buildMcpConfigJson("my-vault");
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({
      mcpServers: {
        "ontology-atlas": {
          command: "node",
          args: ["<absolute path to your ontology-atlas checkout>/mcp/src/index.js"],
          env: {
            OATLAS_VAULT: "<absolute path to your my-vault folder>",
          },
        },
      },
    });
  });

  it("embeds vaultName verbatim in the placeholder", () => {
    expect(buildMcpConfigJson("foo")).toContain("your foo folder");
    expect(buildMcpConfigJson("한글-vault")).toContain("your 한글-vault folder");
  });

  it("lets the installed app put the vault absolute path it knows straight into OATLAS_VAULT", () => {
    const parsed = JSON.parse(
      buildMcpConfigJson("team-vault", "/Users/dana/Team Vault/docs/ontology"),
    );

    expect(parsed.mcpServers["ontology-atlas"].env.OATLAS_VAULT).toBe(
      "/Users/dana/Team Vault/docs/ontology",
    );
  });

  it("appends a newline at the end of the output (editor friendly)", () => {
    expect(buildMcpConfigJson("v")).toMatch(/\n$/);
  });

  it("pretty-prints with 2-space indentation", () => {
    const json = buildMcpConfigJson("v");
    expect(json).toContain("  \"mcpServers\":");
    expect(json).toContain("    \"ontology-atlas\":");
  });
});

describe("buildVaultMcpConfigJson", () => {
  it("provides the OATLAS_VAULT=. config for opening the vault folder itself in an agent", () => {
    const parsed = JSON.parse(buildVaultMcpConfigJson());
    expect(parsed.mcpServers["ontology-atlas"].command).toBe("node");
    expect(parsed.mcpServers["ontology-atlas"].args).toEqual([
      "<absolute path to your ontology-atlas checkout>/mcp/src/index.js",
    ]);
    expect(parsed.mcpServers["ontology-atlas"].env.OATLAS_VAULT).toBe(".");
  });
});

describe("buildCodexConfigToml", () => {
  it("provides the Codex repo-local MCP config as vault-relative", () => {
    const toml = buildCodexConfigToml();
    expect(toml).toContain("[mcp_servers.ontology-atlas]");
    expect(toml).toContain('command = "node"');
    expect(toml).toContain(
      'args = ["<absolute path to your ontology-atlas checkout>/mcp/src/index.js"]',
    );
    expect(toml).toContain("[mcp_servers.ontology-atlas.env]");
    expect(toml).toContain('OATLAS_VAULT = "."');
    expect(toml).toMatch(/\n$/);
  });

  it("provides an absolute-path placeholder in the Codex codebase-root MCP config template", () => {
    const toml = buildCodexConfigTomlTemplate("team-vault");
    expect(toml).toContain("[mcp_servers.ontology-atlas]");
    expect(toml).toContain('command = "node"');
    expect(toml).toContain(
      'args = ["<absolute path to your ontology-atlas checkout>/mcp/src/index.js"]',
    );
    expect(toml).toContain(
      'OATLAS_VAULT = "<absolute path to your team-vault folder>"',
    );
    expect(toml).toMatch(/\n$/);
  });

  it("lets the Codex codebase-root MCP config template take the known vault absolute path directly", () => {
    const toml = buildCodexConfigTomlTemplate(
      "team-vault",
      "/Users/dana/Team Vault/docs/ontology",
    );

    expect(toml).toContain(
      'OATLAS_VAULT = "/Users/dana/Team Vault/docs/ontology"',
    );
    expect(toml).not.toContain("<absolute path to your team-vault folder>");
  });

  it("escapes the OATLAS_VAULT value in the Codex MCP config as a TOML string", () => {
    const toml = buildCodexConfigToml('/tmp/vault "quoted"');
    expect(toml).toContain('OATLAS_VAULT = "/tmp/vault \\"quoted\\""');
  });
});

describe("buildCodexMcpAddCommandTemplate", () => {
  it("provides the Codex CLI one-line MCP registration command with an absolute-path placeholder", () => {
    const command = buildCodexMcpAddCommandTemplate("team-vault");

    expect(command).toContain("codex mcp add ontology-atlas");
    expect(command).toContain(
      "OATLAS_VAULT='<absolute path to your team-vault folder>'",
    );
    expect(command).toContain(
      "'node' '<absolute path to your ontology-atlas checkout>/mcp/src/index.js'",
    );
  });

  it("puts the known vault absolute path into the Codex CLI one-line MCP registration command shell-safely", () => {
    const command = buildCodexMcpAddCommandTemplate(
      "team-vault",
      "/Users/dana/Team Vault/docs/ontology",
    );

    expect(command).toContain(
      "OATLAS_VAULT='/Users/dana/Team Vault/docs/ontology'",
    );
    expect(command).not.toContain("<absolute path to your team-vault folder>");
  });

  it("escapes a single quote in the vault name shell-safely", () => {
    const command = buildCodexMcpAddCommandTemplate("team's vault");

    expect(command).toContain(
      "OATLAS_VAULT='<absolute path to your team'\\''s vault folder>'",
    );
  });
});

describe("buildAgentSetupCliCommandTemplate", () => {
  it("provides a safe CLI repair command that attaches an existing vault to the codebase root", () => {
    const command = buildAgentSetupCliCommandTemplate("team-vault");

    expect(command).toBe(
      "node $ATLAS/cli/src/index.mjs agent-setup '<absolute path to your team-vault folder>' --root '<absolute path to your codebase root>' --write",
    );
  });

  it("escapes a single quote in the vault name shell-safely", () => {
    const command = buildAgentSetupCliCommandTemplate("team's vault");

    expect(command).toContain(
      "'<absolute path to your team'\\''s vault folder>'",
    );
  });
});

describe("buildAgentSetupCheckCliCommandTemplate", () => {
  it("provides a command that checks an existing vault's codebase-root setup state as a JSON dry-run", () => {
    const command = buildAgentSetupCheckCliCommandTemplate("team-vault");

    expect(command).toBe(
      "node $ATLAS/cli/src/index.mjs agent-setup '<absolute path to your team-vault folder>' --root '<absolute path to your codebase root>' --json",
    );
  });

  it("escapes a single quote in the vault name shell-safely", () => {
    const command = buildAgentSetupCheckCliCommandTemplate("team's vault");

    expect(command).toContain(
      "'<absolute path to your team'\\''s vault folder>'",
    );
  });
});
