# iOS Native Migration — Agent 3: Data Model / AppData / Repair Agent

Status: docs-only audit, no source touched.
Last updated: 2026-05-27
Owner: Agent 3 — Data Model / Repair.

This report decides how the iOS native app should:

1. Store AppData on disk.
2. Migrate the schema ladder.
3. Carry over Data Health repair semantics (Runtime Guard / Safe Auto / Audit Only).
4. Import/export the current Web/PWA backup file.
5. Protect TrainingDecision from raw dirty AppData on Swift side.

Out of scope (handled by other agents):

- Cloud sync, RLS, upload pipeline → Agent 4.
- UI / app shell architecture / navigation → Agent 5.
- Entry-gate behavior across PWA-vs-iOS / coexistence semantics → root coordinator.

---

## 1. Mission

Protect the AppData schema and the repair semantics that ship in the PWA today, across the iOS native rewrite. The PWA currently runs three guard layers on top of localStorage — Runtime Guard (pure, derived `CleanAppDataView`), Safe Auto Repair (mutating with backup + ledger + receipt), and Audit Only (detection without rewrite). None of those guarantees may regress on iOS.

The single concrete deliverable for Swift is:

- One on-device `AppData` snapshot file (atomic write + previous-version backup).
- One Swift port of the Data Health repair engine (registry, ledger, receipt, orchestrator) reading/writing the same JSON shape.
- One import/export contract identical to `src/storage/backup.ts` so PWA backups round-trip into iOS without semantic loss.

The recommended storage is **JSON snapshot first**. SQLite / SwiftData / Core Data is **explicitly deferred** until profiling on real device data sizes shows the snapshot approach has measurable problems. The two prior attempts to normalize (`src/storage/localStorageToSqliteMigrationDryRun.ts`, `src/storage/localStorageToSqliteMigrationApply.ts`, `src/storage/migrationRollbackRecovery.ts`) never shipped to production for a reason — premature normalization breaks the immunity layer that the rest of the codebase has been hardening for the past half-year.

---

## 2. Files / dirs inspected

Schema & model:

- `src/data/appConfig.ts` (lines 1–76) — `STORAGE_VERSION = 8`, `STORAGE_KEY`, `STORAGE_KEYS` map, mode metadata.
- `src/models/training-model.ts` lines 1300–1387 — `AppSettings`, `DismissedCoachAction`, `DismissedDataHealthIssue`, `DataRepairLogEntry`, `AppData` (the top-level interface at ~line 1362).
- `src/models/training-data.schema.json` (728 lines) — Ajv-2020 schema, `additionalProperties: true` in 40 places.
- `src/models/training-program.schema.json` (73 lines) — referenced via `$ref` from data schema.

Storage adapters:

