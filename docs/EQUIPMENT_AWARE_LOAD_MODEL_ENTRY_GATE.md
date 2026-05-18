# Equipment-Aware Load Model Entry Gate V1

## Task Identity

- Task 17A.
- Equipment-Aware Load Model Entry Gate V1.
- Phase 17 start.
- Docs/static tests only.

## Phase 16 Baseline Evidence

- Phase 16 complete.
- Task 16G — Phase 16 Personal-Only Roadmap Archive V1.
- PR #262.
- Merge commit: `cc3a88ac50d9fe4e454392dde0ddbab73e45db6a`.
- `npm test` passed: 1078 files / 4361 tests.
- dist token scan clean.
- Phase 17 was not started before this task.

## Real-Use Problem Statement

- The owner has used IronPath for about one month.
- The owner records every workout.
- The biggest real-use issue is that the current load/weight model is not equipment-aware.
- The current single weight unit/model is confusing because real gyms do not have one universal "weight" concept.
- The system must distinguish theoretical training weight from physically loadable gym weight.
- Recommendations must become feasible with the actual equipment available.
- UI must remain simple enough to use during training.

## Example Failure

- Bench press warmup recommendation of 17 lb is invalid.
- Empty Olympic bar is 45 lb.
- The system should recommend empty bar / 45 lb or adapt warmup logic.
- This is not just a rounding issue; it is a minimum feasible load / equipment profile issue.

## Product Decision

Decision: IronPath must add an Equipment-Aware Load Model.

This model should support:

- Equipment kind.
- Bar weight / base machine weight.
- Whether base weight is included.
- Available plates.
- Dumbbell increment.
- Machine-specific stack options or increments.
- Display mode.
- Feasible load rounding.
- Readiness-based rounding preference.
- Per-exercise default equipment profile.

Task 17A is an entry gate only and does not build the model.

## Required Equipment Categories

- `barbell`
- `smith_machine`
- `dumbbell`
- `selectorized_machine`
- `plate_loaded_machine`
- `cable_stack`
- `bodyweight`
- `assisted_bodyweight`
- `unknown`

These categories cover:

- Fixed/selectorized machine.
- Free weights.
- Barbell.
- Dumbbell.
- Smith machine.
- Plate-loaded machine.
- Cable stack.
- Bodyweight and assisted bodyweight.
- Unknown / custom equipment.

## Required User-Specific Defaults

- Olympic barbell default bar weight: 45 lb.
- Smith machine default bar weight: 25 lb.
- Barbell plate inventory: 2.5 / 5 / 10 / 25 / 45 lb.
- Dumbbell increment: 5 lb.
- Frequently used barbell movements include flat bench press, squat, Romanian deadlift, and barbell row.
- Barbell display: total weight + per-side plates.
- Dumbbell display: per-hand weight.
- Selectorized / pin-loaded machine loads are usually recorded according to the machine's displayed weight.
- Selectorized machines require machine-specific weight options / increments.
- If a machine displays its own base weight/resistance, the owner may include it.
- If a machine does not display base weight, the owner records only the shown stack/load or the plates used.
- Plate-loaded machines use optional base machine weight / sled weight and include it only when known or configured.
- Machine increments vary by machine and cannot be assumed globally.

## Required Display Modes

- `total_weight`
- `per_hand`
- `per_side_plates`
- `machine_stack`
- `added_load`
- `bodyweight_adjusted`
- `total_plus_per_side`

Display requirements:

- Barbell movements should record/display total weight including bar weight.
- Barbell display should show total weight + per-side plates.
- Dumbbell movements should record/display per-hand weight.
- Selectorized / pin-loaded machines should display machine stack labels or configured machine-specific options.
- Plate-loaded machines should distinguish added load from configured total load when a base weight is known.

## Required Feasible-Load Behavior

- Recommendation output should be physically loadable.
- Theoretical weight may be kept internally or shown as secondary detail later.
- Primary recommendation should be feasible.
- Low warmup below bar weight should resolve to empty bar or adjusted warmup.
- Dumbbell recommendation should round to available dumbbell increment.
- Barbell recommendation should round to possible plate combinations.
- Selectorized machine recommendation should round to machine-specific available options.
- Plate-loaded machine recommendation should account for configured base weight when enabled.
- Rounding direction should use recent training frequency, readiness, and weight trend when available instead of always rounding conservatively or aggressively.
- Recommendation should prefer real feasible load, not theoretical impossible numbers.

## Required Future Model Concepts

Conceptual `EquipmentKind`:

- `barbell`
- `smith_machine`
- `dumbbell`
- `selectorized_machine`
- `plate_loaded_machine`
- `cable_stack`
- `bodyweight`
- `assisted_bodyweight`
- `unknown`

Conceptual `LoadDisplayMode`:

- `total_weight`
- `per_hand`
- `per_side_plates`
- `machine_stack`
- `added_load`
- `bodyweight_adjusted`
- `total_plus_per_side`

Conceptual `EquipmentProfile`:

- `id`
- `exerciseId`
- `name`
- `equipmentKind`
- `defaultBarWeightLb`
- `baseMachineWeightLb`
- `includeBaseWeight`
- `availablePlatesLb`
- `dumbbellIncrementLb`
- `machineWeightOptionsLb`
- `machineIncrementLb`
- `displayMode`
- `roundingPreference`

Conceptual `FeasibleLoadResult`:

- `theoreticalWeight`
- `feasibleWeight`
- `displayWeight`
- `plateBreakdown`
- `perSideLoad`
- `reason`
- `warnings`
- `sourceOfTruthChanged: false`

Equipment profiles must eventually be available for all exercises.

## Task 17B Authorization Recommendation

Recommended next task: Task 17B — Equipment-Aware Load Model & Feasible Weight Engine V1.

Task 17B should implement:

- Pure equipment/load model types.
- Pure feasible load rounding engine.
- Support for barbell / Smith / dumbbell / selectorized machine / plate-loaded machine.
- Olympic bar 45 lb default.
- Smith bar 25 lb default.
- Available plates 2.5 / 5 / 10 / 25 / 45.
- Dumbbell 5 lb increment.
- Machine-specific options.
- Low warmup below bar resolves to empty bar / feasible minimum.
- Tests for bench warmup 17 lb -> 45 lb empty bar.
- Tests for dumbbell per-hand rounding.
- Tests for selectorized machine custom stack options.
- Tests for plate-loaded optional base weight.

Task 17B must not:

- Change source-of-truth behavior.
- Mutate historical data.
- Alter training algorithm outputs beyond feasible load presentation layer.
- Add cloud sync.
- Add routes.

## Later Task Recommendations

- Task 17C — Exercise Equipment Profile Defaults V1.
- Task 17D — Equipment-Aware Training Recommendation Display V1.
- Task 17E — Equipment Profile Editing UX V1.
- Task 17F — Phase 17 Equipment-Aware Load Model Archive V1.

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
- no automatic worker/timer/polling sync.
- no production deployment auto-start.
- no external monitoring upload.
- no SaaS/multi-user runtime.
- no normalized training tables.
- no destructive migration.
- no real personal training data in automated tests.
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

- Task 17A does not start Task 17B.
- Task 17A is an entry gate only.
- Phase 17 is focused on real-use feedback and equipment-aware load recommendations.
- SaaS remains deferred.
- Personal-only direction remains active.
