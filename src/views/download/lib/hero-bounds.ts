const GAP_PX = 8;

function topWithin(element: HTMLElement, ancestor: HTMLElement): number {
  let y = 0;
  for (let node: HTMLElement | null = element; node && node !== ancestor; node = node.offsetParent as HTMLElement | null) {
    y += node.offsetTop;
  }
  return y;
}

export function heroBounds(stage: HTMLElement, caption: HTMLElement | null): { right: number; bottom: number } | null {
  const section = stage.closest('section');
  const facts = section?.querySelector<HTMLElement>('[data-testid="gateway-facts"]');
  if (!section || !caption || !facts) return null;
  return {
    right: section.clientWidth - Number.parseFloat(getComputedStyle(section).paddingRight),
    bottom: Math.min(topWithin(caption, section), topWithin(facts, section)) - GAP_PX,
  };
}
