# Backend-Primary Read Candidate

## Task Identity

Task 9.5 Backend-Primary Read Candidate V1 adds explicit opt-in backend-primary read candidate logic.

This is candidate read behavior only. It does not replace localStorage by default and does not switch source-of-truth.

## Read Surfaces

Allowed read surfaces are:

- app data summary
- sessions summary
- history list
- history detail
- data-health summary

The implementation uses stable surface ids instead of adding browser routes.

## Candidate Behavior

Backend-primary read candidate is disabled by default.

When explicitly enabled, it requires an adapter. If the backend adapter is unavailable, unsupported, or not found, the result falls back to the provided localStorage-derived value.

When backend and local values mismatch, the result is diagnostic only. It does not repair, overwrite, sync, or mutate localStorage.

Every result reports:

- `sourceOfTruth: localStorage`
- `localStorageMutated: false`
- `mutationCalled: false`

## Blocked Scope

Task 9.5 does not add:

- backend writes
- mutation routes
- source-of-truth switch
- localStorage overwrite
- repair or sync behavior
- auth or user accounts
- cloud sync
- deployment runtime
- monitoring runtime
- package dependency, package script, or lockfile changes
- real personal data artifacts

## Decision

Task 9.5 result: explicit opt-in backend-primary read candidate only.

Recommended next task: Task 9.6 Backend-Primary Mutation Candidate V1.

Task 9.6 is not part of Task 9.5. Auto-continue mode may begin Task 9.6 only after Task 9.5 is fully merged.
