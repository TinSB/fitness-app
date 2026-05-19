# UI-OS R2 Focus Mode Interaction State Machine Rewrite

## Task Identity

UI-OS R2 — Focus Mode Interaction State Machine Rewrite V1.

This is an implementation task. It rewrites Focus Mode interaction behavior around deterministic state resolution while preserving the existing training/session mutation handlers, training engines, persistence model, routes, and source-of-truth boundaries.

## Baseline Evidence

- UI-OS R0 complete.
- UI-OS R0 PR #281.
- UI-OS R0 merge commit: 567391baa0dde17aa6bc901e6d3bed871b5d5e58.
- Validation passed: `npm run api:dev:build`, `npm run typecheck`, `npm test` with 1116 files / 4558 tests, `npm run build`, and dist token scan clean.
- UI-OS R0 extracted production-safe v0 design system components: `GlassCard`, `ActionButton`, `SegmentedControl`, `StatusBadge`, `BottomSheet`, `SafetyStrip`, `FloatingBottomNav`, `EquipmentAwareLoadCard`, `TrainingFocusHero`, and `SettingsGroupCard`.
- UI-OS R1 complete.
- UI-OS R1 PR #280.
- UI-OS R1 merge commit: 5136de81f417d19804a80ff579dd31787e69c085.
- UI-OS R1 converted user answers into the corrective Interaction OS product spec.

## Problem Being Fixed

Focus Mode still had a partial reskin problem: the visual shell had improved, but operation flow was still driven by old page-level button logic. Old logic allowed inappropriate primary actions in some states. Correction / skip states must not show `完成一组`, and mobility work must not be treated like a normal working set.

Bottom nav must not compete with Focus Mode. Focus Mode should reserve the bottom area for the training action bar, not global navigation. Actual record input should be controlled through bottom sheet/modal flow instead of always occupying the main screen. Each state must have one dominant primary action.

## What R2 Adds

- A pure Focus Mode interaction state model.
- A deterministic primary action resolver.
- A Focus action bar driven by the resolved state.
- Actual record bottom sheet / modal entry for weight, reps, RIR, and note entry where already supported.
- Bottom nav hidden in Focus Mode through the existing immersive shell behavior.
- `套用建议` R2 behavior was weight-only. R8.6 supersedes this by applying feasible equipment-aware weight plus planned reps for the active draft, while still not auto-filling RIR.
- End-workout second confirmation: the first tap requests ending, and `确认结束训练` is explicit.
- Production UI-OS components from R0 are used for Focus action surfaces: `ActionButton`, `BottomSheet`, `StatusBadge`, `EquipmentAwareLoadCard` through `EquipmentAwareLoadDisplay`, `TrainingFocusHero`, and glass/material training cards.

## State Model

Session states:

- `no_session`
- `planned_session_ready`
- `active_session`
- `unfinished_session`
- `session_complete`
- `session_end_requested`
- `recovery_required`

Exercise states:

- `exercise_ready`
- `active_exercise`
- `substituted_exercise`
- `correction_exercise`
- `mobility_exercise`
- `skipped_exercise`
- `discomfort_flagged`

Set states:

- `warmup_set`
- `working_set`
- `correction_set`
- `mobility_task`
- `pending_actual_input`
- `suggestion_applied`
- `ready_to_complete`
- `completed`
- `skipped`
- `blocked`

Recommendation states:

- `feasible_load_ready`
- `theoretical_only`
- `equipment_unknown`
- `manual_confirmation_required`
- `not_applicable`

Safety states:

- `local_ok`
- `backup_recommended`
- `source_unclear`
- `emergency_local_available`
- `cloud_candidate_paused`

The resolved state explicitly returns `sourceOfTruthChanged: false` and `trainingAlgorithmChanged: false`.

## Primary Action Map

| State | Primary action |
| --- | --- |
| `no_session` | 开始今天训练 |
| `planned_session_ready` | 开始训练 |
| `unfinished_session` | 继续训练 |
| `active_session + warmup_set + feasible_load_ready + no actual input` | 记录本组 |
| `active_session + working_set + feasible_load_ready + no actual input` | 记录本组 |
| `suggestion_applied + ready_to_complete` | 完成一组 |
| `correction_set` | 完成纠偏 |
| `mobility_task` | 完成动作 |
| `skipped_exercise` | 确认跳过 |
| `skip_pending / hasSkipReason` | 确认跳过 / 继续训练 |
| `discomfort_flagged` | 选择处理方式 |
| `source_unclear` | 回到本地模式 |
| `session_complete` | 查看训练总结 |
| `session_end_requested` | 确认结束训练 |

Only one dominant primary action is allowed per Focus Mode state. `完成一组` must not be primary in skip/correction/mobility states unless that state is explicitly a normal set.

## UI Behavior

- Focus Mode hides bottom nav.
- Normal pages keep bottom nav.
- Focus Mode bottom area is the Focus action bar.
- Secondary actions remain available but visually secondary: `复制上组`, `标记不适`, `替代动作`, `跳过`, and `查看详情`.
- Correction state uses `完成纠偏`.
- Mobility state uses `完成动作`.
- Skip state uses `确认跳过`.
- Actual record input opens through bottom sheet / modal flow after `记录本组`.
- The bottom sheet contains weight, reps, RIR, and optional notes where the existing working-set handler supports notes.
- `套用建议` fills weight only in R2; R8.6 later fills actionable weight plus planned reps.
- `套用建议` uses feasible equipment-aware load when available.
- `套用建议` does not auto-fill reps in R2; R8.6 explicitly authorizes planned reps for the active draft.
- `套用建议` does not auto-fill RIR.
- `套用建议` does not complete the set.
- Equipment-aware prescription remains primary.
- Bench Press theoretical 17 lb still resolves to empty Olympic bar / feasible 45 lb as the primary prescription, while theoretical 17 lb remains detail-only.

## Non-Goals

- No training algorithm change.
- No warmup algorithm change.
- No PR/e1RM/effective-set change.
- No equipment-aware engine logic change.
- No source-of-truth change.
- No persistence change.
- No AppData schema change.
- No route change.
- No browser mutation route change.
- No cloud sync.
- No default cloud sync.
- No background sync.
- No package dependency change.
- No package script change.
- No lockfile change.
- No production runtime import from `src/prototype/IronPathOS2.tsx`.
- No production runtime import from `src/prototypePreview.tsx`.

## Safety Boundaries

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- api-primary-dev remains dev/local only and not production-ready.
- devApiRunner is not production backend.
- service role key never enters browser.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- `POST /data-health/repair/apply` remains blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.
- no default cloud sync.
- no background sync.
- no automatic worker/timer/polling sync.
- no production deployment auto-start.
- no external monitoring upload.
- no SaaS/multi-user runtime.
- no billing/public onboarding.
- no normalized training tables.
- no destructive migration.
- no real personal training data in automated tests.
- no new package/dependency/script/lockfile drift beyond Phase 12 @supabase/supabase-js.

Accepted browser mutation routes remain exactly:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

No eighth browser mutation route is added.

## Recommended Next Task

UI-OS R3 — Today Decision Surface Rewrite V1 is recommended next.

UI-OS R3 is not started by R2.
