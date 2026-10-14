import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  bundledProjectSlugs,
  deriveBundledProjects,
  deriveProjectsFromVault,
  resolveStaticVaultSource,
} from '@/entities/docs-vault';

/**
 * Every project node in every bundled sample needs its own route address, and the route files must
 * use the enumeration function; the function check alone does not catch a single-manifest regression.
 */

const PROJECT_ROUTE_FILES = [
  'app/[locale]/project/[slug]/page.tsx',
  'app/[locale]/project/[slug]/edit/page.tsx',
  'app/[locale]/project/[slug]/opengraph-image.tsx',
];

describe('bundled sample project route full-set contract', () => {
  it('the full set holds the project slugs of both dogfood and storefront', () => {
    const slugs = bundledProjectSlugs();

    for (const source of ['dogfood', 'storefront'] as const) {
      const fromSource = deriveProjectsFromVault(resolveStaticVaultSource(source).manifest);
      // If a sample has a project node, its slug must be in the enumeration.
      expect(fromSource.length, `the ${source} sample has no kind: project document`).toBeGreaterThan(0);
      for (const project of fromSource) {
        expect(slugs, `${project.slug} of ${source} is missing from the static route full set`).toContain(
          project.slug,
        );
      }
    }
  });

  it('the full set has no duplicate slug (the same address is not made twice)', () => {
    const slugs = bundledProjectSlugs();
    expect(slugs).toEqual([...new Set(slugs)]);
  });

  it('every slug of the full set resolves to a real Project (metadata and body attach)', () => {
    const projects = deriveBundledProjects();
    const resolved = new Set(projects.map((p) => p.slug));
    for (const slug of bundledProjectSlugs()) {
      expect(resolved, `${slug} has a route but no Project (it falls to notFound)`).toContain(
        slug,
      );
    }
  });

  it('the project route file uses the full-set function (it does not go back to a single manifest)', () => {
    const offenders: string[] = [];
    for (const rel of PROJECT_ROUTE_FILES) {
      const source = readFileSync(path.join(process.cwd(), rel), 'utf8');
      if (!source.includes('bundledProjectSlugs')) {
        offenders.push(`${rel}: does not use bundledProjectSlugs()`);
      }
      if (/deriveProjectsFromVault\s*\(/.test(source)) {
        offenders.push(`${rel}: derives directly from a single manifest`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
