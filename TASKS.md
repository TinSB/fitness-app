# IronPath Frontend Tasks

Last updated: 2026-04-28

This backlog is ordered for multiple Codex conversations. Each task is scoped to minimize collisions and preserve current architecture.

## Coach Automation V1 Backlog

Planning source: `COACH_AUTOMATION_PLAN.md`

### P0-009: Define CoachSuggestion contract and read-only automation boundaries

Priority: P0

Goal:
Create shared types and tests for explainable, dismissible coach suggestions before implementing UI write flows.

Files likely involved:
- `src/engines/coachAutomationEngine.ts`
- `src/engines/dataHealthEngine.ts`
- `src/engines/setAnomalyEngine.ts`
- `tests/coachAutomationEngine.test.ts`

Acceptance criteria:
- Every suggestion has Chinese title, reason, impact, source engine, and confirmation requirement.
- No suggestion mutates AppData directly.
- Tests prove inputs are not mutated.
- Raw enum/internal ids are not shown in visible suggestion text.

Out of scope:
- Backend jobs.
- Cloud sync.
- Automatic plan overwrite.

### P0-010: Implement dataHealthEngine

Priority: P0

Goal:
Detect data quality issues that could affect recommendations or statistics, while keeping all fixes user-confirmed.

Files likely involved:
- `src/engines/dataHealthEngine.ts`
- `src/engines/sessionHistoryEngine.ts`
- `src/presenters/recordPresenter.ts`
- `tests/dataHealthEngine.test.ts`

Acceptance criteria:
- Detect empty completed sessions, test/excluded data, missing set type, suspicious health imports, duplicate-looking imports, and impossible dates.
- Output suggestions only; no delete, exclude, restore, or edit happens automatically.
- Record can later surface these suggestions without becoming a settings/backup page.

Out of scope:
- Changing history editing behavior.
- Changing PR/e1RM/effectiveSet calculations.

### P0-011: Implement setAnomalyEngine

Priority: P0

Goal:
Detect likely set-entry mistakes in active and historical sessions.

Files likely involved:
- `src/engines/setAnomalyEngine.ts`
- `src/features/TrainingFocusView.tsx` if surfacing a compact warning later
- `src/features/RecordView.tsx` if surfacing historical edit suggestions later
- `tests/setAnomalyEngine.test.ts`

Acceptance criteria:
- Detect likely kg/lb mismatch, missing reps/weight, extreme jumps, duplicated sets, and warmup/working classification risk.
- Suggestions open existing edit/review flows but do not apply corrections automatically.
- Warmup groups are not treated as PR/e1RM/effectiveSet contributors by this engine.

Out of scope:
- New training algorithms.
- Automatic correction.

### P0-012: Implement dailyTrainingAdjustmentEngine

Priority: P0

Goal:
Convert existing readiness, health, pain, technique, load feedback, and training level signals into short daily coaching guidance.

Files likely involved:
- `src/engines/dailyTrainingAdjustmentEngine.ts`
- `src/engines/recommendationTraceEngine.ts`
- `src/presenters/recommendationExplanationPresenter.ts`
- `tests/dailyTrainingAdjustmentEngine.test.ts`

Acceptance criteria:
- Explain normal/conservative/recovery-focused daily stance in 1-2 short Chinese reasons.
- Do not recalculate readiness or change progression rules.
- Do not automatically skip or reduce a workout.

Out of scope:
- Changing readinessEngine.
- Changing progressionRulesEngine.

### P0-013: Implement nextWorkoutScheduler

Priority: P0

Goal:
Recommend the next workout from existing plan order, recent normal history, readiness, and weekly prescription.

Files likely involved:
- `src/engines/nextWorkoutScheduler.ts`
- `src/engines/sessionBuilder.ts`
- `src/presenters/todayPresenter.ts`
- `tests/nextWorkoutScheduler.test.ts`

Acceptance criteria:
- Same input returns the same next workout.
- Completed state uses one next workout source.
- Does not switch selectedTemplateId or start sessions automatically.
- Reasons use Chinese template names via formatter.

Out of scope:
- Rewriting the plan system.
- Auto-applying program adjustments.

### P0-014: Implement coachAutomationEngine aggregator

Priority: P0

Goal:
Combine P0 suggestions into a deduplicated, surface-aware report.

