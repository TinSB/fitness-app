# Production Dual-Read Comparison

## Task Identity

Task 8.8 Production Dual-Read Comparison V1 adds diagnostic-only dual-read comparison logic.

This task does not integrate into App runtime and does not switch source-of-truth.

## Diagnostic Boundary

Dual-read comparison compares a local read result with a production API read result.

The comparison is:

- disabled by default
- explicit opt-in only
- diagnostic only
- non-blocking for the App
- unable to repair, overwrite, sync, or mutate local data
- unable to write to a backend
- unable to call mutation routes

## Result Statuses

Stable statuses:

- `disabled`
- `unavailable`
- `match`
- `mismatch`
- `failed`

Every result reports:

- `diagnosticOnly: true`
- `appCanContinue: true`
- `mutatedLocal: false`

## Preserved Boundaries

`localStorage` remains source-of-truth, default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Production source-of-truth switch remains blocked.

Accepted browser mutation routes remain exactly seven. No mutation route is called or added.

## Blocked Scope

- no localStorage overwrite
- no AppData overwrite
- no backend writes
- no mutation route calls
- no repair/import/export/reset
- no source-of-truth switch
- no auth runtime
- no cloud sync
- no package changes
- no real personal training data

## Decision

Task 8.8 result: diagnostic-only dual-read comparison logic.

Recommended next task: Task 8.9 Production Mutation Contract Guard V1.

Task 8.9 may begin only after Task 8.8 is fully merged.
