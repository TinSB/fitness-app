# Phase 19H - Cloud Write Shadow Mode V1

Phase 19H adds shadow mode only for future single-user multi-device sync writes.

It creates candidate shadow writes only after backup, dry run, owner, schema, and conflict gates pass. No source-of-truth switch is made. No local data is changed.

## Scope

19H wraps the existing cloud push candidate and operation journal contracts.

It can report:

- shadow mode disabled
- manual confirmation missing
- migration dry run missing
- backup missing
- owner mismatch
- schema invalid
- conflict present
- duplicate shadow candidate
- shadow adapter unavailable
- shadow write rejected
- accepted shadow

The journal entry is in-memory only. Nothing is persisted by this phase.

## Source Of Truth

localStorage remains default, fallback, migration source, and emergency rollback source.

19H does not replace localStorage, write localStorage, overwrite AppData, apply cloud data, or promote cloud data to primary source.

## Shadow Write Rules

A shadow write may be attempted only when:

- explicit shadow opt-in is present
- manual confirmation is present
- local-to-cloud dry run has passed
- backup is available
- owner identity matches
- schema validation passes
- no unresolved cloud conflict is present
- no duplicate operation is found
- a shadow adapter candidate is provided

If any gate fails, no shadow write is attempted.

## Runtime Boundaries

19H does not add:

- App runtime wiring
- Settings UI controls
- route changes
- API runtime behavior
- Supabase SDK creation
- environment file reads
- timers or background workers
- default sync behavior
- source-of-truth switching
- AppData schema fields
- TrainingSession schema fields
- package or lockfile changes

## Acceptance Gates

19H passes only if:

- disabled state is safe by default
- manual confirmation is required
- dry run is required
- backup is required
- owner mismatch is blocked
- schema invalid state is blocked
- cloud conflict is blocked
- duplicate shadow candidates are blocked before adapter execution
- shadow adapter rejection does not fake success
- accepted shadow still leaves localStorage unchanged
- accepted shadow still leaves source of truth unchanged

## Phase 19 Sequence

Completed:

- 19A - Cloud Auth & Sync Entry Gate V1
- 19B - Account Boundary & Local Inventory V1
- 19C - Supabase Data Model & RLS Contract V1
- 19D - Supabase Migration Files + Local Type Contracts V1
- 19E - Auth Client Skeleton + Env Guard V1
- 19F - Auth UI Skeleton V1
- 19G - Cloud Read Mirror V1
- 19H - Cloud Write Shadow Mode V1

Next:

- 19I - Local-to-Cloud Migration Dry Run V1

Later gates still own explicit opt-in sync, conflict/offline/rollback acceptance, and production manual acceptance.

## Decision

19H is accepted as cloud write shadow mode only.

Recommended next task: 19I Local-to-Cloud Migration Dry Run V1.
