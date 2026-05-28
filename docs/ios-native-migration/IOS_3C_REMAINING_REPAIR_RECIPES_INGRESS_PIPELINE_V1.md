# iOS-3C Remaining Repair Recipes + Ingress Pipeline V1

**Status:** in review (PR).
**Owner:** iOS-3C (Data Health — remaining recipes + ingress).
**Date:** 2026-05-28.
**Branch:** `claude/ios-3c-remaining-repair-recipes-ingress-pipeline-v1`.

## 1. Goal

iOS-3C closes the Data Health Swift surface area opened by iOS-3A/3B:

* 4 remaining V1 repair recipes
  (`screeningIssueScoreRuntimeGuardV1`,
  `screeningIssueScoreRepairV1`,
  `setIndexRenumberV1`,
  `replacementEquivalenceAuditV1`).
* `processIncomingAppData` Swift ingress pipeline — runs runtime
  guard → CleanAppDataView → backup → AutoRepairOrchestrator →
  produces a result struct with cleanView / repairedAppData /
  summary / warnings.
* `JSONFileAutoRepairBackupAdapter` — file-backed adapter using
  `FileManager.default` (no IronPathPersistence circular dep).
* Narrow static-guard evolutions sanctioning the 4 new repair IDs +
  the ingress pipeline inside `IronPathDataHealth`.

## 2. Why iOS-3C follows iOS-3B

iOS-3B shipped the orchestrator + 5 safe recipes. iOS-3C inherits
that contract and:

* Adds 1 more safe-auto recipe (`screeningIssueScoreRepairV1`) that
  mutates the typed screening adaptive state behind a 3-way safety
  predicate (movement flags all-good ∧ no pain ∧ no restriction).
* Adds 1 more safe-auto recipe (`setIndexRenumberV1`) that
  renumbers `setIndex` within per-exercise scope, preserving every
  other field of `TrainingSetLog`.
* Adds 1 runtime-guard recipe
  (`screeningIssueScoreRuntimeGuardV1`) that mirrors the iOS-3B
  `legacyFinalAdviceIsolationGuardV1` pattern — detect-only with
  `apply` returning `.skipped`.
* Adds 1 audit-only recipe
  (`replacementEquivalenceAuditV1`) — same skipped-apply pattern,
  scans for vertical-pull/push exercises wrongly mapped to
  horizontal-pull / fly equivalence chains.
* Wraps the orchestrator in `processIncomingAppData` so the boot /
  import / cloud-restore / etc. flows have a single Swift entry
  point that consumes an `AppData` and an `AppDataIngressSource`.

iOS-3C is the LAST PR in the Data Health swift-port arc. The next
arc is iOS-4 TrainingDecision Swift Port V1.

## 3. iOS-3B dependency confirmation

