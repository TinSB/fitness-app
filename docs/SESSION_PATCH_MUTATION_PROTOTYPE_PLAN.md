# Session Patch Mutation Prototype Plan

## Scope / Non-goals

Task 5.13 plans a future dev-only browser prototype for `POST /sessions/active/patches`.

This is planning-only. It does not implement `POST /sessions/active/patches`, does not add a browser route, does not modify App.tsx, does not modify `src/devApi` runtime behavior, does not add a broad mutation client, does not implement session complete or discard, does not change source of truth, does not replace localStorage, does not add API primary runtime, and does not add production backend, auth, sync, cloud, deployment, package dependency, package script, normalized table, or training algorithm changes.

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Future Route

Future planned route:

- `POST /sessions/active/patches`

The route is not exposed from browser runtime by Task 5.13.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

## Future Opt-in Boundary

Future prototype must be dev-only and explicit opt-in:

- `import.meta.env.DEV === true`
- `VITE_IRONPATH_DEV_API_COMPARE === "1"`
- `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-patch"`
- localhost-only Dev API base URL

Other mutation flags must not enable session patch. Session patch flag must not enable data health dismiss, history data-flag, history edit, session start, session complete, or session discard.

## Patch Ordering Risk

Patch ordering must be explicit because applying patches out of order can corrupt active workout state.

The future request must include ordered patch identity or pending patch identity. The client must not reorder patches locally. The server response must be treated as authoritative diagnostic output only; API results must not overwrite AppData/localStorage.

## Stale Step and Set Risk

Stale step/set updates can overwrite current workout values.

Future prototype must include:

- activeSession id.
- active exercise index or stable target identity.
- target set identity when available.
- source snapshot hash.
- source snapshot version.
- request fingerprint.
- idempotency key.

Source mismatch must be visible failure with no fake success.

## Duplicate Patch Risk

Duplicate submit must be blocked while pending. A future duplicate response must be treated as visible failure or idempotent no-change only when strict success/no-change semantics are explicit.

No auto retry is allowed.

## Partial Update Risk

Partial update must not silently succeed. The future route must report:

- all requested patches applied.
- no patch applied.
- partial patch application rejected.
- validation warnings.

Strict success must require HTTP 2xx, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata.

## Current Set Corruption Risk

Current set, rest timer, focus mode, and active workout state are high risk.

Future prototype must not optimistically mutate activeSession. Future success must not update local AppData directly. Recovery is disabling the experiment and continuing from local App state.

## Request Payload Plan

Future request body should include:

```json
{
  "activeSessionId": "session-id",
  "pendingPatchId": "optional-pending-patch-id",
  "patches": [],
  "sourceSnapshotHash": "hash",
  "sourceSnapshotVersion": "version",
  "mutationId": "uuid",
  "idempotencyKey": "stable-key",
  "requestFingerprint": "fingerprint",
  "confirmed": true
}
```

The final Task 5.14 implementation may narrow this shape if existing server contract requires it, but it must not broaden into complete/discard or source-of-truth migration.

## No-fake-success Rules

Future prototype success requires:

- HTTP 2xx.
- `result.ok === true`.
- `result.changed === true`.
- `result.status === "success"`.
- snapshot metadata exists.

Visible failure states must include unavailable, timeout, abort, malformed response, active session missing, invalid patch, stale snapshot, source mismatch, duplicate submit, partial update, write failure, transaction failure, database closed, unsupported route, and missing snapshot metadata.

## Manual Acceptance Plan

Manual acceptance for the future prototype must require:

- dedicated test browser profile.
- dedicated dev DB.
- no real personal training data.
- experiment flag matrix.
- confirmation/cancel check.
- pending/duplicate-submit check.
- stale source failure check.
- no-fake-success failure checks.
- localStorage integrity check.
- DevTools Network route boundary check.
- cleanup and env reset.

## Still Blocked

Still blocked by this plan:

- `POST /sessions/active/patches` browser runtime implementation.
- `POST /sessions/active/complete`.
- `POST /sessions/active/discard`.
- DataHealth repair.
- backup/import/export over HTTP.
- reset/recovery over HTTP.
- source-of-truth migration.
- production backend/auth/sync/cloud/deployment.

## Decision

Plan `POST /sessions/active/patches` as the next route-specific active-session prototype candidate, but do not implement it in Task 5.13.

Next recommended task: `Task 5.14 Session Patch Mutation Prototype V1`.

Task 5.14 may implement only `POST /sessions/active/patches` if gates pass.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.13-session-patch-mutation-prototype-plan` / pending until merge
- Decision: plan a future dev-only session patch prototype.
- Future route: `POST /sessions/active/patches`
- Still blocked: session patch implementation, session complete, session discard, DataHealth repair, backup/import/export, reset/recovery, source-of-truth migration.
- Recommended next task: `Task 5.14 Session Patch Mutation Prototype V1`
- Rollback requirement: revert the Task 5.13 docs/static-test commit.

## Final Recommendation

Task 5.13 result: session patch prototype plan only.
No session patch browser route is implemented.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, and Session Start.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
Next task should be Task 5.14 Session Patch Mutation Prototype V1 only if gates pass.
