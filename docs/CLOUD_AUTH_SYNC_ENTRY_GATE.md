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

19C - Supabase Data Model & RLS Contract V1: implemented as a contract-only document-first table and RLS policy boundary. It does not apply SQL, create tables, add migration files, connect to Supabase, or start auth/sync runtime.

19D - Supabase Migration Files + Local Type Contracts V1: implemented as reviewed migration files plus local type contracts. The migration is committed for review, but SQL is not applied by the app and no runtime Supabase behavior is enabled.

19E - Auth Client Skeleton + Env Guard V1: implemented as a guarded auth client skeleton and environment checks without making login required.

19F - Auth UI Skeleton V1: implemented as a passive Settings account surface without turning on sync by default.

19G - Cloud Read Mirror V1: implemented as a passive metadata comparison without mutating local data.

19H - Cloud Write Shadow Mode V1: implemented as in-memory shadow write candidates gated by backup, dry run, validation, owner, conflict, duplicate, and adapter checks.

19I - Local-to-Cloud Migration Dry Run V1: implemented as a dry-run-only readiness report without upload, download, local write, cloud write, or source-of-truth change.

19J - Explicit Opt-In Single-User Sync Candidate V1: implemented as a manual candidate report only after explicit opt-in, confirmation, dry run, backup, shadow, conflict, rollback, and offline gates pass.

19K - Conflict / Offline / Rollback Acceptance V1: implemented as acceptance evidence for conflict review, offline behavior, rollback, emergency local, and unchanged route/package/schema boundaries.

19L - Production Manual Acceptance V1: implemented as manual acceptance evidence before any future cloud-primary consideration.

Do not start 19B from 19A.

## Phase 20A Runtime Sequence Authorization

20A - Live Cloud Sync Activation Authorization Gate V1: implemented as a pure authorization contract for the Phase 20 runtime sequence. It requires Phase 19L manual acceptance evidence, explicit activation intent, single-user personal scope confirmation, localStorage fallback confirmation, no silent overwrite confirmation, no service role in browser confirmation, local backup requirement confirmation, dry-run requirement confirmation, and no SaaS scope confirmation.

20A may authorize 20B through 20I as separate reviewed runtime tasks, starting with Supabase Project Env & Runtime Readiness Check V1.

20A keeps auth runtime off, keeps sync runtime off, and keeps cloud-primary mode, default sync, background work, production launch, source-of-truth switching, routes, schema changes, persistence changes, package changes, lockfile changes, environment files, deployment behavior, and v0 UI polish off.

20A keeps `authRuntimeEnabled: false`, `syncRuntimeEnabled: false`, `liveCloudSyncActivated: false`, `productionLaunchPerformed: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`.

20B - Supabase Project Env & Runtime Readiness Check V1: implemented as a pure readiness check for browser-safe public Supabase project configuration. It reports missing `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_IRONPATH_AUTH_CALLBACK_URL`, and `VITE_IRONPATH_CLOUD_ENVIRONMENT` keys, rejects service role browser risk, and requires Phase 20A authorization before 20C may start.

20B keeps `clientCreated: false`, `networkAttempted: false`, `authRuntimeEnabled: false`, `syncRuntimeEnabled: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`.

20C - Auth Runtime Wiring V1: implemented as a pure auth runtime wiring boundary. It requires 20B readiness, an injected auth adapter, and explicit user action for sign-in or sign-out. It supports local synthetic adapter validation while real public Supabase configuration is missing.

