import { describe, expect, it } from "vitest";

import manifest from "@/entities/docs-vault/data/sample-storefront.manifest.json";

/**
 * The sample vault is the only data a first-time visitor sees, and `pnpm vault:validate` scans
 * only the dogfood vault. The generated manifest is read so source and parser are checked together.
 */

interface SampleDoc {
  frontmatter?: Record<string, unknown>;
}

const DOCS = (manifest as { docs?: SampleDoc[] }).docs ?? [];

/** Frontmatter keys that point at slugs — one pointing nowhere breaks the graph. */
const REFERENCE_KEYS = [
  "capabilities",
  "elements",
  "domains",
  "dependencies",
  "relates",
  "domain",
] as const;

const asList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value == null ? [] : [value]).filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );

describe("sample vault integrity", () => {
  it("really reads the documents, so it does not pass on an empty manifest", () => {
    expect(DOCS.length, "could not read a single sample vault document, so this test spins idle").toBeGreaterThan(
      100,
    );
  });

  it("every reference points at a slug that exists", () => {
    const slugs = new Set(
      DOCS.map((doc) => doc.frontmatter?.slug).filter(
        (slug): slug is string => typeof slug === "string",
      ),
    );
    expect(slugs.size, "could not collect a single slug").toBeGreaterThan(100);

    const broken: string[] = [];
    for (const doc of DOCS) {
      const frontmatter = doc.frontmatter ?? {};
      for (const key of REFERENCE_KEYS) {
        for (const ref of asList(frontmatter[key])) {
          if (!slugs.has(ref)) broken.push(`${String(frontmatter.slug)} → ${key}: ${ref}`);
        }
      }
    }
    expect(broken, `the sample vault points at slugs that do not exist:\n${broken.join("\n")}`).toEqual([]);
  });

  it("uids do not collide, since colliding turns two nodes into one", () => {
    const uids = DOCS.map((doc) => doc.frontmatter?.uid).filter(
      (uid): uid is string => typeof uid === "string",
    );
    expect(uids.length, "could not collect a single uid").toBeGreaterThan(100);
    const seen = new Set<string>();
    const duplicates = uids.filter((uid) => (seen.has(uid) ? true : (seen.add(uid), false)));
    expect(duplicates, `duplicate uids: ${duplicates.join(" · ")}`).toEqual([]);
  });

  /**
   * Measures the spread of domain composition ratios rather than pinning a value: an evenly built
   * sample leaves nothing to point out in the demo.
   */
  it("the domain composition is spread out, since a flat sample makes the product look weak", () => {
    const byDomain = new Map<string, { capability: number; element: number }>();
    for (const doc of DOCS) {
      const frontmatter = doc.frontmatter ?? {};
      const kind = frontmatter.kind;
      if (kind !== "capability" && kind !== "element") continue;
      for (const domain of asList(frontmatter.domain)) {
        const bucket = byDomain.get(domain) ?? { capability: 0, element: 0 };
        bucket[kind === "capability" ? "capability" : "element"] += 1;
        byDomain.set(domain, bucket);
      }
    }
    expect(byDomain.size, "could not collect a single domain").toBeGreaterThan(4);

    const ratios = [...byDomain.values()]
      .filter((b) => b.capability + b.element > 0)
      .map((b) => b.capability / (b.capability + b.element));
    const spread = Math.max(...ratios) - Math.min(...ratios);
    expect(
      Number(spread.toFixed(2)),
      `The shares are bunched between ${(Math.min(...ratios) * 100).toFixed(0)}% and ${(Math.max(...ratios) * 100).toFixed(0)}%. ` +
        "When the sample is this even, the domain bars say nothing in the demo.",
    ).toBeGreaterThanOrEqual(0.4);
  });
});
