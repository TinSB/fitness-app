# Data Health & Diagnostics Clarity Pack V1

## Task Identity

- Task 16E.
- Data Health & Diagnostics Clarity Pack V1.
- personal-only polish/reliability.
- Chinese-first owner-facing copy.

## Baseline Evidence

- Task 16D complete.
- Task 16D PR #259.
- Task 16D merge commit: `681d9b57aff08619f5c0d523fb85fa8279015027`.
- `npm test` passed: 1068 files / 4316 tests.
- dist token scan clean.
- Task 16D added daily training UX copy and a presentational status panel.
- SaaS remains deferred.

## Non-Goals

Task 16E does not:

- enable automatic repair.
- add POST /data-health/repair/apply.
- perform destructive repair.
- change source-of-truth behavior.
- enable default cloud sync.
- enable background sync.
- upload external monitoring data.
- upload full AppData diagnostic snapshots.
- expose secrets, tokens, or service role keys in diagnostics.
- connect to Supabase.
- add routes.
- add backup/import/export HTTP routes.
- add reset/recovery HTTP routes.
- add package/dependency/script/lockfile changes.

## Safety Baseline

- localStorage remains default / fallback / migration / emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- accepted browser mutation routes remain exactly seven.
- personal-only direction remains active.

## Owner-Friendly Data Health Copy Policy

- Use Chinese-first labels.
- Explain why the issue matters in simple language.
- Recommend a safe next manual action.
- Prefer backup/recovery, owner-scope, schema validation, or emergency-local review over automatic repair.
- Never imply destructive repair is allowed.
- Never imply cloud candidate operations are required for local training.

## Diagnostics Redaction Policy

- Diagnostics must require redaction.
- Diagnostics must not include full AppData snapshots.
- Diagnostics must not include secrets, tokens, service role keys, or real personal training data.
- Diagnostics may include small owner-written incident notes and category labels.
- External monitoring upload remains blocked.

## Clarity Categories

| Category | Meaning | Safe next action |
| --- | --- | --- |
| no_issue | No data health issue needs action. | continue_localStorage_primary |
| informational | Status is informational only. | review_issue_details |
| review_recommended | Owner should inspect issue details. | review_issue_details |
| backup_recommended | Backup/recovery should be checked first. | create_manual_backup |
| owner_review_required | Owner scope is unclear. | inspect_owner_scope |
| schema_review_required | Schema validation is unclear. | inspect_schema_validation |
| recovery_recommended | Recovery path should be reviewed. | inspect_backup_recovery |
| emergency_local_recommended | Emergency local mode is safest. | use_emergency_local_mode |
| cloud_candidate_paused | Cloud candidate should remain paused. | pause_cloud_candidate |
| diagnostics_insufficient | Diagnostic detail is not clear enough. | record_redacted_incident_note |
| repair_blocked | Automatic repair stays blocked. | do_not_repair_apply |

## Task 16F Recommendation

Recommended next task: Task 16F — Mobile / PWA Personal Use Polish Pack V1.

Task 16F should improve phone/PWA owner-only guidance, local-first mobile wording, emergency local reminders, and safe small-screen copy without adding background sync.

Task 16F is recommended but not started by Task 16E.

## Final Statement

- Task 16E does not start Task 16F.
- SaaS remains deferred.
- This task supports personal-only production use.
