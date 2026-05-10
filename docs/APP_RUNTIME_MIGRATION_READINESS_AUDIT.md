# App Runtime Migration Readiness Audit

Task 4.18 answers whether IronPath is ready to move `App.tsx` from browser localStorage to the dev API stack. The answer is no: the current boundary work is ready for a read-only integration plan, not runtime migration.

## Scope / Non-goals

- This is a readiness audit and decision record.
- This is not App runtime migration.
- There is no App.tsx integration.
- There is no UI integration.
- There is no localStorage replacement.
- There is no frontend API client.
- There is no feature flag wiring.
- There is no production backend.
- There is no auth / sync / deployment.
- There are no normalized tables.
- There is no package dependency.
- There is no package script.
- There is no HTTP backup, import, reset, or delete endpoint.
- There is no change to training algorithms, templates, scheduler, PR/e1RM, effective-set rules, backup safety, or AppData semantics.

## Current Architecture Snapshot

Browser runtime:

- `App.tsx`
- `src/storage/persistence.ts` compatibility facade
- `src/storage/localStorageAdapter.ts`
- `AppData`

The browser runtime remains `App.tsx -> persistence facade -> localStorageAdapter -> AppData`. App runtime still uses localStorage.

Shared and pure boundaries:

- `appDataSanitize`
- `appDataMigration`
- `appDataValidation`
- `readMirror`
- `sessionMutation`
- `recordDataHealthMutation`

Node-only boundaries:

- `sqliteRepository`
- `serverAdapter`
- `httpRuntimeAdapter`
- `devLauncher`
- `devApiRunner`
- `devDbRecovery`

`apps/api/src/index.ts` remains browser-facing and safe. `apps/api/src/node/index.ts` is Node-only. The browser-facing API index does not export Node-only runtime values.

## Completed Gates From Task 4.0-4.17

- Pure persistence and storage boundaries are split and regression-tested.
- readMirror mirrors supported read routes without mutating AppData.
- sessionMutation and recordDataHealthMutation return `nextData` only for persisted-change candidates.
- SQLite snapshot repository supports Node-only round trips, backup parity, strict failure modes, schema guard, rollback safety, file-backed behavior, and close semantics.
- serverAdapter composes existing pure boundaries and writes snapshots only when `nextData` exists and `writeSnapshot` succeeds.
- httpRuntimeAdapter wraps serverAdapter with Node `http` parsing and stable JSON response contracts.
- createDevLocalApiLauncher starts the dev-only stack explicitly, localhost-only by default.
- devApiRunner provides a compiled JavaScript dev-only runner with deterministic ready output and graceful shutdown.
- Manual API and runner acceptance runbooks exist.
- devDbRecovery provides Node-only inspect, backup, and explicit confirm-gated reset safety for local `.sqlite` artifacts.
- Browser/Node isolation tests keep `src/**` and browser-facing `apps/api/src/index.ts` free of `node:http`, `node:sqlite`, and Node-only API modules.

## Remaining Blockers Before Any App.tsx Integration

- No frontend API client strategy.
- No feature-flag/runtime switch strategy.
- No localStorage to API source-of-truth strategy.
- No API to localStorage reconciliation strategy.
- No offline/PWA behavior strategy.
- No user data migration strategy.
- No conflict resolution strategy.
- No rollback strategy for a UI-connected prototype.
- No auth/privacy model.
- No production server/deployment model.
- No monitoring or diagnostics strategy.
- No UX fallback strategy when the API is unavailable.
- No manual acceptance for a read-only app prototype.
- No acceptance gate proving the UI can compare localStorage data with API data without writes.

## Risk Analysis

| Risk | Description | Severity | Mitigation | Required test gate |
| --- | --- | --- | --- | --- |
| Data loss risk | Switching the UI source before migration and rollback rules exist can hide or overwrite browser data. | High | Keep localStorage as default and avoid UI writes to API during read-only planning. | Read-only prototype acceptance plus backup/import regression. |
| Double-write risk | Writing to both localStorage and SQLite could create divergent histories. | High | Do not integrate mutation routes into App runtime until a write-source strategy exists. | Mutation integration readiness audit and no-API-write UI tests. |
| Stale localStorage vs SQLite snapshot risk | The dev DB may contain older snapshots than the browser storage. | Medium | Use dual-read comparison only and surface mismatches as diagnostics. | Dual-read parity report tests. |
| API unavailable risk | The dev runner may be stopped, closed, or blocked while the UI expects data. | Medium | Document visible fallback behavior and keep localStorage as usable default. | API-unavailable fallback acceptance. |
| PWA offline risk | PWA/offline behavior currently depends on local browser storage. | High | Do not make API primary until offline semantics are designed. | Offline/PWA readiness audit. |
| Accidental production exposure risk | A dev-only API without auth could be mistaken for production backend readiness. | High | Keep localhost-only defaults and no production deployment scripts. | Localhost safety and package script boundary tests. |
| Backup/import safety risk | HTTP backup/import could bypass existing local confirmation and validation. | High | Keep no backup import/export HTTP endpoint and preserve existing backup boundaries. | Backup import/export parity and route absence tests. |
| Corrupted dev DB risk | SQLite snapshot corruption or schema mismatch could confuse manual testing. | Medium | Use devDbRecovery inspect/backup/reset runbook with explicit confirmation. | Recovery/reset safety tests and manual checklist. |
| Browser bundle pollution risk | Importing Node-only modules from browser paths can break Vite/browser builds. | High | Keep Node-only exports under `apps/api/src/node/index.ts`. | Static isolation tests and `npm run build`. |
| User confusion risk | A visible API runner can make developers assume App runtime has migrated. | Medium | Document that runner/manual acceptance does not authorize migration. | Documentation consistency tests. |
| Debugging complexity risk | Multiple boundaries can obscure whether data came from localStorage or SQLite. | Medium | Require a read-only comparison plan before runtime code exists. | Task 4.19 plan review and parity acceptance. |

