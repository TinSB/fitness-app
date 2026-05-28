# iOS-4A — TrainingDecision Swift Port Plan + CodeGraph Impact Audit V1

> **Status:** planning + codegraph audit only. No Swift engine code, no new
> Swift package, no TypeScript runtime change ships in iOS-4A.
> **Successor:** [`IOS_4B_TRAININGDECISION_SWIFT_PORT_IMPLEMENTATION_V1_TASK.md`](./IOS_4B_TRAININGDECISION_SWIFT_PORT_IMPLEMENTATION_V1_TASK.md)
> **Predecessor chain:** iOS-2C (AppData models) → iOS-3A (Data Health runtime) →
> iOS-3B (AutoRepairOrchestrator) → iOS-3C (ingress pipeline) → **iOS-4A (this)**.

---

## 1. Goal

Produce a safe, CodeGraph-backed implementation plan for porting the TypeScript
**TrainingDecision V2** pipeline (`buildTrainingDecision` and its clean-input
contract) into a new Swift package, so that the future iOS-4B implementation can
mirror the TS engine with byte-equal parity fixtures and static guards.

iOS-4A identifies — before any Swift algorithm code is written — every:

- source module and exported symbol in the TS TrainingDecision pipeline,
- input dependency (and the Clean Input Contract that gates it),
- output shape (the full `TrainingDecision` schema + 7 user-facing surfaces),
- caller / callee relationship (from CodeGraph),
- test requirement (Swift XCTest + TS static guard),
- and risk that could cause a silent Swift-vs-TS divergence.

The deliverable is two documents (this plan + the iOS-4B task spec) plus
docs-parity tests that lock both documents into the Vitest suite.

---

## 2. Why iOS-4A is planning / codegraph only

The TrainingDecision pipeline is the single largest behavioural surface in the
app: **~6,400 lines across 12 TS engine/presenter files**, 7 user-facing
surfaces, a 5-rule arbitration trace, and a branded clean-input contract. A
direct "port it now" attempt risks silent regressions in conservative-message
consistency, volume-floor logic, and arbitration ordering — exactly the bugs the
TS *Hard Rewrite V2* was built to kill.

iOS-4A therefore front-loads the analysis:

1. **CodeGraph impact mapping** establishes the exact caller/callee/field
   surface so iOS-4B touches nothing it does not need to.
2. **A 6-agent independent audit** captures the must-preserve behaviours, the
   clean-input contract, the Swift type map, the parity-fixture gaps, the package
   layout, and the test surface — each from a fresh perspective.
3. **Docs-parity tests** lock the plan so iOS-4B cannot silently drift from it:
   any deviation fails Vitest before a single Swift file compiles.

iOS-4A ships **3 files** (this plan, the iOS-4B task, the docs-parity tests).
It adds **no** Swift, **no** new package, **no** TS engine change, **no** fixture.

---

## 3. iOS-3C dependency confirmation

iOS-4A is based on `origin/main` at the iOS-3C merge commit `0978dc0`
(`iOS-3C Remaining Repair Recipes + Ingress Pipeline V1 (#400)`). The Swift data
immunity layer the TrainingDecision port depends on is present and green:

| Prerequisite (Swift) | File | Verified |
| --- | --- | --- |
| AppData models + real-export parity | `ios/packages/IronPathDomain/Tests/IronPathDomainTests/AppDataRealExportParityTests.swift` | 45 tests pass |
| Data Health runtime guards | `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/DataHealthRuntimeGuard.swift` | iOS-3A |
| CleanAppDataView projection | `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/CleanAppDataView.swift` + `CleanAppDataViewBuilder.swift` | iOS-3A |
| AutoRepairOrchestrator | `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/AutoRepairOrchestrator.swift` | iOS-3B |
| Repair registry (9 V1 recipes) | `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/RepairRegistry.swift` | iOS-3B/3C |
| `processIncomingAppData` ingress | `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/AppDataIngressPipeline.swift` | iOS-3C |

Baseline at iOS-4A branch creation: `swift test` for IronPathDomain (45),
IronPathDataHealth (105), IronPathPersistence (7) all pass; parity goldens
`--check` reports 0 changed across 5 fixtures.

**Critical pre-existing seam:** `AppDataIngressSource.preTrainingDecision`
already exists in `AppDataIngressPipeline.swift` with the read-only defaults
`allowMutation: false, allowAutoRepair: false, requireBackup: false,
repairTrigger: .audit`, and is listed in `forbiddenAutoRepairWithoutMutation`.
This is the canonical entry the Swift TrainingDecision flow must run *before*
building a decision (see §7).

---

## 4. CodeGraph impact table

Generated with CodeGraph MCP (`mcp__codegraph__*`) against the iOS-4A worktree
index (1,924 files / 24,922 nodes / 54,320 edges). Tools used:
`codegraph_status`, `codegraph_context`, `codegraph_callers`, `codegraph_callees`,
`codegraph_impact`, `codegraph_node`, `codegraph_explore`.

