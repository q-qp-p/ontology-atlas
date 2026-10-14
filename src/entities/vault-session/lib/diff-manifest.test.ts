import { describe, expect, it } from 'vitest';
import {
  diffVaultManifest,
  planVaultDiffToasts,
  toVaultDiffNode,
  type VaultDiffNode,
} from './diff-manifest';

/** Test shorthand — name required, kind optional. */
function node(name: string, kind?: string, slug = `capabilities/${name}`): VaultDiffNode {
  return { slug, kind, name };
}

describe('diffVaultManifest', () => {
  it('matches the first mount: added and modified are both empty', () => {
    const prev = new Map<string, number | null>([
      ['capabilities/foo', 1000],
      ['domains/bar', 2000],
    ]);
    const current = new Map(prev);
    expect(diffVaultManifest(prev, current)).toEqual({
      added: [],
      modified: [],
    });
  });

  it('marks a slug missing from prev as added', () => {
    const prev = new Map<string, number | null>([['capabilities/foo', 1000]]);
    const current = new Map<string, number | null>([
      ['capabilities/foo', 1000],
      ['capabilities/baz', 3000],
    ]);
    const result = diffVaultManifest(prev, current);
    expect(result.added).toEqual(['capabilities/baz']);
    expect(result.modified).toEqual([]);
  });

  it('marks a mtime increase as modified', () => {
    const prev = new Map<string, number | null>([
      ['capabilities/foo', 1000],
    ]);
    const current = new Map<string, number | null>([
      ['capabilities/foo', 1500],
    ]);
    const result = diffVaultManifest(prev, current);
    expect(result.added).toEqual([]);
    expect(result.modified).toEqual(['capabilities/foo']);
  });

  it('ignores a mtime decrease or equal mtime; only monotonic increase counts', () => {
    const prev = new Map<string, number | null>([
      ['capabilities/foo', 2000],
      ['capabilities/bar', 1000],
    ]);
    const current = new Map<string, number | null>([
      ['capabilities/foo', 2000], // unchanged
      ['capabilities/bar', 500], // decreased (an external git pull and the like)
    ]);
    expect(diffVaultManifest(prev, current).modified).toEqual([]);
  });

  it('skips the modified comparison when the prev mtime is null (static manifest)', () => {
    const prev = new Map<string, number | null>([
      ['capabilities/foo', null],
    ]);
    const current = new Map<string, number | null>([
      ['capabilities/foo', 5000],
    ]);
    expect(diffVaultManifest(prev, current).modified).toEqual([]);
  });

  it('skips the modified comparison when the current mtime is null', () => {
    const prev = new Map<string, number | null>([
      ['capabilities/foo', 1000],
    ]);
    const current = new Map<string, number | null>([
      ['capabilities/foo', null],
    ]);
    expect(diffVaultManifest(prev, current).modified).toEqual([]);
  });

  it('returns added and modified apart when both occur at once', () => {
    const prev = new Map<string, number | null>([
      ['capabilities/foo', 1000],
      ['capabilities/bar', 2000],
    ]);
    const current = new Map<string, number | null>([
      ['capabilities/foo', 1500], // modified
      ['capabilities/bar', 2000], // unchanged
      ['capabilities/baz', 3000], // added
      ['domains/qux', 4000], // added
    ]);
    const result = diffVaultManifest(prev, current);
    expect(result.added.sort()).toEqual([
      'capabilities/baz',
      'domains/qux',
    ]);
    expect(result.modified).toEqual(['capabilities/foo']);
  });

  it('deliberately ignores removed slugs', () => {
    const prev = new Map<string, number | null>([
      ['capabilities/foo', 1000],
      ['capabilities/bar', 2000],
    ]);
    const current = new Map<string, number | null>([
      ['capabilities/foo', 1000],
    ]);
    const result = diffVaultManifest(prev, current);
    expect(result.added).toEqual([]);
    expect(result.modified).toEqual([]);
  });

  it('treats every current entry as already known for an empty prev (second poll after the first), so added is 0', () => {
    // Real callers invoke this after the first-mount baseline. An empty prev is a theoretical case,
    // but it specifies that every slug is classified as added — the caller protects the baseline.
    const prev = new Map<string, number | null>();
    const current = new Map<string, number | null>([
      ['capabilities/foo', 1000],
    ]);
    expect(diffVaultManifest(prev, current).added).toEqual([
      'capabilities/foo',
    ]);
  });
});

