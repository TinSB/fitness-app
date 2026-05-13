# Cloud Sync Disabled Skeleton

## Task Identity

Task 10.7 Cloud Sync Disabled Skeleton V1 adds a disabled cloud sync skeleton.

This task models sync state and dry-run results only. It does not upload, download, mutate local data, mutate backend-primary candidate data, run background sync, call a provider, add network behavior, or automatically resolve conflicts.

## Disabled Default

Cloud sync is disabled by default.

The skeleton reports:

- network disabled
- background sync disabled
- upload disabled
- download disabled
- apply disabled
- no localStorage mutation
- no backend-primary mutation
- no automatic conflict resolution

## Sync Status Model

Supported status values:

- `disabled`
- `dry_run_only`
- `unavailable`
- `conflict_detected`
- `manual_confirmation_required`
- `unsupported`

Supported dry-run result states:

- `disabled`
- `dry_run_only`
- `conflict_detected`
- `manual_confirmation_required`
- `rejected`
- `safe_to_apply`
- `applied_candidate`

`applied_candidate` remains a modeled future candidate state only. It is not live cloud sync in Phase 10.

## Conflict Result Shape

Conflict results include stable conflict reasons and always report:

- upload not performed
- download not performed
- localStorage not mutated
- backend-primary not mutated
- auto apply not performed
- manual confirmation required when conflicts exist

## Runtime Boundary

`localStorage` remains default, fallback, migration source, and emergency backup.

Backend-primary candidate remains explicit opt-in and reversible.

Auth provider integration remains unimplemented.

Production deployment runtime remains unimplemented.

Monitoring external upload remains unimplemented.

## Blocked Implementation

Task 10.7 does not authorize:

- network fetch behavior
- backend sync calls
- cloud upload
- cloud download
- background sync
- automatic conflict resolution
- localStorage overwrite
- backend-primary overwrite
- provider SDK dependency
- package dependency, package script, or lockfile changes
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Recommendation

Recommended next task: Task 10.8 Production Secrets & Environment Guard V1.

Task 10.8 is not part of Task 10.7. Auto-continue mode may begin Task 10.8 only after Task 10.7 is fully merged.
