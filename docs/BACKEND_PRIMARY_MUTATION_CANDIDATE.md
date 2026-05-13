# Backend-Primary Mutation Candidate

## Task Identity

Task 9.6 Backend-Primary Mutation Candidate V1 adds backend-primary mutation candidate behavior.

This is explicit opt-in candidate behavior only. It does not add browser mutation routes and does not make backend-primary the default source.

## Allowed Mutation Candidates

Allowed mutation candidates are limited to the existing seven approved mutation route ids:

- dataHealthDismiss
- historyDataFlag
- historyEdit
- sessionStart
- activeSessionPatches
- activeSessionComplete
- activeSessionDiscard

No eighth browser mutation route is authorized.

## Candidate Behavior

Backend-primary mutation candidate is disabled by default.

When enabled, it requires an explicit mutation adapter and backend AppData repository candidate.

The candidate validates next AppData before writing, requires repository backup-before-write behavior, rejects duplicate operation ids, and never reports fake success.

Stable result states:

- `disabled`
- `unsupported`
- `accepted_candidate`
- `no_change`
- `rejected`
- `failed`
- `rollback_required`
- `rollback_available`

Every result reports `sourceOfTruth: localStorage` and `localStorageMutated: false`.

## Blocked Scope

Task 9.6 does not add:

- eighth browser mutation route
- repair route
- backup/import/export over HTTP
- reset/recovery over HTTP
- direct localStorage overwrite
- backend-primary default mode
- auth or user accounts
- cloud sync
- deployment runtime
- monitoring runtime
- package dependency, package script, or lockfile changes
- real personal data artifacts

## Decision

Task 9.6 result: backend-primary mutation candidate only.

Recommended next task: Task 9.7 Frontend Source-of-Truth Runtime Switch Guard V1.

Task 9.7 is not part of Task 9.6. Auto-continue mode may begin Task 9.7 only after Task 9.6 is fully merged.
