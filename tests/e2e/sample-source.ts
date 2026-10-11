import type { Page } from '@playwright/test';

/** Where the first-run card's sample choice is stored — the same key as `src/shared/lib/vault-folder/sample-source.ts`. */
const SAMPLE_SOURCE_KEY = 'demo:sample-source:v1';

/**
 * Declares that this spec runs against the dogfood sample (this app's own code map). A test's
 * subject is "this works on dogfood data", not "the default is dogfood". Call before `goto`.
 */
export async function useDogfoodSample(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* Private mode — it falls back to the default and the spec fails on its own */
      }
    },
    [SAMPLE_SOURCE_KEY, 'dogfood'] as const,
  );
}
