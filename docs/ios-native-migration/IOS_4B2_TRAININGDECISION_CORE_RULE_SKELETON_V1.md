# iOS-4B2 — TrainingDecision Core Rule Skeleton V1

Status: implemented. Branch `claude/ios-4b2-training-decision-core-rule-skeleton-v1`, based on
`origin/main` (b325f75, iOS-4B1). Swift-only + TS-guard-only; no TS runtime, no golden, no
lockfile changes.

## 1. Goal

Land the FIRST TrainingDecision engine slice in Swift: the Clean Input Contract
(`CleanTrainingDecisionInput` + factory taking a `CleanAppDataView`),
`buildTrainingDecisionFromCleanInput`, and the two core rules — **effectivePhase** and
**sessionIntent** — returning a narrow `TrainingDecisionCoreSlice`. Field-subset parity proves the
Swift slice matches the 9 expanded training-decision goldens for the fields it computes.

## 2. Why 4B2 is limited to effectivePhase + sessionIntent

The committed goldens are an enriched projection that also carries `userFacing` (7 surfaces of
copy), `perExercise`/`allTargetSets` (the full exercise-prescription engine), `riskLevel` /
`volumeMode` / `intensityMode` / `progressionMode`, `finalVolumeMultiplier` (deload + clamp), the
full `weeklyAdjustment`, and the full `arbitrationTrace`. Reproducing the whole golden requires
the prescription, readiness, adaptive-deload and userFacing engines — all out of scope here.

`effectivePhase` and `sessionIntent` (branches 1/2/3/5) are the genuinely minimal, pure slice:
`getEffectiveTrainingPhase` reads only `{history, mesocyclePlan, referenceDate}` and is clock-
injected; `sessionIntentFor` reads only the computed phase + the severe flags + `explicitDeload`.
The scope audit (6-agent workflow + CodeGraph) confirmed this is the smallest safe observable
surface. The TrainingDecision TS engine remains the source of truth; 4B2 ports a slice of it.

## 3. IronPathDataHealth dependency decision (Option A)

