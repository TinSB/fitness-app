# Task UI-OS R1 Interaction OS Product Spec

## Task Identity

Task UI-OS R1 — Interaction OS Product Spec From Real User Answers V1.

This task is docs/static tests only and product specification only. Task UI-OS R1 does not implement UI changes, does not modify App.tsx, does not modify runtime components, and does not start UI-OS R2.

## Baseline Evidence

- UI-OS 7 completed.
- UI-OS 7 PR #279.
- UI-OS 7 merge commit: 79cddfc05efa67861712efcf982dcdb817a29949.
- Validation passed: `npm run api:dev:build`, `npm run typecheck`, `npm test` with 1112 files / 4540 tests, `npm run build`, and dist token scan clean.
- The UI-OS sequence technically completed.

## Product Acceptance Verdict

The UI-OS sequence was technically completed, but product acceptance failed.

The current implementation is closer to partial visual reskin than a true interaction operating system. The app shell changed, but the operation flows, component states, state-aware primary actions, and surface system did not fully become a training interaction OS. A corrective UI-OS R phase is required.

## Observed Issues

- Bottom navigation can overlay content.
- Focus Mode action logic is not fully state-aware.
- Correction / skip states can still show inappropriate `完成一组`.
- White/light cards remain mixed into dark shell without clear surface system.
- Today page is still content stacking instead of a decisive training decision surface.
- History / Progress / Data Health hierarchy is not fully aligned with user priorities.
- Settings / Safety / Equipment Profiles need stronger grouping.
- Component states are incomplete.
- Primary action hierarchy is inconsistent.

## User Answer Interpretation

- App first goal: the user wants to see what to train today first. Today must answer whether to train today, what to train, and recovery/fatigue status.
- Most frequent gym action: start today training.
- Most important training-time information: current exercise, current set, and one clear primary completion/action button. The user answer included `ABG`: A = current exercise, B = current set, G = complete/current primary action button.
- Correction / mobility / corrective tasks may be skipped. They should not affect formal working set count and must not be treated the same as normal working sets.
- Skip state: if a skip reason exists, the primary action should be `确认跳过` or `继续训练`; it should not show `完成一组` as the dominant action.
- Focus Mode primary action: one dominant primary action. Other actions may remain visible, but they must be visually secondary and must not compete with the primary action.
- Bottom secondary actions remain available at the bottom: `复制上组`, `标记不适`, `替代动作`. They are constant tools, but visually secondary.
- End workout requires second confirmation.
- Recommendation display: the primary prescription should show executable weight, for example `45 lb × 10`, with `空杆` or equipment context as secondary copy. Theoretical weight should not be primary.
- Equipment-aware details are collapsed by default. Abnormal cases may show a brief warning, but full details should not clutter the main flow.
- Apply suggestion fills weight only in R1. R8.6 later explicitly authorized filling actionable weight plus planned reps for the active draft while still not filling RIR.
- Actual record input should appear after tapping `记录本组` or equivalent, preferably through a bottom sheet / modal flow instead of always showing full input on the main screen.
- Today page purpose: decide whether to train, decide what to train, and show recovery/fatigue status.
- Today focus override: `今天想练` is medium priority and should not dominate Today page.
- History page priority: calendar training frequency, which days were trained and not trained, and PR/e1RM access.
- Data Health should not frequently interrupt training. It should be shown only for serious issues during training flow. Full Data Health belongs in Settings or a secondary area.
- Visual direction: Whoop / Athlytic style for recovery/analytics and Apple Health style for data clarity and health summaries.
- Theme: light and dark theme support is required, with system theme support. Focus Mode may be dark/immersive. History/Settings can support more Apple Health-like light surfaces.
- Refactor scope: full component system + operation state machine + all pages, not merely cosmetic changes.
- High-risk features: training main flow has priority. Cloud candidate / diagnostics / data health should not crowd training flow and may be moved into Settings.

