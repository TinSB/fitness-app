# UI-OS R5 — Progress / Data Health Clarity Rewrite V1

Task UI-OS R5 is an implementation task for the Progress and Data Health surfaces.

## Baseline Evidence

- UI-OS R4 is complete.
- UI-OS R4 PR: #284.
- PR #284 is the baseline PR for this R5 task.
- UI-OS R4 merge commit: c4d1f482effbbb3d6ce41c7ed9ec01f26103af06.
- Validation passed with npm test: 1135 files / 4617 tests.
- dist token scan clean.
- R4 made History calendar/frequency first with calendar training frequency, selected day summary, PR/e1RM quick access, and recent sessions as secondary.

## Problem Fixed

Progress needed to explain training state in human language instead of behaving like a raw analytics dashboard. PR/e1RM/effective-set cards needed explanation, not raw-only metric display. Data Health needed to stop feeling like debug logs and instead explain what happened, why it matters, whether local training can continue, whether cloud candidate should pause, and what safe next action is available. No automatic repair is introduced.

## What R5 Adds

- progress clarity summary model.
- data health clarity summary model.
- Progress insight hero.
- readiness/recovery pressure cards in a Whoop / Athlytic style without wearable or medical claims.
- strength trend / PR / e1RM cards using existing calculated values only.
- effective sets / volume explanation with Apple Health style grouping and plain-language caveats.
- Data Health clarity panel.
- owner-friendly issue cards with safe next actions.

## Progress Hierarchy

1. Insight hero.
2. Readiness / recovery pressure.
3. Strength trend / PR / e1RM.
4. Effective sets / volume.
5. Data coverage / caveat.

Progress copy is presentation-only. It may classify existing outputs into states such as improving, stable, fatigue_risk, recovery_recommended, data_insufficient, or mixed, but it does not change PR/e1RM, effective-set, volume, readiness, recovery, or training calculations.

## Data Health Hierarchy

1. Overall status.
2. Issue clarity cards.
3. Safe next action.
4. Local-first / cloud-candidate guidance.
5. No automatic repair.

Data Health issue cards explain what happened, why it matters, whether local training can continue, whether cloud candidate should pause, and what the safe next action is. Full diagnostics remain redacted: no full AppData, no secrets, no tokens, no service role, and no external upload.

## Non-Goals

- No PR/e1RM calculation change.
- No effective-set calculation change.
- No training algorithm change.
- No training volume calculation change.
- No readiness/recovery engine logic change.
- No data health detection change.
- No data health repair semantics change.
- No automatic repair.
- No `POST /data-health/repair/apply`.
- No persistence change.
- No source-of-truth change.
- No route change.
- No cloud sync.
- No package dependency change.
- No prototype runtime import.

## Recommended Next Task

UI-OS R6 — Settings / Safety / Theme / Equipment Profile Rewrite V1 is recommended next.

UI-OS R6 is not started by R5.

## Safety Boundaries

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- no default cloud sync.
- no background sync.
- no SaaS/multi-user runtime.
- no package/script/lockfile drift.
- pnpm-lock.yaml remains absent.

Accepted browser mutation routes remain exactly:

1. POST /data-health/issues/:issueId/dismiss
2. POST /history/:id/data-flag
3. POST /history/:id/edit
4. POST /sessions/start
5. POST /sessions/active/patches
6. POST /sessions/active/complete
7. POST /sessions/active/discard

No eighth browser mutation route is added. `POST /data-health/repair/apply` remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked.
