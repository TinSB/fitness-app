# Active Session Source Snapshot & Idempotency Plan

## Scope / Non-goals

Task 4.57 is a docs/static-tests plan for active-session source snapshot, idempotency, request fingerprint, conflict detection, and duplicate-submit protection.

- This is planning-only.
- This does not implement `POST /sessions/start`.
- This does not implement `POST /sessions/active/patches`.
- This does not implement `POST /sessions/active/complete`.
- This does not implement `POST /sessions/active/discard`.
- This does not add a fourth browser mutation route.
- This does not modify App.tsx or src/devApi runtime behavior.
- This does not add a frontend mutation client.
- This does not replace localStorage or switch source of truth.
- This does not add offline mutation queue, production backend, auth, sync, deployment, dependencies, scripts, lockfile changes, normalized tables, storage adapter changes, schema changes, or training algorithm changes.

## Current Route Baseline

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

Blocked browser mutation routes remain:

- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration

## Required Metadata Fields

A future active-session mutation request must carry browser-side metadata that is sufficient for safe diagnostics and duplicate-submit prevention.

| Field | Required purpose |
| --- | --- |
| `sourceSnapshotHash` | Stable hash of the local AppData source facts used to prepare the request. |
| `sourceSnapshotVersion` | Version string for the source snapshot algorithm. |
| `mutationId` | Unique per user-confirmed mutation attempt. |
| `idempotencyKey` | Stable key for one logical user action to prevent duplicate start. |
| `requestFingerprint` | Stable fingerprint of route, target identity, source snapshot, and payload. |

The metadata is diagnostic and safety gating data only. It must not make the API source of truth, must not write localStorage, and must not merge API results into AppData.

## Source Snapshot Inputs

The future session-start source snapshot should include only stable, non-secret source facts:

- activeSession presence and activeSession id when present
- activeProgramTemplateId
- selectedTemplateId
- target template id
- pending session patch ids for the target day/template
- history length and latest history id/date
- today key
- mutation experiment name
- source snapshot algorithm version

It must not include raw AppData dumps, localStorage dumps, full training history payloads, raw API responses, stack traces, SQLite internals, or environment objects.

## Target Identity

Future session start requests must identify the target explicitly:

- `templateId` is required when the user selects a plan template.
- `planTemplateId` or equivalent plan target identity must be captured when the start is tied to the current plan.
- `sessionStartTargetId` must be derived from route, template, day, and source snapshot metadata.
- Active-session target identity must confirm no existing local activeSession is present before request.

If target identity is missing or ambiguous, the future prototype must block submit before a request.

## Idempotency Strategy

The future session-start prototype must prevent duplicate start.

- `mutationId` is unique for each confirmed attempt.
- `idempotencyKey` is stable for one user-confirmed session-start action.
- `requestFingerprint` is stable for the same route, target, source snapshot, and payload.
- Duplicate click while pending must send exactly one request.
- Retry after failure must require explicit user action and a fresh confirmation.
- No automatic retry is allowed.
- No optimistic success is allowed.

Duplicate patch, complete, and discard risks remain documented but blocked from implementation. They require separate sequencing and recovery plans before any future prototype.

## Conflict Detection

Future active-session mutation must detect conflicts before showing success.

- Missing source snapshot metadata is failure.
- Missing `sourceSnapshotHash` is failure.
- Missing `sourceSnapshotVersion` is failure.
- Missing `mutationId` is failure.
- Missing `idempotencyKey` is failure.
- Missing `requestFingerprint` is failure.
- Existing local activeSession before session start is conflict.
- Server result `active_session_exists`, source mismatch, no_change, requiresConfirmation, unsupported_route, write_failed, transaction_failed, database_closed, timeout, unavailable, abort, malformed response, and missing snapshot metadata are failures.
- Conflict state must be visible and must not show success.

## No Auto-merge / Source-of-truth Boundary

- No auto-merge is allowed.
- API snapshots are not merged into AppData.
- API result data is not written to localStorage.
- Snapshot metadata is not stored in localStorage.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- Read-only diagnostics may be used to compare state, but comparison does not repair, sync, overwrite, import, export, reset, apply, or fix data.

## No-fake-success Contract

Future session start success must require:

- HTTP 2xx
- `result.ok === true`
- `result.changed === true`
- `result.status === "success"`
- snapshot metadata exists
- required source snapshot and idempotency metadata exists

Every missing condition is failure. Failure must not write localStorage, must not mutate AppData, must not auto-retry, must not expose raw stacks, and must not show optimistic success.

## Duplicate Patch / Complete / Discard Risks

Task 4.57 does not implement patch, complete, or discard.

- Duplicate patch can replay or overwrite in-progress set values.
- Duplicate complete can create duplicate history or lose active session state.
- Duplicate discard can destroy unsaved training state.
- Patch, complete, and discard require separate idempotency, sequencing, recovery, confirmation, and manual acceptance gates.

## Required Gates Before Session Start Prototype

- Task 4.57 source snapshot and idempotency plan merged.
- Task 4.58 UX confirmation and rollback plan merged.
- Task 4.59 session-start prototype plan merged.
- Three-route regression lock remains green.
- localStorage source-of-truth confirmed.
- Browser route allowlist remains exact until Task 4.60.
- No active patch/complete/discard browser route exists.
- Browser build remains clean.

## Decision

Task 4.57 result: source snapshot and idempotency planning only.

No active-session route is implemented. The next recommended task is `Task 4.58 Active Session UX Confirmation & Rollback Plan V1`, docs/static-tests only.

## Final Recommendation

Proceed to Task 4.58 only within the approved Phase 4 chain.
Do not implement `POST /sessions/start` until Task 4.60 and only if Tasks 4.57-4.59 gates remain green.

## Task 4.58 Active Session UX Confirmation & Rollback Plan V1 Follow-up

Task 4.58 adds `docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md` as planning-only follow-up.

It adds no active-session route and no fourth browser mutation route. It locks the UX requirements that sit on top of this source snapshot plan: explicit confirmation, pending state, duplicate start protection, visible safe failure, no optimistic success, no auto retry, rollback by disabling the mutation experiment flag, App usability on Dev API failure, and local App fallback from localStorage.

The next recommended task is Task 4.59 Session Start Mutation Prototype Plan V1, planning-only.

## Task 4.59 Session Start Mutation Prototype Plan V1 Follow-up

Task 4.59 adds `docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md` as planning-only follow-up.

It keeps `POST /sessions/start` blocked from browser runtime while defining the future one-route request shape, source snapshot metadata, idempotency metadata, request fingerprint, confirmation UX, duplicate start prevention, no-fake-success contract, manual recovery behavior, and manual acceptance requirements.

The next recommended task is Task 4.60 Session Start Mutation Prototype V1 only if gates pass.
