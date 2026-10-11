import { batchCapFailure, batchRowIsolationFailure } from '../checks/batch-writes.mjs';
import {
  absorbDocumentDryRunFailure,
  destructiveDryRunSmokeFailure,
  patchConflictGuardFailure,
} from '../checks/write-dry-runs.mjs';
import { log } from '../output.mjs';

export function verifyWriteSafety(responses, { destructiveDryRunExpectedResponses }) {
  const patchConflictGuardRes = responses.find((r) => r.id === 61);
  const absorbDocumentDryRunRes = responses.find((r) => r.id === 69);
  const addConceptsRowIsolationRes = responses.find((r) => r.id === 28);
  const addRelationsRowIsolationRes = responses.find((r) => r.id === 29);
  let destructiveDryRunCount = 0;
  const addConceptsRowIsolationFailure = batchRowIsolationFailure(addConceptsRowIsolationRes, 'concepts', 'add_concepts');
  if (addConceptsRowIsolationFailure) {
    log('fail', addConceptsRowIsolationFailure);
    return false;
  }
  log('ok', 'add_concepts: non-object, single/multi unknown-field repair, Received fields, duplicate-slug rows isolated with input indexes, and invalid-only batches return no write metadata');
  const addRelationsRowIsolationFailure = batchRowIsolationFailure(addRelationsRowIsolationRes, 'relations', 'add_relations');
  if (addRelationsRowIsolationFailure) {
    log('fail', addRelationsRowIsolationFailure);
    return false;
  }
  log('ok', 'add_relations: non-object, single/multi unknown-field repair, Received fields, invalid-type rows isolated with input indexes and closest-value hints, and invalid-only batches return no write metadata');
  const getConceptsBatchCapFailure = batchCapFailure(responses.find((r) => r.id === 64), 'get_concepts', 'slugs');
  if (getConceptsBatchCapFailure) {
    log('fail', getConceptsBatchCapFailure);
    return false;
  }
  const addConceptsBatchCapFailure = batchCapFailure(responses.find((r) => r.id === 62), 'add_concepts', 'concepts');
  if (addConceptsBatchCapFailure) {
    log('fail', addConceptsBatchCapFailure);
    return false;
  }
  const addRelationsBatchCapFailure = batchCapFailure(responses.find((r) => r.id === 63), 'add_relations', 'relations');
  if (addRelationsBatchCapFailure) {
    log('fail', addRelationsBatchCapFailure);
    return false;
  }
  log('ok', 'batch caps: get_concepts/add_concepts/add_relations reject 51 rows with invalid_arguments');
  const destructiveDryRunResponses = destructiveDryRunExpectedResponses.map(([toolName, id]) => [
    toolName,
    responses.find((response) => response.id === id),
  ]);
  if (destructiveDryRunResponses.length > 0) {
    const destructiveFailure = destructiveDryRunSmokeFailure(destructiveDryRunResponses);
    if (destructiveFailure) {
      log('fail', destructiveFailure);
      return false;
    }
    destructiveDryRunCount = destructiveDryRunResponses.length;
    log('ok', `destructive dry-runs: ${destructiveDryRunResponses.map(([toolName]) => toolName).join(' · ')} previewReady/canConfirm contract without write-maintenance`);
  }
  const absorbDocumentDryRunFailureMessage = absorbDocumentDryRunFailure(absorbDocumentDryRunRes);
  if (absorbDocumentDryRunFailureMessage) {
    log('fail', absorbDocumentDryRunFailureMessage);
    return false;
  }
  log('ok', 'absorb_document dry-run: outside-repo temp fixture explicitly opted in, classified (policy + architecture sections), and not written');
  if (patchConflictGuardRes) {
    const patchConflictFailure = patchConflictGuardFailure(patchConflictGuardRes);
    if (patchConflictFailure) {
      log('fail', patchConflictFailure);
      return false;
    }
    log('ok', 'patch_concept conflict guard: stale expected_mtime rejected with vault_conflict');
  }
  return { destructiveDryRunCount };
}
