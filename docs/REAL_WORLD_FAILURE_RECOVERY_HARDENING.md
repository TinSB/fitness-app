# Real-World Failure / Recovery Hardening

## Task Identity

- Task 15B.
- Real-World Failure / Recovery Hardening.
- Phase 15.
- Personal production candidate stabilization.

## Baseline Evidence

- Task 15A complete.
- Task 15A PR #252.
- Task 15A merge commit: `975d6ee80fe7e6cea115d5af4ab8f674372fc639`.
- `npm test` passed: 1049 files / 4193 tests.
- dist token scan clean.

## Non-Goals

Task 15B does not:

- change runtime behavior.
- enable default cloud sync.
- enable background sync.
- enable automatic multi-device sync.
- connect to Supabase.
- upload training data.
- apply cloud pull.
- perform cloud push.
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

## Failure Classification Table

| Failure category | Severity | Immediate action | User-visible meaning | Pause cloud candidate? | Force emergency local mode? | Escalate into Task 15C? |
| --- | --- | --- | --- | --- | --- | --- |
| local_app_unavailable | emergency | force_emergency_local_mode | App cannot be used safely. | yes | yes | no |
| local_storage_unavailable | emergency | force_emergency_local_mode | Local baseline cannot be trusted. | yes | yes | no |
| local_history_missing | stop | pause_cloud_candidate | Recent workout history is missing locally. | yes | no | no |
| repeated_fallback | caution | pause_cloud_candidate | Local fallback is happening repeatedly. | yes | no | no |
| rollback_needed | stop | run_rollback_rehearsal | Candidate mode needs rollback practice. | yes | no | no |
| rollback_failed | emergency | force_emergency_local_mode | Rollback did not complete cleanly. | yes | yes | no |
| emergency_local_used | stop | run_emergency_restore_rehearsal | Emergency local path was needed. | yes | yes | no |
| emergency_local_unavailable | emergency | stop_and_escalate_to_task_15c | Emergency local path cannot be reached. | yes | yes | yes |
| owner_mismatch | stop | inspect_owner_scope | Signed-in owner/account does not match expected owner. | yes | no | no |
| schema_validation_failed | stop | inspect_schema_validation | Local or cloud candidate data shape is not trusted. | yes | no | no |
| cloud_pull_confusing | caution | pause_cloud_candidate | Pull rehearsal status was unclear. | yes | no | yes |
| cloud_pull_wants_auto_apply | emergency | do_not_apply_cloud_pull | Pull appears to risk applying cloud data automatically. | yes | yes | no |
| cloud_push_confusing | caution | pause_cloud_candidate | Push rehearsal status was unclear. | yes | no | yes |
| cloud_push_missing_confirmation | emergency | do_not_run_cloud_push | Push appears to skip manual confirmation. | yes | yes | no |
| cloud_push_fake_success_risk | emergency | do_not_run_cloud_push | Push could imply success without a trusted write result. | yes | yes | no |
| conflict_unresolved | stop | pause_cloud_candidate | Manual conflict resolution is still incomplete. | yes | no | no |
| diagnostics_insufficient | caution | inspect_diagnostics_snapshot | Incident details are not understandable enough. | no | no | yes |
| service_role_browser_risk | emergency | force_emergency_local_mode | Browser context may expose a service role key. | yes | yes | yes |
| default_sync_detected | emergency | force_emergency_local_mode | Default cloud sync behavior appears present. | yes | yes | yes |
| background_sync_detected | emergency | force_emergency_local_mode | Background sync behavior appears present. | yes | yes | yes |
| route_boundary_drift | emergency | stop_and_escalate_to_task_15c | Browser mutation route inventory may have changed. | yes | yes | yes |
| package_or_lockfile_drift | stop | stop_and_escalate_to_task_15c | Package or lockfile drift appeared unexpectedly. | yes | no | no |
| source_of_truth_unclear | emergency | force_emergency_local_mode | Current source-of-truth cannot be identified. | yes | yes | no |

## Recovery Decision Tree

