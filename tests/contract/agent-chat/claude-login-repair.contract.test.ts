import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  APP_BUNDLE_IDENTIFIER,
  CLAUDE_ISOLATED_CONFIG_SUBPATH,
  claudeLoginRepairCommand,
} from "@/features/acp-session/model/trouble/claude-login-repair";

import { readAcpRust } from "../../helpers/read-acp-rust";

/**
 * The repair line must name the folder the app actually uses, since Claude keeps the login in a
 * keychain entry per config directory. Three copies are pinned together: the `tauri.conf.json`
 * identifier, the path Rust builds, and this command.
 */
const TAURI_CONF = JSON.parse(
  readFileSync(join(process.cwd(), "src-tauri", "tauri.conf.json"), "utf8"),
) as { identifier?: string };
const ACP_RS = readAcpRust(process.cwd());

describe("app-owned login repair command", () => {
  it("the bundle identifier equals the real app settings", () => {
    expect(TAURI_CONF.identifier).toBe(APP_BUNDLE_IDENTIFIER);
  });

  /*
   * Rust: `app_data_dir.join("agent-config").join(spec.id)` · spec.id = "claude-acp".
   * If that fragment disappears, this command points at a folder that does not exist.
   */
  it("points at the same place as the folder structure Rust creates", () => {
    expect(ACP_RS).toContain('join("agent-config")');
    expect(ACP_RS).toContain('id: "claude-acp"');
    expect(CLAUDE_ISOLATED_CONFIG_SUBPATH).toContain("agent-config/claude-acp");
    expect(CLAUDE_ISOLATED_CONFIG_SUBPATH).toContain(APP_BUNDLE_IDENTIFIER);
  });

  it("quotes a path with spaces — otherwise pasting it does not work either", () => {
    const cmd = claudeLoginRepairCommand();
    expect(CLAUDE_ISOLATED_CONFIG_SUBPATH).toContain("Application Support");
    expect(cmd).toMatch(/"\$HOME\/[^"]*Application Support[^"]+"/);
  });

  /**
   * The command must delete the shadow keychain entry, not log in again: a login under the app
   * folder creates an entry that shadows the user credential and dies when the token rotates.
   */
  it("deletes the shadow entry rather than logging in", () => {
    const cmd = claudeLoginRepairCommand();
    expect(cmd).toContain("delete-generic-password");
    expect(cmd).toContain("Claude Code-credentials-");
    expect(cmd, "making the user log in again lays the same trap again").not.toContain("claude /login");
    expect(cmd).not.toContain("claude auth login");
  });

  /**
   * A pinned hash is correct only on that one machine — home paths differ per
   * person. Let the shell compute it, and check that the computation targets the
   * same place as Rust.
   */
  it("the shell computes the entry name — from that machine's home path", () => {
    const cmd = claudeLoginRepairCommand();
    expect(cmd).toMatch(/shasum -a 256/);
    expect(cmd).toMatch(/cut -c1-8/);
    expect(cmd).not.toMatch(/Claude Code-credentials-[0-9a-f]{8}/);
  });

  /** Uses the same rule as the Rust-side shadow walk — two copies, so they are pinned together. */
  it("Rust also clears the shadow with the same naming rule", () => {
    expect(ACP_RS).toContain("Claude Code-credentials-");
    expect(ACP_RS).toContain("delete-generic-password");
    expect(ACP_RS).toContain("fn clear_shadowing_credentials");
  });

  it("does not touch the user's folder", () => {
    expect(claudeLoginRepairCommand()).not.toMatch(/\$HOME\/\.claude(\/|"|\s|$)/);
  });

  /*
   * ⚠️ Without this check, the checks above would pass on an empty string.
   */
  it("the command is not empty", () => {
    expect(claudeLoginRepairCommand().length).toBeGreaterThan(40);
  });
});
