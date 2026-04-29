# IronPath Changelog

All notable frontend governance and product-structure changes should be recorded here.

## 2026-04-28

- Added `COACH_AUTOMATION_PLAN.md` for Coach Automation V1 planning, including engine boundaries, confirmation rules, protected data, implementation order, and testing strategy.
- Added Coach Automation V1 backlog tasks for `dataHealthEngine`, `nextWorkoutScheduler`, `setAnomalyEngine`, `dailyTrainingAdjustmentEngine`, `smartReplacementEngine`, and `coachAutomationEngine`.

- Added frontend governance baseline: `FRONTEND_PLAN.md`, `UI_SPEC.md`, `COMPONENT_GUIDE.md`, `ROUTES.md`, `TASKS.md`.
- Added `API_CONTRACT.md` to document the current no-backend contract, localStorage persistence fields, backup import/export, health import boundaries, and program-adjustment mutation rules.
- Documented the current five-page IA: 今日, 训练, 记录, 计划, 我的.
- Documented that 计划 owns future plan/experimental template/rollback work, while 我的 owns settings/health import/backup and 记录 owns training-record management.
- No business implementation files or package files were intentionally changed.
