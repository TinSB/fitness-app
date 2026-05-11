# Session Start Prototype Hardening V1

Last updated: 2026-05-11

## Scope / Non-goals

Task 4.63 hardens the existing dev-only Session Start prototype.

It does not add a new mutation route, does not add active patch/complete/discard, does not change source of truth, does not replace localStorage, and does not add production backend, auth, sync, deployment, package, lockfile, script, normalized table, broad mutation client, or training algorithm behavior.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData/localStorage.

## Hardened Behaviors

- Duplicate submit and pending lock remain enforced.
- Missing source snapshot or request fingerprint fails before request.
- Missing idempotency metadata fails before request.
- Existing active session blocks browser submit.
- Missing snapshot metadata is failure.
- HTTP 2xx without full success shape is failure.
- API unavailable, timeout, abort, malformed response, write_failed, transaction_failed, and database_closed are failures.
- Confirmation resets after success/failure and target/source changes.
- No localStorage write occurs.
- No AppData mutation occurs.
- No active patch, complete, discard, repair, backup/import/export, reset, or recovery browser route is added.

## No-fake-success Lock

Success requires all of:

- HTTP 2xx
- `result.ok === true`
- `result.changed === true`
- `result.status === "success"`
- snapshot metadata exists

Everything else is failure and must not show success.

## Recovery Boundary

Recovery remains manual and dev-only:

- Disable `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT`.
- Refresh the App.
- Continue from local App state in localStorage.
- Restart or reseed the Dev API runner as needed.

No browser repair, sync, overwrite, import, export, reset, apply, fix, migrate, patch, complete, or discard control is added.

## Decision

Task 4.63 result: hardening only.

The Session Start prototype remains one-route-only and dev-only.

Next task should be Task 4.64 Session Start Observability & Recovery Notes V1.

## Task 4.64 Observability Companion

Task 4.64 adds `docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md` as safe observability and manual recovery guidance for the same one-route Session Start prototype.

- It does not add a new mutation route.
- It does not add browser reset/recovery controls.
- It keeps active patch, complete, discard, repair, backup/import/export, reset/recovery, and source-of-truth migration blocked.
- It keeps localStorage as source of truth and keeps API results from overwriting AppData or localStorage.
- It recommends Task 4.65 Session Start Regression Lock V1 as the next task.
