---
id: 6805358d-1f74-4d46-a28c-d1940e5cc01e
date: 2026-10-17
---
## 2026-10-17 — The launch counts only folders that still exist

**Why**: On the owner's machine every launch stopped at the folder screen, which offered one folder to open and "4 folders not found"; the four were checkouts that no longer exist. The person had one real choice and was still asked.
**Prior**: Narrows 6837cdab (2026-09-13, "The folder count decides the launch"): its rule and its falsifier "a launch that asks with one folder" stand; "known" now means a recorded folder whose path still resolves.
**Decision**: Before deciding, the cold restore checks each recent record with `tauriVaultRecordResolves`; a `missing` record is not counted. Two or more remaining folders stop at the chooser; otherwise the stored folder resumes as before. The web has no path to check, so its count is unchanged. Missing folders stay listed on the chooser until forgotten.
**Dissent**: Ask whenever any record exists beyond the current one, so a person notices folders that vanished. Rejected: the chooser already says which folders are missing when it is opened, and a launch question with one answer is the defect 6837cdab names.
**Falsifier**: A launch that asks while only one known folder exists; a launch that resumes while two exist; a launch that waits visibly longer on a list of ten records.
**Owner**: Builder of this session, under the owner's 2026-10-17 request to judge whether each screen helps.
