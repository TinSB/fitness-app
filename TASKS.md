# IronPath Frontend Tasks

Last updated: 2026-04-28

This backlog is ordered for multiple Codex conversations. Each task is scoped to minimize collisions and preserve current architecture.

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
