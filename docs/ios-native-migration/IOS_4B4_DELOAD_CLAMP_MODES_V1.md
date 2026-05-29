# iOS-4B4 — Deload + Clamp + Modes V1

Status: implemented. Swift-only + TS-guard/doc-only — no TS runtime, golden fixture,
AppData schema, or lockfile change. Builds on iOS-4B3 (readiness + e1RM) which built on
iOS-4B2 (effectivePhase + sessionIntent core slice).

## 1. Goal

Port the minimal TrainingDecision arbitration primitives needed to match the existing
golden fields the prior slices left unasserted:

- `finalVolumeMultiplier`
- `volumeMode` / `intensityMode` / `progressionMode`

while keeping `riskLevel` / `sessionIntent` / `effectivePhase` (from 4B2/4B3) correct.
This is the slice that turns the narrow `TrainingDecisionCoreSlice` into one that
carries the full set of *scalar arbitration outputs* — without yet touching exercise
prescription, target sets, or userFacing copy.

## 2. Why 4B4 follows 4B3

`intensityMode` is `intensityModeFor(intent, readiness.trainingAdjustment)`
(`trainingDecisionEngine.ts:1998`). For the four base normal-session fixtures the golden
`intensityMode` is `cap`, which for a `normal-session` intent is only reachable when
`trainingAdjustment == conservative`. That, in turn, needs the readiness score to be
`< 65` — which only happens once the **time-gap penalty** (deferred in 4B3) is added:
push-a `duration = 70` minus default `time = 60` → gap 10 → `-4` → score 64. So the
deload/clamp/modes slice cannot be asserted without first completing the 4B3 readiness
math. 4B4 does both together.

## 3. Scope: deload + clamp + modes only

Ported TS → Swift:

| TS (source) | Swift |
| --- | --- |
| `clampMultiplier` (`trainingDecisionEngine.ts:163`) | `TrainingDecisionModes.clampMultiplier` |
| `volumeModeFor` / `intensityModeFor` / `progressionModeFor` (212/221/234) | `TrainingDecisionModes.*` |
| `phaseToVolumeFloor` + `SEVERE/REENTRY/RESTART_VOLUME_FLOOR` (96-125) | `TrainingDecisionModes` |
| `buildAdaptiveDeloadDecision` SUBSET (`adaptiveFeedbackEngine.ts:472`) | `TrainingDecisionDeload.buildAdaptiveDeloadDecision` |
| readiness time-gap penalty + health delta + `Math.round` (`readinessEngine.ts:68-102`) | `TrainingDecisionReadiness` |
| `effectiveWeek.volumeMultiplier` resolution (`effectiveTrainingPhaseEngine.ts:209`) | `EffectiveTrainingPhase.effectiveWeekVolumeMultiplier` |

## 4. Readiness math completion from 4B3

Three pieces 4B3 deferred, now in `buildReadinessResult`:

- **Time-gap penalty** (`readinessEngine.ts:68-72`): `gap = plannedTimeMin - availableTimeMin`;
  `-15` if `gap >= 30`, `-8` if `>= 15`, else `-4`. `availableTimeMin = Number(todayStatus.time)`;
  `plannedTimeMin = template.duration` (carried as `templateDurationMin`). nil planned / nil
  available → no penalty (mirrors the TS truthy + `NaN < x == false`).
- **Health-summary delta** (`readinessEngine.ts:74-100`): consumes a caller-supplied
  `HealthSummary` value. The sample→summary aggregation (`buildHealthSummary`) is **deferred**
  (iOS-4B5) — NO fixture exercises the delta (every fixture has 0 health samples, and
  stale-health-data-v1 resolves `useHealthDataForReadiness=false`, gating it off). The
  engine passes `healthSummary: nil`; the delta is exercised only by unit tests.
- **`Math.round`** (`readinessEngine.ts:102`) via `jsRound` (= `floor(x + 0.5)`). A structural
  no-op today (every score delta is an integer literal) but ported for fidelity + pinned by a
  unit test.

The `-4` does NOT change any readiness LEVEL bucket (64 stays medium, 40 stays low), so
the 4B3 `riskLevel`/`sessionIntent` parity is unchanged.

## 5. finalVolumeMultiplier

`clampMultiplier(effectivePhase, deload, severeFlag)`:

- `severeFlag` → `min(effectiveWeekVolumeMultiplier, 0.3)` (severe floor), reason `AR-1-severe-cut`.
- else a triggered deload with `deload.volumeMultiplier < phaseFloor` and `activePhase != deload`:
  reentry/restart clamp UP to the phase floor (`max`), other phases clamp DOWN (`min`).
- else a triggered deload clamps DOWN (`min`).
- else the `effectiveWeekVolumeMultiplier` passes through unchanged.

Fixture results (all 9 expanded goldens match):

| fixture | activePhase | deload | finalVolumeMultiplier |
| --- | --- | --- | --- |
| clean-input / no-legacy / stale-today / stale-health | base | none | 0.9 (base effectiveWeek) |
| controlled-reload | base | watch (0.9) | 0.9 = min(0.9, 0.9) |
| deload-week | base | none | 0.9 (explicit deload drives intent, not multiplier) |
| productive-floor | reentry | none | 0.65 (reentry effectiveWeek) |
| restart-28d-gap | restart | none | 0.5 (restart effectiveWeek — below its 0.55 floor) |
| severe-rest | base | — | 0.3 (severe floor) |

`restart`'s 0.5 is deliberately below the restart floor 0.55: it is the effectiveWeek
value passing through (no deload triggered), not a floor clamp.

## 6. volumeMode / intensityMode / progressionMode

