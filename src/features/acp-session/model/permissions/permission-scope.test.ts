import { describe, expect, it } from 'vitest';

import { permissionScope } from './permission-scope';

const withTargets = (targets: unknown[]) => [
  { optionId: 'reject', kind: 'reject_once' },
  { optionId: 'allow', kind: 'allow_once' },
  {
    optionId: 'always',
    kind: 'allow_always',
    _meta: { permission: { changes: [{ targets }] } },
  },
];

describe('scope of always-allow: says only what the adapter said', () => {
  it('gives the tool name for a tool-level allow (measured shape)', () => {
    const scope = permissionScope(
      withTargets([{ type: 'tool', toolName: 'mcp__atlas-vault__add_concept' }]),
    );
    expect(scope.kind).toBe('tool');
    expect(scope.names).toEqual(['mcp__atlas-vault__add_concept']);
  });

  it('gives the folder for a folder-level allow', () => {
    const scope = permissionScope(
      withTargets([{ type: 'directory', path: '/Users/me/work' }]),
    );
    expect(scope.kind).toBe('directory');
    expect(scope.names).toEqual(['/Users/me/work']);
  });

  it('gives all of them when there are several, since showing one would let the rest be allowed in secret', () => {
    const scope = permissionScope(
      withTargets([
        { type: 'tool', toolName: 'a' },
        { type: 'tool', toolName: 'b' },
      ]),
    );
    expect(scope.names).toEqual(['a', 'b']);
  });

  it('**says it does not know** when kinds are mixed, since one sentence cannot honestly state it', () => {
    const scope = permissionScope(
      withTargets([
        { type: 'tool', toolName: 'a' },
        { type: 'directory', path: '/x' },
      ]),
    );
    expect(scope.kind).toBe('unknown');
  });

  it('asserts nothing when the adapter gives nothing', () => {
    expect(permissionScope(withTargets([])).kind).toBe('unknown');
    expect(
      permissionScope([{ optionId: 'always', kind: 'allow_always' }]).kind,
    ).toBe('unknown');
    expect(permissionScope([]).kind).toBe('unknown');
  });

  it('does not swallow an unknown kind quietly; it says it does not know', () => {
    const scope = permissionScope(withTargets([{ type: 'something-new', id: 'x' }]));
    expect(scope.kind).toBe('unknown');
  });

  it('says it does not know even when an unknown sits **next to** a known one', () => {
    // Without this case, deleting the "never swallow silently" rule would go unnoticed (with only
    // unknowns present the result is empty either way — verified with a probe). Swallowing lets
    // something alongside be allowed while the card says "only this tool".
    const scope = permissionScope(
      withTargets([
        { type: 'tool', toolName: 'mcp__atlas-vault__add_concept' },
        { type: 'something-new', id: 'x' },
      ]),
    );
    expect(scope.kind).toBe('unknown');
  });

  it('does not look at the `_meta` of an option that is not "always allow"', () => {
    const scope = permissionScope([
      {
        optionId: 'allow',
        kind: 'allow_once',
        _meta: { permission: { changes: [{ targets: [{ type: 'directory', path: '/x' }] }] } },
      },
    ]);
    expect(scope.kind).toBe('unknown');
  });

  it('does not die when the shape is broken, since a missing permission card stalls the conversation', () => {
    expect(permissionScope(null as never).kind).toBe('unknown');
    expect(permissionScope([null, 'x', 7] as never).kind).toBe('unknown');
  });
});
