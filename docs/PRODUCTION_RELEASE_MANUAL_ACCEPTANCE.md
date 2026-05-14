# Production Release Manual Acceptance V1

Task 13.14 is a manual acceptance runbook for production-candidate hardening. It does not launch production, enable default cloud sync, add deployment runtime, or upload monitoring data.

## Scope / Non-Goals

- [ ] Confirm this runbook is for production-candidate hardening only.
- [ ] Confirm no production auto-launch is performed.
- [ ] Confirm no default cloud sync is enabled.
- [ ] Confirm no background sync is enabled.
- [ ] Confirm no automatic worker is enabled.
- [ ] Confirm no external monitoring upload is enabled.
- [ ] Confirm no package/script/lockfile drift occurred.

## LocalStorage Baseline

- [ ] Confirm `localStorage` remains default, fallback, migration source, and emergency backup.
- [ ] Confirm emergency local mode remains documented and available.
- [ ] Confirm fallback/rollback/emergency restore remain available.

## Environment Matrix

- [ ] Confirm local, dev, preview, production-candidate, production, and emergency-local are documented.
- [ ] Confirm release channel policy keeps production source-of-truth switch blocked.
- [ ] Confirm preview allows read-only/candidate checks only.

## Supabase Readiness

- [ ] Confirm Supabase env/project guard rejects unsafe config.
- [ ] Confirm Supabase production project readiness plan exists.
- [ ] Confirm service role is not in browser-safe config.
- [ ] Confirm no real Supabase project data is used in tests.

## Deployment Boundaries

- [ ] Confirm backend hosting decision exists.
- [ ] Confirm deployment config guard rejects localhost, preview-as-production, dev API, and service role exposure.
- [ ] Confirm backend deployment package boundary does not auto-start, auto-listen, or bind a port.
- [ ] Confirm frontend env separation blocks production dev API and cloud candidate auto-enable.
- [ ] Confirm release capability matrix blocks unsafe defaults.

## Cloud Candidate Boundaries

- [ ] Confirm cloud pull candidate does not auto-apply.
- [ ] Confirm cloud push candidate requires dry run, owner check, backup check, schema validation, and manual confirmation.
- [ ] Confirm manual conflict resolution remains manual.
- [ ] Confirm operation journal remains a manual candidate boundary.

## Rollback / Emergency Local Mode

- [ ] Confirm rollback / kill switch disables cloud pull, cloud push, Supabase adapter, and backend-primary candidate.
- [ ] Confirm rollback does not delete local data.
- [ ] Confirm rollback does not overwrite cloud data.
- [ ] Confirm emergency local mode remains available.

## Diagnostics And Monitoring

- [ ] Confirm diagnostic snapshot excludes full AppData.
- [ ] Confirm diagnostic snapshot excludes full localStorage.
- [ ] Confirm diagnostic snapshot excludes secrets, tokens, service role, personal notes, raw request payloads, and full training logs.
- [ ] Confirm monitoring redaction is documented.
- [ ] Confirm monitoring adapter has no external transport.

## Privacy / Export / Delete Readiness

- [ ] Confirm privacy/export/delete readiness exists.
- [ ] Confirm destructive data lifecycle remains blocked until later explicit phase.
- [ ] Confirm no export HTTP route was added.
- [ ] Confirm no delete API was added.

## Dist And Route Lock

- [ ] Confirm `npm run api:dev:build` passes.
- [ ] Confirm `npm run typecheck` passes.
- [ ] Confirm `npm test` passes.
- [ ] Confirm `npm run build` passes.
- [ ] Confirm dist token scan passes.
- [ ] Confirm accepted browser mutation routes remain exactly seven.
- [ ] Confirm `POST /data-health/repair/apply` remains blocked.
- [ ] Confirm backup/import/export over HTTP remains blocked.
- [ ] Confirm reset/recovery over HTTP remains blocked.

## Pass / Fail Template

- [ ] PASS: all checks above pass with synthetic/non-personal data only.
- [ ] FAIL: any check above requires production launch, new dependency, external upload, destructive data lifecycle, route expansion, or default/background sync.

Recommended next task: Task 13.15 Production Release Regression Lock V1.
