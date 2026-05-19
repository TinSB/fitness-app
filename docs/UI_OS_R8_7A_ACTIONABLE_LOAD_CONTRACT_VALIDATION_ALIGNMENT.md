# UI-OS R8.7A Actionable Load Contract & Validation Alignment

## Task Identity

- UI-OS R8.7A
- Actionable Load Contract & Validation Alignment V1
- Implementation task following UI-OS R8.6 merge `b4c2e738665c55815ff3f25442e1c5273b133e0b`.

## Why R8.7A Exists

R8.6 aligned Focus display and apply suggestion with equipment-aware feasible loads, but validation could still treat the raw theoretical load as the baseline. That caused false abnormal-entry friction when the gym-actionable prescription was correct.

Example:

- Raw theoretical load: `27 lb`
- Actionable equipment-aware load: `45 lb`
- Primary display: `45 lb × 10`
- Apply suggestion: `45 lb × 10`
- Current record: `45 lb × 10`
- Validation baseline: `45 lb × 10`

## Contract

`rawTheoreticalLoad` is an internal estimate only. It is not user-actionable, not a validation baseline, and stays hidden from primary UI.

`actionableLoad` is the equipment-aware feasible load. It is the one executable load used by primary UI, apply suggestion, current-record prefill, and validation baseline.

`recordedLoad` is what the user actually records. It is compared against `actionableLoad`, not the raw theoretical estimate.

## What Changed

- Added a pure actionable-load contract helper around the existing equipment-aware prescription path.
- Focus validation now passes the actionable load and validation baseline into set-anomaly detection.
- Set-anomaly detection prefers `actionableWeightKg` / `validationBaselineKg` over raw planned or theoretical fields.
- `套用建议` still fills actionable weight plus planned reps, does not fill RIR, and does not save or complete the set.

## Non-goals

- No source-of-truth behavior change.
- No persistence behavior change.
- No AppData schema change.
- No stored history migration or mutation.
- No route, cloud, package, script, or lockfile change.

## Boundary Confirmation

Accepted browser mutation routes remain exactly seven. `POST /data-health/repair/apply` remains blocked. Cloud sync, default sync, background sync, Supabase connection, SaaS runtime, and package drift remain out of scope.

UI-OS R8.7B is recommended next and is not started by R8.7A.
