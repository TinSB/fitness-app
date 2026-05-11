# Session Start Mutation Prototype Plan V1

Last updated: 2026-05-11

## Scope / Non-goals

Task 4.59 is a planning-only prototype plan for a possible future dev-only `POST /sessions/start` browser mutation.

This task does not implement `POST /sessions/start`.

This task does not implement `POST /sessions/active/patches`, `POST /sessions/active/complete`, or `POST /sessions/active/discard`.

This task does not add runtime behavior, does not modify `App.tsx`, does not modify `src/devApi` runtime behavior, does not add mutation feature flag wiring, and does not add a fourth browser mutation route.

This task does not replace localStorage, does not switch source of truth, does not add offline mutation queue, does not add a broad frontend mutation client, and does not add production backend, auth, sync, or deployment.

The current accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

localStorage remains source of truth. API results must never overwrite AppData or localStorage.

## Future Route

The only future route allowed by this plan is:

- `POST /sessions/start`

This route remains blocked from browser runtime until an explicit Task 4.60 implementation branch.

No future session patch, complete, discard, repair, backup/import/export, reset/recovery, or source-of-truth migration route is approved by this plan.

## Proposed Opt-in Gates

A future prototype may appear only when all gates are true:

- `import.meta.env.DEV === true`
- `VITE_IRONPATH_DEV_API_COMPARE === "1"`
- `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-start"`
- `VITE_IRONPATH_DEV_API_BASE_URL` is localhost or 127.0.0.1
- source snapshot metadata is present
- idempotency metadata is present
- no local active session exists
- a stable session-start target template exists

Compare flag alone must not enable session start. Other mutation experiment flags must not enable session start. The session-start flag must not enable DataHealth dismiss, History data-flag, or Limited History Edit.

## Accepted Request Payload Shape

A future browser request must send the smallest server-compatible start target plus browser-side safety metadata:

```json
{
  "templateId": "string",
  "sourceSnapshotHash": "string",
  "sourceSnapshotVersion": "phase4-active-session-v1",
  "mutationId": "string",
  "idempotencyKey": "string",
  "requestFingerprint": "string",
  "confirmed": true
}
```

Required metadata fields:

- `sourceSnapshotHash`
- `sourceSnapshotVersion`
- `mutationId`
- `idempotencyKey`
- `requestFingerprint`

The browser prototype must reject a request before dispatch if any required metadata field is missing or blank.

## Source Snapshot / Fingerprint Contract

The future prototype must derive the source snapshot from local AppData, never from a server response.

Snapshot inputs should include:

- local activeSession presence and id
- activeProgramTemplateId
- selected or target template id
- pending session patch ids
- history length and latest stable history id/date
- current mutation experiment name
- source snapshot version

The request fingerprint must be derived from the target identity plus source snapshot metadata. It must not include full AppData, localStorage dumps, raw history bodies, or sensitive environment values.

## Target Identity

The session-start target identity must include:

- `templateId`
- template title or safe display label
- source activeProgramTemplateId when present
- absence of local activeSession before request
- current sourceSnapshotHash

A future prototype must block submit when the target template is missing, unstable, or no longer matches the source snapshot.

## Confirmation UX

The future prototype must require explicit confirmation before POST.

Confirmation copy must state:

- the target template being started
- local active session status
- that the feature is dev-only
- that localStorage remains source of truth
- that API results never overwrite AppData/localStorage
- that the user can recover by disabling the mutation experiment flag

Cancel prevents POST. Changing the target template, source snapshot, Dev API base URL, or experiment flag clears stale confirmation.

## Duplicate Start Prevention

A future prototype must block duplicate start before dispatch:

- one pending request per prototype instance
- submit disabled while pending
- repeated click sends one request
- repeated keyboard event sends one request if keyboard submission exists
- retry after failure requires explicit user action and re-confirmation
- no automatic retry

The browser must include `mutationId`, `idempotencyKey`, and `requestFingerprint` in every dispatched request.

## Strict No-fake-success Contract

Success requires all of:

- HTTP 2xx
- `result.ok === true`
- `result.changed === true`
- `result.status === "success"`
- snapshot metadata exists

Failure must be shown for:

- Dev API unavailable
- timeout
- abort
- malformed response
- active session already exists
- invalid template/session target
- source mismatch
- missing source snapshot metadata
- missing idempotency metadata
- requiresConfirmation
- write_failed
- transaction_failed
- database_closed
- unsupported_route
- missing snapshot metadata

Failure must not show success, must not auto-retry, must not write localStorage, and must not mutate AppData.

## Recovery Behavior

Recovery remains manual and local-first:

1. Disable `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT`.
2. Refresh the App.
3. Continue from local App state in localStorage.
4. Stop the Dev API runner if it is inconsistent.
5. Re-run read-only diagnostics or reseed the dev DB before retrying.

The browser must not add repair, sync, overwrite, import, export, reset, apply, fix, migrate, or recovery controls.

## Manual Acceptance Plan

Task 4.61 or 4.62 must add manual acceptance before treating session start as accepted.

Manual acceptance must cover:

- dedicated test browser profile
- dedicated dev DB
- no real personal training data
- flag matrix
- no stable target
- confirmation and cancel
- duplicate start
- strict success shape
- failure/no-fake-success
- localStorage integrity
- DevTools Network route boundary
- cleanup/env reset

## Route Boundary

Current accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

Future Task 4.60 may add exactly one new route if all gates pass:

- `POST /sessions/start`

Still blocked:

- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration

## Required Gates Before Task 4.60

Task 4.60 may start only if:

- Task 4.57 source snapshot/idempotency plan remains green.
- Task 4.58 UX confirmation/rollback plan remains green.
- Task 4.59 prototype plan remains green.
- Three-route regression lock remains green.
- Browser build remains clean.
- localStorage source-of-truth remains confirmed.
- No source-of-truth migration, broad mutation client, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, or training algorithm change is required.

If safe implementation requires server-side idempotency persistence, broad App rewrite, localStorage reconciliation, source-of-truth switch, server contract rewrite, or active patch/complete/discard implementation, Task 4.60 must stop as blocked.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.59-session-start-mutation-prototype-plan` / pending
- Decision: define a future one-route dev-only session-start prototype plan
- Current accepted routes: DataHealth dismiss, History data-flag, Limited History Edit
- Future planned route: `POST /sessions/start` only if Task 4.60 gates pass
- Rejected routes: active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, source-of-truth migration
- Recommended next task: Task 4.60 Session Start Mutation Prototype V1
- Risks: duplicate start, local active-session mismatch, stale source snapshot, no-fake-success drift, rollback confusion
- Rollback requirement: revert docs/static tests only; no runtime behavior was added

## Final Recommendation

Task 4.59 result: prototype planning only.

No session-start route is implemented in this task.

Browser mutation routes remain exactly DataHealth dismiss, History data-flag, and Limited History Edit.

localStorage remains source of truth, and API results never overwrite AppData or localStorage.

Next task should be Task 4.60 Session Start Mutation Prototype V1 only if gates pass.
