---
id: 75e77494-764f-4f26-a0c1-ca5aebb8d074
date: 2026-10-12
---
## 2026-10-12 — Fast local evidence and runtime-scoped merge checks

**Why**: The owner asked to stop losing development time to merges. Tooling test-only edits selected 60 gates plus all product suites; a measured perf job spent 40 seconds selecting zero tests through type-only imports. Cheap script, lint and registry failures escaped pre-push.
**Prior**: Narrows the test-only interpretation of 2026-09-13 Scope verification and collapse exact repeated test commands. Keeps its exhaustive runtime-planner, unknown-path and invalid-history guards, required CI contexts, and 2026-08-22 (96) parallel local lanes without browser suites.
**Decision**: Run affected lint, Node and runtime unit tests locally, union message-catalogue evidence once, and check relevant registry/workflow security. Refuse proof from a different pushed commit or checkout inputs that mask it. CI tooling tests run focused checks; runtime planner changes remain exhaustive. Remove explicit type-only edges only from runtime test reach, preserving contract edges. Collapse overlapping default Node invocations without flags or lifecycle hooks. Measure command completion and total hook preparation accurately.
**Dissent**: Narrow selection risks missed dependencies. Preserve uncertain imports, source-reading contracts, daily/manual full runs and CI authority; local success never substitutes for remote required evidence.
**Falsifier**: A runtime edge is omitted, a source-reading contract loses reach, a failed local lane permits push, dirty or different-commit evidence is accepted, or required CI disappears. Reopen scope if recurring pushes exceed the reported 90-second budget.
**Owner**: Ontology Atlas owner; Codex implements the requested optimization.
