# IronPath Frontend Tasks

Last updated: 2026-04-29

This backlog is ordered for multiple Codex conversations. Each task is scoped to minimize collisions and preserve current architecture.

## Plan Page Cleanup Backlog

Planning source: `PLAN_PAGE_CLEANUP.md`

### P0-030: Reframe Plan page view model into four IA groups

Priority: P0

Goal:
Prepare the Plan page cleanup by grouping existing data into `currentPlan`, `weeklySchedule`, `pendingRecommendations`, and `adjustmentDrafts` without changing algorithms or adding new features.

Files likely involved:
- `src/features/PlanView.tsx`
- `src/presenters/planPresenter.ts`
- `tests/planPageCleanup.test.ts`

Acceptance criteria:
- Current plan, weekly schedule, pending recommendations, and adjustment drafts are separable in presenter/view-model naming.
- No training algorithm, template generation, or persistence behavior changes.
- Existing experiment-template apply and rollback flows remain intact.
- User-visible copy stays Chinese and avoids raw enum, internal id, `undefined`, or `null`.

Out of scope:
- New engines.
- New pages.
- Automatic plan changes.
- Data model changes.

### P0-031: Merge duplicate Plan schedule sections

Priority: P0

Goal:
Combine `本周训练日`, `训练日模板`, and `当前查看的训练日` into one future-facing `本周安排` flow.

Files likely involved:
- `src/features/PlanView.tsx`
- `src/presenters/planPresenter.ts`
- `tests/planPageCleanup.test.ts`

Acceptance criteria:
- Training-day names, template selection, and selected-day details appear as one coherent schedule area.
- The selected-day detail remains available without creating a separate competing section.
- No Focus Mode controls, history details, health import, or backup/restore content moves into Plan.

Out of scope:
- Changing template contents.
- Changing the next-workout scheduler.
- Adding new plan views.

### P0-032: De-duplicate Plan recommendations and drafts

Priority: P0

Goal:
Ensure the same plan-level issue does not appear simultaneously as a CoachAction, a training-volume suggestion, and a draft card.

Files likely involved:
- `src/features/PlanView.tsx`
- `src/presenters/coachActionPresenter.ts`
- `src/presenters/planPresenter.ts`
- `tests/coachActionPlanDraft.test.ts`
- `tests/planPageCleanup.test.ts`

Acceptance criteria:
- `待处理建议` contains only recommendations that have not become drafts.
- Generated drafts appear only under `调整草案`.
- Generated-draft actions change to `查看草案` or disappear from pending suggestions.
- View-only actions use secondary button semantics.
- Applying a draft still requires confirmation and creates an experimental template by copy.

Out of scope:
- New recommendation logic.
- Auto-applying drafts.
- Overwriting original templates.

### P1-033: Consolidate experimental template and rollback presentation

Priority: P1

Goal:
Make active experimental-template state visible in `当前计划`, while moving template history into a compact support role.

Files likely involved:
- `src/features/PlanView.tsx`
- `src/presenters/planPresenter.ts`
- `tests/experimentalTemplateApplyRollback.test.ts`

Acceptance criteria:
- `当前计划` clearly shows whether the active plan is original or experimental.
- Rollback remains visible when an experimental template is active.
- Version history remains available but does not duplicate the current-plan state.
- Rollback copy continues to state that completed training history is preserved.

Out of scope:
- Deleting experimental templates.
- Changing adjustment review algorithms.
- Changing completed history.

## Coach Action Workflow V1 Backlog

Planning source: `COACH_ACTION_WORKFLOW.md`

### P0-024: Define CoachAction contract and status flow

Priority: P0

Goal:
Create the shared action contract that turns existing coach analysis into reviewable, confirmable user actions.

Files likely involved:
- `src/engines/coachActionWorkflowEngine.ts`
- `src/presenters/coachActionPresenter.ts`
- `src/models/training-model.ts` only if a shared exported type is needed
- `tests/coachActionWorkflowEngine.test.ts`

Acceptance criteria:
- Defines `CoachAction`, `CoachActionStatus`, `CoachActionType`, source, target, risk, confirmation, undo, and tracking metadata.
- Action generation is pure and does not mutate `AppData`.
- High-risk actions are marked `requiresConfirmation`.
- Visible presenter text is Chinese and contains no raw enum, internal id, `undefined`, or `null`.
- Status transitions cover `pending`, `applied`, `dismissed`, `expired`, and `failed`.

Out of scope:
- Applying actions.
- Persistent dismissal.
- New backend or cloud sync.
- Changing training algorithms.

### P0-025: Implement navigation-only Coach Actions

Priority: P0

Goal:
Make low-risk actions open the right existing surface instead of appearing as inert advice.

Files likely involved:
- `src/App.tsx`
- `src/presenters/coachActionPresenter.ts`
- `src/features/TodayView.tsx`
- `src/features/RecordView.tsx`
- `src/features/ProfileView.tsx`
- `tests/coachActionRouting.test.ts`

