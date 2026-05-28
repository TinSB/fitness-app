# iOS-3A Data Health Runtime Foundation V1

**Status:** merged (PR #398, commit `c2e9ad0`).
**Owner:** iOS-3A (Data Health Runtime Foundation).
**Date:** 2026-05-28.
**Branch:** `claude/ios-3a-data-health-runtime-foundation-v1` (deleted post-merge).
**Successor:** iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1
— see `IOS_3B_AUTO_REPAIR_ORCHESTRATOR_SAFE_RECIPES_V1.md`.

## 1. Scope

iOS-3A lands the **foundation tier** of the Data Health runtime on the
Swift side. The full iOS-3 work was split into two PRs to keep blast
radius low:

* **iOS-3A (this PR)** — pure-value runtime guards, the read-only
  `CleanAppDataView` projection, the typed repair-type skeleton, the
  ledger contract (read / write / append / idempotency / summary), and
  the `AppDataStore` protocol with a JSON-snapshot-on-disk
  implementation. Plus Swift + TS tests proving the runtime guard
  pipeline accepts the canonical redacted real export without
  mutating the underlying AppData.

* **iOS-3B (next PR, NOT this one)** — the 9 V1 repair recipes,
  `AutoRepairOrchestrator`, `processIncomingAppData`, the full
  ingress pipeline, and the bridge into iOS-4 TrainingDecision /
  iOS-5 Focus Mode.

The split was explicitly chosen by the project owner before starting
work; it is documented in §5 below.

## 2. Goals

1. **Port the runtime guards** from
   `src/dataHealth/dataHealthRuntimeGuard.ts` to Swift as 6 pure
   functions, behavior-identical to the TS source.
2. **Build the read-only projection.** `buildCleanAppDataView` accepts
   an `AppData` value and an injectable clock and returns a
   `CleanAppDataView` value carrying the cleaned history /
   activeSession / screening plus a diagnostics struct.
3. **Skeleton the repair types.** Ship the enums (`RepairLayer`,
   `RepairCategory`, `RepairSeverity`, `RepairTrigger`,
   `RepairApplyStatus`), the value structs (`RepairDetectResult`,
   `RepairDryRunResult`, `RepairApplyResult`, `RepairApplyOptions`),
   the `RepairDefinition` protocol, and the typed ledger entry
   (`DataHealthRepairLedgerEntry`) plus the runtime-flags +
   auto-repair-summary shapes.
4. **Lock the ledger contract.** Pure-value read / write / append +
   FIFO cap at 1000 + 24-hour idempotency window + status-bucketed
   summary.
5. **Protocol-and-skeleton the persistence layer.** `AppDataStore`
   protocol + `JSONFileAppDataStore` implementation (atomic write,
   backup, schemaVersion guard, missing-file handling).
6. **Prove byte-equality with `raw`.** Building the clean view from
   the redacted real export must NOT change
   `appData.canonicalJSONData()` — Swift parity hash for the same
   file is unaffected.

## 3. Non-goals (explicit out of iOS-3A)

The following are NOT in this PR and MUST NOT be added:

* The 9 V1 repair recipes (`detect`/`dryRun`/`apply`
  implementations).
* `AutoRepairOrchestrator` or any other repair-orchestration class.
* `processIncomingAppData` or any AppData ingress pipeline.
* `TrainingDecision`, `buildTrainingDecision`, or any iOS-4 engine
  wiring.
* `FocusStepQueue`, `buildFocusStepQueue`, or any iOS-5 wiring.
* Cloud sync / Supabase / CloudKit.
* HealthKit imports / authorization.
* Focus Mode UI / UIKit / SwiftUI surfaces beyond the existing iOS-1
  placeholder.
* SwiftData, CoreData, `@Model`, `@Observable` on persisted types.
* Third-party SwiftPM packages.
* TS runtime behavior changes (the TS-side guard pipeline is the
  source-of-truth and is NOT modified).
* `pnpm-lock.yaml` (the repo uses npm).
* Production deploys.
* Force-pushed or `--admin` merges.

## 4. Files added / changed

### Sources (Swift)

* `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/DataHealthConstants.swift`
  — 8 constants ported verbatim from TS.
* `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/DataHealthRuntimeGuard.swift`
  — `RuntimeGuardClock` protocol, `SystemRuntimeGuardClock`,
  `FixedRuntimeGuardClock`, 6 pure guards, the 2 legacy-advice strip
  helpers, and a read-only `readRuntimeFlags` helper.
* `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/CleanAppDataView.swift`
  — `CleanAppDataView` read-only struct + `CleanAppDataViewDiagnostics`.
* `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/CleanAppDataViewBuilder.swift`
  — `buildCleanAppDataView(_:clock:)` entry point.
* `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/RepairTypes.swift`
  — enums + value-type skeleton + `RepairDefinition` protocol +
  `DataHealthRepairLedgerEntry` + `DataHealthRuntimeFlags` +
  `DataHealthAutoRepairSummary` + `AppDataHashable`.
* `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/RepairLedger.swift`
  — `readLedger` / `writeLedger` / `appendLedgerEntry` /
  `isIdempotentMatch` / `buildLedgerEntry` / `summarizeLedger` +
  JSON encode/decode on `DataHealthRepairLedgerEntry`.
* `ios/packages/IronPathPersistence/Sources/IronPathPersistence/AppDataStore.swift`
  — `AppDataStore` protocol + `AppDataStoreError` enum.
* `ios/packages/IronPathPersistence/Sources/IronPathPersistence/JSONFileAppDataStore.swift`
  — atomic-write / backup / schemaVersion-guard concrete impl.

### Package.swift edits

* `ios/packages/IronPathDataHealth/Package.swift` — adds
  `.package(path: "../IronPathDomain")` plus target/testTarget
  dependencies on `IronPathDomain`.
* `ios/packages/IronPathPersistence/Package.swift` — same edit.

Platforms stay as `[.iOS(.v17)]`. `swift test` runs on the host macOS
without an explicit `.macOS` platform entry (verified by running the
test suites for both packages locally).

### Tests (Swift)

* `ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests/DataHealthRuntimeGuardTests.swift`
  — 18 tests covering the 6 guards + 2 strip helpers.
* `ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests/CleanAppDataViewRealExportTests.swift`
  — 5 tests asserting the clean view builds from the redacted real
  export AND `raw.canonicalJSONData()` is byte-equal before vs after.
* `ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests/RepairLedgerTests.swift`
  — 9 tests covering encode/decode round-trip, append, FIFO cap at
  1000, idempotency window, status-bucket summary.
* `ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests/RepairTypesTests.swift`
  — 6 tests asserting enum rawValues + the 8 constants.
* `ios/packages/IronPathPersistence/Tests/IronPathPersistenceTests/JSONFileAppDataStoreTests.swift`
  — 6 tests covering save/load round-trip, fileMissing error,
  schemaInvalid error, backup creation, backup-on-missing-primary
  error.

### Tests (TypeScript)

* `tests/iosDataHealthRuntimeFoundationStaticGuards.test.ts` — new
  static-guard suite. Asserts:
  * The 13 expected Swift files exist at their canonical paths.
  * The 8 `DATA_HEALTH_*` TS constants match the 8 Swift
    `DataHealthConstants` literal values (parsed from the TS source
    at CI time — drift fails the test).
  * The iOS-3B-deferred symbols are NOT declared anywhere under
    `ios/`: `AutoRepairOrchestrator`, `processIncomingAppData`,
    `TrainingDecision`, `AppDataRepairLedger` (orchestrator).
  * Both Package.swift files declare the IronPathDomain local-path
    dep and the iOS 17 platform.
  * `RepairTypes.swift` has no concrete `: RepairDefinition` impl.
  * `RepairLedger.swift` has no `FileManager` / `URLSession` usage.
* `tests/iosBootstrapNoBusinessLogic.test.ts` — evolved to add
  `exemptPrefixes: ['ios/packages/IronPathDataHealth/']` for the
  `CleanAppDataView_type` rule. `AutoRepairOrchestrator_type` and
  `AppDataRepairLedger_type` rules stay un-exempt (still forbidden,
  owned by iOS-3B).
* `tests/iosBootstrapPackageGraph.test.ts` — evolved to whitelist a
  single sanctioned local-path dep `../IronPathDomain` for
  `IronPathDataHealth` and `IronPathPersistence`. Remote
  `.package(url: ...)` deps stay 100% forbidden.

## 5. Why split iOS-3 into 3A + 3B

The project owner explicitly split iOS-3 because the full Data
Health Swift port is large enough to risk:

* a single PR landing too much code for productive review;
* a hash-mismatch blast radius covering both the projection layer
  AND 9 repair recipes simultaneously;
* mixing two distinct architectural concerns (runtime contracts vs.
  repair semantics) into the same merge.

The boundary is sharp:

| Concern                              | iOS-3A | iOS-3B |
| ------------------------------------ | ------ | ------ |
| Pure guard functions                 | ✅     |        |
| `CleanAppDataView` foundation         | ✅     |        |
| Repair type system (protocol + enums)| ✅     |        |
| Ledger contract (read/append/idempotency) | ✅ |        |
| `AppDataStore` protocol + JSON impl  | ✅     |        |
| 9 V1 repair recipes (`apply`)        |        | ✅     |
| `AutoRepairOrchestrator`             |        | ✅     |
| `processIncomingAppData` pipeline    |        | ✅     |
| TrainingDecision / Focus Mode wiring  |        | (iOS-4 / 5) |

iOS-3A is therefore intentionally "skeleton + foundation"; iOS-3B
will plug concrete recipes into the contract this PR ships.

## 6. Behavior parity with TypeScript

Each Swift guard is a direct port of its TS counterpart:

| TS function | Swift function | Notes |
| ----------- | -------------- | ----- |
| `applySessionLifecycleGuard` | `applySessionLifecycleGuard(_:)` | Returns rebuilt session value when changed; outcome flags each cleared field individually. |
| `applyDurationGuard` | `applyDurationGuard(_:)` | Same three-branch logic (in-range / span-rescue / invalid). Math.round → Swift `.rounded()`. |
| `applyTodayStatusGuard` | `applyTodayStatusGuard(_:clock:)` | UTC start-of-day via `Calendar(identifier: .gregorian)` + `TimeZone(identifier: "UTC")`. |
| `applyHealthDataGuard` | `applyHealthDataGuard(_:clock:)` | Reads `healthMetricSamples` via typed accessor + `importedWorkoutSamples` via `root["importedWorkoutSamples"]?.arrayValue`. |
| `applyIssueScoreCap` | `applyIssueScoreCap(_:)` | Soft cap (12) when movementFlags all "good" + no pain + no restriction; otherwise hard cap (50). |
| `applyPerformanceDropGuard` | `applyPerformanceDropGuard(_:history:)` | `slice(-4)` → Swift `history.suffix(4)`. `s.done === true` → `$0.done == true`. |
| `stripLegacyAdviceFromExercise` | `stripLegacyAdviceFromExercise(_:)` | Removes typed `suggestion`/`adjustment`/`warning` + `prescription.weeklyAdjustment` string entry. |
| `stripLegacyAdviceFromSession` | `stripLegacyAdviceFromSession(_:)` | `explanations` and `deloadDecision` live in `_unknown` on the Swift side; rewrite the carrier without losing other unknown keys. |

The redacted real-export consumption test
(`CleanAppDataViewRealExportTests`) asserts that
`appData.canonicalJSONData()` BEFORE and AFTER `buildCleanAppDataView`
is byte-equal — this is the load-bearing invariant.

## 7. CleanAppDataView contract

`CleanAppDataView` is a **read-only Swift value type**. Building it
from an AppData NEVER mutates the AppData; the original
`appData.root: OrderedJSONObject` is preserved in `view.raw`.

Fields:

* `raw: AppData` — source-of-truth, untouched.
* `cleanedHistory: [TrainingSession]` — element-wise projection of
  `raw.history`; lifecycle residue cleared, legacy advice stripped,
  duration override applied where the guard fired.
* `cleanedActiveSession: TrainingSession?` — same projection rule on
  the active session.
* `cleanedScreening: ScreeningProfile` — `issueScores` capped and
  `performanceDrops` filtered inside `adaptiveState`.
* `durations: [String: DurationGuardOutcome]` keyed by session id.
* `todayStatus: TodayStatusGuardOutcome` /
  `healthData: HealthDataGuardOutcome` /
  `issueScoreCap: IssueScoreCapOutcome` /
  `performanceDrops: PerformanceDropOutcome`.
* `diagnostics: CleanAppDataViewDiagnostics` — id lists / boolean
  flags for each dirty bucket.

`hasDirtyData: Bool` is a convenience accessor that returns `true`
when any diagnostic bucket reports a change. iOS-3B's
auto-repair-orchestrator will gate on this.

## 8. Repair type skeleton

`RepairTypes.swift` ships the protocol-and-shape contract. iOS-3A
does NOT include any concrete `struct SomeRepair: RepairDefinition`
implementation — the static-guard test `iosDataHealthRuntimeFoundation
RepairTypes.swift is type-only` enforces this.

The `RepairDefinition` protocol shape:

```swift
public protocol RepairDefinition: Sendable {
    var repairId: String { get }
    var version: Int { get }
    var layer: RepairLayer { get }
    var category: RepairCategory { get }
    var description: String { get }
    var affectedAppDataPaths: [String] { get }
    func detect(_ appData: AppData) -> RepairDetectResult
    func dryRun(_ appData: AppData) -> RepairDryRunResult
    var supportsApply: Bool { get }
    func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult
}
```

Enums use the exact TS string-union rawValues:

| Swift case | rawValue |
| ---------- | -------- |
| `RepairLayer.runtimeGuard` | `"runtime_guard"` |
| `RepairLayer.safeAuto` | `"safe_auto"` |
| `RepairLayer.auditOnly` | `"audit_only"` |
| `RepairTrigger.importing` | `"import"` |
| `RepairTrigger.cloudRestore` | `"cloud_restore"` |
| `RepairTrigger.postSession` | `"post_session"` |
| `RepairApplyStatus.noOp` | `"no_op"` |
| `RepairApplyStatus.backupFailed` | `"backup_failed"` |

`RepairTrigger.importing` is named for Swift keyword safety —
`import` is reserved.

## 9. Ledger contract

`appData.settings.dataHealthRepairLedger` is an append-only array of
`DataHealthRepairLedgerEntry` rows. Cap = 1000 (FIFO truncation past
that). Idempotency window = 24 hours.

`buildLedgerEntry` composes:

```
ledgerId = "{repairId}-{appliedAt}-{idempotencyKey[0..<8]}"
```

`isIdempotentMatch` returns true if a row exists for the same
`repairId` + `idempotencyKey` with `status ∈ {applied, no_op}` whose
`appliedAt` is within the configured window of `now`.

`summarizeLedger` returns counts of `applied` / `noOp` / `failed`
(includes `backup_failed`) / `auditOnly` (the `skipped` status) plus
`lastRunAt` — within the last `withinHours` hours.

`writeLedger` returns a NEW `AppData` value via
`root["settings"].setting("dataHealthRepairLedger", ...)`. The
existing AppData is untouched (Swift value semantics).

## 10. Persistence layer

`AppDataStore` protocol:

```swift
public protocol AppDataStore: Sendable {
    var hasExistingFile: Bool { get }
    func load() throws -> AppData
    func save(_ appData: AppData) throws
    @discardableResult func backup() throws -> URL
}
```

`JSONFileAppDataStore` concrete impl uses `Data.write(to:options:
[.atomic])`, which Foundation implements as a write-to-temp +
rename-into-place sequence. A crash mid-write therefore leaves the
prior payload intact.

Backup file naming: `<original>.backup-<ISO-8601-timestamp-with-colons-as-dashes>`.

Errors:

* `AppDataStoreError.fileMissing(path)` — load() with no payload.
* `AppDataStoreError.readFailed(reason)` — Data(contentsOf:) error.
* `AppDataStoreError.decodeFailed(reason)` — JSON parse error.
* `AppDataStoreError.schemaInvalid(reason)` — schemaVersion guard
  refusal (forwarded from `AppData(decoding:)`).
* `AppDataStoreError.writeFailed(reason)` — atomic write or
  canonical-encode failure.
* `AppDataStoreError.backupFailed(reason)` — no source or copy
  failure.

The store explicitly does NOT use SwiftData, CoreData, or any third
party persistence framework. Static guard
`iosBootstrapNoBusinessLogic` continues to block those types.

## 11. Real export consumption test

`CleanAppDataViewRealExportTests` reads
`tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` via
`#filePath`-rooted resolution (no `Bundle.module` copy — the file is
~805 KB). Asserts:

1. The fixture exists at the canonical path.
2. `buildCleanAppDataView(appData)` returns successfully.
3. `view.cleanedHistory.count == appData.history.count` — element
   parity preserved.
4. `appData.canonicalJSONData()` BEFORE and AFTER building the view
   is byte-equal — `raw` is not mutated.
5. `view.cleanedActiveSession` matches the presence of
   `raw.activeSession`.
6. `view.hasDirtyData` consistently reflects the diagnostic buckets.

## 12. TS↔Swift parity guards

`iosDataHealthRuntimeFoundationStaticGuards` is the new parity test
suite. It runs in vitest and:

* Lists 13 expected Swift files; fails if any goes missing.
* Parses `src/dataHealth/appDataRepairTypes.ts` for the 8
  `DATA_HEALTH_*` constants and compares them to the 8 Swift
  `DataHealthConstants` literal values via regex extraction. Any
  drift fails the test BEFORE runtime parity could diverge.
* Sweeps `ios/` for the deferred-symbol set
  (`AutoRepairOrchestrator`, `processIncomingAppData`,
  `TrainingDecision`, the `AppDataRepairLedger` struct) — these
  must NOT be declared yet.
* Validates Package.swift `.package(path:)` deps + iOS 17 platform.
* Asserts `RepairTypes.swift` ships no concrete RepairDefinition
  conforming type.
* Asserts `RepairLedger.swift` is pure-value (no FileManager /
  URLSession).

`iosBootstrapNoBusinessLogic` and `iosBootstrapPackageGraph` are
narrowly evolved (per-symbol / per-package whitelists) without
relaxing their global stance against business logic outside the
sanctioned packages.

## 13. Static guards (cumulative state)

The full set of static-guard tests that gate iOS-3A:

* `iosBootstrapPackageGraph` (evolved) — local-path dep allowed for
  IronPathDataHealth and IronPathPersistence ONLY.
* `iosBootstrapNoBusinessLogic` (evolved) — CleanAppDataView
  sanctioned inside IronPathDataHealth only.
* `iosBootstrapForbiddenImports` — unchanged.
* `iosBootstrapTargetSettings` — unchanged.
* `iosBootstrapParityStillGreen` — unchanged.
* `iosBootstrapProjectStructure` — unchanged.
* `iosAppDataNoSwiftDataCoreDataGuards` — unchanged (still blocks
  SwiftData / CoreData).
* `iosAppDataSwiftModelStaticGuards` — unchanged.
* `iosAppDataTypedFieldActivationStaticGuards` — unchanged.
* `iosAppDataRealExportParityGuards` — unchanged.
* `iosAppDataFixtureParityDocsGuard` — unchanged.
* `iosAppDataSwiftModelsPlanDocsParity` — unchanged.
* `iosDataHealthRuntimeFoundationStaticGuards` (NEW).

## 14. Validation strategy

Locally run before opening the PR:

1. `cd ios/packages/IronPathDataHealth && swift test` — 39 tests.
2. `cd ios/packages/IronPathPersistence && swift test` — 7 tests.
3. `cd ios/packages/IronPathDomain && swift test` — should still pass
   unchanged.
4. The other 5 packages — unchanged placeholder, should still
   `swift build` clean.
5. `node ./node_modules/vitest/vitest.mjs run` — full TS suite
   (1346 files / ~6147 passing tests; the 4 devApiRunner test
   failures are pre-existing infrastructure issues unrelated to
   iOS-3A).
6. `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath
   -destination "generic/platform=iOS" build` — should still work.
7. `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath
   -destination "platform=iOS Simulator,name=iPhone 17 Pro" build`
   — should still work.

## 15. Known limitations

* `parseIsoDate` accepts ISO-8601 with/without fractional seconds and
  bare `yyyy-MM-dd`. It does NOT accept all of the formats that
  JavaScript's `new Date(string)` constructor accepts (e.g. some RFC
  2822 strings). iOS-3B should escalate parsing breadth if it
  encounters AppData payloads that fail to parse a date string the
  TS code accepts.
