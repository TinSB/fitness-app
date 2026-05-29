# iOS-4B5 — Exercise Prescription + Volume Floor V1

Status: implemented. Swift-only + TS-guard/doc-only — no TS runtime, golden fixture,
AppData schema, or lockfile change. Builds on iOS-4B4 (deload + clamp + modes).

## 1. Goal

Port the minimal exercise-prescription logic needed to match the existing golden
fields the prior slices left unasserted:

- `perExercise` (exerciseId / role / targetSets)
- `allTargetSets` / `minTargetSets`
- `exerciseRoleFloors`

while keeping `finalVolumeMultiplier` / `riskLevel` / `sessionIntent` / modes (4B2-4B4)
correct. This is the slice native Focus Mode needs to show today's exercises + per-set
targets + the productive-floor / no-all-1-set protection.

## 2. Why 4B5 follows 4B4

`perExercise.targetSets` is `max(adjustedSets, exerciseRoleFloors[role])` where
`adjustedSets` is the `applyStatusRules` output, which **consumes** 4B4's
`finalVolumeMultiplier` (as `externalVolumeMultiplier`) and the deload level. So the
prescription cannot be computed without the 4B4 clamp + deload already in place.

## 3. Scope: exercise prescription + volume floor only

Ported TS → Swift (bounded-faithful, user-approved):

| TS (source) | Swift |
| --- | --- |
| `roleOf` (`trainingDecisionEngine.ts:109`) | `TrainingDecisionExerciseRoles.roleOf` |
| `ROLE_FLOORS_*` + floor selection + kindFloors (82-94, 1937-1945) | `TrainingDecisionRoleFloors` |
| `prescribeExercise` hybrid clamp (`exercisePrescriptionEngine.ts:129-260`) | `TrainingDecisionExercisePrescription.prescribeSets` |
| `applyStatusRules` set pipeline (359-719) | `TrainingDecisionExercisePrescription.buildWorkingSetTargets` |
| `buildAdaptiveConservativeDecision` + `getExerciseAdaptiveProfile` (adaptiveFeedbackEngine.ts:266-399) | `conservativeLevel` + `isContraindicated` |
| `buildExerciseMetadata` orderPriority/contraindications + `issuesForExercise` | `TrainingDecisionExerciseKnowledge` (BOUNDED to the 6 push-a exercises) |
| `workingSetTargets` (1968-1983) | the `buildWorkingSetTargets` projection |

## 4. roleOf / role floors

`roleOf(kind, name)` runs the English-token regex `/(bench|squat|deadlift|press|row|
pull|chin|dip)/` on the **lowercased name**. The seed-template names are Chinese, so
the regex never matches → both push-a "compound" movements classify as
**secondary-compound** (not main-compound); machine → accessory; isolation → isolation.

`exerciseRoleFloors` = `ROLE_FLOORS_REENTRY` (compounds 2) for `reentry-productive`,
else `ROLE_FLOORS_NORMAL` (all 1). `kindFloors` = `{compound: max(main,secondary),
machine: accessory, isolation: isolation}`. Golden `exerciseRoleFloors` parity holds
for all 9 (base/controlled/deload/severe/stale = all 1; productive-floor + restart =
compounds 2).

## 5. The set pipeline (order is contractual)

Per exercise: `prescribeSets` (hybrid clamp) → `max(kindFloor, ceil(prescribed ×
finalVolumeMultiplier))` → (conservative/低: non-compound −1) → (sleep差 && energy低:
isolation −1) → adaptive `conservativeLevel` cut (≥4: non-iso −2 / iso −1; ≥2: non-iso
−1 / iso −0) → IN-ENGINE final floor `max(kindFloor, sets)` → OUTER role floor
`max(sets, exerciseRoleFloors[role])`. The two floors are distinct (3-key kind vs 4-key
role) and both ported; the in-engine floor is load-bearing under reentry/restart (it
lifts the adaptive-cut compounds back to the floor).

## 6. conservativeLevel (the adaptive cut driver)

`conservativeLevel` = readiness level (medium→+1, low→+2) + deload level (watch→+1,
yellow→+2, red→+3) + `contraindicated`(+2). `contraindicated` = the exercise's
`contraindications` ∩ (`linkedIssues` ∪ `correctionPriority`). For push-a +
DEFAULT_SCREENING the three chest press/machine movements are contraindicated (+2); the
three isolations are not. The remaining profile terms (performanceDrop / painCount /
restricted / issueScore) are 0 for the default-screening fixtures and are DEFERRED.

## 7. productive floor / no-all-1-set regression protection

`reentry-productive` (productive-floor-v1 reentry + restart-28d-gap restart) enforces
the REENTRY floor: major compounds stay at ≥ 2 even after the adaptive cut would push
them to 1. The normal-session fixtures never collapse to all-1 (they are
`[2,2,1,1,3,2]`). A dedicated unit test exercises the `max()` floor-raising branch that
the goldens themselves leave non-binding.

