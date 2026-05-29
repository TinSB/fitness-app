# Task: iOS-4B TrainingDecision Swift Port Implementation V1

> Ready-to-run task spec produced by iOS-4A. Read the companion plan first:
> [`IOS_4A_TRAININGDECISION_SWIFT_PORT_PLAN_CODEGRAPH_V1.md`](./IOS_4A_TRAININGDECISION_SWIFT_PORT_PLAN_CODEGRAPH_V1.md).
> This document is the authoritative scope for iOS-4B. The docs-parity tests in
> `tests/iosTrainingDecisionSwiftPortPlan*.test.ts` lock its key contents.

> **iOS-4B was split into incremental sub-PRs** to de-risk the largest behaviour
> surface in the app:
> - **iOS-4B0** — TrainingDecision parity fixture expansion (10 goldens). ✅ merged.
> - **iOS-4B1** — TrainingDecision Swift **type skeleton** (the
>   `IronPathTrainingDecision` package + Codable golden decode types, no engine).
>   See [`IOS_4B1_TRAININGDECISION_SWIFT_TYPE_SKELETON_V1.md`](./IOS_4B1_TRAININGDECISION_SWIFT_TYPE_SKELETON_V1.md).
> - **iOS-4B2** — TrainingDecision core rule skeleton (engine entry +
>   effective-phase/sessionIntent), adding the `IronPathDataHealth` dep. ✅ implemented.
>   See [`IOS_4B2_TRAININGDECISION_CORE_RULE_SKELETON_V1.md`](./IOS_4B2_TRAININGDECISION_CORE_RULE_SKELETON_V1.md).
> - **iOS-4B3** — Readiness + e1RM slice (unlocks controlled-reload sessionIntent +
>   riskLevel). ✅ implemented. See
>   [`IOS_4B3_READINESS_E1RM_SLICE_V1.md`](./IOS_4B3_READINESS_E1RM_SLICE_V1.md).
> - **iOS-4B4** — Deload + clamp + modes slice (finalVolumeMultiplier +
>   volume/intensity/progression modes + the readiness time-gap/health/round math).
>   ✅ implemented. See
>   [`IOS_4B4_DELOAD_CLAMP_MODES_V1.md`](./IOS_4B4_DELOAD_CLAMP_MODES_V1.md).
> - **iOS-4B5** — Exercise prescription + volume floor (perExercise / allTargetSets /
>   role floors). ✅ implemented. See
>   [`IOS_4B5_EXERCISE_PRESCRIPTION_VOLUME_FLOOR_V1.md`](./IOS_4B5_EXERCISE_PRESCRIPTION_VOLUME_FLOOR_V1.md).
> - **Roadmap change:** next is **iOS-5 Native Focus Mode Shell + TrainingDecision
>   Integration V1** (Xcode-led SwiftUI). iOS-4B6 (userFacing + full arbitrationTrace +
>   full-object parity) is DEFERRED / parallel — no longer a hard pre-req for native UI.
>
> The original "all-at-once" file/test lists below remain the cumulative target;
> each sub-PR lands a reviewable slice of it.

## Context

iOS-4A (plan + CodeGraph audit) is merged. iOS-3C and all prior iOS Swift layers
are on `main`. The Swift data-immunity stack (AppData models, CleanAppDataView,
AutoRepairOrchestrator, `processIncomingAppData`, 9 V1 repair recipes) is green.
iOS-4B ports the TypeScript **TrainingDecision V2** pipeline into a new 9th Swift
package with byte-equal parity fixtures and static guards.

## Repo + worktree

```
Repo:     ~/Developer/ironpath
Worktree: ~/Developer/ironpath-ios-4b
Branch:   claude/ios-4b-training-decision-swift-port-implementation-v1
Base:     origin/main (must include the iOS-4A merge commit)
```

Setup:

```
cd ~/Developer/ironpath
git fetch origin
git worktree add ~/Developer/ironpath-ios-4b -b claude/ios-4b-training-decision-swift-port-implementation-v1 origin/main
cd ~/Developer/ironpath-ios-4b
pwd
git branch --show-current
git status --short
git rev-parse --short HEAD
```

Verify iOS-4A landed:

```
test -f docs/ios-native-migration/IOS_4A_TRAININGDECISION_SWIFT_PORT_PLAN_CODEGRAPH_V1.md
test -f docs/ios-native-migration/IOS_4B_TRAININGDECISION_SWIFT_PORT_IMPLEMENTATION_V1_TASK.md
```

