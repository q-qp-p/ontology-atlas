'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/shared/lib/cn';
import { buttonVariants } from '@/shared/ui';
import { GuidanceRelationshipPreview } from '@/widgets/relationship-preview';
import type { InsightsBrief } from '../../lib/brief/use-insights-brief';
import { HarnessCoverageOverview } from './HarnessCoverageOverview';
import { INSIGHTS_PREVIEW_HEADLINE } from './insights-headline';

/** Guidance remains one question: which declared instructions, gates and checks reach each domain. */
export function HarnessTab({ detail }: { detail: InsightsBrief['harnessDetail'] }) {
  const t = useTranslations('ontologyPages.insights.harnessTab');
  if (detail.availability !== 'measured') {
    return (
      <section data-testid="harness-tab" className={cn('flex flex-col gap-[var(--card-gap)]', INSIGHTS_PREVIEW_HEADLINE)}>
        <GuidanceRelationshipPreview footer={<>
          <div className="min-w-0 max-w-prose">
            <p className="text-title font-[var(--font-weight-strong)] text-[color:var(--color-text-primary)]">{t(`availability.${detail.availability}.title`)}</p>
            <p className="mt-1 break-keep text-body text-[color:var(--color-text-tertiary)]">{t(`availability.${detail.availability}.description`)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/architecture/?view=guides" data-testid="preview-primary-action" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'atlas-touch-floor')}>
              {t('preview.openHarness')}
            </Link>
            {detail.availability === 'app-only' ? (
              <Link href="/download/" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'atlas-touch-floor')}>
                {t('getApp')}
              </Link>
            ) : null}
          </div>
        </>} />
      </section>
    );
  }

  return (
    <section data-testid="harness-tab" className="flex min-h-0 flex-1 flex-col">
      <HarnessCoverageOverview
        evidence={detail.evidence}
        guideFiles={detail.guideFiles}
        checks={detail.checks}
        drift={detail.drift}
      />
    </section>
  );
}