Files likely involved:
- `src/engines/coachAutomationEngine.ts`
- `src/presenters/coachAutomationPresenter.ts`
- `tests/coachAutomationEngine.test.ts`

Acceptance criteria:
- Today receives daily and next-workout suggestions.
- Focus receives only current training/action suggestions.
- Record receives data health and edit-review suggestions.
- Plan receives program-review suggestions without bypassing preview/confirm/rollback.
- No automatic writes to protected AppData fields.

Out of scope:
- Persistent dismissal state unless explicitly added later.

### P1-015: Implement smartReplacementEngine

Priority: P1

Goal:
Rank replacement options with coach-style reasons while reusing existing replacementEngine IDs and boundaries.

Files likely involved:
- `src/engines/smartReplacementEngine.ts`
- `src/engines/replacementEngine.ts`
- `src/features/TrainingFocusView.tsx`
- `tests/smartReplacementEngine.test.ts`

Acceptance criteria:
- Uses real exercise IDs only.
- Explains why an option is better for pain, equipment, fatigue cost, or movement pattern.
- Does not apply replacement until the user confirms.
- Does not merge original and actual exercise PR/e1RM.

Out of scope:
- Synthetic exercise creation.
- New replacement data model.

### P1-016: Suggestion dismissal and review history

Priority: P1

Goal:
Allow users to dismiss suggestions locally without adding backend or cloud sync.

Files likely involved:
- `src/storage/persistence.ts`
- `src/models/training-model.ts`
- `src/engines/coachAutomationEngine.ts`
- `tests/persistence.test.ts`

Acceptance criteria:
- Dismissed suggestions do not reappear for the same stable suggestion id.
- Dismissal is local-only.
- No suggestion dismissal deletes or edits training data.

Out of scope:
- Accounts or sync.

## P0-001: 建立前端治理文档基线

任务编号: P0-001

优先级: P0

任务目标:
Create and maintain the frontend governance docs so future agents can work from the same structure and boundaries.

涉及文件:
- `FRONTEND_PLAN.md`
- `UI_SPEC.md`
- `COMPONENT_GUIDE.md`
- `ROUTES.md`
- `TASKS.md`
- `CHANGELOG.md`
- `API_CONTRACT.md`

验收标准:
- Each required governance file exists at repo root.
- Page responsibilities match the five-tab product IA.
- The docs state that current data is local-first and no backend API exists.
- `CHANGELOG.md` records the documentation baseline.

不允许修改的范围:
- `package.json`
- `src/**`
- `tests/**`

## P0-002: 守住当前主导航契约

任务编号: P0-002

优先级: P0

任务目标:
Keep the five primary navigation entries stable and prevent accidental reintroduction of primary `progress` or `assessment` tabs.

涉及文件:
- `src/App.tsx`
- `src/ui/AppShell.tsx`
- `src/ui/BottomNav.tsx`
- `tests/navigationStructure.test.ts`
- `tests/appShellNavigationStructure.test.ts`

验收标准:
- Primary nav remains 今日 / 训练 / 记录 / 计划 / 我的.
- Assessment remains a secondary profile section.
- Record remains the owner of history/calendar/PR/stats/data.
- Existing navigation tests pass.

不允许修改的范围:
- Training engine logic.
- Persistence schema.
- Plan adjustment workflow.

## P1-003: 打磨记录页数据管理体验

任务编号: P1-003

优先级: P1

任务目标:
Polish the 记录 page as the owner of training-record data quality without absorbing global backup/restore or settings.

涉及文件:
- `src/features/RecordView.tsx`
- `src/presenters/recordPresenter.ts`
- `src/engines/sessionHistoryEngine.ts`
- `tests/recordLayout.test.ts`
- `tests/recordView.test.ts`
- `tests/sessionHistory.test.ts`

验收标准:
- Calendar remains the default entry.
- History detail, edit, delete, test/excluded, and restore-normal flows are understandable.
- Confirmation copy states statistical impact for destructive/excluding actions.
- No health import, unit settings, or global backup/restore appears as primary record content.

不允许修改的范围:
- `src/features/ProfileView.tsx` except for link text if strictly necessary.
- Program adjustment engines.
- Exercise library data.

## P1-004: 训练 Focus Mode 可靠性检查

任务编号: P1-004

优先级: P1

任务目标:
Verify and polish the mobile workout execution path from start to completion.

