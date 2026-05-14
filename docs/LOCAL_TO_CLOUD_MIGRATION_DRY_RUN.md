# Task 12.9 Local-to-Cloud Migration Dry Run V1

This task adds local-to-cloud migration dry-run logic. It reports whether a future cloud AppData snapshot candidate could be prepared, but it never uploads or mutates data.

## Dry-Run Checks

- Local owner scope is present.
- Auth account candidate is present.
- Backend-primary candidate readiness is present.
- Cloud repository candidate availability is present.
- AppData schema validation passes.
- Migration compatibility is confirmed.
- Local backup availability is confirmed.
- Owner mismatch is rejected.
- Existing cloud data conflict is rejected.
- Manual confirmation is required before the result is safe to upload.

## Result Fields

- `safeToUpload`
- `warnings`
- `blockingErrors`
- `ownerBefore`
- `ownerAfterCandidate`
- `schemaStatus`
- `backupStatus`
- `estimatedCloudWrite`
- `localDataChanged: false`
- `cloudDataChanged: false`
- `sourceOfTruthChanged: false`

## Preserved Boundaries

The dry run does not upload, write cloud data, overwrite cloud data, switch source-of-truth, delete localStorage, or use real personal training data. `localStorage` remains default, fallback, migration source, and emergency backup. Backend/cloud candidate behavior remains explicit opt-in and reversible.

Recommended next task: Task 12.10 Cloud Read / Pull Candidate V1.
