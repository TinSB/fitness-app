# Session Start Prototype Acceptance V1

Last updated: 2026-05-11

## Scope / Non-goals

- [ ] This accepts the existing dev-only Session Start prototype.
- [ ] This does not add another browser mutation route.
- [ ] This does not implement active patch, complete, or discard.
- [ ] This does not switch source of truth.
- [ ] This does not replace localStorage.
- [ ] This does not add production backend, auth, sync, or deployment.
- [ ] This does not add a broad mutation client.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Flag Matrix Acceptance

- [ ] DEV false: Session Start prototype is disabled.
- [ ] Compare flag off: Session Start prototype is disabled.
- [ ] Compare flag on only: read-only diagnostics may run, mutation prototype is absent.
- [ ] Wrong mutation flag: Session Start prototype is disabled.
- [ ] `datahealth-dismiss` flag does not enable Session Start.
- [ ] `history-data-flag` flag does not enable Session Start.
- [ ] `limited-history-edit` flag does not enable Session Start.
- [ ] `session-start` flag does not enable the other prototypes.
- [ ] Non-localhost Dev API base URL is invalid.
- [ ] Production build remains disabled.

## No Stable Target Acceptance

- [ ] No template target: no request can be sent.
- [ ] Existing local active session: no request can be sent.
- [ ] Missing source snapshot hash: no request can be sent.
- [ ] Missing idempotency metadata: no request can be sent.
- [ ] Empty or unstable template id: no request can be sent.

## Confirmation / Cancel Acceptance

- [ ] No POST before explicit confirmation.
- [ ] Cancel clears confirmation and prevents POST.
- [ ] Changing target/source snapshot clears stale confirmation.
- [ ] Confirmation copy states this is dev-only.
- [ ] Confirmation copy states localStorage remains source of truth.
- [ ] Confirmation copy states API results do not overwrite AppData/localStorage.

## Pending / Duplicate Start Acceptance

- [ ] Pending state is visible.
- [ ] Submit is disabled while pending.
- [ ] Repeated click while pending sends one request.
- [ ] Repeated keyboard event, if wired, sends one request.
- [ ] No optimistic success is shown while pending.
- [ ] Failure releases pending state.
- [ ] Retry after failure requires explicit user action and confirmation.
- [ ] No automatic retry occurs.

## Strict Success Acceptance

Success requires all of:

- [ ] HTTP 2xx
- [ ] `result.ok === true`
- [ ] `result.changed === true`
- [ ] `result.status === "success"`
- [ ] snapshot metadata exists

Success must not update local AppData, must not write localStorage, and must not claim production sync.

## Failure / No-fake-success Acceptance

- [ ] API unavailable shows failure.
- [ ] Timeout shows failure.
- [ ] Abort/cancel/unmount does not show success.
- [ ] Malformed response shows failure.
- [ ] `active_session_exists` shows failure.
- [ ] `template_not_found` shows failure.
- [ ] Source mismatch or missing source snapshot shows failure.
- [ ] Missing idempotency metadata shows failure.
- [ ] `requiresConfirmation` shows failure.
- [ ] `write_failed` shows failure.
- [ ] `transaction_failed` shows failure.
- [ ] `database_closed` shows failure.
- [ ] `unsupported_route` shows failure.
- [ ] Missing snapshot metadata shows failure.
- [ ] No raw stack, raw response, AppData dump, localStorage dump, or SQLite internals are shown.

## LocalStorage Integrity Acceptance

- [ ] Prototype does not call `saveData`.
- [ ] Prototype does not call `loadData`.
- [ ] Prototype does not call `localStorageAdapter`.
- [ ] Prototype does not call `localStorage.setItem`.
- [ ] API result never overwrites AppData.
- [ ] API result never overwrites localStorage.
- [ ] localStorage remains the active App source of truth.

## Route Boundary Acceptance

Allowed browser mutations:

- [ ] `POST /data-health/issues/:issueId/dismiss`
- [ ] `POST /history/:id/data-flag`
- [ ] `POST /history/:id/edit`
- [ ] `POST /sessions/start`

Blocked browser mutations:

- [ ] `POST /sessions/active/patches`
- [ ] `POST /sessions/active/complete`
- [ ] `POST /sessions/active/discard`
- [ ] `POST /data-health/repair/apply`
- [ ] backup/import/export over HTTP
- [ ] reset/recovery over HTTP
- [ ] source-of-truth migration

## Manual Runbook Stub

- [ ] Use a dedicated test browser profile.
- [ ] Do not use real personal training data.
- [ ] Start Dev API runner with a dedicated dev DB.
- [ ] Start App with compare flag plus `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="session-start"`.
- [ ] Verify a stable template target and no local active session.
- [ ] Confirm no POST before confirmation.
- [ ] Confirm duplicate-submit is blocked.
- [ ] Confirm success/no-fake-success behavior.
- [ ] Confirm localStorage integrity.
- [ ] Confirm DevTools Network route boundary.
- [ ] Clean up env vars and dev DB artifacts.

## Decision

Task 4.61 result: acceptance coverage only.

The Session Start prototype remains dev-only, explicit opt-in, one-route-only, strict-success guarded, source-snapshot/idempotency guarded, and localStorage-source-of-truth.

Next task should be Task 4.62 Session Start Manual App Acceptance V1.