| Target file/symbol | Callers | Callees / dependencies | Data fields read | Data fields written | Affected user flow | Affected tests | Missing tests | Risk | Action required (iOS-4B) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `buildTrainingDecision` (`trainingDecisionEngine.ts:1872`) | **1**: `buildTrainingDecisionFromCleanInput` only | 25: `getEffectiveTrainingPhase`, `buildTrainingLapseSignal`, `collectPainAreasFromHistory`, `mapTodayStatusToReadinessInput`, `buildTodayReadiness`, `buildAdaptiveDeloadDecision`, `applyStatusRules`, `sessionIntentFor`, `clampMultiplier`, `volumeModeFor`, `intensityModeFor`, `progressionModeFor`, `riskLevelFor`, `roleOf`, `isE1rmTrendUp`, 7 `build*UserFacing` | `input.{template,todayStatus,history,mesocyclePlan,screening,healthSummary,useHealthDataForReadiness,adaptiveCalibration,trainingMode,nowIso,acutePainReported,injuryFlag,illnessFlag,explicitDeloadAssigned}` | **none** (pure) | Today / Plan / Training / Focus / Progress / Record / Explanation | `trainingDecisionHardRewrite*.test.ts` (12), `training-decision/normal-session-v1` golden | Swift parity test for all 7 surfaces | **High** — largest behaviour surface | Port to `TrainingDecisionEngine.swift`; pure function, no AppData mutation |
| `buildTrainingDecisionFromCleanInput` (`trainingDecisionCleanInput.ts:232`) | 5: `App.tsx:264`, `PlanView:169`, `RecordView:344`, `TodayView:212`, `scripts/parityGoldensEntry.ts:265` | `assertCleanTrainingDecisionInput`, `buildTrainingDecision` | branded `CleanTrainingDecisionInput` | none | all 4 production views + generator | `trainingDecisionCleanInputContract*.test.ts` (3) | Swift brand-rejection test | **High** — the contract gate | Port to Swift `buildTrainingDecisionFromCleanInput`; asserts brand |
| `createCleanTrainingDecisionInput` (`trainingDecisionCleanInput.ts:158`) | 6: `App.tsx`, `PlanView`, `RecordView`, `TodayView`, `parityGoldensEntry.ts`, 1 test | reads `cleanView.appData.*` (7 fields) + `cleanView.healthData.staleForReadiness` | `todayStatus, history, mesocyclePlan, screeningProfile, trainingMode, adaptiveCalibration, settings.healthIntegrationSettings.useHealthDataForReadiness` | none | all production decision sites | `trainingDecisionCleanInputContractFactory.test.ts` | Swift factory field-mapping test | **High** — only legitimate input producer | Port to `CleanTrainingDecisionInputFactory.swift` |
| `CleanTrainingDecisionInput` (type, `trainingDecisionCleanInput.ts:70`) | 14 symbols | brands `TrainingDecisionInput` | — | — | input contract boundary | type-guard tests | Swift access-control brand test | **High** — boundary integrity | Swift branded struct, package-private init |
| `buildCleanAppDataView` (`cleanAppDataView.ts:86`) | 44 symbols (TS + Swift) incl. `processIncomingAppData` (both langs), `generateTrainingDecision`, `App`, `PlanView`, `TodayView`, `RecordView` | `buildCleanSession`, `applyTodayStatusGuard`, `applyHealthDataGuard`, `applyIssueScoreCap`, `applyPerformanceDropGuard`, `buildCleanScreening` | raw `AppData.{history,activeSession,todayStatus,screeningProfile,...}` | none (projection) | every decision + ingress | `CleanAppDataViewRealExportTests.swift`, `AppDataIngressPipelineTests.swift` | (already Swift-ported, iOS-3A) | **Low** — already in Swift | iOS-4B consumes, does not re-port |
| `getEffectiveTrainingPhase` (`effectiveTrainingPhaseEngine.ts:199`) | 42 symbols incl. `buildTrainingDecision`, `applyStatusRules`, `sessionBuilder.createSession`, `planPresenter`, `App`, all 4 views | gap → activePhase derivation | `history`, `mesocyclePlan`, `referenceDate` | none | phase label on every surface | `trainingPhase*` tests | Swift gap-table parity test | **High** — reentry/restart/deload distinction | Port to `EffectiveTrainingPhaseEngine.swift`; mirror 7-row gap table exactly |
| `applyStatusRules` (`exercisePrescriptionEngine.ts:301`) | 29 symbols incl. `buildTrainingDecision`, `sessionBuilder`, `apps/api/sessionMutation`, views | `prescribeExercise`, `getEffectiveTrainingPhase` | template, todayStatus, history, screening, mesocyclePlan, externalVolumeMultiplier, externalExerciseRoleFloors | none | per-exercise prescriptions | `trainingModePrescriptionAudit.test.ts` | Swift prescription parity test | **High** — no double-trim / no all-1-set lock | Port to `ExercisePrescriptionEngine.swift`; preserve `suppressInternalDeloadStrategy` call contract |

**CodeGraph headline finding:** `buildTrainingDecision` has exactly **one**
caller — `buildTrainingDecisionFromCleanInput`. The clean-input contract is the
*only* doorway into the engine. This is the structural guarantee that lets the
Swift port enforce "no raw AppData into TrainingDecision" at the type level.

---

