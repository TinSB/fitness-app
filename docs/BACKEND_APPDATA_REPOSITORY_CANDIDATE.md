# Backend AppData Repository Candidate

## Task Identity

Task 9.3 Backend AppData Repository Candidate V1 adds a backend AppData repository candidate.

This is single-user backend-primary candidate infrastructure only. It is not a normalized production multi-user database and does not switch source-of-truth.

## Repository Boundary

The repository candidate exposes document-style AppData snapshot behavior:

- `readLatestAppData()`
- `createBackupCandidate()`
- `validateBeforeWrite()`
- `writeAppDataCandidate()`

The in-memory implementation is synthetic-test infrastructure. It is disabled by default and always reports `sourceOfTruth: false`.

## Backup-Before-Write Semantics

Candidate writes require a backup id created by `createBackupCandidate()`.

Writes validate the AppData document before storing a candidate snapshot. A write returns stable metadata only after validation passes.

Read and write operations clone AppData so callers cannot mutate repository state in place.

## Stable Error Codes

The repository candidate uses stable errors:

- `repository_disabled`
- `appdata_not_found`
- `appdata_validation_failed`
- `backup_required`
- `write_rejected`
- `write_failed`
- `candidate_not_source_of_truth`

## Blocked Scope

Task 9.3 does not add:

- real database dependency
- ORM
- normalized tables
- destructive migration
- node:sqlite import
- sqliteRepository production promotion
- auth or user accounts
- cloud sync
- deployment runtime
- monitoring runtime
- source-of-truth switch
- package dependency, package script, or lockfile changes
- real personal data artifacts

## Decision

Task 9.3 result: backend AppData repository candidate only.

Recommended next task: Task 9.4 Cutover Data Migration Dry Run V1.

Task 9.4 is not part of Task 9.3. Auto-continue mode may begin Task 9.4 only after Task 9.3 is fully merged.
