import type { KnowledgeGraphEdge } from '@/entities/knowledge-graph';

export const DECLARATIONS_PER_PAGE = 4;
export const ARROW_SIZE = 8;
const PORT_GAP = 10;
const LABEL_CLEARANCE = { x: 28, y: 20 };
const LABEL_STOPS = [0.5, 0.4, 0.6, 0.3, 0.7];

export interface DeclarationPage { sources: string[]; targets: string[]; edges: KnowledgeGraphEdge[] }
export interface CardBox { top: number; bottom: number; left: number; right: number }
export interface DeclarationLine { id: string; x1: number; y1: number; x2: number; y2: number }

export function declarationPages(edges: readonly KnowledgeGraphEdge[]): DeclarationPage[] {
  const pages: DeclarationPage[] = [];
  for (let start = 0; start < edges.length; start += DECLARATIONS_PER_PAGE) {
    const slice = edges.slice(start, start + DECLARATIONS_PER_PAGE);
    const sources = [...new Set(slice.map(edge => edge.from))];
    const seen = [...new Set(slice.map(edge => edge.to))];
    const meanSourceRow = (id: string) => { const rows = slice.filter(edge => edge.to === id).map(edge => sources.indexOf(edge.from)); return rows.reduce((sum, row) => sum + row, 0) / rows.length; };
    const targets = [...seen].sort((a, b) => meanSourceRow(a) - meanSourceRow(b) || seen.indexOf(a) - seen.indexOf(b));
    const rank = (edge: KnowledgeGraphEdge) => sources.indexOf(edge.from) * slice.length + targets.indexOf(edge.to);
    pages.push({ sources, targets, edges: slice.map((edge, index) => ({ edge, index })).sort((a, b) => rank(a.edge) - rank(b.edge) || a.index - b.index).map(row => row.edge) });
  }
  return pages;
}

export const orderDeclarations = (edges: readonly KnowledgeGraphEdge[]) => declarationPages(edges).flatMap(page => page.edges);

export function declarationLines(edges: readonly KnowledgeGraphEdge[], boxes: ReadonlyMap<string, CardBox>): DeclarationLine[] {
  const middle = (box: CardBox | undefined) => box ? (box.top + box.bottom) / 2 : 0;
  const port = (side: 'from' | 'to', edge: KnowledgeGraphEdge) => {
    const far = side === 'from' ? 'to' : 'from';
    const shared = edges.filter(other => other[side] === edge[side]).sort((a, b) => middle(boxes.get(`${far}:${a[far]}`)) - middle(boxes.get(`${far}:${b[far]}`)) || edges.indexOf(a) - edges.indexOf(b));
    return middle(boxes.get(`${side}:${edge[side]}`)) + (shared.indexOf(edge) - (shared.length - 1) / 2) * PORT_GAP;
  };
  return edges.flatMap(edge => {
    const from = boxes.get(`from:${edge.from}`), to = boxes.get(`to:${edge.to}`);
    return from && to ? [{ id: edge.id, x1: from.right, y1: port('from', edge), x2: to.left, y2: port('to', edge) }] : [];
  });
}

const round = (value: number) => Math.round(value * 10) / 10;

export function curvePath(line: DeclarationLine) {
  const end = line.x2 - ARROW_SIZE, bend = (end - line.x1) * 0.5;
  return `M ${round(line.x1)} ${round(line.y1)} C ${round(line.x1 + bend)} ${round(line.y1)}, ${round(end - bend)} ${round(line.y2)}, ${round(end)} ${round(line.y2)}`;
}

export const arrowPoints = (line: DeclarationLine) => `${round(line.x2 - ARROW_SIZE)},${round(line.y2 - ARROW_SIZE / 2)} ${round(line.x2)},${round(line.y2)} ${round(line.x2 - ARROW_SIZE)},${round(line.y2 + ARROW_SIZE / 2)}`;

function pointAt(line: DeclarationLine, t: number) {
  const end = line.x2 - ARROW_SIZE, bend = (end - line.x1) * 0.5, u = 1 - t;
  const x = u ** 3 * line.x1 + 3 * u * u * t * (line.x1 + bend) + 3 * u * t * t * (end - bend) + t ** 3 * end;
  const y = (u ** 3 + 3 * u * u * t) * line.y1 + (3 * u * t * t + t ** 3) * line.y2;
  return { x: round(x), y: round(y) };
}

export function labelPoints(lines: readonly DeclarationLine[]) {
  const placed: { id: string; x: number; y: number }[] = [];
  for (const line of lines) {
    const stops = LABEL_STOPS.map(t => pointAt(line, t));
    const free = stops.find(point => placed.every(other => Math.abs(other.x - point.x) >= LABEL_CLEARANCE.x || Math.abs(other.y - point.y) >= LABEL_CLEARANCE.y));
    placed.push({ id: line.id, ...(free ?? stops[0]) });
  }
  return placed;
}
