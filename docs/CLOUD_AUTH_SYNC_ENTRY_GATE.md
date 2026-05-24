# Phase 19A - Cloud Auth & Sync Entry Gate V1

## Scope

Phase 19A is docs/static tests only.

It creates the entry gate for future cloud auth and sync work. It does not implement runtime auth, real cloud sync, source-of-truth switching, environment configuration, routes, database migrations, package changes, or UI.

Phase 19A does not change `App.tsx`, `src/storage/persistence.ts`, `src/storage/localStorageAdapter.ts`, `src/models/training-model.ts`, `apps/api/src/*`, package files, lockfiles, or environment files.

## Product Target

The V1 target is single-user multi-device sync: one user account syncing the same owner training data across phone, computer, and tablet.

This is for personal-only IronPath use.

It is not coach/student.
It is not social.
It is not team collaboration.
It is not marketplace.
It is not public SaaS.

No Phase 19A decision should imply a commercial multi-tenant product, public onboarding, billing, customer support, public deployment, or shared training workspace.

## Future Candidate Architecture

The future candidate architecture is Supabase Auth + Supabase Postgres + RLS.

This is candidate architecture only.

Phase 19A does not install a provider SDK, does not add environment variables, does not connect to a cloud database, does not create tables or migrations, does not add routes, does not add auth UI, and does not change package files.

Supabase Auth is the identity candidate because prior provider decisions already preferred it for account-scoped cloud work. Supabase Postgres is the database candidate because prior cloud database decisions selected a document-first AppData snapshot path with RLS.

Existing Phase 12 Supabase candidate code remains prior disabled/candidate work. Phase 19A does not expand that runtime surface.

## Source-of-Truth Strategy

`localStorage` remains the current runtime source of truth.

`localStorage` remains fallback, migration source, and emergency rollback source.

Cloud sync must remain explicit opt-in until proven safe.

The future path is:

1. read mirror
2. write shadow
3. explicit opt-in sync
4. cloud-primary can be considered only after acceptance gates pass

No Phase 19A work may silently overwrite local data.

No Phase 19A work may make cloud primary by default, remove localStorage fallback, delete emergency local data, or upload training data automatically.

## Data Ownership

The ownership model is one account owns one AppData snapshot stream.

Devices are clients for the same owner, not collaborators.

Future ownership records must distinguish:

- account id
- owner user id
- device id
- local owner id
- cloud account owner

Owner mismatch must fail closed before cloud read, cloud write, sync, restore, or account relink behavior can proceed.

Anonymous local data must not auto-upload. Account linking must require a dry run, local backup readiness, owner match, and explicit confirmation in a later task.

## Privacy, Export, And Delete

Future privacy behavior must keep personal training data owner-controlled.

Export must include cloud snapshots, cloud operation history, conflict records, account metadata needed for interpretation, and a clear local backup path.

Delete must require explicit confirmation. It must not silently delete local emergency data. It must distinguish account deletion, cloud data deletion, and local emergency backup removal.

No service role key may enter browser runtime.

No raw AppData dumps, localStorage dumps, tokens, secrets, or real personal training data may be written into automated tests, logs, public docs examples, or diagnostics.

## Offline Behavior

The app remains offline-first.

When offline, localStorage remains usable and authoritative for daily training.

Future sync work must pause safely when unavailable. It must not block local app usage, force login to train, or create fake success.

Blocked offline behaviors:

- no background sync worker
- no service-worker sync
- no automatic worker/timer/polling sync
- no silent cloud pull
- no silent cloud push
- no automatic multi-device sync

## Conflict Strategy

Conflict resolution must be conservative.

No last-write-wins default is allowed.

Conflicts that must be detected before apply include:

- local newer than cloud
- cloud newer than local
- both changed offline
- owner mismatch
- device clock mismatch
- duplicate operation id
- stale cloud revision
- corrupt cloud data
- cloud write accepted but local confirmation failed

Manual review is required when conflict risk exists. Future UI must explain whether local data, cloud data, or both changed, and it must preserve rollback to localStorage.

