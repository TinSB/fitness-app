# Daily Training UX Polish Pack V1

## Task Identity

- Task 16D.
- Daily Training UX Polish Pack V1.
- personal-only polish/reliability.
- Chinese-first owner-facing copy.

## Baseline Evidence

- Task 16C complete.
- Task 16C PR #258.
- Task 16C merge commit: `99343a165e21ca12512664eb71161adfcd38f338`.
- `npm test` passed: 1064 files / 4300 tests.
- dist token scan clean.
- Task 16C added backup/recovery readiness and copy helpers.
- SaaS remains deferred.

## Non-Goals

Task 16D does not:

- change source-of-truth behavior.
- change training algorithms.
- modify PR/e1RM/effective-set logic.
- enable default cloud sync.
- enable background sync.
- connect to Supabase.
- perform cloud pull.
- perform cloud push.
- upload data.
- add routes.
- add backup/import/export HTTP routes.
- add reset/recovery HTTP routes.
- add POST /data-health/repair/apply.
- add production deployment runtime.
- add external monitoring upload.
- add SaaS/multi-user runtime.
- use real personal training data in tests.
- add package/dependency/script/lockfile changes.

## Safety Baseline

- localStorage remains default / fallback / migration / emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- api-primary-dev remains dev/local only and not production-ready.
- accepted browser mutation routes remain exactly seven.
- SaaS remains deferred.
- personal-only direction remains active.

## Daily State Copy Table

| State | Owner label | Safe next action | Safety copy |
| --- | --- | --- | --- |
| local_first_ready | 本地优先训练状态正常 | continue_local_training | localStorage remains the safe default. |
| no_active_session | 当前没有进行中的训练 | start_local_session | Starting does not enable cloud candidate or SaaS. |
| active_session_in_progress | 训练正在进行 | continue_active_session | Do not switch source of truth during training. |
| session_ready_to_complete | 训练可以准备完成 | review_before_complete | Completion remains manually confirmed. |
| session_completed | 训练已完成 | review_local_history | Confirm latest workout appears locally. |
| session_discarded | 训练已丢弃 | record_manual_note | Discard does not imply remote deletion. |
| interrupted_unfinished_session | 训练中断或未完成 | continue_active_session | Do not switch source of truth because of interruption. |
| recent_history_available | 最近训练历史可查看 | review_local_history | History review does not require cloud candidate. |
| empty_history | 本地历史为空 | inspect_source_of_truth | Do not upload or apply cloud candidate data. |
| local_data_unavailable | 本地数据不可用 | use_emergency_local_mode | Stop risky operations and inspect recovery. |
| backup_recommended_before_risky_action | 建议先做手动备份 | create_manual_backup | Back up before candidate rehearsals. |
| emergency_local_available | 紧急本地模式可用 | continue_local_training | Keep local data and emergency backup. |
| cloud_candidate_paused | 云端候选已暂停 | pause_cloud_candidate | Local training can continue; no automatic sync. |
| source_of_truth_unclear | 当前数据来源不清楚 | inspect_source_of_truth | Stop cloud operations and return local-first. |
| owner_action_required | 需要 owner 手动处理 | record_manual_note | Do not upload or apply candidate data yet. |
| recovery_action_recommended | 建议执行恢复检查 | follow_recovery_recommendation | Recovery copy recommends only; it does not mutate data. |

## Owner Daily Training Checklist

- [ ] confirm app opens in local-first mode.
- [ ] confirm current source-of-truth is clear.
- [ ] confirm localStorage is available before training.
- [ ] confirm no forced cloud operation is pending.
- [ ] start or continue only the intended local session.
- [ ] before completion, review sets, weights, notes, and pain flags.
- [ ] after completion, confirm the session appears in local history.
- [ ] if the session is interrupted, record a note before continuing or discarding.
- [ ] if backup is recommended, create or verify a manual backup before risky work.
- [ ] if emergency local mode is needed, stop cloud candidate operations first.

## Error / Empty State Policy

- Empty history should say whether this might be a new install, missing local data, or source-of-truth uncertainty.
- Local data unavailable should tell the owner to stop risky operations and inspect recovery.
- Interrupted sessions should use calm copy that supports continuing locally or recording a manual note.
- Source-of-truth unclear copy must recommend localStorage or emergency local mode.
- No error copy should imply public SaaS launch, automatic cloud behavior, or background sync.

## Task 16E Recommendation

Recommended next task: Task 16E — Data Health & Diagnostics Clarity Pack V1.

Task 16E should improve owner-friendly data health labels, diagnostic summaries, redaction reminders, and safe next actions without enabling automatic repair.

Task 16E is recommended but not started by Task 16D.

## Final Statement

- Task 16D does not start Task 16E.
- SaaS remains deferred.
- This task supports personal-only production use.