## 5. TypeScript source inventory

| TS file | Exported symbols (key) | Role in pipeline | Callers | Dependencies | Reads AppData? | Requires CleanAppDataView? | User-facing output? | Swift port needed? | Parity fixture needed? | Impl risk | Action recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `src/engines/trainingDecisionEngine.ts` (2097) | `buildTrainingDecision`, `TrainingDecisionSurfaceInputs`, 7 `build*UserFacing`, `sessionIntentFor`, `clampMultiplier`, mode helpers | Main entry + surface builders | `trainingDecisionCleanInput.ts` | types, phase, readiness, deload, lapse, prescription engines | No (via clean input) | Indirect (via clean input) | Yes — all 7 surfaces | **Yes** | Yes (existing + gaps) | **High** | Port to `TrainingDecisionEngine.swift` + 7 `*UserFacingBuilder.swift` |
| `src/engines/trainingDecisionTypes.ts` (448) | `TrainingDecision`, `TrainingDecisionInput`, `UserFacingMap`, 7 `*UserFacing`, ~18 string unions | Output schema | engine, presenters, views | `EffectiveTrainingPhase`, `TrainingLapseSignal` | No | No | Schema only | **Yes** | n/a (types) | Medium | Port to `TrainingDecisionTypes.swift` + per-surface files |
| `src/engines/trainingDecisionCleanInput.ts` (252) | `CleanTrainingDecisionInput`, `createCleanTrainingDecisionInput`, `buildTrainingDecisionFromCleanInput`, `isCleanTrainingDecisionInput`, `assertCleanTrainingDecisionInput`, `withCleanTrainingDecisionInputOverride` | Clean-input contract gate | 4 views + generator | `cleanAppDataView`, `TrainingDecisionInput` | reads `cleanView.appData.*` | **Yes** (input is the view) | No | **Yes** | Yes (brand-reject) | **High** | Port to `CleanTrainingDecisionInput.swift` + factory (Option A, §7) |
| `src/engines/effectiveTrainingPhaseEngine.ts` (234) | `getEffectiveTrainingPhase`, `EffectiveTrainingPhase`, `EffectivePhaseKind` | Gap→phase derivation | engine, prescription, presenters | history, mesocyclePlan | No | No | phase label | **Yes** | Yes (reentry/restart/deload) | **High** | `EffectiveTrainingPhaseEngine.swift` |
| `src/engines/exercisePrescriptionEngine.ts` (748) | `applyStatusRules`, `prescribeExercise` | Per-exercise prescription | engine, sessionBuilder, api | template, history, screening | No | No | prescriptions | **Yes** | Yes (no all-1-set) | **High** | `ExercisePrescriptionEngine.swift` |
| `src/engines/supportPlanEngine.ts` (455) | `buildSupportPlan`, `buildWeeklyPrescription` | Support / weekly prescription | engine, presenters | phase, templates | No | No | weekly items | **Yes** | Medium | Medium | `SupportingPlanEngine.swift` |
| `src/engines/readinessEngine.ts` (150) | `buildTodayReadiness`, `mapTodayStatusToReadinessInput`, `collectPainAreasFromHistory` | Readiness derivation | engine | todayStatus, history, healthSummary | No | No | readiness label | **Yes** | Yes (stale-health gate) | **High** | `ReadinessEngine.swift` |
| `src/engines/adaptiveFeedbackEngine.ts` (574) | `buildAdaptiveDeloadDecision` | Deload decision | engine | history, todayStatus, screening, templates | No | No | deload signal | **Yes** | Yes (deload-week) | **High** | `AdaptiveFeedbackEngine.swift` |
| `src/engines/trainingLapseEngine.ts` (620) | `buildTrainingLapseSignal` | Lapse signal | engine | history, nowIso | No | No | hidden debug | **Yes** | Medium | Medium | `TrainingLapseEngine.swift` |
| `src/engines/recommendationDiffEngine.ts` (89) | `recommendationSignature` | Diff signature | phase, sessionBuilder | history | No | No | diff only | **Yes** | Low | Low | `RecommendationDiffEngine.swift` |
| `src/presenters/planPresenter.ts` (353) | `buildPlanViewModel` | Plan VM presenter | PlanView | decision output | No | No | Plan VM | **No (iOS-5+)** | n/a | n/a | UI presenter — defer to iOS-5/6 |
| `src/features/TodayView.tsx` / `PlanView.tsx` / `ProgressView.tsx` / `RecordView.tsx` | view components | React UI consumers | App | engine + presenters | No | No | rendered UI | **No (iOS-5+)** | n/a | n/a | UI — defer; call site reference only |

**Inventory summary:** 9 engine files require a Swift port (≈4,500 LOC of pure
logic). The 2 presenter/view layers are explicitly *out of scope* — they are
iOS-5/iOS-6 UI work; iOS-4A records them only as the call sites that prove the
engine's public surface.

---

## 6. TrainingDecision dataflow

