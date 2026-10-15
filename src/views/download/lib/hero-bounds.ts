const GAP_PX = 8;
const CAPTION_GAP_PX = 24;
const GUTTER_PX = 48;

function offsetWithin(element: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let node: HTMLElement | null = element; node && node !== ancestor; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y };
}

export interface HeroBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function heroBounds(stage: HTMLElement, caption: HTMLElement | null): HeroBox | null {
  const section = stage.closest('section');
  const facts = section?.querySelector<HTMLElement>('[data-testid="gateway-facts"]');
  const text = section?.querySelector<HTMLElement>('[data-hero-text]');
  const head = section?.querySelector('h1')?.parentElement;
  if (!section || !caption || !facts || !text || !head) return null;
  const textAt = offsetWithin(text, section);
  const captionTop = offsetWithin(facts, section).y - CAPTION_GAP_PX - caption.offsetHeight;
  caption.style.top = `${captionTop}px`;
  caption.style.bottom = 'auto';
  return {
    left: textAt.x + text.offsetWidth + GUTTER_PX,
    right: section.clientWidth - Number.parseFloat(getComputedStyle(section).paddingRight),
    top: offsetWithin(head, section).y + Number.parseFloat(getComputedStyle(head).paddingTop),
    bottom: captionTop - GAP_PX,
  };
}

export function releaseCaption(caption: HTMLElement | null): void {
  caption?.style.removeProperty('top');
  caption?.style.removeProperty('bottom');
}
