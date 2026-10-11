import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

const CONTRACT_TEST = /^tests\/contract\/.+\.test\.ts$/;
const PERF_TEST = /^(?:app|src)\/.+\.perf\.test\.tsx?$/;
const UNIT_TEST = /^(?:app|src)\/.+\.(?:test|spec)\.tsx?$/;
const TEST_DIRECTORIES = ['app', 'src', 'tests/contract'];
const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.js', '.cjs', '.jsx', '.json'];
const PACKAGE_DIRECTORY = '(?:app|cli|mcp|scripts|src|tests)/';
const REPOSITORY_FILE = new RegExp(`^${PACKAGE_DIRECTORY}[^?#]+\\.(?:[cm]?[jt]sx?|json)$`);
const PATH_LITERAL = new RegExp(`(['"\`])((?:\\.{1,2}/|@/|${PACKAGE_DIRECTORY})[^'"\`\\s$]*)\\1`, 'g');
const IMPORT_SPECIFIER = /(['"])((?:\.{1,2}\/|@\/)[^'"\s$]*)\1/g;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*).*$/gm;

/**
 * The Vitest tests that can run each repository file. Any quoted specifier outside a comment
 * line is an edge, and code under `tests/` may also name a repository file it spawns or reads,
 * so the graph never misses an import. Textual because the CI planner runs before `pnpm install`.
 */
export function createTestReach(root = process.cwd()) {
  const fileCache = new Map();
  const isFile = (path) => {
    if (!fileCache.has(path)) fileCache.set(path, statSync(join(root, path), { throwIfNoEntry: false })?.isFile() === true);
    return fileCache.get(path);
  };
  const aliases = readAliases(root);
  const dependents = new Map();
  const unresolvedImporters = new Map();
  const tests = TEST_DIRECTORIES.flatMap((directory) => listFiles(root, directory)).filter(testKind);
  const visited = new Set(tests);
  const queue = [...tests];

  while (queue.length > 0) {
    const from = queue.pop();
    if (!CODE_FILE.test(from)) continue;
    const literals = from.startsWith('tests/') ? PATH_LITERAL : IMPORT_SPECIFIER;
    for (const [, , specifier] of readFileSync(join(root, from), 'utf8').replace(COMMENT_LINE, '').matchAll(literals)) {
      const base = specifierBase(from, specifier, aliases);
      if (base === null) continue;
      const target = moduleCandidates(base, specifier).find(isFile);
      if (!target) {
        for (const candidate of moduleCandidates(base, specifier)) addEdge(unresolvedImporters, candidate, from);
        continue;
      }
      addEdge(dependents, target, from);
      if (!visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }

  /**
   * Every test whose graph holds one of `paths`, grouped by Vitest project; O(files + edges).
   * A path missing on disk (deleted, or a catalogue built at install) is reached through the
   * imports that would resolve to it.
   */
  function testsReaching(paths) {
    const reached = new Set(paths.flatMap((path) => [path, ...(unresolvedImporters.get(path) ?? [])]));
    const stack = [...reached];
    while (stack.length > 0) {
      for (const dependent of dependents.get(stack.pop()) ?? []) {
        if (reached.has(dependent)) continue;
        reached.add(dependent);
        stack.push(dependent);
      }
    }
    const grouped = { contract: [], unit: [], perf: [] };
    for (const path of [...reached].sort()) {
      const kind = testKind(path);
      if (kind) grouped[kind].push(path);
    }
    return grouped;
  }

  return { testsReaching };
}

const reachByRoot = new Map();

export function loadTestReach(root = process.cwd()) {
  if (!reachByRoot.has(root)) reachByRoot.set(root, createTestReach(root));
  return reachByRoot.get(root);
}

function addEdge(edges, target, from) {
  if (!edges.has(target)) edges.set(target, new Set());
  edges.get(target).add(from);
}

function testKind(path) {
  if (CONTRACT_TEST.test(path)) return 'contract';
  if (PERF_TEST.test(path)) return 'perf';
  if (UNIT_TEST.test(path)) return 'unit';
  return null;
}

function listFiles(root, directory) {
  let entries;
  try {
    entries = readdirSync(join(root, directory), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? listFiles(root, path) : [path];
  });
}

function readAliases(root) {
  let paths = {};
  try {
    paths = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8')).compilerOptions?.paths ?? {};
  } catch {
    return [];
  }
  return Object.entries(paths)
    .filter(([pattern, [target] = []]) => pattern.endsWith('/*') && target?.endsWith('/*'))
    .map(([pattern, [target]]) => [pattern.slice(0, -1), posix.normalize(target.slice(0, -1))])
    .sort((a, b) => b[0].length - a[0].length);
}

function specifierBase(from, specifier, aliases) {
  const path = specifier.replace(/[?#].*$/, '');
  let base;
  if (path.startsWith('.')) base = posix.join(posix.dirname(from), path);
  else if (path.startsWith('@/')) {
    const alias = aliases.find(([prefix]) => path.startsWith(prefix));
    if (!alias) return null;
    base = posix.join(alias[1], path.slice(alias[0].length));
  } else base = path;
  return base.startsWith('../') || base.includes('node_modules/') ? null : base;
}

/** A repository-rooted name must be an exact file; an import specifier resolves like the bundler. */
function moduleCandidates(base, specifier) {
  if (!/^[.@]/.test(specifier)) return REPOSITORY_FILE.test(base) ? [base] : [];
  const sourceTwin = /\.[cm]?js$/.test(base) ? ['.ts', '.tsx'].map((extension) => base.replace(/\.[cm]?js$/, extension)) : [];
  return [
    base,
    ...EXTENSIONS.map((extension) => `${base}${extension}`),
    ...sourceTwin,
    ...EXTENSIONS.map((extension) => posix.join(base, `index${extension}`)),
  ];
}