涉及文件:
- `src/features/TrainingFocusView.tsx`
- `src/features/TrainingView.tsx`
- `src/ui/WorkoutActionBar.tsx`
- `src/ui/BottomSheet.tsx`
- `src/ui/Toast.tsx`
- `src/engines/workoutExecutionStateMachine.ts`
- `src/engines/focusModeStateEngine.ts`
- `tests/workoutExecutionFlow.integration.test.ts`
- `tests/trainingFocusInteraction.test.ts`
- `WORKOUT_EXECUTION_QA.md`

验收标准:
- Completing warmup/main/support steps advances in the expected order.
- Set draft, replacement, discomfort, technique quality, and rest timer survive refresh.
- Finish/discard flows use one clear confirmation path where needed.
- Mobile CTA/action bar is not covered by bottom safe area.

不允许修改的范围:
- Plan page IA.
- Record statistics calculations unless a failing execution bug requires it.
- Backup/restore behavior.

## P1-005: 计划调整说明与回滚复查

任务编号: P1-005

优先级: P1

任务目标:
Keep future-plan mutation low risk by improving the preview/confirm/apply-by-copy/rollback decision surface.

涉及文件:
- `src/features/PlanView.tsx`
- `src/features/RecordView.tsx` if adjustment review remains surfaced there
- `src/engines/programAdjustmentEngine.ts`
- `src/engines/adjustmentReviewEngine.ts`
- `src/engines/weeklyCoachActionEngine.ts`
- `src/engines/explainability/adjustmentExplainability.ts`
- `tests/programAdjustmentEngine.test.ts`
- `tests/programAdjustmentWorkflow.integration.test.ts`
- `tests/planLayout.test.ts`

验收标准:
- Suggestions include reason and impact.
- Applying a suggestion creates or switches to an experimental template without overwriting the source template.
- Rollback switches active template back and states that completed workout records are preserved.
- Stale draft behavior remains blocked.

不允许修改的范围:
- Today's primary training decision surface.
- Health import.
- Global backup/restore.

## P2-006: 组件迁移清理

任务编号: P2-006

优先级: P2

任务目标:
Gradually migrate touched surfaces away from legacy `src/ui/common.tsx` without broad rewrites.

涉及文件:
- Touched `src/features/*View.tsx`
- `src/ui/*.tsx`
- `tests/uiMigrationGuard.test.ts`
- `tests/sharedUiComponents.test.ts`
- `tests/uiComponents.test.ts`

验收标准:
- Touched primary pages use split primitives such as `PageHeader`, `PageSection`, `Card`, `ActionButton`, `StatusBadge`.
- No duplicate primitive is added when an existing one works.
- Tests confirm key pages do not regress to legacy page shells.

不允许修改的范围:
- Business engines.
- Storage schema.
- Unrelated feature pages.

## P2-007: 健康数据导入边界清理

任务编号: P2-007

优先级: P2

任务目标:
Keep health import clearly inside 我的 while making its training impact transparent and non-medical.

涉及文件:
- `src/features/ProfileView.tsx`
- `src/features/HealthDataPanel.tsx`
- `src/engines/healthImportEngine.ts`
- `src/engines/appleHealthXmlImportEngine.ts`
- `src/engines/healthSummaryEngine.ts`
- `tests/healthImportEngine.test.ts`
- `tests/appleHealthXmlImportEngine.test.ts`
- `tests/healthDataIntegrationFlow.test.ts`

验收标准:
- Health import remains manual file import only.
- Copy states Apple Health/Watch data is used for readiness/activity context, not diagnosis.
- Imported external workouts do not become IronPath strength sessions.
- The page does not expose health import inside 记录 or 计划.

不允许修改的范围:
- Workout logging flow.
- Plan adjustment workflow.
- Backend/API assumptions.

## P3-008: 真实 URL 路由设计预研

任务编号: P3-008

优先级: P3

任务目标:
Design, but do not implement, a future URL routing layer if shareable/deep-linkable pages become necessary.

涉及文件:
- `ROUTES.md`
- `FRONTEND_PLAN.md`
- potential future design note under `docs/`

验收标准:
- Proposed URL map preserves current five primary page responsibilities.
- The design covers refresh behavior, local state restoration, and Vercel SPA rewrite compatibility.
- No runtime dependency is added during the spike.

不允许修改的范围:
- `src/App.tsx`
- `package.json`
- `vercel.json`
