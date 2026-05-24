# Phase 19C - Supabase Data Model & RLS Contract V1

## Scope

Phase 19C is contract-only.

It defines the candidate Supabase data model and RLS policy contract for future single-user multi-device sync.

No SQL is applied. No migration file is created. No table is created. No Supabase connection is made.

It does not add runtime auth, auth UI, cloud read runtime, cloud write runtime, sync runtime, routes, storage writes, environment files, package changes, lockfile changes, AppData schema changes, TrainingSession schema changes, or source-of-truth switching.

## Product Target

The product target remains single-user multi-device sync: one user account syncing the same owner training data across phone, computer, and tablet.

This is personal-only IronPath.

It is not public SaaS, coach/student, social, team collaboration, marketplace, billing, or shared workspace behavior.

## Candidate Architecture

Supabase Auth + Supabase Postgres + RLS remains candidate architecture only.

Phase 19C does not create a Supabase client, does not read real environment values, does not connect to a real project, and does not use real personal training data.

## Source-of-Truth Strategy

localStorage remains default, fallback, migration source, and emergency rollback source.

Phase 19C reports contract gates only:

- `migrationFilesCreated: false`
- `sqlApplied: false`
- `supabaseClientCreated: false`
- `authRuntimeEnabled: false`
- `syncRuntimeEnabled: false`
- `sourceOfTruthChanged: false`
- `localDataChanged: false`
- `cloudDataChanged: false`

Cloud-primary behavior remains blocked. Explicit opt-in sync remains blocked.

## Input From 19B

19B produces local owner/account/device inventory and backup/export preflight.

19C uses that vocabulary when defining future table and RLS ownership fields:

- `account_id`
- `owner_user_id`
- `device_id`
- `local_owner_id`
- `source_snapshot_hash`
- `operation_id`

19C does not consume live local data and does not upload anything.

## Candidate Future Tables

The future cloud model remains document-first. The 19C contract keeps a document-first AppData snapshot model. Normalized training tables remain blocked.

Candidate future tables:

- `cloud_appdata_snapshots`: validated AppData document snapshots for one owner account.
- `cloud_sync_operations`: idempotency and manual review journal for future sync operations.
- `cloud_devices`: owner devices allowed to participate in the same account candidate.
- `cloud_conflicts`: manual conflict review records for local and cloud snapshot divergence.
- `cloud_export_delete_requests`: future owner-controlled cloud export and delete lifecycle records.

No normalized exercise, set, session, history, body-weight, template, or analytics table is approved in 19C.

## Snapshot Table Contract

`cloud_appdata_snapshots` is the primary document-first table candidate.

Required fields:

- `id`
- `account_id`
- `owner_user_id`
- `device_id`
- `local_owner_id`
- `source_snapshot_hash`
- `schema_version`
- `operation_id`
- `app_data`
- `validation_status`
- `created_at`

`app_data` is the validated AppData document body. It must be validated before write and after read in later phases.

## Shared Ownership Columns

Each candidate future table must include:

- `account_id`
- `owner_user_id`
- `device_id`
- `local_owner_id`
- `created_at`

`account_id = owner_user_id` is the 19C V1 account-owner match contract. If that contract changes later, it must be changed in a dedicated ownership-contract task before migrations are generated.

## RLS Contract

RLS is required on every candidate future table.

Draft policy intent:

- select own rows: `owner_user_id = auth.uid()`
- insert own rows: `owner_user_id = auth.uid()`
- account owner match: `account_id = owner_user_id`
- device belongs to the same account before write
- service role key must never enter browser runtime
- anonymous local data cannot auto-upload
- owner mismatch must reject

Delete is blocked until an explicit future privacy/data-lifecycle phase.

These policy strings are contract references only. They are not executable migration files in 19C.

## Privacy, Export, And Delete

Export/delete remains owner-controlled.

Future export should cover cloud snapshots, sync operation history, device records, conflict records, export/delete request records, and a clear local backup path.

Future delete must require explicit confirmation and must not silently delete local emergency data.

Phase 19C creates no export/delete runtime.

## Offline Behavior

Offline training remains available.

Login must not be required to train.

No background sync worker, service-worker sync, automatic worker/timer/polling sync, silent pull, silent push, or automatic multi-device sync is approved.

## Conflict Strategy

No last-write-wins default.

The table contract preserves conflict inputs for later phases:

- local snapshot hash
- cloud snapshot hash
- operation id
- device id
- owner mismatch
- conflict type
- resolution status

Manual review remains required when conflict risk exists.

## Local-To-Cloud Migration Dry Run

19C prepares the schema/RLS contract that 19D can turn into migration files and type contracts.

19C does not run a migration, does not upload, does not download, and does not mutate localStorage.

Later migration dry-run work must verify:

- 19B inventory readiness
- 19C data model and RLS contract acceptance
- backup/export readiness
- source snapshot compatibility
- owner match
- conflict preflight
- rollback and emergency local mode availability

## Acceptance Gates

Phase 19C passes only when:

- required candidate tables are present in the contract
- `cloud_appdata_snapshots` remains document-first
- normalized training tables remain blocked
- every table requires RLS
- every table has owner-scoped select/insert policy intent
- service role browser exposure remains blocked
- delete remains blocked until explicit data lifecycle work
- no migration files are added
- no SQL is applied
- no AppData or TrainingSession schema fields are added
- no runtime auth, sync, routes, persistence, or package drift is introduced

## Phase 19B-19L Sequence

19B - Account Boundary & Local Inventory V1: implemented as a pure local inventory and readiness contract.

19C - Supabase Data Model & RLS Contract V1: implemented as a contract-only data model and RLS policy boundary.

19D - Supabase Migration Files + Local Type Contracts V1: add migration files and local type contracts only after this contract is accepted.

19E - Auth Client Skeleton + Env Guard V1: add guarded auth client skeleton and environment checks without making login required.

19F - Auth UI Skeleton V1: add passive login/account UI skeleton without enabling sync by default.

19G - Cloud Read Mirror V1: compare cloud candidate data without mutating local data.

19H - Cloud Write Shadow Mode V1: create candidate shadow writes only after backup, validation, and owner checks.

19I - Local-to-Cloud Migration Dry Run V1: dry run local-to-cloud migration without upload, download, or source-of-truth change.

19J - Explicit Opt-In Single-User Sync Candidate V1: allow sync candidate only with explicit user confirmation and conflict handling.

19K - Conflict / Offline / Rollback Acceptance V1: prove conflict review, offline behavior, rollback, and emergency local mode.

19L - Production Manual Acceptance V1: require manual acceptance before any cloud-primary consideration.

## Explicit Blocked Capabilities

Blocked in Phase 19C:

- no runtime auth
- no auth UI
- no cloud database connection
- no cloud read/write runtime
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
- no database migrations
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

Task 19C result: Supabase Data Model & RLS Contract only.

Recommended next task: 19D Supabase Migration Files + Local Type Contracts V1.
