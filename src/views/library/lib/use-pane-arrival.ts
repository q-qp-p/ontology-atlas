import { useEffect, type RefObject } from "react";

import { MOTION } from "@/shared/motion";

/** The rise a pane arrives with: small enough to read as the same place, not a new screen. */
const ARRIVAL_RISE_PX = 6;

/**
 * The pane arrives instead of appearing: opacity and a 6px rise on `--motion-base`; under reduced
 * motion crossfade only. The first render does not animate. Nothing remounts.
 */
export function usePaneArrival(ref: RefObject<HTMLElement | null>, key: string): void {
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof node.animate !== "function") return;
    if (!node.dataset.paneArrivalSeen) {
      node.dataset.paneArrivalSeen = key;
      return;
    }
    if (node.dataset.paneArrivalSeen === key) return;
    node.dataset.paneArrivalSeen = key;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const [x1, y1, x2, y2] = MOTION.base.ease;
    const animation = node.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translateY(${ARRIVAL_RISE_PX}px)` },
            { opacity: 1, transform: "none" },
          ],
      {
        duration: MOTION.base.duration * 1000,
        easing: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
      },
    );
    return () => animation.cancel();
  }, [ref, key]);
}
