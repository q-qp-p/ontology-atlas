/**
 * A sha256 on one line with both ends kept: hashes are compared from both ends, and the full value
 * stays in the cell `title`. The kept length is per end so the ends are equal. Never re-derived for
 * display.
 */

/** How many characters of each end survive. 16 keeps 32 of 64 and fits 1040 on one line. */
export const HASH_ELISION_KEPT_PER_END = 16;

/**
 * `value` with its middle replaced by a single ellipsis, or `value` unchanged when
 * eliding it would not make it shorter.
 *
 * Anything that is not a long hash — an empty string, a short digest, a sentence standing
 * in for a hash that was never measured — comes back as it went in, so the caller may pass
 * whatever the row holds without asking first.
 */
export function elideHashMiddle(value: string, keptPerEnd: number = HASH_ELISION_KEPT_PER_END): string {
  if (keptPerEnd <= 0) return value;
  if (value.length <= keptPerEnd * 2 + 1) return value;
  return `${value.slice(0, keptPerEnd)}…${value.slice(-keptPerEnd)}`;
}
