# Phase 19F - Auth UI Skeleton V1

Phase 19F adds a passive account surface in Settings for the future single-user multi-device sync path.

It is display-only. No login flow is started. No token is stored. No sync is started. No cloud data is read or written.

## Scope

19F mounts a small Settings card that explains:

- account status is a candidate surface
- login is optional for now
- sync remains off by default
- data remains local
- later steps require separate confirmation

The card has no buttons, forms, links, callbacks, or provider actions.

## Runtime Boundaries

19F does not import the auth client skeleton into Profile runtime. It does not create a Supabase client, start an auth provider, read environment variables, call network APIs, write localStorage, or modify AppData.

localStorage remains default, fallback, migration source, and emergency rollback source.

## Privacy And Ownership

The UI must not show tokens, provider secrets, account ids, source fingerprints, cloud row ids, raw AppData, or real personal training data.

It may show only passive status copy.

## Blocked Behavior

19F does not add:

- provider login flow
- signup flow
- logout flow
- token/session storage
- cloud read mirror
- cloud write shadow mode
- migration upload or download
- conflict resolution UI
- AppData schema fields
- TrainingSession schema fields
- route changes
- API runtime behavior
- environment files
- package or lockfile changes

## Acceptance Gates

19F passes only if:

- the card appears in Settings
- the card is passive and compact
- no controls are rendered
- no auth client runtime is imported
- no storage, route, API, or schema boundary changes are made
- package and lockfile drift remain absent

## Phase 19 Sequence

Completed:

- 19A - Cloud Auth & Sync Entry Gate V1
- 19B - Account Boundary & Local Inventory V1
- 19C - Supabase Data Model & RLS Contract V1
- 19D - Supabase Migration Files + Local Type Contracts V1
- 19E - Auth Client Skeleton + Env Guard V1
- 19F - Auth UI Skeleton V1

Next:

- 19G - Cloud Read Mirror V1

Later gates still own write shadow, migration dry run, explicit opt-in sync, conflict/offline/rollback acceptance, and production manual acceptance.

## Decision

19F is accepted as passive Settings UI only.

Recommended next task: 19G Cloud Read Mirror V1.