## Recommended Migration Path

The only recommended next task is `Task 4.19 Dev API Read-only App Integration Plan V1`.

Recommended sequence:

1. `Task 4.19 Dev API Read-only App Integration Plan V1`
2. `Task 4.20 Read-only App Integration Prototype V1`, behind an explicit dev-only flag
3. `Task 4.21 Read-only Runtime Parity Acceptance V1`
4. `Task 4.22 Mutation Integration Readiness Audit V1`
5. Later only after those gates: write-path integration prototype

After Task 4.18, do not directly do App.tsx migration. The next step is a read-only plan, not runtime code.

## Proposed Read-only Integration Principles

Any future read-only prototype must be:

- dev-only
- explicit opt-in
- localStorage-default
- comparison-oriented
- no writes from UI to API
- no mutation migration
- no backup import/export over HTTP
- no production server assumption
- no auth/sync assumption
- visible on API failure
- easy to roll back
- no silent data overwrite
- no automatic localStorage replacement
- no training algorithm changes

## Source-of-truth Strategy Options

### Option A: localStorage primary plus API read-only shadow

The UI continues to render from localStorage while an opt-in diagnostic path fetches API data for comparison.

Pros:

- Preserves the current source of truth.
- Avoids data loss from API/SQLite snapshot drift.
- Gives a clear rollback path.

Cons:

- Requires comparison reporting.
- Does not validate a full API-primary user experience.

### Option B: API primary read source plus localStorage fallback

The UI reads from the API when available and falls back to localStorage when unavailable.

Pros:

- Exercises the API read path in a more realistic way.

Cons:

- Introduces source-of-truth switching too early.
- Risks stale SQLite data becoming visible as current data.
- Makes offline/PWA behavior harder to reason about.

### Option C: dual-read comparison mode only

The UI remains localStorage-driven. A dev-only comparison mode reads both localStorage and the API, compares summaries, and reports differences without changing rendered source data.

Pros:

- Avoids source-of-truth switching.
- Avoids silent overwrite and double-write risk.
- Makes rollback trivial.
- Produces concrete parity evidence before UI data-flow changes.

Cons:

- It is not a user-facing migration.
- It requires a small comparison report design before any prototype.

Short-term recommendation: Option C. It is the safest next step because it does not make the API primary, does not write to API from the UI, and keeps App runtime still using localStorage while parity evidence is gathered.

## Required Acceptance Gates Before App Integration

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Dev runner manual acceptance passed.
- Recovery/reset checklist passed.
- Browser build has no `node:http` or `node:sqlite`.
- readMirror parity passed.
- API unavailable fallback plan documented.
- Rollback plan documented.
- No mutation route used by App runtime.
- No localStorage replacement.
- No frontend API client runtime wiring.
- No feature flag runtime wiring.
- No backup import/export over HTTP.

## Rollback Plan

- Remove the future dev-only opt-in flag or comparison entrypoint.
- Keep App runtime on localStorage.
- Stop the dev API runner.
- Use `docs/DEV_API_RECOVERY_RESET.md` to backup or reset the dev DB if needed.
- Do not mutate user data from API during the read-only phase.
- Do not undo a production migration because no production migration should exist.
- Do not roll back package dependencies because this audit adds none.
- Keep backup/import JSON workflows as the recovery path for browser data.

## Decision Record

- Date: 2026-05-10
- Branch / commit: record during manual acceptance
- Decision: Task 4.18 is a readiness audit only.
- Recommendation: Proceed to `Task 4.19 Dev API Read-only App Integration Plan V1`.
- Rejected next steps: direct App.tsx HTTP migration, frontend API client implementation, feature flag runtime wiring, localStorage replacement, API-primary reads, mutation integration, production backend work.
- Required next task: `Task 4.19 Dev API Read-only App Integration Plan V1`.
- Risks: data loss, double-write divergence, stale snapshots, offline/PWA regression, accidental production exposure, browser bundle pollution.
- Rollback plan: keep App runtime on localStorage, stop dev runner, use recovery/reset runbook for dev DB, and remove any future dev-only read comparison prototype.

## Final Recommendation

Task 4.18 result: Not ready for App.tsx migration. Ready for Task 4.19 Dev API Read-only App Integration Plan V1. Formal App.tsx HTTP migration remains blocked.
