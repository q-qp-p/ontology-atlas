
import { describe, it, expect } from 'vitest';
import { cn, LEADING_RAMP_STEPS, RADIUS_RAMP_STEPS, TYPE_RAMP_STEPS } from './cn';
import { readGlobalCss } from '../../../scripts/lib/design/global-css.mjs';

/**
 * Ramp steps are derived from `app/globals.css`, not a hardcoded list, so a new step is in scope the
 * moment it exists.
 */
function rampStepsFromCss(prefix: 'text' | 'leading' | 'radius'): string[] {
  const css = readGlobalCss();
  const found = new Set<string>();
  const re = new RegExp(`^\\s*--${prefix}-([a-z0-9-]+):`, 'gm');
  for (const m of css.matchAll(re)) {
    const step = m[1];
    if (step.endsWith('--line-height')) continue;
    found.add(step);
  }
  return [...found].sort();
}

describe('cn', () => {
  it('joins string classes', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('skips falsy values', () => {
    expect(cn('a', false, 'b', null, undefined, 'c')).toBe('a b c');
  });

  it('merges conflicting tailwind utilities (later wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles conditional object form', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });
});

/**
 * A custom ramp step classified as a colour conflicts with `text-[color:...]` and the size is
 * dropped silently.
 */
describe('cn: type ramp coexists with color utilities', () => {
  it('**the registered list matches the ramp**, since a missing entry becomes a silent size drop', () => {
    // Add a step to `globals.css` without registering it here and
    // tailwind-merge misclassifies it as a colour, dropping the size against a
    // following `text-[color:…]`. The class string still looks correct.
    expect([...TYPE_RAMP_STEPS].sort()).toEqual(rampStepsFromCss('text'));
  });

  it('actually reads the ramp, because an empty scan is a defect rather than a pass', () => {
    // If the path or the regex drifts, the comparison above passes as
    // `[] === []`. An empty scan is a failure, not a pass.
    expect(rampStepsFromCss('text').length).toBeGreaterThanOrEqual(8);
    expect(rampStepsFromCss('leading').length).toBeGreaterThanOrEqual(8);
  });

  it.each([...TYPE_RAMP_STEPS])(
    'text-%s survives after text-[color:...] too',
    (step) => {
      const out = cn(`text-${step}`, 'text-[color:var(--color-text-tertiary)]');
      expect(out).toContain(`text-${step}`);
      expect(out).toContain('text-[color:var(--color-text-tertiary)]');
    },
  );

  it('later values still win between steps of the same ramp', () => {
    expect(cn('text-label', 'text-body')).toBe('text-body');
  });

  it('later values win between colors too (existing behavior preserved)', () => {
    expect(cn('text-[color:red]', 'text-[color:blue]')).toBe('text-[color:blue]');
  });
});

/**
 * Different failure mode from the type ramp: an unregistered `leading-*` step is
 * not dropped, both survive, and CSS source order decides — a conditional
 * override losing non-deterministically. Quieter than a dropped size, and not
 * diagnosable by looking at the screen.
 */
describe('cn: line-height ramp conflict merging', () => {
  it('**the registered list matches the ramp**, since a missing entry becomes a merge failure', () => {
    expect([...LEADING_RAMP_STEPS].sort()).toEqual(rampStepsFromCss('leading'));
  });

  it.each([
    ['leading-body', 'leading-prose'],
    ['leading-caption', 'leading-label'],
    ['leading-display', 'leading-display-tight'],
    ['leading-title', 'leading-body-lg'],
  ])('when %s is followed by %s the later one wins', (first, second) => {
    expect(cn(first, second)).toBe(second);
  });

  it('the later value wins even when a ramp step overlaps an arbitrary line height', () => {
    expect(cn('leading-body', 'leading-[1.9]')).toBe('leading-[1.9]');
    expect(cn('leading-[1.9]', 'leading-prose')).toBe('leading-prose');
  });

  /*
   * These use named leading utilities that lint forbids: `cn` must still merge correctly if one
   * arrives from third-party code or an old string. Test files are exempt from that lint rule
   * (`codexTestIgnores`).
   */
  it('merging with existing named line-height utilities still holds', () => {
    expect(cn('leading-4', 'leading-label')).toBe('leading-label');
    expect(cn('leading-prose', 'leading-relaxed')).toBe('leading-relaxed');
  });

  it('size and line height do not displace each other (different groups)', () => {
    expect(cn('text-body', 'leading-body')).toBe('text-body leading-body');
  });
});

describe('cn: radius ramp conflict merging', () => {
  it('**the registered list matches the ramp**, since a missing entry becomes a merge failure', () => {
    expect([...RADIUS_RAMP_STEPS].sort()).toEqual(rampStepsFromCss('radius'));
  });

  it('actually reads the ramp, because an empty scan is a defect rather than a pass', () => {
    expect(rampStepsFromCss('radius').length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    ['rounded-chip', 'rounded-micro'],
    ['rounded-micro', 'rounded-chip'],
    ['rounded-card', 'rounded-panel'],
  ])('when %s is followed by %s the later one wins', (first, second) => {
    expect(cn(first, second)).toBe(second);
  });

  it('also merges into one group with the default scale utilities', () => {
    // The idiomatic override — a consumer forcing a pill with `rounded-full` —
    // has to actually win.
    expect(cn('rounded-chip', 'rounded-full')).toBe('rounded-full');
    expect(cn('rounded-full', 'rounded-micro')).toBe('rounded-micro');
  });
});

/**
 * tailwind-merge assumes a size utility also sets line-height, so a **later**
 * `text-<step>` erases an earlier `leading-*`. Before the companion pairing that
 * assumption was false for our ramp: nothing refilled the erased value and the
 * element fell back to an inherited 1.5 — a silent loss. With companions, the
 * utility that erases carries its own pair, making the assumption true. Reverting
 * the companions breaks here first.
 */
describe('cn: a size that comes later absorbs the line height (the companion pairing premise)', () => {
  it('a trailing ramp size absorbs the preceding ramp line height', () => {
    expect(cn('leading-body', 'text-body')).toBe('text-body');
    expect(cn('leading-prose', 'text-title')).toBe('text-title');
  });

  it('keeping the order lets an explicit line height survive (recommended notation)', () => {
    expect(cn('text-title', 'leading-prose')).toBe('text-title leading-prose');
  });
});
