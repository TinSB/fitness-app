# Active Session UX Confirmation & Rollback Plan V1

Last updated: 2026-05-11

## Scope / Non-goals

Task 4.58 is a planning-only UX confirmation and rollback plan for future active-session mutation work.

This plan does not implement `POST /sessions/start`, `POST /sessions/active/patches`, `POST /sessions/active/complete`, or `POST /sessions/active/discard`.

This plan does not add runtime behavior, does not modify `App.tsx`, does not modify `src/devApi` runtime behavior, does not add a fourth browser mutation route, and does not add mutation feature flag wiring.

This plan does not replace localStorage, does not switch source of truth, does not add an offline mutation queue, does not add a broad frontend mutation client, and does not add production backend, auth, sync, or deployment.

The current accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

localStorage remains source of truth. API results must never overwrite AppData or localStorage.

## UX State Model

Any future session-start prototype must model these states explicitly:

- `disabled`: mutation flags are off, production-like build, non-localhost API URL, or required source snapshot metadata is missing.
- `ready`: a safe target template is visible, source snapshot metadata is present, and no local active session exists.
- `confirming`: the user has opened confirmation but no request has been sent.
- `pending`: exactly one request is in flight and submit controls are disabled.
- `succeeded`: success shape passed strict no-fake-success rules, with snapshot metadata.
- `failed`: failure is visible, safe, and does not expose raw stack, raw response, AppData, localStorage, or SQLite internals.

State transitions must reset stale confirmation when the target template, source snapshot hash, experiment flag, or Dev API base URL changes.

## Start Confirmation

Session start creates active training state, so a future prototype must require explicit user confirmation before the first POST.

The confirmation copy must state:

- which template or plan target will be started
- whether a local active session already exists
- that localStorage remains source of truth
- that the API result will not overwrite AppData or localStorage
- that the feature is dev-only and not production readiness

Cancel must prevent POST. Closing the confirmation must clear confirming state. Confirmation must not persist across target changes or failures.

## Duplicate Start Protection

A future session-start prototype must block duplicate starts at the browser boundary before relying on the server.

Required protections:

- one pending request per visible prototype instance
- disabled submit controls while pending
- repeated click sends one request
- repeated Enter or repeated event sends one request if keyboard submission exists
- `mutationId`, `idempotencyKey`, and `requestFingerprint` must be present before request dispatch
- retry after failure requires explicit user action and re-confirmation
- no automatic retry

Duplicate start is a data-loss risk because it can create conflicting active sessions or hide an existing local active session mismatch.

## Pending State

Pending state must be visible and must not imply success.

Acceptance rules for a future prototype:

- show pending while the request is in flight
- disable submit and target controls while pending
- keep App usable outside the prototype surface
- do not write localStorage during pending
- do not mutate AppData during pending
- release pending state after success, failure, timeout, unavailable, or abort
- do not update state after unmount

## Failure UX

Failure must be visible and safe.

Required visible failure categories:

- Dev API unavailable
- timeout
- abort or navigation-away cancellation
- malformed response
- active session already exists
- invalid target template
- source snapshot mismatch
- missing idempotency metadata
- requiresConfirmation
- write_failed
- transaction_failed
- database_closed
- unsupported_route
- missing snapshot metadata

Failure must not show raw stack traces, raw API responses, full AppData, localStorage dumps, SQLite paths, environment dumps, or unrestricted server internals.

## No Optimistic Success

Future session-start UX must never show optimistic success.

Success requires all of:

- HTTP 2xx
- `result.ok === true`
- `result.changed === true`
- `result.status === "success"`
- snapshot metadata exists

Anything else is failure. `active_session_exists`, `template_not_found`, source mismatch, missing metadata, no_change, write failure, transaction failure, database_closed, timeout, unavailable, abort, malformed response, and unsupported_route must not show success.

## No Auto Retry

Session start must not auto-retry after a failed request.

The user may retry only after:

- reading the visible failure
- confirming the target template still matches local App state
- confirming the source snapshot is still current
- explicitly confirming the action again

Automatic retry is blocked because active-session state can diverge between localStorage and a dev API snapshot after a failure.

## Rollback / Recovery UX

Rollback for Phase 4 remains manual and local-first.

Safe recovery path:

1. Disable `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT`.
2. Refresh the App.
3. Continue using local App state from localStorage.
4. Stop the Dev API runner if it is inconsistent.
5. Re-run read-only diagnostics after the dev snapshot is restored or reseeded.

The browser must not provide repair, sync, overwrite, import, export, reset, apply, fix, migrate, or recovery buttons for session start.

## App Usability On Dev API Failure

When the Dev API fails, the App must remain usable because localStorage remains the active source of truth.

Failure must not block local training workflows that already exist. It must not clear local active session state, change the active program template, remove pending session patches, or rewrite completed history.

## Local App Fallback

The fallback is the existing local App runtime.

There is no API-backed persistence adapter, no dual-write strategy, no source-of-truth switch, and no offline mutation queue. Disabling the experiment flag must return the App to local-only behavior.

## Route Boundary

Allowed browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

Blocked active-session routes:

- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Other blocked routes:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration

## Required Gates Before Session Start Prototype

Before any session-start prototype implementation:

- Task 4.57 source snapshot and idempotency metadata remain documented and tested.
- Task 4.58 confirmation, pending, failure, rollback, and recovery UX remain documented and tested.
- The future prototype plan defines the exact `POST /sessions/start` request payload.
- Confirmation copy is written before implementation.
- Duplicate-submit behavior is specified before implementation.
- No-fake-success behavior is specified before implementation.
- Manual acceptance plan is written before implementation.
- Browser route allowlist is updated only in the explicit future implementation task.
- No active patch, complete, discard, repair, backup, reset, recovery, or source-of-truth migration route is added.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.58-active-session-ux-confirmation-rollback-plan` / pending
- Decision: plan confirmation, pending, failure, rollback, and recovery UX before any session-start prototype
- Current accepted routes: DataHealth dismiss, History data-flag, Limited History Edit
- Rejected next steps: direct session mutation implementation, active patch, complete, discard, repair, backup/import/export, reset/recovery, source-of-truth migration
- Recommended next task: Task 4.59 Session Start Mutation Prototype Plan V1
- Risks: duplicate active sessions, unsaved training state loss, localStorage/API divergence, no-fake-success drift, confusing rollback expectations
- Rollback requirement: revert docs/static tests only; no runtime behavior was added

## Final Recommendation

Task 4.58 result: UX planning only.

No active-session route is implemented.

Browser mutation routes remain exactly DataHealth dismiss, History data-flag, and Limited History Edit.

localStorage remains source of truth, and API results never overwrite AppData or localStorage.

Next task should be Task 4.59 Session Start Mutation Prototype Plan V1, planning-only.

## Task 4.59 Session Start Mutation Prototype Plan V1 Follow-up

Task 4.59 adds `docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md` as planning-only follow-up.

It adds no session-start route and no fourth browser mutation route. It defines the future route `POST /sessions/start`, accepted request payload metadata, source snapshot/idempotency/fingerprint gates, confirmation UX, duplicate start prevention, strict no-fake-success, recovery behavior, and manual acceptance requirements before any implementation task.

The next recommended task is Task 4.60 Session Start Mutation Prototype V1 only if gates pass.