## Local-To-Cloud Migration Dry Run

The migration dry run is the first future proof point before any cloud write.

The dry run must not upload. The dry run must not download. The dry run must not mutate localStorage. The dry run must not change source of truth.

Required dry-run checks:

- AppData schema validation
- backup/export readiness
- local owner identity inventory
- account owner match
- target cloud snapshot readiness
- conflict preflight
- RLS policy preflight
- rollback and emergency local mode availability

## Candidate Future Tables

The future cloud model remains document-first. Normalized training tables are blocked in this gate.

Candidate future tables are planning references only:

- `cloud_appdata_snapshots`: complete AppData document snapshots for the owner account.
- `cloud_sync_operations`: operation journal for idempotency and conflict review.
- `cloud_devices`: owner devices allowed to participate in the same account.
- `cloud_conflicts`: manual conflict review records.
- `cloud_export_delete_requests`: future privacy export/delete lifecycle records.

No table is created in Phase 19A. No SQL migration is added in Phase 19A.

## RLS Principles

RLS is required before future cloud data can be trusted.

Draft policy principles:

- users can read only rows where owner user id matches `auth.uid()`
- users can write only rows where owner user id matches `auth.uid()`
- account id and owner user id must agree
- device id must belong to the same account before write
- service role key must never enter browser runtime
- anonymous local data cannot auto-upload
- owner mismatch must reject

These principles are not executable SQL in Phase 19A.

## Acceptance Gates

Future implementation must pass all gates before moving toward cloud primary:

- local backup/export works before cloud write
- migration dry run reports safe
- read mirror compares without mutating local data
- write shadow records candidate writes without source-of-truth switch
- explicit opt-in sync requires user confirmation
- conflict detection blocks unsafe apply
- rollback / kill switch remains available
- emergency local mode remains available
- route inventory remains unchanged unless explicitly approved
- package and lockfile changes are explicitly authorized in their own task
- no real personal training data appears in automated tests

Validation remains:

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- production dist forbidden-token scan
- package/lockfile drift check

## Phase 19B-19L Sequence

19B - Account Boundary & Local Inventory V1: implemented as a pure local owner/account/device inventory and dry-run readiness contract. It reports backup/export preflight, source snapshot identity, owner match, and future gates without auth runtime, sync runtime, persistence, routes, or source-of-truth change.

19C - Supabase Data Model & RLS Contract V1: define candidate document-first table and RLS policy contract without applying SQL.

19D - Supabase Migration Files + Local Type Contracts V1: add migration files and local type contracts only after the RLS contract is accepted.

19E - Auth Client Skeleton + Env Guard V1: add guarded auth client skeleton and environment checks without making login required.

19F - Auth UI Skeleton V1: add passive login/account UI skeleton without enabling sync by default.

19G - Cloud Read Mirror V1: compare cloud candidate data without mutating local data.

19H - Cloud Write Shadow Mode V1: create candidate shadow writes only after backup, validation, and owner checks.

19I - Local-to-Cloud Migration Dry Run V1: dry run local-to-cloud migration without upload, download, or source-of-truth change.

19J - Explicit Opt-In Single-User Sync Candidate V1: allow sync candidate only with explicit user confirmation and conflict handling.

19K - Conflict / Offline / Rollback Acceptance V1: prove conflict review, offline behavior, rollback, and emergency local mode.

19L - Production Manual Acceptance V1: require manual acceptance before any cloud-primary consideration.

Do not start 19B from 19A.

## Explicit Blocked Capabilities

Blocked in Phase 19A:

- no runtime auth
- no real login UI
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
- no public SaaS
- no coach/student runtime
- no marketplace
- no billing/payment/subscription runtime
- no external monitoring upload
- no production deployment auto-start

## Decision

Task 19A result: Cloud Auth & Sync Entry Gate only.

Task 19B result: Account Boundary & Local Inventory only. It is implemented as pure local inventory and readiness logic, not runtime auth or sync.

The approved next step after 19B is 19C Supabase Data Model & RLS Contract V1. Phase 19A itself adds no runtime behavior.