Verify baseline before writing any Swift:

```
node scripts/generate-parity-goldens.mjs --check
swift test --package-path ios/packages/IronPathDomain
swift test --package-path ios/packages/IronPathDataHealth
```

If baseline fails: STOP and report.

## Goal

Land `IronPathTrainingDecision` as the 9th local Swift package, porting
`buildTrainingDecision` + the Clean Input Contract + the 7 user-facing surfaces,
with a byte-equal parity test against the existing
`training-decision/normal-session-v1` golden.

## Package to create

`ios/packages/IronPathTrainingDecision/` with `Package.swift`:

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

Dependency arrow is one-way: `IronPathTrainingDecision → IronPathDataHealth →
IronPathDomain`. No other package may depend on `IronPathTrainingDecision`, and
`IronPathTrainingDecision` may depend on nothing else.

## Files to create (Swift sources, ~20-28 files under `Sources/IronPathTrainingDecision/`)

Output schema (one file per surface):

- `TrainingDecisionTypes.swift` — `TrainingDecision` root struct (+ top-level `_unknown` carrier), `UserFacingMap`, `SurfaceId`, `RiskBadge`, mode enums (`SessionIntent`, `RiskLevel`, `ProgressionMode`, `VolumeMode`, `IntensityMode`, `ExerciseRole`), `WorkingSetTarget`, `MuscleGroupVolumeTarget`, `WeeklyAdjustmentDecision`, `NextSetPolicy`, `DecisionVersion` (single-case enum `case v2`).
- `UserFacing/SurfaceProtocol.swift` — `UserFacingSurface` protocol.
- `UserFacing/TodayUserFacing.swift` — `+ TodayDecisionState + TodaySevereNotice`.
- `UserFacing/PlanUserFacing.swift` — `+ WeeklyProgressionItemView + 5 enums`.
- `UserFacing/RecordUserFacing.swift` — `+ PostWorkoutItemView + PostWorkoutRecommendationKind`.
- `UserFacing/ProgressUserFacing.swift` — `+ ProgressStrengthTrendItem + 3 enums`.
- `UserFacing/ExplanationUserFacing.swift` — `+ RecommendationFactorView + RecommendationWarningView + 3 enums`.
- `UserFacing/TrainingUserFacing.swift`, `UserFacing/FocusUserFacing.swift`.

Hidden signals:

- `Signals/HiddenDebugSignals.swift` — 9 fields incl. `ExerciseRoleFloors` typed struct.
- `Signals/EffectiveTrainingPhase.swift`, `Signals/TrainingLapseSignal.swift`.

Input contract:

- `CleanTrainingDecisionInput.swift` — branded struct, **package-private init**, `isCleanTrainingDecisionInput`, `assertCleanTrainingDecisionInput`.
- `CleanTrainingDecisionInputFactory.swift` — `createCleanTrainingDecisionInput(view:metadata:)` (the only public producer).

Sub-engines (Swift port of TS):

- `EffectiveTrainingPhaseEngine.swift`, `ReadinessEngine.swift`, `AdaptiveFeedbackEngine.swift`, `TrainingLapseEngine.swift`, `ExercisePrescriptionEngine.swift`, `SupportingPlanEngine.swift`, `RecommendationDiffEngine.swift`.

Main entry + builders:

- `TrainingDecisionEngine.swift` — `buildTrainingDecisionFromCleanInput(_:surfaces:)` (public) + internal `buildTrainingDecision`.
- 7 × `*UserFacingBuilder.swift`.

## TS source files to mirror (exact)

| Swift file | TS source |
| --- | --- |
| `TrainingDecisionEngine.swift` + builders | `src/engines/trainingDecisionEngine.ts` (2097) |
| `TrainingDecisionTypes.swift` + surface files | `src/engines/trainingDecisionTypes.ts` (448) |
| `CleanTrainingDecisionInput.swift` + factory | `src/engines/trainingDecisionCleanInput.ts` (252) |
| `EffectiveTrainingPhaseEngine.swift` | `src/engines/effectiveTrainingPhaseEngine.ts` (234) |
| `ExercisePrescriptionEngine.swift` | `src/engines/exercisePrescriptionEngine.ts` (748) |
| `SupportingPlanEngine.swift` | `src/engines/supportPlanEngine.ts` (455) |
| `ReadinessEngine.swift` | `src/engines/readinessEngine.ts` (150) |
| `AdaptiveFeedbackEngine.swift` | `src/engines/adaptiveFeedbackEngine.ts` (574) |
| `TrainingLapseEngine.swift` | `src/engines/trainingLapseEngine.ts` (620) |
| `RecommendationDiffEngine.swift` | `src/engines/recommendationDiffEngine.ts` (89) |

