import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The server must read only the folder it was given. A real server is started and called over
 * JSON-RPC, since calling the function directly cannot confirm it is invoked at that point.
 */

const OUTSIDE = '/etc';

function callTool(vaultRoot: string, name: string, args: Record<string, unknown>) {
  const script = `
    const { spawn } = require('node:child_process');
    const { writeSync } = require('node:fs');
    const child = spawn(process.execPath, [${JSON.stringify(
      join(process.cwd(), 'mcp/src/index.js'),
    )}], {
      env: { ...process.env, OATLAS_VAULT: ${JSON.stringify(vaultRoot)} },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let buffer = '';
    let sentCall = false;
    let finished = false;
    const send = (o) => child.stdin.write(JSON.stringify(o) + '\\n');
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      writeSync(2, 'timed out waiting for MCP tools/call response');
      process.exitCode = 2;
    }, 25_000);
    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      writeSync(2, 'MCP child failed to start: ' + error.message);
      process.exitCode = 2;
    });
    child.on('exit', (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      writeSync(2, 'MCP child exited before response: ' + String(code) + '/' + String(signal));
      process.exitCode = 2;
    });
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\\n')) {
        const at = buffer.indexOf('\\n');
        const line = buffer.slice(0, at).trim();
        buffer = buffer.slice(at + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id === 1 && !sentCall) {
          sentCall = true;
          send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: ${JSON.stringify(
            name,
          )}, arguments: ${JSON.stringify(args)} } });
        }
        if (message.id === 2 && !finished) {
          finished = true;
          clearTimeout(timeout);
          writeSync(1, JSON.stringify({ isError: Boolean(message.result?.isError), text: String(message.result?.content?.[0]?.text ?? '') }));
          child.kill();
        }
      }
    });
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe', version: '1' } } });
  `;
  const raw = execFileSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  return JSON.parse(raw) as { isError: boolean; text: string };
}

function makeVault(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-scan-'));
  writeFileSync(
    join(dir, 'project.md'),
    '---\nkind: project\ntitle: Probe\nuid: 11111111-1111-4111-8111-111111111111\n---\n',
    'utf8',
  );
  return dir;
}

describe('MCP rename: names differing only in case are the same file', () => {
  /**
   * The upstream collision check is a string comparison, so a case-only rename looked like two names
   * while macOS saw one file; writing then deleting the old name deleted the new file.
   */
  it('a rename that differs only in case is **refused** and the file stays as it is', () => {
    const vault = mkdtempSync(join(tmpdir(), 'atlas-case-'));
    mkdirSync(join(vault, 'capabilities'), { recursive: true });
    writeFileSync(
      join(vault, 'capabilities', 'Auth.md'),
      '---\nkind: capability\ntitle: Auth\nuid: 22222222-2222-4222-8222-222222222222\n---\n\nbody\n',
      'utf8',
    );

    const result = callTool(vault, 'rename_concept', {
      oldSlug: 'capabilities/Auth',
      newSlug: 'capabilities/auth',
      confirm: true,
      overwrite: true,
    });

    expect(result.isError, `was not refused: ${result.text.slice(0, 200)}`).toBe(true);
    expect(result.text).toMatch(/letter case/);
    // And above all — **the file must still be there.**
    expect(
      readdirSync(join(vault, 'capabilities')),
      'the document is gone, which is exactly what this check is meant to prevent',
    ).toContain('Auth.md');
  }, 40_000);
});

describe('MCP scan boundary: reads only the folder it was opened on', () => {
  it('a path outside the vault is refused (asks a real server over JSON-RPC)', () => {
    const vault = makeVault();
    const result = callTool(vault, 'analyze_repo_structure', { rootPath: OUTSIDE });
    expect(result.isError, `scanning «${OUTSIDE}» got through: ${result.text.slice(0, 200)}`).toBe(
      true,
    );
    // Why it was blocked must be human-readable — the agent decides what to do next from it.
    expect(result.text).toMatch(/inside the vault/);
  }, 40_000);

  it('inside the vault passes as it is, since blocking is not the goal', () => {
    const vault = makeVault();
    const result = callTool(vault, 'analyze_repo_structure', { rootPath: vault });
    expect(result.isError, `scanning its own vault was blocked: ${result.text.slice(0, 200)}`).toBe(false);
  }, 40_000);

  it('the validation tool that takes `repoRoot` sees the same boundary', () => {
    const vault = makeVault();
    const result = callTool(vault, 'validate_vault', { repoRoot: OUTSIDE });
    expect(result.isError, `validate_vault looked at «${OUTSIDE}»`).toBe(true);
  }, 40_000);
});
