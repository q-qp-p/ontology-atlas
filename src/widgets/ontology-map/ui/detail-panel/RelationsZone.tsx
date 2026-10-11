import type { Dispatch, SetStateAction } from "react";
import { controlClass } from "@/shared/ui";
import { CodeLocationsGroup } from "./CodeLocationsGroup";
import { ConnectionGroup } from "./ConnectionGroup";
import { EvidenceGroup } from "./EvidenceGroup";
import type { OntologyMapDetailPanelLabels, OntologyMapDetailPanelProps } from "./types";

export function RelationsZone({
  groups,
  evidence,
  codeLocations,
  labels,
  onSelectConnection,
  onHoverConnection,
  onHoverEvidence,
  collapseProjectRelations,
  connectedTotal,
  hasConnections,
  showAllContains,
  setShowAllContains,
  expandedGroups,
  setExpandedGroups,
  showProjectRelations,
  setShowProjectRelations,
}: {
  groups: OntologyMapDetailPanelProps["groups"];
  evidence: OntologyMapDetailPanelProps["evidence"];
  codeLocations: OntologyMapDetailPanelProps["codeLocations"];
  labels: OntologyMapDetailPanelLabels;
  onSelectConnection: OntologyMapDetailPanelProps["onSelectConnection"];
  onHoverConnection: OntologyMapDetailPanelProps["onHoverConnection"];
  onHoverEvidence: OntologyMapDetailPanelProps["onHoverEvidence"];
  collapseProjectRelations: boolean;
  connectedTotal: number;
  hasConnections: boolean;
  showAllContains: boolean;
  setShowAllContains: Dispatch<SetStateAction<boolean>>;
  expandedGroups: ReadonlySet<string>;
  setExpandedGroups: Dispatch<SetStateAction<ReadonlySet<string>>>;
  showProjectRelations: boolean;
  setShowProjectRelations: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <div className="flex flex-col gap-[var(--map-panel-zone-gap)] px-[var(--map-panel-pad)] py-[18px]">
      {collapseProjectRelations && connectedTotal > 0 ? (
        <div
          data-testid="map-project-relations-summary"
          data-source-relations-expanded={showProjectRelations}
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-label text-[color:var(--map-panel-text-tertiary)]"
        >
          {groups.contains.total > 0 ? (
            <span>
              {labels.metricContains}
              <b className="ml-1 font-[var(--font-weight-strong)] tabular-nums text-[color:var(--map-panel-text-secondary)]">
                {groups.contains.total}
              </b>
            </span>
          ) : null}
          {groups.usedBy.total > 0 ? (
            <span>
              {labels.metricUsedBy}
              <b className="ml-1 font-[var(--font-weight-strong)] tabular-nums text-[color:var(--map-panel-text-secondary)]">
                {groups.usedBy.total}
              </b>
            </span>
          ) : null}
          {groups.dependsOn.total > 0 ? (
            <span>
              {labels.metricDependsOn}
              <b className="ml-1 font-[var(--font-weight-strong)] tabular-nums text-[color:var(--map-panel-text-secondary)]">
                {groups.dependsOn.total}
              </b>
            </span>
          ) : null}
          {groups.belongsTo.total > 0 ? (
            <span>
              {labels.metricBelongsTo}
              <b className="ml-1 font-[var(--font-weight-strong)] tabular-nums text-[color:var(--map-panel-text-secondary)]">
                {groups.belongsTo.total}
              </b>
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowProjectRelations((value) => !value)}
            aria-expanded={showProjectRelations}
            className={controlClass({
              shape: "link",
              size: "md",
              className:
                "ml-auto shrink-0 text-[color:var(--map-panel-text-tertiary)] hover:text-[color:var(--map-panel-text-secondary)] active:text-[color:var(--map-panel-text-primary)]",
            })}
          >
            {showProjectRelations
              ? labels.sourceRelationsHide ?? labels.containsShowSummary
              : labels.sourceRelationsShow ?? labels.containsShowAll}
          </button>
        </div>
      ) : null}
      {hasConnections ? (
        <>
          {!collapseProjectRelations || showProjectRelations ? (
            <>
              <ConnectionGroup
                group="contains"
                dir="contains"
                label={labels.metricContains}
                help={labels.metricContainsHelp}
                view={groups.contains}
                labels={labels}
                onSelectConnection={onSelectConnection}
                onHoverConnection={onHoverConnection}
                showAllContains={showAllContains}
                setShowAllContains={setShowAllContains}
                expandedGroups={expandedGroups}
                setExpandedGroups={setExpandedGroups}
              />
              <ConnectionGroup
                group="usedBy"
                dir="usedBy"
                label={labels.metricUsedBy}
                help={labels.metricUsedByHelp}
                view={groups.usedBy}
                labels={labels}
                onSelectConnection={onSelectConnection}
                onHoverConnection={onHoverConnection}
                showAllContains={showAllContains}
                setShowAllContains={setShowAllContains}
                expandedGroups={expandedGroups}
                setExpandedGroups={setExpandedGroups}
              />
              <ConnectionGroup
                group="dependsOn"
                dir="dependsOn"
                label={labels.metricDependsOn}
                help={labels.metricDependsOnHelp}
                view={groups.dependsOn}
                labels={labels}
                onSelectConnection={onSelectConnection}
                onHoverConnection={onHoverConnection}
                showAllContains={showAllContains}
                setShowAllContains={setShowAllContains}
                expandedGroups={expandedGroups}
                setExpandedGroups={setExpandedGroups}
              />
              {/* Belongs to — placed last, in the same order as full detail
                  (container → used by → depends on → belongs to), so someone moving
                  between the two surfaces meets the same word in the same place. */}
              <ConnectionGroup
                group="belongsTo"
                dir="belongsTo"
                label={labels.metricBelongsTo}
                help={labels.metricBelongsToHelp}
                view={groups.belongsTo}
                labels={labels}
                onSelectConnection={onSelectConnection}
                onHoverConnection={onHoverConnection}
                showAllContains={showAllContains}
                setShowAllContains={setShowAllContains}
                expandedGroups={expandedGroups}
                setExpandedGroups={setExpandedGroups}
              />
            </>
          ) : null}
          <EvidenceGroup
            evidence={evidence}
            labels={labels}
            onHoverEvidence={onHoverEvidence}
          />
          <CodeLocationsGroup
            codeLocations={codeLocations}
            labels={labels}
          />
        </>
      ) : (
        <span className="text-label text-[color:var(--map-panel-text-tertiary)]">
          {labels.noConnections}
        </span>
      )}
    </div>
  );
}
