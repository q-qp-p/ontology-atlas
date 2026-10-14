import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { promisify } from 'node:util';

import { parseArgs } from './run-with-retry.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT = new URL('./run-with-retry.mjs', import.meta.url).pathname;

const workspace = mkdtempSync(join(tmpdir(), 'run-with-retry-'));
after(() => rmSync(workspace, { recursive: true, force: true }));

/**
 * A fake command that appends a line to a counter file on each attempt and starts
 * succeeding at the given attempt number. Proving a retry requires counting the runs
 * from outside.
 */
function fakeCommand({ name, succeedFromAttempt = Infinity, hangMs = 0 }) {
  const counter = join(workspace, `${name}.count`);
  writeFileSync(counter, '');
  const script = join(workspace, `${name}.mjs`);
  writeFileSync(
    script,
    `import { appendFileSync, readFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(counter)}, 'x');
const attempt = readFileSync(${JSON.stringify(counter)}, 'utf8').length;
if (${hangMs} > 0) {
  // A command that never finishes — it sleeps deliberately to show the timeout really kills it.
  setTimeout(() => process.exit(0), ${hangMs});
} else {
  process.exit(attempt >= ${succeedFromAttempt} ? 0 : 7);
}
`,
  );
  return {
    argv: [process.execPath, script],
    attempts: () => readFileSync(counter, 'utf8').length,
  };
}

async function run(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [SCRIPT, ...args], {
      cwd: workspace,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

test('runs once and exits 0 on success', async () => {
  const fake = fakeCommand({ name: 'ok', succeedFromAttempt: 1 });
  const result = await run(['--attempts=3', '--backoff-ms=1', '--', ...fake.argv]);

  assert.equal(result.code, 0);
  assert.equal(fake.attempts(), 1, 'ran again after a success');
});

test('does not run a third time when the second attempt succeeds', async () => {
  const fake = fakeCommand({ name: 'flaky', succeedFromAttempt: 2 });
  const result = await run(['--attempts=3', '--backoff-ms=1', '--', ...fake.argv]);

  assert.equal(result.code, 0);
  assert.equal(fake.attempts(), 2);
  assert.match(result.stdout, /succeeded on attempt 2/);
});

test('runs exactly `attempts` times and exits 1 when every attempt fails', async () => {
  const fake = fakeCommand({ name: 'dead' });
  const result = await run(['--attempts=3', '--backoff-ms=1', '--', ...fake.argv]);

  assert.equal(result.code, 1, 'exited 0 although a required step failed');
  assert.equal(fake.attempts(), 3);
  assert.match(result.stderr, /all 3 attempts failed/);
});

test('with --best-effort exits 0 after total failure but does not pass silently', async () => {
  const fake = fakeCommand({ name: 'best-effort' });
  const result = await run(['--attempts=2', '--backoff-ms=1', '--best-effort', '--', ...fake.argv]);

  assert.equal(result.code, 0);
  assert.equal(fake.attempts(), 2);
  // Without a warning this is indistinguishable from success — the failure shape this
  // repository has repeatedly hit with gates.
  assert.match(result.stdout, /::warning title=/);
});

test('kills a hung command on timeout and continues with a retry', async () => {
  // A command that wants to sleep 60 s per attempt. Without the timeout this test takes
  // over 60 s; the attempt count and the timeout message prove the kill without a clock.
  const fake = fakeCommand({ name: 'hang', hangMs: 60_000 });
  const result = await run(['--attempts=2', '--timeout-ms=700', '--backoff-ms=1', '--', ...fake.argv]);

  assert.equal(result.code, 1);
  assert.equal(fake.attempts(), 2, 'no retry happened after the timeout');
  assert.match(result.stdout, /did not finish within 700ms/);
});

test('a missing command is caught as a failure at spawn', async () => {
  const result = await run([
    '--attempts=2',
    '--backoff-ms=1',
    '--',
    'oatlas-command-that-does-not-exist',
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stdout, /spawn-error/);
});

test('parseArgs rejects a missing `--` or an empty command after it', () => {
  assert.throws(() => parseArgs(['--attempts=2']), /command to run after `--`/);
  assert.throws(() => parseArgs(['--attempts=2', '--']), /nothing follows `--`/);
});

test('parseArgs reads the options and rejects malformed values', () => {
  const { options, command } = parseArgs([
    '--attempts=5',
    '--timeout-ms=1000',
    '--best-effort',
    '--label=apt',
    '--',
    'echo',
    'hi',
  ]);

  assert.equal(options.attempts, 5);
  assert.equal(options.timeoutMs, 1000);
  assert.equal(options.bestEffort, true);
  assert.equal(options.label, 'apt');
  assert.deepEqual(command, ['echo', 'hi']);

  assert.throws(() => parseArgs(['--attempts=0', '--', 'echo']), /must be a positive number/);
  assert.throws(() => parseArgs(['--attempts=nope', '--', 'echo']), /must be a positive number/);
  assert.throws(() => parseArgs(['--unknown', '--', 'echo']), /unknown option/);
});

test('without a label the command itself becomes the label', () => {
  const { options } = parseArgs(['--', 'pnpm', 'exec', 'playwright', 'install-deps']);
  assert.equal(options.label, 'pnpm exec playwright install-deps');
});
