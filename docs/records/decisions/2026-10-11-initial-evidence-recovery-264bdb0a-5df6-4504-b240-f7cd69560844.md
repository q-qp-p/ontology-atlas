---
id: 264bdb0a-5df6-4504-b240-f7cd69560844
date: 2026-10-11
---
## 2026-10-11 — Expose omitted initial evidence through a guarded next read

**Why**: An initial excerpt could lose a trailing approval condition while retaining candidate trust; the adversarial fixture reproduces that loss.
**Prior**: Initial rows exposed a bounded prefix without omission coordinates. The source reader already supported exact lines, hash guards and typed refusal. The visible-gap boundary in docs/DECISIONS.md remains unchanged.
**Decision**: Add excerptInfo to authored document rows, mark truncation as review-required, and offer one exact bounded sourceReads selector tied to the original SHA-256. Preserve hostile-instruction precedence and existing write/acceptance boundaries. The reviewed flow is docs/specs/2026-10-11-initial-document-evidence-recovery.md.
**Dissent**: Whole authored units would avoid partial paragraphs but can yield no excerpt for one large unit; returning full documents would raise unbounded response costs. Keep both alternatives visible if the recovery flow proves insufficient.
**Falsifier**: A truncated row lacks review status or a usable first-omitted-line selector, or changed/symlinked source returns text despite its guard. Retained RED/GREEN probes cover these cases; wider semantic superiority is unmeasured.
**Owner**: Ontology Atlas maintainer; implementation and one independent campaign review under the owner's approved improvement scope.
