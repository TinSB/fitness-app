# IronPath Changelog

All notable frontend governance and product-structure changes should be recorded here.

## 2026-04-29

- Added `PLAN_PAGE_CLEANUP.md` to audit current Plan page sections, identify duplicate schedule/recommendation/draft/rollback surfaces, and define the target structure: current plan, weekly schedule, pending recommendations, and adjustment drafts.
- Added Plan Page Cleanup backlog tasks for view-model grouping, schedule-section consolidation, recommendation/draft de-duplication, and experimental-template rollback presentation.
- Confirmed this Plan audit pass is documentation-only and does not modify UI, training algorithms, engines, or data models.
- Added `COACH_ACTION_WORKFLOW.md` for Coach Action Workflow V1 planning, including the CoachAction contract, action types, status flow, confirmation/undo rules, active-session-only boundaries, Program Adjustment Preview handoff, follow-up tracking, implementation order, and testing strategy.
- Added Coach Action Workflow V1 backlog tasks for action contract/status flow, navigation-only actions, confirmation-gated active-session actions, Program Adjustment Preview handoff, local dismissal/undo, and outcome tracking.
- Confirmed this planning pass does not modify business logic, training algorithms, data models, or runtime UI.

## 2026-04-28

- Added `TRAINING_INTELLIGENCE_PLAN.md` for Training Intelligence V1 planning, including engine boundaries, display-only analysis, Program Adjustment Preview handoff rules, confirmation rules, protected core algorithms, implementation order, and testing strategy.
- Added Training Intelligence V1 backlog tasks for `sessionQualityEngine`, `recommendationConfidenceEngine`, `plateauDetectionEngine`, `volumeAdaptationEngine`, and `trainingIntelligenceSummaryEngine`.
- Added `COACH_AUTOMATION_PLAN.md` for Coach Automation V1 planning, including engine boundaries, confirmation rules, protected data, implementation order, and testing strategy.
- Added Coach Automation V1 backlog tasks for `dataHealthEngine`, `nextWorkoutScheduler`, `setAnomalyEngine`, `dailyTrainingAdjustmentEngine`, `smartReplacementEngine`, and `coachAutomationEngine`.

- Added frontend governance baseline: `FRONTEND_PLAN.md`, `UI_SPEC.md`, `COMPONENT_GUIDE.md`, `ROUTES.md`, `TASKS.md`.
- Added `API_CONTRACT.md` to document the current no-backend contract, localStorage persistence fields, backup import/export, health import boundaries, and program-adjustment mutation rules.
- Documented the current five-page IA: 今日, 训练, 记录, 计划, 我的.
- Documented that 计划 owns future plan/experimental template/rollback work, while 我的 owns settings/health import/backup and 记录 owns training-record management.
- No business implementation files or package files were intentionally changed.
