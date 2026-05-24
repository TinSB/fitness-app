# Phase 19D - Supabase Migration Files + Local Type Contracts V1

## Scope

Phase 19D adds reviewed Supabase migration files and local type contracts.

It creates one candidate migration file:

- `supabase/migrations/20260524000000_phase19d_appdata_snapshot.sql`

It also creates local type contracts for the candidate rows and table metadata.

SQL is not applied by the app. No Supabase connection is made. No table is live from this task alone.

Phase 19D does not add runtime auth, auth UI, cloud read runtime, cloud write runtime, sync runtime, routes, storage writes, environment files, package changes, lockfile changes, AppData schema changes, TrainingSession schema changes, or source-of-truth switching.

## Product Target

The product target remains single-user multi-device sync: one user account syncing the same owner training data across phone, computer, and tablet.

This is personal-only IronPath, not public SaaS, coach/student, social, team collaboration, marketplace, billing, or shared workspace behavior.

## Source-of-Truth Strategy

localStorage remains default, fallback, migration source, and emergency rollback source.

The 19D local type contract reports:

- `migrationFilesCreated: true`
- `sqlApplied: false`
- `supabaseClientCreated: false`
- `authRuntimeEnabled: false`
- `syncRuntimeEnabled: false`
- `sourceOfTruthChanged: false`
- `localDataChanged: false`
- `cloudDataChanged: false`

Cloud-primary behavior remains blocked. Explicit opt-in sync remains blocked.

## Migration File

The migration file translates the accepted 19C contract into SQL for future manual application.

It contains:

- `cloud_appdata_snapshots`
- `cloud_sync_operations`
- `cloud_devices`
- `cloud_conflicts`
- `cloud_export_delete_requests`
- owner fields: `account_id`, `owner_user_id`, `device_id`, `local_owner_id`
- snapshot fields: `source_snapshot_hash`, `schema_version`, `operation_id`, `app_data`, `validation_status`
- RLS enable statements
- select/insert policies using `owner_user_id = auth.uid()`
- insert checks using `owner_user_id = auth.uid() and account_id = owner_user_id`

It does not include destructive operations such as drop, truncate, or broad delete statements.

## Local Type Contracts

The local type contracts define TypeScript row shapes for the future tables:

- `Phase19dCloudAppDataSnapshotRow`
- `Phase19dCloudSyncOperationRow`
- `Phase19dCloudDeviceRow`
- `Phase19dCloudConflictRow`
- `Phase19dCloudExportDeleteRequestRow`

They are local compile-time contracts only.

They do not add AppData fields and do not change TrainingSession.

## RLS Principles

The SQL mirrors the 19C policy contract:

- RLS is enabled on every candidate table.
- Users can select only rows where `owner_user_id = auth.uid()`.
- Users can insert only rows where `owner_user_id = auth.uid()` and `account_id = owner_user_id`.
- Service role keys must never enter browser runtime.
- Anonymous local data cannot auto-upload.
- Owner mismatch must reject.

Delete remains blocked until a dedicated privacy/data-lifecycle phase.

## Privacy, Export, And Delete

19D creates a future `cloud_export_delete_requests` table candidate, but no export/delete runtime.

Future export/delete behavior must still require explicit confirmation and must not silently delete local emergency data.

No real personal training data appears in the migration, docs, tests, or fixtures.

## Offline Behavior

Offline training remains available.

Login must not be required to train.

No background sync worker, service-worker sync, automatic worker/timer/polling sync, silent pull, silent push, or automatic multi-device sync is approved.

## Conflict Strategy

No last-write-wins default.

The migration includes `cloud_conflicts` for later manual conflict review records, but 19D does not implement conflict runtime.

Manual review remains required when conflict risk exists.

## Local-To-Cloud Migration Dry Run

19D prepares the migration file and local type contract that later dry-run work can inspect.

19D does not run a migration, upload, download, or mutate localStorage.

Later migration dry-run work must verify 19B inventory readiness, 19C contract acceptance, 19D migration/type contract availability, backup/export readiness, owner match, conflict preflight, rollback, and emergency local mode.

## Acceptance Gates

Phase 19D passes only when:

- exactly one reviewed Supabase migration file is present
- no `database/migrations` directory is added
- the migration creates only the five accepted candidate tables
- the migration includes RLS enable statements and owner-scoped select/insert policies
- the migration contains no destructive drop/truncate/broad delete operations
- local type contracts align to the migration and 19C table list
- no runtime auth, sync, routes, persistence, AppData schema, TrainingSession schema, package, or lockfile drift is introduced

## Phase 19B-19L Sequence

19B - Account Boundary & Local Inventory V1: implemented as a pure local inventory and readiness contract.

19C - Supabase Data Model & RLS Contract V1: implemented as a contract-only data model and RLS policy boundary.

19D - Supabase Migration Files + Local Type Contracts V1: implemented as reviewed migration files plus local type contracts, with no SQL application.

19E - Auth Client Skeleton + Env Guard V1: add guarded auth client skeleton and environment checks without making login required.

19F - Auth UI Skeleton V1: add passive login/account UI skeleton without turning on sync by default.

19G - Cloud Read Mirror V1: compare cloud candidate data without mutating local data.

19H - Cloud Write Shadow Mode V1: create candidate shadow writes only after backup, validation, and owner checks.

19I - Local-to-Cloud Migration Dry Run V1: dry run local-to-cloud migration without upload, download, or source-of-truth change.

19J - Explicit Opt-In Single-User Sync Candidate V1: allow sync candidate only with explicit user confirmation and conflict handling.

19K - Conflict / Offline / Rollback Acceptance V1: prove conflict review, offline behavior, rollback, and emergency local mode.

19L - Production Manual Acceptance V1: require manual acceptance before any cloud-primary consideration.

## Explicit Blocked Capabilities

Blocked in Phase 19D:

- no runtime auth
- no auth UI
- no cloud database connection from the app
- no cloud read/write runtime
- no SQL application by the app
- no default cloud sync
- no background sync
- no automatic worker/timer/polling sync
- no service-worker sync
- no automatic multi-device sync
- no localStorage replacement
- no source-of-truth switch
- no route changes
- no AppData schema change
- no TrainingSession schema change
- no persistence changes
- no package or lockfile drift
- no environment files
- no normalized training tables
- no destructive migration
- no real personal data in tests/docs/fixtures
- no public SaaS
- no coach/student runtime
- no marketplace
- no billing/payment/subscription runtime
- no external monitoring upload
- no production deployment auto-start

## Decision

Task 19D result: Supabase Migration Files + Local Type Contracts only.

Recommended next task: 19E Auth Client Skeleton + Env Guard V1.
