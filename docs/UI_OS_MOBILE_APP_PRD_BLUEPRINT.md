# Task UI-OS 1 — IronPath Mobile App Operating System PRD & Blueprint V1

## 1. Task identity

- Task UI-OS 1.
- IronPath Mobile App Operating System PRD & Blueprint V1.
- This task is docs/static tests only.
- This task is product/design planning only.

## 2. Baseline evidence

- Phase 17 equipment-aware load model work is complete.
- Task 17H complete: Equipment-Aware Primary Prescription & Apply Suggestion Fix V1.
- Task 17H PR #271.
- Task 17H merge commit: `33c0d1256f4656f9c99af409db2dccec13652497`.
- Task 17H validation: npm test passed `1098 files / 4475 tests`.
- Task 17H validation: dist token scan clean.
- Vercel npm lockfile fix complete.
- Vercel fix PR #270.
- Vercel fix merge commit: `fc2bacb9868886950c53cc78b98487ececefe9b5`.
- `pnpm-lock.yaml` removed.
- npm/package-lock path is the expected deploy path, with `package-lock.json` as the npm lockfile.

## 3. Product context

IronPath is now personal-only, not SaaS. SaaS is deferred. IronPath is a personal professional training system, and the goal is a mobile-first app the owner wants to use every workout.

The UI redesign is not cosmetic only. It is a full mobile training operating system redesign that should make the existing training logic, Focus Mode, history, progress, data health, backup/recovery, emergency local mode, backend/cloud candidate controls, and equipment-aware feasible load model feel like one coherent app.

## 4. Current product problems

- Page/entry complexity makes the product feel like an engineering project.
- Training flow visual hierarchy does not make the current action obvious enough.
- Too much engineering language leaks into daily training screens.
- Professional metrics are not yet fully translated into human-readable guidance.
- Backup / recovery / cloud candidate status is not simple enough.
- Equipment-aware weight display must be first-class in training UI.
- The owner needs fast gym operation, not technical dashboards.

## 5. Product goals

- Open app to training start in 10 seconds or less.
- open app to training start in 10 seconds or less.
- Record a set in 5 seconds or less.
- record a set in 5 seconds or less.
- Complete workout in 15 seconds or less after final set.
- complete workout in 15 seconds or less after final set.
- Source-of-truth confusion = 0.
- Accidental cloud operation = 0.
- Data loss = 0.
- Equipment-aware recommendation is visible and understandable.
- The user can answer:
  - what am I training today?
  - what set am I on?
  - what weight should I actually use?
  - how is this weight loaded?
  - where is my data?
  - how do I recover if something goes wrong?

## 6. Product principles

- mobile-first.
- training-first.
- local-first.
- feasible load over theoretical load.
- actionable over informational.
- Chinese-first UI copy.
- safe by default.
- personal-only, not SaaS.

## 7. Main navigation model

Primary bottom navigation:

1. Today / 今日
2. Train / 训练
3. History / 历史
4. Progress / 进步
5. Settings / 设置

Rules:

- Today / Train / History / Progress / Settings are the five primary tabs.
- Use no more than five primary tabs.
- High-risk settings belong in Settings.
- Training flow must not be polluted by cloud/SaaS/system internals.

## 8. Page responsibilities

### Today

- daily recommendation.
- today focus override.
- recovery/readiness summary.
- last related workout.
- active/unfinished session notice.
- start training action.
- local data safety status.

### Train

- active workout / Focus Mode.
- current exercise.
- current set.
- recommendation prescription.
- equipment-aware load display.
- actual set input.
- apply suggestion.
- complete set.
- substitute exercise.
- mark discomfort.

### History

- recent workouts.
- date grouping.
- exercise history.
- quick confirmation that training was recorded.
- anomaly/data-health hints.

### Progress

- PR / e1RM.
- volume.
- effective sets.
- readiness/recovery explanation.
- human-readable training trend summary.

### Settings

- units.
- backup / recovery.
- emergency local.
- equipment profiles.
- cloud candidate.
- diagnostics.
- about / data safety.

## 9. Training flow blueprint

1. Open app.
2. Review Today.
3. Start or continue workout.
4. Enter Focus Mode.
5. View current exercise.
6. View current set.
7. View equipment-aware recommendation.
8. Apply suggestion.
9. Record actual set.
10. Complete set.
11. Handle interruption/unfinished session.
12. Complete workout.
13. Review summary.

## 10. Equipment-aware load display spec

Equipment-aware load display spec requirements:

- Bench warmup theoretical 17 lb to empty Olympic bar 45 lb.
- Bench warmup theoretical `17 lb` -> primary display empty Olympic bar `45 lb`.
- Bench `135 lb` -> `135 lb total / 每边 45 lb`.
- Bench `115 lb` -> `每边 25 + 10`.
- Smith machine -> `25 lb` bar default.
- Dumbbell -> each hand / 每只手.
- Selectorized machine -> machine stack / 插片.
- Plate-loaded -> per-side plates + base/sled warning.
- Unknown/custom -> safe fallback warning.