```
AppData (raw)
   │
   │  iOS-3C — processIncomingAppData(appData, source: .preTrainingDecision)
   │           (allowMutation:false, allowAutoRepair:false, requireBackup:false)
   ▼
AppDataIngressResult.cleanView : CleanAppDataView      ← iOS-3A projection
   │
   │  createCleanTrainingDecisionInput(view, metadata)  ← clean-input contract
   ▼
CleanTrainingDecisionInput  (branded; the ONLY engine input)
   │
   │  buildTrainingDecisionFromCleanInput(input, surfaces)  ← asserts brand
   ▼
buildTrainingDecision(input, surfaces)                  ← pure, no mutation
   │
   ├── getEffectiveTrainingPhase ......... gap → activePhase {persisted|reentry|restart|deload}
   ├── buildTrainingLapseSignal .......... lapse stage / retention
   ├── buildTodayReadiness ............... readiness level / adjustment
   ├── buildAdaptiveDeloadDecision ....... deload level / volume multiplier
   ├── sessionIntentFor .................. 5-priority intent matrix
   ├── clampMultiplier ................... volume floor (AR-1/AR-2)
   ├── applyStatusRules .................. per-exercise prescriptions (no all-1-set)
   └── 7 × build*UserFacing .............. today/plan/training/focus/progress/record/explanation
   ▼
TrainingDecision  { activePhase, sessionIntent, riskLevel, modes,
                    exercisePrescriptions, workingSetTargets,
                    muscleGroupVolumeTargets, weeklyAdjustment,
                    userFacing{7}, hiddenDebugSignals, decisionVersion:'v2' }
```

The engine is **pure**: no `Date.now()`, no `Math.random()`, no IO. `nowIso` is
the only clock. The Swift port must own no clock and no randomness — the clock is
injected (matching iOS-3A `RuntimeGuardClock`).

---

## 7. Clean input contract for Swift

**Decision: Option A — a branded Swift `CleanTrainingDecisionInput` struct
constructed only via a factory.** (Agent 2 recommendation; Agent 3 type body.)

- `CleanTrainingDecisionInput` is a `public struct` in `IronPathTrainingDecision`
  with a **package-private memberwise init**. The only `public` constructor is
  `createCleanTrainingDecisionInput(view: CleanAppDataView, metadata:
  CleanTrainingDecisionInputMetadata) -> CleanTrainingDecisionInput`.
- The engine's public entry is
  `buildTrainingDecisionFromCleanInput(_ input: CleanTrainingDecisionInput,
  surfaces: TrainingDecisionSurfaceInputs? = nil) -> TrainingDecision`.
  There is **no** public `buildTrainingDecision(input: TrainingDecisionInput…)`
  — the brand is carried by the type system, so raw AppData cannot reach the
  engine.
- Factory field-mapping (must mirror TS `trainingDecisionCleanInput.ts:158-183`
  exactly):

  | Output field | Source |
  | --- | --- |
  | `template` | `metadata.template` |
  | `todayStatus` | `view.appData.todayStatus` |
  | `history` | `view.appData.history` (lifecycle/duration/legacy stripped) |
  | `mesocyclePlan` | `view.appData.mesocyclePlan ?? nil` |
  | `screening` | `view.appData.screeningProfile` (issueScore capped, perfDrops filtered) |
  | `healthSummary` | `metadata.healthSummary` |
  | `useHealthDataForReadiness` | explicit → `false` if `view.healthData.staleForReadiness` → AppData setting → `nil` (4-way) |
  | `adaptiveCalibration` | `metadata.adaptiveCalibration ?? view.appData.adaptiveCalibration` |
  | `trainingMode` | `metadata.trainingMode ?? view.appData.trainingMode` |
  | `nowIso`, severity flags | `metadata.*` |

**Why Option A (not "pass CleanAppDataView into the engine"):**

1. iOS-3A states downstream consumers read CleanAppDataView and **never touch
   `raw.history` directly**. Option A keeps `view.raw` on the data-health side —
   the engine never holds the view, so the leak is impossible by construction.
2. iOS-3B's AutoRepairOrchestrator is the only AppData mutator and runs *before*
   the engine. Option A makes the engine input a value that **cannot be re-fed
   into the orchestrator** (it is not `AppData`).
3. iOS-3C already wires `.preTrainingDecision` as the read-only ingress source —
   that is precisely the source side of Option A.
4. Parity-test ergonomics + `Sendable` value of bounded size across actor
   boundaries.

**Mandatory production sequence (locked for iOS-4B; tests may bypass):**

```swift
let result = try processIncomingAppData(
    appData: currentAppData,
    source: .preTrainingDecision,
    clock: clock,
    options: …)
let input = createCleanTrainingDecisionInput(view: result.cleanView, metadata: …)
let decision = buildTrainingDecisionFromCleanInput(input, surfaces: …)
```

The `cleanView` passed to the factory MUST be `result.cleanView` from the same
`processIncomingAppData` call. Ad-hoc `buildCleanAppDataView(...)` in production
is forbidden (allowed in tests).

`buildTrainingDecisionContext` / `CleanTrainingDecisionContextSource` is a
**separate, deferred** concern (context layer) — NOT in iOS-4B V1 scope unless
the implementer proves it is load-bearing for parity.

---

## 8. Swift package recommendation

**A new 9th local Swift package: `IronPathTrainingDecision`** at
`ios/packages/IronPathTrainingDecision/`.

