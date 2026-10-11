/** Playwright specs that drive the insights board. */

export const rules = [
  {
    order: 750,
    // The installed app's probe and its payload contract can drift away from this board in
    // silence: nothing else runs them against real HTML, so the first sign is a failed
    // verification eight minutes into a bundle build (measured 2026-09-20, when a pinned tab
    // count became unreachable). This spec runs both over the rendered screen in seconds.
    command: 'pnpm exec playwright test tests/e2e/insights-app-contract.spec.ts',
    reason: 'the insights board, the app DOM probe, or a module the payload contract loads changed',
    matches: [
      /^src-tauri\/src\/webview_verify\/dom_marker_probe\.js$/,
      /^scripts\/lib\/verify-macos\/[^/]+\.mjs$/,
      /^src\/views\/ontology-insights\/ui\/OntologyInsightsPage\.tsx$/,
      /^src\/views\/ontology-insights\/lib\/insights-tab-state\.ts$/,
    ],
  },
  {
    order: 760,
    /*
     * A control that exists on one subject only is invisible to a gate that loads the bare
     * route. The touch-target contract waited 20 seconds for a tab row the brief correctly does
     * not draw and went red with no defect behind it (2026-09-20), and nothing recommended it
     * for a change to this board.
     */
    command: 'pnpm exec playwright test tests/e2e/touch-target-contract.spec.ts',
    reason: 'a control on the insights board or a shared control primitive changed',
    matches: [
      /^src\/views\/ontology-insights\/ui\/OntologyInsightsPage\.tsx$/,
      /^src\/views\/ontology-insights\/ui\/tabs\/BriefTab\.tsx$/,
      /^src\/shared\/ui\/tab-bar\.tsx$/,
      /^src\/shared\/ui\/segmented-control\.tsx$/,
    ],
  },
  {
    order: 770,
    // A strip drawn for one subject only pushed the control a reader just clicked (measured
    // 2026-09-20: 188px, at both 1512 and 1920); the spec keeps the evidence in view.
    command: 'pnpm exec playwright test tests/e2e/insights-board-stability.spec.ts',
    reason: 'the insights subject row or the panel below it changed',
    matches: [
      /^src\/views\/ontology-insights\/ui\/OntologyInsightsPage\.tsx$/,
      /^src\/views\/ontology-insights\/ui\/analysis\/AnalysisWorkspace\.tsx$/,
      /^src\/shared\/ui\/segmented-control\.tsx$/,
    ],
  },
  {
    order: 780,
    command: 'pnpm exec playwright test tests/e2e/insights-badge-agreement.spec.ts',
    reason: 'the insights analysis counts or the witnesses they name changed',
    matches: [
      /^src\/views\/ontology-insights\/lib\/analysis-model\.ts$/,
      /^src\/views\/ontology-insights\/ui\/OntologyInsightsPage\.tsx$/,
      /^src\/views\/ontology-insights\/ui\/analysis\/AnalysisWorkspace\.tsx$/,
      /^src\/views\/ontology-insights\/ui\/analysis\/PairRail\.tsx$/,
    ],
  },
];
