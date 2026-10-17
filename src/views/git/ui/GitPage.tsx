"use client";

import { AtlasGitPanel, useAtlasGitContext } from "@/widgets/atlas-git-panel";

/**
 * The history destination, work you stay in rather than a modal, shown to every audience so the
 * rail's item count never varies. `AtlasGitPanel` is the whole body.
 */
export function GitPage() {
  const { vaultPath, changeset, graph } = useAtlasGitContext();

  return (
    <main
      data-testid="git-page"
      // Takes the shell's height and scrolls inside, or short content collapses the canvas.
      className="flex h-full flex-col overflow-hidden bg-[color:var(--color-canvas)]"
    >
      {/* No width cap: the panel narrows itself; with its 20px inset the title meets `PAGE_FRAME`'s. */}
      <div className="mx-auto flex w-full min-h-0 flex-1 flex-col overflow-hidden pt-1 md:px-5 md:pt-7">
        <AtlasGitPanel
          vaultPath={vaultPath}
          sessionChangeset={changeset}
          graph={graph}
          className="flex-1"
        />
      </div>
    </main>
  );
}