20C keeps `clientCreated: false`, `tokenStored: false`, `localStorageChanged: false`, `localStorageDeleted: false`, `secretsExposed: false`, `serviceRoleExposed: false`, `syncRuntimeEnabled: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, and `sourceOfTruthChanged: false`.

20D - Explicit Opt-In Sync Runtime Wiring V1: implemented as a pure explicit opt-in sync runtime boundary. It requires 20C auth readiness, an authenticated account user, explicit opt-in, manual confirmation, localStorage fallback confirmation, no silent overwrite confirmation, backup-before-sync confirmation, and safe runtime boundary evidence.

20D may report `syncRuntimeEnabled: true` and `readyFor20E: true` after explicit gates pass, but it keeps `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`.

20E - Local Backup + Dry-Run Migration Runtime Flow V1: implemented as a pure local backup and migration dry-run runtime flow. It requires 20D sync runtime readiness, an authenticated account user, backup/export confirmation, account boundary readiness, schema preflight, cloud repository availability evidence, RLS preflight evidence, rollback availability evidence, and safe runtime boundary evidence.

20E may report `readyFor20F: true` after those gates pass, but it keeps `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`.

20F - Cloud Read/Write Verification Flow V1: implemented as an explicit cloud read/write verification gate. It requires 20E readiness, explicit verification opt-in, manual confirmation, cloud read repository evidence, cloud write-shadow adapter evidence, duplicate operation protection, rollback availability, and safe runtime boundary evidence.

20F may report `readyFor20G: true` after those gates pass, and records `cloudReadAttempted` and `cloudWriteAttempted` verification evidence, but it keeps `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`.

20G - Conflict/Offline/Rollback Runtime Flow V1: implemented as a conflict, offline, rollback, and emergency local runtime evidence gate. It requires 20F verification readiness, completed conflict review, offline training availability, no-fake-success behavior, rollback availability, emergency local availability, localStorage fallback availability, unchanged route/package/schema boundaries, and safe runtime boundary evidence.

20G may report `readyFor20H: true` after those gates pass, but it keeps `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, `localStorageDeleted: false`, and `productionLaunchPerformed: false`.

20H - Production Acceptance With Synthetic Data V1: implemented as a synthetic-data acceptance gate. It requires 20G readiness, validation evidence, dedicated environment evidence, dedicated browser profile evidence, synthetic-data-only evidence, backup/export evidence, RLS ownership evidence, service-role browser boundary evidence, privacy export/delete documentation, offline/rollback/emergency local evidence, route lock evidence, package/lockfile cleanliness, and safe production boundary evidence.

20H may report `readyFor20I: true` after those gates pass, but it keeps `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, `localStorageDeleted: false`, and `productionLaunchPerformed: false`.

20I - v0 UI Polish Handoff Contract V1: implemented as a passive handoff contract after 20H acceptance. It records stable props, stable data-testid markers, Chinese-first copy examples, and allowed future polish surfaces: login account, sync status center, first-sync flow, conflict review, offline recovery, and account settings.

20I may report `readyForV0UiPolish: true` and `phase20SequenceComplete: true` after those gates pass, but it keeps `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, `localStorageDeleted: false`, and `productionLaunchPerformed: false`.

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

Task 19C result: Supabase Data Model & RLS Contract only. It is implemented as pure contract data and validation, not migrations or runtime Supabase behavior.

Task 19D result: Supabase Migration Files + Local Type Contracts only. It adds the reviewed migration file and local row contracts, but no app SQL execution, auth runtime, sync runtime, or source-of-truth change.

Task 19E result: Auth Client Skeleton + Env Guard only. It composes existing Supabase project and auth callback guards into a passive readiness skeleton without real client creation, token storage, login requirement, runtime auth, sync runtime, or source-of-truth change.

Task 19F result: Auth UI Skeleton only. It mounts a passive Settings account surface without provider actions, token storage, auth client runtime import, sync runtime, cloud data reads, cloud data writes, or source-of-truth change.

Task 19G result: Cloud Read Mirror only. It compares cloud candidate metadata with local snapshot metadata without applying cloud data, writing localStorage, writing cloud data, or changing source of truth.

Task 19H result: Cloud Write Shadow Mode only. It creates in-memory shadow write candidates after explicit gates without writing localStorage, applying cloud data, making cloud primary, or changing source of truth.

Task 19I result: Local-to-Cloud Migration Dry Run only. It reports `readyForShadowCandidate`, `noUpload: true`, `noDownload: true`, `localDataChanged: false`, `cloudDataChanged: false`, and `sourceOfTruthChanged: false` without uploading, downloading, writing localStorage, writing cloud data, or changing source of truth.