## New Product Direction

IronPath should become a Personal Training Interaction Operating System.

It is not merely:

- a redesigned UI shell
- a styled dashboard
- a collection of training pages

It must:

- decide today
- guide active training
- reduce training friction
- show feasible equipment-aware load
- preserve local-first data safety
- recover safely

## Product Principles

- Training decision first.
- Focus Mode is state-machine driven.
- One dominant primary action.
- Secondary actions stay available but visually secondary.
- Feasible load is primary; theory is secondary.
- Actual record input appears through bottom sheet / modal flow.
- Correction/mobility tasks do not affect formal set count unless explicitly configured.
- Skip states do not use `完成一组`.
- Data Health does not interrupt training except for severe risk.
- History prioritizes calendar frequency and PR/e1RM.
- Settings contains high-risk / cloud / diagnostics / backup controls.
- Light/dark theme is required.
- Whoop / Athlytic + Apple Health is the target visual reference direction.

## Interaction State Model

### Session states

- `no_session`
- `planned_session_ready`
- `active_session`
- `unfinished_session`
- `session_complete`
- `recovery_required`

### Exercise states

- `exercise_ready`
- `active_exercise`
- `substituted_exercise`
- `correction_exercise`
- `mobility_exercise`
- `skipped_exercise`
- `discomfort_flagged`

### Set states

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

### Recommendation states

- `feasible_load_ready`
- `theoretical_only`
- `equipment_unknown`
- `manual_confirmation_required`
- `not_applicable`

### Safety states

- `local_ok`
- `backup_recommended`
- `source_unclear`
- `emergency_local_available`
- `cloud_candidate_paused`

## Primary Action Map

Only one dominant primary action is allowed per screen. Secondary actions must not compete with the primary action.

| State | Primary action |
| --- | --- |
| `no_session` | 开始今天训练 |
| `planned_session_ready` | 开始训练 |
| `unfinished_session` | 继续训练 |
| `warmup_set` + `feasible_load_ready` | 记录本组 or 套用重量 |
| `working_set` + actual input needed | 记录本组 |
| `suggestion_applied` + `ready_to_complete` | 完成一组 |
| `correction_set` | 完成纠偏 |
| `mobility_task` | 完成动作 |
| `skipped_exercise` | 确认跳过 |
| `skip_pending` | 确认跳过 / 继续训练 |
| `discomfort_flagged` | 选择处理方式 |
| `source_unclear` | 回到本地模式 |
| `session_complete` | 完成训练 |
| `session_end_requested` | 二次确认结束训练 |

`完成一组` must not be primary in skip/correction/mobility states unless that state is explicitly a normal set.

## Focus Mode Redesign Requirements

- Focus Mode hides bottom nav.
- Focus Mode is immersive.
- Bottom area is an action bar, not global nav.
- Top actions include `退出专注` and `结束训练`.
- `结束训练` requires second confirmation.
- Secondary actions remain available at bottom but visually secondary: `复制上组`, `标记不适`, `替代动作`.
- Actual record input opens through bottom sheet / modal.
- Apply suggestion fills weight only in R1; R8.6 later supersedes this for active drafts by filling actionable weight plus planned reps, not RIR.
- Equipment details are collapsed by default.
- Abnormal equipment-aware cases may show small warning/summary.

## Today Decision Surface Requirements

Today decision surface must prioritize:

- train or not today
- what to train
- recovery/fatigue status
- start training
- medium-priority today focus override
- only severe risk / P0 warning

Today must not prioritize:

- full Data Health
- technical diagnostics
- cloud candidate controls
- long history lists

## History Requirements

History must prioritize:

- calendar training frequency
- which days trained / not trained
- weekly/monthly counts
- PR/e1RM access
- recent sessions as secondary

## Progress Requirements

Progress should follow:

