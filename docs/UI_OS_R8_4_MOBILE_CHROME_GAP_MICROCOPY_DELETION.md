# UI-OS R8.4 Mobile Chrome Gap & Microcopy Deletion

## Task Identity

UI-OS R8.4 is a mobile safe-area and copy deletion remediation task. R9 archive work remains postponed.

## Why R8.4 Exists

R8.3 fixed training density, heading contrast, and Chinese-first copy partially, but the mobile acceptance screenshot still showed a bottom white strip and lingering small explanatory copy on Today.

## Screenshot-Observed Failures

- A white strip appeared at the bottom of the mobile viewport behind or below the bottom navigation.
- Today still showed unnecessary small text such as page subtitles, normal-state explanations, and focus override helper copy.
- Primary flows still carried verbose explanatory copy that did not change the next action.

## What R8.4 Fixed

- The mobile viewport background, root background, shell scroll area, and bottom navigation safe-area now use the dark app background.
- Bottom navigation hidden/visible states do not reveal a white browser or spacer background.
- The global microcopy deletion pass removes low-value normal-state helper copy from primary flows.
- Today removes normal-state microcopy from the primary flow.
- Training, History, and Settings primary headings avoid generic subtitles.
- Settings top-level panels use shorter owner-facing summaries.
- Details remain available behind collapsed `为什么这样推荐`, `查看详情`, `更多`, and secondary panels.

## Primary-Flow Copy Budget

Primary app flows should show only the title, one meaningful status badge, one action label, and a short warning only when risk is meaningful. Normal-state explanations, generic subtitles, and repeated safety explanations belong in collapsed details or Settings.

## Details Ownership

Long reasoning remains behind collapsed sections. Today owns the daily decision, Focus owns current-set action, History owns calendar/frequency, Progress owns trend and PR/e1RM explanation, and Settings owns safety, backup, cloud candidate, diagnostics, and equipment details.

## Non-Goals

- No training algorithm change.
- No warmup, planning, PR/e1RM, effective-set, or Data Health calculation change.
- No source-of-truth or persistence change.
- No AppData schema change.
- No route or cloud behavior change.
- No package, script, or lockfile change.

## R9 Status

UI-OS R9 — Interaction OS Remediation Archive V1 remains recommended after visual acceptance passes. UI-OS R9 is not started by R8.4.
