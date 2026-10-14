import { describe, expect, it } from 'vitest';
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * Exit motion must actually play. Where only the class changes on one element, an unchanged
 * `animation-name` does not restart, and a finished animation with `reverse` and `both` shows its end
 * state at once. Pinned structurally: an exit plays forward under its own name.
 */
const CSS = readGlobalCss();

/** CSS with comments stripped, so explanatory sentences are not mistaken for rules. */
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

describe('exit motion restart contract', () => {
  it('no exit declaration rewinds the entrance keyframes with reverse', () => {
    // The `animation: <entrance name> … reverse` pattern is banned outright. It does
    // work where the element remounts each time, but two idioms coexisting in one
    // file drop the next person into the same trap — exits use one idiom only.
    const offenders = [...CODE.matchAll(/animation[^;]*\breverse\b[^;]*;/g)].map((m) =>
      m[0].replace(/\s+/g, ' ').trim(),
    );
    expect(offenders, `an exit may silently collapse to one frame:\n${offenders.join('\n')}`).toEqual([]);
  });

  /**
   * Derived from the CSS, not a hand list: a disappearing rule has `[data-state="closed"]` or a class
   * ending in `-out`, and its keyframe names are collected as found, so a new surface is covered from
   * the day it lands.
   */
  const definedKeyframes = new Set(
    [...CODE.matchAll(/@keyframes\s+([A-Za-z][\w-]*)/g)].map(([, name]) => name),
  );

  /**
   * ⚠️ One rule can use **more than one** animation — `.topology-chrome-out` really
   * does split movement (`topologyChromeOut`) from opacity (`overlayFadeOut`).
   * Reading only the first name misreports that rule as "does not disappear" (the
   * first version of this scanner did).
   */
  const namesIn = (body: string) =>
    [...body.matchAll(/[A-Za-z][\w-]*/g)].map(([w]) => w).filter((w) => definedKeyframes.has(w));

  const exitRules = [...CODE.matchAll(/([^{}]*(?:\[data-state="closed"\]|-out)\s*)\{([^}]*)\}/g)]
    .map(([, selector, body]) => ({
      selector: selector.trim().split('\n').pop()!.trim(),
      keyframes: /animation:/.test(body) ? namesIn(body) : [],
    }))
    .filter((rule) => rule.keyframes.length > 0);

  /** Names used by entrance rules — an exit reusing one of these will not restart. */
  const enterKeyframes = new Set(
    [...CODE.matchAll(/[^{}]*(?:\[data-state="open"\]|-in)\s*\{([^}]*)\}/g)]
      .flatMap(([, body]) => (/animation:/.test(body) ? namesIn(body) : [])),
  );

  const keyframeBody = (name: string) => {
    const at = CODE.indexOf(`@keyframes ${name}`);
    if (at < 0) return null;
    const open = CODE.indexOf('{', at);
    let depth = 0;
    let i = open;
    for (; i < CODE.length; i += 1) {
      if (CODE[i] === '{') depth += 1;
      else if (CODE[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    return CODE.slice(open + 1, i);
  };

  it('actually finds the disappearing rules in CSS, so it does not pass empty-handed', () => {
    // A drop means a rule disappeared or the scanner went blind.
    expect(exitRules.length, `found only ${exitRules.length} disappearing rules, so the scanner is spinning idle`).toBeGreaterThanOrEqual(6);
    expect(enterKeyframes.size, 'found no entrance rule at all').toBeGreaterThan(2);
  });

  it('disappearing rules do not reuse an entrance name', () => {
    const offenders = exitRules
      .flatMap((rule) =>
        rule.keyframes.filter((name) => enterKeyframes.has(name)).map((name) => `${rule.selector} → ${name}`),
      );
    expect(
      offenders,
      `reusing the entrance name means the animation does not restart on the same element:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('disappearing keyframes really go in the disappearing direction', () => {
    const offenders: string[] = [];
    for (const rule of exitRules) {
      // Judged per rule — if **any one** of several animations disappears, that rule disappears.
      let disappears = false;
      for (const name of rule.keyframes) {
        const body = keyframeBody(name);
        if (body === null) {
          offenders.push(`${rule.selector} → @keyframes ${name} is missing`);
          continue;
        }
        const split = body.indexOf('to');
        const to = split > -1 ? body.slice(split) : '';
        const fades = /opacity:\s*0(?:\D|$)/.test(to);
        const shrinks = /translate|scale/.test(to) && !/opacity:\s*1\s*;?\s*}?\s*$/.test(to);
        if (fades || shrinks) disappears = true;
      }
      if (!disappears) {
        offenders.push(`${rule.selector} → none of ${rule.keyframes.join(' + ')} disappears`);
      }
    }
    expect(offenders, `exits that do not go in the disappearing direction:\n${offenders.join('\n')}`).toEqual([]);
  });
});
