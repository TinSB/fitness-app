# Equipment-Aware Load Model & Feasible Weight Engine V1

## Task Identity

- Task 17B.
- Equipment-Aware Load Model & Feasible Weight Engine V1.
- Implementation pack.
- Pure model / pure engine only.

## Baseline Evidence

- Task 17A complete.
- PR #263.
- Merge commit: `0cb0021c0444afeeedda8b2be902a319fe3e6f17`.
- `npm test` passed: 1080 files / 4375 tests.
- dist token scan clean.
- Task 17A opened equipment-aware load model gate.

## Non-Goals

Task 17B does not:

- Modify App.tsx.
- Modify live recommendation UI.
- Modify training algorithm.
- Modify warmup algorithm directly.
- Modify PR/e1RM/effective-set calculations.
- Migrate historical workout data.
- Change source-of-truth behavior.
- Add routes.
- Add cloud sync.
- Add background sync.
- Connect to Supabase.
- Add package/dependency/script/lockfile changes.

## What Task 17B Adds

- EquipmentKind model.
- LoadDisplayMode model.
- EquipmentProfile model.
- FeasibleLoadInput / FeasibleLoadResult.
- Plate breakdown.
- Feasible load engine.
- Default Olympic bar / Smith / dumbbell / selectorized / plate-loaded profiles.
- Readiness-aware rounding.
- Stable reason categories for load changes and warnings.
- Pure browser-compatible helpers with no side effects.

## Real-World Fixes

- Bench warmup 17 lb now resolves to 45 lb empty Olympic bar.
- Smith machine default bar is 25 lb.
- Dumbbells are per-hand with 5 lb increment.
- Barbell recommendations use 2.5 / 5 / 10 / 25 / 45 lb plates.
- Selectorized machines use machine-specific options.
- Plate-loaded machines support optional base/sled weight.
- The engine distinguishes theoretical weight from feasible gym load.
- The result explains whether rounding was caused by available plates, dumbbell increment, machine stack options, readiness bias, minimum bar weight, or base machine weight handling.

## How This Should Be Used Later

- Task 17B creates pure engine only.
- Later tasks should connect this to exercise defaults and recommendation display.
- Historical data must not be migrated by this task.
- UI integration belongs later.
- Existing training algorithms should keep producing their current theoretical outputs until a later display/integration task explicitly opts into this feasible load layer.

## Recommended Next Tasks

- Task 17C — Exercise Equipment Profile Defaults V1.
- Task 17D — Equipment-Aware Training Recommendation Display V1.
- Task 17E — Equipment Profile Editing UX V1.
- Task 17F — Phase 17 Equipment-Aware Load Model Archive V1.

Task 17C is recommended next.

Task 17C is not started by Task 17B.

## Preserved Safety Boundaries

- localStorage remains default/fallback/migration/emergency.
- localStorage remains default / fallback / migration / emergency.
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

## Accepted Browser Mutation Route Inventory

Accepted browser mutation routes remain exactly:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

- No eighth browser mutation route was added.
- `POST /data-health/repair/apply` remains blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.

## Final Statement

- Task 17B does not start Task 17C.
- Task 17B does not authorize UI integration.
- Task 17B does not change training algorithm output.
- Task 17B does not change warmup algorithm output directly.
- Task 17B does not change source-of-truth behavior.
- SaaS remains deferred.
- Personal-only direction remains active.
