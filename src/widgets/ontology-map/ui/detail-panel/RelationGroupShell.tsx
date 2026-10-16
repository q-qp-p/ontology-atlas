import type { ReactNode } from "react";

export type RelationGroupDir = "contains" | "usedBy" | "dependsOn" | "belongsTo" | "related" | "evidence" | "code";

export const GROUP_GLYPH_SLOT = "flex size-4 shrink-0 items-center justify-center";
export const GROUP_ROW_LIST = "-mx-2.5 flex flex-col";

/**
 * The direction glyph in a relation group's header — the approved mockup's SVG
 * (mockup-panel-detail) carried over verbatim. Containing = ownership downward
 * (hierarchy), Used By = arriving from outside (arrow-in), Leaning On = leaving
 * outward (arrow-out), Belongs To = Containing flipped vertically (same relation, opposite
 * direction), Related = two ends with no arrow, Evidence = a document, Code = `</>`. Drawn in currentColor only, so the
 * ink inherits the parent's `--map-panel-group-dir` text colour.
 */
function GroupDirIcon({
  variant,
}: {
  variant: RelationGroupDir;
}) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (variant) {
    case "contains":
      return (
        <svg {...common}>
          <circle cx={12} cy={5} r={2.2} />
          <path d="M12 7v4M12 11H6v3M12 11h6v3" />
          <circle cx={6} cy={17} r={2.2} />
          <circle cx={18} cy={17} r={2.2} />
        </svg>
      );
    case "belongsTo":
      // The "contains" glyph flipped vertically — it says "the same hierarchical
      // relation seen from the opposite direction" through form alone (zero new
      // colours, zero new symbols). Nodes with more than one parent really exist
      // (56 in the dogfood vault), so the upper node is drawn as two.
      return (
        <svg {...common}>
          <circle cx={12} cy={19} r={2.2} />
          <path d="M12 17v-4M12 13H6v-3M12 13h6v-3" />
          <circle cx={6} cy={7} r={2.2} />
          <circle cx={18} cy={7} r={2.2} />
        </svg>
      );
    case "usedBy":
      return (
        <svg {...common}>
          <circle cx={18} cy={12} r={2.4} />
          <path d="M4 12h10M11 8.5l3.5 3.5-3.5 3.5" />
        </svg>
      );
    case "dependsOn":
      return (
        <svg {...common}>
          <circle cx={6} cy={12} r={2.4} />
          <path d="M8.4 12h10M15 8.5l3.5 3.5-3.5 3.5" />
        </svg>
      );
    case "related":
      return (
        <svg {...common}>
          <circle cx={5.5} cy={12} r={2.4} />
          <circle cx={18.5} cy={12} r={2.4} />
          <path d="M7.9 12h8.2" />
        </svg>
      );
    case "evidence":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v4h4M10 13h5M10 16h5" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
        </svg>
      );
  }
}

/**
 * The shared shell for a relation group — a header with a direction glyph, a bold
 * plain label, an indigo count chip and an underline divider, then the row list
 * below. Rendered in one place so every group (contains / uses / leans on /
 * basis / code location) reads with the same skeleton.
 */
export function RelationGroupShell({
  groupKey,
  dir,
  label,
  help,
  count,
  countText,
  headerExtra,
  children,
}: {
  groupKey: string;
  dir: RelationGroupDir;
  label: string;
  help?: string;
  count: number;
  /** Names the unit when the count is not of the rows' own kind. */
  countText?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col" data-datasheet-group={groupKey}>
      <div className="mb-1.5 flex items-center gap-2 border-b border-[color:var(--map-panel-group-underline)] pb-2">
        <span className={`${GROUP_GLYPH_SLOT} text-[color:var(--map-panel-group-dir)]`}>
          <GroupDirIcon variant={dir} />
        </span>
        <span
          title={help}
          className="text-body font-[var(--font-weight-emphasis)] tracking-[var(--tracking-body)] text-[color:var(--map-panel-text-secondary)]"
        >
          {label}
        </span>
        <span
          data-datasheet-group-total={groupKey}
          className="shrink-0 whitespace-nowrap rounded-chip bg-[color:var(--map-panel-count-surface)] px-1.5 py-px font-mono text-label leading-label text-[color:var(--map-panel-count-text)]"
        >
          {countText ?? count}
        </span>
        {headerExtra}
      </div>
      {children}
    </div>
  );
}
