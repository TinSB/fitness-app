# Source-of-Truth Cutover Manual Acceptance

## Scope / Non-Goals

Task 9.10 Source-of-Truth Cutover Manual Acceptance V1 defines manual acceptance for backend-primary candidate cutover.

This runbook does not authorize production auth, user accounts, cloud sync, deployment runtime, monitoring runtime, SaaS/multi-user runtime, normalized tables, destructive migration, or real personal data artifacts.

## Prerequisites

- [ ] Use a dedicated test browser profile.
- [ ] Use synthetic non-personal AppData only.
- [ ] Confirm localStorage-primary baseline is available.
- [ ] Confirm localStorage fallback, migration source, and emergency backup are available.
- [ ] Confirm api-primary-dev remains dev/local only and not production-ready.
- [ ] Confirm backend-primary candidate mode is explicit opt-in.

## LocalStorage-Primary Baseline

- [ ] App starts in localStorage-primary.
- [ ] Existing localStorage data remains readable.
- [ ] No backend-primary candidate mode is enabled by default.
- [ ] Emergency localStorage backup is preserved.

## Migration Dry Run

- [ ] Run cutover migration dry run with synthetic AppData.
- [ ] Confirm warnings are reviewed.
- [ ] Confirm blocking errors stop cutover.
- [ ] Confirm `sourceOfTruthChanged: false`.
- [ ] Confirm `localStorageMutated: false`.

## Backend Repository Candidate

- [ ] Confirm repository candidate is disabled by default.
- [ ] Confirm candidate writes require backup-before-write.
- [ ] Confirm invalid AppData is rejected.
- [ ] Confirm repository candidate is not a normalized production multi-user database.

## Backend-Primary Read Candidate

- [ ] Confirm backend-primary read candidate requires explicit opt-in.
- [ ] Confirm backend unavailable falls back to localStorage-derived data.
- [ ] Confirm mismatch is diagnostic only.
- [ ] Confirm no repair, overwrite, sync, or mutation occurs.

## Backend-Primary Mutation Candidate

- [ ] Confirm only the seven approved mutation route ids are accepted.
- [ ] Confirm duplicate mutation/no-fake-success behavior.
- [ ] Confirm invalid next AppData is rejected.
- [ ] Confirm backend write failure does not corrupt localStorage.
- [ ] Confirm rollback state is available after failed write.

## Runtime Switch Guard

- [ ] Confirm default state is localStorage-primary.
- [ ] Confirm backend-read-candidate requires explicit opt-in.
- [ ] Confirm backend-primary-candidate requires explicit opt-in.
- [ ] Confirm dev/local API config is rejected for production candidate mode.
- [ ] Confirm fallback-localStorage and emergency-localStorage states are reachable.

## Fallback / Emergency / Rollback

- [ ] Confirm backend unavailable enters fallback-localStorage.
- [ ] Confirm backend invalid/corrupt data does not overwrite local data.
- [ ] Confirm manual disable returns to localStorage-primary.
- [ ] Confirm emergency-localStorage restore remains available.
- [ ] Confirm localStorage backup is not deleted.

## Route Lock

Accepted browser mutation routes remain exactly seven:

- [ ] `POST /data-health/issues/:issueId/dismiss`
- [ ] `POST /history/:id/data-flag`
- [ ] `POST /history/:id/edit`
- [ ] `POST /sessions/start`
- [ ] `POST /sessions/active/patches`
- [ ] `POST /sessions/active/complete`
- [ ] `POST /sessions/active/discard`

Blocked routes remain blocked:

- [ ] `POST /data-health/repair/apply`
- [ ] backup/import/export over HTTP
- [ ] reset/recovery over HTTP
- [ ] eighth browser mutation route

## Browser / Node Isolation

- [ ] Browser-facing exports do not expose Node-only backend-primary modules.
- [ ] Browser dist token scan is clean.
- [ ] No `node:http` or `node:sqlite` appears in browser production dist.

## Final Non-Goals Check

- [ ] No auth/user accounts.
- [ ] No cloud sync.
- [ ] No deployment runtime.
- [ ] No monitoring runtime.
- [ ] No SaaS/multi-user runtime.
- [ ] No normalized tables.
- [ ] No destructive migration.
- [ ] Real personal data remains excluded from tests, docs examples, fixtures, and acceptance evidence.

## Pass / Fail Template

- Result: Pass / Fail
- Tester:
- Date:
- Synthetic fixture used:
- Blocking issues:
- Follow-up task:

## Decision

Task 9.10 result: source-of-truth cutover manual acceptance runbook only.

Recommended next task: Task 9.11 Backend-Primary Regression Lock V1.

Task 9.11 is not part of Task 9.10. Auto-continue mode may begin Task 9.11 only after Task 9.10 is fully merged.
