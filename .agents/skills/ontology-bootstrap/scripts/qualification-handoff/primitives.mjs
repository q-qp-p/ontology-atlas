import { createHash } from 'node:crypto';

import { DIGEST_RE, EXIT } from './contracts.mjs';

export class HandoffError extends Error {
  constructor(message, { exitCode = EXIT.DATA, details } = {}) {
    super(message);
    this.name = 'HandoffError';
    this.exitCode = exitCode;
    this.details = details;
  }
}

export function assert(condition, message, options) {
  if (!condition) throw new HandoffError(message, options);
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function nonBlank(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0;
}

export function uniqueStrings(value) {
  return Array.isArray(value)
    && value.every(nonBlank)
    && new Set(value).size === value.length;
}

export function validDigest(value) {
  return typeof value === 'string' && DIGEST_RE.test(value);
}

export function validTimestamp(value) {
  return nonBlank(value) && Number.isFinite(Date.parse(value));
}

export function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function exactSet(left, right) {
  return uniqueStrings(left)
    && uniqueStrings(right)
    && same([...left].sort(), [...right].sort());
}

export function uniqueRows(rows, key, label) {
  assert(Array.isArray(rows), `${label} must be an array.`);
  assert(rows.every((row) => isRecord(row) && nonBlank(row[key])), `${label} rows need ${key}.`);
  assert(new Set(rows.map((row) => row[key])).size === rows.length, `${label} ${key} values must be unique.`);
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value, { pretty = false } = {}) {
  return `${JSON.stringify(canonicalize(value), null, pretty ? 2 : 0)}${pretty ? '\n' : ''}`;
}

export function digestJson(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export function artifactDigest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value, { pretty: true })).digest('hex')}`;
}

export function manifestProjection(rows) {
  return rows.map(({ id, statement, status, witnessRefs, proposalRefs }) => ({
    id,
    statement,
    status,
    witnessRefs: [...witnessRefs],
    proposalRefs: [...proposalRefs],
  }));
}

export function qualificationWitnesses(witnesses) {
  return witnesses.map(({ id, kind, current, provenance }) => ({
    id,
    kind,
    current,
    provenance: structuredClone(provenance),
  }));
}
