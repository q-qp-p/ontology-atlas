import { CalendarClock, FileCheck2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { ICON_SIZE } from "@/shared/ui/tokens/icon-size";

import frame from "../first-run/constellations-starting-point.module.css";
import { LEDGER_ROW, LedgerWaitingRow } from "./RoundsLedger";
import styles from "./rounds-history-empty.module.css";

export type RoundSignalTone = "stale" | "redrafted" | "refused" | "held";

/**
 * Check history before anything is scheduled: the one next step, the two kinds of check that can be
 * scheduled with what each costs, and the ledger itself with its first row still a ghost. The
 * outcome words sit in that row's outcome slot, where a real pass will name one of them.
 */
export function RoundsHistoryEmpty({ title, description, action, kindsLabel, kinds, signalsLabel, signals, columns, ghostTime, ghostLabel }: {
  title: string;
  description: string;
  action: ReactNode;
  kindsLabel: string;
  kinds: readonly { id: "consistency" | "service"; name: string; body: string }[];
  signalsLabel: string;
  signals: readonly { tone: RoundSignalTone; name: string }[];
  columns: { time: string; round: string; outcome: string };
  ghostTime: string;
  ghostLabel: string;
}) {
  return <section className={frame.stack} data-testid="library-rounds-empty-ledger">
    <div className={frame.layout}>
      <div className={frame.intro}>
        <CalendarClock size={ICON_SIZE.lg} className={frame.icon} aria-hidden />
        <h2>{title}</h2>
        <p>{description}</p>
        <div className={frame.action}>{action}</div>
      </div>
      <div className={frame.source} role="group" aria-label={kindsLabel}>
        <div className={frame.sourceHead}><span>{kindsLabel}</span><strong className="font-[var(--font-weight-emphasis)]">{kinds.length}</strong></div>
        <ul className={styles.kinds}>
          {kinds.map(kind => <li key={kind.id} data-round-kind={kind.id}>
            <span className={styles.mark}>{kind.id === "consistency"
              ? <FileCheck2 size={ICON_SIZE.sm} aria-hidden />
              : <RefreshCw size={ICON_SIZE.sm} aria-hidden />}</span>
            <span className={styles.copy}>
              <span className={styles.name}>{kind.name}</span>
              <span className={styles.body}>{kind.body}</span>
            </span>
          </li>)}
        </ul>
      </div>
    </div>
    <div className={frame.band} data-testid="library-rounds-ghost-ledger">
      <h3 className={frame.bandHead}>{signalsLabel}</h3>
      <div data-testid="library-rounds-ghost-head" className={cn(LEDGER_ROW, styles.head)}>
        <span>{columns.time}</span>
        <span />
        <span className="flex items-baseline justify-between gap-4"><span>{columns.round}</span><span>{columns.outcome}</span></span>
      </div>
      <LedgerWaitingRow time={ghostTime} ink="ghost" testId="library-rounds-ghost-row" label={ghostLabel}>
        <span className="flex min-w-0 items-center justify-between gap-4 py-1.5">
          <span aria-hidden className={styles.nameSlot} />
          <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-label leading-label">
            {signals.map(signal => <span key={signal.tone} data-signal={signal.tone} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={styles.dot} data-tone={signal.tone} />{signal.name}
            </span>)}
          </span>
        </span>
      </LedgerWaitingRow>
    </div>
  </section>;
}
