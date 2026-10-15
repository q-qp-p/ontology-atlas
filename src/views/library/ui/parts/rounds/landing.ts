import { MOTION } from "@/shared/motion";

const curve = (ease: readonly number[]) => `cubic-bezier(${ease.join(", ")})`;
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const fade = (node: HTMLElement) =>
  node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.fast.duration * 1000, easing: "linear" });

export function landInk(node: HTMLElement | null): void {
  if (!node || typeof node.animate !== "function") return;
  if (reduced()) {
    fade(node);
    return;
  }
  const from = getComputedStyle(node).getPropertyValue("--color-text-quaternary").trim();
  if (from) node.animate([{ color: from }, {}], { duration: MOTION.settle.duration * 1000, easing: curve(MOTION.settle.ease) });
}

export function countIn(node: HTMLElement | null): void {
  if (!node || typeof node.animate !== "function") return;
  if (reduced()) {
    fade(node);
    return;
  }
  node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.fast.duration * 1000, easing: curve(MOTION.fast.ease) });
}