- Whoop / Athlytic style for readiness/recovery trends
- Apple Health style for clarity
- human-readable guidance
- PR/e1RM/effective sets as explanation, not raw numbers only

## Settings Requirements

Settings owns:

- backup/recovery
- emergency local
- cloud candidate
- diagnostics
- equipment profiles
- units
- theme
- data safety

High-risk features should not crowd training flow.

## Theme System Requirements

- Light theme.
- Dark theme.
- System theme.
- Focus Mode may prefer dark/immersive.
- History/Settings may support Apple Health-like light surfaces.
- Visual surfaces must be unified across themes.

## Surface System Requirements

Required surface types:

- `dark_glass_card`
- `light_health_card`
- `training_hero_card`
- `elevated_action_card`
- `warning_card`
- `settings_group_card`
- `bottom_sheet`
- `modal_confirmation`
- `safety_strip`

Rules:

- Old white cards must not randomly appear inside dark training flow.
- White/light surfaces are allowed only when intentionally part of theme or grouped health/settings surface.
- Today / Train should prioritize `training_hero_card` and dark/immersive surfaces.
- History / Progress may use `light_health_card` when theme-appropriate.
- Settings should use grouped settings surfaces.

## Bottom Navigation And Safe Area Rules

- Focus Mode hides bottom nav.
- Normal pages show bottom nav.
- Scroll container bottom padding >= bottom nav height + safe area + 24px.
- Primary buttons must not be covered by bottom nav.
- Last card must be fully scrollable above nav.
- Sticky action bars must coordinate with bottom nav.

## Data Health Interruption Rule

- Data Health should not frequently interrupt training.
- Only severe blockers appear in Today/Focus.
- Full Data Health belongs in Settings or secondary review flow.
- No automatic repair.
- `POST /data-health/repair/apply` remains blocked.

## Implementation Roadmap

### UI-OS R2 — Focus Mode Interaction State Machine Rewrite V1

- Rewrite Focus Mode operation states and primary actions.
- Fix skip/correction/discomfort logic.
- Hide bottom nav in Focus Mode.
- Add actual record bottom sheet.
- Apply suggestion fills weight only in R1; R8.6 later supersedes this for active drafts by filling actionable weight plus planned reps, not RIR.
- Equipment-aware prescription remains primary.

### UI-OS R3 — Today Decision Surface Rewrite V1

- Make Today a decision screen.
- Prioritize train/not train/what to train/recovery.
- Reduce content stacking.
- Move secondary diagnostics out.

### UI-OS R4 — History Calendar & PR/e1RM Rewrite V1

- Calendar frequency first.
- Days trained/not trained.
- PR/e1RM access.

### UI-OS R5 — Progress / Data Health Clarity Rewrite V1

- Whoop/Athlytic + Apple Health direction.
- Human-readable progress.
- Data Health non-interruptive.

### UI-OS R6 — Settings / Safety / Theme / Equipment Profile Rewrite V1

- Grouped settings.
- High-risk controls.
- Theme system.
- Equipment profile controls.

### UI-OS R7 — Mobile Safe Area / Component State Regression Lock V1

- No bottom nav overlay.
- Component state coverage.
- Primary action hierarchy lock.

### UI-OS R8 — Interaction OS Remediation Archive V1

- Archive the corrective UI-OS R phase.
- Record implemented state-machine, theme, page, and safety boundaries.

UI-OS R2 is recommended next.

UI-OS R2 is not started by R1.

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

## Accepted Browser Mutation Route Inventory

The accepted browser mutation route inventory remains exactly seven:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

No eighth browser mutation route.

`POST /data-health/repair/apply` remains blocked.

backup/import/export over HTTP remains blocked.

reset/recovery over HTTP remains blocked.

## Final Statement

Task UI-OS R1 does not implement UI changes.

Task UI-OS R1 does not start R2.

This is the product specification for corrective interaction OS remediation.

Personal-only direction remains active.

SaaS remains deferred.
