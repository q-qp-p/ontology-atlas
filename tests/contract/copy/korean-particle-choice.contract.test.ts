import { describe, expect, it } from 'vitest';

import ko from '../../../messages/ko.json';

/**
 * Parenthesised particle pairs ship to the reader because ICU cannot choose by the interpolated
 * value final sound; rephrase instead. Checks the Korean catalogue only.
 */
const AMBIGUOUS_PARTICLE = /(을\(를\)|를\(을\)|이\(가\)|가\(이\)|은\(는\)|는\(은\)|와\(과\)|과\(와\)|으로\(로\)|로\(으로\))/;

function* everyString(node: unknown, path: string[] = []): Generator<{ path: string; text: string }> {
  if (typeof node === 'string') {
    yield { path: path.join('.'), text: node };
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      yield* everyString(value, [...path, key]);
    }
  }
}

describe('Korean copy does not defer the particle to parentheses', () => {
  it('no copy hands an undecided particle such as "eul(reul)" to the reader', () => {
    const offenders = [...everyString(ko)]
      .filter((entry) => AMBIGUOUS_PARTICLE.test(entry.text))
      .map((entry) => `${entry.path}: ${entry.text}`);
    expect(offenders, 'copy that ships to the screen without choosing a particle').toEqual([]);
  });

  it('the checker really catches that shape', () => {
    // A gate with no subjects prints a pass; this one is held to a planted example.
    expect(AMBIGUOUS_PARTICLE.test('{name}을(를) 지울까요?')).toBe(true);
    expect(AMBIGUOUS_PARTICLE.test('{name}에 썼습니다.')).toBe(false);
  });
});
