import { describe, expect, it } from 'vitest';

import { SETTINGS_SECTIONS } from '@/widgets/app-settings-menu/model/settings-sections';

import en from '../../../messages/en.json';
import ko from '../../../messages/ko.json';

/**
 * Guidance that points at a settings section must name one that exists. Checks the relation (the name
 * inside the quotes is a `section.*` value), not the wording.
 */

/** 「X」 field · “X” section · section 「X」 — the shapes a "go to that section" instruction takes. */
const SECTION_REFERENCE_PATTERNS = [
  /[「“]([^」”]+)[」”]\s*(?:칸|section)/gu,
  /(?:섹션|section)\s*[「“]([^」”]+)[」”]/gu,
] as const;

type Bundle = Record<string, unknown>;

/**
 * Guidance may point at a sheet section or a section of the agent destination, so both tables are
 * valid sets; each has its own floor below.
 */
function sheetSectionNames(bundle: Bundle): Set<string> {
  const nav = (bundle.nav as Bundle | undefined)?.settingsMenu as Bundle | undefined;
  const section = nav?.section as Record<string, string> | undefined;
  return new Set(Object.values(section ?? {}));
}

/**
 * Section headings a destination renders on screen. Two namespaces, `agents` and `mcp`, because
 * those screens are separate.
 */
const DESTINATION_NAMESPACES = ['agents', 'mcp'] as const;

function destinationSectionNames(bundle: Bundle): Set<string> {
  return new Set(
    DESTINATION_NAMESPACES.flatMap((namespace) =>
      Object.entries((bundle[namespace] as Record<string, string> | undefined) ?? {})
        .filter(([key]) => key.endsWith('Heading'))
        .map(([, value]) => value),
    ),
  );
}

function sectionNames(bundle: Bundle): Set<string> {
  return new Set([...sheetSectionNames(bundle), ...destinationSectionNames(bundle)]);
}

function sectionReferences(bundle: Bundle): Array<{ key: string; name: string }> {
  const out: Array<{ key: string; name: string }> = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      for (const pattern of SECTION_REFERENCE_PATTERNS) {
        for (const match of node.matchAll(pattern)) {
          out.push({ key: path, name: match[1].trim() });
        }
      }
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
    }
  };
  walk(bundle, '');
  return out;
}

describe.each([
  ['ko', ko as unknown as Bundle],
  ['en', en as unknown as Bundle],
])('guidance that points at a settings section: %s', (_locale, bundle) => {
  const names = sectionNames(bundle);
  const refs = sectionReferences(bundle);

  it('the list of settings section names is not empty', () => {
    // If this is empty, every check below passes while measuring nothing.
    expect(names.size).toBeGreaterThan(5);
  });

  /*
   * **Each table gets its own floor.** Counting only the union hides one table
   * disappearing entirely behind the other's number — the "a total covers the hole"
   * shape this repository has repeatedly hit with gates.
   */
  it('each of the two tables is non-empty, so a total cannot hide the loss of one', () => {
    expect(sheetSectionNames(bundle).size, 'the sheet has 0 section names').toBeGreaterThan(5);
    expect(
      destinationSectionNames(bundle).size,
      'the destination (Agents and MCP) has 0 section titles',
    ).toBeGreaterThan(1);
  });

  /*
   * ⚠️ **The second most important check here.** With zero pieces of pointing
   * guidance the main check iterates an empty array and is always green. Today's
   * measurement is 2 (the runtimes degradation card and the chat launch-failure
   * notice); if guidance is deleted, lower this line with it.
   */
  it('the guidance that points really exists, otherwise the main check spins idle', () => {
    // One runtimes degradation card points at a destination section; lower this line if it is deleted.
    expect(refs.length).toBeGreaterThanOrEqual(1);
  });

  it('every section pointed at really exists', () => {
    const missing = refs.filter((ref) => !names.has(ref.name));
    expect(
      missing.map((ref) => `${ref.key} → 「${ref.name}」`),
      'there is guidance that points at a settings section that does not exist',
    ).toEqual([]);
  });
});

describe('both languages point at the same place', () => {
  it('the referenced translation keys are the same, since fixing only one side leaves the other stale', () => {
    const keys = (bundle: Bundle) => sectionReferences(bundle).map((r) => r.key).sort();
    expect(keys(ko as unknown as Bundle)).toEqual(keys(en as unknown as Bundle));
  });
});

/*
 * The set of `section.*` keys in messages must equal the set of items the menu renders, so a
 * translation left behind after removing a section is caught.
 */
describe('every section.* key is a section that is really drawn', () => {
  const renderedItems = [...SETTINGS_SECTIONS];

  it('the items extraction does not spin idle, since with 0 the checks below measure nothing', () => {
    expect(renderedItems.length).toBeGreaterThan(5);
  });

  it.each([
    ['ko', ko as unknown as Bundle],
    ['en', en as unknown as Bundle],
  ])('the section.* key set of %s == SETTINGS_SECTIONS', (_locale, bundle) => {
    const nav = (bundle.nav as Bundle | undefined)?.settingsMenu as Bundle | undefined;
    const keys = Object.keys((nav?.section as Record<string, string>) ?? {}).sort();
    expect(keys).toEqual([...renderedItems].sort());
  });
});
