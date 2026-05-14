# Task 12.14 Cloud Operation Journal & Idempotency Candidate V1

This task adds a cloud operation journal and idempotency candidate boundary. This is not a background sync queue.

## Journal Fields

- `operationId`
- `operationType`
- `ownerScope`
- `requestFingerprint`
- `sourceSnapshotHash`
- `targetSnapshotHash`
- `status`
- `createdAt`
- `completedAt`
- `errorCode`

## Idempotency Behavior

The journal can build and validate a cloud idempotency key. It can detect duplicate manual push or pull apply candidates before a future operation is considered.

## Preserved Boundaries

- No background worker.
- No polling.
- No timer.
- No automatic queue processing.
- No auto-apply operations.
- No routes are added.
- No real personal training data is used.

`localStorage` remains default, fallback, migration source, and emergency backup. Backend/cloud candidate behavior remains explicit opt-in and reversible.

Recommended next task: Task 12.15 Cloud Fallback / Rollback / Emergency Local Mode V1.
