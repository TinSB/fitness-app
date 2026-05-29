# iOS-4B3 — Readiness + e1RM Slice V1

Status: implemented. Branch `claude/ios-4b3-readiness-e1rm-slice-v1`, based on
`origin/main` (2261751, iOS-4B2). Swift-only + TS-guard-only; no TS runtime, golden, AppData
schema, or lockfile changes.

## 1. Goal

Port the minimal Swift **readiness** + **e1RM trend** slice that the controlled-reload
sessionIntent branch needs, unlocking `controlled-reload-v1` (which iOS-4B2 deferred) and exposing
`riskLevel` / `recoveryHigh` for future slices.

## 2. Why 4B3 follows 4B2

iOS-4B2 ported effectivePhase + sessionIntent (branches 1/2/3/5) and hard-wired
`e1rmTrendUp = false` / `recoveryHigh = false`, so `controlled-reload` (branch 4) could not fire —
its golden sessionIntent was the one documented deferral. Branch 4 needs `e1rmTrendUp =
isE1rmTrendUp(history)` AND `recoveryHigh = (readiness.level == "low")`; iOS-4B3 ports exactly those
two inputs and wires them in.

## 3. Scope: readiness + e1RM only

- **Readiness (subjective subset)** — port of `mapTodayStatusToReadinessInput` +
  `buildReadinessResult` (subjective scoring) + `buildTodayReadiness` + `collectPainAreasFromHistory`
  (`src/engines/readinessEngine.ts`). Score base 82; sleep poor −20 / ok −8 / good +4; energy low
  −18 / medium −6 / high +4; soreness ≥2 −15 / ==1 −8; pain >0 −20; clamp [0,100]; level <50 low /
  <75 medium / else high.
- **e1RM trend** — port of `isE1rmTrendUp` (`trainingDecisionEngine.ts:258`): ≥4 completed
  sessions, per-exercise top set weight, mean(last 3) > mean(rest).
- **riskLevel** — port of `riskLevelFor` (`trainingDecisionEngine.ts:246`).
- `recoveryHigh = readiness.level == .low`; wired into `sessionIntentFor`.

### Deferred (documented; no golden exercises them in 4B3)

- The **health-summary delta** (`buildHealthSummary` / `healthSummaryEngine`). No fixture supplies
  live (non-stale) health data: controlled-reload-v1 has none; stale-health-data-v1's sample is
  stale, so the clean view resolves `useHealthDataForReadiness = false` and the health branch is
  skipped anyway.
- The **available-vs-planned time-gap penalty** — needs `template.duration` (template arrives with
  prescription, iOS-4B5). Max effect −15; for the default todayStatus (score 68) the level stays
  `medium` either way, so it never flips a fixture's level bucket; only `intensityMode` (iOS-4B4)
  consumes `trainingAdjustment`.

iOS-4B3 asserts readiness LEVEL (which drives `recoveryHigh` + `riskLevel`), not the raw score —
the deferred deltas above change no level bucket.

## 4. controlled-reload unlock

`controlled-reload-v1`: todayStatus sleep 差 / energy 低 → readiness 44 → low → recoveryHigh; 5
strictly-increasing top-weight sessions (60→70) → e1rmTrendUp. With both true, `sessionIntentFor`
branch 4 fires → `controlled-reload`, matching the golden. Branch ORDER is preserved: severeFlag
(1) > reentry/restart phase (2) > explicitDeload (3) > controlled-reload (4) > normal (5).

## 5. Clean input contract

Unchanged from iOS-4B2: `CleanTrainingDecisionInput` (fileprivate-init brand) minted only via
`createCleanTrainingDecisionInput(cleanView:metadata:)`. iOS-4B3 additions: the factory now
**resolves `useHealthDataForReadiness`** mirroring TS `resolveUseHealthDataForReadiness` (metadata
override → else `staleForReadiness ? false : raw setting`), and the engine reads the carried
`todayStatus` + `history` (cleanedHistory) for readiness. No raw AppData reaches the engine.

## 6. Files changed

Created: `TrainingDecisionReadiness.swift`, `TrainingDecisionE1RMTrend.swift`; tests
`TrainingDecisionReadinessParityTests.swift`, `TrainingDecisionE1RMTrendTests.swift`,
`TrainingDecisionControlledReloadTests.swift`; guard `tests/iosTrainingDecisionReadinessE1RMSliceStaticGuards.test.ts`.
Edited: `TrainingDecisionCoreSliceEngine.swift` (compute readiness/e1RM/riskLevel; extend
`TrainingDecisionCoreSlice` with readinessLevel/recoveryHigh/e1rmTrendUp/riskLevel/useHealthDataForReadiness;
resolve useHealthDataForReadiness in the factory); `CoreSliceTestSupport.swift` (weighted sessions +
todayStatus + health samples); `TrainingDecisionCoreSliceParityTests.swift` (controlled-reload now
matches; riskLevel parity added); `TrainingDecisionCleanInputBrandTests.swift` (deferred-fields test
narrowed to trainingMode); `tests/iosTrainingDecisionSwiftEngineStaticGuards.test.ts` (narrowed).

