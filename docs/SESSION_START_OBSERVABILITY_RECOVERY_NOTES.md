# Session Start Observability & Recovery Notes

Task 4.64 documents safe observability and manual recovery guidance for the existing dev-only Session Start prototype.

## Scope / Non-goals

- [ ] Observe only the existing `POST /sessions/start` prototype.
- [ ] Do not add any new mutation route.
- [ ] Do not add a browser reset/recovery action.
- [ ] Do not add active patch, complete, discard, DataHealth repair, backup/import/export/reset/recovery HTTP calls, or broad mutation clients.
- [ ] Do not change source of truth.
- [ ] Do not replace localStorage.
- [ ] Do not add production backend, auth, sync, deployment, normalized tables, package dependencies, package scripts, or lockfile changes.

## Accepted Browser Mutation Routes

- [ ] `POST /data-health/issues/:issueId/dismiss`
- [ ] `POST /history/:id/data-flag`
- [ ] `POST /history/:id/edit`
- [ ] `POST /sessions/start`

No other browser mutation route is accepted.

## Safe Diagnostic Fields

The prototype may show only safe diagnostic fields:

- [ ] Mutation state: idle, confirming, pending, success, or failure.
- [ ] Redacted target reference.
- [ ] Source snapshot hash presence.
- [ ] Source snapshot version.
- [ ] Request fingerprint and idempotency presence.
- [ ] Snapshot metadata presence.
- [ ] HTTP status.
- [ ] Failure code.
- [ ] Duplicate-submit blocked flag.
- [ ] Started/finished timestamps.
- [ ] Safe recovery note.

The prototype must not show raw API responses, raw stack traces, full AppData, localStorage dumps, SQLite internals, environment objects, idempotency secrets beyond safe presence, or unrestricted server errors.

## Failure Mapping

- [ ] fetch unavailable: browser fetch is unavailable, so the App remains local-only.
- [ ] unavailable: confirm the Dev API runner and localhost base URL.
- [ ] timeout: confirm the Dev API is responsive before retrying after explicit confirmation.
- [ ] abort: request was canceled or component unmounted; no local data changed.
- [ ] malformed response: inspect Dev API logs and response shape.
- [ ] missing snapshot metadata: treat as failed persistence.
- [ ] source snapshot missing: rebuild source snapshot and confirm again.
- [ ] idempotency missing: rebuild request fingerprint and confirm again.
- [ ] invalid target or template not found: verify the local template still exists before retrying.
- [ ] active_session_exists: disable the experiment or refresh diagnostics before retrying.
- [ ] write_failed or transaction_failed: stop the Dev API runner, make a dev DB copy, and inspect the dev DB before retrying.
- [ ] database_closed: restart the Dev API runner and rerun read-only diagnostics.
- [ ] unsupported_route: verify only the approved session start experiment is enabled.

Every failure remains a failure in the browser prototype. There is no fake success and no automatic retry.

## Manual Recovery Boundary

- [ ] Disable `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT`.
- [ ] Stop the Dev API runner.
- [ ] Rerun read-only diagnostics.
- [ ] If persistence may be inconsistent, make a dev DB copy before inspection.
- [ ] Use existing dev DB recovery runbooks outside the browser UI.
- [ ] Continue from local App state in localStorage.

The App must not recover by writing localStorage, overwriting AppData, replaying the API result, starting active patch/complete/discard, or exposing a repair/sync/overwrite/import/export/reset/apply/fix/recovery button in the browser prototype.

## Source-of-truth Boundary

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. Snapshot metadata is not stored in localStorage by the prototype.

## Browser Build Boundary

Browser source and browser build output must remain free of `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.

## Task Result

Task 4.64 is observability/recovery-notes only. The next recommended task is Task 4.65 Session Start Regression Lock V1.

## Task 4.65 Regression Lock Companion

Task 4.65 adds `docs/SESSION_START_REGRESSION_LOCK.md` for the existing dev-only Session Start prototype.

- It does not add a new mutation route.
- It does not expand runtime write capability beyond the accepted four-route set.
- It keeps active patch, complete, discard, repair, backup/import/export, reset/recovery, and source-of-truth migration blocked.
- It keeps localStorage as source of truth and keeps API results from overwriting AppData or localStorage.
- It recommends Task 4.66 Write-path Four-route Checkpoint V1 as the next task.
