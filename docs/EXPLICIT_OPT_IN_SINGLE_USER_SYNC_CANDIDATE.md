# Phase 19J - Explicit Opt-In Single-User Sync Candidate V1

Phase 19J adds an explicit opt-in single-user sync candidate only.

It creates an in-memory readiness report for manual personal sync after the local-to-cloud migration dry run. It does not upload, download, persist, merge, replace local data, or switch source of truth.

## Scope

The candidate requires:

- explicit opt-in
- manual confirmation
- account readiness
- valid backup/export preflight
- Phase 19I dry-run readiness
- owner verification
- schema verification
- cloud availability
- accepted write-shadow evidence
- conflict review when read mirror or conflict preflight requires it
- rollback availability
- offline training availability

The result can report `readyForManualSyncCandidate: true` only when these gates are satisfied.

## Result Fields

The Phase 19J result records:

- `readyForManualSyncCandidate`
- `requiresManualConflictReview`
- `blockers`
- `warnings`
- `candidate`
- `uploadPerformed: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `localDataChanged: false`
- `cloudDataChanged: false`
- `sourceOfTruthChanged: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `localStorageFallbackPreserved: true`

The candidate is a review object only. It does not perform sync by itself and does not make cloud data authoritative.

## Preserved Boundaries

No upload is performed.

No download is performed.

No local data is changed.

No cloud data is changed.

No source-of-truth switch is made.

No background sync is started.

No default sync is started.

No AppData schema is changed.

No TrainingSession schema is changed.

No routes are added.

No package or lockfile changes are required.

localStorage remains default, fallback, migration source, and emergency rollback source.

Offline training remains available.

## Deferred Behavior

Phase 19J does not perform durable sync and does not resolve conflicts. It only proves whether the explicit manual candidate is ready for the next acceptance phase.

Conflict/offline/rollback acceptance remains separate. Cloud-primary consideration remains blocked until later manual acceptance passes.

Recommended next task: 19K - Conflict / Offline / Rollback Acceptance V1.
