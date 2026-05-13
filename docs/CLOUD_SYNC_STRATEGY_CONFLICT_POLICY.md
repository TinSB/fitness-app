# Cloud Sync Strategy & Conflict Policy

## Task Identity

Task 10.6 Cloud Sync Strategy & Conflict Policy V1 defines conservative cloud sync strategy before any real sync implementation.

This task is docs/static tests only. It does not implement cloud sync, network calls, provider integration, database writes, background jobs, cloud upload, cloud download, conflict resolution runtime, package changes, or source-of-truth changes.

## Phase 10 Sync Boundary

Real cloud sync implementation is blocked in Phase 10.

Phase 10 may only document strategy and later add a disabled skeleton. No live upload, download, background sync, multi-device sync, or automatic merge is authorized.

## Conservative Sync Principles

Future sync must follow these principles:

- dry-run first
- no silent overwrite
- manual confirmation required for conflict resolution
- no last-write-wins default
- local emergency backup preserved
- rollback path required
- owner scope must match before apply
- backend-primary candidate remains explicit opt-in and reversible
- `localStorage` remains default, fallback, migration source, and emergency backup
- real personal training data remains excluded from tests, docs examples, fixtures, and acceptance evidence

## Conflict Scenarios

Future cloud sync must handle at least these conflict scenarios before real implementation:

- local newer than cloud
- cloud newer than local
- both changed offline
- backend write succeeded but frontend failed
- frontend mutation succeeded locally but cloud rejected
- corrupt cloud data
- owner mismatch
- logout during pending sync
- device clock mismatch

## Sync Result States

Future sync result states must include:

- `disabled`
- `dry_run_only`
- `conflict_detected`
- `manual_confirmation_required`
- `rejected`
- `safe_to_apply`
- `applied_candidate`

`applied_candidate` is only a future candidate state and must not be treated as real production cloud sync in Phase 10.

## Conflict Resolution Policy

Conflict resolution must fail closed by default.

If local and cloud data diverge, the result must be `conflict_detected` or `manual_confirmation_required` until a user-visible confirmation model is authorized.

No task may silently prefer cloud over local data.

No task may silently prefer local over cloud data.

No task may use last-write-wins as the default policy.

No task may overwrite localStorage emergency backup while resolving conflicts.

## Blocked Implementation

Task 10.6 does not authorize:

- cloud sync runtime
- network calls
- provider integration
- database integration
- background jobs
- cloud upload
- cloud download
- automatic conflict resolution
- last-write-wins default
- localStorage overwrite
- backend-primary overwrite
- auth provider integration
- deployment runtime
- monitoring runtime
- package dependency, package script, or lockfile changes
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Recommendation

Recommended next task: Task 10.7 Cloud Sync Disabled Skeleton V1.

Task 10.7 may add a disabled cloud sync skeleton only. Task 10.7 must not implement real cloud sync, network upload, network download, or automatic conflict resolution.

Task 10.7 is not part of Task 10.6. Auto-continue mode may begin Task 10.7 only after Task 10.6 is fully merged.
