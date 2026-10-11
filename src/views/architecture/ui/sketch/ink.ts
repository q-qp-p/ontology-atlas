/** One stroke colour, named once: the brand step clears 3:1 on the canvas where translucent indigo did not. The legend reads it too. */
export const EDGE_STROKE = 'var(--color-indigo-brand)';
/** A violated edge wears the receipt pill's own danger tone plus a dash, so it survives without colour and never contradicts the pill. */
export const VIOLATED_STROKE = 'var(--color-danger-text)';
/* Receding must leave the words readable: 0.7 keeps every receded word at or above 3:1, while the selected pair wins through its indigo face and stroke. */
export const RECEDED_ROLE_OPACITY = 0.7;
export const RECEDED_STROKE_OPACITY = 0.7;
/*
 * The halo marks a violation, the stroke going up the stack. Blur is on the SVG filter because
 * `stdDeviation` cannot read `var()`; its opacities are `--architecture-plane-climb-halo*` tokens.
 * Gate: `ArchitectureSketch.test.tsx`, "a violation climbs the stack".
 */
export const VIOLATION_HALO_BLUR = 2.5;
export const VIOLATION_HALO_WIDTH = 4;
/** Selecting the role raises its own violation off the plane; every other stroke stays put. */
export const VIOLATION_HALO_WIDTH_RAISED = 7;
export const VIOLATION_STROKE_RAISE = 1;
