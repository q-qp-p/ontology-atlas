import { readMatchRowFailure } from './concept-reads.mjs';

export function findNeighborsFailure(parsed, expectedSlug) {
  if (parsed?.center !== expectedSlug) {
    return `find_neighbors center mismatch: expected ${expectedSlug}, got ${parsed?.center}`;
  }
  if (typeof parsed.requested !== 'string' || parsed.requested.length === 0) {
    return 'find_neighbors response missing requested slug';
  }
  if (!['incoming', 'outgoing', 'both'].includes(parsed.direction)) {
    return 'find_neighbors response missing direction';
  }
  if (parsed.types != null && !Array.isArray(parsed.types)) {
    return 'find_neighbors response malformed types array';
  }
  if (!Number.isInteger(parsed.totalEdges) || parsed.totalEdges < 0) {
    return 'find_neighbors response missing totalEdges';
  }
  if (typeof parsed.limited !== 'boolean') {
    return 'find_neighbors response missing limited flag';
  }
  if (!Array.isArray(parsed.edges)) {
    return 'find_neighbors response missing edges array';
  }
  if (parsed.edges.length > parsed.totalEdges) {
    return `find_neighbors response edge count exceeds total: edges ${parsed.edges.length}, total ${parsed.totalEdges}`;
  }
  if (!parsed.limited && parsed.edges.length !== parsed.totalEdges) {
    return `find_neighbors response edge count mismatch: edges ${parsed.edges.length}, total ${parsed.totalEdges}`;
  }
  if (!Array.isArray(parsed.nodes)) {
    return 'find_neighbors response missing nodes array';
  }
  for (const [index, edge] of parsed.edges.entries()) {
    const edgeFailure = graphEdgeFailure('find_neighbors edge', edge, index);
    if (edgeFailure) return edgeFailure;
    if (!['incoming', 'outgoing'].includes(edge.direction)) {
      return `find_neighbors edge missing direction at index ${index}`;
    }
  }
  for (const [index, row] of parsed.nodes.entries()) {
    const failure = readMatchRowFailure('find_neighbors', row, index);
    if (failure) return failure;
  }
  return null;
}

export function findPathFailure(parsed, expectedFrom, expectedTo) {
  if (parsed?.from !== expectedFrom || parsed?.to !== expectedTo) {
    return `find_path endpoint mismatch: expected ${expectedFrom}->${expectedTo}, got ${parsed?.from}->${parsed?.to}`;
  }
  if (typeof parsed.found !== 'boolean') {
    return 'find_path response missing found flag';
  }
  if (parsed.found !== true) {
    return 'find_path response expected found:true';
  }
  if (!Number.isInteger(parsed.hopCount) || parsed.hopCount < 0) {
    return 'find_path response missing hopCount';
  }
  if (!Array.isArray(parsed.hops) || parsed.hops.length !== parsed.hopCount + 1) {
    return 'find_path response hop count mismatch';
  }
  if (parsed.hops[0] !== expectedFrom || parsed.hops.at(-1) !== expectedTo) {
    return 'find_path response endpoint hops mismatch';
  }
  if (!Array.isArray(parsed.edges) || parsed.edges.length !== parsed.hopCount) {
    return 'find_path response edge count mismatch';
  }
  for (const [index, edge] of parsed.edges.entries()) {
    const edgeFailure = graphEdgeFailure('find_path edge', edge, index);
    if (edgeFailure) return edgeFailure;
    if (edge.from !== parsed.hops[index] || edge.to !== parsed.hops[index + 1]) {
      return `find_path edge/hop mismatch at index ${index}`;
    }
  }
  if (parsed.nodes !== undefined) {
    if (!Array.isArray(parsed.nodes) || parsed.nodes.length !== parsed.hops.length) {
      return 'find_path response node count mismatch';
    }
    for (const [index, row] of parsed.nodes.entries()) {
      const failure = pathNodeFailure(row, index);
      if (failure) return failure;
      if (row.slug !== parsed.hops[index]) {
        return `find_path node/hop mismatch at index ${index}`;
      }
    }
  }
  return null;
}

export function pathNodeFailure(row, index) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return `find_path response malformed node at index ${index}`;
  }
  if (typeof row.slug !== 'string' || row.slug.length === 0) {
    return `find_path response missing node slug at index ${index}`;
  }
  if (typeof row.kind !== 'string' || row.kind.length === 0) {
    return `find_path response missing node kind: ${row.slug}`;
  }
  if (typeof row.title !== 'string' || row.title.length === 0) {
    return `find_path response missing node title: ${row.slug}`;
  }
  if (row.domain !== undefined && typeof row.domain !== 'string') {
    return `find_path response malformed node domain: ${row.slug}`;
  }
  return null;
}

export function graphEdgeFailure(label, edge, index) {
  if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
    return `${label} malformed edge at index ${index}`;
  }
  for (const key of ['from', 'to', 'via']) {
    if (typeof edge[key] !== 'string' || edge[key].length === 0) {
      return `${label} missing ${key} at index ${index}`;
    }
  }
  return null;
}