`IronPathTrainingDecision` now depends on `IronPathDataHealth` (in addition to `IronPathDomain`).
The clean-input contract requires that RAW `AppData` can never reach the engine — the only door is
`createCleanTrainingDecisionInput(cleanView: CleanAppDataView, …)`, and `CleanAppDataView` lives in
`IronPathDataHealth`. Domain-only would weaken the contract and force 4B3 to re-plumb the entry
signature; the existing package-graph guard already anticipated this ("the engine's
IronPathDataHealth dep arrives in 4B2"). The arrow stays acyclic:

```
IronPathTrainingDecision -> IronPathDataHealth -> IronPathDomain
```

`IronPathDataHealth` never imports `IronPathTrainingDecision` (locked by a static guard).

## 4. Clean Input Contract

`CleanTrainingDecisionInput` is a branded value type whose memberwise initializer is
`fileprivate` — no other module can construct it; the only public door is the factory, which takes
a `CleanAppDataView`. This is the Swift analogue of the TS
`Symbol.for('ironpath.trainingDecision.cleanInput.v1')` brand, but a COMPILE-TIME guarantee rather
than a runtime throw. The type is deliberately NOT `Codable` (a synthesized `init(from:)` would
re-open raw construction from arbitrary JSON).

The factory sources history from the CLEANED projection (`cleanView.cleanedHistory`) and screening
from `cleanView.cleanedScreening`; `mesocyclePlan`/`todayStatus` come from `cleanView.raw` (the
data-health guards do not clean those, and 4B2 never reads `todayStatus`). The Swift
`CleanAppDataView` has no single cleaned-`appData` accessor (unlike TS), so the factory assembles
from `cleanedHistory + cleanedScreening + raw.{mesocyclePlan,todayStatus}`. No `userId`/
`userProfile` is ever carried.

## 5. Files created

- `ios/packages/IronPathTrainingDecision/Sources/IronPathTrainingDecision/`
  - `TrainingDecisionCoreSliceEngine.swift` — clean input + factory + entry + `sessionIntentFor` + `TrainingDecisionCoreSlice`.
  - `EffectiveTrainingPhase.swift` — `getDaysSinceLastTraining` + `deriveDecision` + `getEffectiveTrainingPhase`.
  - `MesocycleWeekResolver.swift` — `getCurrentMesocycleWeek`/`getMesocycleWeekIndex`/`clampWeekIndex` + default weeks + the two date conventions.
- `ios/packages/IronPathTrainingDecision/Tests/IronPathTrainingDecisionTests/`
  - `CoreSliceTestSupport.swift` (helpers), `TrainingDecisionCoreSliceParityTests.swift`, `TrainingDecisionCleanInputBrandTests.swift`, `TrainingDecisionGapTableUnitTests.swift`.
- `tests/iosTrainingDecisionSwiftEngineStaticGuards.test.ts` (new TS guard).
- Edited `ios/packages/IronPathTrainingDecision/Package.swift` (add IronPathDataHealth).
- Narrowed 4 existing guards (see §12).

## 6. effectivePhase behavior

Ported verbatim from `src/engines/effectiveTrainingPhaseEngine.ts` (the Training Cycle Gap Auto
Re-entry State Machine). `deriveDecision` gap table:

| gap (days) | activePhase | mode | severity | overridden |
| --- | --- | --- | --- | --- |
| no history | persisted | continue | none | false |
| 0–3 | persisted | continue | none | false |
| 4–7 | persisted | continue | mild | false |
| 8–13, persisted ∈ {overload, deload} | reentry | reentry | reentry | true |
| 8–13, otherwise | persisted | continue | reentry | false |
| 14–27 | reentry | reentry | reentry | true |
| 28+ | restart | restart | restart | true |

Analytics filter (`completed !== false && dataFlag ∉ {test, excluded}`), `finishedAt ?? startedAt
?? date` timestamp selection, and the noon-anchored `Math.round` day diff are all ported. The
8–13d `mode=continue / severity=reentry` divergence and the analytics filter have no golden
coverage and are locked by `TrainingDecisionGapTableUnitTests`.

## 7. sessionIntent behavior

Ported from `sessionIntentFor` (`trainingDecisionEngine.ts:196`), full 5-branch order:

1. `severeFlag` (acutePain || injury || illness) → `severe-rest`
2. activePhase ∈ {reentry, restart} → `reentry-productive`
3. `explicitDeload` || activePhase == deload → `deload-week`
4. `e1rmTrendUp && recoveryHigh` → `controlled-reload` — **deferred** (see §8)
5. else → `normal-session`

## 8. controlled-reload deferral

Branch 4 needs `e1rmTrendUp = isE1rmTrendUp(history)` AND `recoveryHigh = (readiness.level ==
"low")`. Both `readinessEngine` and the e1RM trend are OUT of 4B2 scope, so the engine hard-wires
`e1rmTrendUp = false` / `recoveryHigh = false` (a visible, guarded constant — not an accidental
omission). Consequence: `controlled-reload-v1` computes `normal-session` in 4B2. Its golden
`sessionIntent` is therefore intentionally NOT matched — the parity test asserts the engine
returns `normal-session` for that fixture and documents the deferral. When **iOS-4B3** wires
readiness, that assertion flips and must be revisited. Its `effectivePhase` fields ARE asserted
(they are computable today).

## 9. Golden fixture subset parity

`TrainingDecisionCoreSliceParityTests` runs over the 9 expanded goldens (everything except the
narrow `normal-session-v1`). For each it builds a synthetic engine input from that fixture's known
gap + flags, runs the engine, and asserts the computed `{effectivePhase.activePhase, gapDays, mode,
severity, overridden, hasHistory; top-level activePhase}` equal the golden values, plus
`sessionIntent` for 8 of the 9 (controlled-reload deferred). Fields outside this subset (modes,
risk, multipliers, perExercise, weeklyAdjustment, userFacing, full arbitrationTrace) are NOT
asserted.

## 10. Anti-stub / compute-not-decode protection

A do-nothing `base/continue/none` stub would pass the 7 no-gap fixtures, so the test mandates the
discriminators: `restart-28d-gap-v1` (restart/30) and `productive-floor-v1` (reentry/20) for phase;
`severe-rest`/`deload-week`/a `normal-session` fixture for intent. Anti-stub assertions require
restart/reentry outputs to differ from a base fixture. Compute-not-decode: inputs are reconstructed
from raw session dates (never re-read off the golden), and a dedicated test computes phase from
synthetic gaps with no golden involved — deleting `deriveDecision` makes the restart/reentry
fixtures fail.

## 11. Gap table tests

`TrainingDecisionGapTableUnitTests` drives the engine directly for the boundary days (3/4, 7/8,
13/14, 27/28), the no-history default, the analytics filter (trailing `completed:false` and
`dataFlag:"excluded"` ignored), future-date clamping, the 8–13d overload→reentry (`.75`) path, a
non-base persisted phase, and the `sessionIntentFor` branch order (severeFlag precedence;
controlled-reload reachable only when readiness is true).

## 12. Static guards

New: `tests/iosTrainingDecisionSwiftEngineStaticGuards.test.ts` — positive surface (entry/factory/
files/core symbols), brand lock (fileprivate init, not Codable), package-graph (IronPathDataHealth
dep, no cycle, no remote/forbidden deps), forbidden imports/macros, no-AppData-mutation +
no-clean-view-construction + no-raw-history-read, and the 14 deferred engine symbols
(applyStatusRules / buildTodayReadiness / collectPainAreasFromHistory /
mapTodayStatusToReadinessInput / buildAdaptiveDeloadDecision / clampMultiplier / riskLevelFor /
volumeModeFor / intensityModeFor / progressionModeFor / isE1rmTrendUp / roleOf /
buildTrainingLapseSignal / buildXxxUserFacing×7), plus readiness-deferral-explicit, controlled-
reload-documented, narrow-result (no full-object parity), and golden/lockfile hygiene.

Narrowed (intent preserved, not deleted):
- `iosBootstrapNoBusinessLogic.test.ts` — `buildTrainingDecision_func` gets `exemptPrefixes:
  ['ios/packages/IronPathTrainingDecision/']`; the bare name stays globally forbidden everywhere else.
- `iosBootstrapPackageGraph.test.ts` — `SANCTIONED_LOCAL_PATH_DEPS['IronPathTrainingDecision']` adds
  `'../IronPathDataHealth'`.
- `iosTrainingDecisionTypeSkeletonStaticGuards.test.ts` — drops the now-legitimate
  `effectiveTrainingPhase` ban and the `import IronPathDataHealth` ban; keeps prescription /
  supportPlan / readiness forbidden and the bare-`buildTrainingDecision` ban.
- `iosTrainingDecisionSwiftPortPlanDocsParity.test.ts` — "has no engine" narrowed to "has no
  deferred engine" (allows getEffectiveTrainingPhase; still forbids applyStatusRules /
  buildTodayReadiness / supportPlan).

