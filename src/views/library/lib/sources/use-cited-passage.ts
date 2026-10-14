import { useEffect, useState } from 'react';

import { citedPassage, type CitedPassage } from '@/shared/lib/library/source-passage';

/**
 * Reads one file because a person pressed the citation that names it: only that path, through an
 * already granted handle, nothing kept (dropped when the citation changes or the pane closes),
 * nothing sent. The sha256 is offered as measured just now; `crypto.subtle` needs a secure context.
 */

export interface CitedPassageState {
  path: string;
  anchor: string;
  /** `reading` while the bytes are in flight; `failed` when the file could not be read. */
  phase: 'reading' | 'ready' | 'failed';
  passage: CitedPassage | null;
  /** The reader's own message, shown as the reason — never a guessed passage. */
  error: string | null;
  /** sha256 of exactly the bytes this read used, when the platform could measure it. */
  hash: string | null;
}

async function digestHex(bytes: ArrayBuffer): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // A browser outside a secure context refuses; the row keeps the fact it had.
    return null;
  }
}

export function useCitedPassage({
  citation,
  handle,
  enabled,
}: {
  /** The citation the person pressed, or null when they arrived at the file another way. */
  citation: { path: string; anchor?: string } | null;
  /** The handle the folder walk granted for that path, if the folder holds the file. */
  handle: FileSystemFileHandle | undefined;
  enabled: boolean;
}): CitedPassageState | null {
  const [state, setState] = useState<CitedPassageState | null>(null);
  const path = citation?.path ?? null;
  const anchor = citation?.anchor ?? null;
  const wanted = enabled && path && anchor ? `${path}#${anchor}` : null;

  useEffect(() => {
    if (!wanted || !path || !anchor || !handle) return;
    let live = true;
    void (async () => {
      try {
        const file = await handle.getFile();
        const bytes = await file.arrayBuffer();
        const passage = citedPassage(new Uint8Array(bytes), path, anchor);
        const hash = await digestHex(bytes);
        if (!live) return;
        setState({ path, anchor, phase: 'ready', passage, error: null, hash });
      } catch (error) {
        if (!live) return;
        setState({
          path,
          anchor,
          phase: 'failed',
          passage: null,
          error: error instanceof Error ? error.message : String(error),
          hash: null,
        });
      }
    })();
    return () => {
      // Closing the pane, or pressing a different citation, discards the text. There is
      // no cache to invalidate because there is no cache.
      live = false;
    };
  }, [anchor, handle, path, wanted]);

  if (!wanted || !path || !anchor) return null;
  if (!handle) {
    /*
     * The citation button is only pressable for a path the folder holds
     * (`DocsVaultViewer` renders the unknown case as plain text), so this is the narrow
     * race where the file left the folder between the walk and the press. It is a fact
     * about the folder, not a read that failed, so it needs no state either.
     */
    return { path, anchor, phase: 'failed', passage: null, error: null, hash: null };
  }
  /*
   * `reading` is derived rather than stored. The state this hook keeps is only ever the
   * answer for one citation; while it holds someone else's — or nothing yet — the pane
   * is reading, and saying so needs no render of its own.
   */
  if (!state || `${state.path}#${state.anchor}` !== wanted) {
    return { path, anchor, phase: 'reading', passage: null, error: null, hash: null };
  }
  return state;
}
