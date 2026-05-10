# Limited History Edit Observability & Recovery Notes

Task 4.50 documents safe observability and manual recovery guidance for the existing dev-only Limited History Edit prototype.

## Scope / Non-goals

- [ ] Observe only the existing `POST /history/:id/edit` prototype.
- [ ] Do not add any new mutation route.
- [ ] Do not add a browser reset/recovery action.
- [ ] Do not add session mutation, DataHealth repair, backup/import/export/reset/recovery HTTP calls, or broad mutation clients.
- [ ] Do not change source of truth.
- [ ] Do not replace localStorage.
- [ ] Do not add production backend, auth, sync, deployment, normalized tables, package dependencies, package scripts, or lockfile changes.

## Accepted Browser Mutation Routes

- [ ] `POST /data-health/issues/:issueId/dismiss`
- [ ] `POST /history/:id/data-flag`
- [ ] `POST /history/:id/edit`

No other browser mutation route is accepted.

## Safe Diagnostic Fields

The prototype may show only safe diagnostic fields:

- [ ] Mutation state: idle, confirming, pending, success, or failure.
- [ ] Redacted target reference.
- [ ] Redacted source fingerprint presence.
- [ ] Snapshot metadata presence.
- [ ] HTTP status.
- [ ] Failure code.
- [ ] Duplicate-submit blocked flag.
- [ ] Started/finished timestamps.
- [ ] Safe recovery note.

The prototype must not show raw API responses, raw stack traces, full AppData, localStorage dumps, SQLite internals, environment objects, or unrestricted server errors.

## Failure Mapping

- [ ] unavailable: confirm the Dev API runner and localhost base URL.
- [ ] timeout: confirm the Dev API is responsive before retrying.
- [ ] abort: request was canceled or component unmounted; no local data changed.
- [ ] malformed response: inspect Dev API logs and response shape.
- [ ] invalid patch: use only constrained set fields.
- [ ] source fingerprint missing: rebuild read-only diagnostics before retrying.
- [ ] record_not_found: verify the history record still exists.
- [ ] exercise_not_found: verify the selected exercise still exists.
- [ ] set_not_found: verify the selected set still exists.
- [ ] no_change: rerun read-only diagnostics before retrying.
- [ ] source snapshot mismatch: rerun read-only diagnostics before retrying.
- [ ] write_failed or transaction_failed: stop the Dev API runner, make a dev DB copy, and inspect the dev DB before retrying.
- [ ] database_closed: restart the Dev API runner and rerun read-only diagnostics.
- [ ] snapshot validation or schema mismatch: stop the Dev API runner, make a dev DB copy, and inspect schema notes.
- [ ] unsupported_route: verify only the approved history set edit route is enabled.
- [ ] missing snapshot metadata: treat as failed persistence.

Every failure remains a failure in the browser prototype. There is no fake success and no automatic retry.

## Manual Recovery Boundary

- [ ] Disable `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT`.
- [ ] Stop the Dev API runner.
- [ ] Rerun read-only diagnostics.
- [ ] If persistence may be inconsistent, make a dev DB copy before inspection.
- [ ] Use existing dev DB recovery runbooks outside the browser UI.

The App must not recover by writing localStorage, overwriting AppData, replaying the API result, or exposing a reset/import/export/recovery button in the browser prototype.

## Source-of-truth Boundary

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. Snapshot metadata is not stored in localStorage by the prototype.

## Browser Build Boundary

Browser source and browser build output must remain free of `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.

## Task Result

Task 4.50 is observability/recovery-notes only. The next recommended task is Task 4.51 Limited History Edit Regression Lock V1.
