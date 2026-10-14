import { describe, expect, it } from 'vitest';

import { chatSuggestions, subjectSuggestions, SUGGESTION_LIMIT } from './chat-suggestions';

/**
 * Locks that a suggestion is **about this folder**.
 *
 * A generic example sentence ("ask me anything") is decoration, not a recommendation — it could be
 * attached to any app, and so carries no value. The single property locked here: **a recommendation
 * about a fact appears only when that fact is actually observed in the current vault.**
 */

const empty = {
  nodeCount: 0,
  islands: [],
  missingContainment: [],
  unevidenced: [],
};

describe('suggestions come only from facts observed in this vault', () => {
  it('suggests "build" for an empty vault: with nothing to fix, it should suggest something to make', () => {
    const out = chatSuggestions({ ...empty, sourceState: 'bound' });
    expect(out[0]?.kind).toBe('bootstrap');
  });

  it('suggests connecting before analysis when a new vault has no code folder', () => {
    const out = chatSuggestions({ ...empty, nodeCount: 5, sourceState: 'unbound' });
    expect(out.map((item) => item.kind)).toEqual(['connectSource']);
  });

  it('does not draw a possibly wrong start button while the source connection is still being read', () => {
    expect(chatSuggestions({ ...empty, nodeCount: 5, sourceState: 'loading' })).toEqual([]);
  });

  it('names the node when there is a disconnected cluster', () => {
    const out = chatSuggestions({
      ...empty,
      nodeCount: 40,
      islands: [['capabilities/invoice', 'capabilities/refund']],
    });
    const island = out.find((s) => s.kind === 'island');
    expect(island).toBeDefined();
    // With no name it is only "something is disconnected somewhere", and that is not a recommendation.
    expect(island?.params.first).toBe('capabilities/invoice');
    expect(island?.params.count).toBe(2);
  });

  it('does not show that suggestion at all when there is no disconnected cluster', () => {
    const out = chatSuggestions({ ...empty, nodeCount: 40 });
    expect(out.some((s) => s.kind === 'island')).toBe(false);
  });

  it('points by name at a node the domain does not reciprocate', () => {
    const out = chatSuggestions({
      ...empty,
      nodeCount: 40,
      missingContainment: [{ slug: 'capabilities/invoice', domain: 'domains/billing' }],
    });
    const fix = out.find((s) => s.kind === 'containment');
    expect(fix?.params.slug).toBe('capabilities/invoice');
    expect(fix?.params.domain).toBe('domains/billing');
  });

  it('keeps the screen name apart from the agent slug', () => {
    const out = chatSuggestions({
      ...empty,
      nodeCount: 40,
      missingContainment: [{ slug: 'elements/checkout-form', domain: 'domains/billing' }],
      displayNames: {
        'elements/checkout-form': '결제 입력 화면',
        'domains/billing': '결제 관리',
      },
    });
    const fix = out.find((suggestion) => suggestion.kind === 'containment');

    expect(fix?.params).toMatchObject({
      slug: 'elements/checkout-form',
      slugLabel: '결제 입력 화면',
      domain: 'domains/billing',
      domainLabel: '결제 관리',
    });
  });

  it('shows the name with the namespace stripped when there is no display name', () => {
    const [island] = chatSuggestions({
      ...empty,
      nodeCount: 40,
      islands: [['capabilities/invoice-review']],
    });
    expect(island.params).toMatchObject({
      first: 'capabilities/invoice-review',
      firstLabel: 'invoice review',
    });
  });

  it('asks to find a capability that has no code evidence when one exists', () => {
    const out = chatSuggestions({
      ...empty,
      nodeCount: 40,
      unevidenced: ['capabilities/invoice', 'capabilities/refund', 'capabilities/payout'],
    });
    const ev = out.find((s) => s.kind === 'evidence');
    expect(ev?.params.first).toBe('capabilities/invoice');
    expect(ev?.params.count).toBe(3);
  });

  it('never leaves empty hands even with no problem, since there is always one thing to ask', () => {
    const out = chatSuggestions({ ...empty, nodeCount: 80 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((s) => s.kind === 'explain')).toBe(true);
  });

  it('offers at most three at once, because too many choices means none is chosen', () => {
    const out = chatSuggestions({
      nodeCount: 40,
      islands: [['a/1', 'a/2'], ['b/1', 'b/2']],
      missingContainment: [
        { slug: 'c/1', domain: 'd/1' },
        { slug: 'c/2', domain: 'd/2' },
      ],
      unevidenced: ['e/1', 'e/2', 'e/3'],
    });
    expect(out.length).toBeLessThanOrEqual(SUGGESTION_LIMIT);
    expect(SUGGESTION_LIMIT).toBe(3);
  });

  it('never suggests the same branch twice, since three slots saying the same thing is one slot', () => {
    const out = chatSuggestions({
      nodeCount: 40,
      islands: [['a/1'], ['b/1'], ['c/1']],
      missingContainment: [],
      unevidenced: [],
    });
    expect(new Set(out.map((s) => s.kind)).size).toBe(out.length);
  });

  it('puts something to fix ahead of "explain it", the hands-on side first', () => {
    const out = chatSuggestions({
      ...empty,
      nodeCount: 40,
      islands: [['a/1', 'a/2']],
    });
    const island = out.findIndex((s) => s.kind === 'island');
    const explain = out.findIndex((s) => s.kind === 'explain');
    expect(island).toBeGreaterThanOrEqual(0);
    expect(explain).toBeGreaterThan(island);
  });

  it('does not suggest fixing in an empty vault, since there is nothing to fix', () => {
    const out = chatSuggestions({
      ...empty,
    // Even if the calculator emitted something for an empty vault (which it cannot), building comes first.
      islands: [['a/1']],
      sourceState: 'bound',
    });
    expect(out[0]?.kind).toBe('bootstrap');
  });
});

describe('a picked concept', () => {
  it('asks about that concept, carrying its record slug for the prompt', () => {
    const out = subjectSuggestions({ slug: 'capabilities/checkout', label: 'Checkout' });
    expect(out.map((suggestion) => suggestion.kind)).toEqual(['explainSubject', 'subjectImpact']);
    expect(out.every((suggestion) => suggestion.params.slug === 'capabilities/checkout' && suggestion.params.subject === 'Checkout')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(SUGGESTION_LIMIT);
  });
});