## 7. Tests added

Swift (package total 70): readiness scoring buckets + soreness/pain + riskLevelFor table +
collectPainAreas + stale todayStatus; e1RM trend (<4 / increasing / flat / decreasing / incomplete
skipped); controlled-reload unlock + branch-order overrides (severe / reentry-phase / deload) +
stale-health-still-controlled-reload + legacy-advice-no-effect; parity: sessionIntent (all 9,
controlled-reload included) + riskLevel (all 9).

## 8. Static guards

New `iosTrainingDecisionReadinessE1RMSliceStaticGuards.test.ts`: readiness/e1RM files present;
`buildTodayReadiness` + `isE1rmTrendUp` scoped to IronPathTrainingDecision only; controlled-reload
deferral resolved; prescription / supportPlan / deload / clamp / userFacing / full-arbitrationTrace
/ **buildHealthSummary** still forbidden; no cloud/HealthKit/persistence/UI imports; no AppData
mutation / clean-view construction / raw-history read; golden + lockfile hygiene. Narrowed
`iosTrainingDecisionSwiftEngineStaticGuards.test.ts`: readiness/e1RM/riskLevel symbols moved out of
the forbidden list; the hard-wired-false assertion replaced with a "readiness wired" assertion; the
controlled-reload-deferred assertion replaced with "resolved in 4B3".

## 9. Non-goals (iOS-4B4+)

deload + clamp + modes (volume/intensity/progression) + finalVolumeMultiplier (4B4); exercise
prescription + volume floor + perExercise/targetSets (4B5); userFacing text + full arbitrationTrace
+ full-object TrainingDecision parity (4B6); the health-summary delta; the time-gap readiness
penalty; Focus Mode; UI; HealthKit; cloud sync; Supabase; AppData mutation; raw AppData input;
third-party SwiftPM; SwiftData/CoreData/@Model/@Observable; TS runtime / golden / schema changes.

## 10. Validation

`swift test` ×9 packages (IronPathTrainingDecision 70); `node scripts/generate-parity-goldens.mjs
--check` (14 fixtures / 0 changed); `npm run typecheck`; `npm test`; `npm run build`;
`scan-production-dist-safety`; `xcodebuild` generic + iPhone 17 Pro. No golden / package.json /
lockfile / pnpm-lock changes.

## 11. Remaining risks

- Readiness `score` is subjective-only (health-summary delta + time-gap penalty deferred). Only the
  LEVEL is asserted against goldens; the deferred deltas change no level bucket here, but 4B4 must
  add them before `intensityMode`/`trainingAdjustment` parity.
- `useHealthDataForReadiness` resolves to the raw setting (default true) when not stale, vs TS
  `null` when no setting — only the stale → false case is golden-relevant in 4B3 and matches.
- `collectPainAreasFromHistory` falls back to `exercise.name` when a painFlag set has no painArea,
  vs TS `exercise.muscle` (the Swift `ExercisePrescription` has no `muscle` field). No fixture
  carries a painFlag set, so this branch never runs and `painCount` is always 0 in 4B3; before any
  pain-area STRING is asserted, add a `muscle` field to the Domain model and match the TS fallback.
- The deferred time-gap penalty makes the computed `trainingAdjustment` diverge from TS
  (`normal` vs `conservative`) for the push-a default fixtures; unconsumed in 4B3 (only iOS-4B4
  `intensityMode` reads it), but 4B4 must add the penalty + health delta + `Math.round` first.

## 12. Next task

**iOS-4B4 Deload + Clamp + Modes V1** — port `buildAdaptiveDeloadDecision` + `clampMultiplier` +
`volumeModeFor`/`intensityModeFor`/`progressionModeFor` → `finalVolumeMultiplier` + the three mode
fields. ✅ implemented — see
[`IOS_4B4_DELOAD_CLAMP_MODES_V1.md`](./IOS_4B4_DELOAD_CLAMP_MODES_V1.md) (it also adds the
time-gap penalty + health delta + `Math.round` this doc deferred). Then iOS-4B5 (exercise
prescription + volume floor) and iOS-4B6 (userFacing + full arbitrationTrace + full-object parity).
