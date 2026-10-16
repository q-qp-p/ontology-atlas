---
id: 93e79cee-7983-4665-ba3b-b08184e95da0
date: 2026-10-16
---
## 2026-10-16 — Agents and Automations return to the centred 960 column

**Why**: In the installed app at a 14-inch window (1512px), the two-track frame left both pages' 960px work track pinned under a left title with about 400px of empty window to its right, because the reference track only appears from 1536px and the Agents tab without a setup shelf never gets one. Seeing it, the owner asked why everything had stuck to the left instead of standing centred, and chose the centred 960 column over a full-width fill.
**Prior**: Overturns docs/records/decisions/2026-10-15-destinations-two-track-f7097b4c-c02c-4b99-a640-6e49195df4d3.md for the frame and the two tracks; its ghost rows, list header and tools waiting as rows stand. Restores 2026-09-06 "Agents and MCP read in a 960 column that carries the breath" as a centred column, and restores 2026-09-21 (419e3c34) "Automations keep schedules and their results in one flow" for its one form column.
**Decision**: Agents (all three tabs) and Automations wear `PAGE_FRAME_FORM` at every width. Each tab is one column; what stood in the reference track follows the work rows. `PAGE_TWO_TRACK` and `PAGE_TRACK_CAP` are removed.
**Dissent**: Moving from Projects to Agents or Automations moves the title 200 to 320px sideways again, the defect the two-track frame was made to remove; and at 1920 the centred column leaves about 480px empty on each side.
**Falsifier**: The owner, moving between Projects and Agents or Automations, names the title jump as the problem; or at 1920 cannot find a page's primary action within five seconds.
**Owner**: Project owner, 2026-10-16, choosing "centred 960 column" after seeing the installed app.