## 8. severe-rest all-1-set allowed

`severe-rest-v1` legitimately produces `[1,1,1,1,1,1]`: the severe floor (0.3 volume
multiplier) + NORMAL role floors (1) crush every exercise to 1. This is a real severe
signal, not a regression — the test asserts severe is all-1 while base is not.

## 9. Clean input contract

Unchanged brand (`CleanTrainingDecisionInput`, fileprivate-init, factory takes a
`CleanAppDataView`). New: the metadata + branded input carry the full template
exercises (`templateExercises: [TrainingDecisionTemplateExercise]`, raw fields); the
engine enriches orderPriority / contraindications / linkedIssues via the bounded
knowledge map. No raw AppData reaches the engine.

## 10. Files changed

New Swift: `TrainingDecisionExerciseRoles.swift`, `TrainingDecisionRoleFloors.swift`,
`TrainingDecisionExerciseKnowledge.swift`, `TrainingDecisionExercisePrescription.swift`.
Edited Swift: `TrainingDecisionCoreSliceEngine.swift` (carry template; compute
workingSetTargets; 4 new slice fields).
New tests: `TrainingDecisionRoleFloorTests`, `TrainingDecisionExercisePrescriptionParityTests`,
`TrainingDecisionProductiveFloorTests`. Edited: `TrainingDecisionCoreSliceParityTests`
(+ perExercise/allTargetSets/exerciseRoleFloors/productive-floor/severe assertions),
`CoreSliceTestSupport` (push-a template builder + templateExercises wiring).
New TS guard: `tests/iosTrainingDecisionExercisePrescriptionStaticGuards.test.ts`.
Edited TS guards: `iosTrainingDecisionSwiftEngineStaticGuards`,
`iosTrainingDecisionDeloadClampModesStaticGuards` (roleOf / applyStatusRules / prescription
moved out of the forbidden lists). Docs: this file + cross-refs.

## 11. Tests added

`swift test` IronPathTrainingDecision: **105 → 128** (+23): perExercise / allTargetSets /
minTargetSets / exerciseRoleFloors parity over all 9 expanded goldens; roleOf
classification table; role/kind floor constants; prescribeSets clamp; conservativeLevel
+ contraindicated tables; the in-engine floor-raising branch; finalVolumeMultiplier →
set scaling; productive-floor compounds ≥ 2; severe all-1; deload-week differs from
reentry/restart; no-template → empty perExercise.

## 12. Static guards

New `iosTrainingDecisionExercisePrescriptionStaticGuards`: the two slice files present;
roleOf / prescribeSets / buildWorkingSetTargets / role floors / conservativeLevel /
contraindicated present + scoped; engine wires perExercise/allTargetSets/exerciseRoleFloors;
support plan / userFacing / arbitrationTrace / buildHealthSummary / buildTrainingLapseSignal
still forbidden; import + AppData-mutation + golden + lockfile hygiene. Narrowed the 4B2
engine guard + 4B4 deload/clamp/modes guard (roleOf / applyStatusRules / prescription
moved out).

## 13. Non-goals (deferred)

No support plan object, no userFacing text builders, no full arbitrationTrace, no full
weeklyAdjustment object, no Focus Mode UI, no HealthKit, no cloud sync, no Supabase, no
AppData mutation, no raw AppData input, no SwiftData/CoreData/@Model/@Observable. The
full `EXERCISE_KNOWLEDGE_OVERRIDES` + `ISSUE_FROM_PATTERN` knowledge base is scoped to
the 6 push-a exercises (rest deferred). The prescribeExercise strength/hypertrophy mode
branches, the weekly muscle budget, the painPattern / loadFeedback / fineTune /
adaptiveCalibration set effects, and the time<=30 / poorSleepDays>=2 / recovery passes
are DEFERRED — all inert (golden-neutral) for the 9 push-a fixtures (soreness 无, no pain
history, no calibration, time 60).

## 14. Validation

`swift test` ×9 packages green (IronPathTrainingDecision 128). `parity --check` 14/0;
no golden git change. `npm test` green; `typecheck` / `api:dev:build` / `build` /
`scan-production-dist-safety` clean. `git diff` package.json/lockfiles empty;
`pnpm-lock.yaml` absent. `xcodebuild` generic + iPhone 17 Pro BUILD SUCCEEDED.

## 15. Next task

**iOS-5 Native Focus Mode Shell + TrainingDecision Integration V1** (Xcode-led):
a SwiftUI native Focus Mode shell that calls the Swift TrainingDecision core/prescription
output — today's exercises + per-exercise target sets + activePhase / sessionIntent /
volumeMode / intensityMode — runnable in the Simulator. No Cloud, no HealthKit, no full
history/progress UI, no production sync, no TS runtime. (iOS-4B6 userFacing + full
arbitrationTrace + full-object parity is DEFERRED / parallel and no longer blocks the
native UI handover.)
