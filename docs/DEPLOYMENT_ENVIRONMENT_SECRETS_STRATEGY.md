# Deployment Environment Secrets Strategy

## Scope / Non-goals

Task 6.6 is a deployment, environment, and secrets strategy at planning level.

This is docs/static tests only. This is not production deployment implementation. This is not hosted production configuration. This is not secrets runtime implementation. This is not monitoring implementation. This is not auth implementation. This is not cloud sync implementation. This is not production backend implementation. This is not migration implementation. This is not production source-of-truth migration implementation.

This does not add routes, deployment config, environment files with secret values, dependencies, package scripts, lockfile changes, browser runtime changes, storage runtime changes, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.5 are complete. Production backend, auth runtime, sync runtime, deployment runtime, monitoring runtime, normalized schema, and production source-of-truth migration remain unimplemented.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Environment Strategy

| Environment | Purpose | Data boundary | Runtime boundary | Current status |
| --- | --- | --- | --- | --- |
| local | Development and automated validation. | Synthetic data only. | `localStorage` default; dev/local API prototypes explicit only. | Existing default. |
| dev | Local API and storage experiments. | Dedicated dev DB and dedicated browser profile. | Dev/local only, not production-ready. | Existing Phase 5/6 boundary. |
| staging | Future production-like rehearsal. | Synthetic or explicitly approved test data only. | Requires separate future deployment gate. | Not implemented. |
| production | Future real user environment. | Requires privacy/security, backup/recovery, auth, rollback, and manual acceptance gates. | Requires explicit future approval. | Not implemented. |

## Secrets Storage

No secret values are added in Task 6.6. Future secrets storage must separate local, dev, staging, and production values; avoid committing secrets; define rotation ownership; and require least privilege.

Task 6.6 does not add `.env` files, provider secrets, OAuth secrets, database credentials, sync credentials, deployment tokens, or secret validation runtime.

## Environment Variables

Future environment variable design must define allowed names, environment scope, default behavior, failure behavior, redaction, and validation before production deployment.

Task 6.6 does not add package scripts, runtime environment parsing, production source selection, or deployment activation flags.

## Branch Rules and Required Checks

GitHub Actions `IronPath Validation` remains the required PR check. Codex must use `gh pr checks <PR_NUMBER> --required --watch`.

Never use `--admin`. Never bypass branch protection. IronPath Validation failure blocks merge.

Optional Vercel preview/deployment checks must not block merge if GitHub allows normal squash merge and required checks pass.

## Vercel Optional Boundary

Vercel previews may remain optional for Codex PRs. Task 6.6 does not assume "Require deployments to succeed" and does not make Vercel a required check.

Task 6.6 adds no Vercel production deployment, no deployment config, no production hosting change, and no environment provisioning.

## Rollback Strategy

Future deployment work must define rollback trigger, rollback owner, data rollback relationship, secret rollback, environment rollback, and user-visible incident communication before production release.

Task 6.6 adds no deployment runtime, so rollback for this task is reverting the docs/static-test commit.

## Real Data Safety

Automated tasks must not use real personal training data. Manual checks must use a dedicated browser profile, dedicated dev DB, and synthetic data unless a future task explicitly approves a controlled real-data process.

No destructive migration, production data overwrite, localStorage deletion, or cloud upload is approved by Task 6.6.

## Decision

Task 6.6 result: deployment, environment, and secrets strategy only.

Task 6.6 approves no production deployment.

Decision: do not implement production deployment, hosted environment configuration, secret runtime, or environment activation yet. Continue with production migration, backup, and rollback strategy before any production deployment work.

Recommended next task: `Task 6.7 Production Migration, Backup & Rollback Strategy V1`.

Task 6.7 must be docs/static tests only. Task 6.7 must not implement destructive migration, real-data automation, production source-of-truth switching, routes, deployment, auth, cloud sync, production backend runtime, or package changes.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.6-deployment-environment-secrets-strategy` / pending until merge
- Decision: keep deployment/environment/secrets work at strategy level and reject immediate production deployment.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Rejected immediate implementations: production deployment, staging deployment, hosted config, secret values, package scripts, deployment-required check, auth runtime, sync runtime, production backend runtime.
- Required future gates: environment config boundary, deployment runtime strategy, secrets validation skeleton, rollback/incident runbook, privacy/security review, and manual acceptance.
- Next task: `Task 6.7 Production Migration, Backup & Rollback Strategy V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.6 commit.

## Final Recommendation

Task 6.6 is complete after this task.

Do not start production deployment implementation yet. Next task should be Task 6.7 Production Migration, Backup & Rollback Strategy V1.

## Task 6.7 Follow-up

Task 6.7 Production Migration, Backup & Rollback Strategy V1 records backup-first, dry-run, apply, rollback, recovery drill, export/delete implications, no destructive migration, and no real-data automation as docs/static tests only.

It must keep migration runtime, destructive migration, real-data automation, backup/restore runtime, export/delete runtime, production source-of-truth migration, production backend runtime, auth runtime, cloud sync runtime, deployment runtime, package changes, browser routes, and real personal training data migration unimplemented.
