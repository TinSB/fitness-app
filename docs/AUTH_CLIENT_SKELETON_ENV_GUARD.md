# Phase 19E - Auth Client Skeleton + Env Guard V1

Phase 19E adds a guarded auth client skeleton and environment guard for the future single-user multi-device sync path.

It is a passive boundary. Login is not required. It does not store tokens, does not connect to Supabase, does not start sync, and does not change the source of truth.

## Scope

19E composes the existing Supabase project guard and auth callback guard into one browser-safe readiness object.

It reports:

- whether the candidate project environment is safe enough for later review
- whether the callback target is safe enough for later review
- whether the client candidate is ready for a later UI skeleton
- why runtime auth and sync remain deferred

No token is stored. No Supabase network request is made. No AppData or TrainingSession schema changes are made.

## Product Target

The product target remains personal-only single-user multi-device sync.

19E does not expand IronPath into public SaaS, coach/student workflows, social sharing, team collaboration, marketplace behavior, or multi-tenant administration.

## Environment Guard

The guard accepts only explicit production-class candidate inputs:

- HTTPS Supabase project URL
- public anon-key classification only
- no service role key in browser-safe config
- HTTPS callback URL
- production environment classification
- no secret-like browser config keys

Preview, localhost, missing project config, missing callback config, and secret-like browser keys fail closed.

## Auth Client Skeleton

The skeleton is disabled by default.

When candidate inputs pass the guards, the skeleton reports `ready_candidate`, but still keeps:

- client creation deferred
- auth runtime deferred
- sync runtime deferred
- login optional
- network attempts disabled
- source-of-truth unchanged
- local storage unchanged

It exposes passive `getSession`, `signIn`, and `signOut` placeholders that return explicit unsupported results. They do not call a provider, open a login flow, write browser storage, or fake success.

## Source Of Truth

localStorage remains default, fallback, migration source, and emergency rollback source.

19E does not replace localStorage, write localStorage, read cloud data, write cloud data, upload snapshots, download snapshots, resolve conflicts, or change runtime source selection.

## Privacy And Secrets

The browser-safe config may describe a project URL, callback URL, provider candidate, and anon-key classification.

It must not contain:

- service role keys
- tokens
- password-like values
- private keys
- raw environment dumps
- real personal training data

Tests use synthetic values only.

## Boundaries

19E does not add:

- auth UI
- route changes
- API runtime behavior
- Supabase connection behavior
- provider network calls
- token/session storage
- AppData schema fields
- TrainingSession schema fields
- storage/persistence changes
- cloud read mirror
- cloud write shadow mode
- background sync
- package or lockfile changes
- environment files

## Acceptance Gates

19E passes only if:

- the skeleton is disabled by default
- safe production-class candidate inputs produce a passive ready candidate
- unsafe inputs fail closed
- no secrets are echoed
- auth actions are unsupported and non-mutating
- App runtime remains unwired
- API runtime remains unchanged
- localStorage remains default, fallback, migration source, and emergency rollback source
- package and lockfile drift remain absent

## Phase 19 Sequence

Completed:

- 19A - Cloud Auth & Sync Entry Gate V1
- 19B - Account Boundary & Local Inventory V1
- 19C - Supabase Data Model & RLS Contract V1
- 19D - Supabase Migration Files + Local Type Contracts V1
- 19E - Auth Client Skeleton + Env Guard V1

Next:

- 19F - Auth UI Skeleton V1

Later gates still own read mirror, write shadow, migration dry run, explicit opt-in sync, conflict/offline/rollback acceptance, and production manual acceptance.

## Decision

19E is accepted as an environment-guarded auth client skeleton only.

Recommended next task: 19F Auth UI Skeleton V1.
