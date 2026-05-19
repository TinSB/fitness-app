# UI-OS R6 — Settings / Safety / Theme / Equipment Profile Rewrite V1

Task UI-OS R6 is an implementation task for the Settings / Safety / Theme / Equipment Profile surfaces.

## Baseline Evidence

- UI-OS R5 is complete.
- UI-OS R5 PR: #285.
- PR #285 is the baseline PR for this R6 task.
- UI-OS R5 merge commit: 284d7a675ca3a5b9a5dc28b77a89b300180730d2.
- Validation passed with npm test: 1142 files / 4648 tests.
- dist token scan clean.
- R5 improved Progress and Data Health clarity with owner-friendly insight and safe next actions.

## Problem Fixed

Settings needed to become the control center for high-risk and configuration features. Training flow should not be crowded by diagnostics, cloud, safety, backup, or equipment controls. The theme system needed a clear system / light / dark model. Equipment profile settings needed clear owner-facing defaults. Cloud candidate must be manual and must not look like casual sync.

## What R6 Adds

- Settings safety summary model.
- Theme preference model.
- Settings control center.
- Theme settings panel.
- Backup / Recovery panel.
- Emergency Local panel.
- Equipment Profile panel.
- Cloud Candidate panel.
- Diagnostics / Data Safety panel.
- About / Data Safety panel.

## Settings Hierarchy

1. Overview / safety summary.
2. App preferences / theme / units.
3. Backup / Recovery.
4. Emergency Local.
5. Equipment Profiles.
6. Cloud Candidate.
7. Diagnostics / Data Health.
8. About / Data Safety.

## Theme Behavior

- Theme modes are system / light / dark.
- Focus Mode may use immersive dark even when Settings is previewing a light surface.
- Theme selection in R6 is UI-only and session-local.
- Theme selection does not mutate AppData, source-of-truth state, training data, or persistence.
- Theme persistence is deferred unless a later task adds an explicit safe preference mechanism.

## Equipment Profile Behavior

- Olympic barbell 45 lb.
- Smith 25 lb.
- Dumbbell per-hand / 5 lb increment.
- Selectorized machine stack.
- Plate-loaded base/sled warning.
- Unknown/custom profiles require owner review.
- Equipment profile editing remains draft-only.
- No automatic history migration.
- No automatic rewriting of logged sets.

## Cloud Candidate Behavior

- Cloud candidate is manual candidate only.
- Cloud pull does not auto-apply.
- Cloud push requires confirmation.
- Conflict resolution remains manual.
- No automatic sync.
- No background sync.
- No cloud as default source.
- No casual sync button.

## Non-Goals

- No source-of-truth change.
- No AppData schema change.
- No persistence change.
- No training algorithm change.
- No warmup algorithm change.
- No PR/e1RM/effective-set calculation change.
- No equipment-aware engine logic change.
- No Data Health detection change.
- No Data Health repair semantics change.
- No automatic repair.
- No `POST /data-health/repair/apply`.
- No route change.
- No browser mutation route change.
- No cloud sync.
- No package dependency change.
- No prototype runtime import.

## Recommended Next Task

UI-OS R7 — Mobile Safe Area / Component State Regression Lock V1 is recommended next.

UI-OS R7 is not started by R6.

## Safety Boundaries

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.
- no default cloud sync.
- no background sync.
- no production deployment auto-start.
- no external monitoring upload.
- no SaaS/multi-user runtime.
- no destructive migration.
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

No eighth browser mutation route is added. No eighth browser mutation route was added. `POST /data-health/repair/apply` remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked.
