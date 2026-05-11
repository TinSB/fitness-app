# Phase 4 Manual Final Acceptance

This runbook is the final manual acceptance procedure for Phase 4.

## Scope / Non-goals

- [ ] This is dev-only Phase 4 final manual acceptance.
- [ ] This is not production readiness.
- [ ] This is not source-of-truth migration.
- [ ] This does not replace localStorage.
- [ ] This does not implement API-backed runtime.
- [ ] This does not approve a fifth mutation.
- [ ] localStorage remains source of truth.
- [ ] API results never overwrite AppData or localStorage.
- [ ] No production backend, auth, sync, or deployment is added.
- [ ] Use a dedicated test browser profile only.
- [ ] Do not use real personal training data.

## Accepted Browser Mutation Routes

- [ ] `POST /data-health/issues/:issueId/dismiss`
- [ ] `POST /history/:id/data-flag`
- [ ] `POST /history/:id/edit`
- [ ] `POST /sessions/start`

No other browser mutation route is accepted.

## Blocked Routes

- [ ] `POST /sessions/active/patches`
- [ ] `POST /sessions/active/complete`
- [ ] `POST /sessions/active/discard`
- [ ] `POST /data-health/repair/apply`
- [ ] backup/import/export over HTTP
- [ ] reset/recovery over HTTP
- [ ] source-of-truth migration
- [ ] fifth browser mutation route

## Prerequisites

- [ ] Confirm Task 4.71 is merged into `main`.
- [ ] Confirm `git status` is clean.
- [ ] Run `npm run api:dev:build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Use a dedicated browser profile.
- [ ] Use a dedicated dev DB file, for example `.ironpath/phase4-final-acceptance.sqlite`.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or `.sqlite-journal` files.

## Start Dev API Runner

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/phase4-final-acceptance.sqlite
```

- [ ] stdout includes `IronPath dev API ready: <url>`.
- [ ] URL is localhost or `127.0.0.1`.
- [ ] No raw stack is printed.
- [ ] No production backend configuration is required.

## Start App With Read-only Diagnostics

PowerShell:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE="1"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

macOS/Linux:

```bash
VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

- [ ] App opens normally.
- [ ] Read-only diagnostics may appear.
- [ ] Read-only diagnostics remain GET-only.
- [ ] localStorage remains source of truth.
- [ ] No mutation prototype appears without a mutation experiment flag.

## Accepted Mutation Prototype Checks

- [ ] DataHealth dismiss with `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=datahealth-dismiss` sends only `POST /data-health/issues/:issueId/dismiss` after confirmation.
- [ ] History data-flag with `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=history-data-flag` sends only `POST /history/:id/data-flag` after confirmation.
- [ ] Limited History Edit with `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=limited-history-edit` sends only `POST /history/:id/edit` after confirmation.
- [ ] Session Start with `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=session-start` sends only `POST /sessions/start` after confirmation.
- [ ] Each experiment flag enables only its own prototype.
- [ ] Invalid mutation flag shows no mutation prototype or safe misconfiguration.
- [ ] Production-like build shows no mutation prototype.

## Route Boundary Verification

Allowed GET:

- [ ] `GET /health`
- [ ] `GET /app-data/summary`
- [ ] `GET /sessions/summary`
- [ ] `GET /history`
- [ ] `GET /history/:id`
- [ ] `GET /data-health/summary`

Forbidden POST:

- [ ] `POST /sessions/active/patches`
- [ ] `POST /sessions/active/complete`
- [ ] `POST /sessions/active/discard`
- [ ] `POST /data-health/repair/apply`
- [ ] backup/import/export/reset/recovery HTTP routes

## LocalStorage Integrity

- [ ] Snapshot localStorage before acceptance.
- [ ] Run read-only diagnostics.
- [ ] Run all four accepted mutation prototype flows if safe test data exists.
- [ ] Run failure scenarios by stopping the Dev API runner.
- [ ] Compare localStorage after acceptance.
- [ ] API response snapshot metadata is not stored in localStorage.
- [ ] API result does not overwrite AppData or localStorage.
- [ ] Session Start result does not create or overwrite local App activeSession.

## No-fake-success

- [ ] No POST before confirmation.
- [ ] No optimistic success during pending.
- [ ] Success requires snapshot metadata.
- [ ] Failure, unavailable, timeout, malformed response, not_found, no_change, active_session_exists, missing snapshot metadata, or invalid target does not show success.
- [ ] No raw stack is displayed.
- [ ] No auto-retry occurs.

## Failure Recovery

- [ ] Stop Dev API runner and retry each accepted mutation flow.
- [ ] Verify failure/unavailable state.
- [ ] Verify App remains usable.
- [ ] Verify no localStorage writes.
- [ ] Restart runner and verify App can recover after refresh/retry.
- [ ] Recovery remains manual and dev-only.
- [ ] No repair, sync, overwrite, import, export, reset, recovery, apply, fix, or migrate control appears.

## Browser Build Safety

- [ ] `npm run build` passes.
- [ ] `dist/` scan finds no `node:http`.
- [ ] `dist/` scan finds no `node:sqlite`.
- [ ] `dist/` scan finds no `devLauncher`.
- [ ] `dist/` scan finds no `httpRuntimeAdapter`.
- [ ] `dist/` scan finds no `serverAdapter`.
- [ ] `dist/` scan finds no `sqliteRepository`.
- [ ] `dist/` scan finds no `devApiRunner`.
- [ ] `dist/` scan finds no `devDbRecovery`.

## Cleanup

PowerShell:

```powershell
Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL -ErrorAction SilentlyContinue
```

macOS/Linux:

```bash
unset VITE_IRONPATH_DEV_API_COMPARE
unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT
unset VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] Stop App dev server with `Ctrl+C`.
- [ ] Stop Dev API runner with `Ctrl+C`.
- [ ] Remove `.ironpath/phase4-final-acceptance.sqlite` artifacts if needed.
- [ ] Do not delete `.ironpath/dev-api-runner`.
- [ ] Run `git status`.
- [ ] Do not commit dev DB artifacts.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch:
- [ ] Commit:
- [ ] Node version:
- [ ] Dev API command:
- [ ] Dev API URL:
- [ ] App dev command:
- [ ] Browser/profile used:
- [ ] Read-only diagnostics result:
- [ ] DataHealth dismiss result:
- [ ] History data-flag result:
- [ ] Limited History Edit result:
- [ ] Session Start result:
- [ ] Route boundary result:
- [ ] LocalStorage integrity result:
- [ ] No-fake-success result:
- [ ] Failure recovery result:
- [ ] Cleanup result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:

## Final Recommendation

Task 4.72 result: manual final acceptance only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No source-of-truth migration is implemented.
Next task should be Task 4.73 Phase 4 Exit Regression Lock V1.
