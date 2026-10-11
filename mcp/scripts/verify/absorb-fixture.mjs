import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A per-process temp fixture for the absorb_document dry-run (never confirm:true).
// One policy heading and one architecture heading cover both classification
// branches without touching the vault under test.
const ABSORB_FIXTURE_DIR = join(tmpdir(), `ontology-atlas-verify-absorb-${process.pid}`);
export const ABSORB_FIXTURE_PATH = join(ABSORB_FIXTURE_DIR, 'CLAUDE.md');
const ABSORB_FIXTURE_CONTENT = [
  '# Sample Team Agent Guide',
  '',
  '## Testing rules',
  '',
  '- Always write a failing test before implementing a fix.',
  '- Never skip the pre-commit hook.',
  '',
  '## Architecture',
  '',
  'The billing service calls the ledger service through gRPC.',
  '',
].join('\n');

export function ensureAbsorbFixture() {
  mkdirSync(ABSORB_FIXTURE_DIR, { recursive: true });
  writeFileSync(ABSORB_FIXTURE_PATH, ABSORB_FIXTURE_CONTENT, 'utf-8');
  return ABSORB_FIXTURE_PATH;
}

export function cleanupAbsorbFixture() {
  try {
    rmSync(ABSORB_FIXTURE_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup only — a leftover temp file is harmless.
  }
}
