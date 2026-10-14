import { describe, expect, it } from 'vitest';

import { deriveArchitectureProfiles } from '@/entities/architecture-profile';
import {
  filterDocsByCollection,
  isArchitectureProfile,
} from '@/views/docs-vault/lib/docs-vault-collection';
import dogfoodManifest from '../../../src/entities/docs-vault/data/manifest.json';
import storefrontManifest from '../../../src/entities/docs-vault/data/sample-storefront.manifest.json';
import ko from '../../../messages/ko.json';
import en from '../../../messages/en.json';

type Doc = { slug: string; frontmatter: Record<string, unknown> };
const docsOf = (manifest: unknown): Doc[] =>
  ((manifest as { docs?: Doc[] }).docs ?? []) as Doc[];

/**
 * A rail tab must have something to show: the default `storefront` sample needs a profile, else the
 * tab is empty for first-time visitors.
 */
describe('architecture tab — a tab on the rail must have something to show', () => {
  it('both samples hold at least one profile', () => {
    for (const [name, manifest] of [
      ['dogfood', dogfoodManifest],
      ['storefront', storefrontManifest],
    ] as const) {
      const docs = docsOf(manifest);
      expect(docs.length, `${name} manifest must not be empty`).toBeGreaterThan(0);
      const profiles = deriveArchitectureProfiles(docs);
      expect(
        profiles.length,
        `${name} has no architecture profile, so /architecture is empty for anyone on that sample`,
      ).toBeGreaterThan(0);
    }
  });

  /*
   * ⚠️ The default is the one that matters. Somebody who has never chosen a sample is exactly the
   * person the empty state was failing, so pinning only the dogfood side would leave the measured
   * defect green.
   */
  it('the sample a person with no saved choice sees also has a profile', () => {
    const profiles = deriveArchitectureProfiles(docsOf(storefrontManifest));
    expect(profiles.map((profile) => profile.slug)).toContain('storefront-services');
  });

  /*
   * A profile is not a Map node: no `kind:`, `uid` or `relates` (`docs/ARCHITECTURE.md`); the schema
   * alone must not make it one.
   */
  it('the profile is not a map node — it has neither kind nor uid', () => {
    const everyDoc = [...docsOf(dogfoodManifest), ...docsOf(storefrontManifest)];
    const profiles = everyDoc.filter(
      (doc) => doc.frontmatter?.architecture_schema === 'architecture-profile/v1',
    );
    expect(profiles.length, 'there must be profiles to check').toBeGreaterThan(0);
    for (const profile of profiles) {
      expect(profile.frontmatter.kind, `${profile.slug} must not carry a kind`).toBeUndefined();
      expect(profile.frontmatter.uid, `${profile.slug} must not carry a graph uid`).toBeUndefined();
    }
  });

  /*
   * A profile is listed in Docs but is never what Docs auto-opens: first in its folder it would open a
   * frontmatter record and drop `<main>` below the floor in `a11y-vault-backed.spec.ts`.
   */
  it('the document library list has the profile — the record decided so', () => {
    for (const [name, manifest] of [
      ['dogfood', dogfoodManifest],
      ['storefront', storefrontManifest],
    ] as const) {
      const docs = docsOf(manifest) as Array<
        Parameters<typeof filterDocsByCollection>[0][number] & { slug: string }
      >;
      const listed = filterDocsByCollection(docs, 'all');
      const profiles = listed.filter((doc) =>
        isArchitectureProfile(doc as { frontmatter: Record<string, unknown> }),
      );
      expect(profiles.length, `${name} hides its profile from Docs`).toBeGreaterThan(0);
    }
  });

  /*
   * ⚠️ And the part that was actually measured: a profile must never be the document Docs opens
   * on its own. This is the assertion that keeps `<main>` above its floor.
   */
  it('a document the library opens by itself is not a profile', () => {
    for (const [name, manifest] of [
      ['dogfood', dogfoodManifest],
      ['storefront', storefrontManifest],
    ] as const) {
      const docs = docsOf(manifest) as Array<
        Parameters<typeof filterDocsByCollection>[0][number] & { slug: string }
      >;
      for (const collection of ['all', 'guides', 'ontology'] as const) {
        const listed = filterDocsByCollection(docs, collection);
        if (listed.length === 0) continue;
        const opened = listed.find(
          (doc) => !isArchitectureProfile(doc as { frontmatter: Record<string, unknown> }),
        );
        /*
         * `undefined` is a pass, and the storefront sample's guides collection is exactly that
         * case: its only member is the profile, so there is nothing to read and Docs opens
         * nothing rather than falling back to the record it must not open.
         */
        if (!opened) continue;
        expect(
          isArchitectureProfile(opened as { frontmatter: Record<string, unknown> }),
          `${name}/${collection} would open a profile unattended`,
        ).toBe(false);
      }
    }
  });

  /*
   * The empty state for a genuinely empty vault must not name the schema or ask the reader to
   * write the document by hand.
   */
  it('the empty state does not name the schema and does not tell the user to write by hand', () => {
    for (const [locale, messages] of [
      ['ko', ko],
      ['en', en],
    ] as const) {
      // ⚠️ `architecture` holds nested objects (`modes`, `patternLabels`), so a
      // `Record<string, string>` cast does not describe it. Only the three strings are read.
      const architecture = messages.architecture;
      const body: string = architecture.noProfilesBody;
      expect(body, `${locale} body must exist`).toBeTruthy();
      expect(body, `${locale} must not name the schema at a stranger`).not.toContain(
        'architecture-profile/v1',
      );
      expect(
        `${String(architecture.noProfiles)} ${body}`.toLowerCase(),
        `${locale} must not tell somebody to author frontmatter by hand`,
      ).not.toMatch(/markdown|frontmatter/);
    }
  });
});
