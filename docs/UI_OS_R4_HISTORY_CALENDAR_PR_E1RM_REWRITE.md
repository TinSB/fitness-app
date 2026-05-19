# UI-OS R4 — History Calendar & PR/e1RM Rewrite V1

## Task Identity

UI-OS R4 is the History Calendar & PR/e1RM Rewrite V1 implementation task. It rewrites the real History surface so training frequency and calendar review are first, while preserving existing history data semantics, PR/e1RM calculations, effective-set calculations, persistence, routes, cloud behavior, and source-of-truth behavior.

## Baseline Evidence

- UI-OS R3 complete.
- PR #283.
- Merge commit `5be45f7f978c67a361421ed2ba672c5dfc4857ed`.
- `npm test` passed: 1128 files / 4600 tests.
- dist token scan clean.
- R3 converted Today into a decision surface with a hero decision model, readiness/fatigue summary, medium-priority focus override, unfinished-session notice, and severe-risk-only Data Health surfacing.

## Problem Being Fixed

History did not prioritize calendar/frequency strongly enough. The user uses History to see which days trained and which days did not, then quickly access PR/e1RM. Recent session lists and Data Health diagnostics should not dominate the History page.

## What R4 Adds

- A pure history calendar summary model.
- A training frequency calendar that marks trained days, rest/no-training days, today, selected day, PR/e1RM days, and issue hints.
- A frequency summary for this week, this month, recent four-week average, and consistency.
- A selected day summary with friendly no-training copy.
- PR/e1RM quick access cards for major lifts using existing calculated data only.
- A secondary recent sessions timeline.
- A calm Data Health hint that does not repair, delete, upload, or block the page.

## History Hierarchy

1. Frequency summary.
2. Calendar training frequency.
3. Selected day summary.
4. PR/e1RM quick access.
5. Recent sessions as secondary.
6. Calm Data Health hint.

The History surface answers calendar training frequency first: which days trained / not trained, what the selected day contained, and where PR/e1RM can be opened without making the session list the primary page.

## Non-Goals

- No PR/e1RM calculation change.
- No effective-set calculation change.
- No training algorithm change.
- No warmup algorithm change.
- No planning/rotation logic change.
- No history data model change.
- No stored workout history mutation.
- No AppData migration.
- No persistence change.
- No source-of-truth change.
- No route change.
- No browser mutation route change.
- No cloud sync.
- No default cloud sync.
- No background sync.
- No automatic Data Health repair.
- No `POST /data-health/repair/apply`.
- No package dependency change.
- No package script change.
- No lockfile change.
- No prototype runtime import.

## Safety Boundaries

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- No eighth browser mutation route.
- `POST /data-health/repair/apply` remains blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.
- No default cloud sync.
- No background sync.
- No SaaS/multi-user runtime.
- No package/script/lockfile drift.
- pnpm-lock.yaml remains absent.
- No real personal training data in automated tests.

Accepted browser mutation routes remain exactly:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

## Recommended Next Task

UI-OS R5 — Progress / Data Health Clarity Rewrite V1 is recommended next.

UI-OS R5 is not started by R4.
