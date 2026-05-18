# Equipment-Aware Training Recommendation Display V1

## Task identity

Task 17D — Equipment-Aware Training Recommendation Display V1.

This is a display/presentation layer for personal-only equipment-aware recommendation copy. It does not change the training algorithm.

Task 17D preserves no training algorithm change.

## Baseline evidence

Task 17C complete:

- PR #265
- Merge commit `9253382ec4bf9e02ad90a63406c5d9874c624053`
- npm test passed: 1085 files / 4411 tests
- dist token scan clean

Task 17C added exercise equipment default profiles and mapping. Task 17D uses those defaults with the Task 17B feasible load engine for owner-facing display labels.

## Non-goals

Task 17D does not:

- change training algorithm
- change warmup algorithm directly
- change PR/e1RM/effective-set calculations
- change source-of-truth behavior
- migrate historical workout data
- add routes
- add cloud sync
- add package/dependency/script/lockfile changes
- integrate into `App.tsx`
- modify live session mutation payloads

## What Task 17D adds

- equipment-aware recommendation display helper
- feasible load display result
- owner-friendly copy labels
- presentational display component
- no live UI integration in this task because current training display surfaces also own active session mutation flows

The helper converts a theoretical recommendation weight into a feasible display weight. The theoretical recommendation remains available internally, and the displayed feasible load does not mutate training logic.

## Real-world fixes

- Bench theoretical 17 lb warmup displays empty Olympic bar 45 lb.
- Barbell displays total + per-side plates.
- Dumbbell displays per-hand weight.
- Smith machine displays 25 lb bar default.
- Selectorized machines display machine stack values.
- Plate-loaded machines support base/sled weight warnings.
- Unknown/custom exercises fall back safely.

## Display examples

| Scenario | Display |
| --- | --- |
| Bench Press warmup 17 lb | 空杆 45 lb |
| Bench Press 135 lb | 135 lb total / 每边 45 lb |
| Bench Press 115 lb | 115 lb total / 每边 35 lb / 每边 25 + 10 |
| Smith Machine Squat 95 lb | Smith bar 25 + 每边 35 lb |
| Dumbbell Bench 42 lb | 40 or 45 lb each hand depending readiness / 每只手 40 或 45 lb |
| Lat Pulldown 52 lb with stack options | nearest stack option / 插片重量 |
| Plate-loaded with unknown base | warning that base not included / 器械自重未计入 |

## Safety explanation

- theoretical recommendation remains available internally
- feasible display does not mutate training logic
- source-of-truth is unchanged
- historical data is not migrated
- this is a display/presentation layer
- `sourceOfTruthChanged` remains false
- `trainingAlgorithmChanged` remains false

## Recommended next tasks

- Task 17E — Equipment Profile Editing UX V1
- Task 17F — Phase 17 Equipment-Aware Load Model Archive V1

Task 17E is recommended next. Task 17E is not started by Task 17D.

## Preserved safety boundaries

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- api-primary-dev remains dev/local only and not production-ready.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- no default cloud sync.
- no background sync.
- no production deployment auto-start.
- no external monitoring upload.
- no SaaS/multi-user runtime.
- no normalized training tables.
- no destructive migration.
- no real personal training data in tests.
- no new package/dependency/script/lockfile drift beyond Phase 12 authorized `@supabase/supabase-js`.

## Accepted browser mutation route inventory

Exactly seven browser mutation routes remain accepted:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

No eighth browser mutation route was added. `POST /data-health/repair/apply` remains blocked. backup/import/export over HTTP remains blocked. reset/recovery over HTTP remains blocked.
