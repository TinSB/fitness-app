# Phase 19G - Cloud Read Mirror V1

Phase 19G adds a read mirror only for the future single-user multi-device sync path.

It compares cloud candidate metadata with local snapshot metadata. No cloud write is attempted. No local data is changed. No source-of-truth switch is made.

## Scope

19G builds a passive mirror result from the existing cloud repository candidate and cloud pull candidate contracts.

It can report:

- cloud candidate missing
- owner mismatch
- schema mismatch
- invalid cloud metadata
- cloud newer than local
- local newer than cloud
- matching snapshot metadata
- review required

The result is a comparison report only.

## Product Target

The target remains personal-only single-user multi-device sync.

19G does not add SaaS, coach/student, team, social, marketplace, billing, or shared workspace behavior.

## Source Of Truth

localStorage remains default, fallback, migration source, and emergency rollback source.

19G does not replace localStorage, write localStorage, overwrite AppData, download cloud AppData into the app, upload local AppData, or apply a cloud snapshot.

## Safety Rules

The read mirror fails closed when:

- account readiness is missing
- repository candidate is unavailable
- owner identity differs
- cloud metadata is incomplete
- schema validation fails
- local and cloud schema versions differ

Different metadata is marked for review. It is not applied.

## Runtime Boundaries

19G does not add:

- App runtime wiring
- Settings UI controls
- route changes
- API runtime behavior
- Supabase SDK creation
- environment file reads
- timers or background workers
- cloud write behavior
- sync queue behavior
- AppData schema fields
- TrainingSession schema fields
- package or lockfile changes

## Acceptance Gates

19G passes only if:

- disabled state is safe by default
- repository absence fails closed
- cloud metadata is mirrored without mutation
- owner mismatch is blocked
- schema mismatch is blocked
- equal snapshot metadata can be reported as mirrored
- differing snapshot metadata requires review
- no localStorage write is possible
- no cloud write is attempted
- no source-of-truth switch is possible

## Phase 19 Sequence

Completed:

- 19A - Cloud Auth & Sync Entry Gate V1
- 19B - Account Boundary & Local Inventory V1
- 19C - Supabase Data Model & RLS Contract V1
- 19D - Supabase Migration Files + Local Type Contracts V1
- 19E - Auth Client Skeleton + Env Guard V1
- 19F - Auth UI Skeleton V1
- 19G - Cloud Read Mirror V1

Next:

- 19H - Cloud Write Shadow Mode V1

Later gates still own migration dry run, explicit opt-in sync, conflict/offline/rollback acceptance, and production manual acceptance.

## Decision

19G is accepted as a passive cloud read mirror only.

Recommended next task: 19H Cloud Write Shadow Mode V1.
