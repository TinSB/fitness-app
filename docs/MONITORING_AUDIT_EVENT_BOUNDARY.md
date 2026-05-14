# Monitoring & Audit Event Boundary

## Task Identity

Task 10.11 Monitoring & Audit Event Boundary V1 adds a monitoring/audit event boundary.

This task does not add telemetry provider integration, analytics SDKs, external upload, remote logging, real user data in events, secrets in events, deployment monitoring runtime, or package changes.

## Event Categories

The audit boundary models future event categories:

- auth login/logout attempt
- migration dry run
- source-of-truth switch attempt
- backend-primary read/write candidate
- rollback
- emergency restore
- sync conflict
- sync rejected
- deployment readiness check
- secret/env guard rejection

## Collector Boundary

The collector is in-memory only.

The collector has no external transport.

The collector does not upload events.

The collector does not add analytics, telemetry, monitoring SDK, or remote logging behavior.

## Redaction Boundary

Audit metadata is redacted before storage.

Secret-like fields, authorization-like fields, raw AppData-like fields, and non-primitive values are replaced with `[redacted]`.

Audit events must not contain real personal training data, raw AppData snapshots, provider tokens, or secret values.

## Runtime Boundary

`localStorage` remains default, fallback, migration source, and emergency backup.

Backend-primary candidate remains explicit opt-in and reversible.

Auth skeleton remains disabled by default.

Cloud sync skeleton remains disabled by default.

Deployment runtime skeleton remains disabled by default.

Monitoring external upload remains unimplemented.

## Blocked Implementation

Task 10.11 does not authorize:

- telemetry provider integration
- analytics SDK
- external upload
- remote logging
- provider tokens in events
- secrets in events
- raw AppData in events
- real personal training data in tests, docs examples, fixtures, or acceptance evidence
- deployment monitoring runtime
- package dependency, package script, or lockfile changes

## Recommendation

Recommended next task: Task 10.12 Production Privacy / Data Safety Manual Acceptance V1.

Task 10.12 is not part of Task 10.11. Auto-continue mode may begin Task 10.12 only after Task 10.11 is fully merged.
