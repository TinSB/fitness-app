# UI-OS 5 History / Progress / Data Health Redesign V1

## Task Identity

UI-OS 5 redesigns History, Progress, and Data Health presentation surfaces so they feel like a personal training app instead of a technical/debug dashboard.

This is a presentational redesign only.

## Baseline Evidence

UI-OS 4 Today / Train / Focus Mode Redesign is complete.

- PR #276
- Merge commit `423630e96d9fa31344534ecd080bcd598ed3b5de`
- `npm test` passed: 1106 files / 4514 tests
- `npm run api:dev:build` passed
- `npm run typecheck` passed
- `npm run build` passed
- dist token scan clean

## What Changed

- History now has a stronger training-record overview and readable workout timeline/card treatment.
- Progress now adds plain-language insight cards around existing PR / e1RM / effective-set / volume outputs.
- Data Health issue cards are calmer and owner-facing, with severity and safe next action visible.
- Empty states and timeline copy emphasize that training was recorded and can be reviewed safely.

## Preserved Calculations And Behavior

UI-OS 5 does not change:

- history data model
- session edit/delete/data-flag confirmation paths
- PR calculations
- e1RM calculations
- effective-set calculations
- analytics engines
- `buildPrs`
- `buildE1RMProfile`
- `buildEffectiveVolumeSummary`
- `buildDataHealthViewModel`
- Data Health repair semantics
- source-of-truth behavior
- persistence behavior
- routes
- package dependencies, package scripts, or lockfiles

`POST /data-health/repair/apply` remains blocked. Data Health does not perform automatic repair, destructive repair, cloud upload, or background diagnostics upload.

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
- no new package/dependency/script/lockfile drift beyond Phase 12 authorized @supabase/supabase-js.
- pnpm-lock.yaml remains absent and package-lock.json remains the npm lockfile.

## Accepted Browser Mutation Routes

The accepted browser mutation routes remain exactly:

1. POST /data-health/issues/:issueId/dismiss
2. POST /history/:id/data-flag
3. POST /history/:id/edit
4. POST /sessions/start
5. POST /sessions/active/patches
6. POST /sessions/active/complete
7. POST /sessions/active/discard

No eighth browser mutation route is added. `POST /data-health/repair/apply`, backup/import/export over HTTP, reset/recovery over HTTP, default cloud sync, background sync, production deployment runtime, external monitoring upload, and SaaS/multi-user runtime remain blocked.

## Recommended Next Task

UI-OS 6 — Settings / Safety / Equipment Profile Redesign V1 is recommended next.

UI-OS 6 is not started by UI-OS 5.
