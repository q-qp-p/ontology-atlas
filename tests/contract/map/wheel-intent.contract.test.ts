import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * A map inside a scrolling document must not swallow the page wheel: `preventDefault()` must come
 * after the page-scroll early return. The defect is the order of two statements, which no single
 * lint selector can express.
 */
describe('wheel intent: a map inside a scrolling document', () => {
  const handlers = read('src/widgets/ontology-map/ui/input/topology-pointer-zoom.ts');

  it('under page-scroll intent it bails out before preventDefault', () => {
    const start = handlers.indexOf('const handleWheel');
    expect(start).toBeGreaterThan(-1);
    const body = handlers.slice(start, start + 900);

    const bail = body.indexOf('wheelIntent === "page-scroll"');
    const prevent = body.indexOf('e.preventDefault()');

    expect(bail).toBeGreaterThan(-1);
    expect(prevent).toBeGreaterThan(-1);
    // The order is the whole contract. Invert it and the trap returns.
    expect(bail).toBeLessThan(prevent);
  });

  it('an explicit pinch still zooms, and only a plain wheel yields to the page', () => {
    const start = handlers.indexOf('const handleWheel');
    const body = handlers.slice(start, start + 900);
    // Dropping `!e.ctrlKey` kills zoom entirely on the gateway (the opposite regression).
    expect(body).toMatch(/wheelIntent === "page-scroll" && !e\.ctrlKey/);
  });

  it('a vertical swipe follows the same contract, with touch-action tracking the intent', () => {
    const widget = read('src/widgets/ontology-map/ui/OntologyMap.tsx');
    // `none` swallows vertical swipes too, so the page does not move at all on a phone.
    expect(widget).toMatch(/wheelIntent === "page-scroll" \? "pan-y" : "none"/);
  });

  it('the workbench keeps the current behavior by default', () => {
    expect(handlers).toMatch(/wheelIntent = "zoom"/);
    const widget = read('src/widgets/ontology-map/ui/OntologyMap.tsx');
    expect(widget).toMatch(/wheelIntent = "zoom"/);
  });

  it('the workbench never passes page-scroll', () => {
    // The workbench (HomePage) does not pass it — doing so would kill map zoom.
    const home = read('src/views/home/ui/HomePage.tsx');
    expect(home).not.toMatch(/wheelIntent/);
  });
});
