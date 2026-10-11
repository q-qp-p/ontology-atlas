#!/usr/bin/env node

import {
  access,
  constants,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { EXIT } from './qualification-handoff/contracts.mjs';
import {
  HandoffError,
  assert,
  canonicalJson,
  nonBlank,
} from './qualification-handoff/primitives.mjs';
import { HANDOFF_SCHEMA } from './qualification-handoff/schema.mjs';
import { sealCandidate } from './qualification-handoff/seal.mjs';
import { buildHiddenPacket } from './qualification-handoff/hidden.mjs';
import { buildAuditFragment } from './qualification-handoff/audit.mjs';
import { joinQualification } from './qualification-handoff/join.mjs';
import { acceptQualification } from './qualification-handoff/accept.mjs';
import { prepareRelease } from './qualification-handoff/release.mjs';
import { prepareProposalCoverage } from './qualification-handoff/coverage.mjs';
import { hydrateCommandInput } from './qualification-handoff/input.mjs';

function commandResult(command, input) {
  if (command === 'coverage') return prepareProposalCoverage(input);
  if (command === 'seal') return sealCandidate(input);
  if (command === 'hidden') return buildHiddenPacket(input);
  if (command === 'audit') return buildAuditFragment(input);
  if (command === 'join') return joinQualification(input);
  if (command === 'accept') return acceptQualification(input);
  if (command === 'release') return prepareRelease(input);
  throw new HandoffError(`Unknown command: ${command}`, { exitCode: EXIT.USAGE });
}

async function atomicWriteDirectory(outputPath, files) {
  assert(nonBlank(outputPath), '--output needs a path.', { exitCode: EXIT.USAGE });
  try {
    await access(outputPath, constants.F_OK);
    throw new HandoffError('Output path already exists.', { exitCode: EXIT.IO });
  } catch (error) {
    if (error instanceof HandoffError) throw error;
    if (error.code !== 'ENOENT') throw new HandoffError(`Cannot inspect output path: ${error.message}`, { exitCode: EXIT.IO });
  }
  const parent = dirname(outputPath);
  try {
    const parentStat = await stat(parent);
    if (!parentStat.isDirectory()) throw new Error('parent is not a directory');
  } catch (error) {
    throw new HandoffError(`Output parent must already exist: ${error.message}`, { exitCode: EXIT.IO });
  }
  let staging;
  try {
    staging = await mkdtemp(join(parent, `.${basename(outputPath)}.staging-`));
    for (const [name, value] of Object.entries(files)) {
      assert(!name.includes('/') && !name.includes('..'), `Unsafe artifact name ${name}.`, { exitCode: EXIT.SOFTWARE });
      await writeFile(join(staging, name), canonicalJson(value, { pretty: true }), { flag: 'wx' });
    }
    await rename(staging, outputPath);
  } catch (error) {
    if (staging) await rm(staging, { recursive: true, force: true }).catch(() => {});
    if (error instanceof HandoffError) throw error;
    throw new HandoffError(`Failed to write output directory: ${error.message}`, { exitCode: EXIT.IO });
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') return { command: 'help' };
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    assert(['--input', '--output'].includes(flag) && value, `Invalid argument ${flag ?? ''}.`, { exitCode: EXIT.USAGE });
    assert(!Object.hasOwn(options, flag), `Duplicate argument ${flag}.`, { exitCode: EXIT.USAGE });
    options[flag] = value;
  }
  return { command, inputPath: options['--input'], outputPath: options['--output'] };
}

export async function runCli(argv = process.argv.slice(2)) {
  const { command, inputPath, outputPath } = parseArgs(argv);
  if (command === 'help') {
    process.stdout.write(`${HANDOFF_SCHEMA.invocation}\nRun the schema subcommand for contracts and exit codes.\n`);
    return EXIT.OK;
  }
  if (command === 'schema') {
    assert(!inputPath, 'schema does not accept --input.', { exitCode: EXIT.USAGE });
    if (outputPath) await atomicWriteDirectory(outputPath, { 'schema.json': HANDOFF_SCHEMA });
    else process.stdout.write(canonicalJson(HANDOFF_SCHEMA, { pretty: true }));
    return EXIT.OK;
  }
  assert(inputPath && outputPath, `${command} requires --input and --output.`, { exitCode: EXIT.USAGE });
  let input;
  try {
    input = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (error) {
    const exitCode = error instanceof SyntaxError ? EXIT.DATA : EXIT.IO;
    throw new HandoffError(`Cannot read input JSON: ${error.message}`, { exitCode });
  }
  const hydrated = await hydrateCommandInput(command, input, dirname(resolve(inputPath)));
  const result = commandResult(command, hydrated);
  await atomicWriteDirectory(outputPath, result.files);
  process.stdout.write(canonicalJson({ command, output: outputPath, files: Object.keys(result.files) }, { pretty: true }));
  return EXIT.OK;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    const code = error instanceof HandoffError ? error.exitCode : EXIT.SOFTWARE;
    process.stderr.write(canonicalJson({
      error: error.message,
      exitCode: code,
      ...(error.details === undefined ? {} : { details: error.details }),
    }, { pretty: true }));
    process.exitCode = code;
  });
}
