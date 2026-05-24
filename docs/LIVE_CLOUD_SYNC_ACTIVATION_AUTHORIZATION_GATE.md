# Phase 20A - Live Cloud Sync Activation Authorization Gate V1

Phase 20A opens the Phase 20 runtime sequence with an authorization gate only.

It allows later tasks to build the explicit single-user cloud path in small reviewed steps, starting with Supabase project readiness in 20B. Auth runtime remains off, sync runtime remains off, and cloud-primary mode, default sync, background work, production launch, source-of-truth switching, and data mutation remain off.

## Scope

20A adds a pure authorization contract and tests.

The gate requires Phase 19L manual acceptance evidence, explicit activation intent, single-user scope confirmation, localStorage fallback confirmation, no silent overwrite confirmation, no service role in browser confirmation, local backup requirement confirmation, dry-run requirement confirmation, and no SaaS scope confirmation.

The result can authorize the runtime implementation sequence, but every later runtime task still needs its own reviewed PR and validation.

## Product Target

The target remains one person syncing that same person's IronPath data across phone, computer, and tablet.

This is not public SaaS.
This is not coach/student.
This is not team collaboration.
This is not billing, admin, marketplace, or social behavior.

## Source Of Truth

localStorage remains default, fallback, migration source, and emergency rollback source.

20A does not make cloud data primary. It does not delete local data. It does not upload, download, write localStorage, write cloud data, or apply remote data.

Later runtime work must keep explicit opt-in, backup-before-sync, dry-run-before-write, conflict review, rollback, and emergency local mode.

## Authorized Sequence

20A authorizes only this sequence:

1. 20B - Supabase Project Env & Runtime Readiness Check V1
2. 20C - Auth Runtime Wiring V1
3. 20D - Explicit Opt-In Sync Runtime Wiring V1
4. 20E - Local Backup + Dry-Run Migration Runtime Flow V1
5. 20F - Cloud Read/Write Verification Flow V1
6. 20G - Conflict/Offline/Rollback Runtime Flow V1
7. 20H - Production Acceptance With Synthetic Data V1
8. 20I - v0 UI Polish Handoff Contract V1

20A does not skip 20B, does not start UI polish, and does not combine durable runtime behavior with presentation polish.

## Safety Boundaries

20A preserves these boundaries:

- authRuntimeEnabled: false
- syncRuntimeEnabled: false
- liveCloudSyncActivated: false
- productionLaunchPerformed: false
- cloudPrimaryEnabled: false
- defaultSyncEnabled: false
- backgroundWorkEnabled: false
- sourceOfTruthChanged: false
- localStorageDeleted: false

No service role key may enter browser runtime.

No silent overwrite is allowed.

No default or background sync is allowed.

No cloud-primary default is allowed.

No route, schema, storage, package, lockfile, deployment, or environment file change is made in 20A.

## Acceptance Gates

20A passes only when:

- Phase 19L manual acceptance passed
- Phase 19L future cloud-primary consideration is ready
- Phase 19L validation, privacy, fallback, and route boundary evidence passed
- manual activation intent is explicit
- single-user personal scope is confirmed
- localStorage fallback is confirmed
- no default sync is confirmed
- no background work is confirmed
- no silent overwrite is confirmed
- no service role in browser is confirmed
- local backup before sync is required
- dry run before write is required
- no production launch, cloud-primary switch, source-of-truth switch, or localStorage deletion already happened

## Explicitly Blocked

Blocked in 20A:

- no auth UI expansion
- no auth runtime
- no sync runtime
- no real cloud read or write
- no automatic upload
- no automatic download
- no default sync
- no background work
- no cloud-primary default
- no silent overwrite
- no localStorage deletion
- no AppData schema change
- no TrainingSession schema change
- no storage or persistence change
- no route change
- no API runtime change
- no package or lockfile change
- no environment file
- no deployment behavior
- no v0 UI polish work
- no SaaS, coach/student, team, social, billing, admin, or marketplace behavior

## Decision

Phase 20A result: Live Cloud Sync Activation Authorization Gate only.

The gate may return `runtimeImplementationAuthorized: true` and `canStart20B: true` when all evidence and confirmations pass. That means 20B may start. Live sync remains inactive.

20B is the next task: Supabase Project Env & Runtime Readiness Check V1.