iOS-3C builds on iOS-3B (PR #399, commit `098f75c`). Required
upstream surface:

| iOS-3B/3A surface | iOS-3C usage |
| ----------------- | ------------ |
| `RepairDefinition` protocol | Conformance target for 4 new repairs |
| `RepairRegistry` + `safeRepairRegistry()` factory | Extended to 9 recipes via `fullRepairRegistry()` |
| `runAutoRepairOrchestrator(_:)` | Called by `processIncomingAppData` |
| `CleanAppDataView` + `buildCleanAppDataView` | Built unconditionally on every ingress |
| `RepairLedger` + `appendLedgerEntry` / `isIdempotentMatch` | Reused; iOS-3C adds no new ledger semantics |
| `AutoRepairBackupAdapter` protocol | New `JSONFileAutoRepairBackupAdapter` conformance |
| `applyIssueScoreCap` runtime guard | Used by 2 screening repairs |
| `RuntimeGuardClock` + `FixedRuntimeGuardClock` | Deterministic clock injection in tests |
| iOS-3B safety guarantees | Preserved as-is — drafts still preserved, backup_failed still leaves AppData unchanged |

## 4. Remaining repair IDs implemented

| Repair ID | Layer | Category | Mutates AppData |
| --------- | ----- | -------- | --------------- |
| `screeningIssueScoreRuntimeGuardV1` | runtime_guard | screening_decay | **NO** — apply returns `.skipped`; protection lives in `CleanAppDataView.cleanedScreening` |
| `screeningIssueScoreRepairV1` | safe_auto | screening_decay | YES — `screeningProfile.adaptiveState.issueScores` only, gated by `isFullySafeToWrite` predicate |
| `setIndexRenumberV1` | safe_auto | set_index_renumber | YES — `history[].exercises[].sets[].setIndex` only; all other set fields (weight/reps/RIR/id/done/etc.) preserved verbatim |
| `replacementEquivalenceAuditV1` | audit_only | identity_audit | **NO** — `supportsApply = false` from the protocol perspective; orchestrator short-circuits to `.skipped` |

`fullRepairRegistry()` bundles all 9 (5 from iOS-3B + 4 from iOS-3C)
in the canonical order matching `appDataRepairRegistry.ts`.

## 5. Pipeline design

```swift
public enum AppDataIngressSource: String, Equatable, Hashable, Sendable, CaseIterable {
    case boot                                                  // = "boot"
    case localStorageLoad   = "localStorage-load"
    case importRestore      = "import-restore"
    case backupRestore      = "backup-restore"
    case cloudRestore       = "cloud-restore"
    case cloudPull          = "cloud-pull"
    case readMirror         = "read-mirror"
    case cloudParity        = "cloud-parity"
    case accountSwitch      = "account-switch"
    case postSessionComplete = "post-session-complete"
    case preTrainingDecision = "pre-training-decision"
    case preCloudUpload     = "pre-cloud-upload"
    case export             = "export"
}

public func processIncomingAppData(
    appData: AppData,
    source: AppDataIngressSource,
    clock: RuntimeGuardClock = SystemRuntimeGuardClock(),
    options: AppDataIngressOptions = AppDataIngressOptions()
) throws -> AppDataIngressResult
```

Sequence:

1. Resolve per-source defaults (`allowMutation`, `allowAutoRepair`,
   `requireBackup`, `repairTrigger`) — same matrix as TS.
2. Validate guard: forbidden sources (`cloud-pull`, `read-mirror`,
   `cloud-parity`, `pre-training-decision`, `pre-cloud-upload`,
   `export`) reject `allowAutoRepair=true` without explicit
   `allowMutation=true` override.
3. Compute `appDataHashBefore` via iOS-3B `computeAppDataHash`.
4. Generate `operationId` (deterministic shape:
   `ingress_<source>_<scope>_<hash-suffix>_<unix-ms>_<rand>`).
5. Build `CleanAppDataView` (always — even on read-only sources).
6. If `allowMutation && allowAutoRepair`:
   - Call `runAutoRepairOrchestrator(...)` with the supplied or
     default backup adapter (default: `InMemoryAutoRepairBackupAdapter`).
   - Capture `orchestratorResult`; if `changed`, set
     `repairedAppData = orchestratorResult.appData`.
   - Propagate orchestrator warnings.
   - On orchestrator throw, capture as a warning, do NOT propagate.
7. Compose `passiveStatus` (Chinese UI strings preserved verbatim).
8. Read `repairSummary` via iOS-3B `readAutoRepairSummary`.
9. Return `AppDataIngressResult`.

**iOS-3C explicitly omits**:
- Cloud upload eligibility evaluation
  (`evaluateCloudUploadEligibility` from
  `src/dataHealth/uploadEligibility.ts`). The TS pipeline produces
  `shouldBlockCloudUpload` + `uploadEligibility`; iOS-3C does NOT,
  to keep cloud concerns out of this PR.
- Returns no `uploadEligibility` field, no `shouldBlockCloudUpload`
  field — iOS-7 will add them when wiring CloudKit / cloud-sync.

## 6. Backup adapter design

`JSONFileAutoRepairBackupAdapter` lives in
`ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/`. It
uses `FileManager.default` directly — no dependency on
`IronPathPersistence` to keep the package graph acyclic.

```swift
public struct JSONFileAutoRepairBackupAdapter: AutoRepairBackupAdapter {
    public init(directory: URL)
    public func snapshot(_ request: AutoRepairBackupRequest) throws -> AutoRepairBackupRecord
    public func list() -> [AutoRepairBackupRecord]
}
```

Storage layout:

* `directory/ironpath_auto_repair_backup_<ms>_<hashSuffix>.json` —
  the canonical AppData payload (atomic write via `Data.write(...
  options: [.atomic])`).
* The returned `AutoRepairBackupRecord.storage == .jsonFile`.
* `list()` enumerates the directory and parses the file-name
  convention to rebuild records. Crash safety: a half-written file
  is removed at write time by `.atomic`.

Backup-first contract preserved (per iOS-3B safety §12.1(b)):
the orchestrator catches the adapter's throw and leaves the
`AppData` byte-equal.

## 7. Runtime guard behavior

`screeningIssueScoreRuntimeGuardV1`:

* Layer: `runtime_guard`.
* `detect`: piggybacks `applyIssueScoreCap` on the screening profile;
  detected if any capping change would happen.
* `dryRun`: reports the cap deltas (`<key>: before → after`).
* `apply`: returns `.skipped` with `repairedData == appData`.
  Protection is enforced upstream by `CleanAppDataView`
  (`cleanedScreening.adaptiveState.issueScores` are already capped).

The orchestrator's `auditDefinitions` loop pulls this up as an audit
finding when detected, but never mutates AppData.

## 8. Safe-auto behavior

### screeningIssueScoreRepairV1 (safe_auto)

Safety predicate (`isFullySafeToWrite`):
* `movementFlags` map is non-empty AND every value `=== "good"`.
* `painTriggers` list is empty (or nil).
* `restrictedExercises` list is empty (or nil).

If the predicate is false, `detect.detected = false` — the
orchestrator never calls `apply`. iOS-3C will NEVER persist a
cap-write on a screening profile that still reports pain or
movement compensations.

When predicate is true and `applyIssueScoreCap` reports changes:
* `apply` rebuilds `screeningProfile.adaptiveState.issueScores` with
  the capped map.
* All other adaptiveState keys + `painTriggers` /
  `restrictedExercises` / `movementFlags` are preserved verbatim
  (Swift uses the `upsertKey` helper to splice the new issueScores
  into the existing adaptiveState object).

### setIndexRenumberV1 (safe_auto)

* `detect`: scans `history[].exercises[]` for an `ExercisePrescription`
  whose `sets` length ≥ 2 AND (every `setIndex == 0` OR has
  duplicates).
* `apply`: for each affected exercise, builds a new `sets` array
  where `sets[i].setIndex = i`. All other set fields preserved.
* The session id + exercise id pair is the affectedId
  (`<sessionId>/<exerciseId>` — matches TS shape).

## 9. Audit-only behavior

`replacementEquivalenceAuditV1`:

* Layer: `audit_only`. `supportsApply = false`.
* `detect`: scans `history[].exercises[]` for:
  - `actualExerciseId ∈ {assisted-pull-up, pull-up, chin-up}` AND
    `equivalence.chainId` contains `"horizontal-pull"`, OR
  - `actualExerciseId ∈ {assisted-dip, dip, bench-dip}` AND
    `equivalence.chainId === "fly"`.
* The orchestrator's `auditDefinitions` loop surfaces this as an
  audit finding when detected, but never calls `apply`.

iOS-3C stays audit-only because no deterministic curated remap
exists; rewriting actual/original/equivalence fields would corrupt
PR ownership and total volume ownership.

## 10. Replacement / equivalence audit-only decision

The TS reference is audit-only too (`layer: 'audit_only'`,
`apply: status === 'skipped'`). iOS-3C does NOT escalate to safe-auto
even though Swift now has the typed `ExercisePrescription` model with
identity fields:

* `originalExerciseId`, `actualExerciseId`, `displayExerciseId`,
  `recordExerciseId` are exposed by iOS-2C, but rewriting them is
  unsafe without:
  - A curated chain map (e.g., a JSON file shipped with the app).
  - Round-trip parity tests proving PR identity is preserved.
* iOS-3C does NOT ship that curated map; iOS-3D/iOS-4 may.

## 11. setIndex safety constraints

`setIndexRenumberV1` is the only iOS-3C recipe that rewrites a
field inside the per-set log structure. Constraints:

* **Per-exercise / per-session scope only.** The renumber runs
  inside `history[i].exercises[j]`. It never touches a different
  exercise's sets, and never moves sets between exercises.
* **Set identity preserved.** `TrainingSetLog.id` is NOT rewritten.
  PR ownership, equivalence chain attribution, and downstream cloud
  parity all rely on `id`.
* **Sets never deleted.** The output array has the same count as
  the input array.
* **Reps / weight / RIR / RPE / pain flag / completion preserved.**
  Only `setIndex` is touched.
* **Idempotent.** Running twice produces the same `sets` array.
* **Detect-based.** A session with already-correct setIndex (no
  duplicates, not-all-zero) won't trigger the repair.

Locked by tests in §17.

## 12. Screening issue score safety constraints

`screeningIssueScoreRepairV1` is the highest-risk iOS-3C recipe
because it persists numeric changes to user-screening adaptive
state.

Constraints:

* **3-predicate safe-write gate.** Movement flags all-good AND no
  pain AND no restriction. Failing ANY predicate → `detect.detected
  = false` → no apply call.
* **issueScores only.** All other `adaptiveState` keys plus
  `painTriggers` / `restrictedExercises` / `movementFlags` /
  `correctionPriority` etc. are preserved verbatim.
* **Cap source-of-truth.** Uses iOS-3A `applyIssueScoreCap` —
  the same runtime guard CleanAppDataView consumes. Hard cap = 50;
  soft cap = 12 when all-good.
* **Receipt before/after.** Captures the issueScores map both
  before and after as JSONValue payloads for downstream forensics.
* **Idempotent.** Second run sees capped values → no further cap
  deltas → `detect.detected = false`.

`screeningIssueScoreRuntimeGuardV1` carries the read-side
protection regardless of predicate state — `CleanAppDataView`
always sees the capped issueScores.

## 13. Receipt and ledger behavior

iOS-3C uses the iOS-3B receipt + ledger plumbing verbatim:

* `runRepair` builds the receipt via `buildReceipt(...)` and
  appends to `settings.dataRepairLogs` (FIFO cap 500).
* The orchestrator builds a `DataHealthRepairLedgerEntry` and
  appends to `settings.dataHealthRepairLedger` (FIFO cap 1000).
* Idempotency window: 24h, keyed by `hashIdempotencyKey(repairId,
  sortedAffectedIds)`.
* iOS-3B backup_failed safety still applies — orchestrator returns
  `result.appData == input.appData` byte-equal on backup failure;
  diagnostics live only in the result struct.

## 14. Real-export test strategy

`AppDataIngressPipelineRealExportTests`:

1. Load redacted real export at
   `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`
   via `#filePath` walk-up.
2. Run `processIncomingAppData(appData:, source: .boot, clock:
   FixedRuntimeGuardClock(2026-05-28), backupAdapter:
   InMemoryAutoRepairBackupAdapter())`.
3. Assert:
   - Returns successfully.
   - `result.cleanView.raw == appData`.
   - Detected repair IDs ⊆ {9 V1 IDs} (5 iOS-3B + 4 iOS-3C).
   - On a second run, no new `applied` repairs (idempotency).
4. `pre-training-decision` source: `result.repairedAppData == nil`,
   no orchestrator call, but `result.cleanView` is still built.
5. `cloud-pull` source: same read-only stance.

## 15. Data safety

* All iOS-3A/3B safety guarantees preserved.
* iOS-3C-specific:
  - `screeningIssueScoreRepairV1` writes only inside the safe
    predicate.
  - `setIndexRenumberV1` preserves set identity + every non-index
    field.
  - `replacementEquivalenceAuditV1` never mutates.
  - Ingress pipeline never deletes data, never changes
    schemaVersion, never blocks cloud upload (defers entire
    eligibility check to iOS-7).

## 16. Non-goals

* No cloud upload eligibility / `evaluateCloudUploadEligibility`
  Swift port (iOS-7).
* No `TrainingDecision` / `buildTrainingDecision` (iOS-4).
* No Focus Mode (iOS-5).
* No HealthKit (iOS-8+).
* No Supabase (iOS-7+).
* No SwiftData / CoreData / `@Model` / `@Observable`.
* No third-party SwiftPM.
* No TS runtime behavior changes.
* No AppData schema changes.
* No `pnpm-lock.yaml`.
* No `--admin` merges.

## 17. Tests

Swift tests (new):

* `repairs/ScreeningIssueScoreRuntimeGuardRepairTests` — detect
  contradictory exploded scores, apply returns `.skipped`.
* `repairs/ScreeningIssueScoreRepairTests` — safe-write predicate,
  predicate-blocked, preserves pain/restriction, idempotency.
* `repairs/SetIndexRenumberRepairTests` — per-exercise scope,
  preserves IDs, idempotent, preserves weight/reps/RIR/etc.
* `repairs/ReplacementEquivalenceAuditRepairTests` — detect
  mismatches, never mutates.
* `AppDataIngressPipelineTests` — boot builds clean view +
  triggers orchestrator, importRestore allows repair,
  preTrainingDecision never returns repaired data, cloudPull is
  read-only, backup-adapter failure prevents mutation.
* `AppDataIngressPipelineRealExportTests` — real export runs
  through the pipeline; idempotent on second run.
* `JSONFileAutoRepairBackupAdapterTests` — writes backup file
  atomically; `list()` round-trips; missing-directory creation;
  failure throws → orchestrator catches.
* `FullRepairRegistryTests` — 9 IDs in canonical order; ledger
  receipt round-trip across the new 4.

iOS-3B test updates (narrow):
* `RepairRegistryTests.testSafeRegistryExcludesDeferredRecipes` →
  renamed to assert `safeRepairRegistry()` (iOS-3B factory) still
  bundles only the 5; iOS-3C ships the additional 4 via
  `fullRepairRegistry()`.
* `AutoRepairOrchestratorRealExportTests.testDetectedRepairsAreSubsetOfSafeIds`
  → updated bound to {9 IDs} when using full registry. (Test still
  uses the safe registry — bound unchanged.)

## 18. Static guards

* `+ tests/iosRemainingRepairRecipesIngressPipelineStaticGuards.test.ts`
  — file surface, repair IDs declared, pipeline + source enum,
  JSON-file backup adapter, forbidden-imports (cloud / Supabase /
  HealthKit / TrainingDecision / SwiftData / CoreData / `@Model` /
  `@Observable`), Package.swift surface unchanged.
* `~ iosAutoRepairOrchestratorSafeRecipesStaticGuards.test.ts` —
  `safeIds` list still 5 (iOS-3B safe set); the iOS-3C `safeIds`
  list lives in the new file. The "deferred recipes NOT in any
  Swift source" guard relaxed: iOS-3C IDs are now sanctioned inside
  `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/repairs/`.
* `~ iosDataHealthRuntimeFoundationStaticGuards.test.ts` —
  removes `processIncomingAppData_func` from the deferred-symbol
  list. `TrainingDecision_type` and `AppDataRepairLedger_type` stay
  forbidden.
* `~ iosBootstrapNoBusinessLogic.test.ts` — no changes (the iOS-3B
  exempt prefixes still cover the new recipes).

## 19. Xcode validation

Build matrix:
* `xcodebuild -destination 'generic/platform=iOS Simulator' build`
* `xcodebuild -destination 'platform=iOS Simulator,name=iPhone 17
  Pro' build`

Both must succeed without code signing.

## 20. Remaining risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| `screeningIssueScoreRepairV1` writes a cap value that disagrees with TS in edge cases | Low | Cap math uses iOS-3A `applyIssueScoreCap` (same code path as runtime guard) |
| `setIndexRenumberV1` re-orders sets that already encode user intent | Low | Repair only triggers when all-zero or duplicates; not when index is sane but out-of-order |
| JSONFile backup adapter file-naming collision (same millisecond) | Low | filename includes appDataHashBefore suffix; collision requires both same ms and same hash |
| Ingress passive-status Chinese strings drift from TS | Low | Strings copied verbatim from TS source |
| Future curated chain map lands in iOS-3D escalating replacementEquivalenceAuditV1 to safe-auto | N/A | iOS-3C explicitly stays audit-only; iOS-3D will own that escalation |

## 21. Next task

**iOS-4 TrainingDecision Swift Port V1** — only after iOS-3C passes.
Scope:
* Swift port of `src/recommendation/buildTrainingDecision*`.
* Consumes `CleanAppDataView`.
* Locks numeric parity vs TS for the recommendation pipeline.
* No UI; no cloud sync; no HealthKit.