Rules:

- Primary display uses feasible load.
- Theoretical load can remain in details only.
- Apply suggestion must use feasible load.
- User should see one actionable weight, not conflicting numbers.

## 11. Core component inventory

### App shell

- MobileAppShell.
- BottomNav.
- TopStatusBar.
- PageContainer.

### Training components

- TodayRecommendationCard.
- TrainingFocusCard.
- SetPrescriptionCard.
- EquipmentAwareLoadDisplay.
- ActualSetInputCard.
- CompleteSetButton.
- ApplySuggestionButton.
- SubstituteExerciseButton.
- DiscomfortButton.
- ActiveSessionNotice.

### Safety components

- DataSourceBadge.
- BackupReadinessBadge.
- EmergencyLocalNotice.
- RollbackKillSwitchPanel.
- CloudCandidateStatusCard.
- DiagnosticsSummaryCard.

### General UI

- PrimaryCard.
- MetricCard.
- StatusBadge.
- InlineWarning.
- EmptyState.
- RecoveryNotice.
- ActionButton.
- DangerButton.

## 12. Visual direction

- dark sports UI.
- high contrast.
- card-based layout.
- large readable typography.
- strong primary action.
- low-friction mobile tap targets.
- reduced clutter during training.
- settings can be denser than training screens.

Color semantics:

- green: safe / completed / local available.
- yellow: caution / needs review.
- red: stop / emergency / dangerous.
- blue: info / details.
- gray: disabled / unavailable / unconfigured.

## 13. Copy principles

- Chinese-first.
- simple wording.
- professional terms require explanation.
- avoid empty phrases like "smart optimized".
- high-risk operations must state what will and will not happen.
- no automatic sync language.
- no SaaS overclaim.
- no cloud push success unless explicitly confirmed.

## 14. Backup / recovery / cloud candidate UX rules

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud candidate remains optional/manual.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch must be visible in safety settings.
- rollback / kill switch remains available.
- emergency local mode must be understandable.
- emergency local mode remains available.
- no cloud controls should appear as casual sync buttons.

## 15. v0 scope

v0 should create:

- visual app shell.
- bottom navigation.
- mobile-first layouts.
- page mockups.
- card system.
- status badge visuals.
- training flow mock.
- equipment-aware load mock.
- settings architecture mock.

v0 must not:

- implement real training logic.
- implement persistence.
- modify source-of-truth.
- implement cloud sync.
- implement backend logic.
- add real data mutations.

## 16. Codex scope

Codex should:

- integrate v0 UI into existing React/Vite app.
- connect existing AppData / training engines.
- connect equipment-aware display helpers.
- preserve regression tests.
- keep localStorage boundaries.
- protect source-of-truth.
- run validation/build/tests.
- fix imports and type errors.
- avoid algorithm changes unless explicitly scoped.

Codex must not:

- rewrite training algorithms.
- change source-of-truth.
- remove emergency local / backup safety.
- enable default cloud sync.
- add SaaS runtime.

## 17. Implementation phase plan

- UI-OS 2 — v0 App Shell & Design System Prototype: v0 creates visual shell and mock pages.
- UI-OS 3 — Codex App Shell Integration: Codex integrates shell safely into app.
- UI-OS 4 — Today / Train / Focus Mode Redesign: focus on real workout use.
- UI-OS 5 — History / Progress / Data Health Redesign: focus on review and understanding.
- UI-OS 6 — Settings / Safety / Equipment Profile Redesign: focus on configuration and safety controls.

UI-OS 2 is recommended next. UI-OS 2 is not started by UI-OS 1.

## 18. Hard safety boundaries

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- api-primary-dev remains dev/local only and not production-ready.
- devApiRunner is not production backend.
- service role key must never enter browser.
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
- no new package/dependency/script/lockfile drift beyond Phase 12 authorized `@supabase/supabase-js`.

## 19. Accepted browser mutation route inventory

Accepted browser mutation routes remain exactly seven:

1. POST /data-health/issues/:issueId/dismiss
2. POST /history/:id/data-flag
3. POST /history/:id/edit
4. POST /sessions/start
5. POST /sessions/active/patches
6. POST /sessions/active/complete
7. POST /sessions/active/discard

Blocked:

- no eighth browser mutation route.
- POST /data-health/repair/apply remains blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.

## 20. Success criteria

- app to training start <= 10 seconds.
- set logging <= 5 seconds.
- workout completion <= 15 seconds.
- source-of-truth confusion = 0.
- accidental cloud operation = 0.
- data loss = 0.
- primary training weight is feasible and equipment-aware.
- user can recover if something goes wrong.

## 21. Final statement

- UI-OS 1 does not start UI-OS 2.
- No UI runtime was implemented.
- No v0 code was added.
- Personal-only direction remains active.
- SaaS remains deferred.
