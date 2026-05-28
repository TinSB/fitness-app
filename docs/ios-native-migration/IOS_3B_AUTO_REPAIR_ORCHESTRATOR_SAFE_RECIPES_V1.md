# iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1

**Status:** in review (PR).
**Owner:** iOS-3B (Data Health Auto-Repair, safe layer).
**Date:** 2026-05-28.
**Branch:** `claude/ios-3b-auto-repair-orchestrator-safe-recipes-v1`.

## 1. Goal

iOS-3B lands the first layer of executable auto-repair logic on the
Swift side:

* `RepairRegistry` (Swift port of `appDataRepairEngine.ts:buildRegistry` +
  `runRepair`).
* `AutoRepairOrchestrator` (Swift port of
  `runAutoRepairOrchestrator`).
* 5 concrete safe repair recipes that conform to the iOS-3A
  `RepairDefinition` protocol:
  * `sessionLifecycleResidueV1` (safe_auto, session_lifecycle)
  * `impossibleDurationV1` (safe_auto, duration_sanity)
  * `staleTodayStatusV1` (safe_auto, readiness_freshness)
  * `staleHealthReadinessGuardV1` (safe_auto, readiness_freshness)
  * `legacyFinalAdviceIsolationGuardV1` (runtime_guard,
    legacy_advice_isolation — audit-only, never mutates AppData)
* `AutoRepairBackupAdapter` protocol + in-memory default.

## 2. Why iOS-3B is limited to "safe" repairs

The full Data Health repair surface in TS has 9 V1 recipes. Two
practical reasons to split the Swift port:

1. The 5 in iOS-3B are the safest tier — none of them delete data,
   none of them touch screening issue scores or set indexes, and only
   3 of them mutate AppData at all (the other 2 are pure runtime
   guards / audit-only). Shipping these first establishes the
   orchestrator + backup contract under low risk before iOS-3C
   introduces the higher-risk repairs (screening issue scores, set
   index renumber, replacement equivalence audit).
2. Smaller PR = better review surface. iOS-3A already added 8 Swift
   files + 4 test files + 1 doc + 3 TS guards. iOS-3B adds another
   ~10 Swift files; bundling the remaining 4 repair recipes on top
   would push the PR past the productive review threshold.

The iOS-3C task brief will inherit this contract and implement:
* `screeningIssueScoreRuntimeGuardV1` / `screeningIssueScoreRepairV1`
* `setIndexRenumberV1`
* `replacementEquivalenceAuditV1`
* `processIncomingAppData` (full ingress pipeline)

## 3. iOS-3A dependency confirmation

iOS-3B builds on top of iOS-3A. Required upstream:

| iOS-3A surface | iOS-3B usage |
| -------------- | ------------ |
| `RepairDefinition` protocol | Conformance target for 5 recipes |
| `RepairDetectResult` / `RepairDryRunResult` / `RepairApplyResult` | Return types |
| `RepairApplyOptions` | Apply-time options |
| `RepairLayer` / `RepairCategory` / `RepairSeverity` / `RepairTrigger` / `RepairApplyStatus` | Enums |
| `DataHealthRepairLedgerEntry` + `appendLedgerEntry` / `isIdempotentMatch` / `buildLedgerEntry` / `summarizeLedger` | Orchestrator ledger plumbing |
| `DataHealthConstants` (8 constants) | Threshold values |
| `applySessionLifecycleGuard` / `applyDurationGuard` / `applyTodayStatusGuard` / `applyHealthDataGuard` | Pure guard reuse |
| `CleanAppDataView` + `buildCleanAppDataView` | Diagnostics input for orchestrator |
| `RuntimeGuardClock` + `FixedRuntimeGuardClock` | Deterministic clock injection |
| `readRuntimeFlags` | Pre-existing read helper |
| `OrderedJSONObject.settingKey(_:to:)` pattern | Settings mutation idiom |

iOS-3B's **new** addition to the runtime-flag surface:

* `writeRuntimeFlags(_ appData:_:)` — symmetric counterpart to
  `readRuntimeFlags`. Returns a rebuilt `AppData` value with the new
  flags map at `settings.dataHealthRuntimeFlags`. TS counterpart:
  `writeRuntimeFlags` in `dataHealthRuntimeGuard.ts:331`.