Mirror the **must-preserve behaviours** from iOS-4A plan §11 + Agent 1 §1: the
7-row gap→activePhase table; the 5-priority `sessionIntentFor` matrix;
`clampMultiplier` floors (`REENTRY=0.65, RESTART=0.55, SEVERE=0.3`); role floors
(`NORMAL` all-1, `REENTRY` compounds-2); `weeklyDirection` block; AR-1..AR-5 in
deterministic order; all 7 surface copy tables (verbatim Chinese strings).

## Fixtures to consume

Existing (byte-match target):

- input `tests/fixtures/parity/inputs/training-decision/normal-session-v1.json`
- golden `tests/fixtures/parity/golden/training-decision/normal-session-v1.json`
  (projects only `decisionVersion` + `userFacing` + `hiddenDebugSignals.arbitrationTrace`)
- real-export input `tests/fixtures/parity/inputs/real-export/redacted-2026-05-27.json`
  (stability/idempotency only — NO TS-golden byte-compare, per iOS-2C decision)

New gap fixtures — add only where load-bearing for parity (plan §12 priority H
first): `severe-rest-v1`, `controlled-reload-v1`, `deload-week-v1`,
`stale-today-status-v1`, `stale-health-data-v1`. Prefer synthetic minimum-depth.
Land any TS-engine-drift golden refresh as a **separate** commit from new
coverage. Never auto-regenerate in a way that mixes refresh with new fixtures.

## Swift tests to add (6 classes / 22 tests under `Tests/IronPathTrainingDecisionTests/`)

- `TrainingDecisionParityNormalSessionTests` (3): byte-equal vs golden via `#filePath`; deterministic clock; no `控制风险`.
- `TrainingDecisionUserFacingShapeTests` (4): AR-6/AR-7/AR-9; forbidden triplet co-occurrence.
- `TrainingDecisionCleanInputContractTests` (4): brand reject on unbranded input; factory stamp; no legacy advice fields.
- `TrainingDecisionArbitrationTraceTests` (6): AR-1..AR-5 traceability on contrived inputs.
- `TrainingDecisionEngineShapeTests` (5): `decisionVersion=="v2"`; all owned fields present; determinism; signal-only daily adjustment + today signal.
- `TrainingDecisionRealExportParityTests` (3): real-export stable + idempotent + no AppData mutation.

Canary: `TrainingDecisionParityNormalSessionTests.testNormalSessionParityFixtureIsByteEqualToGolden`.

## TS static guards to add

New file `tests/iosTrainingDecisionSwiftEngineStaticGuards.test.ts` (walk
`collectSwift('ios/packages/IronPathTrainingDecision/Sources')`):

1. required Swift source + test files exist at expected paths;
2. forbidden imports: `IronPathPersistence/CloudSync/HealthKit/UIKit/Backup/L10n`, `SwiftData`, `CoreData`, `HealthKit`, `Supabase`, `@Model`, `@Observable`;
3. no AppData mutation (`.history.append`, `.appData.history =`, `.appData.todayStatus =`, `mutating func …(AppData)`);
4. no orchestrator inside engine (`AutoRepairOrchestrator`, `runAutoRepairOrchestrator(`, `processIncomingAppData(`);
5. no IO (`FileManager`, `URLSession`, `URL(fileURLWithPath:`, `Bundle.main`);
6. engine entry signature consumes `CleanTrainingDecisionInput` (not raw `AppData`); `CleanTrainingDecisionInput` has `private init` + public factory;
7. `Package.swift` deps exactly `../IronPathDomain` + `../IronPathDataHealth`, no `.package(url:`, one library/target/testTarget, iOS 17, swift-tools 5.9.

Existing-test evolutions (widen, do not break):

