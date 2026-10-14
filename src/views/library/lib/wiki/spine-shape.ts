import type { LibraryWikiPage, LibraryWriteUpLink } from "@/entities/docs-vault";

/**
 * `stale`: a cited source moved or no hash was recorded; compile again. `unverified`: nothing has
 * measured this page against a file, so it is never shown as fresh. `fresh`: a citation was measured
 * and none is behind; partial reading is the source row's to carry.
 */
export type SpineFreshness = "stale" | "unverified" | "fresh";

/**
 * One page's freshness, from the crossings the library model already derived.
 *
 * `writeUpsBySource` is `LibraryModel.pairing.writeUpsBySource`: source path → the wiki
 * pages citing it, each with how **that page** stands to the bytes. Reading the page's
 * own entry rather than the source row's state matters, because the source row is
 * deliberately generous — two pages may cover one document and one of them may be older,
 * and the source is still covered. Each index row speaks for one page.
 */
export function spineFreshness({
  page,
  writeUpsBySource,
}: {
  page: Pick<LibraryWikiPage, "slug" | "sourcePaths">;
  writeUpsBySource: ReadonlyMap<string, readonly LibraryWriteUpLink[]>;
}): SpineFreshness {
  if (page.sourcePaths.length === 0) return "unverified";
  let measured = 0;
  for (const path of page.sourcePaths) {
    const link = (writeUpsBySource.get(path) ?? []).find((entry) => entry.slug === page.slug);
    // No crossing at all means the folder holds no such file. The page's claim is
    // unprovable rather than wrong, so it is not counted as measured either.
    if (!link) continue;
    if (link.freshness === "behind") return "stale";
    if (link.freshness === "unchecked") continue;
    measured += 1;
  }
  return measured > 0 ? "fresh" : "unverified";
}
