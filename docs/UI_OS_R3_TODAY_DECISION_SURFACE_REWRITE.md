# UI-OS R3 — Today Decision Surface Rewrite V1

## Task Identity

UI-OS R3 is the Today Decision Surface Rewrite V1 implementation task. It rewrites the real Today page into the app entry decision surface while preserving existing data sources, training recommendations, planning logic, persistence, routes, and source-of-truth behavior.

## Baseline Evidence

- UI-OS R2 complete.
- PR #282.
- Merge commit `d3711d59ea320109d0e683e1fd77f3175a7a6c54`.
- `npm test` passed: 1125 files / 4586 tests.
- dist token scan clean.
- R2 completed the Focus Mode interaction state machine, one dominant Focus primary action, Focus bottom-sheet recording, end-workout confirmation, weight-only apply suggestion, and Focus Mode bottom-nav hiding.

## Problem Being Fixed

Today felt like content stacking. It did not clearly answer train/not train, what to train, recovery/fatigue status, whether an unfinished session exists, where to start, and whether a serious blocker must be handled first.

Data Health and diagnostics should not crowd the training decision. Today focus override should be medium priority rather than the whole page. Today must become a decisive training decision surface, not a developer diagnostic screen or dense dashboard.

## What R3 Adds

- A pure Today decision model/helper.
- A hero decision card for the top training conclusion.
- A readiness/fatigue summary framed as whether training is appropriate today.
- A medium-priority today focus override panel.
- An unfinished session notice when training is already active.
- Severe-risk-only Data Health surfacing on Today.
- A local-first safety strip with safe copy.

## Decision Model

The Today decision model resolves these states:

- `train_recommended`: normal condition; primary action is `开始今天训练`.
- `train_conservative`: readiness or fatigue suggests conservative training; copy should mention 保守训练 / 降低强度 / 保持重量.
- `recovery_recommended`: recovery is recommended; Today should not force a workout.
- `continue_unfinished`: an active or unfinished session exists; primary action is `继续训练`.
- `blocked_by_severe_risk`: only a severe blocker appears on Today; primary action is `查看严重问题`.
- `source_unclear`: data source is unclear; primary action is `回到本地模式`, not a cloud action.
- `no_plan_available`: no executable plan is available; user should inspect plan/settings before training.

The model returns `sourceOfTruthChanged: false`, `trainingAlgorithmChanged: false`, and `showFullDiagnostics: false`.

## Today Page Hierarchy

1. Decision hero.
2. Primary start/continue action.
3. Readiness/fatigue summary.
4. Medium-priority focus override.
5. Severe risk only.
6. Safety strip.

Today may keep lower-priority recommendation explanation, coach guidance, and training preview below the decision surface, but those cannot compete with the primary decision.

## Non-Goals

- No training algorithm change.
- No rotation/planning logic change.
- No today focus override semantics change.
- No source-of-truth change.
- No persistence change.
- No cloud sync.
- No default cloud sync.
- No background sync.
- No route change.
- No browser mutation route change.
- No package dependency change.
- No package script change.
- No lockfile change.
- No full Data Health page rewrite.
- No History/Progress/Settings rewrite.
- No prototype runtime import.

## Safety Boundaries

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- No eighth browser mutation route.
- `POST /data-health/repair/apply` remains blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.
- No default cloud sync.
- No background sync.
- No SaaS/multi-user runtime.
- No package/script/lockfile drift.
- No real personal training data in automated tests.

Accepted browser mutation routes remain exactly:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

## Recommended Next Task

UI-OS R4 — History Calendar & PR/e1RM Rewrite V1 is recommended next.

UI-OS R4 is not started by R3.
