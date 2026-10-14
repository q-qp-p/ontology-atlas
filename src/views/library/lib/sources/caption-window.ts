/**
 * Shows the part of the line the person searched for: the caption fits about 33 characters, so the
 * window moves to the phrase. Text is only left out, with a leading ellipsis. The cut starts
 * `LEAD_CHARS` early and snaps back to a space within `WORD_SNAP_CHARS`, never mid-word.
 */

/** What one caption line shows, measured at the index column's width. */
const CAPTION_VISIBLE_CHARS = 33;

/** Words of run-up kept before the matched phrase. */
const LEAD_CHARS = 8;

/** How far back the cut may walk to land on a word boundary rather than inside a word. */
const WORD_SNAP_CHARS = 12;

/** The leading mark that says text was left out. Typography, not a sentence. */
const ELLIPSIS = "…";

export function captionWindow(text: string, needle: string): string {
  if (!needle) return text;
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  // Not found (a path match), or already inside the budget: the line stands as it is.
  if (at < 0 || at <= CAPTION_VISIBLE_CHARS) return text;
  let cut = at - LEAD_CHARS;
  const boundary = text.lastIndexOf(" ", cut);
  if (boundary >= 0 && cut - boundary <= WORD_SNAP_CHARS) cut = boundary + 1;
  return `${ELLIPSIS}${text.slice(cut)}`;
}
