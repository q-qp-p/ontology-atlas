import { defaultUrlTransform } from 'react-markdown';
import { describe, expect, it } from 'vitest';
import { decodeWikilinkSlug, rewriteWikilinks, WIKILINK_SENTINEL } from '@/shared/lib/library/source-citation';

/**
 * A wikilink sentinel must not be a URL scheme: `react-markdown` sanitises URLs and turns an unknown
 * scheme into an empty string, leaving a plain span. The URL a wikilink produces must survive the
 * sanitiser, so a library bump that changes its allowlist breaks here first.
 */

describe('a wikilink URL passes the sanitizing of the markdown renderer', () => {
  const sentinel = WIKILINK_SENTINEL;
  // Exercise the shared rewrite consumed by both readers instead of scanning its old file.
  const destination = (slug: string) => rewriteWikilinks(`[[${slug}]]`).match(/\]\(([^)]+)\)$/)?.[1];

  it('the viewer has the sentinel prefix, and if it is not found this test spins idle', () => {
    expect(sentinel).toBeTruthy();
    expect(destination('capabilities/example')).toContain(sentinel);
  });

  it('a URL with that sentinel survives sanitizing', () => {
    const url = destination('capabilities/example')!;
    expect(
      defaultUrlTransform(url),
      `react-markdown strips "${url}". With an empty href the viewer's a component returns ` +
        'neither a link nor a not-found mark but **plain text with no mark at all**. ' +
        'A scheme shape (`X:`) outside the allow list is cut entirely; use a query or path shape.',
    ).not.toBe('');
  });

  it('a Hangul slug survives too, since a vault slug may be Hangul', () => {
    const url = destination('capabilities/스윕-검증-절차')!;
    expect(defaultUrlTransform(url)).not.toBe('');
  });

  /**
   * The idling guard in reverse — is this check passing *anything*? Feed it a value
   * that really gets stripped, confirming the sanitiser is alive in the first place.
   */
  it('the instrument is alive: a scheme that really gets cut becomes an empty value', () => {
    expect(defaultUrlTransform('javascript:alert(1)')).toBe('');
    expect(defaultUrlTransform('WIKILINK:capabilities/x')).toBe('');
  });
});

/**
 * **The second layer — the parser percent-encodes the URL.**
 *
 * Even after surviving sanitisation, every Korean wikilink fell through to the dotted
 * "link not in this folder" state. Measured: the value arriving at the viewer's `a`
 * component was `capabilities/%EC%8A%A4%EC%9C%95-…` (69 characters) — the markdown
 * parser had encoded it. The vault's slug set holds only the decoded form (21
 * characters), so it never matches.
 *
 * **ASCII slugs were fine because there was nothing to encode.** So this defect is
 * visible only in vaults using Korean (or space-containing, or non-ASCII) slugs — our
 * samples are ASCII, so nobody saw it. This gate guards that blind spot.
 */
describe('wikilink resolution withstands percent encoding and normalization', () => {
  it('the viewer decodes the slug', () => {
    expect(decodeWikilinkSlug(encodeURIComponent('capabilities/스윕-검증-절차'))).toBe('capabilities/스윕-검증-절차');
  });

  it('the viewer aligns to NFC, removing the state where the characters are the same but the strings differ', () => {
    const slug = 'sources/원문.md';
    expect(decodeWikilinkSlug(encodeURIComponent(slug.normalize('NFD')))).toBe(slug.normalize('NFC'));
  });

  it('a decode failure does not kill the document; a truncated percent sequence is left as the original', () => {
    expect(decodeWikilinkSlug('sources/100%.md')).toBe('sources/100%.md');
  });
});
