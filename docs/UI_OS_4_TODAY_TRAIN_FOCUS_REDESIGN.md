# UI-OS 4 Today / Train / Focus Mode Redesign V1

## Task Identity

UI-OS 4 redesigns the highest-value daily training surfaces inside the real UI-OS shell:

- Today
- Train
- Focus Mode

This is a presentational redesign only. It does not change training algorithms, warmup generation, source-of-truth behavior, persistence behavior, routes, cloud behavior, package dependencies, package scripts, or lockfiles.

## Baseline Evidence

UI-OS 3 Codex App Shell Integration is complete.

- PR #275
- Merge commit `5e1a76fb173d79439f61cf235ab886dffa093a0f`
- `npm test` passed: 1104 files / 4504 tests
- `npm run api:dev:build` passed
- `npm run typecheck` passed
- `npm run build` passed
- dist token scan clean

UI-OS 3 added `MobileAppShell`, `BottomNav`, `PageContainer`, `AppTopBar`, `LocalFirstSafetyStrip`, and real `App.tsx` shell integration while preserving existing pages.

## What Changed

UI-OS 4 adds the first real training-flow redesign layer on top of the UI-OS shell.

- `TodayView` now uses a near-black, glass-style daily training hero with clearer daily recommendation, start/continue action, focus override, recovery/readiness context, and active/unfinished session treatment.
- `TrainingFocusView` makes the current exercise, current set, feasible recommendation, actual input, and primary completion action visually dominant.
- `TrainingView` keeps the full-session table/detail workflow but gives the current set a stronger equipment-aware prescription surface.
- Shared UI-OS training surfaces were added for the daily hero, focus override, focus hero, set prescription, actual set input, action bar, and unfinished-session notice.

## Preserved Logic

UI-OS 4 does not change:

- training engine logic
- warmup generation
- set generation
- saved set values
- session mutation payloads
- PR / e1RM / effective-set calculations
- equipment-aware load engine logic
- source-of-truth behavior
- persistence behavior
- AppData schema
- stored workout history

The existing equipment-aware actionable prescription path remains the source for the primary prescription display and apply-suggestion behavior. Bench Press warmup theoretical 17 lb still resolves to empty Olympic bar 45 lb for the primary actionable display, while the theoretical 17 lb remains available only as detail.

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

UI-OS 5 — History / Progress / Data Health Redesign V1 is recommended next.

UI-OS 5 is not started by UI-OS 4.
