# Production Source-of-Truth Migration Preconditions

## Task Identity

Task 7.4 defines preconditions before IronPath may move from localStorage source-of-truth to any production API/backend source-of-truth.

This task is docs/static tests only. It does not implement migration, modify persistence behavior, modify App runtime, replace localStorage, add backend, add auth, add sync, or use real personal training data.

## Current Truth

localStorage remains the current source of truth. It remains the default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and is not production-ready.

## Why The Switch Remains Blocked

A production source-of-truth switch can lose or misattribute personal training data if backend identity, ownership, backup, rollback, offline behavior, and failure modes are not proven first.

Task 7.4 does not authorize source-of-truth switch.

## Required Preconditions

Before any future production source-of-truth switch, all of these must exist:

- production backend exists
- auth/user identity exists
- user data ownership model exists
- backup/export safety exists
- rollback plan exists
- offline/failure behavior exists
- migration dry run exists
- localStorage emergency backup remains available
- no destructive real-data migration
- user-visible confirmation model exists
- monitoring/diagnostics exists before production switch
- manual acceptance checklist exists
- privacy/data safety reviewed
- production route surface frozen

## Migration Dry-run Requirements

A future dry run must validate source snapshot identity, schema compatibility, ownership, backup availability, rollback viability, and visible failure states without writing production data.

## Rollback Requirements

Rollback must define owner, trigger, backup identity, restore verification, localStorage emergency fallback, user-visible recovery state, and post-rollback validation.

## User-visible Confirmation

Future migration or switch must require explicit confirmation, explain what source changes, state what is preserved, and show visible failure on API/backend/write errors.

## Auth and Backup Dependencies

Production source-of-truth cannot be authorized without auth/user identity and user data ownership. It also cannot be authorized without backup/export safety and rollback readiness.

## Failure-mode Requirements

Failure modes must cover API unavailable, auth mismatch, ownership mismatch, stale snapshot, partial write, rollback failure, localStorage/API divergence, and no fake success.

## Decision

Task 7.4 result: production source-of-truth migration preconditions only.

Task 7.4 does not authorize source-of-truth switch.

Recommended next task: `Task 7.5 Production Auth & User Data Boundary Plan V1`.

Task 7.5 is not started by Task 7.4.