Acceptance criteria:
- `review_data_health`, `review_session`, `review_exercise`, `review_plan_adjustment_preview`, and `navigate` actions route to existing pages/sections.
- Missing targets show a toast or inline message, not a silent no-op.
- Navigation actions do not require confirmation unless they lead into a separate destructive flow.
- No training data, history, or templates are changed.

Out of scope:
- Active session mutation.
- History edits.
- Plan preview generation.

### P0-026: Implement confirmation-gated active-session Coach Actions

Priority: P0

Goal:
Allow confirmed coach actions to affect only the current active session, never the original template.

Files likely involved:
- `src/engines/coachActionWorkflowEngine.ts`
- `src/engines/sessionBuilder.ts`
- `src/features/TrainingFocusView.tsx`
- `src/features/TodayView.tsx`
- `src/ui/ConfirmDialog.tsx`
- `tests/coachActionActiveSession.test.ts`

Acceptance criteria:
- Recovery override, temporary session adjustment, set anomaly confirmation, and replacement handoff all use ConfirmDialog where required.
- Temporary adjustments are recorded as session-only context.
- Original templates, programTemplate, mesocycle, and activeProgramTemplateId are not changed.
- Cancelled actions leave activeSession unchanged.
- Replacement uses existing originalExerciseId / actualExerciseId semantics.

Out of scope:
- Automatic plan changes.
- Automatically adding main sets.
- Rewriting replacementEngine.

### P0-027: Connect Coach Actions to Program Adjustment Preview

Priority: P0

Goal:
Convert high-confidence plan-level action candidates into existing Program Adjustment Preview drafts without applying them.

Files likely involved:
- `src/engines/coachActionWorkflowEngine.ts`
- `src/engines/programAdjustmentEngine.ts`
- `src/features/PlanView.tsx`
- `tests/coachActionPlanPreview.test.ts`

Acceptance criteria:
- `create_plan_adjustment_preview` creates or opens a preview/draft only.
- Preview shows reason, impact, confidence, before/after, and affected templates.
- Applying still uses existing confirm/apply-by-copy/rollback workflow.
- Original templates are preserved.
- Rollback copy still states completed history is preserved.

Out of scope:
- Direct plan overwrite.
- Automatic rollback.
- New program generation algorithm.

### P1-028: Add undo and local dismissal for Coach Actions

Priority: P1

Goal:
Reduce noise and make reversible temporary actions easier to control locally.

Files likely involved:
- `src/engines/coachActionWorkflowEngine.ts`
- `src/storage/persistence.ts`
- `src/features/TrainingFocusView.tsx`
- `src/features/TodayView.tsx`
- `tests/coachActionDismissUndo.test.ts`

Acceptance criteria:
- Dismissed local actions do not reappear for the same stable id.
- Temporary active-session actions can be undone before session completion where supported.
- Undo never deletes completed history.
- Dismissal and undo are local-only.

Out of scope:
- Cloud sync.
- Account-level preferences.
- Undoing historical edits directly.

### P1-029: Track Coach Action outcomes

Priority: P1

Goal:
Review whether applied coach actions helped, without auto-rollback or silent plan changes.

Files likely involved:
- `src/engines/coachActionWorkflowEngine.ts`
- `src/engines/trainingIntelligenceSummaryEngine.ts`
- `src/engines/adjustmentReviewEngine.ts`
- `tests/coachActionOutcomeTracking.test.ts`

Acceptance criteria:
- Applied temporary session actions can be reviewed through completion, pain, load feedback, and session quality.
- Applied plan previews can be reviewed through existing adjustment review metrics.
- Follow-up output is informational and can suggest review or rollback.
- No follow-up action auto-edits data or auto-rolls back plans.

Out of scope:
- New analytics algorithms.
- Automatic plan mutation.
- Medical diagnosis.

## Training Intelligence V1 Backlog

Planning source: `TRAINING_INTELLIGENCE_PLAN.md`

### P0-017: Implement sessionQualityEngine

Priority: P0

Goal:
Evaluate completed workout quality from saved session logs without changing PR, e1RM, effectiveSet, or history data.

Files likely involved:
- `src/engines/sessionQualityEngine.ts`
- `src/engines/sessionSummaryEngine.ts`
- `src/presenters/recordPresenter.ts`
- `tests/sessionQualityEngine.test.ts`

Acceptance criteria:
- Produces a session quality label and Chinese explanation.
- Uses existing effectiveSet results instead of redefining effective set logic.
- Separates warmup/support/working evidence correctly.
- Flags poor data confidence without editing or excluding records.
- Ignores test/excluded sessions for analytics-style quality conclusions.

Out of scope:
- Editing history.
- Changing e1RM/effectiveSet/readiness/progression/warmupPolicy.
- Applying plan changes.

### P0-018: Implement recommendationConfidenceEngine

Priority: P0

