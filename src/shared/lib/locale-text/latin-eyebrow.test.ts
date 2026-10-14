import { describe, expect, it } from 'vitest';
import { isLatinScriptLocale, latinEyebrowClass } from './latin-eyebrow';

describe('latinEyebrowClass keeps Latin-only decoration off Hangul', () => {
  it('the English locale keeps the eyebrow, a normal signal in Latin', () => {
    expect(latinEyebrowClass('en', 'tracking-[0.2em]')).toBe(
      'font-mono uppercase tracking-[0.2em]',
    );
    expect(latinEyebrowClass('en-US')).toBe('font-mono uppercase');
  });

  it('the Korean locale drops mono, uppercase and wide tracking entirely', () => {
    // Hangul has no capitalisation, so only the tracking widens; and under mono
    // Hangul falls back, leaving only the spaces monospaced — the reason
    // 「First run」 read as 「First  run」.
    expect(latinEyebrowClass('ko', 'tracking-[0.2em]')).toBe('');
    expect(latinEyebrowClass('ko-KR')).toBe('');
  });

  it('the script decision ignores the region subtag', () => {
    expect(isLatinScriptLocale('en-GB')).toBe(true);
    expect(isLatinScriptLocale('KO')).toBe(false);
    // An unregistered locale is conservatively treated as non-Latin: applying
    // the decoration wrongly costs more than omitting it, because it breaks
    // legibility.
    expect(isLatinScriptLocale('ja')).toBe(false);
  });
});
