# iOS-4B1 — TrainingDecision Swift Type Skeleton V1

> **Status:** Swift type skeleton only. A new `IronPathTrainingDecision`
> package with Codable-style golden decode types — NO engine logic, NO
> algorithm, NO AppData read/mutate, NO Cloud/HealthKit/UI/Supabase.
> **Predecessor:** [`IOS_4B0_TRAININGDECISION_PARITY_FIXTURE_EXPANSION_V1.md`](./IOS_4B0_TRAININGDECISION_PARITY_FIXTURE_EXPANSION_V1.md)
> **Successor:** iOS-4B2 TrainingDecision Core Rule Skeleton V1 (§15).

---

## 1. Goal

Create the 9th local Swift package `IronPathTrainingDecision` containing a
Codable-style **type skeleton** that decodes all 10 training-decision golden
fixtures (the iOS-4B0 suite). This proves Swift understands the TrainingDecision
golden output shape — narrow `normal-session-v1` and the 9 expanded fixtures —
**before** any algorithm is ported.

## 2. Why this comes before the engine port

Porting `buildTrainingDecision` directly would couple two risks: the type/shape
contract AND the algorithm. iOS-4B1 isolates the first: it lands decode types +
24 Swift decode tests that lock the golden shape, so iOS-4B2's engine port is a
fill-in-the-logic exercise whose output already has a typed Swift home and a
match-the-golden test bar. A decode failure in 4B1 is a pure shape problem,
never an algorithm problem.

## 3. iOS-4B0 dependency confirmation

Branched from `origin/main` at `34d5f5d` (iOS-4B0 merge). Present + green:
- `docs/ios-native-migration/IOS_4B0_TRAININGDECISION_PARITY_FIXTURE_EXPANSION_V1.md`
- 10 goldens under `tests/fixtures/parity/golden/training-decision/`.
- Baseline: `node scripts/generate-parity-goldens.mjs --check` → 14 fixtures / 0
  changed; `npm run typecheck` clean; `swift test` IronPathDomain (45) +
  IronPathDataHealth (105) pass.

## 4. Package layout

```
ios/packages/IronPathTrainingDecision/
├── Package.swift                      # swift-tools 5.9, iOS 17, deps: ../IronPathDomain ONLY
├── Sources/IronPathTrainingDecision/
│   ├── IronPathTrainingDecision.swift # version constant (bootstrap convention)
│   ├── TrainingDecision.swift         # top-level decode type
│   ├── TrainingDecisionUserFacing.swift (in TrainingDecisionSurfaces.swift)
│   ├── TrainingDecisionSurfaces.swift # UserFacingSurface (JSONValue-backed) + map
│   ├── TrainingDecisionHiddenDebug.swift # HiddenDebugSignals + perExercise + cleanInput + …
│   ├── TrainingDecisionArbitrationTrace.swift # ArbitrationTraceItem parser
│   ├── TrainingDecisionEnums.swift    # SessionIntent/ActivePhase/RiskLevel/… (raw String)
│   ├── TrainingDecisionGolden.swift   # ParityGoldenEnvelope
│   └── TrainingDecisionJSONSupport.swift # JSONValue extraction helpers
└── Tests/IronPathTrainingDecisionTests/
    ├── TrainingDecisionGoldenFixtures.swift     # #filePath golden loader
    ├── TrainingDecisionGoldenDecodeTests.swift
    ├── TrainingDecisionUserFacingDecodeTests.swift
    ├── TrainingDecisionHiddenDebugDecodeTests.swift
    └── TrainingDecisionShapeStabilityTests.swift
```

**Dependency:** `../IronPathDomain` ONLY. The type skeleton needs `JSONValue`;
it does NOT need `IronPathDataHealth` (that arrives in iOS-4B2 when the engine
consumes `CleanAppDataView`). No Cloud / HealthKit / Persistence / UIKit /
Backup / L10n; no remote SwiftPM.

## 5. Type files created

- `TrainingDecision` — top-level golden type. Always-present fields
  (`sourceFixtureId`, `decisionVersion`, `userFacing`, `hiddenDebugSignals`)
  required; the 18 expanded-only fields (`sessionIntent`, `activePhase`,
  `riskLevel`, modes, `finalVolumeMultiplier`, `exerciseRoleFloors`,
  `perExercise`, `cleanInput`, `effectivePhase`, `weeklyAdjustment`, …)
  **optional** so the narrow `normal-session-v1` decodes; a `_unknown`
  `OrderedJSONObject` preserves any future top-level key. Typed enum accessors
  (`sessionIntentEnum`, …) never fail decode (raw `String` storage).