Goal:
Explain whether a recommendation is high, medium, or low confidence based on existing trace, data quality, history depth, readiness freshness, load feedback coverage, and training level confidence.

Files likely involved:
- `src/engines/recommendationConfidenceEngine.ts`
- `src/engines/recommendationTraceEngine.ts`
- `src/engines/dataHealthEngine.ts`
- `tests/recommendationConfidenceEngine.test.ts`

Acceptance criteria:
- Does not change the recommendation result.
- Outputs short Chinese confidence reasons.
- Low history depth and data health warnings reduce confidence conservatively.
- Same input produces the same confidence report.
- No visible raw enum, internal id, `undefined`, or `null`.

Out of scope:
- Rewriting recommendation logic.
- Changing readiness or training level calculation.
- Auto-fixing data health issues.

### P0-019: Implement trainingIntelligenceSummaryEngine read-only aggregation

Priority: P0

Goal:
Aggregate Training Intelligence findings into a surface-aware summary for Today, Training, Record, and Plan.

Files likely involved:
- `src/engines/trainingIntelligenceSummaryEngine.ts`
- `src/presenters/trainingIntelligencePresenter.ts`
- `tests/trainingIntelligenceSummaryEngine.test.ts`

Acceptance criteria:
- Aggregates session quality and recommendation confidence without adding new algorithms.
- Produces top 1-3 findings per surface.
- Clearly marks display-only findings vs Program Adjustment Preview candidates.
- Does not mutate AppData.
- Does not bypass existing Coach Automation or Program Adjustment confirmation flows.

Out of scope:
- Persistent dismissal state.
- Applying program adjustments.
- Large UI redesign.

### P0-020: Surface Training Intelligence display-only findings

Priority: P0

Goal:
Add minimal, non-dashboard UI surfacing for session quality and recommendation confidence.

Files likely involved:
- `src/features/TodayView.tsx`
- `src/features/RecordView.tsx`
- `src/features/PlanView.tsx`
- `src/presenters/trainingIntelligencePresenter.ts`
- `tests/trainingIntelligenceUi.test.ts`

Acceptance criteria:
- Today shows at most one recommendation confidence insight.
- Record session detail can show session quality.
- Plan can show preview candidate entry text without applying changes.
- All findings are dismissible or ignorable.
- No raw enum or technical log text appears in UI.

Out of scope:
- Focus Mode interruption.
- Applying or editing data.
- New dashboard page.

### P1-021: Implement plateauDetectionEngine

Priority: P1

Goal:
Detect possible or likely exercise plateaus conservatively from normal history and existing e1RM/performance signals.

Files likely involved:
- `src/engines/plateauDetectionEngine.ts`
- `src/engines/e1rmEngine.ts`
- `src/engines/loadFeedbackEngine.ts`
- `tests/plateauDetectionEngine.test.ts`

Acceptance criteria:
- Requires enough normal history before reporting a likely plateau.
- Does not use warmup, test, or excluded sets as performance evidence.
- Distinguishes plateau from pain/technique masking.
- Outputs Chinese evidence and confidence.
- Does not trigger deload or exercise replacement automatically.

Out of scope:
- Changing e1RM calculation.
- Automatic deload.
- Automatic template changes.

### P1-022: Implement volumeAdaptationEngine

Priority: P1

Goal:
Recommend muscle-level increase, maintain, decrease, or review directions using existing weekly volume, effective sets, session quality, recovery, adherence, pain, and load feedback.

Files likely involved:
- `src/engines/volumeAdaptationEngine.ts`
- `src/engines/weeklyVolumeEngine.ts`
- `src/engines/muscleContributionEngine.ts`
- `src/engines/programAdjustmentEngine.ts`
- `tests/volumeAdaptationEngine.test.ts`

Acceptance criteria:
- Produces Chinese muscle-level reasons and impacts.
- Uses existing effectiveSet and muscle contribution outputs.
- Does not use test/excluded history.
- Candidates can enter Program Adjustment Preview but are not applied.
- Conservative when data is sparse or confidence is low.

Out of scope:
- Rewriting the plan system.
- Changing progression or warmupPolicy.
- Auto-overwriting templates.

### P1-023: Connect Training Intelligence to Program Adjustment Preview

Priority: P1

Goal:
Allow high-confidence plateau and volume adaptation findings to become reviewable Program Adjustment Preview candidates.

Files likely involved:
- `src/engines/trainingIntelligenceSummaryEngine.ts`
- `src/engines/programAdjustmentEngine.ts`
- `src/features/PlanView.tsx`
- `tests/trainingIntelligenceProgramPreview.test.ts`

Acceptance criteria:
- Candidates include reason, evidence, expected impact, and confidence.
- Existing preview / confirm / apply-by-copy / rollback workflow remains intact.
- No candidate is applied automatically.
- One-off low-confidence findings remain display-only.
- Rollback copy still states history and completed records are preserved.

Out of scope:
- New mutation flow.
- Backend review jobs.
- Automatic deletion or history edits.

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