## 4. Repair IDs implemented in iOS-3B

| Repair ID | Layer | Category | Mutates AppData |
| --------- | ----- | -------- | --------------- |
| `sessionLifecycleResidueV1` | safe_auto | session_lifecycle | `history[].restTimerState/currentExerciseId/currentFocusStepId/currentSetIndex/focusActualSetDrafts` |
| `impossibleDurationV1` | safe_auto | duration_sanity | `history[].durationMin` + adds `durationInvalid` flag in `_unknown` |
| `staleTodayStatusV1` | safe_auto | readiness_freshness | `settings.dataHealthRuntimeFlags` only |
| `staleHealthReadinessGuardV1` | safe_auto | readiness_freshness | `settings.dataHealthRuntimeFlags` only |
| `legacyFinalAdviceIsolationGuardV1` | runtime_guard | legacy_advice_isolation | **nothing** — audit-only, returns status `skipped` |

## 5. Repair IDs explicitly DEFERRED

To iOS-3C:
* `screeningIssueScoreRuntimeGuardV1`
* `screeningIssueScoreRepairV1`
* `setIndexRenumberV1`
* `replacementEquivalenceAuditV1`

To iOS-3D:
* `processIncomingAppData` (full ingress pipeline that wraps the
  orchestrator + cloud upload eligibility check)

To iOS-7 / iOS-8 and beyond:
* Cloud upload eligibility
* Supabase
* HealthKit
* TrainingDecision
* Focus Mode

These deferrals are enforced by static guards in Phase 6.

## 6. AutoRepairOrchestrator design

Swift signature:

```swift
public struct AutoRepairOrchestratorInput {
    public let appData: AppData
    public let triggeredBy: RepairTrigger
    public let registry: RepairRegistry?  // defaults to safeRepairRegistry()
    public let backupAdapter: AutoRepairBackupAdapter?  // defaults to InMemoryAutoRepairBackupAdapter()
    public let clock: RuntimeGuardClock  // defaults to SystemRuntimeGuardClock()
}

public struct AutoRepairOrchestratorResult: Sendable {
    public let appData: AppData
    public let changed: Bool
    public let results: [RepairApplyResult]
    public let auditFindings: [AuditFinding]
    public let backup: AutoRepairBackupRecord?
    public let appDataHashBefore: String
    public let appDataHashAfter: String
    public let summary: DataHealthAutoRepairSummary
    public let warnings: [String]
}

public func runAutoRepairOrchestrator(
    _ input: AutoRepairOrchestratorInput
) throws -> AutoRepairOrchestratorResult
```

Flow (matches TS at `autoRepairOrchestrator.ts:62`):

1. Resolve registry / backup adapter / clock.
2. Compute `appDataHashBefore` via Swift `computeAppDataHash`.
3. Collect `safe_auto` definitions where `detected == true`.
4. Collect `audit_only` findings (the legacy advice guard, though
   here it's a `runtime_guard` layer — TS treats both as
   non-mutating, only the layer label differs).
5. If nothing to apply → write summary, return unchanged.
6. Try `backupAdapter.snapshot(...)`. On failure → write
   `backup_failed` ledger entries for every repair that would have
   run, mark them with `status == .backupFailed`, **never** mutate
   the AppData. Return.
7. For each repair to apply:
   * Read ledger.
   * Run `dryRun` → idempotency key.
   * If `isIdempotentMatch` true → skip.
   * Else `runRepair` → either `.applied` or `.noOp` or `.skipped`
     (audit-only) or `.failed`.
   * Post-detect check: if `applied` but `detect` still reports an
     issue → mark `.failed`.
   * Build ledger entry, append.
8. Update summary, return.

The orchestrator NEVER mutates `input.appData`. The result's
`appData` field carries the (possibly) repaired copy.

## 7. RepairRegistry design

Swift port of `buildRegistry`:

