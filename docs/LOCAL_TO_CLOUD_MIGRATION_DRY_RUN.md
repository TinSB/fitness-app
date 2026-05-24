# Phase 19I - Local-to-Cloud Migration Dry Run V1

Phase 19I adds a local-to-cloud migration dry run only.

It prepares an in-memory readiness report for a future single-user sync candidate. It does not upload, download, persist, apply, or switch source of truth.

## Scope

The dry run consumes existing Phase 19 signals:

- Account boundary and local inventory from Phase 19B.
- Backup/export preflight from Phase 19B.
- Supabase table and RLS contract expectations from Phase 19C and 19D.
- Auth readiness context from Phase 19E and 19F.
- Cloud read mirror metadata from Phase 19G when available.
- Shadow-write safety gates from Phase 19H as future requirements only.

The dry run does not call cloud write helpers, does not create rows, does not create a Supabase client, does not call browser APIs, and does not use any backend route.

## Required Checks

Phase 19I requires:

- local AppData inventory is valid
- backup/export preflight is valid
- account candidate is present
- owner and RLS preflight match
- cloud repository candidate is available for future review
- read mirror conflict state is safe or absent
- rollback and emergency local mode remain available
- future write shadow still requires separate opt-in

If any check fails, the report stays blocked and keeps `readyForShadowCandidate: false`.

## Result Fields

The Phase 19I result records:

- `readyForShadowCandidate`
- `requiresManualReview`
- `blockers`
- `warnings`
- `accountBoundaryStatus`
- `backupStatus`
- `schemaStatus`
- `rlsPreflight`
- `rollbackPreflight`
- `cloudConflictPreflight`
- `migrationPackage`
- `noUpload: true`
- `noDownload: true`
- `localStorageUnchanged: true`
- `localDataChanged: false`
- `cloudDataChanged: false`
- `sourceOfTruthChanged: false`
- `syncRuntimeEnabled: false`

The migration package is dry-run metadata only. It can include operation id, account id, owner id, device id, schema version, and source snapshot hash. It does not include a cloud write result and does not mean a write occurred.

## Preserved Boundaries

No upload is attempted.

No download is attempted.

No local data is changed.

No cloud data is changed.

No source-of-truth switch is made.

No AppData schema is changed.

No TrainingSession schema is changed.

No routes are added.

No package or lockfile changes are required.

`localStorage` remains default, fallback, migration source, and emergency rollback source.

localStorage remains default, fallback, migration source, and emergency rollback source.

Offline training remains available.

## Deferred Behavior

Phase 19I does not start sync. It does not make cloud primary. It does not silently upload anonymous local data. It does not resolve conflicts. It does not delete local emergency data.

Future work must still require explicit user confirmation, conflict handling, rollback evidence, and manual acceptance before any cloud-primary consideration.

Recommended next task: 19J - Explicit Opt-In Single-User Sync Candidate V1.
