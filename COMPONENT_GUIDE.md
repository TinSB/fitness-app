# IronPath Component Guide

Last updated: 2026-04-28

## Directory Responsibilities

| Directory | Responsibility |
| --- | --- |
| `src/features` | Page-level feature components and page-specific composition. |
| `src/ui` | Reusable UI primitives shared across pages. |
| `src/ui/layouts` | Layout wrappers and reusable page layout structures. |
| `src/presenters` | View-model builders and page copy/section assertions. |
| `src/engines` | Pure business logic, calculations, state machines, recommendations, workflow engines. |
| `src/models` | TypeScript domain models and JSON schemas. |
| `src/storage` | Local persistence, migration, backup import/export. |
| `src/data` | Seed templates, exercise library, support modules, app config. |
| `src/content` | Evidence, definitions, professional copy, governance content. |
| `tests` | Unit, integration, layout, migration, navigation, and regression tests. |

## Naming Rules

- Page components: `*View.tsx`, for example `TodayView.tsx`.
- Shared UI components: PascalCase component name matching filename, for example `ActionButton.tsx`.
- Layout components: PascalCase in `src/ui/layouts`, for example `ResponsivePageLayout.tsx`.
- Engines: camelCase domain name plus `Engine.ts`, for example `programAdjustmentEngine.ts`.
- Presenters: page/domain name plus `Presenter.ts`.
- Tests: colocated under `tests`, named by behavior, for example `planLayout.test.ts`.

## Reuse First

Before adding a component, check these existing primitives:

- Page structure: `ResponsivePageLayout`, `PageHeader`, `PageSection`.
- Surfaces: `Card`, `MetricCard`, `ListItem`, `EmptyState`.
- Actions: `ActionButton`, `IconButton`, `WorkoutActionBar`.
- State/navigation: `SegmentedControl`, `StatusBadge`, `Toast`.
- Overlays: `BottomSheet`, `Drawer`, `ConfirmDialog`.
- Shell/navigation: `AppShell`, `BottomNav`, `SafeAreaHeader`.

Do not duplicate a component that can be expressed by composing these primitives. If a new primitive is truly needed, add it to `src/ui`, document its intended use here, and add a focused test.

## Legacy Common Module

`src/ui/common.tsx` still exists for older surfaces and compatibility. New or touched primary pages should prefer the split primitives in `src/ui/*.tsx`.

Current rule:

- Do not import legacy `Page`, `Stat`, `Card`, `ActionButton`, or `StatusBadge` from `src/ui/common.tsx` in newly touched main pages.
- If a page already uses legacy common helpers, migrate only the touched area unless the task explicitly asks for a page migration.
- Keep `HealthDataPanel` stable unless the task is specifically about health import UI.

## Feature Component Rules

- `src/features/*View.tsx` owns page composition and callback wiring.
- It may hold local UI state for tabs, drawers, sheets, pending confirmation, and selected items.
- It should not contain large calculation logic that belongs in `src/engines`.
- It should not silently mutate global app data without an explicit user action.
- When a feature needs derived display data, prefer a presenter or engine helper.

## Engine Rules

- Engines should be pure where practical.
- Engines should accept explicit inputs and return explicit results.
- Workflow engines should define state transitions up front.
- Do not duplicate analytics, e1RM, effective set, readiness, or weekly coaching calculations in UI code.
- Extend existing engines before adding a parallel summary helper.

Important existing engines:

- Workout execution: `workoutExecutionStateMachine.ts`, `focusModeStateEngine.ts`, `trainingCompletionEngine.ts`.
- Session creation/history: `sessionBuilder.ts`, `sessionHistoryEngine.ts`.
- Plan and weekly coaching: `supportPlanEngine.ts`, `weeklyCoachActionEngine.ts`, `programAdjustmentEngine.ts`, `adjustmentReviewEngine.ts`.
- Training analysis: `analytics.ts`, `e1rmEngine.ts`, `effectiveSetEngine.ts`, `explainabilityEngine.ts`, `src/engines/explainability/*`.
- Health import/readiness: `healthImportEngine.ts`, `appleHealthXmlImportEngine.ts`, `healthSummaryEngine.ts`, `readinessEngine.ts`.
- Units: `unitConversionEngine.ts`.

## Presenter Rules

Use `src/presenters` when page copy or section structure needs a stable view model that tests can assert.

Existing presenters:

- `todayPresenter.ts`
- `trainingPresenter.ts`
- `recordPresenter.ts`
- `planPresenter.ts`
- `profilePresenter.ts`

When changing page IA, update component, presenter, and layout tests together.

## Styling Rules

- Use Tailwind utility classes and existing `uiTokens`.
- Do not introduce CSS frameworks or new UI libraries without explicit approval.
- Use `lucide-react` for icons.
- Keep touch targets at least `min-h-11` for normal actions and `min-h-14` for primary mobile actions.
- Prefer existing tone vocabulary: slate, emerald, amber, rose, sky.
- Experimental templates should remain visually distinct, using amber styling and clear badges.

## Accessibility Rules

- Buttons must be real `<button type="button">` unless submitting a form intentionally.
- Tab-like controls should expose `role="tablist"` and `role="tab"` where implemented.
- Dialogs/sheets/drawers must use `role="dialog"` and `aria-modal="true"`.
- Icon-only controls require accessible labels or tooltips.
- Do not hide focus outlines globally; use focus-visible rings from existing buttons.

## Testing Rules

For UI/page changes, update or add tests near the impacted behavior:

- Navigation/shell: `appShellNavigationStructure.test.ts`, `appShellResponsiveLayout.test.ts`, `navigationStructure.test.ts`.
- Page layout: `todayLayout.test.ts`, `recordLayout.test.ts`, `planLayout.test.ts`, `profileLayout.test.ts`.
- Presenter copy: `presenterViewModels.test.ts`.
- Workflow: focused engine tests plus one integration test when app data changes.

Expected validation for implementation work:

```bash
npm run typecheck
npm test
npm run build
```

Documentation-only changes do not require the full suite unless they also change source or tests.

