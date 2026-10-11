import type { ConeCircle, ConeCoord, ConeInputNode, ConeKind } from '../cone-layout';

/**
 * The opt-in 3D view: arrangements where height and bearing carry typed facts (height is
 * the kind's containment tier, bearing is ownership) or where relations place nodes
 * (`createCouplingCloudRelaxer`). Opt-in because 3D multiplies edge crossings, which dominate
 * readability (`docs/DECISIONS.md`, 2026-08-18). Coordinates project into world 2D through
 * weak perspective `s = f/(f+z)` and ride the existing camera; draw, hit test and
 * instrumentation share one frame map (`DomeRuntime.frame`), so a click during rotation
 * lands where the node was drawn. Idle spin stops under the pointer and under reduced
 * motion; orbit release coasts on the camera's momentum decay, and reduced motion keeps 1:1
 * tracking without momentum. A node drags only within its kind plane, or it would take an
 * arbitrary z. Constants are feel values, not theme tokens.
 */
export type DomeViewKind = ConeKind;
export type DomeInputNode = ConeInputNode;
export type DomeCoord = ConeCoord;
export type DomeCircle = ConeCircle;

/** The spine order of `docs/ONTOLOGY-ATLAS-SPEC.md` §2: the fact height carries. */
export const KIND_DEPTH: Readonly<Record<DomeViewKind, number>> = {
  project: 0,
  domain: 1,
  capability: 2,
  element: 3,
};

export interface DomeModel {
  /** A coupling cloud has no kind planes, so drawing latitude rings would be a lie. */
  arrangement: DomeArrangement;
  /** The dome sits on it, for camera continuity. */
  centerX: number;
  centerY: number;
  /** Sized so the element ring overlaps the 2D layout radius. */
  unit: number;
  coords: Map<string, DomeCoord>;
  /** Ownership only; empty for the cloud. */
  circles: DomeCircle[];
  /** Strata only, else empty. */
  sectors: DomeSector[];
}

/**
 * The bearing arc `[from, to)` a node's whole subtree is dealt into. `buildStrataTargets`
 * keeps descendants inside and siblings disjoint, so drawing it shows a proven fact.
 */
export interface DomeSector {
  id: string;
  kind: DomeViewKind;
  from: number;
  to: number;
}

/**
 * Arrangement `ownership` (default) is the cone: height is the tier and bearing comes from
 * containment. `coupling` is the cloud: a deterministic force layout lets relations decide all three
 * coordinates, a genuinely different question.
 */
/**
 * Arrangement `strata` answers the same containment question as `ownership`, drawn as stacked labelled
 * planes (`buildStrataTargets`; `docs/DECISIONS.md` for the declined three.js probe).
 */
export type DomeArrangement = "ownership" | "coupling" | "strata";
