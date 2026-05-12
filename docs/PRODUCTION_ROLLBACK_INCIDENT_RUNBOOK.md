# Production Rollback Incident Runbook

## Scope / Non-goals

Task 6.27 creates a production rollback and incident runbook.

This is docs/static tests only. This is not runtime incident handling implementation. This is not production deployment implementation. This is not auth runtime implementation. This is not sync runtime implementation. This is not source-of-truth migration implementation.

Task 6.27 has no runtime implementation.

This task adds no dependencies, package scripts, lockfile changes, routes, auth provider, deployment provider, sync provider, secret values, production data migration, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.26 are complete. Production manual acceptance exists as a runbook, but production backend activation, auth runtime, cloud sync runtime, deployment runtime, production source-of-truth migration, and normalized schema remain unimplemented except for narrow inert/pure skeletons already documented.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. localStorage remains default runtime source. `api-primary-dev` remains explicit dev/local only and not production-ready. api-primary-dev remains explicit dev/local only.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Incident Detection

Future incident handling must classify data loss, auth leakage, sync conflict corruption, deployment misconfiguration, secret exposure, privacy exposure, monitoring leakage, source-of-truth divergence, rollback failure, and branch protection bypass.

Task 6.27 adds no incident detector, alerting service, monitoring runtime, webhook, background worker, or production deployment.

## Data Safety

No destructive operation is performed by this task. Any future production rollback must preserve backup-first policy, verify backup readability, preserve localStorage emergency fallback, and avoid silent overwrite.

No real personal training data may be used in automated tasks.

## Restore Verification

Future restore verification must check backup identity, schema/version compatibility, source snapshot identity, expected record counts or snapshot keys, localStorage fallback, user-visible failure state, and post-restore smoke checks.

No restore runtime is implemented in Task 6.27.

## Privacy Incident Handling

Privacy incidents must classify exposed data type, affected environment, retention/logging impact, required deletion/export response, owner, communication path, and post-incident hardening.

Logs must not include raw AppData, localStorage dumps, token values, secret values, or real personal training data.

## Rollback Procedure Template

- Incident summary:
- Environment:
- Trigger:
- Owner:
- Current source-of-truth:
- Backup identity:
- Rollback target:
- Verification checklist:
- Privacy/security impact:
- User data impact:
- Final result: Pass / Fail
- Follow-up gates:

## Decision

Task 6.27 result: production rollback and incident runbook only.

Decision: document rollback, incident detection, data safety, restore verification, and privacy incident handling without runtime implementation.

Recommended next task: `Task 6.28 Production Data Export / Delete Plan V1`.

Task 6.28 must be docs/static tests only. It must not add export/delete runtime, account deletion runtime, backup retention runtime, audit retention runtime, package changes, routes, or source-of-truth switching.

## Final Recommendation

Task 6.27 is complete after this task.

Do not add runtime incident handling yet. Next task should be Task 6.28 Production Data Export / Delete Plan V1.
