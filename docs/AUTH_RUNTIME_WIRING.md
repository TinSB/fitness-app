# Phase 20C - Auth Runtime Wiring V1

Phase 20C adds a pure auth runtime wiring boundary.

It requires Phase 20B readiness, an injected auth adapter, and explicit user action for sign-in or sign-out. It does not create a Supabase client, does not read environment files, does not write localStorage, does not store tokens, does not start sync runtime, and does not change source of truth.

## Scope

20C wires auth state through a caller-supplied adapter.

The default state is disabled.

If 20B is not ready, 20C fails closed.

If an adapter is missing, 20C fails closed.

If sign-in or sign-out is requested without user action, 20C fails closed.

Synthetic adapters can validate the local runtime contract while real public Supabase configuration is missing.

## Runtime Contract

20C can report:

- `session_checked`
- `signed_in`
- `signed_out`

Only `signed_in` with an account-scoped user can report `readyFor20D: true`.

`readyFor20D` stays false for disabled wiring, missing readiness, missing adapters, missing user action, unsafe adapter results, unauthenticated sessions, and signed-out sessions.

20C blocks adapter results that report token storage, secret exposure, localStorage mutation, sync runtime, cloud-primary mode, default sync, background work, source-of-truth change, or localStorage deletion.

## Preserved Boundaries

20C always reports:

- `clientCreated: false`
- `tokenStored: false`
- `localStorageChanged: false`
- `localStorageDeleted: false`
- `secretsExposed: false`
- `serviceRoleExposed: false`
- `syncRuntimeEnabled: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageFallbackPreserved: true`

Auth runtime wiring does not mean sync is on.

Auth runtime wiring does not make cloud data primary.

Auth runtime wiring does not upload or download training data.

## Minimal User Copy For Later UI

Future UI may use concise copy:

- 登录账号
- 退出登录
- 本地数据仍会保留
- 不会自动覆盖本地训练记录
- 稍后再说

20C does not redesign account settings. v0 polish remains deferred until 20I.

## Missing Local Setup

The current local environment must still provide the 20B public values before live Supabase auth can be used:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_IRONPATH_AUTH_CALLBACK_URL`
- `VITE_IRONPATH_CLOUD_ENVIRONMENT=production`

Until those are present, 20C can be validated only with synthetic adapters.

## Explicitly Blocked

Blocked in 20C:

- no sync runtime
- no default sync
- no background work
- no cloud-primary switch
- no silent overwrite
- no localStorage deletion
- no AppData schema change
- no TrainingSession schema change
- no route change
- no persistence change
- no API runtime change
- no package or lockfile change
- no environment file
- no deployment behavior
- no v0 UI polish work
- no SaaS, coach/student, team, social, billing, admin, or marketplace behavior

## Decision

Phase 20C result: Auth Runtime Wiring only.

When 20B readiness is proven with real public configuration and a safe adapter signs in an account-scoped user, 20D - Explicit Opt-In Sync Runtime Wiring V1 may begin. 20D may begin only after that evidence is present. If the public configuration is missing, stop before live sync wiring and complete the 20B setup first.