```
// swift-tools-version: 5.9
name:        "IronPathTrainingDecision"
platforms:   [.iOS(.v17)]
products:    .library(name: "IronPathTrainingDecision", targets: ["IronPathTrainingDecision"])
dependencies:
  - .package(path: "../IronPathDomain")
  - .package(path: "../IronPathDataHealth")
targets:
  - .target(name: "IronPathTrainingDecision",
            dependencies: ["IronPathDomain", "IronPathDataHealth"])
  - .testTarget(name: "IronPathTrainingDecisionTests",
                dependencies: ["IronPathTrainingDecision", "IronPathDomain", "IronPathDataHealth"])
```

**Dependency arrow is one-way:** `IronPathTrainingDecision → IronPathDataHealth →
IronPathDomain`. `IronPathDataHealth` MUST NOT import `IronPathTrainingDecision`
(circular-dependency hard blocker).

**Forbidden dependencies (none allowed):** `IronPathUIKit`, `IronPathCloudSync`,
`IronPathHealthKit`, `IronPathPersistence`, `IronPathBackup`, `IronPathL10n`,
plus `SwiftData` / `CoreData` / `HealthKit` / `Supabase`.

**Why a new package (not extend IronPathDataHealth):** repair-engine vs
decision-engine are orthogonal; the TS source already splits `src/dataHealth/`
from `src/engines/`; IronPathDataHealth already carries 105 tests; independent
release cadence; iOS-1's module table left TrainingDecision as an unfilled slot.

**xcodebuild impact (iOS-4B):** add 1 `FileRef` to
`ios/IronPath.xcworkspace/contents.xcworkspacedata`; add 6 insertion points to
`ios/IronPath.xcodeproj/project.pbxproj` (continue the sequential ID pattern
`…F9` / `…0109`); extend `tests/iosBootstrapPackageGraph.test.ts` `PACKAGES` +
`SANCTIONED_LOCAL_PATH_DEPS` (`IronPathTrainingDecision: ['../IronPathDomain',
'../IronPathDataHealth']`).

**iOS-4B MUST NOT modify** any of the 8 existing packages' Sources or
Package.swift — it is a 9th-package add plus the workspace/pbxproj/static-guard
edits only.

---

## 9. Swift type map

Full mapping in Agent 3's audit (54 TS types). Strategy summary:

- **Every TS string-literal union → `enum String, Codable, CaseIterable,
  Sendable`** with rawValue identical to the TS literal (hyphens/underscores
  preserved; case labels camelCased). 18 unions total. Only visual collision is
  `RiskLevel.none` (no actual conflict with `Optional.none`).
- **Every TS interface → `public struct: Equatable, Hashable, Sendable`** with
  hand-rolled `init(decoding: JSONValue)` + `encoded() -> JSONValue` (the iOS-2C
  `ExercisePrescription` pattern).
- **`micro?: Record<string,string>` → `OrderedJSONObject?`** (open bag,
  string-value-validated, omit-when-nil).
- **`hiddenDebugSignals.exerciseRoleFloors: Record<ExerciseRole, number>` →
  typed `ExerciseRoleFloors` struct** (closed 4-key shape, `NumberRepr` values).
- **`decisionVersion: 'v2'` → single-case `enum String DecisionVersion { case v2 }`**
  (future-proof; unknown version → `decodeFailed`).
- **`WeeklyAdjustmentDecision.blockedBy?: T | null` → `BlockedBy?`** collapsing
  `null`/absent to `nil` (TS never emits explicit `null` here).
- **`WorkingSetTarget.targetReps: [number, number]` → `[Int]`** with length-2
  invariant.
- **`TrainingDecision` carries a top-level `_unknown: OrderedJSONObject`** for
  forward-compat (iOS-2C pattern).

**Dependent types that must exist in `IronPathDomain` before iOS-4B (action
item):** confirm or add `ReadinessResult`, `DeloadDecision`, `MesocycleWeek`,
and the string enums `DeloadLevel` / `DeloadStrategy` / `ReadinessLevel` /
`ReadinessAdjustment`. `EffectiveTrainingPhase` and `TrainingLapseSignal` live in
`IronPathTrainingDecision` (engine-internal), not Domain.

`UserFacingPerSurface` (TS reflection shim) and `TrainingDecisionInput` (engine
input, never serialized) are **not** ported as output types.

---

## 10. userFacing output map

7 surfaces, all populated unconditionally on every decision. Each shares the base
shape (`surfaceId`, `headline`, `oneLineAdvice?`, `riskBadge?`,
`primaryActionLabel?`, `micro?`) plus a surface-specific structured payload.