describe('toVaultDiffNode', () => {
  it('uses the display_<locale> name when present, not the folder path or the slug', () => {
    const result = toVaultDiffNode(
      {
        slug: 'capabilities/payment-authorization',
        title: 'Payment authorization',
        frontmatter: {
          kind: 'capability',
          display_ko: '결제 승인',
          display_en: 'Payment authorization',
        },
      },
      'ko',
    );
    expect(result).toEqual({
      slug: 'capabilities/payment-authorization',
      kind: 'capability',
      name: '결제 승인',
    });
    expect(result.name).not.toContain('/');
    expect(result.name).not.toContain('payment-authorization');
  });

  it('falls back to title when display_<locale> is missing, still never the slug', () => {
    expect(
      toVaultDiffNode(
        {
          slug: 'domains/refunds',
          title: '환불',
          frontmatter: { kind: 'domain' },
        },
        'ko',
      ).name,
    ).toBe('환불');
  });

  it('never prefixes the folder path, even as a last resort; only the last slug segment', () => {
    // A hand-written `.md` with neither title nor display_*. A name cannot be invented, but the
    // developer folder name `capabilities/` never reaches the screen under any circumstance.
    const result = toVaultDiffNode({ slug: 'capabilities/orphan' }, 'ko');
    expect(result.name).toBe('orphan');
    expect(result.name).not.toContain('/');
  });

  it('leaves kind undefined when frontmatter has none, rather than inventing one', () => {
    expect(toVaultDiffNode({ slug: 'notes/memo', title: '메모' }, 'ko').kind).toBeUndefined();
    expect(
      toVaultDiffNode({ slug: 'notes/memo', title: '메모', frontmatter: { kind: '  ' } }, 'ko').kind,
    ).toBeUndefined();
  });
});

describe('planVaultDiffToasts', () => {
  it('keeps the toast plan empty when nothing changed', () => {
    expect(planVaultDiffToasts({ added: [], modified: [] })).toEqual([]);
  });

  it('converts added and modified into a node plus variant structure', () => {
    const added = node('new', 'capability');
    const modified = node('existing', 'domain', 'domains/existing');
    expect(planVaultDiffToasts({ added: [added], modified: [modified] })).toEqual([
      { kind: 'added', node: added, variant: 'info' },
      { kind: 'edited', node: modified, variant: 'success' },
    ]);
  });

  it('folds into one card past the preview and counts three branches, not a total', () => {
    expect(
      planVaultDiffToasts(
        {
          added: [node('a', 'capability'), node('b', 'capability')],
          modified: [node('c', 'domain'), node('d', 'domain')],
        },
        3,
      ),
    ).toEqual([
      {
        kind: 'digest',
        counts: {
          added: { total: 2, byKind: [{ kind: 'capability', count: 2 }] },
          modified: { total: 2, byKind: [{ kind: 'domain', count: 2 }] },
          removed: 0,
        },
        variant: 'info',
      },
    ]);
  });

  /**
   * "3 capabilities · 12 elements added" beats "15 added" — a digest that states only a count leaves
   * the user looking at a number without knowing what grew.
   */
  it('counts the digest by kind, most first and by name on a tie', () => {
    const [digest] = planVaultDiffToasts(
      {
        added: [
          node('e1', 'element'),
          node('c1', 'capability'),
          node('e2', 'element'),
          node('c2', 'capability'),
          node('e3', 'element'),
          node('d1', 'domain'),
        ],
        modified: [],
      },
      3,
    );
    expect(digest.counts?.added).toEqual({
      total: 6,
      byKind: [
        { kind: 'element', count: 3 },
        { kind: 'capability', count: 2 },
        { kind: 'domain', count: 1 },
      ],
    });
  });

  it('gathers the share with no kind into one last row instead of inventing a kind', () => {
    const [digest] = planVaultDiffToasts(
      {
        added: [node('a', 'capability'), node('b'), node('c'), node('d', 'capability')],
        modified: [],
      },
      3,
    );
    expect(digest.counts?.added).toEqual({
      total: 4,
      byKind: [{ kind: 'capability', count: 2 }, { count: 2 }],
    });
  });

  it('goes to the digest when deletions mix in even with a small count, since a removed document has no name to read', () => {
    expect(
      planVaultDiffToasts({ added: [node('a', 'capability')], modified: [], removed: 1 }, 3),
    ).toEqual([
      {
        kind: 'digest',
        counts: {
          added: { total: 1, byKind: [{ kind: 'capability', count: 1 }] },
          modified: { total: 0, byKind: [] },
          removed: 1,
        },
        variant: 'info',
      },
    ]);
  });

  it('reports a deletion-only burst too, which used to stay silent entirely', () => {
    expect(planVaultDiffToasts({ added: [], modified: [], removed: 3 })).toEqual([
      {
        kind: 'digest',
        counts: {
          added: { total: 0, byKind: [] },
          modified: { total: 0, byKind: [] },
          removed: 3,
        },
        variant: 'info',
      },
    ]);
  });

  it('folds even a single entry into the digest when the preview limit is 0', () => {
    const plan = planVaultDiffToasts(
      { added: [node('a', 'capability')], modified: [node('b', 'domain')] },
      0,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe('digest');
  });
});
