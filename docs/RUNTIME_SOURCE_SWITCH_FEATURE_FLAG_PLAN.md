# Runtime Source Switch Feature Flag Plan

## Scope / Non-goals

Task 5.4 plans runtime source switch feature flags.

- This is documentation and static-test coverage only.
- This does not implement a runtime source selector.
- This does not implement API-backed runtime.
- This does not switch source of truth.
- This does not add localStorage replacement.
- This does not modify `App.tsx`.
- This does not add storage adapters, migration tools, dual-write, or offline mutation queue.
- This does not add production backend, auth, sync, cloud, deployment, or monitoring.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Current Baseline

At Task 5.4 entry, localStorage remains source of truth and default runtime source.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

API results never overwrite AppData or localStorage. Runtime source selection is not implemented by this task.

## Planned Runtime Source Modes

Future runtime source mode names:

- `localStorage`
- `api-readonly`
- `api-primary-dev`

No production API primary mode is approved in Phase 5.

## localStorage Mode

`localStorage` remains the default mode.

- App boots from browser localStorage.
- App writes use existing localStorage behavior unless a later task explicitly changes a narrow write path.
- Dev API diagnostics may still run when separately enabled.
- API results do not overwrite AppData or localStorage.
- This mode remains fallback and emergency recovery mode.

## api-readonly Mode

`api-readonly` is a future dev/local diagnostics mode.

- App may read safe API snapshot summaries for diagnostics after implementation and acceptance.
- App runtime source remains localStorage.
- API reads must be GET-only.
- No AppData overwrite is allowed.
- No localStorage write is allowed from API results.
- API unavailable must show visible diagnostics and keep the App usable from localStorage.

## api-primary-dev Mode

`api-primary-dev` is a future explicit dev/local runtime source mode.

- It must be disabled by default.
- It must require dev/local opt-in.
- It must require localhost Dev API.
- It must not be production-ready.
- It must not silently overwrite localStorage.
- It must show visible failure when API boot, read, or write fails.
- localStorage must remain fallback, migration source, and emergency recovery source.

## Flag Semantics

Suggested future flag:

`VITE_IRONPATH_RUNTIME_SOURCE`

Accepted future values:

- `localStorage`
- `api-readonly`
- `api-primary-dev`

Missing, empty, invalid, or production-like values must resolve to `localStorage`.

## Explicit Dev / Local Opt-in

Non-localStorage modes must require:

- `import.meta.env.DEV === true`
- localhost or `127.0.0.1` Dev API base URL
- explicit runtime source flag value
- safe failure when the Dev API is unavailable

Phase 5 must not introduce production runtime source selection.

## Fallback Behavior

- Default fallback is localStorage.
- API unavailable in `api-readonly` must leave App usable from localStorage.
- API unavailable in future `api-primary-dev` must show visible failure and offer documented fallback to localStorage.
- Fallback must not silently merge API data into localStorage.
- Fallback must not silently overwrite AppData.

## Decision

Plan three runtime source modes and keep localStorage as the default.

Next task: `Task 5.5 Migration Backup & Rollback Strategy V1`.

Task 5.5 must be docs/static tests only. It must not implement migration dry-run, migration apply, localStorage replacement, API-backed runtime, production backend/auth/sync/deployment, or a new browser mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.4-runtime-source-switch-feature-flag-plan` / pending until merge
- Decision: plan runtime source flag semantics before migration backup/rollback strategy.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: runtime source selector implementation, default API primary mode, production runtime source, localStorage replacement, silent AppData/localStorage overwrite, production backend/auth/sync/deployment, unapproved route expansion.
- Recommended next task: `Task 5.5 Migration Backup & Rollback Strategy V1`
- Rollback requirement: because this plan adds docs/static tests only, rollback is reverting the plan commit.

## Final Recommendation

Task 5.4 result: runtime source switch feature flag plan only.
localStorage remains default source of truth.
API results never overwrite AppData or localStorage.
No runtime source selector is implemented.
No API-backed runtime is implemented.
No production backend, auth, sync, cloud, deployment, or monitoring is added.
Next task should be Task 5.5 Migration Backup & Rollback Strategy V1.

## Task 5.5 Migration Backup & Rollback Follow-up

Task 5.5 adds `docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md` as a strategy document only.

- It requires backup-first migration planning.
- It covers localStorage backup, SQLite snapshot backup, dry-run, apply, rollback to localStorage, corrupt snapshot handling, and schema mismatch handling.
- It does not implement dry-run or apply.
- It keeps localStorage as source of truth.
- It recommends Task 5.6 Offline / PWA Conflict Strategy V1 as docs/static tests only.
