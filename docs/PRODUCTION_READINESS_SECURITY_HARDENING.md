# Production Readiness Security Hardening

## Scope / Non-goals

Task 6.25 is production readiness security hardening documentation and static tests.

This is docs/static tests and tiny redaction/environment validation fixes only. This is not auth runtime implementation. This is not deployment runtime implementation. This is not sync runtime implementation. This is not production backend activation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, routes, auth provider, deployment provider, sync provider, secret values, production data migration, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.24 are complete. Task 6.23 adds a safe environment validation skeleton. Task 6.24 adds a privacy-safe redaction utility.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Secret Leakage Controls

No secret values may be committed, logged, embedded in browser code, or included in test fixtures.

Environment validation accepts placeholder reference names only and rejects secret values supplied to browser validation.

## Sensitive Data Logging Controls

Raw AppData logging is blocked. localStorage dump logging is blocked. Token/secret logging is blocked. Personal training payloads must be redacted before diagnostics or observability output.

The Task 6.24 redaction utility redacts sensitive keys, long strings, and bearer-like credentials from synthetic payloads.

## Route Boundary

No new browser mutation route is added. DataHealth repair remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked. Auth/sync/cloud routes remain blocked unless a future approved task explicitly adds them.

## Privacy Controls

Automated tests must use synthetic data only. Manual production-readiness checks must use a dedicated test environment and no real personal training data unless a future explicit approval defines controlled handling.

Future monitoring must redact sensitive data, avoid raw AppData, avoid localStorage dumps, avoid token/secret logging, and document retention.

## No Auth Or Deployment Runtime

Task 6.25 adds no auth runtime, no login/signup, no token/session handling, no OAuth, no user table, no deployment runtime, no hosted production runtime, no production monitoring service, and no sync runtime.

## Decision

Task 6.25 result: production readiness security hardening documentation and static tests only.

Decision: accept current env validation and redaction skeletons as narrow safety utilities while keeping auth runtime, deployment runtime, sync runtime, routes, and source-of-truth switching blocked.

Recommended next task: `Task 6.26 Production Manual Acceptance Runbook V1`.

Task 6.26 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.25-production-readiness-security-hardening` / pending until merge
- Decision: harden production-readiness security boundaries without adding runtime capability.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: auth runtime, deployment runtime, sync runtime, production monitoring service, secret values, route additions, source-of-truth switch.
- Required future gates: production manual acceptance, rollback/incident runbook, export/delete plan, release readiness checkpoint, and final security/privacy hardening.
- Next task: `Task 6.26 Production Manual Acceptance Runbook V1`
- Rollback requirement: revert the Task 6.25 commit; no runtime state is involved.

## Final Recommendation

Task 6.25 is complete after this task.

Do not start production runtime work yet. Next task should be Task 6.26 Production Manual Acceptance Runbook V1.
