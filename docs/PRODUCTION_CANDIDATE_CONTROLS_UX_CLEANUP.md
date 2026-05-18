# UX Cleanup for Production Candidate Controls

## Task Identity

- Task 15C.
- UX Cleanup for Production Candidate Controls.
- Phase 15.
- Personal production candidate stabilization.

## Baseline Evidence

- Task 15B complete.
- Task 15B PR #253.
- Task 15B merge commit: `bdbed6b1d8f80a15e4b8e9ed4e0c3aa9b109c9cb`.
- `npm test` passed: 1051 files / 4214 tests.
- dist token scan clean.
- Task 15C has not started before this task.

## Non-Goals

Task 15C does not:

- change source-of-truth behavior.
- enable default cloud sync.
- enable background sync.
- connect to Supabase.
- perform cloud pull.
- perform cloud push.
- upload data.
- deploy production runtime.
- add external monitoring upload.
- add SaaS/multi-user runtime.
- add normalized training tables.
- perform destructive migration.
- use real personal training data in tests.
- add package/dependency/script/lockfile changes.

## Safety Baseline

- localStorage default/fallback/migration/emergency remains.
- backend/cloud candidate explicit opt-in and reversible remains.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch available.
- emergency local mode available.
- api-primary-dev dev/local only and not production-ready.
- accepted browser mutation routes exactly seven.

## UX Problems Addressed

- source-of-truth unclear.
- cloud pull/push controls confusing.
- emergency local mode hard to find.
- rollback / kill switch wording unclear.
- diagnostics too technical.
- owner mismatch not human-readable.
- schema validation failure not human-readable.

## User-Facing Copy Policy

- Chinese-first copy.
- Simple wording.
- No SaaS/cloud-sync overclaim.
- No "automatic sync" language.
- No "success" unless confirmed.
- Dangerous operations must say manual confirmation required.
- Cloud pull/push controls must not look like normal sync buttons.
- Owner mismatch and schema validation failure must say not to upload or apply cloud data.

## Control Safety Rules

- Cloud pull dry run before any apply.
- Cloud pull does not auto-apply.
- Cloud push dry run required.
- Cloud push owner check required.
- Cloud push backup check required.
- Cloud push manual confirmation required.
- Rollback / kill switch visible.
- Emergency local mode visible.

## Suggested Placement

- Recommended placement: Settings / Diagnostics / Cloud Production panel.
- Not primary training flow.
- Not blocking local workout logging.
- Standalone presentational panel first; runtime integration remains deferred until explicitly authorized.

## Task 15D Recommendation

Recommended next task: Task 15D — Phase 15 Stabilization Archive.

Task 15D should archive:

- Task 15A runbook.
- Task 15B recovery hardening.
- Task 15C UX cleanup.
- Remaining personal production candidate risks.

## Final Statement

- Task 15C does not start Task 15D.
- Task 15C supports personal production candidate stabilization only.
- Task 15C does not authorize public SaaS launch.
