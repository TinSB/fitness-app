# UI-OS 6 Settings / Safety / Equipment Profile Redesign

## Task Identity

UI-OS 6 — Settings / Safety / Equipment Profile Redesign V1.

This task is a presentational redesign of the owner-only Settings area. It does not change source-of-truth behavior, persistence behavior, training algorithms, routes, cloud behavior, package files, scripts, or lockfiles.

## Baseline Evidence

- UI-OS 5 is complete.
- UI-OS 5 PR #277.
- UI-OS 5 merge commit: 5bb9f1b27a94732cc803724e96dd4835a9b39f5d.
- UI-OS 5 validation passed: `npm run api:dev:build`, `npm run typecheck`, `npm test` with 1108 files / 4523 tests, `npm run build`, and dist token scan clean.

## Settings Redesign Scope

UI-OS 6 keeps the existing `ProfileView` behavior and reorganizes the Settings presentation around owner-safe groups:

- Units.
- Backup / Recovery.
- Emergency Local Mode.
- Equipment Profiles.
- Cloud Candidate.
- Diagnostics.
- About / Data Safety.

High-risk controls remain in Settings. Training screens are not polluted with cloud, backup, recovery, diagnostics, or source-of-truth internals.

## What Changed

- Added UI-OS Settings surfaces for the owner safety overview and grouped settings cards.
- Added Chinese-first safety copy for local-first operation, manual cloud candidate behavior, rollback / kill switch availability, and emergency local mode.
- Added an Equipment Profiles summary that shows:
  - Olympic bar 45 lb.
  - Smith machine 25 lb.
  - Dumbbell per-hand / 5 lb increment.
  - Selectorized machine stack / 插片.
  - Plate-loaded base/sled warning.
- Kept existing unit changes, backup export/import validation, health data import, assessment navigation, data-health actions, and backup restore confirmation behavior unchanged.

## Non-Goals

UI-OS 6 does not:

- Change source-of-truth behavior.
- Change persistence behavior.
- Migrate AppData or workout history.
- Change training, warmup, PR, e1RM, effective-set, or equipment-aware engine logic.
- Persist new equipment profile edits.
- Add routes or browser mutation routes.
- Add backup/import/export over HTTP.
- Add reset/recovery over HTTP.
- Add `POST /data-health/repair/apply`.
- Enable cloud pull, cloud push, default cloud sync, background sync, or automatic sync worker.
- Connect to Supabase.
- Add package dependencies, package scripts, or lockfile changes.

## Safety Boundaries

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- api-primary-dev remains dev/local only and not production-ready.
- devApiRunner is not production backend.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- no default cloud sync.
- no background sync.
- no production deployment auto-start.
- no external monitoring upload.
- no SaaS/multi-user runtime.
- no billing/public onboarding.
- no normalized training tables.
- no destructive migration.
- no real personal training data in automated tests.
- no new package/dependency/script/lockfile drift beyond Phase 12 @supabase/supabase-js.

## Accepted Browser Mutation Routes

The accepted browser mutation route inventory remains exactly seven:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

No eighth browser mutation route was added.

## Next Task

UI-OS 7 — UI Operating System Completion Archive V1 is recommended next.

UI-OS 7 is not started by UI-OS 6.
