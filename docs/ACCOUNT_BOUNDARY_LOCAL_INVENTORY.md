# Phase 19B - Account Boundary & Local Inventory V1

## Scope

Phase 19B creates a pure local owner/account/device inventory and dry-run readiness contract.

It is not runtime auth and not sync.

It does not add routes, storage writes, cloud reads, cloud writes, environment files, migrations, package changes, UI, or source-of-truth switching.

The implementation is a pure TypeScript boundary that accepts existing local AppData-like input and optional account candidate identifiers, then reports readiness, blockers, backup/export preflight state, and future phase gates.

## Product Target

The product target remains single-user multi-device sync: one user account syncing the same owner training data across phone, computer, and tablet.

This is personal-only IronPath.

It is not public SaaS.
It is not coach/student.
It is not social.
It is not team collaboration.
It is not marketplace.

## Future Candidate Architecture

Supabase Auth + Supabase Postgres + RLS remains candidate architecture only.

Phase 19B does not create a Supabase client, does not add auth UI, does not connect to Supabase, does not create tables, and does not add migrations.

The 19B output can be used later as input evidence for account ownership, device identity, backup readiness, local snapshot identity, and RLS owner-match checks.

## Source-of-Truth Strategy

`localStorage` remains the current runtime source of truth.

`localStorage` remains fallback, migration source, and emergency rollback source.

Phase 19B reports `sourceOfTruthChanged: false`, `localDataChanged: false`, and `cloudDataChanged: false`.

Cloud-primary behavior remains blocked. Explicit opt-in sync remains blocked. Read mirror and write shadow remain future phases.

## Data Ownership

The 19B inventory separates these concepts:

- local owner id
- device id
- account candidate id
- owner user id
- local AppData snapshot hash
- backup snapshot hash

Account candidate readiness requires the account id and owner user id to agree for the current V1 RLS preflight.

Owner mismatch fails closed before any future cloud read, cloud write, sync, restore, or account relink behavior can proceed.

## Privacy, Export, And Delete

Phase 19B does not upload personal data.

First sync remains blocked unless a backup/export preflight is valid.

Future export/delete behavior must cover local emergency data, cloud snapshots, cloud operation history, conflict records, and account metadata needed to interpret ownership.

No raw AppData dumps, localStorage dumps, tokens, secrets, or real personal training data should appear in tests, logs, docs examples, or diagnostics.

## Offline Behavior

Offline training remains available.

Login must not be required to train.

When cloud work is unavailable or not yet accepted, localStorage remains usable and authoritative for daily training.

Blocked offline behaviors remain:

- no background sync worker
- no service-worker sync
- no automatic worker/timer/polling sync
- no silent cloud pull
- no silent cloud push
- no automatic multi-device sync

## Conflict Strategy

No last-write-wins default.

Phase 19B does not resolve conflicts. It only records inventory inputs future conflict checks will need:

- owner/account mismatch
- device identity
- local snapshot hash
- backup snapshot hash
- backup mismatch
- invalid local schema
- missing backup/export preflight

Future conflict review must preserve rollback to localStorage and explain whether local data, cloud data, or both changed.

## Local-To-Cloud Migration Dry Run

Phase 19B prepares dry-run inputs only.

The inventory can show whether a later migration dry run may start, but it never uploads, downloads, mutates localStorage, writes cloud data, or changes source of truth.

Required 19B preflight fields:

- AppData schema validity
- local owner inventory
- device inventory
- account candidate inventory
- owner match result
- source snapshot hash
- backup/export status
- backup snapshot hash
- future gate blockers

## Candidate Future Tables

The future cloud model remains document-first. Normalized training tables remain blocked.

Candidate future tables stay planning references only:

- `cloud_appdata_snapshots`
- `cloud_sync_operations`
- `cloud_devices`
- `cloud_conflicts`
- `cloud_export_delete_requests`

No table is created in Phase 19B.

## RLS Principles

RLS is required before future cloud data can be trusted.

Draft policy principles remain:

- users can read only rows where owner user id matches `auth.uid()`
- users can write only rows where owner user id matches `auth.uid()`
- account id and owner user id must agree
- device id must belong to the same account before write
- service role key must never enter browser runtime
- anonymous local data cannot auto-upload
- owner mismatch must reject

These principles are still not executable SQL in Phase 19B.

## Acceptance Gates

Phase 19B passes only when:

- the inventory builder is pure and deterministic
- valid local AppData plus matching backup can reach migration dry-run readiness
- missing backup blocks first sync
- invalid or mismatched backup blocks first sync
- owner mismatch blocks account readiness
- missing or invalid AppData blocks migration readiness
- opt-in sync remains false
- read mirror and write shadow remain future-only
- localStorage emergency fallback remains preserved
- no runtime auth, route, AppData schema, TrainingSession schema, storage writer, or package drift is introduced

## Phase 19B-19L Sequence

19B - Account Boundary & Local Inventory V1: implemented as a pure local inventory and readiness contract.

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

## Explicit Blocked Capabilities

Blocked in Phase 19B:

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

Task 19B result: Account Boundary & Local Inventory only.

Recommended next task: 19C Supabase Data Model & RLS Contract V1.
