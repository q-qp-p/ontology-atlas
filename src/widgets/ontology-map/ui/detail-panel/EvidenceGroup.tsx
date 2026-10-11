import { FileText } from "lucide-react";
import { ICON_SIZE } from "@/shared/ui/icon-size";
import { Link } from "@/i18n/navigation";
import { buildDocsVaultHref } from "@/entities/docs-vault";
import { controlClass } from "@/shared/ui";
import { GROUP_GLYPH_SLOT, GROUP_ROW_LIST, RelationGroupShell } from "./RelationGroupShell";
import type { OntologyMapDetailPanelLabels, OntologyMapDetailPanelProps } from "./types";

// The evidence group — CLICKABLE doc-link rows (a W2-A promotion: these
// used to be display-only). `row.id` is a vault slug (see
// `buildV2EvidenceRows`'s own doc comment), the exact input
// `buildDocsVaultHref` expects — no separate id-namespace mapping needed
// (unlike `onSelectConnection`'s canvas-node ids, which are a different
// namespace). No TraceMark here: these aren't canvas edges. Same header and
// list shape as usedBy/dependsOn.
//
// Toss C2 — `row.path` (the folder prefix, e.g. "capabilities/") used to
// render as an always-visible mono span next to the title. That is a raw vault
// path, opaque to a non-developer, sitting right next to the plain "Evidence"
// label. It now only surfaces through the row's native `title=` hover (the full
// `row.id` slug) — the row's own link already takes you to the doc, so the path
// adds nothing a click does not already resolve.
export function EvidenceGroup({
  evidence,
  labels,
  onHoverEvidence,
}: {
  evidence: OntologyMapDetailPanelProps["evidence"];
  labels: OntologyMapDetailPanelLabels;
  onHoverEvidence: OntologyMapDetailPanelProps["onHoverEvidence"];
}) {
  if (evidence.total === 0) return null;
  return (
    <RelationGroupShell
      groupKey="evidence"
      dir="evidence"
      label={labels.metricEvidence}
      help={labels.metricEvidenceHelp}
      count={evidence.total}
    >
      <ul className={GROUP_ROW_LIST}>
        {evidence.rows.map((row) => (
          <li key={`evidence:${row.id}`}>
            <Link
              href={buildDocsVaultHref({ slug: row.id })}
              data-datasheet-evidence={row.id}
              onPointerEnter={() => onHoverEvidence?.(row.id)}
              onPointerLeave={() => onHoverEvidence?.(null)}
              title={row.id}
              className={controlClass({
                shape: "row",
                size: "md",
                className:
                  "rounded-chip hover:bg-[color:var(--map-panel-row-hover)] active:bg-[color:var(--map-panel-row-active)]",
              })}
            >
              <span className={GROUP_GLYPH_SLOT}>
                <FileText
                  size={ICON_SIZE.md}
                  aria-hidden="true"
                  className="shrink-0 text-[color:var(--map-panel-text-tertiary)]"
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-body text-[color:var(--map-panel-text-secondary)]">
                {row.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </RelationGroupShell>
  );
}