- `src/storage/localStorageAdapter.ts` (420 lines) — split-key write order with `version` as commit marker (Bug #8 fix at lines 82–127), plus cloud-sync flow envelope and parity diagnostic.
- `src/storage/apiStorageAdapter.ts` — read-mirror only; not the source of truth.
- `src/storage/appDataMigration.ts` (194 lines) — migration ladder `migrateToV1`…`migrateToV6` (note: V5 and V6 both stamp `STORAGE_VERSION = 8`; no V7 or V8 step exists).
- `src/storage/appDataSanitize.ts` (1110 lines) — `sanitizeData`, `emptyData`, per-area sanitizers; contains time-sensitive defaults (`Date.now()` at line 639, `new Date().toISOString()` at lines 550, 588).
- `src/storage/appDataValidation.ts` (8 lines) — compiled Ajv `validateAppDataSchema` / `validateProgramSchema`.
- `src/storage/appDataStorageUtils.ts` (185 lines) — `pickRecord` / `pickEnum` / `coerceSchemaVersion` / `normalizeExerciseIdentity`.
- `src/storage/persistence.ts` (45 lines) — `loadData()` / `saveData()` facade; the one place runtime callers go through.
- `src/storage/backup.ts` (42 lines) — `getBackupFileName`, `exportAppData`, `importAppData` (the PWA-iOS handoff format).
- `src/storage/bootFromApiSnapshot.ts` (151 lines) — dev-only API snapshot adopter; useful as a template for how iOS will adopt cloud-restored payloads.
- `src/storage/runtimeSourceConfig.ts` (142 lines), `src/storage/runtimeSourceSelector.ts` (70 lines) — runtime source mode (`localStorage` / `api-readonly` / `api-primary-dev`).
- `src/storage/localStorageToSqliteMigrationDryRun.ts` (207 lines), `src/storage/localStorageToSqliteMigrationApply.ts` (249 lines), `src/storage/migrationRollbackRecovery.ts` (308 lines) — prior SQLite attempt, dev-gated, never shipped. Evidence cited in §4 below.

Data Health repair:

- `src/dataHealth/appDataIngressPipeline.ts` (233 lines) — `processIncomingAppData` is the single ingress contract.
- `src/dataHealth/autoRepairOrchestrator.ts` (276 lines) — backup-first → safe-auto repair → receipt + ledger.
- `src/dataHealth/appDataRepairEngine.ts` (123 lines) — `buildRegistry`, `runRepair`, receipt append.
- `src/dataHealth/appDataRepairLedger.ts` (117 lines) — `dataHealthRepairLedger`, idempotency window 24h, cap 1000.
- `src/dataHealth/appDataRepairRegistry.ts` (49 lines) — V1 registry of 9 repairs.
- `src/dataHealth/appDataRepairTypes.ts` (124 lines) — all repair types + constants.
- `src/dataHealth/cleanAppDataView.ts` (155 lines) — derived view, never mutates.
- `src/dataHealth/dataHealthRuntimeGuard.ts` (341 lines) — pure guards consumed by `cleanAppDataView`.
- `src/dataHealth/autoRepairBackupAdapter.ts` (190 lines) — IndexedDB → localStorage → in-memory fallback; retention 5.
- `src/dataHealth/uploadEligibility.ts` (109 lines), `src/dataHealth/uploadEligibilityGuard.ts` (265 lines) — cloud upload gate.
- `src/dataHealth/repairs/` — 9 repair recipes + `repairHelpers.ts` (the `computeAppDataHash` lives here, line 71).

Docs:

- `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` — V1 delivery (9 repair IDs).
- `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1_PLAN.md` — automation-first design rationale.
- `docs/DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md` — single ingress pipeline.
- `docs/DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md` — three deferred audit classes.
- `docs/DATA_HEALTH_DIAGNOSTICS_CLARITY_PACK.md` — Chinese-first user copy contract.
- `docs/APPDATA_OWNERSHIP_MATRIX.md` — Phase-5 ownership categories.

TrainingDecision contract (referenced as upstream consumer):

- `src/engines/trainingDecisionCleanInput.ts` (239 lines) — branded `CleanTrainingDecisionInput` / `CleanTrainingDecisionContextSource` factories. Raw AppData cannot satisfy the brand; iOS Swift port must replicate this gate.

Tests inspected for behavior spec:

- `tests/appDataSnapshotHashCanonical.test.ts` — the hash is pure + jsonb-roundtrip stable; **never canonicalise through `sanitizeData`** (regression covered).
- `tests/realDataHealthRepairFixture.test.ts`, `tests/realDataHealthRepairUnits.test.ts`, `tests/realDataHealthRepairPipeline.test.ts`, `tests/realDataHealthRepairStaticGuards.test.ts` — 38 tests describing the V1 contract.
- `tests/dataHealthCloudRestoreLinkagePipeline.test.ts`, `tests/dataHealthCloudRestoreLinkageStaticGuards.test.ts` — 37 ingress tests.
- `tests/trainingDecisionCleanInputContractFactory.test.ts`, `tests/trainingDecisionCleanInputContractStaticGuards.test.ts`, `tests/trainingDecisionCleanInputContractTypeGuards.test.ts` — Clean Input Contract Lock V1.
- `tests/localStorageToSqliteMigrationDryRun.test.ts`, `tests/localStorageToSqliteMigrationApply.test.ts`, `tests/localStorageToSqliteMigrationApplySafety.test.ts`, `tests/migrationRollbackRecoveryHardening.test.ts` — prior SQLite-attempt safety boundaries.
- `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` — the real-data regression fixture for the 10 dirty-data classes.

---

## 3. AppData schema snapshot

### 3.1 Top-level (`AppData` at `src/models/training-model.ts:1362`)

Required:

- `schemaVersion: number` — currently 8 (see `STORAGE_VERSION` in `src/data/appConfig.ts:4`).
- `templates: TrainingTemplate[]`
- `history: TrainingSession[]` — append-only domain log; the most data-dense slot.
- `bodyWeights: BodyWeightEntry[]`
- `activeSession: TrainingSession | null` — sanitized to `null` if `completed=true` (see `appDataSanitize.ts:1009`).
- `selectedTemplateId: string`
- `trainingMode: TrainingMode` — `'hybrid' | 'strength' | 'hypertrophy'`.
- `unitSettings: UnitSettings`
- `todayStatus: TodayStatus`
- `userProfile: UserProfile`
- `screeningProfile: ScreeningProfile`
- `programTemplate: ProgramTemplate`
- `mesocyclePlan: MesocyclePlan`
- `settings: AppSettings` — also the open key-bag for repair ledger, repair receipts, auto-repair summary, runtime flags. This is the most schema-fluid surface.

Optional:

- `programAdjustmentDrafts?`, `programAdjustmentHistory?`, `activeProgramTemplateId?`
- `healthMetricSamples?`, `importedWorkoutSamples?`, `healthImportBatches?`
- `dismissedCoachActions?`, `dismissedDataHealthIssues?`, `pendingSessionPatches?`
- `adaptiveCalibration?`

### 3.2 Settings as an "open bag" — important for Swift port

`AppSettings` (line 1322) is declared with `[key: string]: unknown`. The schema (`training-data.schema.json` line 117) sets `additionalProperties: true` on `settings`. The repair system uses this open bag to store, without bumping schemaVersion:

- `settings.dataHealthRuntimeFlags` (`DataHealthRuntimeFlags` at types.ts:88) — staleness markers consumed by `dataHealthRuntimeGuard.ts`.
- `settings.dataHealthRepairLedger: DataHealthRepairLedgerEntry[]` (cap 1000) — idempotency authority, `appDataRepairLedger.ts:8`.
- `settings.dataHealthAutoRepairSummary` — last-run summary, `autoRepairOrchestrator.ts:24`.
- `settings.dataRepairLogs: DataRepairLogEntry[]` (cap 500) — UI-facing receipt log.
- `settings.healthIntegrationSettings`, `settings.activeProgramTemplateId`, `settings.unitSettings`, `settings.selectedTemplateId`, `settings.trainingMode` (mirrored).

Swift implication: `AppSettings` cannot be a `struct AppSettings: Codable` with closed properties. Either model it as `[String: AnyCodable]` (or a custom `JSONValue` enum) with typed accessors for known keys, OR enforce a Swift-side schema that catalogues each known slot. Treat anything unknown as opaque and preserve it through write — the PWA explicitly relies on `additionalProperties: true` for new settings keys arriving from future versions.

### 3.3 SchemaVersion ladder (current state in TS)

`migrateTrainingData` (`appDataMigration.ts:166`) walks the ladder:

| from | to | step name | shape change |
|---|---|---|---|
| 0 (or absent) | 1 | `migrateToV1` | hoist `activeSession`/`todayStatus`/`bodyWeights`/profile/screening/program/mesocycle from legacy keys; stamp `selectedTemplateId='push-a'`, `trainingMode='hybrid'`. |
| 1 | 2 | `migrateToV2` | normalize `history` + `activeSession` sets through `migrateLegacyExercise`/`migrateLegacySet`. Synthetic ID normalization (`normalizeExerciseIdentity` at `appDataStorageUtils.ts:82`). |
| 2 | 3 | `migrateToV3` | normalize `screeningProfile.adaptiveState` (`issueScores`, `painByExercise`, `performanceDrops`, `improvingIssues`, `moduleDose`). |
| 3 | 4 | `migrateToV4` | move `selectedTemplateId` and `trainingMode` into `settings`. |
| 4 | 5 | `migrateToV5` | stamp `schemaVersion = STORAGE_VERSION` on root + settings (no shape change, just a version bump). |
| 5 | 8 | `migrateToV6` | add `restTimerState`, `supportExerciseLogs`, `mesocyclePlan`, `programAdjustmentDrafts/History`, `activeProgramTemplateId`. **And then stamps `schemaVersion = STORAGE_VERSION` directly to 8.** |

### 3.4 Real schema risk: 6 → 8 collapsed

`STORAGE_VERSION = 8` but the migration ladder only has `migrateToV1..V6`. V6's last line stamps `schemaVersion: STORAGE_VERSION` (= 8) and the loop's terminal condition is `if (version < STORAGE_VERSION) migrateToV6(...)`. Net effect: schemaVersion 6, 7, 8 are **functionally indistinguishable** from sanitize/migrate's point of view. The version bumps to 7 and 8 reflect downstream contract changes (sanitizer added new optional fields, repair ledger started writing into `settings`, etc.) without a structural migration step. Swift will need to either:

- replicate this "collapsed ladder" exactly (single migrate step covers 5→8), AND
- treat the trio (6, 7, 8) as equivalent for input validation, OR
- introduce a clean V7/V8 step that is a no-op for shape but documents what changed semantically. This is the safer path for future iOS-side migrations.

This is flagged again in §10.

### 3.5 Storage keys (PWA localStorage layout)

`STORAGE_KEYS` in `src/data/appConfig.ts:5`:

```
version, templates, history, activeSession, todayStatus, bodyWeights,
userProfile, screeningProfile, programTemplate, mesocyclePlan,
healthMetricSamples, importedWorkoutSamples, healthImportBatches, settings
```

`writeAppDataToLocalStorage` (`localStorageAdapter.ts:76`) writes 13 split keys then writes `version` last as a commit marker. iOS does not need split keys — one snapshot file is fine — but the *commit ordering* (write data first, then the version marker last) IS the safety principle, and that maps to atomic file replace + previous-version backup on iOS.

---

## 4. iOS AppData storage strategy

### 4.1 Recommendation: JSON snapshot file first

Use `FileManager.default.url(for: .applicationSupportDirectory, ...)` (or `App Group` container if Watch/Widget extensions are planned later — Agent 5's call). One file: `appData.v8.json`. Atomic write with `Data.writeOptions = [.atomic, .completeFileProtectionUnlessOpen]`.

The strict file layout on disk:

```
<AppGroup>/ironpath/
   appData.v8.json                  # the live snapshot (atomic-written)
   appData.previous.json            # one-step rollback, written BEFORE replacing the live file
   backups/
      autoRepair_<isoTs>_<hash8>.json     # safe-auto repair pre-mutation backups (cap 5, mirrors autoRepairBackupAdapter retention)
      userExport_<isoTs>.json             # manual exports via export-to-Files
   diagnostics/
      lastParityFailure.json              # mirrors src/storage/localStorageAdapter.ts LAST_PARITY_FAILURE_KEY
```

The single live snapshot is the same shape as `JSON.parse(JSON.stringify(appData))` from TS. Decoding on iOS uses `JSONDecoder` configured with:

- `keyDecodingStrategy = .useDefaultKeys` (TS uses camelCase — match it; do NOT convert).
- `dateDecodingStrategy = .iso8601` for fields that are guaranteed ISO; for fields that are sometimes legacy/empty strings (`history[].date`, `todayStatus.date`), keep as `String` and parse at consumption time — see §10 for why.

### 4.2 Why JSON first, not SQLite / SwiftData / Core Data

The repo has prior evidence that the team was already wary of premature normalization:

- `src/storage/localStorageToSqliteMigrationDryRun.ts` lines 1–207 — dry-run only, never enabled in production. Output type `MigrationDryRunResult` explicitly returns `shouldWriteSqlite: false, shouldWriteLocalStorage: false, shouldSwitchSource: false, productionReady: false`.
- `src/storage/localStorageToSqliteMigrationApply.ts:84` — `MIGRATION_APPLY_FLAG_VALUE = 'localstorage-to-sqlite-apply'`. Gated by `env.DEV === true || env.DEV === 'true'` AND `env.VITE_IRONPATH_MIGRATION_APPLY === 'localstorage-to-sqlite-apply'` AND `options.confirmApply === true` AND a separate backup record passed in AND an injected writer. Five gates. The apply path still returns `productionReady: false`.
- `src/storage/migrationRollbackRecovery.ts:78` — `MIGRATION_ROLLBACK_FLAG_VALUE = 'localstorage-to-sqlite-rollback'`, same gate-fence pattern, exists purely to recover *from* the SQLite experiment.
- `docs/APPDATA_OWNERSHIP_MATRIX.md` lines 17–28 — "At Task 5.2 entry, localStorage remains the App runtime source of truth. … API/SQLite ownership is only a future dev/local candidate."

Reading those three migration files together, the design intent is clear: the team built a SQLite migration prototype, decided it was not safe to enable in production, locked it behind a kill-switch, and shipped a rollback path that survives if anyone ever does enable it. That is the explicit "we tried; do not normalize prematurely" signal.

The repair layer hardens this further:

- The whole repair pipeline (`appDataRepairEngine`, `autoRepairOrchestrator`, `cleanAppDataView`) treats AppData as a single in-memory JSON object. Every safe-auto repair clones the whole AppData (`repairHelpers.ts:68` `cloneAppData = JSON.parse(JSON.stringify(appData))`), mutates the clone, and persists via the normal `saveData` path. SQLite-row-level repair was never designed; introducing it on iOS would require re-designing every repair recipe.
- `tests/appDataSnapshotHashCanonical.test.ts` codifies that the snapshot hash is computed by stable JSON serialization (not through sanitize); going to SQLite means the hash no longer corresponds to "what is on disk" the same way, which breaks parity with the cloud.
- The backup adapter for repair (`autoRepairBackupAdapter.ts:147`) writes `JSON.stringify(appData)` as a single payload. Cap is 5 backups. That maps to FileManager perfectly; mapping it to SQLite means storing 5 large blobs in a single row, which gives you nothing SQLite would solve.

### 4.3 Criteria to escalate from JSON snapshot to something normalized

Defer migration to SQLite/SwiftData/Core Data **only** when one of these is measured (not guessed) on a real production user's data:

| Metric | Threshold | Why this matters |
|---|---|---|
| `appData.v8.json` file size (uncompressed) | > 5 MB | Above this, atomic write latency can become user-visible on older iPhones (≥ ~50–100ms write). The current real-export fixture is around 80–150KB; 5 MB is roughly 30–60× growth, ~3000–5000 sessions for a typical user. |
| End-to-end save time | p95 > 80 ms on iPhone 13 or newer | Includes JSON encode + atomic write + previous-version copy. Above this users notice the "save spinner". |
| Cold start decode time | p95 > 250 ms | Above this we should consider lazy-decoding the heavy slots (`history`, `healthMetricSamples`). |
| Repair-orchestrator pass time | p95 > 300 ms | All 9 detect+dryRun loops together. Currently O(history * exercises * sets). |
| Required range query | "give me all sessions in last 28 days" runs O(n) on every read AND is on a hot path. | Currently the hot path uses `history.slice(-N)`. iOS callers should mirror that — only worry if we discover a new consumer that needs date-range scans. |

When ANY one of those is breached, the migration path is **NOT** "rewrite everything to SQLite". It is: split the single snapshot file into shards along natural boundaries that already exist in `STORAGE_KEYS` (history, healthMetricSamples, importedWorkoutSamples, healthImportBatches, settings), reuse the same JSON shapes. The Swift code that consumes them stays identical except for IO. SQLite is **only** considered after sharding has been measured to still be insufficient — and at that point, the data domain that *actually* needs row-level queries (Apple Health samples is the realistic candidate, since they're 50K+ rows in the fixture from a 90-day window) gets its own SQLite layer. AppData proper stays JSON.

This is exactly the layering `localStorageAdapter.ts:31-74` already does today — splitting `templates`, `history`, etc. into separate keys but the *settings* and *small singletons* into one envelope, then re-assembling at read time.

### 4.4 What this means for Swift code shape

- `AppData` is a Swift `struct` that mirrors `src/models/training-model.ts:1362`.
- `AppDataStore` is a class that owns IO. Exposes `load() throws -> AppData`, `save(_ appData: AppData) throws`, `export() -> Data`, `import(_ data: Data) throws -> AppData`.
- `AppData.settings` cannot be a closed struct. Use `[String: JSONValue]` (custom enum) with typed accessors. See §6.4.
- No `NSManagedObject`, no `@Model` (SwiftData), no SQLite at this layer. Those land in `HealthDataStore` (Apple Health samples — Agent 4 will likely scope this) if and when needed.

---

## 5. CleanAppDataView migration strategy

### 5.1 What CleanAppDataView is, on the TS side

`src/dataHealth/cleanAppDataView.ts:86` `buildCleanAppDataView(rawAppData, clock)` is a **pure** function that:

- Walks every session in `history` and applies `applySessionLifecycleGuard` + `stripLegacyAdviceFromSession` + `applyDurationGuard` from `dataHealthRuntimeGuard.ts` (lines 43, 85, 300).
- Computes a `TodayStatusGuardOutcome` (stale-after-3-days → ignore for readiness).
- Computes a `HealthDataGuardOutcome` (stale-after-14-days → degrade `useHealthDataForReadiness`).
- Caps `issueScores` to hard 50 / soft 12 when `movementFlags` all good and no pain/restriction.
- Filters `performanceDrops` when recent sessions show recovery.
- Returns a `CleanAppDataView` with `raw`, `appData` (cleaned), `durations`, `todayStatus`, `healthData`, `issueScoreCap`, `performanceDrops`, `guardDiagnostics`.

It never mutates `rawAppData`. The point of the type is to *brand* the cleaned snapshot so downstream consumers (TrainingDecision) cannot accidentally read raw data.

### 5.2 Swift port

`struct CleanAppDataView { let raw: AppData; let appData: AppData; ...outcomes }`.

`func buildCleanAppDataView(_ raw: AppData, clock: GuardClock = .system) -> CleanAppDataView` — same purity contract.

All `apply*Guard` functions become free Swift functions in a `DataHealthRuntimeGuard.swift` file. They are pure (no IO, no globals, no time except via the injected `clock`). Match the TS unit tests exactly — port `tests/realDataHealthRepairUnits.test.ts` into XCTest one-for-one. The behavioral spec is fixed.

### 5.3 The branded-input contract

`src/engines/trainingDecisionCleanInput.ts:58` defines `CLEAN_TRAINING_DECISION_INPUT_BRAND = Symbol.for('ironpath.trainingDecision.cleanInput.v1')`. The brand is stamped via `Object.defineProperty(value, brand, { enumerable: false })` — survives reference checks, dropped by JSON.stringify. Any caller that constructs a `TrainingDecisionInput` without going through `createCleanTrainingDecisionInput(cleanView, metadata)` is rejected at runtime.

Swift equivalent: a public `CleanTrainingDecisionInput` struct that has a private initializer:

```swift
public struct CleanTrainingDecisionInput {
    public let template: TrainingTemplate
    public let history: [TrainingSession]
    public let todayStatus: TodayStatus
    public let screening: ScreeningProfile
    // ...
    fileprivate init(...) { ... }
}

public enum TrainingDecisionInputFactory {
    public static func make(from cleanView: CleanAppDataView,
                            metadata: CleanTrainingDecisionInputMetadata) -> CleanTrainingDecisionInput {
        CleanTrainingDecisionInput(...) // only call site
    }
}

public func buildTrainingDecision(_ input: CleanTrainingDecisionInput, surfaces: ...) -> TrainingDecision { ... }
```

Because the initializer is `fileprivate` and only the `make(from:)` static factory inside `TrainingDecisionInputFactory` (in the same file) constructs it, every other call site is forced through the factory which requires a `CleanAppDataView`. Static guarantee: raw `AppData` cannot reach `buildTrainingDecision`. This is stricter than the TS brand (which is runtime-only) — Swift can enforce it at compile time. Take that win.

The mirror tests on the TS side that validate this are `tests/trainingDecisionCleanInputContractStaticGuards.test.ts` and `tests/realDataHealthRepairStaticGuards.test.ts`. Swift port should ship an XCTest equivalent that scans the Swift source for any direct `TrainingDecisionInput.init` outside the factory file.

---

## 6. Repair engine / repair ledger / repair receipt migration strategy

### 6.1 The three data slots the PWA writes to

All inside `AppData.settings` (the open bag):

| Slot | Schema (location in `src/dataHealth/appDataRepairTypes.ts`) | Cap | Purpose |
|---|---|---|---|
| `settings.dataRepairLogs: DataRepairLogEntry[]` | `DataRepairLogEntry` at training-model.ts:1347 | 500 (`appDataRepairEngine.ts:10` `MAX_DATA_REPAIR_LOG_ENTRIES`) | UI-facing "what got repaired" receipts. |
| `settings.dataHealthRepairLedger: DataHealthRepairLedgerEntry[]` | `DataHealthRepairLedgerEntry` at types.ts:72 | 1000 (`appDataRepairTypes.ts:122` `DATA_HEALTH_LEDGER_MAX_ENTRIES`) | Idempotency authority (the `idempotencyKey` is hashed from `(repairId, sorted affectedIds)`). Read by `isIdempotentMatch` to prevent reapplying within 24h. |
| `settings.dataHealthAutoRepairSummary` | `DataHealthAutoRepairSummary` at types.ts:97 | 1 (latest) | Last orchestrator run summary. Drives the passive status line. |
| `settings.dataHealthRuntimeFlags` | `DataHealthRuntimeFlags` at types.ts:88 | 1 (latest) | Staleness markers (`todayStatusIgnoredAt`, `healthDataStaleSince`, etc.). |

### 6.2 Swift port — repair engine

```swift
public protocol RepairDefinition {
    var repairId: String { get }
    var layer: RepairLayer { get }
    var category: RepairCategory { get }
    var description: String { get }
    var affectedAppDataPaths: [String] { get }
    func detect(_ appData: AppData) -> RepairDetectResult
    func dryRun(_ appData: AppData) -> RepairDryRunResult
    func apply(_ appData: AppData, options: RepairApplyOptions) -> RepairApplyResult?  // nil if audit-only
}

public final class AppDataRepairRegistry {
    public init(_ definitions: [RepairDefinition]) { ... }
    public func list() -> [RepairDefinition]
    public func byLayer(_ layer: RepairLayer) -> [RepairDefinition]
    public func get(_ repairId: String) -> RepairDefinition?
}
```

Nine concrete repair recipes (one Swift file each, one-to-one with `src/dataHealth/repairs/*`):

1. `SessionLifecycleResidueV1` — safe_auto
2. `ImpossibleDurationV1` — safe_auto
3. `StaleTodayStatusV1` — safe_auto (writes runtime flag, not data)
4. `StaleHealthReadinessGuardV1` — safe_auto (writes runtime flag)
5. `ScreeningIssueScoreRuntimeGuardV1` — runtime_guard (view-only)
6. `ScreeningIssueScoreRepairV1` — safe_auto (writes capped score IF preconditions hold)
7. `LegacyFinalAdviceIsolationGuardV1` — runtime_guard (view-only)
8. `SetIndexRenumberV1` — safe_auto
9. `ReplacementEquivalenceAuditV1` — audit_only

Each Swift repair must produce the **identical** `idempotencyKey` as its TS sibling (same hash formula in `repairHelpers.ts:4` `hashIdempotencyKey`). Why: the ledger is a single source of truth and the PWA-iOS swap during sync MUST be able to recognize a repair already applied on the other client. Port `hashIdempotencyKey` exactly — `(repairId, sorted unique affectedIds)` joined by `'|'`, hashed with `(hash << 5) - hash + charCode` and `hash >>> 0` (Swift: `(hash &<< 5) &- hash &+ Int32(c.asciiValue)`).

Similarly, port `computeAppDataHash` (`repairHelpers.ts:71`) byte-identical. This is the hash used in `appDataHashBefore` / `appDataHashAfter` ledger fields, AND in upload eligibility's `ledgerHashMatches`. If iOS and TS disagree on the hash, the cloud will refuse to accept either side's snapshot.

### 6.3 Ledger lives where data lives

Because the ledger is part of `AppData.settings`, it travels with the snapshot. The PWA-iOS handoff (export from PWA → import into iOS) automatically carries the entire repair history. No separate ledger sync step. This is the load-bearing design choice — keep it.

Implication for Swift `AppSettings`:

```swift
public struct AppSettings: Codable {
    public var schemaVersion: Int?
    public var selectedTemplateId: String?
    public var trainingMode: TrainingMode?
    public var unitSettings: UnitSettings?
    public var healthIntegrationSettings: HealthIntegrationSettings?
    public var dismissedCoachActions: [DismissedCoachAction]?
    public var dismissedDataHealthIssues: [DismissedDataHealthIssue]?
    public var pendingSessionPatches: [PendingSessionPatch]?
    public var dataRepairLogs: [DataRepairLogEntry]?
    public var dataHealthRuntimeFlags: DataHealthRuntimeFlags?
    public var dataHealthRepairLedger: [DataHealthRepairLedgerEntry]?
    public var dataHealthAutoRepairSummary: DataHealthAutoRepairSummary?
    // …
    public var unknown: [String: JSONValue] = [:]  // anything else, preserved through write
}
```

The `unknown` bag is critical: when a PWA writes a future settings key that iOS hasn't shipped yet, iOS must preserve it through round-trip rather than drop it. Implement Codable manually: known keys go to typed properties, everything else lands in `unknown`. On encode, merge them back. Same on TS side — `additionalProperties: true` in the schema and `pickRecord(migrated.settings)` spread in `appDataSanitize.ts:1029` already preserve unknown keys.

### 6.4 Receipt format — keep them identical

`DataRepairLogEntry` (training-model.ts:1347, schema 191):

```ts
{
  id: string;
  createdAt: string;
  repairId?: string;
  repairedAt?: string;
  sourceFileName?: string;
  category: string;
  action: string;
  affectedIds: string[];
  beforeSummary?: string;
  afterSummary?: string;
  before?: unknown;
  after?: unknown;
}
```

The `before`/`after` are typed `unknown` because each repair recipe stores its own shape (`appDataRepairTypes.ts:54`). Swift mirrors this with `JSONValue?` for `before`/`after`.

`DataHealthRepairLedgerEntry` (appDataRepairTypes.ts:72):

```ts
{
  ledgerId: string;
  repairId: string;
  idempotencyKey: string;
  appliedAt: string;
  triggeredBy: RepairTrigger;
  status: RepairApplyStatus;
  occurrences: number;
  affectedIds: string[];
  appDataHashBefore?: string;
  appDataHashAfter?: string;
  backupId?: string;
  receiptId?: string;
  warnings: string[];
}
```

`RepairTrigger = 'boot' | 'import' | 'cloud_restore' | 'post_session' | 'manual' | 'audit'` — port verbatim.

`RepairApplyStatus = 'applied' | 'no_op' | 'skipped' | 'failed' | 'backup_failed'` — port verbatim.

---

## 7. AutoRepairOrchestrator on iOS launch

### 7.1 Current TS contract (`src/dataHealth/autoRepairOrchestrator.ts:62`)

`runAutoRepairOrchestrator({appData, triggeredBy, registry?, backupAdapter?, now?})` does:

1. Compute `appDataHashBefore`.
2. Detect all safe-auto repairs with `apply`. Skip the ones that don't detect.
3. If nothing to apply: write summary, return `changed: false`.
4. Snapshot `backupAdapter.snapshot(...)` — try IndexedDB → localStorage → in-memory. If all fail: write `backup_failed` ledger entries, return `changed: false`, runtime guard stays on.
5. For each repair in detection order: check ledger idempotency (24h window). If duplicate, skip. Otherwise call `runRepair` → append receipt + ledger entry. After apply, re-`detect` and downgrade to `failed` if still detected.
6. Write `dataHealthAutoRepairSummary`.

### 7.2 Swift port

```swift
@MainActor
final class AppLaunchSequence {
    func didFinishLaunching() async {
        let loaded = try AppDataStore.shared.load()   // includes file-based migrate + sanitize
        let cleanView = buildCleanAppDataView(loaded)  // pure
        AppState.shared.adopt(loaded, cleanView: cleanView)  // engines now see clean view

        // background, non-blocking
        Task.detached(priority: .utility) {
            let result = await AutoRepairOrchestrator.shared.run(
                appData: loaded,
                triggeredBy: .boot,
                registry: AppDataRepairRegistry.shared,
                backupAdapter: FileBackupAdapter.shared,
                now: Date.init)
            if result.changed {
                await MainActor.run {
                    AppState.shared.adopt(result.appData,
                                          cleanView: buildCleanAppDataView(result.appData))
                    try? AppDataStore.shared.save(result.appData)
                }
            }
        }
    }
}
```

Notes:

- Mirror the V2 ingress contract — `runAutoRepairOrchestrator` is the only path into safe-auto. Direct calls to individual `apply` are forbidden in production code (mirrors the `tests/dataHealthCloudRestoreLinkageStaticGuards.test.ts` static-guard policy).
- `FileBackupAdapter` writes to `<AppGroup>/ironpath/backups/autoRepair_<isoTs>_<hash8>.json`, retains last 5 (mirror `autoRepairBackupAdapter.ts:7` `MAX_BACKUPS = 5`). Failure modes: write failure → return `backup_failed`, do not mutate.
- Run order is at boot only for now. Future triggers (`post_session_complete`, `import_restore`, `backup_restore`, `cloud_restore`, `account_switch`) feed through `processIncomingAppData` and are Agent 4 / Agent 5's wiring.
- No popups, no user prompt. Failure goes to a single passive status line — Agent 5 wires the UI but the message strings are owned here (see `dataHealthCloudRestoreLinkagePipeline.test.ts` line "passive status row is a single line of Chinese text"). Match the four tones exactly: `ok` ("数据已自动检查"), `auto-repaired` ("已自动修复 X 个旧版本问题"), `audit-pending` ("X 个已隔离，不影响训练建议"), `backup-failed` / `busy` ("数据正在自动整理，稍后同步").

### 7.3 Concurrency safety

The TS pipeline uses `operationId` namespaced by `(source, accountId, hash8, timestamp, rand)` so callers can race-gate. Swift port should produce the same string. Use `await MainActor.run` to publish the new AppData reference, but the orchestrator itself runs on a background task. The branded view (`CleanAppDataView`) is value-semantic — pass by `let` reference, mutate by replace, never in-place edit. This avoids any actor reentrancy issues.

---

## 8. Import/export compatibility rules (PWA backup → iOS)

### 8.1 The current contract (`src/storage/backup.ts`)

```ts
export const getBackupFileName = (date) => `ironpath-backup-${date.toISOString().slice(0, 10)}.json`;
export const exportAppData = (data: AppData) => JSON.stringify(sanitizeData(data), null, 2);
export const importAppData = (jsonText: string): ImportAppDataResult => {
  const parsed = JSON.parse(jsonText) as unknown;
  const importReport = analyzeImportedAppData(parsed);
  if (importReport.status === 'unsafe') return { ok: false, error: ... };
  const sanitized = sanitizeData(parsed);
  if (!validateAppDataSchema(sanitized)) return { ok: false, error: ... };
  return { ok: true, data: sanitized };
};
```

Three gates: `looksLikeAppData` quick sniff (`src/engines/dataRepairEngine.ts:140`) → `sanitizeData` (`appDataSanitize.ts`) → Ajv schema validate (`appDataValidation.ts:8`).

`analyzeImportedAppData` (`dataRepairEngine.ts:256`) accepts the parsed JSON if at least one of: history is an array, templates is an array, programTemplate/todayStatus is an object, OR `schemaVersion` is a finite number. This is intentionally lenient — old exports from PWA must still load. Match this leniency in iOS.

### 8.2 iOS rules

- Same file name pattern: `ironpath-backup-2026-05-27.json`.
- Same encoder: pretty-printed JSON, 2-space indent (`JSONEncoder` with `outputFormatting = [.prettyPrinted, .sortedKeys]`; `.sortedKeys` is iOS's choice — does NOT affect the hash because the hash uses `stableStringify` from `accountBoundaryLocalInventory.ts:101` which also sorts keys).
- Same import flow: parse → `analyzeImportedAppData`-equivalent sniff → `sanitize` → Ajv-validate → route through `processIncomingAppData({source: .importRestore, appData, allowMutation: true, allowAutoRepair: true})` to repair receipts come along.

### 8.3 PWA backup → iOS

A backup created in the PWA (call `exportAppData`, download via Web Share API) is a JSON file. iOS reads it through `UIDocumentPickerViewController`. The file already contains:

- `schemaVersion: 8`
- `settings.dataRepairLogs`, `settings.dataHealthRepairLedger`, `settings.dataHealthAutoRepairSummary`, `settings.dataHealthRuntimeFlags` (if any repairs ran).
- All known top-level slots in §3.1.

iOS-side:

1. Decode to `AppData`.
2. Run iOS `migrateTrainingData` (port of `appDataMigration.ts:166`) — for the v8 case this is a no-op.
3. Run iOS `sanitizeData` (port of `appDataSanitize.ts:sanitizeData`).
4. Validate against the Ajv schema — bundle `training-data.schema.json` as an asset and validate with `jsonschema` Swift package OR a hand-written validator (the schema is small enough). Spawn task at the end of this audit if this hasn't been picked up.
5. Route through `processIncomingAppData({source: .backupRestore, ...})` so auto-repair runs against the import.

### 8.4 iOS backup → PWA

The reverse must also work. iOS writes the same JSON. The PWA reads it via `importAppData`. The Ajv schema is identical (single source of truth: `src/models/training-data.schema.json`). Add a regression test: "round-trip an iOS-export through PWA-import and back to iOS, hashes match".

### 8.5 What MUST NOT change in the export shape

- Field names. TS uses camelCase. Swift `JSONEncoder` defaults to camelCase if struct fields are camelCase — keep them camelCase.
- Optional vs absent. `JSON.stringify` drops `undefined`. Swift `JSONEncoder` drops `nil` by default. Don't add `encodeNil` for optional fields — they must round-trip as absent.
- Order of array elements. `history` is chronological, preserve it. `templates`, `bodyWeights`, etc. carry implicit order that consumers rely on.
- ISO-8601 timestamp format. TS uses `new Date().toISOString()` which is `2026-05-27T10:15:30.000Z`. Swift's default `.iso8601` is `2026-05-27T10:15:30Z` — different! Either use a custom `dateEncodingStrategy` that includes milliseconds, OR keep dates as strings end-to-end. Recommend the latter to match the TS code that already stores dates as strings everywhere. **This is a real bug if missed**; flagged in §10.

---

## 9. No-data-loss rules

### 9.1 Atomic write + backup file

Every save:

```swift
func save(_ appData: AppData) throws {
    let new = try encoder.encode(appData)
    // Step 1: copy live -> previous (best-effort)
    if FileManager.default.fileExists(atPath: liveURL.path) {
        try? FileManager.default.removeItem(at: previousURL)
        try? FileManager.default.copyItem(at: liveURL, to: previousURL)
    }
    // Step 2: atomic write to a tmp file in the same dir, then replace
    try new.write(to: liveURL, options: [.atomic, .completeFileProtectionUnlessOpen])
}
```

`Data.write(to:options: .atomic)` is implemented as "write to a tmp file in the same directory, then rename over the target". The rename is atomic on APFS. On crash mid-write, the previous file is intact. The "step 1" copy is the rollback path *if* the post-write read fails — covered in §9.3.

### 9.2 Backup file on every repair

`AutoRepairOrchestrator` always calls `backupAdapter.snapshot(...)` before mutating (TS: `autoRepairOrchestrator.ts:117`). On iOS, this writes `<AppGroup>/ironpath/backups/autoRepair_<isoTs>_<hash8>.json` containing the full pre-repair AppData. The orchestrator never mutates if the backup write fails — that's the load-bearing rule.

### 9.3 Read-after-write verification

After every `save`, iOS should:

1. Re-read the file.
2. Decode.
3. Compare hash via `computeAppDataHash` (`repairHelpers.ts:71`).

If the hashes diverge, log a `LastParityFailurePayload`-shaped diagnostic (`src/storage/localStorageAdapter.ts:380`) and fall back to the `previous.json` rollback file.

### 9.4 Schema down-migration guard

If iOS reads a file with `schemaVersion > STORAGE_VERSION_KNOWN_TO_THIS_BINARY`:

- DO NOT auto-downgrade the schemaVersion field.
- DO NOT drop unknown fields (the `unknown: [String: JSONValue]` bag preserves them).
- Show a passive notice ("此设备暂时未支持更新的备份格式，已切换为只读模式" or similar — Agent 5 owns final copy).
- Allow read-only access to the file (no save). Allow export-back-to-PWA (the user can take this file to a newer client).

This mirrors the TS behavior of `coerceSchemaVersion` (`appDataStorageUtils.ts:182`): it accepts any finite non-negative integer and lets the migration ladder decide what to do. The TS code path is "if version >= STORAGE_VERSION, no migration runs" — i.e. silently accept newer files. Swift should be stricter: ACCEPT but go READ-ONLY for `schemaVersion > knownVersion`.

### 9.5 Deletion-banned list (from `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` §10)

The TS repair system explicitly forbids deleting these. Swift port must enforce the same:

- Completed sessions (no removing from `history[]` even if "dirty").
- Sets (`exercise.sets[]` never shortened by a repair).
- Body weights.
- Recommendation snapshots.
- Program adjustment history.
- Pain history.
- PR / e1RM history (derived, but the underlying session data must stay).
- `localStorage` clearing — the iOS equivalent is "never delete the live snapshot file".

These are non-negotiable. Encode as a static guard test that scans Swift source for `history.removeAll`, `history.remove(at:)`, `FileManager.removeItem(at: liveURL)`, etc. — mirror the existing TS `tests/realDataHealthRepairStaticGuards.test.ts` pattern.

### 9.6 Save commit ordering — the file-store equivalent

The TS adapter writes 13 split keys then writes `version` last as a commit marker (`localStorageAdapter.ts:82–127`). The iOS file equivalent is built into `Data.write(.atomic)` — there's no analogue needed because the single file IS the atomic unit. But this principle must hold if iOS ever shards (per §4.3): write all data shards first, then write `version` shard last. Use a `manifest.json` file as the commit marker; its presence + matching hash means the snapshot is consistent.

---

## 10. Schema-risk map

Subtle under-specification in the current TS schema that would bite the Swift port:

### 10.1 `STORAGE_VERSION = 8` but migration ladder ends at V6 (last step stamps to 8)

`src/storage/appDataMigration.ts:166–195`. The terminal `migrateToV6` writes `schemaVersion: STORAGE_VERSION` (= 8). There is no V7 or V8 migration step. This is fine as long as:

- The shape changes between V5 and V8 are exactly what `migrateToV6` does (add `restTimerState`, `supportExerciseLogs`, `mesocyclePlan`, `programAdjustmentDrafts`/`History`).
- Any subsequent shape change post-V6 is shape-only and added to `migrateToV6`.

Risk: a Swift developer reading this might believe schemaVersion 7 has a defined intermediate shape. It doesn't. Document this explicitly in the Swift `Migration` type comments.

### 10.2 `additionalProperties: true` everywhere

`training-data.schema.json` has `additionalProperties: true` in 40 places. The Ajv validator never rejects unknown fields. This is deliberate (`settings` is an open bag). The risk for Swift is the reverse: a strict Swift Codable struct will silently drop unknown fields on encode. iOS MUST implement Codable with an "unknown" carrier (`[String: JSONValue]`) at every level that has `additionalProperties: true` in the schema, or design future schema changes around this constraint.

### 10.3 ISO timestamp drift (TS includes ms, Swift's default doesn't)

`new Date().toISOString()` → `"2026-05-27T10:15:30.000Z"` (includes ms, always `.000` if zero).
`ISO8601DateFormatter().string(from:)` → `"2026-05-27T10:15:30Z"` (no ms).

If Swift encodes `Date` values via the default `.iso8601` strategy, the resulting JSON differs from the TS encoder, AND `buildAppDataSnapshotHash` will produce a different hash for the same logical AppData. This breaks PWA-iOS round-trip parity. Fix: keep timestamps as `String` in the Swift `AppData`, never `Date`. Same convention as the TS code (`completedAt`, `startedAt`, `finishedAt`, `date`, `createdAt`, `repairedAt`, `appliedAt`, `dismissedAt`, etc. are all `string` in `training-model.ts`).

### 10.4 `actualExerciseId` / `replacementExerciseId` chain identity

`normalizeExerciseIdentity` (`appDataStorageUtils.ts:82`) computes a multi-field identity tuple: `(id, baseId, canonicalExerciseId, originalExerciseId, actualExerciseId, replacementExerciseId)` plus legacy IDs and `identityInvalid` flag. The rules are subtle:

- If any of (rawId, rawActualId, rawReplacementId) is a synthetic `__auto_alt_*` / `__alt_*`, `identityInvalid = true`.
- Once `identityInvalid`, `actualExerciseId` and `replacementExerciseId` become `undefined`.
- `canonicalExerciseId` falls back only to known IDs; never to synthetic.

The `replacementEquivalenceAuditV1` audit (deferred from auto-rewrite in `docs/DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md` §3.2) depends on this multi-field identity. Port this exact logic to Swift. Do NOT simplify.

### 10.5 `restTimerState` shape

V6 migration sets `restTimerState: null` on history records but `restTimerState: pickRecord(activeSession).restTimerState ?? null` on active session. So `null` is the canonical "no timer" state, but the active session may carry a real object. Validate at decode: `RestTimerState?` in Swift, where `nil` means "no timer".

`sessionLifecycleResidueV1.ts:46` then checks `next.restTimerState?.isRunning` and clears it to `false` if `true` on a completed session. Swift port must match.

### 10.6 `settings.schemaVersion` vs root `schemaVersion`

`appDataMigration.ts:168` reads `coerceSchemaVersion(migrated.schemaVersion ?? pickRecord(migrated.settings).schemaVersion)`. The schema allows both, but the root one wins. The sanitizer (`appDataSanitize.ts:1005, 1030`) writes both to the same value. Swift port must do the same — write both, read root first.

### 10.7 `programTemplate` is a separate schema file (`$ref: training-program.schema.json`)

iOS needs to bundle both schema files and the validator must resolve the `$ref` correctly. Some Swift JSON-schema libraries don't handle external `$ref` — pick one that does or inline `training-program.schema.json` into `training-data.schema.json` for iOS validation.

### 10.8 `bodyWeights[i].value` is typed `number, minimum: 0` (no unit field)

Implicit assumption: kg. There is no `unit` field on `bodyWeights`. Display unit comes from `AppData.unitSettings`. iOS must not "fix" this by adding an inline unit field — that would diverge from TS and break round-trip.

### 10.9 `mesocyclePlan` length is `4 | 5 | 6`

TypeScript enforces this literally; the JSON schema is more permissive (`integer >= 1`). The Swift port should match TS strictness (enum / restricted set) but accept any integer on decode and normalize to a known value at sanitize time. Do not trust upstream input.

### 10.10 `screeningProfile.adaptiveState.issueScores` is `Record<string, number>` (open key space)

There is no enumerated list of "valid" issue score keys in the schema. The real-data fixture has keys like `scapular_control`, `upper_crossed`, `breathing_ribcage`, `thoracic_rotation`. The `screeningIssueScoreRepairV1` repair caps values without dropping keys it doesn't recognize. Swift Codable: `[String: Double]`. Never restrict the key space.

### 10.11 Sanitizer uses `Date.now()` for legacy IDs

`appDataMigration.ts:39`: `pickString(raw.id) || pickString(raw.baseId) || \`exercise-${Date.now()}\`` and `appDataSanitize.ts:639`: `pickString(raw.id, \`session-${Date.now()}\`)`. These are "give a deterministic-ish ID to legacy records missing one". The result is that the sanitize pass is NOT deterministic — running it twice on the same input produces two different IDs.

This is the exact bug the `appDataSnapshotHashCanonical.test.ts` test was written to prevent (`accountBoundaryLocalInventory.ts:136`). The hash MUST be computed before sanitize, or on the already-sanitized snapshot AFTER it has been persisted. The Swift port must keep the same rule:

- Compute hash on the in-memory snapshot at the moment of cloud upload.
- Do NOT re-sanitize-then-hash on the read side — the sanitizer's `Date.now()` fallbacks will mint new IDs and break parity.

### 10.12 `unitSettings` and `displayUnit` per-set

Sets carry `displayUnit: 'kg' | 'lb'`. `unitSettings` at AppData level is the user preference. Display is per-set so that historical records keep the unit they were recorded in. Swift port: `enum WeightUnit: String, Codable { case kg, lb }`. NEVER convert historical sets to a canonical unit on read — convert only at display time.

### 10.13 `pendingSessionPatches.status` enum

`'pending' | 'consumed' | 'dismissed' | 'expired'`. Migration may receive any string; `pickEnum` falls back to a default. Swift port: `enum Status: String, Codable { ... }` with a `static let fallback: Status = .pending` and a custom `init(from:)` that maps unknown values to `fallback`. Critical for forward-compat.

---

## 11. Non-goals

This report does NOT decide:

- The cloud sync transport, RLS policy, OAuth flow, account model, upload pipeline → Agent 4.
- SwiftUI screen architecture, navigation, focus mode runtime → Agent 5.
- Health-app integration mechanics (Apple HealthKit query layer) → outside Agent 3 + Agent 4 split; Agent 4 will likely take this.
- Performance budget for the engine layer (TrainingDecision, etc.). Engine port is its own scope.
- Watch-app data slot (Watch / Widget extensions changes the file location to `App Group`).
- Multi-user / multi-profile (the schema today has one userProfile; multi-user is a deferred concern).
- Database-backed analytics / aggregation queries (would only matter after the §4.3 escalation criteria are met).
- Replacement of the JSON schema with Swift `Codable`-only contract: keep BOTH. The JSON schema stays the source of truth for cross-language validation.

---

## 12. Open questions

1. **Schema bump for `completionQuality`** (deferred in `DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md` §3.1). Should iOS port include a V9 step that introduces a first-class `completionQuality` field, OR keep deriving it on the CleanAppDataView side? Lean toward the latter to avoid schema-bump coordination with the PWA, but flag for owner decision.

2. **Replacement chain remap table** (deferred in `DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md` §3.2). The audit-only `replacementEquivalenceAuditV1` exists but cannot auto-rewrite. Who owns the curated mapping table? Likely a Swift `.json` resource bundled with the app, shared with the PWA via a content-only repo or `cdn.ironpath.app` endpoint (cloud-side, Agent 4). Not blocking for iOS V1.

3. **Apple Health import volume**. The fixture has tens of thousands of `healthMetricSamples`. iOS will receive new ones directly via HealthKit. If the volume on a real device exceeds the §4.3 threshold (5 MB snapshot or >250ms decode), `healthMetricSamples` and `importedWorkoutSamples` should split into a separate file shard *before* AppData proper does. Confirm with profiling on the user's actual device.

4. **App Group container vs single-app Documents**. If Agent 5 plans a Watch app or Widget extension, the file location must be App Group (`group.com.ironpath.shared`). If iOS is a standalone app only, `Documents` is simpler. Defer to Agent 5; the path string is the only thing that changes in `AppDataStore`.

5. **Migration ladder direction**. The PWA today migrates only on read. If iOS introduces a V9 (e.g. for `completionQuality`), V9 must also be implemented on the TS side or iOS-written snapshots will fail PWA Ajv validation. Coordinate.

6. **Cloud restore ingress source** (defined in `appDataIngressPipeline.ts:84`). The `cloud-restore` source has `uploadEligibilityMode: 'enforce'`. When iOS pulls a cloud snapshot (Agent 4's territory), it must use the *same* source enum so the same gate fires. Agent 4 should confirm the source-enum vocabulary stays exactly `'cloud-restore'` / `'cloud-pull'` / etc.

7. **The 9 repair recipes — port order**. Suggest implementing in this order so each builds on the previous: `setIndexRenumberV1` → `sessionLifecycleResidueV1` → `impossibleDurationV1` → `staleTodayStatusV1` → `staleHealthReadinessGuardV1` → `screeningIssueScoreRuntimeGuardV1` → `legacyFinalAdviceIsolationGuardV1` → `screeningIssueScoreRepairV1` → `replacementEquivalenceAuditV1` (audit only, smallest scope). Cross-check with `tests/realDataHealthRepairUnits.test.ts` ordering.

8. **Hash function `Math.imul`** in `accountBoundaryLocalInventory.ts:127`. `Math.imul` is 32-bit signed multiplication with overflow. Swift's `Int32` arithmetic with overflow operators (`&*`, `&+`, `&^`) gives the same result. Port: `let next = (Int32(truncatingIfNeeded: hash) ^ Int32(c)).multipliedReportingOverflow(by: 16777619).partialValue` style. Verify byte-identical output across both runtimes with a XCTest fixture.

9. **Ledger pruning at cap 1000**. When the ledger hits 1000 entries (`appDataRepairLedger.ts:21` `slice(-1000)`), oldest entries are dropped. iOS port must keep the same cap and same eviction order. Lost ledger entries cannot break idempotency because the `idempotencyKey` is recomputable from `(repairId, sorted affectedIds)`, but they do degrade the user-facing audit trail. Confirm cap.

10. **`additionalProperties: true` at the root level**. Line 121 of `training-data.schema.json`. This means a PWA can write an entirely new top-level key (e.g. `appData.experimental: {...}`) and iOS must preserve it. Swift `AppData` needs an `unknown: [String: JSONValue] = [:]` at top level too — not just in `settings`. Confirm pattern is consistently applied.

---

## Appendix A — Quick reference: identifiers Swift must match exactly

| Identifier | Source | Why exact match matters |
|---|---|---|
| `STORAGE_VERSION = 8` | `src/data/appConfig.ts:4` | Root + settings version field, both written on save. |
| `idempotencyKey` formula | `src/dataHealth/repairs/repairHelpers.ts:4` | Ledger uniqueness across platforms. |
| `computeAppDataHash` | `src/dataHealth/repairs/repairHelpers.ts:71` | Ledger entries (`appDataHashBefore`/`appDataHashAfter`), cloud parity. |
| `buildAppDataSnapshotHash` | `src/cloudProduction/accountBoundaryLocalInventory.ts:156` | Cloud upload parity. Must be byte-identical with TS. |
| `MAX_BACKUPS = 5` | `src/dataHealth/autoRepairBackupAdapter.ts:7` | Backup retention. |
| `MAX_DATA_REPAIR_LOG_ENTRIES = 500` | `src/dataHealth/appDataRepairEngine.ts:10` | Receipt cap. |
| `DATA_HEALTH_LEDGER_MAX_ENTRIES = 1000` | `src/dataHealth/appDataRepairTypes.ts:122` | Ledger cap. |
| `DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS = 24` | same | Idempotency window. |
| `DATA_HEALTH_TODAY_STATUS_STALE_DAYS = 3` | same | Stale threshold for todayStatus. |
| `DATA_HEALTH_HEALTH_DATA_STALE_DAYS = 14` | same | Stale threshold for Apple Health. |
| `DATA_HEALTH_ISSUE_SCORE_HARD_CAP = 50` | same | Issue score cap. |
| `DATA_HEALTH_ISSUE_SCORE_SOFT_CAP = 12` | same | Soft cap when movementFlags all good. |
| `DATA_HEALTH_IMPOSSIBLE_DURATION_MIN = 240` | same | Sane upper bound for session duration. |
| `DATA_HEALTH_FALLBACK_DURATION_MIN = 60` | same | Fallback when no span derivable. |
| Brand symbol `'ironpath.trainingDecision.cleanInput.v1'` | `src/engines/trainingDecisionCleanInput.ts:58` | The clean-input contract. Swift uses compile-time enforcement; the documented brand is the cross-language coordination point. |

## Appendix B — Quick reference: passive status strings

Mirror these exact Chinese strings on iOS (verified across `appDataIngressPipeline.ts:111-124` and `uploadEligibilityGuard.ts:69-100`):

- "数据已自动检查" — clean.
- "已自动修复 X 个旧版本问题" — auto-repaired (X is the applied count).
- "X 个待自动修复" — pending repairs.
- "X 个已隔离，不影响训练建议" — audit-only pending.
- "数据正在自动整理，稍后同步" — backup-failed / busy.
- "数据已整理完成，可同步" — eligible for sync.
- "同步暂缓，等待数据整理完成" — audit blocked.
- "同步暂缓：发现需要先整理的数据" — partially repaired.
- "同步暂缓：缺少修复回执" — missing receipt.
- "同步暂缓：数据无法识别" — invalid AppData.

Final UI copy is Agent 5's call but the message taxonomy lives here.
