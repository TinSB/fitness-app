# Phase 20B - Supabase Project Env & Runtime Readiness Check V1

Phase 20B adds a pure readiness check for the Supabase project and browser-safe runtime configuration needed before auth runtime wiring can be considered.

It does not create a Supabase client. It does not start auth runtime. It does not start sync runtime. It does not read or write localStorage. It does not upload, download, write cloud data, add routes, create environment files, deploy anything, or change source of truth.

## Scope

20B composes the existing browser-safe Supabase project guard and auth callback guard with the Phase 20A authorization result.

It accepts an env-like record supplied by the caller and reports readiness. The source does not read real environment files and does not read `process.env`.

20B is safe to validate with synthetic values in automated tests.

## Required Public Browser Keys

20B requires these public browser keys before 20C may start:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_IRONPATH_AUTH_CALLBACK_URL`
- `VITE_IRONPATH_CLOUD_ENVIRONMENT`

`VITE_IRONPATH_CLOUD_ENVIRONMENT` must be `production` for this readiness result to pass.

The service role key must never be present in browser config.

## Readiness Result

The readiness result can report `readyFor20C: true` only when:

- Phase 20A authorized 20B
- all required public keys are present
- the Supabase project URL is HTTPS and production-classified
- the anon key is present as a public anon candidate
- the auth callback URL is HTTPS and production-classified
- no service role key is present
- browser config has no secret-like keys
- auth runtime is still off
- sync runtime is still off
- cloud-primary mode is still off
- default sync is still off
- background work is still off
- source of truth has not changed
- localStorage has not been deleted

## Preserved Boundaries

20B always reports:

- `clientCreated: false`
- `networkAttempted: false`
- `authRuntimeEnabled: false`
- `syncRuntimeEnabled: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`
- `localStorageFallbackPreserved: true`
- `serviceRoleExposed: false`
- `secretsExposed: false`

## Missing Local Setup

If the current environment does not provide the required public keys, 20B should stop before 20C and report the missing values.

Manual setup required before 20C:

- create or choose the Supabase project
- configure the browser-safe project URL as `VITE_SUPABASE_URL`
- configure the public anon key as `VITE_SUPABASE_ANON_KEY`
- configure the HTTPS auth callback URL as `VITE_IRONPATH_AUTH_CALLBACK_URL`
- set `VITE_IRONPATH_CLOUD_ENVIRONMENT=production`
- keep service role credentials outside browser config
- rerun 20B validation

## Explicitly Blocked

Blocked in 20B:

- no real client creation
- no sign-in flow
- no session storage
- no sync runtime
- no cloud read
- no cloud write
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

## Decision

Phase 20B result: Supabase Project Env & Runtime Readiness Check only.

When the readiness check passes with real public project configuration, 20C may begin. If real public configuration is missing, stop before 20C and complete the manual setup first.
