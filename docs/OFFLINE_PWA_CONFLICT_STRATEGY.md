# Offline / PWA Conflict Strategy

## Scope / Non-goals

Task 5.6 plans offline and PWA conflict behavior for Phase 5.

- This is documentation and static-test coverage only.
- This does not implement offline mutation queue.
- This does not implement API-backed runtime.
- This does not switch source of truth.
- This does not add localStorage replacement.
- This does not implement migration dry-run or migration apply.
- This does not modify `App.tsx`.
- This does not add production backend, auth, sync, cloud, deployment, or monitoring.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Current Baseline

At Task 5.6 entry, localStorage remains source of truth and default runtime source.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

API results never overwrite AppData or localStorage. No full offline mutation queue is approved by this task.

## API Unavailable Strategy

When the Dev API is unavailable:

- `localStorage` mode remains usable.
- future `api-readonly` mode must show visible diagnostics and keep local App data active.
- future `api-primary-dev` mode must show visible failure for API-owned reads or writes.
- no fake success is allowed.
- no automatic source switch is allowed.
- no automatic localStorage overwrite is allowed.

## Offline Training Strategy

Offline training must preserve local safety:

- localStorage remains the safe fallback for offline App usage.
- offline active session work must not be silently replayed to API.
- user-visible recovery must explain whether API writes were skipped, failed, or not attempted.
- offline work must not create hidden dual-write state.
- manual acceptance must use a dedicated test browser profile and no real personal training data.

## Active Session Persistence Strategy

Active session state is high risk because it may contain unsaved workout work.

- active session start remains accepted from Phase 4.
- active session patch, complete, and discard remain future Phase 5 route candidates only until their tasks implement them.
- active session API failure must leave the App usable from localStorage unless a later explicit `api-primary-dev` task changes that behavior.
- duplicate or stale active-session operations must be visible conflict states.
- no automatic merge is approved.

## Offline Mutation Queue Decision

No full offline mutation queue is approved in Phase 5 unless a later task explicitly approves it.

Reasons:

- queued active-session writes can reorder patches.
- queued complete/discard can destroy or duplicate unsaved training state.
- queued history edits can conflict with migration state.
- queued writes require idempotency, conflict resolution, recovery UI, and durable queue storage.

Task 5.6 does not add queue storage, replay, retry, or background sync.

## Visible Failure State

Failures must be visible and safe:

- API unavailable.
- timeout.
- aborted request.
- stale source snapshot.
- source-of-truth mismatch.
- queued write rejected because queue is not supported.
- localStorage fallback active.

Failure UI must not expose raw stack traces, raw API responses, AppData dumps, localStorage dumps, SQLite internals, or personal training data dumps.

## Conflict Diagnostics

Conflict diagnostics should be safe and redacted:

- runtime source mode.
- API availability.
- local snapshot version or hash presence.
- API snapshot metadata presence.
- target route and redacted target identity.
- idempotency metadata presence.
- conflict code.
- recommended manual recovery path.

Diagnostics must not apply repairs, overwrite data, sync automatically, reset data, or run recovery actions from browser UI.

## Source-of-truth Boundary

- No source-of-truth switch is implemented by Task 5.6.
- localStorage remains source of truth.
- Future `api-primary-dev` must be explicit dev/local opt-in.
- Offline/PWA behavior must be accepted before API primary dev mode becomes usable.
- Production offline sync is Phase 6+ work.

## Decision

Do not implement an offline mutation queue in Task 5.6.

Next task: `Task 5.7 API-backed Read Runtime Plan V1`.

Task 5.7 must be docs/static tests only. It must not implement API-backed read runtime, runtime source selection, offline mutation queue, localStorage replacement, production backend/auth/sync/deployment, or a new browser mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.6-offline-pwa-conflict-strategy` / pending until merge
- Decision: plan offline/PWA conflict handling before API-backed read runtime planning; keep full offline mutation queue blocked.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: offline mutation queue implementation, background sync, automatic replay, automatic source switch, localStorage overwrite, production offline sync, production backend/auth/sync/deployment, unapproved route expansion.
- Recommended next task: `Task 5.7 API-backed Read Runtime Plan V1`
- Rollback requirement: because this strategy adds docs/static tests only, rollback is reverting the strategy commit.

## Final Recommendation

Task 5.6 result: offline/PWA conflict strategy only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No offline mutation queue is implemented.
No source-of-truth switch is implemented.
No API-backed runtime is implemented.
No production backend, auth, sync, cloud, deployment, or monitoring is added.
Next task should be Task 5.7 API-backed Read Runtime Plan V1.

## Task 5.7 API-backed Read Runtime Follow-up

Task 5.7 adds `docs/API_BACKED_READ_RUNTIME_PLAN.md` as a read-runtime plan only.

- It covers boot data from API snapshot, localStorage fallback, API unavailable UI, snapshot metadata display, readMirror parity, and GET-only boundaries.
- It does not implement API-backed read runtime.
- It does not add POST writes.
- It does not implement runtime source switching.
- It recommends Task 5.8 API-backed Read Client Prototype V1 as the first GET-only prototype step.
