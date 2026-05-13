# Account-Scoped AppData Boundary

## Task Identity

Task 10.5 Account-Scoped AppData Boundary V1 adds pure account-scoped AppData ownership helpers.

This task does not implement real user accounts, real multi-user runtime, cloud sync, normalized tables, database migration, source-of-truth switch, or destructive AppData migration.

## Owner Scopes

Supported owner scopes are:

- `anonymous-local`
- `device-local`
- `backend-primary-candidate`
- `cloud-account-candidate`

The owner scope wrapper identifies who may own an AppData document in future auth/cloud work without changing the AppData document itself.

## Boundary Helpers

The boundary provides pure helpers for:

- creating anonymous local owners
- creating device-local owners
- creating backend-primary candidate owners
- creating cloud account candidate owners
- validating owner scope
- assigning owner scope to AppData
- checking owner scope before restore or link
- creating owner-preserving emergency backup wrappers

All helpers are pure. They do not write localStorage, write a backend, upload cloud data, create accounts, call a provider, or mutate AppData in place.

## Owner Mismatch Rule

Owner mismatch must fail closed.

Cloud account candidate data must include an account id.

Restore, link, and future sync flows must reject owner mismatch unless a later explicit manual confirmation flow authorizes a safe relink path.

## localStorage Emergency Backup

`localStorage` remains default, fallback, migration source, and emergency backup.

Emergency backup wrappers preserve the owner context they were created from.

Backend-primary candidate remains explicit opt-in and reversible.

Fallback, rollback, and emergency restore remain available.

## Blocked Implementation

Task 10.5 does not authorize:

- user table
- normalized tables
- database migration
- destructive AppData migration
- real multi-user runtime
- real auth provider integration
- real login/signup UI or runtime
- real user accounts
- cloud sync
- deployment runtime
- monitoring runtime
- source-of-truth switch
- package dependency, package script, or lockfile changes
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Recommendation

Recommended next task: Task 10.6 Cloud Sync Strategy & Conflict Policy V1.

Task 10.6 is not part of Task 10.5. Auto-continue mode may begin Task 10.6 only after Task 10.5 is fully merged.