- `tests/iosBootstrapPackageGraph.test.ts` — add `IronPathTrainingDecision` to `PACKAGES` + `SANCTIONED_LOCAL_PATH_DEPS: { IronPathTrainingDecision: ['../IronPathDomain', '../IronPathDataHealth'] }`.
- `tests/iosBootstrapForbiddenImports.test.ts` — include new package in scan.
- `tests/iosBootstrapNoBusinessLogic.test.ts` — sanction `buildTrainingDecision` / `TrainingDecision` inside `IronPathTrainingDecision/Sources/**` only.
- `tests/iosBootstrapProjectStructure.test.ts` — add package to children enumeration.
- `tests/iosBootstrapTargetSettings.test.ts` — add package to allowlist.
- `tests/iosDataHealthRuntimeFoundationStaticGuards.test.ts` — sanctioned-prefix carve-out for `IronPathTrainingDecision/Sources/` (the `TrainingDecision_type` deferred guard scans all of `ios/`).

`iosAutoRepairOrchestratorSafeRecipesStaticGuards.test.ts` and
`iosRemainingRepairRecipesIngressPipelineStaticGuards.test.ts` are scoped to
`IronPathDataHealth/Sources` — **no change needed**.

## xcodebuild wiring

- `ios/IronPath.xcworkspace/contents.xcworkspacedata`: add 1 `FileRef` for `packages/IronPathTrainingDecision`.
- `ios/IronPath.xcodeproj/project.pbxproj`: 6 insertion points (PBXBuildFile, PBXFrameworksBuildPhase children, PBXNativeTarget packageProductDependencies, PBXProject packageReferences, XCLocalSwiftPackageReference, XCSwiftPackageProductDependency); continue sequential IDs `…F9` / `…0109`.
- Update iOS-1 §4 module-boundary table to add the 9th package row.

## Forbidden actions

- Do not modify any of the 8 existing packages' Sources or `Package.swift` (only the workspace + pbxproj + the 6 static-guard test evolutions above).
- Do not port `planPresenter` / `TodayView` / `PlanView` / `ProgressView` / `RecordView` (UI — iOS-5/6).
- Do not port `buildTrainingDecisionContext` / `CleanTrainingDecisionContextSource` unless proven load-bearing for parity.
- Do not change TypeScript runtime behaviour, AppData schema, or `pnpm-lock.yaml`.
- Do not add cloud upload eligibility (iOS-7), HealthKit (iOS-8+), Focus Mode (iOS-5), Supabase / cloud sync (iOS-7+).
- Do not add third-party SwiftPM, SwiftData, CoreData, `@Model`, `@Observable` on AppData model types.
- Do not create a circular dependency (`IronPathDataHealth` must not import `IronPathTrainingDecision`).
- Do not call `AutoRepairOrchestrator` / `processIncomingAppData` from inside the engine.
- Do not auto-merge, do not deploy production, do not use `--admin`, do not bypass branch protection.

## Validation commands (all must exit 0 before opening PR)

```
node scripts/generate-parity-goldens.mjs --check
node scripts/generate-parity-goldens.mjs --list
npm run api:dev:build
npm run typecheck
npm test
npm run build
node scripts/scan-production-dist-safety.mjs
git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml
test ! -e pnpm-lock.yaml
git diff --check

swift test --package-path ios/packages/IronPathDomain
swift test --package-path ios/packages/IronPathDataHealth
swift test --package-path ios/packages/IronPathPersistence
swift test --package-path ios/packages/IronPathCloudSync
swift test --package-path ios/packages/IronPathHealthKit
swift test --package-path ios/packages/IronPathBackup
swift test --package-path ios/packages/IronPathL10n
swift test --package-path ios/packages/IronPathUIKit
swift test --package-path ios/packages/IronPathTrainingDecision

xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'generic/platform=iOS Simulator' build
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

If `npm test` fails, compare against the `origin/main` baseline and do not merge
unless required checks pass and the failure pattern is confirmed pre-existing.

## Merge rules

- Open a PR; do NOT auto-merge. Wait for user review + merge-gate verification.
- Required GitHub check must be SUCCESS; PR must be OPEN, non-draft, MERGEABLE/CLEAN.
- `npm test` failure pattern (if any) must match the `origin/main` baseline exactly.
- No `--admin`, no branch-protection bypass, no force-push to main.
- Squash merge with `--delete-branch` only after the user approves.

## Worktree cleanup rule

After PR is merged and main verification passes later, remove this task worktree
and prune. Do not keep this worktree indefinitely:

```
git worktree remove ~/Developer/ironpath-ios-4b
git worktree prune
git worktree list
```

## Next task after iOS-4B

iOS-5 TrainingDecision UI Presenters + Today/Plan/Progress/Record SwiftUI surfaces
(consuming `TrainingDecision` output), only after iOS-4B passes review.
