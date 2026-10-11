import { constants, lstat, open, readFile, realpath } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { EXIT } from './contracts.mjs';
import { HandoffError, assert, isRecord, nonBlank } from './primitives.mjs';
import { deriveCandidateFromAnalysis } from './coverage.mjs';

function compactRequested(input, keys) {
  return keys.some((key) => Object.hasOwn(input, key));
}

function validateCompactChoice(input, compactKeys, embeddedKeys, command) {
  assert(compactKeys.every((key) => nonBlank(input[key])), `${command} compact input needs ${compactKeys.join(', ')}.`);
  assert(embeddedKeys.every((key) => !Object.hasOwn(input, key)), `${command} cannot mix compact paths with embedded ${embeddedKeys.join(', ')}.`);
}

async function readHydratedJson(inputDirectory, pathValue, label) {
  const resolvedPath = resolve(inputDirectory, pathValue);
  try {
    return JSON.parse(await readFile(resolvedPath, 'utf8'));
  } catch (error) {
    const exitCode = error instanceof SyntaxError ? EXIT.DATA : EXIT.IO;
    throw new HandoffError(`Cannot hydrate ${label} from ${resolvedPath}: ${error.message}`, { exitCode });
  }
}

async function loadDirectoryArtifacts(inputDirectory, directoryPath, files) {
  const resolvedDirectory = resolve(inputDirectory, directoryPath);
  const entries = await Promise.all(Object.entries(files).map(async ([key, name]) => [
    key,
    await readHydratedJson(resolvedDirectory, name, `${key} artifact`),
  ]));
  return Object.fromEntries(entries);
}

async function loadHandoff(inputDirectory, handoffDir) {
  return loadDirectoryArtifacts(inputDirectory, handoffDir, {
    candidate: 'candidate-packet.json',
    manifest: 'claim-manifest.json',
    witnesses: 'source-witnesses.json',
    seal: 'candidate-seal.json',
  });
}

function validateSiblingJsonPath(pathValue, label) {
  assert(
    nonBlank(pathValue)
      && basename(pathValue) === pathValue
      && pathValue.endsWith('.json')
      && !pathValue.includes('..'),
    `${label} must be a plain sibling JSON filename without absolute, nested, or parent-traversal segments.`,
  );
}

function platformCanonicalAlias(pathValue) {
  if (process.platform !== 'darwin') return pathValue;
  for (const prefix of ['/tmp', '/var', '/etc']) {
    if (pathValue === prefix || pathValue.startsWith(`${prefix}/`)) return `/private${pathValue}`;
  }
  return pathValue;
}

