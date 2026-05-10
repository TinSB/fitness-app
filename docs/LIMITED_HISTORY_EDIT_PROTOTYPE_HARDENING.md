# Limited History Edit Prototype Hardening

Task 4.49 hardens the existing dev-only Limited History Edit prototype without adding mutation capability.

## Scope / Non-goals

- [ ] Harden only the existing `POST /history/:id/edit` prototype.
- [ ] Do not add any new mutation route.
- [ ] Do not expand runtime write capability beyond the accepted three-route set.
- [ ] Do not change source of truth.
- [ ] Do not replace localStorage.
- [ ] Do not add production backend, auth, sync, deployment, normalized tables, package dependencies, package scripts, or lockfile changes.

## Accepted Browser Mutation Routes

- [ ] `POST /data-health/issues/:issueId/dismiss`
- [ ] `POST /history/:id/data-flag`
- [ ] `POST /history/:id/edit`

No other browser mutation route is accepted.

## Hardening Locks

- [ ] Success requires HTTP success.
- [ ] Success requires `result.ok === true`.
- [ ] Success requires `result.changed === true`.
- [ ] Success requires `result.status === "success"`.
- [ ] Success requires snapshot metadata.
- [ ] Missing result is failure.
- [ ] Missing snapshot metadata is failure.
- [ ] Malformed response is failure.
- [ ] Error response is failure.
- [ ] no_change is failure in the browser prototype.
- [ ] record_not_found is failure.
- [ ] exercise_not_found is failure.
- [ ] set_not_found is failure.
- [ ] invalid patch is failure.
- [ ] requiresConfirmation is failure.
- [ ] write_failed is failure.
- [ ] transaction_failed is failure.
- [ ] database_closed is failure.
- [ ] unsupported_route is failure.
- [ ] Source fingerprint missing is failure.
- [ ] Duplicate submit is blocked while pending.
- [ ] Confirmation is required before submit.
- [ ] Confirmation resets after success/failure and target or patch changes.
- [ ] API results never overwrite AppData or localStorage.
- [ ] Snapshot metadata is not stored in localStorage.

## Data Semantics Locks

- [ ] `actualWeightKg` remains trusted.
- [ ] `displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`.
- [ ] `dataFlag` is rejected through the edit route.
- [ ] Active session mutation is rejected.
- [ ] Direct `editHistory` writes are rejected.
- [ ] Derived summaries are rejected.
- [ ] PR rules remain unchanged.
- [ ] e1RM rules remain unchanged.
- [ ] effective-set rules remain unchanged.
- [ ] Backup/import safety semantics remain unchanged.

## Browser Build Locks

- [ ] Browser source stays free of Node-only runtime imports.
- [ ] Browser build stays free of `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.

## Task Result

Task 4.49 is hardening-only. The next recommended task is Task 4.50 Limited History Edit Observability & Recovery Notes V1.

## Task 4.50 Observability / Recovery Companion

Task 4.50 adds `docs/LIMITED_HISTORY_EDIT_OBSERVABILITY_RECOVERY_NOTES.md` for safe observability and manual recovery guidance on the existing dev-only prototype.

- It does not add a new mutation route.
- It does not expand runtime write capability beyond the accepted three-route set.
- It keeps recovery outside browser write capability.
- It keeps localStorage as source of truth and keeps API results from overwriting AppData or localStorage.
- It recommends Task 4.51 Limited History Edit Regression Lock V1 as the next task.
