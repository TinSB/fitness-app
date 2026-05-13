# Production Persistence Strategy Adapter

## Task Identity

Task 8.5 Production Persistence Strategy Adapter V1 defines a production persistence adapter boundary.

This task does not choose or implement a real production database. It does not add normalized tables, migrations, destructive migration, source-of-truth switching, or real user data writes.

## Adapter Boundary

The adapter boundary lives at `apps/api/src/node/productionPersistence.ts`.

It defines read-oriented persistence interfaces for:

- app data summary
- sessions summary
- history list
- history item detail
- data health summary

It also defines an unsupported write-shadow placeholder for future boundary work.

## Test Adapter

Task 8.5 includes only an in-memory synthetic fixture adapter for tests.

The adapter reports:

- `sourceOfTruth: false`
- `storage: in-memory-synthetic-fixture`
- no real database
- no node:sqlite import
- no sqliteRepository promotion
- no normalized table schema
- no migration files
- no real personal training data

## Preserved Boundaries

`localStorage` remains default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Production persistence is not App source-of-truth.

Accepted browser mutation routes remain exactly seven. No eighth browser mutation route is authorized.

## Blocked Scope

- real production database
- ORM
- normalized schema
- migrations
- node:sqlite import
- sqliteRepository as production persistence
- real personal training data
- backend source-of-truth writes
- package dependencies

## Decision

Task 8.5 result: production persistence adapter boundary plus synthetic in-memory test adapter only.

Recommended next task: Task 8.6 Production Read Contract Implementation V1.

Task 8.6 may begin only after Task 8.5 is fully merged.
