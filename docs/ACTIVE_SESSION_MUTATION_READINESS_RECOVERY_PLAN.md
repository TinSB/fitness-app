# Active Session Mutation Readiness & Recovery Plan

## Scope / Non-goals

This is an active-session mutation readiness and recovery plan.

- This is planning-only.
- This is not an active-session mutation implementation.
- This does not implement `POST /sessions/start`.
- This does not implement `POST /sessions/active/patches`.
- This does not implement `POST /sessions/active/complete`.
- This does not implement `POST /sessions/active/discard`.
- This does not add a fourth browser mutation route.
- This does not modify App.tsx.
- This does not modify src/devApi runtime behavior.
- This does not add App.tsx mutation integration.
- This does not add a frontend mutation client.
- This does not replace localStorage.
- This does not switch source of truth.
- This does not add offline mutation queue.
- This does not add production backend, auth, sync, or deployment.
- This does not add a dependency, lockfile change, package script, normalized table, storage adapter, schema change, or training algorithm change.

## Current Three-route Baseline

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

No other browser mutation route is accepted.

- DataHealth dismiss remains the first dev-only explicit opt-in mutation prototype.
- History data-flag remains the second dev-only explicit opt-in mutation prototype.
- Limited History Edit remains the third dev-only explicit opt-in mutation prototype.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- Read-only Dev API diagnostics remain GET-only.
- No session mutation route is exposed from browser code.
- No DataHealth repair, backup/import/export, reset/recovery, source-of-truth migration, or broad mutation client is exposed from browser code.

## Candidate Session Routes

Future active-session planning may analyze these routes, but Task 4.56 implements none of them:

| Candidate | Route | Task 4.56 status |
| --- | --- | --- |
| Session start | `POST /sessions/start` | Planning-only, blocked from browser runtime |
| Session patch | `POST /sessions/active/patches` | Planning-only, blocked from browser runtime |
| Session complete | `POST /sessions/active/complete` | Planning-only, blocked from browser runtime |
| Session discard | `POST /sessions/active/discard` | Planning-only, blocked from browser runtime |

## Active Session Risk Model

Active-session mutation is higher risk than the existing three accepted prototypes because it touches unsaved workout state.

- Session start creates active training state.
- Session patch changes in-progress set, exercise, rest, and adjustment state.
- Session complete converts active state into final history.
- Session discard can destroy unsaved training state.
- Duplicate start can create conflicting active sessions.
- Duplicate complete can create duplicate history or lose active state.
- Stale patches can overwrite newer local training values.
- Offline failures can leave the user unsure whether a workout was saved.
- API/localStorage mismatch can apply actions to the wrong active session.

## Source Snapshot Strategy

A future active-session prototype must define a source snapshot strategy before any browser route is enabled.

- Capture a local AppData source fingerprint before a request is sent.
- Include active session identity, active session revision, pending patch identity, and relevant history count in the planned source fingerprint.
- Reject mutation success when the source fingerprint is missing.
- Reject mutation success when the server snapshot does not correspond to the expected source.
- Treat source snapshot mismatch as visible failure, not success.
- Never merge API snapshot data into AppData.
- Never store API snapshot metadata in localStorage.
- Keep localStorage as the active App source of truth.

## Idempotency And Duplicate-submit Strategy

A future active-session prototype must define idempotency before implementation.

- Session start needs an idempotency key so repeated clicks do not create multiple active sessions.
- Session patch needs an operation id so repeated events do not duplicate or overwrite values unexpectedly.
- Session complete needs an idempotency key so repeated completion does not create duplicate history records.
- Session discard needs a discard operation id so repeated confirmation does not destroy unrelated state.
- Pending state must disable duplicate submit.
- No automatic retry is allowed.
- Retry after failure must require explicit user action.
- Success must not be shown optimistically while pending.

## Patch Sequencing And Conflict Strategy

Session patch is not ready until patch sequencing and conflict behavior are specified.

- Patch order must be explicit.
- Patch application must reject stale sequence numbers.
- Patch application must reject unknown active session ids.
- Patch application must reject unknown exercise or set ids.
- Patch application must reject broad history edits through the session patch route.
- Patch conflict must be visible failure.
- Patch conflict must not overwrite localStorage or AppData.
- Patch failure must not auto-apply a local repair.

## Offline / PWA Failure Strategy

Active-session mutation must remain conservative when the API is unavailable.

- No offline mutation queue exists.
- No dual-write strategy exists.
- API unavailable must show failure, not success.
- Timeout must show failure, not success.
- Abort/navigation-away must not show success.
- Browser refresh during pending must not imply completion.
- Offline retry must be explicit after the user reviews current local state.
- localStorage remains the active App source of truth during offline or failed API states.

## Recovery / Rollback Strategy

A future prototype must define manual recovery before implementation.