| Surface | `surfaceId` | Structured payload (key fields) | Notes |
| --- | --- | --- | --- |
| Today | `today` | `decisionState`, `heroLabel/Title/Explanation`, `decisionStateLabel`, `readinessLabel`, `focusLabel`, `safetyLabel`, `secondaryActionLabel?`, `severeNotice?`, `showFocusOverride`, `showDataHealthSummary` | 8-state decision machine |
| Plan | `plan` | `title`, `summary`, `weeklyDirection`, `weeklyItems: [WeeklyProgressionItemView]` | item ID `weekly-progression:<weekId>:…` |
| Training | `training` | `explanationTitle/Summary`, `explanationFactors` | derives from explanation |
| Focus | `focus` | `explanationTitle/Summary`, `explanationFactors` | structurally identical to training |
| Progress | `progress` | `insightState`, `heroTitle/Explanation`, `primaryRecommendation`, `readinessLabel`, `recoveryPressureLabel`, `caution?`, `effectiveSetExplanation`, `volumeExplanation`, `dataCoverageHint`, `strengthTrendItems` | 9-state progress copy machine |
| Record | `record` | `nextTimeHint`, `perExercise: [PostWorkoutItemView]` | item ID `post-workout-next-time:<sessionId>:<exerciseId>` |
| Explanation | `explanation` | `title`, `summary`, `primaryFactors`, `secondaryFactors`, `warnings` | `oneLineAdvice` is **overridden** to `阶段：…；方向：…。` (only surface that does) |

**Recommendation:** Swift `UserFacingSurface` protocol + concrete structs (not a
tagged-union enum) — the TS JSON is a keyed object `{today:…, plan:…}` with
sparse keys, which maps 1:1 to `struct UserFacingMap { var today: TodayUserFacing?
… }`. `surfaceId` is verified on decode (mismatch → `decodeFailed`).

**Parity caveat:** the existing golden serializes all 7 surfaces in full — these
are the byte-match targets (Agent 1 §3 lists every expected string).

---

## 11. hiddenDebug / arbitration trace map

`HiddenDebugSignals` (9 fields): `effectivePhase`, `lapse | null`, `readiness`,
`deloadDecision`, `arbitrationTrace: [String]`, `finalVolumeMultiplier`,
`exerciseRoleFloors`, `weeklyBlockReasons`, `progressClarityTripletSuppressed`.

**Parity projection caveat (critical):** the existing golden's
`hiddenDebugSignals` contains **only `arbitrationTrace`**. The other 8 fields
exist in the in-memory `TrainingDecision` but are NOT in the golden — the parity
harness projects `arbitrationTrace` only. The Swift port must still *produce* all
9 fields; the parity test compares `arbitrationTrace` (plus `decisionVersion` and
`userFacing`).

**Arbitration trace codes (deterministic order — byte-matched array):**

| Code | Fired when | Source |
| --- | --- | --- |
| `AR-1-severe-override` | `severeFlag` (acutePain/injury/illness) | engine:1915 |
| `AR-1-severe-cut` | severe inside `clampMultiplier` | engine:173 |
| `AR-2-reentry-override` | intent becomes `reentry-productive` | engine:1927 |
| `AR-2-reentry-clamp-deload(<x>-><y>)` | reentry/restart clamp; **dynamic numeric suffix** (`toFixed(2)`) | engine:181 |
| `AR-2-min-not-product` | non-reentry deload clamp | engine:186,190 |
| `AR-3-productive-floor` | after reentry role-floor selection | engine:1939 |
| `AR-4-weekly-blocked-by-phase` | weeklyDirection blocked by phase | engine:1992 |
| `AR-5-controlled-reload` | intent `controlled-reload` | engine:1928 |
| `AR-5-progress-clarity-suppressed` | `intent !== 'normal-session'` | engine:2008 |

Append order: AR-1 → intent → clampMultiplier → AR-3 → AR-4 → AR-5. The type
comment says "AR-1..AR-9" but only AR-1..AR-5 are emitted today.

Existing golden's locked trace:
`["AR-2-reentry-override","AR-2-min-not-product","AR-3-productive-floor","AR-4-weekly-blocked-by-phase","AR-5-progress-clarity-suppressed"]`
(the `normal-session-v1` fixture actually exercises the **reentry-productive**
path despite its name).

---

## 12. Parity fixture strategy

**iOS-4A documents the gaps; iOS-4B adds the fixtures (only if load-bearing).**
iOS-4A generates **no** fixtures and regenerates **no** goldens.

The existing `training-decision/normal-session-v1` fixture pins one non-trivial
path (`reentry-productive` + low-data progress). It does NOT certify the other
intent branches. Documented gap list for iOS-4B (priority H = highest):

| Target fixture name | Branch covered | Priority |
| --- | --- | --- |
| `severe-rest-v1` | `severe-rest` intent (AR-1) | H |
| `controlled-reload-v1` | `controlled-reload` intent (AR-5) | H |
| `deload-week-v1` | `deload-week` intent | H |
| `stale-today-status-v1` | data-health todayStatus gate | H |
| `stale-health-data-v1` | `useHealthDataForReadiness=false` gate | H |
| `normal-session-baseline-v1` | true `normal-session` (empty trace) | M |
| `capped-issue-score-v1` | issueScore cap path | M |
| `performance-drop-filtered-v1` | perfDrop strip path | M |
| `today-with-plan-v1` | `today.decisionState=ready` flow | M |
| `empty-history-v1` | empty history baseline | L |
| `first-ever-session-v1` | no template history | L |
| `reentry-clamp-deload-v1` | `AR-2-reentry-clamp-deload(…)` numeric suffix | L |