```swift
public struct RepairRegistry: Sendable {
    public let definitions: [any RepairDefinition]
    public init(_ definitions: [any RepairDefinition]) throws  // throws on duplicate repairId

    public func list() -> [any RepairDefinition]
    public func byLayer(_ layer: RepairLayer) -> [any RepairDefinition]
    public func get(_ repairId: String) -> (any RepairDefinition)?
    public func has(_ repairId: String) -> Bool
}

public func safeRepairRegistry() -> RepairRegistry  // bundles the 5 iOS-3B recipes
```

Cached single-instance behind a thread-safe accessor.

## 8. dryRun / apply behavior — per repair

### sessionLifecycleResidueV1 (safe_auto)
* **detect**: scan `appData.history` for completed sessions with any
  of: `restTimerState.isRunning == true`, non-empty
  `currentExerciseId`, `currentFocusStepId != "completed"` and
  non-empty, `currentSetIndex` not in `{0, -1}`, non-empty
  `focusActualSetDrafts`.
* **dryRun**: report idempotency key + sample before/after.
* **apply**: invoke `applySessionLifecycleGuard` on each affected
  completed session. Preserves all historical `sets` / `warmupSets` /
  exercises. Does not delete drafts unless explicitly stale (TS
  semantics: clears `focusActualSetDrafts` to `[]` on completed
  sessions).

### impossibleDurationV1 (safe_auto)
* **detect**: `applyDurationGuard` reports either `rawDuration >
  240` or `rawSpanMin > 360` AND session not already marked
  `durationInvalid`.
* **dryRun**: report each session's raw/span/derived/durationInvalid.
* **apply**: if `derivedDurationMin` is sane → use it. Else mark
  `durationInvalid = true` in `_unknown` (Swift uses `_unknown`
  carrier for TS's ad-hoc `durationInvalid` field; TS spreads it onto
  TrainingSession via an intersection type), and set durationMin to
  `DATA_HEALTH_FALLBACK_DURATION_MIN` (60). **Never** use a 70-hour
  span as the repaired duration.

### staleTodayStatusV1 (safe_auto)
* **detect**: `applyTodayStatusGuard` returns
  `ignoredForCurrentReadiness == true` AND
  `runtimeFlags.todayStatusObservedDate` doesn't match the current
  observed date (idempotent-by-observation).
* **dryRun**: report stale date / daysOld.
* **apply**: rewrite `settings.dataHealthRuntimeFlags` to add
  `todayStatusIgnoredAt` (current time) + `todayStatusObservedDate`.
  Preserves the user's todayStatus payload (sleep/energy/soreness/
  time/date) untouched.

### staleHealthReadinessGuardV1 (safe_auto)
* **detect**: `applyHealthDataGuard` returns
  `staleForReadiness == true` AND
  `runtimeFlags.healthDataObservedLatestAt` doesn't match the current
  observed latest sample.
* **dryRun**: report latest sample date + daysOld.
* **apply**: rewrite `settings.dataHealthRuntimeFlags` to add
  `healthDataStaleSince` + `healthDataObservedLatestAt` +
  `healthDataObservedDaysOld`. Preserves all
  `healthMetricSamples` / `importedWorkoutSamples` and their `raw`
  blobs.

### legacyFinalAdviceIsolationGuardV1 (runtime_guard / audit-only)
* **detect**: scan sessions for any of: non-empty `explanations`,
  `deloadDecision`, exercise-level `suggestion`/`adjustment`/`warning`,
  `prescription.weeklyAdjustment` string.
* **dryRun**: report sample sessions with the legacy fields they
  carry.
* **apply**: returns `status == .skipped` with `repairedData ==
  appData` and a receipt explaining that runtime protection is
  enforced by `CleanAppDataView` (TS source-of-truth). Does NOT
  mutate AppData.

## 9. Receipt / ledger / idempotency behavior

* **Receipt**: each `runRepair` call produces a JSON object with
  shape matching TS `DataRepairLogEntry`:
  `{id, repairId, createdAt, repairedAt, category, action,
  affectedIds, beforeSummary, afterSummary, [before], [after]}`.
  Swift encodes this as `JSONValue`. The receipt is appended to
  `settings.dataRepairLogs` (FIFO cap 500, matching TS).
