import { describe, expect, it } from 'vitest';
import type { KnowledgeGraphEdge } from '@/entities/knowledge-graph';
import { ARROW_SIZE, arrowPoints, declarationLines, declarationPages, labelPoints, orderDeclarations, type CardBox } from './declaration-layout';

const edge = (from: string, to: string): KnowledgeGraphEdge => ({ id: `${from}>${to}`, from, to, type: 'depends_on', projectIds: [], evidenceIds: [], lastApprovedAt: new Date(0), lastApprovedBy: '' });
const card = (top: number, left: number): CardBox => ({ top, bottom: top + 64, left, right: left + 300 });

describe('declaration layout', () => {
  const recorded = [edge('cli', 'validate'), edge('mcp', 'guidance'), edge('mcp', 'safety'), edge('mcp', 'validate'), edge('mcp', 'graph')];

  it('keeps each recorded page and reads it in the order lines leave their sources', () => {
    const [first, second] = declarationPages(recorded);
    expect(first.sources).toEqual(['cli', 'mcp']);
    expect(first.targets).toEqual(['validate', 'guidance', 'safety']);
    expect(first.edges.map(item => item.id)).toEqual(['cli>validate', 'mcp>validate', 'mcp>guidance', 'mcp>safety']);
    expect(second.edges.map(item => item.id)).toEqual(['mcp>graph']);
    expect(orderDeclarations(recorded)[0].id).toBe('cli>validate');
  });

  it('gives every declaration its own port, fanned by the height of the far end, with the arrow tip on the target edge', () => {
    const { edges } = declarationPages(recorded)[0];
    const boxes = new Map([['from:cli', card(0, 0)], ['from:mcp', card(264, 0)], ['to:validate', card(0, 500)], ['to:guidance', card(132, 500)], ['to:safety', card(264, 500)]]);
    const lines = declarationLines(edges, boxes);
    const starts = lines.map(line => `${line.x1},${line.y1}`);
    expect(new Set(starts).size).toBe(lines.length);
    expect(lines.filter(line => line.id.startsWith('mcp>')).map(line => line.y1)).toEqual([286, 296, 306]);
    expect(lines.filter(line => line.id.endsWith('>validate')).map(line => line.y2)).toEqual([27, 37]);
    expect(lines.map(line => line.y1)).toEqual([...lines.map(line => line.y1)].sort((a, b) => a - b));
    for (const line of lines) expect(arrowPoints(line).split(' ')[1]).toBe(`${line.x2},${line.y2}`);
    expect(ARROW_SIZE).toBe(8);
  });

  it('moves a numeral along its curve only when it would cover another', () => {
    const crossing = [{ id: 'a', x1: 0, y1: 0, x2: 208, y2: 200 }, { id: 'b', x1: 0, y1: 200, x2: 208, y2: 0 }];
    const [a, b] = labelPoints(crossing);
    expect(a).toMatchObject({ x: 100, y: 100 });
    expect(Math.abs(a.x - b.x) >= 28 || Math.abs(a.y - b.y) >= 20).toBe(true);
  });
});