**Bias for iOS-4B:** synthetic, minimum-depth inputs (privacy-clean, small diffs)
over redacted-pointer wrappers.

**Golden-drift discipline:** the golden is pinned to
`tsCommit=e542ffabb1fb7e8982582f2f0bc2363f83f59b15`. Any TS engine change before
iOS-4B requires `node scripts/generate-parity-goldens.mjs` regeneration +
`tsCommit` bump. iOS-4B's first commit must run `--check` and land any "TS engine
drift refresh" as a **separate** commit from "add new coverage". iOS-4A never
auto-regenerates; it relies on `tests/parityFixturesGenerationConsistency.test.ts`.

---

## 13. Swift test plan (iOS-4B deliverable)

6 XCTest classes / **22 numbered tests** under
`ios/packages/IronPathTrainingDecision/Tests/IronPathTrainingDecisionTests/`:

| Test class | Tests | Validates |
| --- | --- | --- |
| `TrainingDecisionParityNormalSessionTests` | 3 | byte-equal vs golden; deterministic clock; no `控制风险` |
| `TrainingDecisionUserFacingShapeTests` | 4 | AR-6/AR-7/AR-9; forbidden triplet co-occurrence |
| `TrainingDecisionCleanInputContractTests` | 4 | brand reject; factory stamp; no legacy advice |
| `TrainingDecisionArbitrationTraceTests` | 6 | AR-1..AR-5 traceability |
| `TrainingDecisionEngineShapeTests` | 5 | `decisionVersion=="v2"`; all fields; determinism; signal-only adjustment/today |
| `TrainingDecisionRealExportParityTests` | 3 | `#filePath` real-export; stable + idempotent + no-mutation (NO TS golden byte-compare — iOS-2C decision) |

The canary is `TrainingDecisionParityNormalSessionTests.testNormalSessionParityFixtureIsByteEqualToGolden`
— if it goes red, the Swift canonical-JSON serializer diverged from
`scripts/parityGoldensEntry.ts` and must be fixed before any other red.

---

## 14. TS static guard plan (iOS-4B deliverable)

New file `tests/iosTrainingDecisionSwiftEngineStaticGuards.test.ts`, mirroring the
iOS-3B/3C `ios*StaticGuards` pattern (walk `collectSwift(...)`):

1. **Required Swift source + test files exist** at expected paths.
2. **Forbidden imports:** `IronPathPersistence/CloudSync/HealthKit/UIKit/Backup/
   L10n`, `SwiftData`, `CoreData`, `HealthKit`, `Supabase`, plus `@Model` /
   `@Observable`.
3. **No AppData mutation:** `.history.append`, `.appData.history =`,
   `.appData.todayStatus =`, `mutating func …(… AppData …)`.
4. **No orchestrator inside engine:** `AutoRepairOrchestrator`,
   `runAutoRepairOrchestrator(`, `processIncomingAppData(`.
5. **No IO:** `FileManager`, `URLSession`, `URL(fileURLWithPath:`, `Bundle.main`.
6. **Entry signature** consumes `CleanTrainingDecisionInput`, not raw `AppData`;
   `CleanTrainingDecisionInput` has `private init` + public factory.
7. **Package.swift dep lock:** exactly `../IronPathDomain` + `../IronPathDataHealth`,
   no `.package(url:`, one library/target/testTarget, iOS 17, swift-tools 5.9.

**Existing-test evolutions iOS-4B must land** (iOS-4A only documents them):

| Test | Change |
| --- | --- |
| `tests/iosBootstrapPackageGraph.test.ts` | add `IronPathTrainingDecision` to `PACKAGES` + `SANCTIONED_LOCAL_PATH_DEPS` |
| `tests/iosBootstrapForbiddenImports.test.ts` | include new package in scan |
| `tests/iosBootstrapNoBusinessLogic.test.ts` | sanction `buildTrainingDecision`/`TrainingDecision` inside `IronPathTrainingDecision/Sources/**` only |
| `tests/iosBootstrapProjectStructure.test.ts` | add package to children enumeration |
| `tests/iosBootstrapTargetSettings.test.ts` | add package to allowlist |
| `tests/iosDataHealthRuntimeFoundationStaticGuards.test.ts` | sanctioned-prefix carve-out for `IronPathTrainingDecision/Sources/` (the `TrainingDecision_type` guard scans all of `ios/`) |

`iosAutoRepairOrchestratorSafeRecipesStaticGuards.test.ts` and
`iosRemainingRepairRecipesIngressPipelineStaticGuards.test.ts` are scoped to
`IronPathDataHealth/Sources` and need **no** change.

---

## 15. Implementation checklist for iOS-4B

1. Create `ios/packages/IronPathTrainingDecision/` with the §8 `Package.swift`.
2. Add the workspace + pbxproj entries (§8) and extend
   `iosBootstrapPackageGraph.test.ts` PACKAGES + SANCTIONED_LOCAL_PATH_DEPS.
3. Confirm (or add under iOS-2C) the Domain dependent types from §9.
4. Port in order: **types → input contract → sub-engines → main entry →
   UserFacing builders** (§5 + Agent 5 file list, ~20-28 source files).