* **Ledger**: after a repair runs, the orchestrator builds a
  `DataHealthRepairLedgerEntry` and appends to
  `settings.dataHealthRepairLedger` via the iOS-3A
  `appendLedgerEntry` helper. FIFO cap 1000.
* **Idempotency**: each repair's `dryRun` computes an
  `idempotencyKey` via FNV-1a-like hash of `repairId + sorted
  affectedIds`. The orchestrator calls `isIdempotentMatch(...)`
  against the existing ledger using
  `DataHealthConstants.ledgerIdempotentWindowHours` (24h). Matches
  with `applied` or `noOp` status skip the repair.

`hashIdempotencyKey` port (`repairHelpers.ts:4`):

```swift
internal func hashIdempotencyKey(repairId: String, affectedIds: [String]) -> String {
    let sorted = Array(Set(affectedIds)).sorted()
    let payload = "\(repairId)|\(sorted.joined(separator: "|"))"
    var hash: Int32 = 0
    for scalar in payload.unicodeScalars {
        let charCode = Int32(scalar.value)
        hash = (hash << 5) &- hash &+ charCode
    }
    let positive = UInt32(bitPattern: hash)
    return "idem_\(repairId)_\(String(positive, radix: 36))_\(sorted.count)"
}
```

The TS JS hash uses signed 32-bit overflow + final `>>> 0` to land
on unsigned. The Swift port uses `Int32` with `&-` / `&+` overflow
operators and `UInt32(bitPattern:)` to reproduce that exactly.

`computeAppDataHash` similarly mirrors the TS shape:
`{schemaVersion, historyLength, historyIds[], todayStatusDate,
issueScoresKeys[], issueScoresSum, healthLatest}` → JSON →
FNV-1a-like → `"appdata_<base36>_<historyLength>"`.

## 10. Idempotency rules

The 5 repairs differ in their idempotency strategy:

* **sessionLifecycleResidueV1** + **impossibleDurationV1**: keyed by
  affected session ids. A second run with the same set of detected
  sessions produces the same key → skipped.
* **staleTodayStatusV1**: keyed by `affectedIds == ["todayStatus"]`.
  Also has a pre-detect check (`runtimeFlags.todayStatusObservedDate
  == guard.observedDate` → "already marked, don't re-detect"),
  giving double-protection.
* **staleHealthReadinessGuardV1**: same pattern — pre-detect check
  against `runtimeFlags.healthDataObservedLatestAt`.
* **legacyFinalAdviceIsolationGuardV1**: audit-only, every run
  produces a `skipped` ledger entry. The orchestrator's
  idempotency-by-key still applies but is less load-bearing here.

## 11. Real-export test strategy

`AutoRepairOrchestratorRealExportTests` loads the redacted real
export at `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`
via `#filePath` walk-up (same pattern as iOS-2C / iOS-3A) and
asserts:

1. The orchestrator returns successfully under a fixed clock
   anchored at the export date.
2. Detected repair IDs ⊆ {5 implemented iOS-3B safe IDs} —
   no `screeningIssueScore*`, `setIndexRenumber*`,
   `replacementEquivalence*` should appear.
3. `result.appData.canonicalJSONData()` is byte-equal to
   `input.appData.canonicalJSONData()` when nothing applied; else,
   diffs are accountable to the applied repair scopes.
4. Idempotency: a second `runAutoRepairOrchestrator` on
   `result.appData` returns `changed == false` and no new ledger
   entries beyond `noOp` / `skipped`.
5. `impossibleDurationV1` detects the known 4204-minute outlier
   (this is the canonical edge case the real export carries).

## 12. Data safety

* **No deletions.** No session, set, history text, unknown field, or
  user-entered date is removed by any iOS-3B repair.
* **No schemaVersion change.** All recipes preserve
  `appData.schemaVersion == 8`.
* **`_unknown` carrier preserved.** Per-type `_unknown` bags pass
  through verbatim except for the specific keys a repair is allowed
  to rewrite.
* **Backup-first.** The orchestrator calls
  `backupAdapter.snapshot(...)` before any apply. On backup failure,
  the AppData is NOT mutated and a `backup_failed` ledger entry is
  written.
