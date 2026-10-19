'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/shared/ui';
import { ICON_SIZE } from '@/shared/ui/tokens/icon-size';
import { controlClass } from '@/shared/ui/control-class';
import { EXIT_WINDOW_MS } from '@/shared/lib/render-timing/use-presence';
import type { KnowledgeGraphNode, KnowledgeGraphEdge } from '@/entities/knowledge-graph';
import type { AnalysisPair } from '../../lib/analysis-model';
import { arrowPoints, curvePath, declarationLines, declarationPages, type CardBox, type DeclarationLine, type DeclarationPage } from './declaration-layout';
import styles from './analysis.module.css';

type Hover = { side: 'from' | 'to' | 'edge'; id: string } | null;
interface Drawing { key: string; pairId: string; page: DeclarationPage; selectedId: string; lines: DeclarationLine[] }
const name = (node: KnowledgeGraphNode) => node.display ?? node.title;
const EMPTY_PAGE: DeclarationPage = { sources: [], targets: [], edges: [] };
const NO_LINES: DeclarationLine[] = [];
/** Each line is one exact declaration. Ports follow measured DOM nodes, including wrapped labels. */
export function DependencyDiagram({ pair, selected, byId, onSelect }: {
  pair: AnalysisPair; selected: KnowledgeGraphEdge; byId: ReadonlyMap<string, KnowledgeGraphNode>; onSelect: (edge: KnowledgeGraphEdge) => void;
}) {
  const t = useTranslations('ontologyPages.insights.analysis');
  const host = useRef<HTMLDivElement>(null);
  const stepper = useRef<HTMLDivElement>(null);
  const stepperFocus = useRef<'previous' | 'next' | null>(null);
  const pages = useMemo(() => declarationPages(pair.edges), [pair.edges]);
  const ordered = useMemo(() => pages.flatMap(page => page.edges), [pages]);
  const selectedIndex = Math.max(0, ordered.findIndex(edge => edge.id === selected.id));
  const pageIndex = Math.max(0, pages.findIndex(page => page.edges.some(edge => edge.id === selected.id)));
  const page = pages[pageIndex] ?? EMPTY_PAGE;
  const pageKey = `${pair.id}\0${pageIndex}`;
  const [hover, setHover] = useState<Hover>(null);
  const [measured, setMeasured] = useState<{ key: string; lines: DeclarationLine[] }>({ key: pageKey, lines: NO_LINES });
  const lines = measured.key === pageKey ? measured.lines : NO_LINES;
  const drawing: Drawing = { key: pageKey, pairId: pair.id, page, selectedId: selected.id, lines };
  const [shown, setShown] = useState<{ drawing: Drawing; leavingPage: Drawing | null; leavingLine: DeclarationLine | null }>({ drawing, leavingPage: null, leavingLine: null });
  if (shown.drawing.key !== pageKey) {
    setHover(null);
    setShown({ drawing, leavingPage: shown.drawing.pairId === pair.id ? { ...shown.drawing, lines: measured.key === shown.drawing.key ? measured.lines : NO_LINES } : null, leavingLine: null });
  } else if (shown.drawing.selectedId !== selected.id) setShown({ drawing: { ...shown.drawing, selectedId: selected.id }, leavingPage: shown.leavingPage, leavingLine: lines.find(line => line.id === shown.drawing.selectedId) ?? null });
  useEffect(() => {
    if (!shown.leavingPage && !shown.leavingLine) return;
    const id = setTimeout(() => setShown(value => ({ ...value, leavingPage: null, leavingLine: null })), EXIT_WINDOW_MS);
    return () => clearTimeout(id);
  }, [shown.leavingPage, shown.leavingLine]);
  useLayoutEffect(() => {
    const side = stepperFocus.current;
    stepperFocus.current = null;
    if (side) stepper.current?.querySelector<HTMLButtonElement>(`[data-step="${side}"]`)?.focus();
  }, [selectedIndex]);
  function step(delta: 1 | -1) {
    const next = selectedIndex + delta;
    if (next === 0 || next === ordered.length - 1) stepperFocus.current = delta > 0 ? 'previous' : 'next';
    onSelect(ordered[next]!);
  }
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      const origin = element.getBoundingClientRect();
      const boxes = new Map<string, CardBox>([...element.querySelectorAll<HTMLElement>('[data-dependency-node]')].map(node => { const box = node.getBoundingClientRect(); return [node.dataset.dependencyNode!, { top: box.top - origin.top, bottom: box.bottom - origin.top, left: box.left - origin.left, right: box.right - origin.left }]; }));
      const next = declarationLines(page.edges, boxes);
      setMeasured(previous => previous.key === pageKey && JSON.stringify(previous.lines) === JSON.stringify(next) ? previous : { key: pageKey, lines: next });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('[data-dependency-node]').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [page, pageKey]);
  const hot = (id: string) => {
    const edge = page.edges.find(candidate => candidate.id === id);
    return Boolean(edge && hover && id !== selected.id && (hover.side === 'edge' ? hover.id === id : edge[hover.side] === hover.id));
  };
  const active = lines.find(line => line.id === selected.id);
  const rows = Math.max(1, ...pages.map(entry => Math.max(entry.sources.length, entry.targets.length)));
  const hoverProps = (next: Hover) => ({ onPointerEnter: () => setHover(next), onPointerLeave: () => setHover(null), onFocus: () => setHover(next), onBlur: () => setHover(null) });
  function cards(drawing: Pick<Drawing, 'page' | 'selectedId'>, side: 'from' | 'to', live: boolean) {
    const chosen = drawing.page.edges.find(edge => edge.id === drawing.selectedId);
    return (side === 'from' ? drawing.page.sources : drawing.page.targets).map(id => {
      const node = byId.get(id)!;
      const pressed = chosen?.[side] === id;
      const declarations = drawing.page.edges.filter(edge => edge[side] === id);
      const tags = live ? { 'data-dependency-node': `${side}:${id}`, 'aria-pressed': pressed, 'aria-label': `${t('selectNodeDeclaration', { name: name(node) })} · ${t('nodeDeclarations', { count: declarations.length })}`, title: t('selectNodeDeclaration', { name: name(node) }), onClick: () => onSelect(declarations[0]!), ...hoverProps({ side, id }) } : { tabIndex: -1, 'data-pressed': pressed };
      return <button type="button" key={id} {...tags}
        className={controlClass({ hoverBorder: 'strong', shape: 'card', size: 'lg', tone: pressed ? 'accentOnTint' : 'default', active: pressed, className: `atlas-touch-floor w-full text-left${pressed && side === 'to' ? ' structure-link-arrival' : ''}` })}>
        <span className={`${styles.nodeName} text-title font-[var(--font-weight-strong)]`}>{name(node)}</span>
      </button>;
    });
  }
  const connection = (line: DeclarationLine, className: string, animate: boolean) => <g key={line.id} data-edge={line.id} className={className}>
    <path pathLength={1} className={animate ? 'structure-link-in' : undefined} d={curvePath(line)} />
    <polygon className={animate ? 'structure-link-land' : undefined} points={arrowPoints(line)} />
    <circle className={animate ? 'motion-swap-in' : undefined} cx={line.x1} cy={line.y1} r="2.5" />
  </g>;
  const leaving = shown.leavingPage;
  return <div className={styles.dependencyObject} data-testid="analysis-dependency-diagram">
    <div ref={host} className={styles.nodeDiagram} style={{ '--declaration-rows': rows } as CSSProperties}>
      <svg className={styles.connections} aria-hidden="true">
        {leaving ? <g className="motion-swap-out">{leaving.lines.map(line => connection(line, line.id === leaving.selectedId ? styles.selectedConnection : styles.connection, false))}</g> : null}
        {lines.map(line => connection(line, hot(line.id) ? styles.hotConnection : styles.connection, true))}
        {shown.leavingLine ? <g key={`out:${shown.leavingLine.id}`} className={`structure-link-out ${styles.selectedConnection}`}>{connection(shown.leavingLine, '', false)}</g> : null}
        {active ? <g key={`on:${active.id}`} data-connection="selected" className={styles.selectedConnection}>{connection(active, '', true)}</g> : null}
        {lines.map(line => <path key={`hit:${line.id}`} data-testid="analysis-witness" data-edge={line.id} data-state={line.id === selected.id ? 'selected' : 'rest'} className={styles.lineHit} d={curvePath(line)} onClick={() => onSelect(page.edges.find(edge => edge.id === line.id)!)} {...hoverProps({ side: 'edge', id: line.id })} />)}
      </svg>
      {leaving ? <>
        <div key={`out-from:${leaving.key}`} inert aria-hidden="true" className={`motion-swap-out ${styles.objectColumn} ${styles.sourceColumn}`}>{cards(leaving, 'from', false)}</div>
        <div key={`out-to:${leaving.key}`} inert aria-hidden="true" className={`motion-swap-out ${styles.objectColumn} ${styles.targetColumn}`}>{cards(leaving, 'to', false)}</div>
      </> : null}
      <div key={`from:${pageKey}`} className={`motion-swap-in ${styles.objectColumn} ${styles.sourceColumn}`}>{cards({ page, selectedId: selected.id }, 'from', true)}</div>
      <div key={`to:${pageKey}`} className={`motion-swap-in ${styles.objectColumn} ${styles.targetColumn}`}>{cards({ page, selectedId: selected.id }, 'to', true)}</div>
    </div>
    {ordered.length > 1 ? <div ref={stepper} role="group" aria-label={t('chooseDeclaration')} className={styles.stepper}>
      <IconButton data-step="previous" label={t('previousDeclaration')} size="lg" tone="muted" hoverInk="strong" hoverSurface="lift" className="atlas-touch-floor" disabled={selectedIndex === 0} onClick={() => step(-1)}><ChevronLeft size={ICON_SIZE.lg} aria-hidden /></IconButton>
      <span data-testid="analysis-declaration-step" className="font-mono text-label tabular-nums text-[color:var(--color-text-tertiary)]">{t('declarationStep', { index: selectedIndex + 1, total: ordered.length })}</span>
      <IconButton data-step="next" label={t('nextDeclaration')} size="lg" tone="muted" hoverInk="strong" hoverSurface="lift" className="atlas-touch-floor" disabled={selectedIndex + 1 >= ordered.length} onClick={() => step(1)}><ChevronRight size={ICON_SIZE.lg} aria-hidden /></IconButton>
    </div> : null}
  </div>;
}