* The `restTimerState` rewrite in `applySessionLifecycleGuard` only
  flips `isRunning`; other nested fields are preserved verbatim.
  Matches TS behavior.
* `JSONFileAppDataStore.backup` includes the original filename in
  the backup name plus the ISO timestamp. Backup retention policy
  (how many backups to keep, when to GC) is iOS-3B's call.
* `writeLedger` rewrites the `settings` entry of `root`. Other
  `settings` keys are preserved via the `settingKey(_:to:)` extension
  that does in-place value replacement.
* No SwiftData. No CoreData. No `@Model`. No `@Observable`. No
  third-party SwiftPM. All by design.

## 16. Risks and rollback

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| Date math drift between Swift and TS for edge-case timezones | Low (UTC truncation matches `setUTCHours(0,0,0,0)`) | Real-export parity test exercises one realistic clock value; iOS-3B will land more clock fixtures. |
| `OrderedJSONObject.settingKey(_:to:)` produces in-canonical key order changes | Low (canonical emit re-sorts on output) | Verified by `testCleanAppDataViewDoesNotMutateRawCanonicalBytes`. |
| FIFO truncation at exactly 1000 entries off-by-one | Low | Covered by `testWriteLedgerTruncatesFifoAtLedgerMaxEntries` (1050 inputs → 1000 outputs, oldest 50 dropped). |
| iOS-3B builds against this contract and discovers a missing field | Medium | Contract reviewed against TS source; protocol can be additively extended in iOS-3B without breaking 3A. |

Rollback: revert this PR. iOS-3A is fully isolated from the running
TS pipeline; reverting it restores the iOS-2C baseline cleanly.

## 17. References

* TS source: `src/dataHealth/dataHealthRuntimeGuard.ts`,
  `src/dataHealth/cleanAppDataView.ts`,
  `src/dataHealth/appDataRepairTypes.ts`,
  `src/dataHealth/appDataRepairLedger.ts`.
* iOS-2A plan: `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1_PLAN.md`.
* iOS-2B doc: `docs/ios-native-migration/IOS_2B_APPDATA_SWIFT_MODELS_V1.md`.
* iOS-2C doc: `docs/ios-native-migration/IOS_2C_APPDATA_TYPED_FIELD_ACTIVATION_REAL_EXPORT_PARITY_V1.md`.
* Real export fixture: `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`.
* Cross-agent review: `docs/ios-native-migration/IOS_NATIVE_MIGRATION_CROSS_AGENT_REVIEW_V1.md`.
