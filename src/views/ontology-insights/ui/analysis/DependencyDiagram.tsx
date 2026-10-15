'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useOntologyKindLabel } from '@/entities/ontology-class';
import { Button, Chip, OntologyMapKindGlyph } from '@/shared/ui';
import { controlClass } from '@/shared/ui/control-class';
import type { KnowledgeGraphNode, KnowledgeGraphEdge } from '@/entities/knowledge-graph';
import type { AnalysisPair } from '../../lib/analysis-model';
import { DECLARATIONS_PER_PAGE as PAGE, arrowPoints, curvePath, declarationLines, declarationPages, labelPoints, type CardBox, type DeclarationLine } from './declaration-layout';
import styles from './analysis.module.css';

type Hover = { side: 'from' | 'to' | 'edge'; id: string } | null;
const name = (node: KnowledgeGraphNode) => node.display ?? node.title;
export const declarationNumeral = (index: number) => String(index + 1).padStart(2, '0');
/** Each line is one exact declaration. Ports follow measured DOM nodes, including wrapped labels. */
export function DependencyDiagram({ pair, selected, byId, onSelect }: {
  pair: AnalysisPair; selected: KnowledgeGraphEdge; byId: ReadonlyMap<string, KnowledgeGraphNode>; onSelect: (edge: KnowledgeGraphEdge) => void;
}) {
  const t = useTranslations('ontologyPages.insights.analysis');
  const kindLabel = useOntologyKindLabel();
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const focusPage = useRef(false);
  const pages = useMemo(() => declarationPages(pair.edges), [pair.edges]);
  const pageIndex = Math.max(0, pages.findIndex(page => page.edges.some(edge => edge.id === selected.id)));
  const pageStart = pageIndex * PAGE;
  const { sources, targets, edges } = pages[pageIndex] ?? { sources: [], targets: [], edges: [] };
  const paged = pair.edges.length > PAGE;
  const [hover, setHover] = useState<Hover>(null);
  const [trail, setTrail] = useState({ current: selected.id, leaving: null as string | null });
  if (trail.current !== selected.id) setTrail({ current: selected.id, leaving: edges.some(edge => edge.id === trail.current) ? trail.current : null });
  useLayoutEffect(() => {
    if (focusPage.current) { controls.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true }); focusPage.current = false; }
  }, [pageStart]);
  function pageTo(index: number) { focusPage.current = true; onSelect(pages[index]!.edges[0]!); }
  const [lines, setLines] = useState<DeclarationLine[]>([]);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      const origin = element.getBoundingClientRect();
      const boxes = new Map<string, CardBox>([...element.querySelectorAll<HTMLElement>('[data-dependency-node]')].map(node => { const box = node.getBoundingClientRect(); return [node.dataset.dependencyNode!, { top: box.top - origin.top, bottom: box.bottom - origin.top, left: box.left - origin.left, right: box.right - origin.left }]; }));
      const next = declarationLines(edges, boxes);
      setLines(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('[data-dependency-node]').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [edges]);
  const labels = useMemo(() => labelPoints(lines), [lines]);
  const numeralOf = (id: string) => declarationNumeral(pageStart + edges.findIndex(edge => edge.id === id));
  const hot = (edge: KnowledgeGraphEdge) => hover !== null && edge.id !== selected.id && (hover.side === 'edge' ? hover.id === edge.id : edge[hover.side] === hover.id);
  const lineOf = (id: string | null) => lines.find(line => line.id === id);
  const active = lineOf(selected.id), leaving = lineOf(trail.leaving);
  const hoverProps = (next: Hover) => ({ onPointerEnter: () => setHover(next), onPointerLeave: () => setHover(null), onFocus: () => setHover(next), onBlur: () => setHover(null) });
  function nodes(ids: string[], side: 'from' | 'to') {
    return ids.map(id => {
      const node = byId.get(id)!;
      const pressed = selected[side] === id;
      const declarations = edges.filter(edge => edge[side] === id);
      return <button type="button" key={id} data-dependency-node={`${side}:${id}`} aria-pressed={pressed} {...hoverProps({ side, id })}
        aria-label={`${t('selectNodeDeclaration', { name: name(node) })} · ${t('nodeDeclarations', { count: declarations.length })}`} title={t('selectNodeDeclaration', { name: name(node) })} onClick={() => onSelect(declarations[0])}
        className={controlClass({ hoverBorder: 'strong', shape: 'card', size: 'lg', tone: pressed ? 'accentOnTint' : 'default', active: pressed, className: 'atlas-touch-floor w-full text-left' })}>
        <span className={styles.nodeContent}>
          <span className={styles.nodeKind}><span className="inline-flex items-center gap-1.5"><OntologyMapKindGlyph kind={node.kind} size={14} />{kindLabel(node.kind)}</span><span className="tabular-nums">{pressed ? `${t('selected')} · ` : null}{t('declarationsInView', { count: declarations.length })}</span></span>
          <span className="text-title font-[var(--font-weight-strong)]">{name(node)}</span>
        </span>
      </button>;
    });
  }
  return <div className={styles.dependencyObject} data-testid="analysis-dependency-diagram">
    <div className={styles.objectHeading}><span>{name(pair.from)}</span><span>{t('dependencyDirection')}</span><span>{name(pair.to)}</span></div>
    <div className={styles.witnessBar} data-paged={paged}>
      <div ref={controls} role="group" className={styles.witnessControls} data-rows={Math.ceil(pages[0]!.edges.length / 2)} aria-label={t('chooseDeclaration')}>
        {edges.map((edge, index) => {
          const on = edge.id === selected.id;
          return <Chip key={edge.id} data-testid="analysis-witness" data-edge={edge.id} size="lg" tone={on ? 'accentOnTint' : 'default'} active={on} hoverSurface="lift" hoverInk="strong" aria-pressed={on} className="atlas-touch-floor w-full justify-start gap-2 text-left" onClick={() => onSelect(edge)} {...hoverProps({ side: 'edge', id: edge.id })}>
            <span className={on ? styles.stepNumeralOn : styles.stepNumeral}>{declarationNumeral(pageStart + index)}</span>
            <span className="min-w-0 font-[var(--font-weight-signature)]">{name(byId.get(edge.from)!)} → {name(byId.get(edge.to)!)}</span>
          </Chip>;
        })}
      </div>
      {paged ? <div className={styles.pager}>
        <span className="font-mono text-label tabular-nums text-[color:var(--color-text-tertiary)]" title={t('declarationRange', { from: pageStart + 1, to: pageStart + edges.length, total: pair.edges.length })}>{t('declarationPage', { from: pageStart + 1, to: pageStart + edges.length, total: pair.edges.length })}</span>
        <Button variant="ghost" size="sm" className="atlas-touch-floor" disabled={pageIndex === 0} onClick={() => pageTo(pageIndex - 1)}>{t('previousDeclarations')}</Button>
        <Button variant="ghost" size="sm" className="atlas-touch-floor" disabled={pageIndex + 1 >= pages.length} onClick={() => pageTo(pageIndex + 1)}>{t('nextDeclarations')}</Button>
      </div> : null}
    </div>
    <div ref={host} className={styles.nodeDiagram} data-paged={paged}>
      <svg className={styles.connections} aria-hidden="true">
        {lines.map(line => <g key={line.id} data-edge={line.id} className={hot(edges.find(edge => edge.id === line.id)!) ? styles.hotConnection : styles.connection}>
          <path pathLength={1} className="structure-link-in" d={curvePath(line)} />
          <polygon className={`structure-link-in ${styles.arrowLand}`} points={arrowPoints(line)} />
          <circle className="insights-disclosure-in" cx={line.x1} cy={line.y1} r="2.5" />
        </g>)}
        {leaving ? <g key={`out:${leaving.id}`} className={`overlay-fade-only ${styles.selectionOut}`} data-state="closed" onAnimationEnd={() => setTrail(value => ({ ...value, leaving: null }))}>
          <path pathLength={1} d={curvePath(leaving)} /><polygon points={arrowPoints(leaving)} /><circle cx={leaving.x1} cy={leaving.y1} r="2.5" />
        </g> : null}
        {active ? <g key={`on:${active.id}`} data-connection="selected" data-edge={active.id} className={styles.selectedConnection}>
          <path pathLength={1} className="structure-link-in" d={curvePath(active)} />
          <polygon className={`structure-link-in ${styles.arrowLand}`} points={arrowPoints(active)} />
          <circle className="insights-disclosure-in" cx={active.x1} cy={active.y1} r="2.5" />
        </g> : null}
      </svg>
      <div key={`from:${pageStart}`} className={`insights-disclosure-in ${styles.objectColumn}`}>{nodes(sources, 'from')}</div><div /><div key={`to:${pageStart}`} className={`insights-disclosure-in ${styles.objectColumn} ${styles.targetColumn}`}>{nodes(targets, 'to')}</div>
      {labels.map(label => <span key={label.id} aria-hidden="true" data-testid="analysis-curve-label" data-edge={label.id} data-state={label.id === selected.id ? 'selected' : hot(edges.find(edge => edge.id === label.id)!) ? 'hot' : 'rest'} className={`insights-disclosure-in ${styles.curveLabel}`} style={{ left: label.x, top: label.y }}>{numeralOf(label.id)}</span>)}
    </div>
  </div>;
}