- If source-of-truth is unclear, stop and use localStorage-primary / emergency local.
- If cloud pull wants to auto-apply, stop and do not apply.
- If cloud push skips confirmation, stop and do not push.
- If owner mismatch occurs, stop cloud operations and inspect owner scope.
- If schema validation fails, stop cloud operations and inspect schema validation.
- If rollback unavailable, force emergency local mode.
- If diagnostics insufficient, record incident and escalate to Task 15C.
- If service role appears in browser, stop immediately and treat as emergency.
- If default cloud sync or background sync appears, stop immediately and force emergency local mode.
- If route boundary drift or package drift appears, stop and preserve local data unchanged.

## Supported Recovery Actions

- continue_localStorage_primary
- pause_cloud_candidate
- disable_cloud_pull
- disable_cloud_push
- disable_supabase_adapter_candidate
- disable_backend_primary_candidate
- force_emergency_local_mode
- run_rollback_rehearsal
- run_emergency_restore_rehearsal
- inspect_owner_scope
- inspect_schema_validation
- inspect_diagnostics_snapshot
- keep_local_data_unchanged
- do_not_apply_cloud_pull
- do_not_run_cloud_push
- stop_and_escalate_to_task_15c

## Recovery Checklists

### Repeated Fallback

- [ ] Continue localStorage-primary.
- [ ] Pause cloud candidate.
- [ ] Disable cloud pull.
- [ ] Disable cloud push.
- [ ] Inspect diagnostic snapshot.
- [ ] Record repeated fallback count and next action.

### Rollback Needed

- [ ] Pause cloud candidate.
- [ ] Run rollback rehearsal.
- [ ] Keep local data unchanged.
- [ ] Keep cloud data unchanged.
- [ ] Confirm rollback / kill switch remains available.

### Emergency Local Mode Used

- [ ] Disable cloud pull.
- [ ] Disable cloud push.
- [ ] Disable Supabase adapter candidate.
- [ ] Disable backend-primary candidate.
- [ ] Run emergency restore rehearsal.
- [ ] Confirm emergency local mode available.
- [ ] Do not delete localStorage backup.

### Owner Mismatch

- [ ] Pause cloud candidate.
- [ ] Inspect owner scope.
- [ ] Do not apply cloud pull.
- [ ] Do not run cloud push.
- [ ] Keep local data unchanged.
- [ ] Record account and owner mismatch notes without secrets.

### Schema Validation Failure

- [ ] Pause cloud candidate.
- [ ] Inspect schema validation.
- [ ] Do not apply cloud pull.
- [ ] Do not run cloud push.
- [ ] Keep local data unchanged.
- [ ] Keep cloud data unchanged.

### Confusing Cloud Pull Rehearsal

- [ ] Pause cloud candidate.
- [ ] Disable cloud pull.
- [ ] Do not apply cloud pull.
- [ ] Inspect diagnostic snapshot.
- [ ] Escalate unclear status labels into Task 15C.

### Confusing Cloud Push Rehearsal

- [ ] Pause cloud candidate.
- [ ] Disable cloud push.
- [ ] Do not run cloud push.
- [ ] Inspect diagnostic snapshot.
- [ ] Escalate unclear status labels into Task 15C.

### Diagnostics Insufficient

- [ ] Continue localStorage-primary.
- [ ] Inspect diagnostic snapshot.
- [ ] Record incident category and missing fields.
- [ ] Escalate into Task 15C if diagnostics are too technical or incomplete.

## Incident Log Template

| Date | Incident category | Severity | Runtime source | Cloud pull attempted? | Cloud push attempted? | Owner mismatch? | Schema validation failure? | Rollback used? | Emergency local mode used? | Local data preserved? | Cloud data unchanged? | Recommended action | Follow-up task |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | category | info/caution/stop/emergency | localStorage-primary / candidate | no / yes | no / yes | no / yes | no / yes | no / yes | no / yes | yes / no | yes / no | action | none / Task 15C |

## Escalation Into Task 15C

Recommended next task: Task 15C - UX Cleanup for Production Candidate Controls.

Task 15C should be triggered if:

- Status labels were unclear.
- Cloud pull/push controls were confusing.
- Emergency mode was hard to find.
- User could not tell current source-of-truth.
- Diagnostics were too technical.
- Manual recovery steps were too hard to follow.

## Final Statement

- Task 15B does not start Task 15C.
- Task 15B supports personal production candidate stabilization only.
- Task 15B does not authorize public SaaS launch.
