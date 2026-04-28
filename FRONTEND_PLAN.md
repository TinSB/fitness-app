# IronPath Frontend Plan

Last updated: 2026-04-28

## Project Goal

IronPath is a mobile-first personal strength training PWA built with React, Vite, TypeScript, and Tailwind CSS. The product should feel like a restrained professional training app, not an admin dashboard or engineering demo.

The current product goal is to support a complete local-first training loop:

- Decide whether to train today and which session to start.
- Record a workout efficiently in Focus Mode or the full training view.
- Review historical sessions, PR/e1RM, statistics, and training-record data quality.
- Manage future training plans, templates, weekly recommendations, experimental templates, and rollback.
- Keep settings, screening, units, health data import, backup, and PWA/local-data explanation in one settings center.

## Current Stage

Stage: product-structure stabilization and feature completion.

The app already has the main page shell, five primary navigation entries, local persistence, schema validation, training engines, health import, plan adjustment workflow, and broad Vitest coverage. The next work should reduce IA drift, finish high-risk workflow polish, and keep UI changes scoped to the page that owns the user question.

Do not introduce a backend or cloud sync in this stage. Current data is browser-local and documented in `API_CONTRACT.md`.

## Page List

| Page | Route state | Component | Job to be done |
| --- | --- | --- | --- |
| 今日 | `activeTab = 'today'` | `src/features/TodayView.tsx` | Answer whether to train today, what to train, and where to start. |
| 训练 | `activeTab = 'training'` | `src/features/TrainingFocusView.tsx`, `src/features/TrainingView.tsx` | Record the current workout. Mobile defaults to Focus Mode when appropriate. |
| 记录 | `activeTab = 'record'` | `src/features/RecordView.tsx` | Review and manage past training records, calendar, PR/e1RM, stats, and record data flags. |
| 计划 | `activeTab = 'plan'` | `src/features/PlanView.tsx` | Manage future training: current template, cycle, training day templates, experimental templates, suggestions, rollback. |
| 我的 | `activeTab = 'profile'` | `src/features/ProfileView.tsx`, `src/features/AssessmentView.tsx` | Settings center: screening, units, health import, backup/restore, local-data explanation. |

## Core Functional Areas

- App shell and navigation: `src/App.tsx`, `src/ui/AppShell.tsx`, `src/ui/BottomNav.tsx`.
- Page components: `src/features/*.tsx`.
- Reusable UI primitives: `src/ui/*.tsx`, `src/ui/layouts/*.tsx`, `src/ui/designTokens.ts`.
- Pure training logic: `src/engines/*.ts`.
- View-model helpers: `src/presenters/*.ts`.
- Seed data and training libraries: `src/data/*.ts`, `src/content/*.ts`.
- Data contracts and persistence: `src/models/*.ts`, `src/models/*.schema.json`, `src/storage/*.ts`.
- Tests: `tests/*.test.ts`, `tests/explainability/*.test.ts`.

## Architecture Rules

1. Keep page ownership strict.
   - 今日: current decision and start/resume.
   - 训练: execution and workout logging.
   - 记录: completed history and training-record data management.
   - 计划: future plan, templates, suggestions, rollback.
   - 我的: settings, screening, units, health import, backup/restore.

2. Keep business logic in engines.
   - New training decisions, calculations, recommendations, persistence migration, and adjustment workflows belong in `src/engines`, `src/storage`, or `src/models`, not embedded directly in TSX.

3. Keep page mapping centralized.
   - Primary navigation remains in `src/App.tsx` through `navItems` and `activeTab`.
   - Do not add a new primary tab unless the product IA changes intentionally.

4. Keep risky mutations reversible.
   - Plan adjustment should keep preview -> confirm -> apply by copy -> rollback.
   - Restore/import/delete/test/excluded flows require explicit confirmation or clear review state.

5. Keep backend assumptions out.
   - There is no backend API in the current app.
   - Any future API, sync, or auth field must be added to `API_CONTRACT.md` before implementation.

## Development Order

1. Stabilize IA and docs.
   - Maintain `FRONTEND_PLAN.md`, `UI_SPEC.md`, `COMPONENT_GUIDE.md`, `ROUTES.md`, `TASKS.md`, `API_CONTRACT.md`, and `CHANGELOG.md`.

2. Fix page-level UX gaps.
   - Start with the page that owns the user problem.
   - Update layout tests and presenter tests with the component change.

3. Harden high-risk workflows.
   - Workout execution, backup/restore, history edits, plan adjustment, rollback, and health import need focused tests and confirmation copy.

4. Improve component consistency.
   - Prefer existing primitives before adding new components.
   - Migrate away from legacy `src/ui/common.tsx` only when touching an affected surface.

5. Run validation.
   - Use `npm run typecheck`, `npm test`, and `npm run build` for implementation work.
   - For documentation-only changes, at minimum verify files exist and no business files were modified by the documentation pass.

