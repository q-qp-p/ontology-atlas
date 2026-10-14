import { describe, expect, it } from 'vitest';

import { NEXT_STEP_MAX_CHARS, splitNextStep } from '@/features/vault-agent/model/next-step';
import { PRODUCT_DISCIPLINE } from '@/features/vault-agent/model/system-prompt';

/**
 * `next-step.ts` lifts the `NEXT:` line verbatim onto a chip, so only the `PRODUCT_DISCIPLINE`
 * instruction shapes it. The cap it quotes is read from the enforcing code and the example is run
 * through the real splitter; no sentence is pinned.
 */

/** The paragraph that governs the chip. Isolated so a failure names the right thing. */
const INSTRUCTION = PRODUCT_DISCIPLINE.split('\n').find((line) =>
  line.includes('starts with `NEXT:`'),
);

/**
 * The words this repository uses to talk to itself. The instruction has to name
 * them, because a model cannot avoid a vocabulary nobody listed.
 */
const INTERNAL_WORDS = ['canonical', 'evidence gap', 'containment', 'handoff', 'receipt'] as const;

describe('NEXT: instruction requires one sentence a person can send as it is', () => {
  it('the check does not spin idle, since it actually found that paragraph in the prompt', () => {
    expect(PRODUCT_DISCIPLINE.length).toBeGreaterThan(2_000);
    expect(INSTRUCTION, 'PRODUCT_DISCIPLINE has no NEXT: paragraph').toBeDefined();
  });

  it('reads the length cap from code, so two places cannot drift apart', () => {
    expect(INSTRUCTION).toContain(`${NEXT_STEP_MAX_CHARS} characters or fewer`);
  });

  /**
   * The example is the only part a model copies literally, so it must survive the
   * real pipeline: the splitter has to recognise it, and the result has to obey
   * every rule the same paragraph states.
   */
  it('the example inside the instruction passes its own rule', () => {
    const example = /`(NEXT: [^`]+)`/.exec(INSTRUCTION ?? '')?.[1];
    expect(example, 'the instruction has no NEXT: example').toBeDefined();

    const { nextStep } = splitNextStep(`Some answer.\n\n${example}`);
    expect(nextStep, 'splitNextStep does not pick up the example').toBeTruthy();
    expect(nextStep!.length).toBeLessThanOrEqual(NEXT_STEP_MAX_CHARS);
    expect(nextStep, 'the example was truncated and got an ellipsis').not.toContain('…');
    expect(nextStep).not.toContain('[[');
    for (const word of INTERNAL_WORDS) {
      expect(nextStep!.toLowerCase(), `the example uses the internal term "${word}"`).not.toContain(word);
    }
    // One sentence: exactly one terminator, and it ends the line.
    expect(nextStep!.replace(/[.?!]$/, '')).not.toMatch(/[.?!]/);
  });
});
