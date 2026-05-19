# UI-OS 3 — Codex App Shell Integration V1

UI-OS 3 integrates the real IronPath app shell. This is shell integration, not a full page redesign.

## Baseline Evidence

- UI-OS 2B complete.
- PR #274.
- Merge commit `181e36d355c01fcd1ebb207b9d7cd5fabbf889db`.
- npm test passed: 1102 files / 4497 tests.
- dist token scan clean.
- The UI-OS 2B prototype remained isolated before UI-OS 3.

## What UI-OS 3 Adds

- `MobileAppShell` for the production app shell.
- `BottomNav` for the five-tab mobile navigation.
- `PageContainer` for the shell content and auxiliary layout.
- `AppTopBar` for the top status area.
- `LocalFirstSafetyStrip` for local-first safety copy.
- Five-tab app shell integration: Today / Train / History / Progress / Settings.
- Existing pages are preserved inside the shell.
- existing pages are preserved inside the shell.

## What UI-OS 3 Does Not Do

- No full Today redesign.
- No full Train / Focus Mode redesign.
- No full History redesign.
- No full Progress redesign.
- No full Settings redesign.
- No training algorithm change.
- no training algorithm change.
- No warmup algorithm change.
- No PR/e1RM/effective-set calculation change.
- No source-of-truth change.
- no source-of-truth change.
- No persistence change.
- no persistence change.
- No cloud sync.
- No route change.
- no route change.
- No package dependency change.
- no package dependency change.

## Integration Summary

- Today / 今日 maps to the existing `TodayView`.
- Train / 训练 maps to the existing `TrainingFocusView` or `TrainingView`.
- History / 历史 maps to the existing `RecordView` history/calendar/data sections.
- Progress / 进步 maps to the existing `RecordView` stats/PR sections by default.
- Progress also keeps the existing `PlanView` reachable through a secondary plan-adjustment mode for coach actions, adjustment drafts, and rollback.
- Settings / 设置 maps to the existing `ProfileView`; the existing `AssessmentView` remains reachable from Settings.
- `App.tsx` is wrapped by `MobileAppShell`.
- The old feature page contents remain temporarily inside the new shell; UI-OS 4 and later redesign the page interiors.
- The UI-OS 2 prototype files remain preview-only and are not imported by the production runtime.

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
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- no default cloud sync.
- no background sync.
- no production deployment auto-start.
- no external monitoring upload.
- no SaaS/multi-user runtime.
- no billing/public onboarding.
- no normalized training tables.
- no destructive migration.
- no real personal training data in automated tests.
- no new package/dependency/script/lockfile drift beyond Phase 12 `@supabase/supabase-js`.

## Accepted Browser Mutation Routes

1. POST /data-health/issues/:issueId/dismiss
2. POST /history/:id/data-flag
3. POST /history/:id/edit
4. POST /sessions/start
5. POST /sessions/active/patches
6. POST /sessions/active/complete
7. POST /sessions/active/discard

No eighth browser mutation route is added. POST /data-health/repair/apply remains blocked. backup/import/export over HTTP remains blocked. reset/recovery over HTTP remains blocked.

## Recommended Next Task

UI-OS 4 — Today / Train / Focus Mode Redesign V1 is recommended next.

UI-OS 4 is not started by UI-OS 3.
