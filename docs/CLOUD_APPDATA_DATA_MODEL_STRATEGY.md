# Task 12.4 Cloud AppData Data Model Strategy V1

Phase 12 uses a document-first AppData cloud snapshot model. This document is a strategy only; it does not add tables, SQL, migrations, repository code, or cloud runtime.

## Required Strategy

- Use document-first AppData cloud snapshot model first.
- Conceptual table name: `cloud_appdata_snapshots`.
- Store a validated AppData document/snapshot.
- Preserve backup and rollback semantics.
- Keep normalized training tables blocked.

## Snapshot Metadata

Each future cloud AppData snapshot candidate should include:

- `snapshotId`
- `accountId`
- `ownerUserId`
- `sourceSnapshotHash`
- `schemaVersion`
- `createdAt`
- `operationId`
- `validationStatus`

The snapshot document remains AppData-shaped and must be validated before write and after read.

## Blocked Modeling Paths

- Normalized exercise tables are blocked.
- Normalized session tables are blocked.
- Normalized history tables are blocked.
- Normalized set tables are blocked.
- Destructive migration is blocked.
- Partial cloud table migration is blocked.
- Default cloud sync is blocked.
- Direct browser AppData cloud writes remain blocked by default.

## Rationale

IronPath AppData is currently the local runtime contract. A document-first cloud snapshot lets Phase 12 add owner checks, dry-run migration reports, conflict detection, manual conflict resolution, rollback, and emergency local mode before any source-of-truth decision.

Normalizing training tables now would create high migration risk, premature schema coupling, and more ways to corrupt local history. Phase 12 should first prove a safe snapshot boundary.

## Boundary Confirmation

No actual database table is created. No SQL migration is added or applied. No normalized schema is added. No cloud repository is implemented in this task. No package dependency, script, or lockfile change is made.

Recommended next task: Task 12.5 Cloud RLS / Ownership Policy Plan V1.
