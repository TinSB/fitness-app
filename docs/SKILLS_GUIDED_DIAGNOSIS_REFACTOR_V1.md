# Skills-Guided Diagnosis & Surgical Refactor V1

## Summary

This pass used the installed repo-local `mattpocock/skills` manually because slash commands are not directly invokable in this Codex environment. The work stayed bounded to diagnosis, small testable cleanup, and regression coverage.

Skills used:

- `/diagnose`
- `/grill-with-docs`
- `/zoom-out`
- `/to-issues`
- `/tdd`

No GitHub Issues were created. The issue list is captured in this document.

## What Was Inspected

- `src/App.tsx`
- `src/devApi/*`
- `src/ui/*` and `src/uiOs/*`
- `src/storage/*`
- `src/engines/*`
- `apps/api/src/*`
- `tests/*`
- `docs/*`
- `API_CONTRACT.md`
- `FULL_STACK_REFACTOR_PLAN.md`
- Installed skill setup files under `.agents/skills`, `skills-lock.json`, `AGENTS.md`, and `docs/agents/*`

## Confirmed Safe Boundaries

Confirmed safe boundaries:

- `localStorage` remains the default App runtime source and fallback/migration/emergency boundary.
- Accepted browser mutation routes remain exactly seven:
  - `POST /data-health/issues/:issueId/dismiss`
  - `POST /history/:id/data-flag`
  - `POST /history/:id/edit`
  - `POST /sessions/start`
  - `POST /sessions/active/patches`
  - `POST /sessions/active/complete`
  - `POST /sessions/active/discard`
- `POST /data-health/repair/apply` is not in the accepted browser mutation route allowlist.
- No default cloud sync, background sync, production backend auto-start, SaaS runtime, destructive migration, package drift, route expansion, or AppData schema drift was introduced.
- `actionableLoad` remains the user-facing/apply/validation baseline.
- `rawTheoreticalLoad` remains detail-only and is not the validation baseline.
- `ironpath:ui-theme` remains a UI-only localStorage key and is not part of AppData persistence.
- Focus immersive dark remains intentional while normal app pages retain light/dark/system theme support.

## Issues Found

Issues found:

### Medium - Legacy AppShell and BottomNav still existed after UI-OS migration

- Evidence: `src/App.tsx` imports `MobileAppShell`, but `src/ui/AppShell.tsx` and `src/ui/BottomNav.tsx` still existed. Static tests `mobileSafeAreaLayout.test.ts`, `realWorkoutRegression.test.ts`, and `sharedUiComponents.test.ts` inspected those legacy files for safe-area behavior even though production runtime no longer uses them.
- Affected files: `src/ui/AppShell.tsx`, `src/ui/BottomNav.tsx`, the three stale static tests.
- User impact: Future agents could get false confidence from tests covering a dead shell/nav implementation instead of the actual UI-OS runtime shell.
- Proposed fix: Remove the unused legacy shell/nav files and retarget static tests to `src/uiOs/MobileAppShell.tsx` and `src/uiOs/navigation/FloatingBottomNav.tsx`.
- Risk level: Low. Searches found no production imports of `src/ui/AppShell.tsx` or `src/ui/BottomNav.tsx`; the production app already uses UI-OS shell/nav.
- Fixed in this PR: yes.
- Deferred: no.

### Low - Historical docs contain multiple route-era narratives

- Evidence: `API_CONTRACT.md`, `FULL_STACK_REFACTOR_PLAN.md`, and older docs preserve earlier route-stage history while current regression locks use the seven-route allowlist.
- Affected files: historical docs and tests that intentionally preserve prior milestones.
- User impact: Broad text search can confuse current accepted browser routes with internal skeleton routes or older phase states.
- Proposed fix: Keep current constants and active regression tests as source of truth; defer any broad historical-doc rewrite to a dedicated archive cleanup task.
- Risk level: Medium for broad edits, low for deferral.
- Fixed in this PR: no.
- Deferred: yes.

### Low - Supabase package exists as an authorized candidate dependency

- Evidence: `package.json` includes `@supabase/supabase-js` and candidate-only cloud/auth modules exist under `src/cloudProduction/*`.
- Affected files: `package.json`, `src/cloudProduction/*`, candidate docs/tests.
- User impact: It can look like active cloud sync if read without the candidate-boundary docs, but current tests keep it disabled/candidate-only.
- Proposed fix: No runtime or dependency change in this task; keep candidate boundaries documented and tested.
- Risk level: Medium if changed casually.
- Fixed in this PR: no.
- Deferred: yes.

### Backlog Only - Legacy shared UI primitives remain for non-shell pages

- Evidence: normal feature pages still import shared primitives from `src/ui/*`, while UI-OS components live under `src/uiOs/*`.
- Affected files: `TrainingView`, `RecordView`, `PlanView`, `ProfileView`, `AssessmentView`, and shared primitives.
- User impact: Future theme/surface changes may need to touch both UI primitive layers.
- Proposed fix: Defer. These primitives are still used and already theme-aware in the current runtime; a migration would be broader than this task.
- Risk level: High for this PR scope.
- Fixed in this PR: no.
- Deferred: yes.

## Severity Classification

Severity classification:

- Blocker: none.
- High: none.
- Medium: legacy AppShell and BottomNav test drift - fixed.
- Low: historical route-era docs - deferred; Supabase candidate dependency clarity - deferred.
- Backlog only: broader shared primitive migration - deferred.

## Validation Notes

The targeted TDD loop first failed on the missing diagnosis doc and remaining legacy shell/nav files. After the bounded fix, the targeted test set is expected to pass before full validation.