- Recovery guidance must be visible and safe.
- Recovery must not expose browser reset/recovery/import/export/apply/fix controls.
- Recovery must not dump raw AppData or localStorage.
- Recovery must not expose raw stack traces, SQLite internals, or environment objects.
- Session complete failure must define how to verify whether history was written.
- Session discard failure must define how to preserve or inspect unsaved local state.
- Session patch failure must define how to compare local active state with read-only diagnostics.
- Manual recovery should start with disabling the mutation experiment flag and preserving the dedicated test profile state.

## Confirmation UX Requirements

Future active-session mutation UX must be confirm-gated according to risk.

- Session start requires clear target template and source state display before request.
- Session patch requires clear before/after values when a patch can change recorded set fields.
- Session complete requires strong confirmation because it writes final history.
- Session discard requires strongest confirmation because it can destroy unsaved work.
- Confirmation copy must say localStorage remains source of truth.
- Confirmation copy must say API result does not overwrite AppData or localStorage.
- Changing the target session, target patch, or target route must clear stale confirmation.

## No-fake-success Requirements

No future active-session prototype may show success unless the strict success contract is satisfied.

- HTTP success is required.
- `result.ok === true` is required.
- `result.changed === true` is required.
- `result.status === "success"` is required.
- Snapshot metadata is required.
- Missing snapshot metadata is failure.
- source snapshot mismatch is failure.
- no_change is failure.
- record_not_found or session_not_found is failure.
- invalid patch is failure.
- requiresConfirmation is failure.
- write_failed, transaction_failed, database_closed, malformed response, timeout, unavailable, abort, and unsupported_route are failures.
- Failure must be visible.
- Failure must not write localStorage.
- Failure must not mutate AppData.

## ReadMirror / Data Semantics Impact

Active-session mutation planning must document readMirror and data semantics before implementation.

- Session start can affect active-session readMirror output.
- Session patch can affect in-progress set values and future completion data.
- Session complete can affect history, summaries, calendar, PR, e1RM, effectiveSet, and weighted effectiveSet output.
- Session discard can affect active-session presence without changing history.
- PR, e1RM, effectiveSet, and weighted effectiveSet rules remain unchanged by Task 4.56.
- `actualWeightKg` remains the trusted calculation source.
- `normal`, `test`, and `excluded` semantics remain unchanged.
- Backup import/export safety remains unchanged.

## Manual Acceptance Plan Requirements

Before any active-session prototype can be implemented, a manual acceptance plan must cover:

- dedicated test browser profile
- no real personal training data
- dedicated dev DB file
- read-only diagnostics before mutation flag
- session start flow
- session patch flow
- session complete flow
- session discard flow
- mutation experiment isolation
- duplicate-submit and pending lock
- no-fake-success failures
- API unavailable and timeout behavior
- localStorage integrity
- AppData non-overwrite behavior
- DevTools Network route boundary
- cleanup and env reset
- browser build safety

## Required Gates Before Any Active-session Prototype

- Task 4.56 remains green.
- Three-route regression lock remains green.
- Three-route manual regression remains valid.
- localStorage source-of-truth confirmed.
- Read-only diagnostics green.
- No-fake-success still green for all accepted prototypes.
- Active-session source snapshot strategy completed.
- Duplicate start, patch, complete, and discard behavior documented.
- Patch sequencing and idempotency documented.
- Unsaved session failure and recovery documented.
- Offline/PWA behavior documented.
- Confirmation UX planned.
- Rollback and recovery UX planned.
- Manual acceptance runbook planned.
- Browser route allowlist updated only in an explicit future prototype with user approval.
- No DataHealth repair, backup/import/export, reset/recovery, production backend, auth, sync, or source-of-truth migration.
- Browser build clean.

## Decision

Do not implement active-session mutation in Task 4.56.

Task 4.56 result is planning-only. The active-session area is plausible for future product value, but it requires a separate user-approved planning or prototype task before any browser route is added.

No automatic next task is approved by Task 4.56.

Any future `Task 4.57 Active Session Mutation Prototype Plan V1` must require explicit user approval before starting, must remain planning-only, and must not implement session routes unless a later implementation prompt explicitly approves one route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.56-active-session-mutation-readiness-recovery-plan` / pending until merge
- Decision: define active-session readiness and recovery gates; do not implement active-session mutation.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`
- Rejected next steps: direct active-session implementation, session start, session patch, session complete, session discard, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/deployment, source-of-truth migration, localStorage replacement, broad mutation client.
- Required gates: source snapshot strategy, idempotency, duplicate-submit prevention, patch sequencing, offline failure behavior, confirmation UX, rollback and recovery UX, manual acceptance plan, exact route allowlist lock, clean browser build.
- Next task: no automatic next task is approved; user approval is required before any Task 4.57.
- Risks: active session data loss, duplicate active sessions, duplicate history completion, stale patch corruption, unsaved discard, offline ambiguity, source-of-truth divergence, training metric drift, route expansion, production exposure, user confusion.
- Rollback requirement: because Task 4.56 adds docs/static tests only, rollback is reverting the plan commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 4.56 result: planning and recovery gates only.
No active-session mutation is implemented.
No fourth mutation route is implemented.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, and Limited History Edit.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No automatic next task is approved without explicit user approval.