async function readSiblingJson(inputDirectory, pathValue, label) {
  validateSiblingJsonPath(pathValue, label);
  assert(
    Number.isInteger(constants.O_NOFOLLOW) && Number.isInteger(constants.O_NONBLOCK),
    'This runtime cannot enforce no-follow sibling reads.',
    { exitCode: EXIT.SOFTWARE },
  );
  const resolvedPath = resolve(inputDirectory, pathValue);
  let handle;
  try {
    const inputDirectoryStat = await lstat(inputDirectory);
    assert(
      inputDirectoryStat.isDirectory() && !inputDirectoryStat.isSymbolicLink(),
      'Sibling paths require a canonical input directory, not a symbolic link.',
      { exitCode: EXIT.DATA },
    );
    const resolvedInputDirectory = resolve(inputDirectory);
    const realInputDirectory = await realpath(resolvedInputDirectory);
    assert(
      realInputDirectory === platformCanonicalAlias(resolvedInputDirectory),
      'Sibling paths require an input directory without symlinked ancestors.',
      { exitCode: EXIT.DATA },
    );
    handle = await open(
      resolvedPath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const opened = await handle.stat();
    assert(opened.isFile(), `${label} must be a regular file.`, { exitCode: EXIT.DATA });
    assert(opened.nlink === 1, `${label} must have exactly one filesystem link.`, { exitCode: EXIT.DATA });
    return JSON.parse(await handle.readFile('utf8'));
  } catch (error) {
    if (error instanceof HandoffError) throw error;
    const symlink = error?.code === 'ELOOP' || error?.code === 'EMLINK';
    const exitCode = symlink || error instanceof SyntaxError ? EXIT.DATA : EXIT.IO;
    const reason = symlink ? 'symbolic links are not allowed' : error.message;
    throw new HandoffError(`Cannot hydrate ${label} from ${resolvedPath}: ${reason}.`, { exitCode });
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function hydrateCommandInput(command, input, inputDirectory) {
  assert(isRecord(input), 'CLI input JSON must be an object.');
  if (command === 'coverage' && compactRequested(input, ['analysisPath', 'proposalPath'])) {
    validateCompactChoice(
      input,
      ['analysisPath', 'proposalPath', 'builderId'],
      ['analysis', 'proposal'],
      command,
    );
    const [analysis, proposal] = await Promise.all([
      readHydratedJson(inputDirectory, input.analysisPath, 'analysis'),
      readHydratedJson(inputDirectory, input.proposalPath, 'proposal'),
    ]);
    return { ...input, analysis, proposal };
  }
  if (command === 'seal' && compactRequested(input, ['analysisPath', 'proposalPath', 'builderId'])) {
    assert(!Object.hasOwn(input, 'candidatePath'), 'seal cannot mix candidatePath with analysisPath/proposalPath.');
    validateCompactChoice(
      input,
      ['analysisPath', 'proposalPath', 'manifestPath', 'witnessesPath', 'builderId'],
      ['candidate', 'manifest', 'witnesses'],
      command,
    );
    const [analysis, proposal, manifest, witnesses] = await Promise.all([
      readHydratedJson(inputDirectory, input.analysisPath, 'analysis'),
      readHydratedJson(inputDirectory, input.proposalPath, 'proposal'),
      readHydratedJson(inputDirectory, input.manifestPath, 'manifest'),
      readHydratedJson(inputDirectory, input.witnessesPath, 'witnesses'),
    ]);
    const candidate = deriveCandidateFromAnalysis(analysis, proposal, input.builderId);
    return { ...input, candidate, manifest, witnesses };
  }
  if (command === 'seal' && compactRequested(input, ['candidatePath', 'manifestPath', 'witnessesPath'])) {
    assert(!compactRequested(input, ['analysisPath', 'proposalPath', 'builderId']), 'seal cannot mix candidatePath with derived analysis inputs.');
    validateCompactChoice(
      input,
      ['candidatePath', 'manifestPath', 'witnessesPath'],
      ['candidate', 'manifest', 'witnesses'],
      command,
    );
    const [candidate, manifest, witnesses] = await Promise.all([
      readHydratedJson(inputDirectory, input.candidatePath, 'candidate'),
      readHydratedJson(inputDirectory, input.manifestPath, 'manifest'),
      readHydratedJson(inputDirectory, input.witnessesPath, 'witnesses'),
    ]);
    return { ...input, candidate, manifest, witnesses };
  }
  if (command === 'hidden' && compactRequested(input, ['qualificationCorePath', 'answersPath'])) {
    assert(
      nonBlank(input.qualificationCorePath) && nonBlank(input.answersPath),
      'hidden sibling paths require qualificationCorePath and answersPath together.',
    );
    assert(
      !Object.hasOwn(input, 'qualificationCore') && !Object.hasOwn(input, 'answers'),
      'hidden cannot mix sibling paths with embedded qualificationCore or answers.',
    );
    assert(
      ['candidate', 'manifest', 'witnesses', 'seal'].every((key) => !Object.hasOwn(input, key)),
      'hidden cannot mix sibling paths with embedded candidate, manifest, witnesses, or seal.',
    );
    assert(nonBlank(input.handoffDir), 'hidden sibling paths require handoffDir.');
    validateSiblingJsonPath(input.qualificationCorePath, 'qualificationCorePath');
    validateSiblingJsonPath(input.answersPath, 'answersPath');
    const [handoff, qualificationCore, answers] = await Promise.all([
      loadHandoff(inputDirectory, input.handoffDir),
      readSiblingJson(inputDirectory, input.qualificationCorePath, 'qualificationCore'),
      readSiblingJson(inputDirectory, input.answersPath, 'answers'),
    ]);
    return { ...input, ...handoff, qualificationCore, answers };
  }
  if (['hidden', 'audit'].includes(command) && compactRequested(input, ['handoffDir'])) {
    validateCompactChoice(input, ['handoffDir'], ['candidate', 'manifest', 'witnesses', 'seal'], command);
    return { ...input, ...await loadHandoff(inputDirectory, input.handoffDir) };
  }
  if (command === 'join' && compactRequested(input, ['handoffDir', 'hiddenDir', 'auditorDir'])) {
    validateCompactChoice(
      input,
      ['handoffDir', 'hiddenDir', 'auditorDir'],
      ['candidate', 'manifest', 'witnesses', 'seal', 'hidden', 'audit'],
      command,
    );
    const [handoff, hiddenArtifacts, auditArtifacts] = await Promise.all([
      loadHandoff(inputDirectory, input.handoffDir),
      loadDirectoryArtifacts(inputDirectory, input.hiddenDir, {
        qualification: 'qualification-pending.json',
        access: 'hidden-access.json',
        receipt: 'hidden-receipt.json',
      }),
      loadDirectoryArtifacts(inputDirectory, input.auditorDir, {
        fragment: 'qualification-source-fragment.json',
        access: 'auditor-access.json',
        receipt: 'audit-receipt.json',
      }),
    ]);
    return { ...input, ...handoff, hidden: hiddenArtifacts, audit: auditArtifacts };
  }
  if (command === 'accept' && compactRequested(input, ['handoffDir', 'joinedDir'])) {
    validateCompactChoice(
      input,
      ['handoffDir', 'joinedDir'],
      ['candidate', 'manifest', 'witnesses', 'seal', 'join'],
      command,
    );
    const [handoff, joined] = await Promise.all([
      loadHandoff(inputDirectory, input.handoffDir),
      loadDirectoryArtifacts(inputDirectory, input.joinedDir, {
        qualification: 'qualification-joined-pending.json',
        request: 'acceptance-request.json',
        receipt: 'join-receipt.json',
      }),
    ]);
    return { ...input, ...handoff, join: joined };
  }
  if (command === 'release' && compactRequested(input, ['handoffDir', 'acceptedDir', 'analyzeRequestPath', 'releasedPath'])) {
    validateCompactChoice(
      input,
      ['handoffDir', 'acceptedDir', 'analyzeRequestPath', 'releasedPath'],
      ['candidate', 'manifest', 'witnesses', 'seal', 'acceptedQualification', 'acceptanceReceipt', 'analyzeRequest', 'released'],
      command,
    );
    const [handoff, accepted, analyzeRequest, released] = await Promise.all([
      loadHandoff(inputDirectory, input.handoffDir),
      loadDirectoryArtifacts(inputDirectory, input.acceptedDir, {
        acceptedQualification: 'qualification-accepted.json',
        acceptanceReceipt: 'acceptance-receipt.json',
      }),
      readHydratedJson(inputDirectory, input.analyzeRequestPath, 'final analyze request'),
      readHydratedJson(inputDirectory, input.releasedPath, 'final analyze response'),
    ]);
    return { ...input, ...handoff, ...accepted, analyzeRequest, released };
  }
  return input;
}