Task 19J result: Explicit Opt-In Single-User Sync Candidate only. It reports `readyForManualSyncCandidate`, `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, and `sourceOfTruthChanged: false` without uploading, downloading, applying cloud data, writing localStorage, writing cloud data, starting background sync, making cloud primary, or changing source of truth.

Task 19K result: Conflict / Offline / Rollback Acceptance only. It reports `acceptedForManualProductionReview`, `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, and `sourceOfTruthChanged: false` without uploading, downloading, applying cloud data, writing localStorage, writing cloud data, starting background sync, making cloud primary, or changing source of truth.

Task 19L result: Production Manual Acceptance only. It reports `manualAcceptancePassed`, `readyForFutureCloudPrimaryConsideration`, `productionLaunchPerformed: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, and `sourceOfTruthChanged: false` without launching production, uploading, downloading, applying cloud data, writing localStorage, writing cloud data, starting background sync, making cloud primary, or changing source of truth.

Phase 19 sequence complete. A future phase must make a separate decision before enabling cloud-primary behavior.

Task 20A result: Live Cloud Sync Activation Authorization Gate only. It can authorize the Phase 20 runtime implementation sequence after Phase 19L evidence and explicit safety confirmations pass, but it does not activate live sync or change source of truth. The next task is 20B - Supabase Project Env & Runtime Readiness Check V1.

Task 20B result: Supabase Project Env & Runtime Readiness Check only. It reports public browser config readiness and exact missing setup keys without creating a client, reading real environment files, writing data, or changing source of truth. The next task is 20C - Auth Runtime Wiring V1 only after real public project configuration is present.

Task 20C result: Auth Runtime Wiring only. It wires auth state through an injected adapter, requires explicit user action for sign-in and sign-out, and blocks token storage, secret exposure, localStorage mutation, sync runtime, cloud-primary mode, default sync, background work, source-of-truth changes, and localStorage deletion. The next task is 20D - Explicit Opt-In Sync Runtime Wiring V1 only after real public project configuration and safe auth sign-in are available.

Task 20D result: Explicit Opt-In Sync Runtime Wiring only. It wires the manual sync runtime state after explicit opt-in and safety confirmations, but it does not upload, download, apply cloud data, make cloud data primary, start default/background sync, change source of truth, or delete localStorage. The next task is 20E - Local Backup + Dry-Run Migration Runtime Flow V1.

Task 20E result: Local Backup + Dry-Run Migration Runtime Flow only. It wires backup metadata and migration dry-run evidence after 20D sync readiness, but it does not upload, download, apply cloud data, write localStorage, write cloud data, make cloud data primary, start default/background sync, change source of truth, or delete localStorage. The next task is 20F - Cloud Read/Write Verification Flow V1.

Task 20F result: Cloud Read/Write Verification Flow only. It verifies read mirror and write-shadow candidate evidence after 20E readiness, but it does not upload, download, apply cloud data to local data, write localStorage, make cloud data primary, start default/background sync, change source of truth, or delete localStorage. The next task is 20G - Conflict/Offline/Rollback Runtime Flow V1.

Task 20G result: Conflict/Offline/Rollback Runtime Flow only. It verifies conflict review, offline fallback, rollback, emergency local, and route/package/schema boundary evidence after 20F readiness, but it does not upload, download, apply cloud data, write localStorage, make cloud data primary, start default/background sync, launch production, change source of truth, or delete localStorage. The next task is 20H - Production Acceptance With Synthetic Data V1.

Task 20H result: Production Acceptance With Synthetic Data only. It verifies validation and synthetic acceptance evidence after 20G readiness, but it does not upload, download, apply cloud data, write localStorage, make cloud data primary, start default/background sync, launch production, change source of truth, delete localStorage, or start v0 UI polish. The next task is 20I - v0 UI Polish Handoff Contract V1.

Task 20I result: v0 UI Polish Handoff Contract only. It records stable props, stable data-testid markers, Chinese-first copy examples, and future UI polish surfaces after 20H acceptance, but it does not start v0 UI polish, upload, download, apply cloud data, write localStorage, make cloud data primary, start default/background sync, launch production, change source of truth, delete localStorage, add routes, or change schemas. Phase 20 sequence complete.

Task 21A result: Explicit Opt-In Sync Preflight only. It reads existing Phase 20 public readiness and signed-in auth runtime evidence, then may report `readyFor21B: true` for the next local backup and dry-run UI step. It may show Settings preflight copy such as `本地数据仍会保留`, `开启前先备份`, `检查本地数据`, and `查看将同步的内容`. It keeps `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `syncRuntimeEnabled: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`. It does not upload, download, write cloud data, write localStorage, make cloud data primary, start default/background sync, delete localStorage, add routes, change schemas, change persistence, or change packages/lockfiles. The next task is 21B - Local Backup Dry Run UI V1.

