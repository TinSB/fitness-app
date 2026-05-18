# Equipment Profile Editing UX V1

## Task identity

Task 17F — Equipment Profile Editing UX V1.

This task adds presentational/draft-only equipment profile editing UX. It does not persist profile edits, change source-of-truth behavior, mutate history, or change live recommendations.

## Task 17E baseline

Task 17E is complete:

- PR #267
- Merge commit `b4d3b6754b390677923e959ae5e9a6b10777bf24`
- npm test passed: 1091 files / 4444 tests
- dist token scan clean

Task 17E integrated display-only equipment-aware recommendation copy into `TrainingView` set cards and `TrainingFocusView` main warmup/working recommendation cards.

## What Task 17F adds

- pure equipment profile draft model helper
- pure equipment profile draft normalization and validation
- presentational `EquipmentProfileEditor`
- Chinese-first owner copy for equipment configuration
- warnings for incomplete or uncertain equipment configuration

## Non-goals

Task 17F does not:

- persist equipment profile edits to AppData or settings
- change source-of-truth behavior
- mutate historical workout data
- migrate exercise data
- change training algorithm
- change warmup algorithm directly
- change PR/e1RM/effective-set calculations
- change generated sets
- change saved set values
- change session mutation payloads
- add routes
- add cloud sync
- add package/dependency/script/lockfile changes

## Profile editing fields

- equipmentKind
- displayMode
- defaultBarWeightLb
- baseMachineWeightLb
- includeBaseWeight
- availablePlatesLb
- dumbbellIncrementLb
- machineWeightOptionsLb
- machineIncrementLb
- roundingPreference
- notes

## Warning and copy policy

- Olympic bar 45 lb default is explained.
- Smith machine 25 lb default is explained.
- Dumbbell per-hand display is explained.
- Selectorized machine stack options are explained.
- Cable stack options are explained.
- Plate-loaded base/sled weight is optional and only included when known.
- Warning when base weight is unknown and includeBaseWeight is selected.
- Warning when machine stack options and increment are missing.
- Warning when unknown/custom exercise needs configuration.
- No copy claims edits affect historical data.
- No copy claims edits automatically sync to cloud.

## Draft validation policy

- barbell/smith must have positive bar weight.
- dumbbell must have positive increment.
- plate arrays must be positive and sorted/normalized.
- selectorized options must be positive if provided.
- machine increments must be positive if provided.
- base weight may be unknown.
- includeBaseWeight with unknown base produces warning.
- unknown/custom profile remains valid but warning required.

## Persistence policy

Persistence is deferred. Task 17F provides a controlled draft and editor only. A later task must explicitly authorize AppData/settings schema, sanitize, migration, and source-of-truth behavior before equipment profile edits can be saved.

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

## Recommended next task

Task 17G is recommended next. Task 17G — Phase 17 Equipment-Aware Load Model Archive V1 is recommended next. Task 17G is not started by Task 17F.