- `TrainingDecisionUserFacing` + `UserFacingSurface` — 7 optional surfaces; each
  surface preserved as the full `JSONValue` open bag + typed common accessors
  (`surfaceId`, `headline`, `oneLineAdvice`, `micro`). This decodes every
  surface (incl. severe-rest's optional `riskBadge`) without freezing
  surface-specific payloads.
- `HiddenDebugSignals` (`arbitrationTrace: [String]`), `ArbitrationTraceItem`
  (AR-`<n>`-`<slug>` parser), `PerExerciseSummary`, `EffectivePhaseSummary`,
  `WeeklyAdjustment`, `CleanInputEvidence` + `CleanInputDiagnostics`,
  `InputEvidence`, `ParityGoldenEnvelope`.
- Enums: `DecisionVersion`, `SessionIntent`, `ActivePhase`, `RiskLevel`,
  `VolumeMode`, `IntensityMode`, `ProgressionMode` (raw-String, `CaseIterable`).

**Decode idiom:** the codebase's `init(decoding value: JSONValue) throws` +
`encoded() -> JSONValue` (iOS-2C `ExercisePrescription` pattern), NOT Swift
`Codable` — `JSONValue` is hand-rolled and not `Codable`. Open/unstable nested
fields stay `JSONValue`.

## 6. Golden fixtures decoded

All 10 decode (24 Swift tests pass): `normal-session-v1` (narrow),
`severe-rest-v1`, `controlled-reload-v1`, `deload-week-v1`,
`stale-today-status-v1`, `stale-health-data-v1`, `restart-28d-gap-v1`,
`productive-floor-v1`, `no-legacy-advice-v1`, `clean-input-contract-v1`. Read
from the canonical repo tree via `#filePath` walk-up — no copies, no drift.

## 7. userFacing schema coverage

All 7 surfaces (`today/plan/training/focus/progress/record/explanation`) decode
for every golden, each exposing its `surfaceId` discriminator + typed common
fields, with the full surface payload preserved as `JSONValue`. The
some-but-not-all `today.riskBadge` (present only in severe-rest-v1) is captured
by the open bag without breaking the other 9.

## 8. hiddenDebug / arbitration trace coverage

`hiddenDebugSignals` is exactly `{ arbitrationTrace: [String] }` across all 10.
The trace decodes as an ordered `[String]` (order preserved + asserted against
the raw JSON), and `ArbitrationTraceItem` parses each `AR-<n>-<slug>` code.
`perExercise` + hyphen-keyed `exerciseRoleFloors` decode into typed summaries.

## 9. Optional / narrow normal-session handling

`normal-session-v1` is exactly the 5-key narrow projection (no top-level engine
fields). Every expanded-only field is modelled `Optional`, so the narrow golden
decodes with those fields `nil` (`isNnarrowProjection == true`), while the 9
expanded fixtures populate them. This is the all-or-nothing narrow/expanded
split confirmed by the audit — no field is present in some-but-not-all *expanded*
fixtures at the top level.

## 10. Tests added

24 Swift tests across 4 classes (assertions 1-16 of the task): discovery, all-10
decode, narrow decode, expanded structured fields, all-7 surfaces, hiddenDebug,
arbitration order, perExercise, productive-floor compounds≥2, severe-rest
all-1-set, no-legacy cleanInput evidence, clean-input diagnostics, round-trip
stability, unknown-future-key tolerance, no-decision-computation, value-only
type.

## 11. Static guards

- **New** `tests/iosTrainingDecisionTypeSkeletonStaticGuards.test.ts` (21
  assertions): package exists, local-deps-only, no remote URL, no forbidden
  package deps, type + test files exist, 10 golden ids referenced, NO engine
  functions (buildTrainingDecision / effectivePhase / prescription / supportPlan
  / readiness), no SwiftUI/HealthKit/Supabase/WebKit/BackgroundTasks imports, no
  SwiftData/CoreData/@Model/@Observable, no AppData mutation, no DataHealth dep,
  no pnpm-lock, 14 fixtures intact.
- **New** `tests/iosTrainingDecisionGoldenShapeGuards.test.ts`: TS-side golden
  shape lock (always-present keys, narrow-vs-expanded split, per-path invariants
  the Swift types decode).
- **Evolved** (narrowly): `iosBootstrapPackageGraph` (PACKAGES +
  SANCTIONED_LOCAL_PATH_DEPS add IronPathTrainingDecision→`../IronPathDomain`);
  `iosBootstrapNoBusinessLogic` (`TrainingDecision_type` sanctioned inside the
  new package via `exemptPrefixes`; `buildTrainingDecision_func` stays globally
  forbidden); `iosDataHealthRuntimeFoundationStaticGuards` (same
  `TrainingDecision_type` carve-out); `iosTrainingDecisionSwiftPortPlanDocsParity`
  (the iOS-4A "package not created" assertion → forward-safe "package, if
  present, has no engine").

## 12. Non-goals

No `buildTrainingDecision` / engine logic; no effective-phase / prescription /
support-plan / readiness / recommendation computation; no AppData read or
mutate; no raw-AppData input; no UI / Focus Mode / cloud sync / HealthKit /
Supabase; no third-party SwiftPM; no SwiftData/CoreData/@Model/@Observable; no
TS runtime behaviour change; no parity generator behaviour change; no AppData
schema change; no `pnpm-lock.yaml`.

## 13. Xcode validation

`xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination
'generic/platform=iOS Simulator' build` and the iPhone 17 Pro destination both
BUILD SUCCEEDED with the 9th package present. (The umbrella app target does not
yet link IronPathTrainingDecision — wiring is iOS-5+.)

## 14. Remaining risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | A future expanded fixture omits a currently-always-present expanded field | All expanded fields are already `Optional` — decode tolerates it |
| R2 | `effectivePhase` sub-fields could be null in a future fixture (TS allows it; no current golden exercises it) | Modelled `Optional`; tests assert non-null only on fixtures that have them |
| R3 | Golden drift between 4B1 and the 4B2 engine port | `--check` is the CI drift detector; goldens carry `tsCommit` |
| R4 | Surface payloads kept as `JSONValue` are not field-typed | Intentional for the skeleton; iOS-4B2+ can promote stable surface fields to typed properties as the engine port needs them |

## 15. Next task

**iOS-4B2 TrainingDecision Core Rule Skeleton V1** ✅ implemented — added the
`IronPathDataHealth` dependency + the engine entry signature
(`buildTrainingDecisionFromCleanInput`) and the first core rules
(effective-phase + sessionIntent), validated against these 10 goldens via the
type skeleton this PR landed. The full algorithm port follows in iOS-4B3+.
See [`IOS_4B2_TRAININGDECISION_CORE_RULE_SKELETON_V1.md`](./IOS_4B2_TRAININGDECISION_CORE_RULE_SKELETON_V1.md).
