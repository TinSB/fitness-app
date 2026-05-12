# Production Monitoring Logging Privacy Lock

## Scope / Non-goals

Task 6.36 locks privacy-safe monitoring and logging behavior for Phase 6.

This is docs/static tests only. This is not external monitoring service implementation. This is not production telemetry runtime implementation. This is not analytics runtime implementation. This is not auth runtime implementation. This is not sync runtime implementation. This is not deployment runtime implementation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, browser routes, server routes, monitoring provider, analytics provider, secret values, production data migration, normalized tables, or real personal training data.

## Phase 6 Baseline

Tasks 6.0 through 6.35 are complete. Task 6.24 added a privacy-safe redaction utility. Task 6.32 finalized security/privacy hardening. Task 6.35 audited deployment/environment boundaries.

Production monitoring runtime remains unimplemented unless a future approved task explicitly adds it.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Sensitive Data Redaction

Diagnostics must redact sensitive data before output. Sensitive data includes AppData, localStorage contents, token values, secret values, credentials, cookies, session identifiers, email addresses, and long personal text payloads.

The redaction utility is a narrow local safeguard. It is not production telemetry and does not approve external log shipping.

## No Raw AppData Logging

Raw AppData logging is blocked. Future monitoring must log only minimal metadata, redacted summaries, and failure categories that do not expose personal training data.

## No localStorage Dump

localStorage dump logging is blocked. Future diagnostics must not copy or upload full browser storage.

## No Token Or Secret Logging

Token logging is blocked. Secret logging is blocked. Authorization headers, cookies, sessions, credentials, and provider secrets must be redacted before diagnostic output.

## Privacy-safe Diagnostics

Privacy-safe diagnostics may include synthetic fixture names, environment labels, validation result categories, route allowlist status, redaction counts, and failure codes.

Privacy-safe diagnostics must not include real personal training data, raw AppData, localStorage dumps, tokens, secrets, account identifiers, or cloud provider credentials.

## Future Observability Gates

Any future observability runtime requires a separate gate covering data classification, log schema, retention, redaction, access control, deletion/export policy, privacy incident response, secrets handling, and manual acceptance.

Task 6.36 adds no monitoring runtime and no external provider.

## Route and Source-of-truth Boundary

No new browser mutation route is added. DataHealth repair remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked. Auth/sync/cloud routes remain blocked unless a future approved task explicitly adds them.

Production source-of-truth switching is not approved. API/SQLite production primary is not approved.

## Decision

Task 6.36 result: production monitoring/logging privacy lock documentation and static tests only.

Decision: lock privacy-safe diagnostics and redaction expectations while keeping production monitoring runtime, external telemetry, route additions, and source-of-truth switching blocked.

Recommended next task: `Task 6.37 Production Release Candidate Regression Lock V1`.

Task 6.37 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, source-of-truth switching, or real-data migration.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.36-production-monitoring-logging-privacy-lock` / pending until merge
- Decision: lock monitoring/logging privacy expectations without external monitoring runtime.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: production monitoring service, external telemetry, raw AppData logs, localStorage dumps, token/secret logs, route additions, source-of-truth switch.
- Required future gates: release candidate regression lock, Phase 6 final manual acceptance, Phase 6 exit lock.
- Next task: `Task 6.37 Production Release Candidate Regression Lock V1`
- Rollback requirement: revert the Task 6.36 commit; no runtime state is involved.

## Final Recommendation

Task 6.36 is complete after this task.

Do not add production monitoring runtime yet. Next task should be Task 6.37 Production Release Candidate Regression Lock V1.