`volumeModeFor(intent, multiplier)`, `intensityModeFor(intent, trainingAdjustment)`,
`progressionModeFor(intent, e1rmTrendUp)` ported verbatim. All 9 expanded goldens match:

| fixture | volumeMode | intensityMode | progressionMode |
| --- | --- | --- | --- |
| base normal-session ×4 | trim | cap | hold |
| controlled-reload | trim | cap | reload |
| deload-week | trim | cap | hold |
| productive-floor | reentry-floor | cap | hold |
| restart-28d-gap | reentry-floor | cap | hold |
| severe-rest | severe-cut | cut | pull-back |

The normal-session `cap` is the load-bearing case: it requires `trainingAdjustment == conservative`
from the time-gap penalty (§4).

## 7. Clean input contract

Unchanged brand (`CleanTrainingDecisionInput`, fileprivate-init, factory takes a
`CleanAppDataView`). New: the metadata + branded input carry `templateDurationMin`
(= `template.duration`), used only for the readiness time-gap penalty. The full template
arrives with the prescription slice (iOS-4B5). No raw AppData reaches the engine.

## 8. Files changed

New Swift: `TrainingDecisionModes.swift`, `TrainingDecisionDeload.swift`.
Edited Swift: `TrainingDecisionReadiness.swift` (time-gap + health delta + jsRound +
`HealthSummary`), `EffectiveTrainingPhase.swift` (`effectiveWeekVolumeMultiplier` +
`weekVolumeOverride`), `TrainingDecisionCoreSliceEngine.swift` (deload/clamp/modes wired;
`templateDurationMin` on metadata/input/factory; 5 new slice fields).
New tests: `TrainingDecisionModesTests`, `TrainingDecisionDeloadParityTests`,
`TrainingDecisionReadinessMathTests`. Edited tests: `TrainingDecisionCoreSliceParityTests`
(+4 mode/multiplier parity methods), `CoreSliceTestSupport` (templateDurationMin=70 default,
`sessionWithStatus`, `time`).
New TS guard: `tests/iosTrainingDecisionDeloadClampModesStaticGuards.test.ts`.
Edited TS guards: `iosTrainingDecisionSwiftEngineStaticGuards`,
`iosTrainingDecisionReadinessE1RMSliceStaticGuards` (deload/clamp/modes moved out of the
forbidden lists). Docs: this file + cross-refs in IOS_4B3 + IOS_4B task.

## 9. Tests added

`swift test` IronPathTrainingDecision: **70 → 105** (+35): mode/multiplier parity over all
9 expanded goldens; clampMultiplier branch table + the three modeFor tables; deload scoring
(level/strategy/volumeMultiplier table, per-contributor thresholds, controlled-reload watch,
restart-none deferral safety, deliberate-deload, severe-more-conservative); readiness math
(time-gap buckets + boundaries, health delta per-branch + gating, jsRound half-up, the
trainingAdjustment flip).

## 10. Static guards

New `iosTrainingDecisionDeloadClampModesStaticGuards`: deload/modes files present;
`buildAdaptiveDeloadDecision` / `clampMultiplier` / `*ModeFor` present + scoped to the
package; `finalVolumeMultiplier` computed; readiness time-gap/health-delta/jsRound present;
prescription / roleOf / supportPlan / userFacing / arbitrationTrace builder /
`buildHealthSummary` / `buildTrainingLapseSignal` still forbidden; no cloud/HealthKit/
persistence/UI imports; no AppData mutation; golden + lockfile hygiene. The 4B2 engine guard
and 4B3 readiness guard had deload/clamp/mode symbols removed from their forbidden lists.

## 11. Non-goals (iOS-4B5+)

No exercise prescription, role floors, target sets, support plan object, full
weeklyAdjustment object, userFacing text builders, full ordered arbitrationTrace, Focus
Mode, UI, HealthKit, cloud sync, Supabase, AppData mutation, raw AppData input, third-party
SwiftPM, SwiftData/CoreData/@Model/@Observable. The deload's lapse-reset early return and
recoveryTemplate/autoSwitchTemplateId are deferred (proven golden-neutral). `buildHealthSummary`
aggregation is deferred (no golden exercises the health delta).

## 12. Validation

`swift test` ×9 packages green (IronPathTrainingDecision 105). `parity --check` 14/0; no
golden git change. `npm test` green; `typecheck` / `api:dev:build` / `build` /
`scan-production-dist-safety` clean. `git diff` package.json/lockfiles empty; `pnpm-lock.yaml`
absent. `xcodebuild` generic + iPhone 17 Pro BUILD SUCCEEDED.

## 13. Remaining risks

- The health-summary delta is ported but unexercised by goldens (unit-tested only); the
  sample→summary aggregation (`buildHealthSummary`) lands with iOS-4B5 — when it does, the
  stale-health gating must continue to keep stale-health-data-v1 at delta 0.
- The deload lapse-reset is deferred. It is golden-neutral today (restart score is 0
  regardless); a future fixture with a long gap AND poor recent status would need the full
  `buildTrainingLapseSignal` port to stay faithful.
- `Math.round` is a structural no-op while every delta is an integer; a future fractional
  penalty would make `jsRound` semantically load-bearing (a unit test pins its half-up rule).

## 14. Next task

**iOS-4B5 Exercise Prescription + Volume Floor V1** — port `applyStatusRules` /
`roleOf` / role floors / target sets / `perExercise` / `allTargetSets`, consuming the
`finalVolumeMultiplier` + the kind floors this slice produces, plus the full template
(beyond `duration`) and `buildHealthSummary`. Then iOS-4B6 userFacing + full
arbitrationTrace + full-object parity.
