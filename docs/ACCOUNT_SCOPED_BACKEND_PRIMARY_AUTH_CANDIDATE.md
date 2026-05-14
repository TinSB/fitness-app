# Task 11.8 Account-Scoped Backend-Primary Auth Candidate V1

This task adds a pure boundary for passing auth/account scope context into backend-primary candidate flows. It does not implement real multi-user runtime.

## Candidate Context

The boundary can receive:

- auth user candidate
- account owner candidate
- device owner
- local owner

Supported owner scopes remain:

- `anonymous-local`
- `device-local`
- `backend-primary-candidate`
- `cloud-account-candidate`

## Stable Errors

- `owner_scope_missing`
- `owner_scope_mismatch`
- `auth_candidate_missing`
- `account_candidate_missing`
- `backend_primary_not_enabled`
- `cloud_sync_not_available`

## Safety Rules

- backend-primary candidate remains explicit opt-in.
- Owner mismatch returns a stable error.
- No real multi-user database is implemented.
- No normalized tables are added.
- No cloud sync is implemented.
- No provider SDK is installed.
- No source-of-truth switch is performed.
- No deployment runtime is added.

## Boundary Confirmation

`localStorage` remains default, fallback, migration source, and emergency backup. Backend-primary candidate remains explicit opt-in and reversible. Fallback, rollback, and emergency restore remain available. Real cloud sync, production deployment runtime, monitoring upload, SaaS runtime, normalized tables, destructive migration, and real personal training data remain blocked.

Recommended next task: Task 11.9 Auth Failure / Logout / Emergency Local Mode V1.
