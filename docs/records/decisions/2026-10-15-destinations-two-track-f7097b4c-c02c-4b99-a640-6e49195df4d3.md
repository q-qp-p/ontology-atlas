---
id: f7097b4c-c02c-4b99-a640-6e49195df4d3
date: 2026-10-15
---
## 2026-10-15 — Agents and Automations take the page frame and split into two tracks from 1536px

**Why**: Moving from Projects to Agents or Automations moved the title 320px (x 232 to 552) and left 488px of empty floor on each side at 1920, with 0.47 of the width in use. Saving the first schedule or readying the first tool swapped the page in one hard frame.
**Prior**: 2026-09-06 "Agents and MCP read in a 960 column that carries the breath" is overturned for the column; its breath and the never-tracked Korean rule stand. 2026-09-21 (419e3c34) "Automations keep schedules and their results in one flow" stands for one flow and is overturned for one form column.
**Decision**: Both pages wear `PAGE_FRAME`. From 1536px `PAGE_TWO_TRACK` splits them 2fr/1fr: agent rows beside the setup shelf, the schedule list beside its three facts; below 1536px the tracks stack. The schedule list is one panel in both states with an aligned column header and, when empty, one ghost row in the real row geometry. Chat-capable tools keep their row before they are ready, so each tool is named once and arriving changes ink and one slot in place.
**Dissent**: A wide table holding one row looks emptier than a narrow column; answered by the ghost row, which shows the first schedule's place before it exists.
**Falsifier**: At 1536px or wider, someone cannot find the page's primary action within five seconds, or text again sits against the left wall.
**Owner**: Project owner; 2026-10-15 wave brief asking for one title position and a filled frame.
