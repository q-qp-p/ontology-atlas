import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '@/entities/knowledge-graph';
import kinds from '../../../../../messages/en/kinds.json';
import pages from '../../../../../messages/en/ontologyPages.json';
import type { AnalysisPair } from '../../lib/analysis-model';
import { DependencyDiagram } from './DependencyDiagram';
import { orderDeclarations } from './declaration-layout';

const node = (id: string): KnowledgeGraphNode => ({ id, title: id, kind: 'capability' }) as KnowledgeGraphNode;
const edge = (from: string, to: string): KnowledgeGraphEdge => ({ id: `${from}>${to}`, from, to, type: 'depends_on', projectIds: [], evidenceIds: [], lastApprovedAt: new Date(0), lastApprovedBy: '' });
const edges = [edge('a1', 'b1'), edge('a1', 'b2'), edge('a2', 'b1'), edge('a2', 'b3'), edge('a3', 'b4'), edge('a3', 'b5'), edge('a4', 'b4')];
const byId = new Map(['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4', 'b5', 'A', 'B'].map(id => [id, node(id)]));
const pair: AnalysisPair = { id: 'A\0B', from: byId.get('A')!, to: byId.get('B')!, edges };

function Harness() {
  const [selected, setSelected] = useState(orderDeclarations(edges)[0]);
  return <DependencyDiagram pair={pair} selected={selected} byId={byId} onSelect={setSelected} />;
}

const mount = () => render(<NextIntlClientProvider locale="en" messages={{ kinds, ontologyPages: pages }}><Harness /></NextIntlClientProvider>);
const step = () => screen.getByTestId('analysis-declaration-step');

describe('dependency diagram', () => {
  it('steps onto the next page while a card is hovered without losing the drawing', () => {
    mount();
    fireEvent.pointerEnter(document.querySelector('[data-dependency-node="from:a1"]')!);
    for (let index = 0; index < 4; index++) fireEvent.click(screen.getByRole('button', { name: 'Next declaration' }));
    expect(step()).toHaveTextContent('Declaration 5 of 7 · a3 → b5');
    expect(step()).toHaveAttribute('aria-live', 'polite');
    expect(document.querySelector('[data-dependency-node="from:a3"]')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('analysis-dependency-diagram')).toBeInTheDocument();
  });

  it('selects the declaration a line draws', () => {
    mount();
    fireEvent.click(document.querySelector('[data-testid="analysis-witness"][data-edge="a2>b3"]')!);
    expect(step()).toHaveTextContent('Declaration 4 of 7');
    expect(document.querySelector('[data-dependency-node="from:a2"]')).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-dependency-node="to:b3"]')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps keyboard focus in place when a press reaches the last declaration', () => {
    mount();
    const next = screen.getByRole('button', { name: 'Next declaration' });
    next.focus();
    for (let index = 0; index < 7; index++) fireEvent.click(next);
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(next).toHaveFocus();
    expect(step()).toHaveTextContent('Declaration 7 of 7');
  });
});
