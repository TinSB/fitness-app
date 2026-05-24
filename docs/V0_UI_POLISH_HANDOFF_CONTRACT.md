# Phase 20I - v0 UI Polish Handoff Contract V1

Phase 20I adds a v0 UI polish handoff contract only.

It does not start v0 UI polish. It prepares stable product boundaries, stable props, stable data-testid markers, and clean copy examples after Phase 20H acceptance.

## Scope

20I adds `buildV0UiPolishHandoffContract`.

The contract requires Phase 20H acceptance before it can report:

- `readyForV0UiPolish: true`
- `phase20SequenceComplete: true`

This is a handoff contract only. It does not render UI, does not wire App runtime, and does not redesign any surface.

## Product Target

The product target remains one person syncing that same person's IronPath data across phone, computer, and tablet.

v0 polish may later improve the presentation of that personal flow. It must not add SaaS, coach/student, team, social, billing, admin, or marketplace behavior.

## Handoff Surfaces

20I defines stable polish surfaces for later design work:

- auth screen polish
- sync status center
- first-sync flow
- conflict review UI
- offline/recovery states
- account settings polish

Business logic stays outside presentational components.

## Stable Props And Test IDs

Later UI polish should consume stable props from existing runtime state and contract outputs.

Stable data-testid markers include:

- `ironpath-auth-card`
- `ironpath-sync-status-center`
- `ironpath-first-sync-flow`
- `ironpath-conflict-review`
- `ironpath-offline-recovery`
- `ironpath-account-settings`

The handoff also records login account, sync status center, first-sync, conflict review, offline recovery, and account settings states so v0 can polish the UI without changing behavior.

## Copy Examples

Approved copy examples:

- 登录账号
- 开启同步
- 本地数据仍会保留
- 开启前先备份
- 不会自动覆盖本地训练记录
- 查看冲突
- 保留本地
- 使用云端
- 稍后再说
- 退出登录

The UI must remain Chinese-first, concise, and professional.

## Safety Boundaries

20I keeps these boundaries:

- `uploadPerformed: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`
- `productionLaunchPerformed: false`

20I does not upload data.
20I does not download data.
20I does not apply cloud data.
20I does not write localStorage.
20I does not delete localStorage.
20I does not make cloud data primary.
20I does not enable default sync.
20I does not start background sync.
20I does not add routes.
20I does not change AppData or TrainingSession schemas.
20I does not change persistence.
20I does not change packages or lockfiles.
20I does not create a Supabase client.
20I does not read environment files.
20I does not store tokens.
20I does not start v0 UI polish.

## Acceptance Gates

20I passes only when:

- Phase 20H acceptance is ready for 20I
- validation and synthetic acceptance evidence passed
- privacy, fallback, and route boundary evidence passed
- localStorage fallback remains preserved
- stable props are documented
- stable data-testid markers are documented
- copy is Chinese-first and avoids forbidden terms
- durable/apply wording is absent
- no route, schema, persistence, package, lockfile, source-of-truth, localStorage deletion, cloud-primary, default sync, or background work change is present
- no UI polish has started in this task

## Explicitly Blocked

Blocked in 20I:

- no actual v0 redesign
- no mounted UI change
- no auth screen implementation change
- no sync status center implementation change
- no first-sync implementation change
- no conflict review implementation change
- no offline/recovery implementation change
- no account settings implementation change
- no production launch
- no automatic upload or download
- no automatic conflict choice
- no silent overwrite
- no cloud-primary default
- no default sync
- no background sync
- no localStorage deletion
- no service-role browser exposure
- no AppData schema change
- no TrainingSession schema change
- no storage or persistence change
- no route change
- no API runtime change
- no package or lockfile change

## Decision

Phase 20I result: v0 UI Polish Handoff Contract only.

When all gates pass, the contract can report `readyForV0UiPolish: true` and `phase20SequenceComplete: true`.

Phase 20 sequence complete. v0 UI Polish may start in a separate design task.
