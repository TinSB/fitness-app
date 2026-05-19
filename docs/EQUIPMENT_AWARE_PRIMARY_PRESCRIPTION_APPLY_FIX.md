# Task 17H — Equipment-Aware Primary Prescription & Apply Suggestion Fix V1

## User-visible bug

Focus Mode showed a split recommendation:

- Primary prescription: `推荐处方 17lb × 10 次`
- Equipment-aware detail: `空杆 45 lb`, `理论计算：17 lb`, `实际可做：45 lb`

The equipment-aware engine was running, but the primary actionable prescription still showed the old theoretical weight.

## Root cause

Theoretical recommendation weight remained in the primary actionable display and in the `套用建议` apply path. The equipment-aware detail was derived separately from the feasible load engine, so it correctly showed the empty Olympic bar while the main prescription and apply-suggestion value still used the generated theoretical value.

## Fix

Task 17H adds a pure actionable prescription adapter. When a supported equipment-aware feasible load is available, it becomes:

- the primary prescription display weight
- the `套用建议` applied weight

The theoretical recommendation remains available as explanation/detail only. Training algorithm output, warmup generation, source-of-truth behavior, and historical workout data are unchanged.

## Verification examples

- Bench warmup `17 lb` -> primary `空杆 45 lb`, detail keeps `理论计算：17 lb`
- Bench `135 lb` -> `135 lb total` plus `每边 45 lb`
- Dumbbell -> per-hand feasible load, not doubled pair total
- Machine -> machine stack value when stack options are configured
- Plate-loaded machine -> keeps base/sled warning when base weight is unknown or excluded

## Boundaries

- No training algorithm change
- No warmup algorithm direct change
- No PR/e1RM/effective-set logic change
- No source-of-truth change
- No history migration or historical data mutation
- No route change
- No cloud sync, default sync, or background sync
- No Supabase access
- No package dependency, package script, or lockfile change
