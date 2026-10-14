import { describe, expect, it } from 'vitest';

import { resolveStaticVaultSource } from '@/entities/docs-vault';
import {
  capabilitiesWithoutImplementationEvidence,
  computeVaultHealth,
} from '@/entities/knowledge-graph/lib/vault-health';
import { chatSuggestions } from '@/features/acp-session/model/chat-suggestions/chat-suggestions';
import { suggestionDisplayNames } from '@/features/acp-session/model/chat-suggestions/use-chat-suggestions';

/**
 * Locks that suggestions still point at things in this folder when they run
 * through the **real vault**.
 *
 * **Why unit tests are not enough.** `chat-suggestions.test.ts` locks "given
 * these facts, what is suggested" and `AcpChatPanel.test.tsx` locks "does the
 * screen draw it and is it clickable". Both can be green while the screen shows
 * nothing — between them lies the **data path**, and a break there (health
 * returning a different shape, or our vault simply not having such a fact) is
 * invisible to both.
 *
 * So this runs the whole chain: **real vault manifest → health computation →
 * suggestions**. Not invented input, but the vault we look at every day
 * (dogfooding).
 *
 * **Locked**: the path does not break · at least one suggestion always appears ·
 * when a suggestion names a slug, that slug is **a node that exists**.
 *
 * **Not locked**: how many islands our vault has right now. That changes with
 * every vault edit, so pinning it turns red with no defect present.
 */

const manifest = resolveStaticVaultSource('dogfood').manifest;

function suggestionsForRealVault() {
  const health = computeVaultHealth(manifest.docs);
  const unevidenced = capabilitiesWithoutImplementationEvidence(manifest.docs);
  const displayNames = suggestionDisplayNames(manifest.docs, 'ko');
  return {
    health,
    unevidenced,
    displayNames,
    out: chatSuggestions({
      nodeCount: health.summary.nodes,
      islands: health.islands,
      missingContainment: health.missingContainment,
      unevidenced,
      displayNames,
    }),
  };
}

describe('suggestions point at this folder even when passed through the real vault', () => {
  it('the check is not idling — the vault to look at exists', () => {
    expect(manifest.docs.length).toBeGreaterThan(50);
    const { health } = suggestionsForRealVault();
    expect(health.summary.nodes).toBeGreaterThan(50);
  });

  it('the path does not break — at least one suggestion always appears', () => {
    const { out } = suggestionsForRealVault();
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it('suggestions that point at a slug point at a **real node**', () => {
    const { out, displayNames } = suggestionsForRealVault();
    const known = new Set(manifest.docs.map((d) => d.slug));
    const slugKeys = new Set(['first', 'slug', 'domain']);
    const labelSourceKey = { firstLabel: 'first', slugLabel: 'slug', domainLabel: 'domain' } as const;
    for (const s of out) {
      for (const [key, value] of Object.entries(s.params)) {
        if (typeof value !== 'string') continue;
        if (slugKeys.has(key)) {
          expect(
            known.has(value),
            `${s.kind}.${key} points at "${value}", which is not in the vault`,
          ).toBe(true);
          continue;
        }
        if (key in labelSourceKey) {
          const sourceKey = labelSourceKey[key as keyof typeof labelSourceKey];
          const sourceSlug = s.params[sourceKey];
          expect(typeof sourceSlug).toBe('string');
          expect(value).toBe(displayNames[String(sourceSlug)]);
        }
      }
    }
  });

  it('one defect that really exists in our vault surfaces as a suggestion', () => {
    const { out, health, unevidenced } = suggestionsForRealVault();
    // If this vault has anything to fix, "explain" must not be the only suggestion —
    // if it is, the material never reached the screen.
    const hasWork =
      health.islands.length > 0 ||
      health.missingContainment.length > 0 ||
      unevidenced.length > 0;
    if (!hasWork) return; // A perfect vault leaves nothing to check
    expect(
      out.some((s) => s.kind !== 'explain'),
      'there is something to fix yet the only suggestion is "explain it"',
    ).toBe(true);
  });
});