* **Audit-only repairs do not mutate.** `legacyFinalAdviceIsolationGuardV1`
  ships as a runtime_guard layer — its `apply` returns
  `status == .skipped` and `repairedData == appData`.

## 13. Non-goals

* No `processIncomingAppData` (iOS-3D).
* No cloud upload (iOS-7).
* No `screeningIssueScore*` / `setIndexRenumber*` /
  `replacementEquivalenceAudit*` (iOS-3C).
* No `TrainingDecision` (iOS-4).
* No Focus Mode (iOS-5).
* No SwiftData / CoreData / `@Model` / `@Observable`.
* No Supabase / HealthKit.
* No third-party SwiftPM.
* No TS runtime behavior changes.
* No AppData schema changes.

## 14. Tests

Swift tests added under
`ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests/`:

* `AutoRepairOrchestratorRealExportTests.swift` — real-export
  integration with fixed clock.
* `SafeRepairRecipeTests.swift` — 5 recipe-level units (synthetic
  fixtures).
* `RepairRegistryTests.swift` — registry construction, duplicate
  rejection, layer filtering.
* `RepairReceiptTests.swift` — receipt encode/decode round-trip +
  appendDataRepairLog FIFO cap at 500.

20 required test scenarios are covered (see Phase 5 of the task
brief).

## 15. Static guards

* `tests/iosAutoRepairOrchestratorSafeRecipesStaticGuards.test.ts` —
  new. Asserts:
  * 7+ expected Swift files exist at canonical paths.
  * 5 safe repair IDs exist; 4 deferred IDs do NOT.
  * No `processIncomingAppData` Swift implementation.
  * No cloud / Supabase / HealthKit / TrainingDecision / Focus Mode
    Swift implementation.
  * No SwiftData / CoreData / `@Model` / `@Observable`.
  * No remote SwiftPM dep (only sanctioned local-path
    `../IronPathDomain`).
* `tests/iosDataHealthRuntimeFoundationStaticGuards.test.ts` —
  evolved. `AutoRepairOrchestrator` and `processIncomingAppData`
  deferred-symbol bans are narrowed: `AutoRepairOrchestrator` now
  sanctioned inside `ios/packages/IronPathDataHealth/`;
  `processIncomingAppData` still globally forbidden.
* `tests/iosBootstrapNoBusinessLogic.test.ts` — evolved.
  `AutoRepairOrchestrator_type` rule gains `exemptPrefixes:
  ['ios/packages/IronPathDataHealth/']`.

## 16. Xcode validation

Build matrix:
* `xcodebuild -destination 'generic/platform=iOS Simulator' build`
* `xcodebuild -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build`

Both must succeed without code signing.

## 17. Remaining risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| FNV-1a hash collision in `idempotencyKey` | Low | Same hash used in TS for 12+ months without observed collision; 24h window further limits exposure. |
| Backup-failure handler swallows error | Low | Ledger row records `status == .backupFailed` + warning; runtime guard remains active so the unrepaired AppData is still safe to read. |
| iOS-3C breaks an iOS-3B test by adding a new repair | Medium | iOS-3B tests assert "iOS-3B detected ⊆ 5 safe IDs"; once iOS-3C adds more, the assertion will need a narrow update. Documented in Phase 6. |
| `dataRepairLogs` cap at 500 differs from ledger cap at 1000 | Low | TS uses 500 for logs and 1000 for ledger; iOS-3B mirrors verbatim. |
| In-memory backup adapter loses backups across process restart | Documented | iOS-3D will wire `JSONFileAppDataStore` as the backing store; iOS-3B explicitly ships only the in-memory default. |

## 18. Next task

**iOS-3C Remaining Repair Recipes + Ingress Pipeline V1.** Scope:
* `screeningIssueScoreRuntimeGuardV1`
* `screeningIssueScoreRepairV1`
* `setIndexRenumberV1`
* `replacementEquivalenceAuditV1`
* `processIncomingAppData` (full ingress pipeline that wraps the
  orchestrator + the not-yet-ported cloud-upload-eligibility check)
* JSONFile-backed `AutoRepairBackupAdapter` wired through
  `IronPathPersistence`
* Bridge into iOS-4 TrainingDecision when that lands.
