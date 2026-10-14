"use client";

import type { useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import type { AnswerObservation } from '@/features/library';
import type { FailureCopy } from '@/shared/lib/failures/use-failure-sentence';
import { Button, controlClass } from '@/shared/ui';
import { AgentDoor } from '../agent/AgentDoor';

/**
 * One line above the body says what the observation found and the press that acts on it; the rest
 * sits behind a disclosure. `older`, the history state and the error stay outside it since they
 * change what the page is.
 */
export function RetainedAnswerContext({ observation, phase, historyState, older, onRefresh, refreshButtonRef, agentDoor = false, historyBlocked = false, error, t }: {
  observation: AnswerObservation;
  phase: string;
  historyState: string;
  older: boolean;
  onRefresh: (() => void) | null;
  refreshButtonRef?: RefObject<HTMLButtonElement | null>;
  /**
   * Whether `answers.refreshUnavailable` earns a door to `/agents` (slice U2).
   *
   * That sentence names only a connected coding agent, so unlike `stage.blockedNoAgent`
   * it has no second clause the door leaves unanswered. False on the web, where the
   * missing thing is the app itself.
   */
  agentDoor?: boolean;
  /**
   * **The page already knows this press would throw** (installed-app inspection before v1.2.2,
   * B2). A malformed thread edge makes the index card read `answers.version.unresolved` while this block
   * offered the refresh anyway; pressing it threw, and the developer's English landed in the body.
   * Set from the same predicate `prepareAnswerRefresh` refuses on (`answerHistoryUnreadable`), so
   * the two cannot disagree.
   */
  historyBlocked?: boolean;
  /**
   * The translated sentence, and the English fact behind it. Typed rather than `string | null`
   * because `string` is what let `error.message` reach the page body in the first place.
   */
  error: FailureCopy | null;
  t: ReturnType<typeof useTranslations<'library'>>;
}) {
  const working = phase === 'preparing' || phase === 'running' || phase === 'saving';
  const refusable = onRefresh !== null && !historyBlocked;
  const paths = (['changed', 'missing', 'added', 'rewritten'] as const).filter((kind) => observation[kind].length);
  return (
    /*
     * The column is the line: `--measure-doc-column` already ends lines where the body does, so no `ch`
     * cap on each `p`. `[&_p]:[word-break:keep-all]` stops Hangul breaking between syllables; the paths
     * paragraph keeps `break-words` (`overflow-wrap`) for long unspaced paths.
     */
    <section data-testid="retained-answer-context" className="mx-auto mt-4 w-full max-w-[var(--measure-doc-column)] px-6 [&_p]:[word-break:keep-all] md:px-10" aria-label={t('answers.evidence')}>
      <div role="group" aria-label={t('answers.refresh')} className="border-b border-[color:var(--color-divider)] pb-4">
        <p role="status" aria-live="polite" className="sr-only">{working ? t(`answers.phase.${phase}`) : ''}</p>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {/* The group's lede and the observation are one sentence at `text-label`, the grade a sentence
             explaining a control gets (`.claude/rules/design.md`); `id` keeps it the element the refresh is
             described by. */}
          <p
            id="answer-refresh-lede"
            data-testid="answer-evidence-state"
            data-state={observation.state}
            className="min-w-0 flex-1 text-label leading-body text-[color:var(--color-text-secondary)]"
          >
            {t(`answers.state.${observation.state}`)}
          </p>
          <span className="flex flex-none flex-wrap items-center gap-2">
            {/*
             * **The door, beside the reason the disclosure holds** (slice U2). The refresh is
             * disabled without a connected coding agent and `answers.refreshUnavailable` says
             * so; this is the only live control in that state, so it stands first.
             */}
            {agentDoor && onRefresh === null ? <AgentDoor testId="answer-refresh-blocked-door" /> : null}
            <Button
              ref={refreshButtonRef}
              className="atlas-touch-floor max-w-full"
              size="sm"
              variant="outline"
              disabled={working || !refusable}
              /* The reason moves with the control: when the thread edge is broken, the sentence
                 the button is described by is the one that says so, not the observation. */
              aria-describedby={historyBlocked ? 'answer-refresh-blocked-history' : 'answer-refresh-lede'}
              onClick={refusable ? onRefresh ?? undefined : undefined}
              data-testid="answer-refresh-start"
            >{t(working ? `answers.phase.${phase}` : 'answers.refresh')}</Button>
          </span>
        </div>
        {/*
          The paths, the provenance caveat and what a refresh sends — every line that is true
          and none that a reader needs before the answer itself.
        */}
        <details data-testid="answer-evidence-detail" className="mt-2">
          <summary className={controlClass({ shape: 'link', size: 'sm', tone: 'muted', hoverInk: 'strong', className: 'atlas-touch-floor text-label' })}>
            {t('answers.evidenceMore')}
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            {paths.map((kind) => (
              <p key={kind} data-testid={`answer-evidence-paths-${kind}`} className="break-words text-label leading-body text-[color:var(--color-text-tertiary)]">
                {t(`answers.paths.${kind}`)}: {observation[kind].join(' · ')}
              </p>
            ))}
            <p className="text-label leading-body text-[color:var(--color-text-tertiary)]">{t(onRefresh ? 'answers.refreshHint' : 'answers.refreshUnavailable')}</p>
            <p data-testid="answer-provenance" className="text-label leading-body text-[color:var(--color-text-tertiary)]">{t('answers.provenance')}</p>
          </div>
        </details>
        {/* Not behind a press: each of these says the page is not what a reader assumes. */}
        {older ? <p className="mt-2 text-label leading-body text-[color:var(--color-text-tertiary)]">{t('answers.older')}</p> : null}
        {historyState !== 'none' ? <p data-testid="answer-history-state" className="mt-2 text-label leading-body text-[color:var(--color-text-tertiary)]">{t(`answers.history.${historyState}`)}</p> : null}
        {/*
          The reason the press is not offered, on the row that holds the press. It carries the
          index card's own `answers.version.unresolved` opening, so a reader meets one wording for one fact.
        */}
        {historyBlocked ? (
          <p
            id="answer-refresh-blocked-history"
            data-testid="answer-refresh-blocked-history"
            className="mt-2 text-label leading-body text-[color:var(--color-text-tertiary)]"
          >
            {t('answers.refreshBlockedHistory')}
          </p>
        ) : null}
        {/* `data-failure-detail` is where the English goes: a developer reads the attribute, a
            reader reads the sentence. It is never rendered. */}
        {error ? <p role="alert" data-testid="answer-refresh-error" data-failure-detail={error.detail ?? undefined} className="mt-2 text-body leading-body text-[color:var(--color-text-primary)]">{error.sentence}</p> : null}
      </div>
    </section>
  );
}

/**
 * Leaving, after the answer rather than before it: the way back to the list and the previous
 * revision both take a reader off this answer, so they belong where it ends.
 */
export function RetainedAnswerFooter({ onHome, onPrevious, t }: {
  onHome: () => void;
  onPrevious: (() => void) | null;
  t: ReturnType<typeof useTranslations<'library'>>;
}) {
  return (
    <section data-testid="retained-answer-footer" className="mx-auto mt-6 w-full max-w-[var(--measure-doc-column)] px-6 pb-8 md:px-10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--color-divider)] pt-4">
        {onPrevious ? <Button className="atlas-touch-floor max-w-full" size="sm" variant="ghost" data-testid="answer-previous" onClick={onPrevious}>{t('answers.previous')}</Button> : null}
        <button
          type="button"
          onClick={onHome}
          data-testid="answer-back-home"
          className={controlClass({ shape: 'link', tone: 'muted', hoverInk: 'strong', className: 'atlas-touch-floor text-body' })}
        >
          {t('answers.back')}
        </button>
      </div>
    </section>
  );
}
