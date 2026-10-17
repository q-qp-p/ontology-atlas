import { WIKI_DIR } from "../library/wiki-page-schema";

/**
 * What a folder holds, read from its files and nothing else.
 *
 * The rail, the landing and the settings row all ask the same question — is this a map,
 * a wiki, or both — and the answer is never stored: a preference could disagree with the
 * files a teammate pulled, and vault Markdown wins every such disagreement
 * (`local-first.md`). The signals are the files a creator writes for each part:
 *
 * - **map** — any `kind:` node outside `wiki/`. `project.md` alone is enough, which is
 *   what "start the map" writes; the vault README is not a node.
 * - **wiki** — anything under `wiki/`, the `_template.md` furniture included, which is
 *   what "start a wiki" writes before there is a page.
 *
 * Neither means an empty folder, or no folder: the shell shows everything then.
 */
export interface VaultShape {
  map: boolean;
  wiki: boolean;
}

export interface VaultShapeDoc {
  slug: string;
  frontmatter?: Record<string, unknown> | null;
}

/** How many documents a folder holds, and how many of them are concepts. */
export interface VaultContents {
  docCount: number;
  conceptCount: number;
}

/** The kinds the map draws; every "N concepts" count, here and in `canonical-census.ts`, uses it. */
export const MAP_CONCEPT_KINDS: ReadonlySet<string> = new Set(["project", "domain", "capability", "element"]);

/**
 * Counts what a folder holds, for a row that has to say what is inside a folder it is
 * offering to open. `conceptCount` is the map's census, so a row and the map agree.
 *
 * `docCount` is every document the walk parsed, wiki pages included, because that is
 * what the rest of the product already calls a document count (the header chip's
 * `{count} documents` reads `manifest.docs.length`).
 */
export function countVaultContents(docs: ReadonlyArray<VaultShapeDoc>): VaultContents {
  let conceptCount = 0;
  for (const doc of docs) {
    if (doc.slug.startsWith(`${WIKI_DIR}/`)) continue;
    const kind = doc.frontmatter?.kind;
    if (typeof kind === "string" && MAP_CONCEPT_KINDS.has(kind)) conceptCount += 1;
  }
  return { docCount: docs.length, conceptCount };
}

export function describeVaultShape(docs: ReadonlyArray<VaultShapeDoc>): VaultShape {
  let map = false;
  let wiki = false;
  for (const doc of docs) {
    if (doc.slug.startsWith(`${WIKI_DIR}/`)) {
      wiki = true;
      continue;
    }
    const kind = doc.frontmatter?.kind;
    if (typeof kind === "string" && kind.trim() !== "" && kind !== "vault-readme") map = true;
    if (map && wiki) break;
  }
  return { map, wiki };
}