5. Mirror the must-preserve behaviours from Agent 1 §1 exactly (gap table,
   intent matrix, clampMultiplier floors, role floors, weeklyDirection block,
   AR-1..AR-5 order, all 7 surface copy tables).
6. Add the 6 Swift XCTest classes (§13) + the TS static guard file (§14) + the 6
   existing-test evolutions.
7. Run `--check`; land any TS-engine-drift golden refresh as a **separate**
   commit before adding new fixtures (§12).
8. Add the gap fixtures from §12 only where load-bearing for parity.
9. Do NOT modify the 8 existing packages' Sources/Package.swift.
10. Validate (§14 plan): `swift test` ×9 packages + `xcodebuild` ×2 destinations
    + full TS suite + parity `--check` + scan + lockfile clean.

---

## 16. Non-goals (iOS-4A and iOS-4B V1)

- **iOS-4A** ships no Swift, no new package, no TS engine change, no fixture, no
  golden regeneration, no edits to existing static-guard tests. Exactly 3 files:
  this plan, the iOS-4B task, the docs-parity tests.
- **iOS-4B** does NOT port: `planPresenter` / `TodayView` / `PlanView` /
  `ProgressView` / `RecordView` (UI — iOS-5/6); `buildTrainingDecisionContext` /
  `CleanTrainingDecisionContextSource` (deferred unless load-bearing); cloud
  upload eligibility (iOS-7); HealthKit (iOS-8+); Focus Mode (iOS-5); Supabase /
  cloud sync (iOS-7+).
- **Neither** introduces: third-party SwiftPM, SwiftData, CoreData, `@Model`,
  `@Observable` on AppData model types, AppData schema changes, TS runtime
  behaviour changes, `pnpm-lock.yaml`, auto-merge, production deploy,
  branch-protection bypass, `--admin`.

---

## 17. Risks

| # | Risk | Severity | Mitigation (iOS-4B) |
| --- | --- | --- | --- |
| R1 | `AR-2-reentry-clamp-deload(0.60->0.65)` numeric suffix — Swift `String(format:)` rounding ≠ JS `toFixed(2)` | High | `String(format:"%.2f",…)`; add a fixture at a `.005` boundary |
| R2 | Arbitration trace **order** drift (append order) | High | Implement appends in the exact statement order of engine:1912-2008; comment line refs |
| R3 | Plan item ID format + un-escaped Chinese `targetLabel` | High | Literal format string; never URL-encode |
| R4 | Explanation `oneLineAdvice` override missed | Medium | Explicit override, not shared advice var |
| R5 | Headline ≤60 fallback — `String.count` vs JS `string.length` for CJK | Medium | Use `utf16.count`; fixture near 60 chars |
| R6 | `isE1rmTrendUp` per-exercise-per-session top accumulation | Medium | Mirror inner loop; multi-exercise fixture |
| R7 | Effective-phase 8-13d conditional override | Medium | Mirror 4-way switch; fixtures for `(10d, build)` vs `(10d, deload)` |
| R8 | `useHealthDataForReadiness` 4-way precedence | Medium | Explicit 4-branch; stale-health + true-setting fixture |
| R9 | Circular dep `IronPathDataHealth → IronPathTrainingDecision` | High | One-way arrow; `iosBootstrapPackageGraph` trip-wire |
| R10 | Golden drift between iOS-4A and iOS-4B | Medium | `--check` first; separate refresh commit; `tsCommit` match in Swift runner |
| R11 | hiddenDebugSignals projection mismatch (only arbitrationTrace in golden) | Medium | Project only `arbitrationTrace` in parity comparison |
| R12 | Number precision (`NumberRepr` int-vs-double) | Medium | iOS-2C `NumberRepr` strategy; integer floors as `.integer` |
| R13 | Canonical key order ≠ TS `localeCompare` | Medium | Reuse iOS-2C `canonicalKeyOrder()` verbatim |
| R14 | Package-count drift (8→9) docs inconsistency | Low | Update iOS-1 §4 table + architecture map in iOS-4B |

---

## 18. Final verdict

The TrainingDecision pipeline is **portable to Swift** with byte-equal parity,
provided iOS-4B:

1. lands it as the **9th package `IronPathTrainingDecision`** (deps:
   `IronPathDomain` + `IronPathDataHealth` only, one-way arrow);
2. enforces the **Clean Input Contract (Option A)** — branded struct, factory-only,
   `.preTrainingDecision` ingress upstream;
3. preserves the **must-preserve behaviour set** (Agent 1 §1) with the
   high-risk items (R1-R8) covered by dedicated fixtures;
4. ships the **6 XCTest classes + the TS static-guard file + 6 existing-test
   evolutions** (§13-14);
5. treats the **existing golden's projection** (decisionVersion + userFacing +
   arbitrationTrace) as the byte-match target and adds gap fixtures only where
   load-bearing.

iOS-4A's CodeGraph audit confirms the engine has a **single doorway**
(`buildTrainingDecisionFromCleanInput`), is **pure** (no mutation, no IO, clock
injected), and that all 8 prerequisite Swift layers are present and green at
`0978dc0`. **Recommendation: proceed to iOS-4B.**
