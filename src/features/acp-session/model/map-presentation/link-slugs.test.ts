import { describe, expect, it } from 'vitest';

import { linkSlugs } from './link-slugs';

/**
 * Picks **only names of nodes that really exist** out of chat text.
 *
 * The common approach of linking anything shaped like `a/b` cannot be used here — an agent's answers
 * are full of file paths (`src/features/acp-session/model/x.ts`), URLs, and dates, and turning all of
 * them into nodes creates a link on every other word that goes nowhere when pressed. **Because we
 * have the graph**, only known names are picked.
 */

const known = new Set([
  'capabilities/invoice',
  'domains/payment',
  'elements/checkout-form',
]);

describe('picks up only names it knows', () => {
  it('picks up a real node name', () => {
    const out = linkSlugs('먼저 capabilities/invoice 를 봤어요.', known);
    expect(out).toEqual([
      { text: '먼저 ' },
      { text: 'capabilities/invoice', slug: 'capabilities/invoice' },
      { text: ' 를 봤어요.' },
    ]);
  });

  it('leaves an unknown name as plain text, so no link goes nowhere when pressed', () => {
    const out = linkSlugs('src/features/acp-session/model/x.ts 를 고쳤어요.', known);
    expect(out).toEqual([{ text: 'src/features/acp-session/model/x.ts 를 고쳤어요.' }]);
  });

  it('does not pick up a known name inside a file path; that is not the node', () => {
    // `docs/ontology/capabilities/invoice.md` is a file, not a reference to that node.
    const out = linkSlugs('docs/ontology/capabilities/invoice.md 를 열었어요', known);
    expect(out.some((s) => 'slug' in s)).toBe(false);
  });

  it('does not pick up a file name with only a tail attached; the **end**, not the start, decides', () => {
    // With no path in front, the leading boundary check passes. Only the trailing rule catches this,
    // so without this case that rule could be deleted unnoticed.
    const out = linkSlugs('capabilities/invoice.md 를 열었어요', known);
    expect(out.some((s) => 'slug' in s)).toBe(false);
  });

  it('picks up all of them even with several on one line', () => {
    const out = linkSlugs('capabilities/invoice 를 domains/payment 에 붙였어요', known);
    expect(out.filter((s) => 'slug' in s).map((s) => s.text)).toEqual([
      'capabilities/invoice',
      'domains/payment',
    ]);
  });

  it('does not split into pieces when there is no known name, adding no needless elements', () => {
    expect(linkSlugs('그냥 문장이에요', known)).toEqual([{ text: '그냥 문장이에요' }]);
  });

  it('returns an empty result for empty text', () => {
    expect(linkSlugs('', known)).toEqual([]);
  });

  it('picks up nothing when the known-name set is empty', () => {
    expect(linkSlugs('capabilities/invoice', new Set())).toEqual([
      { text: 'capabilities/invoice' },
    ]);
  });

  it('picks up the **longer** of overlapping names, since picking the shorter first cuts off the rest', () => {
    const both = new Set(['a/b', 'a/b-c']);
    const out = linkSlugs('a/b-c 를 봤어요', both);
    expect(out[0]).toEqual({ text: 'a/b-c', slug: 'a/b-c' });
  });

  it('does not pick up a name directly flanked by letters, which is only part of a name', () => {
    const out = linkSlugs('xcapabilities/invoicey', known);
    expect(out.some((s) => 'slug' in s)).toBe(false);
  });

  it('picks up a name next to brackets, quotes and periods, as sentences really use them', () => {
    for (const text of [
      '(capabilities/invoice)',
      '「capabilities/invoice」',
      'capabilities/invoice.',
      '`capabilities/invoice`',
    ]) {
      expect(
        linkSlugs(text, known).some((s) => 'slug' in s),
        `${text} was not picked up`,
      ).toBe(true);
    }
  });
});
