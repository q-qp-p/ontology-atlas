import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { suggestFocusedChecks } from '../focused-check-suggestions.mjs';

const NODE_TEST_PATH = /^(?:scripts|mcp|cli)\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.test\.mjs$/;

export function selectNodeTestFiles({ commands, scripts, exists = existsSync }) {
  const files = new Set();
  for (const { command } of commands) {
    const alias = /^pnpm ([a-z][a-z0-9:-]*)$/.exec(command)?.[1];
    if (alias && (Object.hasOwn(scripts, `pre${alias}`) || Object.hasOwn(scripts, `post${alias}`))) continue;
    const body = alias ? scripts[alias] : command.replace(/^pnpm exec /, '');
    const args = /^node --test (.+)$/.exec(body ?? '')?.[1].split(/\s+/);
    if (!args?.length || !args.every((file) => NODE_TEST_PATH.test(file))) continue;
    for (const file of args) if (exists(file)) files.add(file);
  }
  return [...files].sort();
}

export function fastCheckPlan(paths, { cwd = process.cwd(), scripts, suggestions } = {}) {
  const exists = (file) => existsSync(join(cwd, file));
  if (!scripts) {
    const file = join(cwd, 'package.json');
    scripts = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).scripts ?? {} : {};
  }
  suggestions ??= suggestFocusedChecks(paths.filter(exists), { deletedPaths: paths.filter((path) => !exists(path)) });
  const nodeFiles = new Set(selectNodeTestFiles({ commands: suggestions.commands, scripts, exists }));
  for (const file of paths) {
    if (/^(?:scripts|mcp|cli)\//.test(file) && file.endsWith('.test.mjs') && exists(file)) nodeFiles.add(file);
  }
  return {
    lintFiles: [...new Set(paths.filter((file) => /\.[cm]?[jt]sx?$/.test(file) && exists(file)))].sort(),
    nodeFiles: [...nodeFiles].sort(),
    docsRegistry: paths.some((file) => /^(?:README\.md|docs\/DEVELOPMENT-CHECKS\.md|package\.json|scripts\/check-dev-checks\.mjs|scripts\/lib\/dev-checks-template(?:\.test)?\.mjs)$/.test(file)),
    workflows: paths.some((file) => /^\.github\/(?:workflows|actions)\/.+\.ya?ml$/.test(file)),
  };
}

function main(argv) {
  const base = argv.find((arg) => arg.startsWith('--base='))?.slice('--base='.length);
  const output = argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length);
  if (argv.length !== 2 || !/^[a-f0-9]{40}$/.test(base ?? '') || !output) {
    throw new Error('usage: fast-checks --base=<40-hex-sha> --output=<directory>');
  }
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
    .split('\0').filter((file) => /^(?:app|src|scripts|tests|mcp|cli)\//.test(file));
  if (untracked.length) {
    throw new Error(`Untracked inputs could mask missing files in the pushed HEAD: ${untracked.slice(0, 3).map((file) => JSON.stringify(file)).join(', ')}`);
  }
  const paths = execFileSync('git', ['diff', '--name-only', '-z', `${base}...HEAD`], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const plan = fastCheckPlan(paths);
  for (const [name, files] of [['lint-files', plan.lintFiles], ['node-files', plan.nodeFiles]]) {
    writeFileSync(join(output, name), files.length ? `${files.join('\0')}\0` : '');
  }
  if (plan.docsRegistry) writeFileSync(join(output, 'docs-registry'), '');
  if (plan.workflows) writeFileSync(join(output, 'workflows'), '');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`[pre-push] ${error.message}\n`); process.exitCode = 1; }
}
