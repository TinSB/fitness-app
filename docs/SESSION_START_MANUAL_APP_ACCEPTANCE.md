# Session Start Manual App Acceptance V1

Last updated: 2026-05-11

## Scope / Non-goals

- [ ] This is dev-only manual App acceptance for the existing Session Start prototype.
- [ ] This is not production readiness.
- [ ] This does not add another mutation route.
- [ ] This does not approve active patch, complete, or discard.
- [ ] This does not approve DataHealth repair, backup/import/export, reset/recovery, or source-of-truth migration.
- [ ] localStorage remains source of truth.
- [ ] API results never overwrite AppData/localStorage.
- [ ] Use a dedicated test browser profile only.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

## Safety Before Testing

- [ ] Do not use real personal training data.
- [ ] Do not use or clear the daily browser profile.
- [ ] Use a dedicated test browser profile.
- [ ] Use a dedicated dev DB file, for example `.ironpath/manual-session-start-acceptance.sqlite`.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or `.sqlite-journal` files.
- [ ] Do not treat this as production backend validation.

## Prerequisites

- [ ] `git status` is clean.
- [ ] `npm run api:dev:build` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Task 4.61 is merged into main.
- [ ] Dev API runner is available.
- [ ] App dev server is available.
- [ ] Dedicated browser profile is ready.

## Start Dev API Runner

```bash
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-session-start-acceptance.sqlite
```

Acceptance:

- [ ] stdout includes `IronPath dev API ready: <url>`.
- [ ] URL is localhost or 127.0.0.1.
- [ ] No raw stack is shown.
- [ ] `--seed-empty` creates `dev-launcher:seed-empty` only if no latest snapshot exists.

## Prepare Test Data

- [ ] Use dedicated test profile/state only.
- [ ] Do not use real personal training data.
- [ ] Confirm there is no local active session before testing success.
- [ ] Confirm a stable target template exists.
- [ ] Confirm Dev API snapshot corresponds to the test profile if testing success.
- [ ] If success-state data is not available, verify failure/no-fake-success scenarios only.

## Start App With Session Start Flag

PowerShell:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE="1"
$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="session-start"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

macOS/Linux:

```bash
VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=session-start VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Acceptance:

- [ ] App opens normally.
- [ ] Session Start prototype appears only when all flags are enabled and a stable target exists.
- [ ] UI clearly says dev-only mutation experiment.
- [ ] UI clearly says localStorage remains source of truth.

## Flag Matrix Manual Check

- [ ] Compare flag off: no Session Start prototype.
- [ ] Mutation flag off: no Session Start prototype.
- [ ] Compare flag on only: read-only diagnostics may show, Session Start absent.
- [ ] `datahealth-dismiss` flag does not enable Session Start.
- [ ] `history-data-flag` flag does not enable Session Start.
- [ ] `limited-history-edit` flag does not enable Session Start.
- [ ] `session-start` flag does not enable DataHealth dismiss, History data-flag, or Limited History Edit.
- [ ] Production-like build: Session Start disabled.

## Confirmation Manual Check

- [ ] Prototype is visible.
- [ ] Do not confirm yet.
- [ ] Try to submit.
- [ ] No POST occurs before explicit confirmation.
- [ ] Cancel clears confirmation and prevents POST.
- [ ] Confirmation copy states target template and localStorage source-of-truth.

## Duplicate Start Manual Check

- [ ] Confirm and submit once.
- [ ] Submit becomes pending.
- [ ] Repeated click while pending does not send duplicate POST.
- [ ] No optimistic success appears during pending.
- [ ] Failure releases pending state.
- [ ] Retry after failure requires explicit action and confirmation.

## Success Manual Check

- [ ] Browser Network shows exactly `POST /sessions/start` after confirmation.
- [ ] No active patch, complete, discard, repair, backup/import/export, reset, or recovery POSTs occur.
- [ ] Success appears only after HTTP 2xx, result success, changed true, status success, and snapshot metadata.
- [ ] UI does not overwrite localStorage.
- [ ] AppData is not replaced by API result.
- [ ] Success does not claim production sync.

## Failure / No-fake-success Manual Check

- [ ] Stop the Dev API runner and retry.
- [ ] API unavailable shows failure.
- [ ] Timeout/unavailable/error does not show success.
- [ ] Existing active session scenario does not show success.
- [ ] Missing/invalid target template does not show success.
- [ ] Missing snapshot metadata does not show success.
- [ ] No raw stack is shown.
- [ ] No auto-retry occurs.
- [ ] No localStorage write occurs.

## LocalStorage Integrity Manual Check

- [ ] Snapshot localStorage before testing.
- [ ] Run read-only compare, success if possible, and failure scenarios.
- [ ] Compare localStorage after testing.
- [ ] API response snapshot metadata is not stored in localStorage.
- [ ] API result does not overwrite AppData/localStorage.
- [ ] localStorage remains the only active App source of truth.

## DevTools Network Route Boundary

Allowed GET:

- [ ] `GET /health`
- [ ] `GET /app-data/summary`
- [ ] `GET /sessions/summary`
- [ ] `GET /history`
- [ ] `GET /history/:id`
- [ ] `GET /data-health/summary`

Allowed POST:

- [ ] `POST /sessions/start` only after confirmation in Session Start flow.

Forbidden POST:

- [ ] `POST /sessions/active/patches`
- [ ] `POST /sessions/active/complete`
- [ ] `POST /sessions/active/discard`
- [ ] `POST /data-health/repair/apply`
- [ ] backup/import/export over HTTP
- [ ] reset/recovery over HTTP

## Cleanup

- [ ] Ctrl+C stop App dev server.
- [ ] Ctrl+C stop Dev API runner.
- [ ] Clear env vars.

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

- [ ] Remove test dev DB artifacts if needed:
  - `.ironpath/manual-session-start-acceptance.sqlite`
  - `.ironpath/manual-session-start-acceptance.sqlite-wal`
  - `.ironpath/manual-session-start-acceptance.sqlite-shm`
  - `.ironpath/manual-session-start-acceptance.sqlite-journal`
- [ ] Do not delete `.ironpath/dev-api-runner`.
- [ ] Check `git status`.
- [ ] Do not commit dev DB artifacts.

## Browser Build Safety

- [ ] `npm run build` passes.
- [ ] `dist/` scan finds no `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, or `devDbRecovery`.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch:
- [ ] Commit:
- [ ] Node version:
- [ ] Dev API command:
- [ ] Dev API URL:
- [ ] App dev command:
- [ ] Browser/profile used:
- [ ] Flags used:
- [ ] Target template:
- [ ] Flag matrix result:
- [ ] Confirmation result:
- [ ] Duplicate start result:
- [ ] Success result:
- [ ] Failure/no-fake-success result:
- [ ] LocalStorage integrity result:
- [ ] Network route boundary result:
- [ ] Cleanup result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:

## Task 4.63 Session Start Prototype Hardening V1 Follow-up

- [ ] Review `docs/SESSION_START_PROTOTYPE_HARDENING.md`.
- [ ] Confirm hardening covers duplicate-submit/pending lock, source snapshot missing, idempotency missing, active session exists, missing snapshot metadata, unavailable/timeout/abort, malformed response, repository errors, confirmation reset, no localStorage/AppData mutation, and route boundary.
- [ ] Confirm no new mutation route is added.