Task 21B result: Local Backup Dry Run UI only. It reads 21A preflight, local backup evidence, local account boundary inventory, and a user-requested dry-run preview, then may report `readyFor21C: true` for the next cloud write shadow candidate step. It may show Settings copy such as `本地数据仍会保留`, `开启前先备份`, `检查本地数据`, and `查看将同步的内容`. It keeps `uploadPerformed: false`, `downloadPerformed: false`, `autoApplied: false`, `syncRuntimeEnabled: false`, `liveCloudSyncActivated: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`. It does not upload, download, write cloud data, write localStorage, make cloud data primary, start default/background sync, delete localStorage, add routes, change schemas, change persistence, change packages/lockfiles, or expose first-upload apply. The next task is 21C - Cloud Write Shadow Candidate V1.

Task 21C result: Cloud Write Shadow Candidate only. It reads 21B backup dry-run readiness, current local AppData, owner evidence, schema preflight, duplicate journal evidence, and explicit shadow confirmation, then may report `readyFor21D: true` for the next cloud read mirror verification step. It keeps `inMemoryShadowCandidateOnly: true`, `requiresFirstUploadExplicitApply: true`, `requiresCloudReadMirrorBeforeApply: true`, `uploadPerformed: false`, `downloadPerformed: false`, `cloudWriteAttempted: false`, `cloudDataChanged: false`, `autoApplied: false`, `syncRuntimeEnabled: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`. It does not upload, download, read cloud data, write cloud data, write localStorage, make cloud data primary, start default/background sync, delete localStorage, add routes, change schemas, change persistence, change packages/lockfiles, or expose first-upload apply. The next task is 21D - Cloud Read Mirror Verification V1.

Task 21D result: Cloud Read Mirror Verification only. It reads 21C shadow candidate readiness, injected cloud read repository evidence, local snapshot metadata, owner/schema checks, and explicit read-mirror verification, then may report `readyFor21E: true` only when cloud data is missing or exactly mirrored. Different cloud metadata requires manual review. It keeps `cloudReadMirrorVerified: true`, `requiresFirstUploadExplicitApply: true`, `uploadPerformed: false`, `downloadPerformed: false`, `cloudWriteAttempted: false`, `cloudDataChanged: false`, `autoApplied: false`, `syncRuntimeEnabled: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`. It does not upload, download, write cloud data, apply cloud data, write localStorage, make cloud data primary, start default/background sync, delete localStorage, add routes, change schemas, change persistence, change packages/lockfiles, or expose first-upload apply. The next task is 21E - First Upload Explicit Apply V1.

Task 21E result: First Upload Explicit Apply only. It reads 21C shadow candidate readiness, 21D read mirror verification, current local AppData, schema preflight, explicit first-upload confirmation, local fallback confirmation, no-silent-overwrite confirmation, backup confirmation, and an injected write repository, then may report `readyFor21F: true` after the first upload is explicitly applied. It keeps `firstUploadExplicitlyApplied: true`, `uploadPerformed: true`, `cloudWriteAttempted: true`, `cloudDataChanged: true`, `syncRuntimeEnabled: true`, `downloadPerformed: false`, `autoApplied: false`, `localDataChanged: false`, `cloudPrimaryEnabled: false`, `defaultSyncEnabled: false`, `backgroundWorkEnabled: false`, `sourceOfTruthChanged: false`, and `localStorageDeleted: false`. It does not download cloud data, apply cloud data to local data, write localStorage, make cloud data primary, start default/background sync, delete localStorage, add routes, change schemas, change persistence, or change packages/lockfiles. The next task is 21F - Cloud Parity Check V1.