## 13. Non-goals (iOS-4B3+)

exercise prescription, support plan, readiness, e1RM trend, adaptive deload, finalVolumeMultiplier,
riskLevel, volume/intensity/progression modes, the full weeklyAdjustment object, userFacing text,
the full arbitrationTrace, full-object TrainingDecision parity, controlled-reload sessionIntent,
Focus Mode, UI, HealthKit, cloud sync, Supabase, AppData mutation, raw AppData input, third-party
SwiftPM, SwiftData/CoreData/@Model/@Observable, TS runtime changes, golden changes, pnpm-lock.yaml.

## 14. Validation

`swift test` on `IronPathTrainingDecision` (4B1 decode tests + 4B2 engine/parity/gap tests) and on
all 9 packages; `node scripts/generate-parity-goldens.mjs --check` (14 fixtures / 0 changed); `npm
run typecheck`; `npm test`; `npm run build`; `node scripts/scan-production-dist-safety.mjs`;
`xcodebuild` on the IronPath workspace. No golden, package.json/lockfile, or pnpm-lock.yaml changes.

## 15. Remaining risks

- `effectivePhase` parity exercises only 3 of the 7 gap branches via goldens; the rest are covered
  by Swift unit tests (not golden parity). New fixtures with a real mesocyclePlan + 5d/10d gaps
  could extend golden coverage in a later step.
- The no-plan `persisted = base` result reproduces the TS golden artifact deterministically by
  pinning the default plan's startDate to `referenceDate`; a future fixture WITH a real
  mesocyclePlan + non-trivial startDate is outside the currently-verified envelope.
- controlled-reload sessionIntent stays deferred until readiness lands (4B3). ✅ RESOLVED in
  iOS-4B3 (readiness + e1RM ported) — see
  [`IOS_4B3_READINESS_E1RM_SLICE_V1.md`](./IOS_4B3_READINESS_E1RM_SLICE_V1.md).

## 16. Next task

**iOS-4B3 Readiness + e1RM Slice V1** — port `buildTodayReadiness` + `isE1rmTrendUp`, unlocking the
controlled-reload `sessionIntent` (flips the 4B2 deferral), `riskLevel`, `recoveryHigh`, and the
cleaned-`todayStatus` consumption. Then iOS-4B4 (deload + clamp + modes), iOS-4B5 (exercise
prescription), iOS-4B6 (userFacing + full arbitrationTrace + full-object parity).
