# Personal-Only Backup & Recovery Implementation Pack V1

## Task Identity

- Task 16C.
- Personal-Only Backup & Recovery Implementation Pack V1.
- personal-only polish/reliability.
- implementation pack.

## Baseline Evidence

- Task 16B complete.
- Task 16B PR #257.
- Task 16B merge commit: `367420b14382d61aae8a10a3f4be10775fb74f7f`.
- `npm test` passed: 1060 files / 4267 tests.
- dist token scan clean.
- Task 16B roadmap chose personal-only polish/reliability.
- SaaS remains deferred.

## Non-Goals

Task 16C does not:

- change source-of-truth behavior.
- enable default cloud sync.
- enable background sync.
- connect to Supabase.
- perform cloud pull.
- perform cloud push.
- upload data.
- add backup/import/export HTTP routes.
- add reset/recovery HTTP routes.
- add production deployment runtime.
- add external monitoring upload.
- add SaaS/multi-user runtime.
- add normalized training tables.
- perform destructive migration.
- use real personal training data in tests.
- add package/dependency/script/lockfile changes.

## Safety Baseline

- localStorage default/fallback/migration/emergency remains preserved.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch available.
- emergency local mode available.
- api-primary-dev remains dev/local only and not production-ready.
- accepted browser mutation routes exactly seven.

## What Task 16C Adds

- backup/recovery readiness helper.
- backup/recovery copy helper.
- backup status categories.
- recommended recovery actions.
- tests for pure/no-side-effect behavior.
- docs explaining how to use the result.

The helper result is recommendation-only. It can be shown in a future owner-only UI, but it does not perform backup, restore, storage access, cloud pull, cloud push, upload, or source-of-truth changes.

## Backup/Recovery Readiness Model

| Status | Severity | Meaning | Recommended action | Pause cloud candidate? | Use emergency local mode? |
| --- | --- | --- | --- | --- | --- |
| ready | ready | Backup and restore checks are satisfied for local-first use. | continue_localStorage_primary; no_action_needed | No | No |
| backup_recommended | info | A manual backup is useful before higher-risk work. | create_manual_backup | No | No |
| backup_stale | caution | Backup is older than the latest workout. | verify_latest_backup or create_manual_backup; do_not_cloud_pull; do_not_cloud_push if cloud candidate is enabled | Yes if cloud candidate is enabled | No |
| backup_missing | stop | No confirmable backup exists. | create_manual_backup; pause_cloud_candidate; do_not_cloud_pull; do_not_cloud_push | Yes | No |
| backup_unverified | caution | Backup exists but has not been verified. | verify_latest_backup; rehearse_restore; do_not_cloud_pull; do_not_cloud_push if cloud candidate is enabled | Yes if cloud candidate is enabled | No |
| restore_rehearsal_needed | caution | Restore has not been rehearsed. | rehearse_restore; do_not_cloud_pull; do_not_cloud_push if cloud candidate is enabled | Yes if cloud candidate is enabled | No |
| emergency_local_ready | info | Emergency local mode is available. | continue_localStorage_primary; rehearse_emergency_local_restore | Yes if cloud candidate is enabled | Yes if needed |
| emergency_local_unavailable | emergency | Emergency local mode cannot be confirmed. | pause_cloud_candidate; record_incident_note; escalate_to_task16d | Yes | No until restored |
| cloud_candidate_paused | caution | Cloud candidate should stay paused while local recovery is reviewed. | pause_cloud_candidate; continue_localStorage_primary | Yes | No |
| recovery_blocked | stop | Conflict or recovery blocker prevents safe candidate work. | pause_cloud_candidate; record_incident_note | Yes | No |
| source_of_truth_unclear | emergency | Current data source is unclear. | pause_cloud_candidate; use_emergency_local_mode; continue_localStorage_primary | Yes | Yes |
| owner_review_required | stop | Owner scope is unclear. | inspect_owner_scope; pause_cloud_candidate | Yes | No |
| schema_review_required | stop | Schema validation is unclear. | inspect_schema_validation; pause_cloud_candidate | Yes | No |
| local_first_safe_mode | ready | Local-first safe mode is suitable for personal use. | continue_localStorage_primary; no_action_needed | No | No |

## Owner Daily Backup/Recovery Checklist

- [ ] confirm app opens locally.
- [ ] confirm latest workout appears in local history.
- [ ] confirm emergency local mode is available.
- [ ] confirm rollback / kill switch is available.
- [ ] confirm backup freshness.
- [ ] confirm backup verification.
- [ ] confirm no unresolved conflict.
- [ ] confirm owner scope is clear.
- [ ] confirm schema validation is clear.
- [ ] only attempt cloud candidate if backup/recovery is safe.

## Before Cloud Pull/Push Rehearsal Checklist

- [ ] backup is fresh or manually accepted.
- [ ] backup is verified or restore rehearsal completed.
- [ ] owner scope is clear.
- [ ] schema validation is clear.
- [ ] emergency local mode is available.
- [ ] rollback / kill switch is available.
- [ ] dry run completed.
- [ ] manual confirmation required.
- [ ] no auto-apply / no auto-upload.

## Emergency Recovery Guidance

- stop cloud operations.
- pause cloud candidate.
- return to localStorage-primary.
- use emergency local mode if needed.
- keep local data unchanged.
- do not delete backups.
- record incident note.
- escalate if source-of-truth unclear.

## Relationship To Task 16D

Recommended next task: Task 16D — Daily Training UX Polish Pack V1.

Task 16D should focus on:

- session logging friction.
- safer start/complete flow.
- clearer history review.
- better empty/error states.
- owner-friendly local-first training UX.

Task 16D should not be started by Task 16C.

## Final Statement

- Task 16C does not start Task 16D.
- SaaS remains deferred.
- This task supports personal-only production use.
