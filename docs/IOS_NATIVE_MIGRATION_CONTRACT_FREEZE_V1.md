# iOS Native Migration — Contract Freeze V1

> Status: docs / planning only. Cross-link from
> `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` §7 and
> `docs/IOS_NATIVE_MIGRATION_TASKS_V1.md` front-matter.
> No source file is modified by this document; it freezes the *contracts*
> the iOS native rewrite must preserve.
> Version: V1 (Entry Gate companion). Last updated: 2026-05-27.

This document is the **frozen contract set** the iOS native rewrite must
preserve. Each contract has:

- A one-paragraph frozen statement.
- TS source-of-truth file:line references (anchored in the live repo, not
  in agent reports).
- The Swift mirror requirements — what types / protocols / static guards
  must exist on the iOS side.
- A parity-test pair (TS test → Swift parity test).
- A `MUST NOT` list — what an iOS port is forbidden to do for this
  contract.
- The version (V1).

If any iOS-N task changes any of these contracts in any direction other
than "preserve verbatim", that task is blocked until this freeze doc is
revised by a new `*_V2.md` revision.

## How this doc connects to the other 2 deliverables

| Sibling doc | Reference |
|---|---|
| `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` | §7 names the 11 contracts and the overall freeze; this doc is its detail. |
| `docs/IOS_NATIVE_MIGRATION_TASKS_V1.md` | iOS-2 (Swift Models), iOS-3 (Data Health), iOS-4 (TrainingDecision), iOS-7 (Cloud Sync), iOS-8 (HealthKit) all cite contracts named here. |

## The 11 frozen contracts

1. AppData compatibility contract
2. TrainingDecision contract
3. Clean input contract
4. Data Health repair contract
5. Cloud sync snapshot contract
6. Upload eligibility contract
7. Subsequent upload / concurrency contract
8. Unit kg / lb contract
9. Session lifecycle contract
10. Health data freshness contract
11. Real-data fixture contract

---

## 1. AppData compatibility contract

### Frozen statement

`AppData` is a top-level document whose canonical shape is fixed at
`schemaVersion = 8`. The settings sub-tree is an **open key-bag**
(`additionalProperties: true`); unknown fields at every level where the
JSON schema permits them must be preserved through every read / write /
sanitize / migrate / repair cycle. The Swift port must round-trip a PWA
backup byte-stable (modulo JSON key ordering) and must never drop a
field it does not recognise.

### TS sources of truth

| Item | Path:line |
|---|---|
| `STORAGE_VERSION = 8` | `src/data/appConfig.ts:4` |
| `interface AppData` | `src/models/training-model.ts:1362` |
| `interface AppSettings` | `src/models/training-model.ts:1322` |
| `migrateTrainingData` (ladder ends at `migrateToV6`, stamps to 8) | `src/storage/appDataMigration.ts:166` |
| `sanitizeData` (NOT deterministic — uses `Date.now()` for legacy IDs) | `src/storage/appDataSanitize.ts:639` |
| `coerceSchemaVersion` (accepts any finite int) | `src/storage/appDataStorageUtils.ts:182` |
| `training-data.schema.json` (`additionalProperties: true` in 40 places, root included) | `src/models/training-data.schema.json:121` |

### Swift mirror requirements

- `struct AppData: Codable` mirroring `training-model.ts:1362` field-by-field.
- `struct AppSettings: Codable` with typed properties for known keys AND
  an `unknown: [String: JSONValue] = [:]` carrier; custom `init(from:)`
  and `encode(to:)` that merge known + unknown on encode.
- A `JSONValue` enum (`object / array / string / number / bool / null`)
  that survives encode / decode without loss.
- ISO timestamps stored as `String` everywhere in `AppData` — **never**
  `Date`. (TS uses `new Date().toISOString()` = `"…30.000Z"`; Swift's
  default `.iso8601` strategy emits `"…30Z"` without milliseconds and
  breaks parity hashes.)
- `enum WeightUnit: String, Codable { case kg, lb }` — never coerce a
  per-set `displayUnit` to a canonical unit on read.
- Forward-compat: if `schemaVersion > knownVersion`, accept the file
  **read-only** (per Data Agent §9.4). Never auto-downgrade
  `schemaVersion`; never drop unknown fields.

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/appDataRoundTripRegression.test.ts` | `AppDataCodableRoundTripTests.swift` (iOS-2) |
| `tests/appDataSanitizeParity.test.ts` | `AppDataSanitizeParityTests.swift` (iOS-3) |
| `tests/appDataSnapshotHashCanonical.test.ts` | `AppDataSnapshotHashParityTests.swift` (iOS-3 / iOS-7) |
| `tests/realDataHealthRepairFixture.test.ts` (open-bag preservation) | `AppDataOpenBagPreservationTests.swift` (iOS-2) |

### MUST NOT

- MUST NOT introduce SwiftData / Core Data / SQLite for `AppData` in V1.
- MUST NOT close the `AppSettings` shape (no closed struct without an
  unknown-bag carrier).
- MUST NOT store any timestamp as Swift `Date` inside `AppData`.
- MUST NOT auto-downgrade `schemaVersion`.
- MUST NOT sanitize-then-hash on the read side. The sanitiser is
  non-deterministic (mints `session-${Date.now()}` IDs for legacy
  records); hashing the result produces non-stable output.
- MUST NOT add a unit field to `bodyWeights[]` — implicit kg per §10.8
  of the Data Agent report.
- MUST NOT mutate AppData inside `buildCleanAppDataView` — the view is
  read-only.

### Version

V1.

---

## 2. TrainingDecision contract

### Frozen statement

`buildTrainingDecision(input) → TrainingDecision` is the **sole final-decision
owner** for every per-surface user-facing payload in IronPath. The 9
legacy final-decision engines deleted in PR #384 (Training Recommendation
Hard Rewrite V2) MUST NOT be re-introduced in any form on the Swift side.
The output is structurally `userFacing.{today, plan, training, focus,
progress, record, explanation}` and the dev-only
`hiddenDebugSignals.arbitrationTrace` array. The arbitration rules
AR-1..AR-9 fire in a fixed precedence order (severe override > reentry
override > role-floor > min-not-product > weekly cap > AR-5 triplet
suppression). The reentry / restart / deload semantics are governed by a
gap state machine and a per-role floor (`main-compound 2, secondary 2,
accessory 1, isolation 1` in reentry).

### TS sources of truth

| Item | Path:line |
|---|---|
| `buildTrainingDecision` entry | `src/engines/trainingDecisionEngine.ts:1872` |
| `ROLE_FLOORS_REENTRY` constant | `src/engines/trainingDecisionEngine.ts:89` |
| `AR-1-severe-override` trace push | `src/engines/trainingDecisionEngine.ts:1915` |
| `AR-2-reentry-override` trace push | `src/engines/trainingDecisionEngine.ts:1927` |
| `AR-3-productive-floor` trace push | `src/engines/trainingDecisionEngine.ts:1939` |
| `decisionVersion: 'v2'` lock | `src/engines/trainingDecisionTypes.ts:429` |
| `TrainingDecision` type (`activePhase / sessionIntent / riskLevel / volumeMode / intensityMode / progressionMode / userFacing / hiddenDebugSignals`) | `src/engines/trainingDecisionTypes.ts:413` |
| Effective-phase gap state machine (`reentry` / `restart` thresholds) | `src/engines/effectiveTrainingPhaseEngine.ts:140` |
| SoT lock | `docs/TRAINING_RECOMMENDATION_HARD_REWRITE_V2.md` |

### Swift mirror requirements

- A pure Swift function (or a `struct DecisionEngine`) whose only entry
  point is `func buildTrainingDecision(_ input: CleanTrainingDecisionInput,
                                       surfaces: …) -> TrainingDecision`.
- Output struct mirrors `TrainingDecision` field-by-field; `decisionVersion`
  is a Swift constant equal to `"v2"`.
- `userFacing.*` payloads are typed Swift structs with closed enums per
  reason code. **Copy strings** (Chinese labels) are produced from a
  `Strings.swift` table — re-derived, not literal-translated from the TS
  inlined helpers.
- `hiddenDebugSignals.arbitrationTrace: [String]` is part of the public
  output struct so parity tests can assert it.
- Per-role floors are Swift constants matching `ROLE_FLOORS_REENTRY` /
  `ROLE_FLOORS_NORMAL` exactly.
- Gap-state-machine thresholds (`0–3 / 4–7 / 8–13 / 14–27 / 28+ days`)
  are Swift constants — never inlined magic numbers.
- Input is the branded `CleanTrainingDecisionInput` (Contract #3). Raw
  `AppData` cannot reach this function; enforced at compile time.
- No Swift file under `ios/IronPath/Decision/` may import any of the 9
  hard-deleted legacy engine names (`weeklyProgressionRecommendationEngine`,
  `progressClaritySummary`, `postWorkoutNextTimeRecommendationEngine`,
  `todayDecisionSurface`, `recommendationTraceEngine`,
  `recommendationExplanationPresenter`, `coachAutomationEngine`,
  `deloadSignalEngine`, `recommendationReasonSelector`) — enforced by
  static guard.

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/trainingDecisionHardRewriteEngineShape.test.ts` | `TrainingDecisionEngineParityTests.swift` (iOS-4) |
| `tests/trainingDecisionHardRewriteUserFacingShape.test.ts` | `TrainingDecisionUserFacingParityTests.swift` (iOS-4) |
| `tests/trainingDecisionHardRewriteReentryProductiveDose.test.ts` | `TrainingDecisionReentryFloorParityTests.swift` (iOS-4) |
| `tests/trainingDecisionHardRewriteForbiddenCopyScan.test.ts` | `TrainingDecisionForbiddenCopyScanTests.swift` (iOS-4 + iOS-10) |
| `tests/trainingDecisionHardRewriteLegacyImportBoundary.test.ts` | `TrainingDecisionLegacyImportBoundaryTests.swift` (iOS-4) |
| `tests/trainingPhaseEffectiveMapping.test.ts` | `EffectivePhaseGapStateMachineParityTests.swift` (iOS-4) |
| `tests/trainingPhaseGapWiringRecommendation.test.ts` | `EffectivePhaseGapWiringRecommendationParityTests.swift` (iOS-4) |

Parity tests MUST assert `hiddenDebugSignals.arbitrationTrace` is byte-equal
between TS and Swift, not just the user-facing output. (Cross-review
revision M4.)

### MUST NOT

- MUST NOT create a second decision path (e.g. a "Plan tab computes its
  own recommendation"). The V1 BLOCKING bug.
- MUST NOT re-derive user-facing copy at the View layer. Views consume
  `decision.userFacing.{surface}` and render.
- MUST NOT reduce the reentry productive-dose floor to "if 14+ days, do
  deload"; the per-role floor + volume-multiplier cap must coexist.
- MUST NOT change RIR / technique / pain scoring constants (see Contract
  #8 and Effective-Set scoring in Product Agent §3.4).
- MUST NOT skip writing `hiddenDebugSignals.arbitrationTrace` — even
  though it is dev-only, parity tests rely on it.
- MUST NOT collapse the four-ID exercise identity model
  (`originalExerciseId / actualExerciseId / displayExerciseId /
  recordExerciseId`) — see Contract #9.

### Version

V1.

---

## 3. Clean input contract

### Frozen statement

`CleanTrainingDecisionInput` is a branded, factory-only type. The
exclusive construction path on the TS side stamps
`Symbol.for('ironpath.trainingDecision.cleanInput.v1')` onto the value
via `Object.defineProperty(value, brand, { enumerable: false })`. The
brand exists because three feature surfaces were caught passing raw,
un-cleaned AppData into TrainingDecision after Real Data Health Repair
V1 was deployed (see
`docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md` §2). On the
Swift side, the brand is replaced by a stricter compile-time-enforced
factory pattern: a `fileprivate init` on `CleanTrainingDecisionInput`
plus a single `make(from:metadata:)` entrypoint on
`TrainingDecisionInputFactory` that requires a `CleanAppDataView`.

### TS sources of truth

| Item | Path:line |
|---|---|
| `CLEAN_TRAINING_DECISION_INPUT_BRAND` symbol | `src/engines/trainingDecisionCleanInput.ts:58` |
| Brand stamping (`stampBrand`) | `src/engines/trainingDecisionCleanInput.ts:182` |
| Brand type guard | `src/engines/trainingDecisionCleanInput.ts:114` |
| `CleanTrainingDecisionInput` type | `src/engines/trainingDecisionCleanInput.ts:71` |
| `buildCleanAppDataView` (the only sanctioned input source) | `src/dataHealth/cleanAppDataView.ts:86` |
| Lock doc | `docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md` |

### Swift mirror requirements

```swift
public struct CleanTrainingDecisionInput {
    // typed fields mirroring src/engines/trainingDecisionCleanInput.ts
    fileprivate init( ... )   // ONLY constructible inside the factory file
}

public enum TrainingDecisionInputFactory {
    public static func make(from cleanView: CleanAppDataView,
                            metadata: CleanTrainingDecisionInputMetadata)
        -> CleanTrainingDecisionInput { ... }
}

public func buildTrainingDecision(_ input: CleanTrainingDecisionInput,
                                  surfaces: ...) -> TrainingDecision { ... }
```

- Compile-time enforcement: no call site outside the factory file can
  construct `CleanTrainingDecisionInput`.
- A static-guard XCTest scans the Swift source for any direct
  `TrainingDecisionInput.init(` outside the factory file and fails the
  build if found (mirrors the TS test
  `tests/trainingDecisionCleanInputContractStaticGuards.test.ts`).
- `CleanAppDataView.build(rawAppData:clock:)` is the only sanctioned
  source of the `cleanView` argument and is itself pure (no I/O).

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/trainingDecisionCleanInputContractFactory.test.ts` | `TrainingDecisionCleanInputContractTests.swift` (iOS-4) |
| `tests/trainingDecisionCleanInputContractStaticGuards.test.ts` | `TrainingDecisionInputFactoryStaticGuardTests.swift` (iOS-4) |
| `tests/trainingDecisionCleanInputContractTypeGuards.test.ts` | `TrainingDecisionInputTypeGuardTests.swift` (iOS-4) |
| `tests/realDataHealthRepairStaticGuards.test.ts` (boundary) | `IronPathDataHealthStaticGuardTests.swift` (iOS-3) |

### MUST NOT

- MUST NOT expose any public initialiser of `CleanTrainingDecisionInput`
  outside the factory file.
- MUST NOT introduce a second factory that accepts raw `AppData`.
- MUST NOT call `buildTrainingDecision` from any layer above
  `IronPathDataHealth` without routing through `CleanAppDataView` first.
- MUST NOT skip the clean-view pass at app launch — the orchestrator and
  the engines see only the cleaned view.

### Version

V1.

---

## 4. Data Health repair contract

### Frozen statement

IronPath's V1 Data Health system has nine repair recipes registered in a
fixed order. The orchestrator runs at app launch (and at every
sanctioned ingress: import / cloud-restore / post-session) via a
backup-first → safe-auto repair → receipt + ledger sequence. Repairs are
idempotent within a 24-hour window keyed by
`(repairId, sorted affectedIds)`. The ledger lives inside
`AppData.settings.dataHealthRepairLedger` (cap 1000) and the receipts
live inside `AppData.settings.dataRepairLogs` (cap 500); both travel
with the snapshot, so PWA↔iOS handoff carries the full repair history
without a separate sync step. No silent rewrite, no popup, no UI prompt
— passive status line only.

### TS sources of truth

| Item | Path:line |
|---|---|
| `runAutoRepairOrchestrator` entry | `src/dataHealth/autoRepairOrchestrator.ts:62` |
| `appDataRepairLedger` (`appendLedgerEntry`, `isIdempotentMatch`) | `src/dataHealth/appDataRepairLedger.ts:21, 84` |
| V1 repair registry (9 repairs) | `src/dataHealth/appDataRepairRegistry.ts` |
| 9 repair recipes | `src/dataHealth/repairs/*.ts` |
| `hashIdempotencyKey` formula | `src/dataHealth/repairs/repairHelpers.ts:4` |
| `computeAppDataHash` (used in `appDataHashBefore` / `appDataHashAfter`) | `src/dataHealth/repairs/repairHelpers.ts:71` |
| `processIncomingAppData` (the single ingress contract) | `src/dataHealth/appDataIngressPipeline.ts` |
| `DATA_HEALTH_LEDGER_MAX_ENTRIES = 1000` | `src/dataHealth/appDataRepairTypes.ts:122` |
| `DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS = 24` | `src/dataHealth/appDataRepairTypes.ts:123` |
| `MAX_BACKUPS = 5` | `src/dataHealth/autoRepairBackupAdapter.ts:7` |
| `MAX_DATA_REPAIR_LOG_ENTRIES = 500` | `src/dataHealth/appDataRepairEngine.ts:10` |
| SoT doc | `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` |
| Ingress doc | `docs/DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md` |

### Swift mirror requirements

- `protocol RepairDefinition` mirroring the TS interface; one Swift file
  per V1 repair: `SessionLifecycleResidueV1`, `ImpossibleDurationV1`,
  `StaleTodayStatusV1`, `StaleHealthReadinessGuardV1`,
  `ScreeningIssueScoreRuntimeGuardV1`, `ScreeningIssueScoreRepairV1`,
  `LegacyFinalAdviceIsolationGuardV1`, `SetIndexRenumberV1`,
  `ReplacementEquivalenceAuditV1`.
- `AppDataRepairRegistry` exposes `list()` / `byLayer(_:)` / `get(_:)`.
- `AutoRepairOrchestrator.run(appData:triggeredBy:registry:backupAdapter:now:)`
  mirrors `runAutoRepairOrchestrator`. Backup-first: on
  `backupAdapter.snapshot(...)` failure, return `backup_failed`, no
  mutation.
- `FileBackupAdapter` writes to
  `<AppGroup>/ironpath/backups/autoRepair_<isoTs>_<hash8>.json`,
  retains 5.
- `hashIdempotencyKey` and `computeAppDataHash` ported byte-identically
  — including the integer-overflow arithmetic (`Int32` overflow
  operators `&*`, `&+`).
- Ledger / receipt / runtime-flags / auto-repair-summary all live under
  `AppData.settings.*` exactly as on TS (open-bag carrier — see
  Contract #1).
- `RepairTrigger ∈ {boot, import, cloud_restore, post_session, manual,
  audit}` — ported verbatim.
- `RepairApplyStatus ∈ {applied, no_op, skipped, failed, backup_failed}`
  — ported verbatim.

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/realDataHealthRepairFixture.test.ts` | `DataRepair<Name>ParityTests.swift` × 9 (iOS-3) |
| `tests/realDataHealthRepairUnits.test.ts` | `RepairLedgerParityTests.swift` (iOS-3) |
| `tests/realDataHealthRepairPipeline.test.ts` | `AutoRepairOrchestratorParityTests.swift` (iOS-3) |
| `tests/realDataHealthRepairStaticGuards.test.ts` | `IronPathDataHealthStaticGuardTests.swift` (iOS-3) |
| `tests/dataHealthCloudRestoreLinkagePipeline.test.ts` | `AppDataIngressPipelineParityTests.swift` (iOS-3) |
| `tests/dataHealthCloudRestoreLinkageStaticGuards.test.ts` | `AppDataIngressBoundaryStaticGuardTests.swift` (iOS-3) |

### MUST NOT

- MUST NOT delete completed sessions, sets, body weights, recommendation
  snapshots, program adjustment history, pain history, PR/e1RM history,
  or the live snapshot file (Data Agent §9.5).
- MUST NOT mutate `AppData` without writing a pre-repair backup first.
- MUST NOT show modals / alerts / popups on repair completion — passive
  status line only.
- MUST NOT reapply a repair whose `idempotencyKey` matches a ledger
  entry within 24h.
- MUST NOT call individual repair `apply` methods from production code
  outside the orchestrator path.
- MUST NOT diverge from the 9-repair set without a new
  `*_PLAN.md` planning PR.

### Version

V1.

---

## 5. Cloud sync snapshot contract

### Frozen statement

The cloud sync wire format is **one Supabase table**
(`public.cloud_appdata_snapshots`) with the columns frozen below, RLS
keyed by `owner_user_id = auth.uid()`, **append-only** (no `update` /
`delete` policy on the client). The contract is explicit-sync-only:
local AppData store remains the source of truth; cloud is a write
target. The snapshot hash is FNV-1a 32-bit over `stableStringify(appData)`
and is the optimistic-concurrency cursor between client and server. The
first-upload, subsequent-upload, and optimistic-concurrency flows are
defined in Contracts #6, #7, and #7 respectively. Account deletion in
the app is required by App Store Guideline 5.1.1(v) when cloud sync
ships in V1 — see iOS-7 and iOS-10 in the Tasks doc. (Cross-review
revision H3.)

### TS sources of truth

| Item | Path:line |
|---|---|
| Migration (table + RLS) | `supabase/migrations/20260524000000_phase19d_appdata_snapshot.sql:5` |
| Wire row type mirror | `src/cloudProduction/supabaseMigrationLocalTypeContracts.ts:14` |
| `buildAppDataSnapshotHash` (FNV-1a) | `src/cloudProduction/accountBoundaryLocalInventory.ts:156` |
| `readLatestSnapshot` / `writeSnapshot` gateway | `src/cloudProduction/productionFullAcceptanceRuntime.ts:247` |
| `firstUploadExplicitApply` (no download / no local mutation) | `src/cloudProduction/firstUploadExplicitApply.ts:105` |
| Wire contract doc | `docs/CLOUD_APPDATA_DATA_MODEL_STRATEGY.md` |
| RLS doc | `docs/SUPABASE_DATA_MODEL_RLS_CONTRACT.md` |

### Wire shape (frozen)

| Column | SQL type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | Client-generated UUID. |
| `account_id` | `uuid` | `= owner_user_id` (DB CHECK + RLS). |
| `owner_user_id` | `uuid` | `= auth.uid()` at insert. |
| `device_id` | `uuid` | Client-generated; stable per install. |
| `local_owner_id` | `text` | Set to `owner.ownerId`. |
| `source_snapshot_hash` | `text` | FNV-1a over `stableStringify(appData)`. |
| `schema_version` | `integer` | Currently `8`. |
| `operation_id` | `text` | Unique per upload (DB unique index). |
| `app_data` | `jsonb` | Full validated AppData document. |
| `validation_status` | `text` enum | Client only writes `'valid'`. |
| `created_at` | `timestamptz` | DB default. |

RLS:
- `select`: `using (owner_user_id = auth.uid())`
- `insert`: `with check (owner_user_id = auth.uid() and account_id = owner_user_id)`
- **No `update` policy. No `delete` policy.** Append-only.

### Swift mirror requirements

- `struct CloudSnapshotMetadata { sourceSnapshotHash, cloudAppDataHash?,
  createdAt? }`.
- `protocol CloudSyncGateway` with two methods only:
  `readLatestSnapshot(accountId:ownerUserId:) async throws ->
  CloudSnapshotMetadata?` and `writeSnapshot(appData:expectedPreviousHash:
  nextSnapshotHash:accountId:ownerUserId:deviceId:operationId:nowIso:)
  async throws -> CloudSnapshotMetadata`. **No `update`, `delete`,
  `upsert`, or batch methods.**
- `buildAppDataSnapshotHash` ported byte-identically:
  - `stableStringify` with sorted keys.
  - FNV-1a 32-bit (`(hash ^ byte) * 16777619` with `Int32` overflow
    arithmetic in Swift).
- ISO timestamps are `String`-typed (see Contract #1). The Swift JSON
  encoder is configured to emit byte-equivalent output to TS
  `JSON.stringify` for the sanitised AppData; verified by a golden test
  vector that gates the cloud sync work (Architecture Agent §13.5).
- The wire layer of `IronPathCloudSync` must talk to the Supabase
  PostgREST + GoTrue surfaces exactly as the TS reference does — the
  iOS-side gateway lives in `Sources/IronPathCloudSync/SupabaseGateway.swift`.
- **In-app account deletion** is required when cloud sync ships in V1
  (Guideline 5.1.1(v)) — see iOS-7 acceptance + iOS-10 readiness
  checklist; server-side execution via Supabase Edge Function or
  `SECURITY DEFINER` Postgres function (Security Agent §10.3).

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/appDataSnapshotHashCanonical.test.ts` | `AppDataSnapshotHashParityTests.swift` (iOS-3 / iOS-7) |
| `tests/firstUploadExplicitApply.test.ts` | `FirstUploadExplicitApplyTests.swift` (iOS-7) |
| `tests/supabaseDataModelRlsContract.test.ts` | `SupabaseDataModelRlsContractTests.swift` (iOS-7) |
| `tests/supabaseMigrationLocalTypeContracts.test.ts` | `SupabaseRowTypeContractTests.swift` (iOS-7) |
| `tests/cloudReadMirror*.test.ts` | `CloudReadMirrorParityTests.swift` (iOS-7) |

### MUST NOT

- MUST NOT call `update`, `delete`, `upsert`, or batch on the table —
  there are no policies for them.
- MUST NOT write to any other table from iOS V1 (`cloud_sync_operations`,
  `cloud_devices`, `cloud_conflicts`, `cloud_export_delete_requests` are
  modelled but unwired).
- MUST NOT log AppData payloads or full `userId` UUIDs to any sink — at
  most the first 8 hex chars of a non-secret content hash (Security
  Agent §5.2).
- MUST NOT add any third-party SwiftPM dependency for the wire layer
  without explicit user approval (see Entry Gate §10 H2). If
  `supabase-swift` is later approved, swap the gateway implementation
  behind the unchanged `CloudSyncGateway` protocol.
- MUST NOT ship cloud sync in V1 without the in-app account deletion
  flow.

### Version

V1.

---

## 6. Upload eligibility contract

### Frozen statement

Every cloud upload (first or subsequent) MUST consult
`ensureCloudUploadEligible({appData, source, snapshotKind})` first. If
the guard returns `ok: false`, the upload button is disabled and a safe
passive status line is shown. The guard's reason codes
(`pending_safe_repairs / backup_failed / partially_repaired /
missing_repair_receipt / invalid_appdata`) and their UI tones (`busy /
backup-failed / audit-pending`) are part of the contract and are
preserved verbatim on iOS.

### TS sources of truth

| Item | Path:line |
|---|---|
| `ensureCloudUploadEligible` entry | `src/dataHealth/uploadEligibilityGuard.ts:118` |
| Guard reason / tone mapping | `src/dataHealth/uploadEligibilityGuard.ts:69` |
| V3 doc | `docs/CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md` |
| V3 static lock | `tests/cloudUploadEligibilityEnforcementStatic.test.ts` |

### Swift mirror requirements

- `struct CloudUploadEligibilityGuard` with one method:
  `func evaluate(appData:source:snapshotKind:) -> EligibilityResult`.
- `enum EligibilityReason: String { case pendingSafeRepairs,
  backupFailed, partiallyRepaired, missingRepairReceipt, invalidAppData,
  ok }`.
- Every production upload call site imports `CloudUploadEligibilityGuard`
  — enforced by a TS-side static guard
  (`tests/iosCloudSyncStaticGuards.test.ts`) mirroring
  `cloudUploadEligibilityEnforcementStatic.test.ts`.
- The four passive status lines (`数据正在自动整理，请稍候再同步` for
  busy / backup-failed; `同步暂缓，等待数据整理完成` for invalid-data;
  `数据已整理完成，可同步` for ok; per Data Agent Appendix B) are
  authored once in `IronPathL10n` and consumed by all sync surfaces.

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/cloudUploadEligibilityEnforcementBehavior.test.ts` | `CloudUploadEligibilityGuardTests.swift` (iOS-7) |
| `tests/cloudUploadEligibilityEnforcementStatic.test.ts` | `tests/iosCloudSyncStaticGuards.test.ts` (TS-side static guard against iOS source) (iOS-7) |

### MUST NOT

- MUST NOT skip the guard for any upload call site, including retries.
- MUST NOT show modals / alerts when the guard returns `ok: false` —
  banner / inline row only.
- MUST NOT enable the upload button while the guard is non-OK.
- MUST NOT introduce a "force upload" affordance that bypasses the
  guard.

### Version

V1.

---

## 7. Subsequent upload / concurrency contract

### Frozen statement

The subsequent-upload flow (V4) carries `expectedPreviousHash` end-to-end.
V5 adds **mandatory** fresh-read preflight on iOS V1: before any insert,
the client calls `gateway.readLatestSnapshot(...)` and aborts with
`remote_changed` if the returned hash differs from the local
`syncedAppDataHash`. This is stricter than the TS web build's optional
fresh-read. Conflicts surface as an **explicit user choice** (V3 banner
pattern); no silent overwrite, no auto-merge, no automatic retry with a
different hash.

### TS sources of truth

| Item | Path:line |
|---|---|
| `runCloudSubsequentUpload` entry | `src/cloudProduction/cloudSubsequentUploadFlow.ts:269` |
| `expectedPreviousHash` plumbing | `src/cloudProduction/cloudSubsequentUploadFlow.ts:46, 377, 411, 445` |
| V4 doc | `docs/CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md` |
| V5 doc | `docs/CLOUD_OPTIMISTIC_CONCURRENCY_V5.md` |
| Conflict policy | `src/cloudProduction/cloudSyncConflictDetection.ts:31` |
| Conflict UX pattern | `docs/REAL_IPHONE_SYNC_CLOUD_CONFLICT_V3.md` |

### Swift mirror requirements

- `CloudSyncGateway.writeSnapshot(...)` accepts `expectedPreviousHash:
  String?` from day one (see Contract #5 / Cloud Agent Appendix B).
- `CloudSyncService.upload(appData:)` runs the V5 decision order
  step-by-step:
  1. `appData == nil` → `.invalidAppData`.
  2. `syncedAppDataHash == nil` → `.notEnabled` (route to first-upload).
  3. `syncedOwnerUserId != ownerUserId` → `.notEnabled` (account switch
     on this device).
  4. **V5 fresh-read preflight** (mandatory). Throw → `.remoteUnavailable`.
     Returned hash ≠ `syncedAppDataHash` → `.remoteChanged`.
  5. `localHash == syncedAppDataHash` → `.unchanged`.
  6. V4 legacy pre-read: if supplied and mismatched → `.cloudConflict`.
  7. **V3 eligibility guard** (Contract #6).
  8. Build the row with fresh `operation_id` and `source_snapshot_hash
     = localHash`.
  9. `gateway.writeSnapshot(...)` → on `ok: true` advance receipt; on
     `ok: false` → `.uploadFailed` (receipt unchanged); on throw →
     `.cloudUnavailable` (receipt unchanged).
- `CloudConflictResolver` surfaces an explicit user choice
  (`Overwrite cloud / Keep cloud, discard local / Cancel`). Default
  action is `Cancel` — never silent.
- Cloud receipt slot: `UserDefaults` scoped to `auth.uid()` (Cross-review
  revision M5), NOT inside `AppData.settings`. Mirrors the web boundary
  where the receipt lives in `localStorage` outside `AppData`.

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/cloudSubsequentUploadFlowBehavior.test.ts` | `CloudSubsequentUploadParityTests.swift` (iOS-7) |
| `tests/cloudOptimisticConcurrencyV5Behavior.test.ts` | `CloudSyncOptimisticConcurrencyTests.swift` (iOS-7) |
| `tests/cloudSyncConflictDetection.test.ts` (10 conflict types preserved) | `CloudConflictResolverTests.swift` (iOS-7) |

### MUST NOT

- MUST NOT call `writeSnapshot` without first calling
  `readLatestSnapshot` (V5 fresh-read is mandatory).
- MUST NOT retry a failed upload with `expectedPreviousHash = nil` to
  force-replace.
- MUST NOT update the local receipt on failure.
- MUST NOT delete any session / receipt / AppData entry as a side-effect
  of sync.
- MUST NOT auto-resolve a conflict; always present the user choice.
- MUST NOT register `BGTaskScheduler` / `BGAppRefreshTask` for cloud
  sync. Static guard on `import BackgroundTasks` in `ios/IronPath/`.
- MUST NOT silently retry on `cloud_unavailable` / `remote_unavailable`.

### Version

V1.

---

## 8. Unit kg / lb contract

### Frozen statement

All persisted weights are stored in **kg**. Display conversion is
unidirectional, render-time only. `parseDisplayWeightToKg` is the
only path that writes a kg value derived from a user-entered display
value. `convertKgToDisplayWeight(kg, 'lb')` rounds to integer lb (no
decimal lb display). The conversion constant is `KG_PER_LB =
0.45359237` exactly — not `0.4536` rounded, not Apple's
`NSMeasurement` internal precision. Per-set `displayUnit` is preserved
historically; historical sets are never coerced to a canonical unit on
read.

### TS sources of truth

| Item | Path:line |
|---|---|
| `KG_PER_LB = 0.45359237` | `src/engines/unitConversionEngine.ts:4` |
| `convertLbToKg` / `convertKgToLb` | `src/engines/unitConversionEngine.ts:16, 18` |
| `parseDisplayWeightToKg` | `src/engines/unitConversionEngine.ts:20` |
| `convertKgToDisplayWeight` (lb display = integer, kg = `roundOne`) | `src/engines/unitConversionEngine.ts:25` |
| `defaultIncrementKg: 2.5` / `defaultIncrementLb: 5` | `src/engines/unitConversionEngine.ts:7-11` |

### Swift mirror requirements

- `enum WeightUnit: String, Codable { case kg, lb }`.
- `enum UnitConversion { static let kgPerLb: Double = 0.45359237; ... }`.
- All numeric set-log fields stored as kg (`actualWeightKg`,
  `plannedWeightKg`, etc.).
- `displayWeight` derived at view time via `UnitConversion.kgToDisplay(
  _:in:)`; never persisted as the result of `kg → lb → kg` round-trip.
- A parity test for the classic vectors: `100 kg → 220 lb`,
  `135 lb → 61.2 kg`, `20.4117 kg → 45 lb` with no decimal noise.

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/unitConversion.test.ts` | `UnitConversionParityTests.swift` (iOS-3) |
| `tests/actionableLoadAlignment.test.ts` | `ActionableLoadAlignmentParityTests.swift` (iOS-5) |
| `tests/uiOsR8_7AActionableLoadContract.test.ts` | `ActionableLoadContractParityTests.swift` (iOS-5) |
| `tests/realDataUnitDisplayRegression.test.ts` | `UnitDisplayLegacyParityTests.swift` (iOS-3) |

### MUST NOT

- MUST NOT use `NSMeasurement` / `Measurement<UnitMass>` for the
  conversion; the rounding differs from `KG_PER_LB = 0.45359237` exact
  arithmetic.
- MUST NOT round-trip kg → lb → kg on read; per-set `displayUnit` is
  the source of truth for display.
- MUST NOT add a `unit` field to `bodyWeights[]` (implicit kg).
- MUST NOT display decimal lb anywhere.
- MUST NOT bury the constant in a Swift extension that hides the literal
  — it must be visible in code review.

### Version

V1.

---

## 9. Session lifecycle contract

### Frozen statement

A `TrainingSession` carries a session-level state machine and an
exercise-level / set-level state machine. Set IDs are deterministic
(`{exerciseId}-{setIndex+1}` for planned sets, with separate IDs for
warmups via `focusWarmupSetLogs`). `ActualSetDraft` holds in-flight
input, keyed by `stepId`, and is preserved across mid-edit back-button
events. `TrainingSession.completionQuality` and per-set
`completionStatus` are produced by the completion engine and gated by
`buildIncompleteMainWorkGuard`; "finish session" is a guarded
transition, not a simple button. `restTimerState` lives inside the
session model (not as a global timer) so multi-device resume preserves
remaining time. The four-ID exercise identity model
(`originalExerciseId / actualExerciseId / displayExerciseId /
recordExerciseId`) is non-collapsible.

### TS sources of truth

| Item | Path:line |
|---|---|
| `TrainingSession` | `src/models/training-model.ts:775` |
| `TrainingSetLog` | `src/models/training-model.ts:255` |
| `ActualSetDraft` | `src/models/training-model.ts:290` |
| `ExercisePrescription` | `src/models/training-model.ts:378` |
| `MesocyclePlan` | `src/models/training-model.ts:1313` |
| `buildFocusStepQueue` | `src/engines/focusModeStateEngine.ts:141` |
| Focus step ID grammar | `src/engines/focusModeStateEngine.ts:80` |
| `resolveFocusModeInteractionState` | `src/engines/focusModeInteractionState.ts:100` |
| `getExerciseIdentityFromExercise` (4-ID) | `src/engines/currentExerciseSelector.ts:40` |
| `evaluateEffectiveSet` (scoring rules) | `src/engines/effectiveSetEngine.ts:7` |
| `trainingCompletionEngine` (guard) | `src/engines/trainingCompletionEngine.ts` |

### Swift mirror requirements

- `struct TrainingSession` mirroring field-by-field, including
  `restTimerState: RestTimerState?` (`nil` = no timer; a real
  non-running object on a completed session is a Data Health repair
  signal).
- `struct TrainingSetLog`, `struct ActualSetDraft` — `Codable`, with
  `displayUnit: WeightUnit?` (kg by default, see Contract #8).
- `enum SessionCompletionStatus: String { case completed, incomplete,
  draft, legacyCompleted }` — `legacy_completed` must round-trip
  byte-identically (Product Agent §10 Q8).
- `FocusModeStateEngine.swift` ports the queue construction
  (correction support → warmup → working → functional support →
  terminal `completed`).
- `FocusModeInteractionState.swift` ports the deterministic
  primary-action resolver (Product Agent §3.3 table).
- `CurrentExerciseSelector.swift` ports the 4-ID resolution and the
  `hasInvalidExerciseIdentity` guard.
- "Finish session" is wired through `IncompleteMainWorkGuard` — never
  a plain button.

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/sessionBuilder.test.ts` | `SessionBuilderParityTests.swift` (iOS-5) |
| `tests/focusModePrimaryAction.test.ts` | `FocusModePrimaryActionParityTests.swift` (iOS-5) |
| `tests/focusModeInteractionState.test.ts` | `FocusModeInteractionStateParityTests.swift` (iOS-5) |
| `tests/replacementEngine.test.ts` (and the entire replacement suite) | `ReplacementEngineParityTests.swift` (iOS-5) |
| `tests/legacyReplacementIdentityPollution.test.ts` | `LegacyReplacementIdentityPollutionParityTests.swift` (iOS-5) |
| `tests/uiOsR2FocusModeInteractionDocs.test.ts` | `FocusModeInteractionDocsParityTests.swift` (iOS-5) |

### MUST NOT

- MUST NOT merge the 4-ID identity into a single ID; PR / e1RM /
  effective-set keying uses `recordExerciseId`, not `originalExerciseId`.
- MUST NOT show "完成一组" on a correction step; the interaction state
  machine resolves the primary action.
- MUST NOT make the rest timer a global app timer; it lives inside the
  session.
- MUST NOT auto-end a session that still has incomplete main work
  without firing `buildIncompleteMainWorkGuard`.
- MUST NOT coerce `legacy_completed` to `completed` on import.
- MUST NOT change `effectiveSetEngine` scoring constants (RIR 1-3
  full, 4 = ×0.65, ≥5 = ×0.45, technique poor = ×0.45, pain = ×0.5,
  threshold `score ≥ 0.75`). Those are the product.

### Version

V1.

---

## 10. Health data freshness contract

### Frozen statement

iOS HealthKit integration is **read-only** in V1 (no
`NSHealthUpdateUsageDescription`, no `HKHealthStore.requestAuthorization`
write toType). Authorisation is requested **lazily** on explicit user
tap, never at cold boot. The read type set is the minimal mapping from
`appleHealthTypeMap.ts`. Health data is **never used for advertising**
(App Review 5.1.1(ii)) and is **never written back** unless a future V2
feature adds write-back with its own audit. Health data freshness is
governed by `staleHealthReadinessGuardV1` (14-day threshold) and
`staleTodayStatusV1` (3-day threshold for `todayStatus`); stale data
degrades `useHealthDataForReadiness` to off and surfaces a passive
notice.

### TS sources of truth

| Item | Path:line |
|---|---|
| Type map (1:1 with `HKQuantityTypeIdentifier...`) | `src/engines/appleHealthTypeMap.ts:50` |
| Streaming XML parser (raw-attr allow-list) | `src/engines/appleHealthStreamingImportEngine.ts:54` |
| XML parser (same allow-list) | `src/engines/appleHealthXmlImportEngine.ts:53` |
| `buildHealthSummary` | `src/engines/healthSummaryEngine.ts` |
| `DATA_HEALTH_HEALTH_DATA_STALE_DAYS = 14` | `src/dataHealth/appDataRepairTypes.ts` |
| `DATA_HEALTH_TODAY_STATUS_STALE_DAYS = 3` | `src/dataHealth/appDataRepairTypes.ts` |
| `staleHealthReadinessGuardV1` repair | `src/dataHealth/repairs/staleHealthReadinessGuardV1.ts` |
| `staleTodayStatusV1` repair | `src/dataHealth/repairs/staleTodayStatusV1.ts` |

### Read type set (frozen)

| iOS-native HealthKit type | Source identifier | Used for |
|---|---|---|
| `HKQuantityType(.restingHeartRate)` | `HKQuantityTypeIdentifierRestingHeartRate` | Readiness |
| `HKQuantityType(.heartRateVariabilitySDNN)` | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | Readiness |
| `HKQuantityType(.heartRate)` | `HKQuantityTypeIdentifierHeartRate` | Activity load |
| `HKQuantityType(.stepCount)` | `HKQuantityTypeIdentifierStepCount` | Activity load |
| `HKQuantityType(.activeEnergyBurned)` | `HKQuantityTypeIdentifierActiveEnergyBurned` | Activity load |
| `HKQuantityType(.appleExerciseTime)` | `HKQuantityTypeIdentifierAppleExerciseTime` | Activity load |
| `HKQuantityType(.bodyMass)` | `HKQuantityTypeIdentifierBodyMass` | Bodyweight series |
| `HKQuantityType(.bodyFatPercentage)` | `HKQuantityTypeIdentifierBodyFatPercentage` | Composition trend |
| `HKQuantityType(.vo2Max)` | `HKQuantityTypeIdentifierVO2Max` | Conditioning trend |
| `HKCategoryType(.sleepAnalysis)` | `HKCategoryTypeIdentifierSleepAnalysis` | Readiness |
| `HKWorkoutType.workoutType()` | implicit | External workouts |

### Swift mirror requirements

- `protocol HealthKitAdapter` with `requestAuthorization(for:)`,
  `currentAuthorizationStatus(for:)`, `fetchDailyMetrics(_:)`,
  `fetchRecentWorkouts(limit:)`. (Architecture Agent §4.6.)
- `Info.plist` contains **only** `NSHealthShareUsageDescription`. The
  string is Chinese-first (Security Agent §4.3):
  `IronPath 会从 Apple 健康读取你的训练、体重、心率、HRV、睡眠、步数和活动能量，用来根据你当前的恢复状态调整今天的训练强度。除非你主动开启可选的云同步，否则这些健康数据只保存在你的设备上。`
- `NSHealthUpdateUsageDescription` is **absent**.
  `com.apple.developer.healthkit.background-delivery` is **not**
  enabled.
- Read sample objects are stripped at ingest using the same
  raw-attr allow-list as the TS XML parsers (`type`, `sourceName`,
  `unit`, `startDate`, `endDate`, `value`, `workoutActivityType`,
  `duration`, `durationUnit`). Drop everything else at the boundary.
- HealthKit samples never enter `buildAppDataSnapshotHash` of the cloud
  snapshot — they live in a separate Health snapshot scoped to the
  device (Security Agent §8 R9 + `HealthKitDataLocalOnlyParityTests`).

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/healthSummaryEngine*.test.ts` | `HealthSummaryEngineParityTests.swift` (iOS-8) |
| `tests/appleHealthTypeMap*.test.ts` | `AppleHealthTypeMapParityTests.swift` (iOS-8) |
| `tests/realDataHealthRepairUnits.test.ts` (`staleHealthReadinessGuardV1`) | `StaleHealthReadinessGuardParityTests.swift` (iOS-3) |
| `tests/iosHealthKitStaticGuards.test.ts` (NEW — TS side) | enforces Info.plist + entitlements |

### MUST NOT

- MUST NOT request HealthKit permission at app launch (Architecture
  Agent §8.2 + Security Agent §4.1).
- MUST NOT set `NSHealthUpdateUsageDescription` in V1.
- MUST NOT enable HealthKit background delivery in V1.
- MUST NOT register `HKObserverQuery` for background reads in V1.
- MUST NOT send HealthKit-derived data to a third party (Apple HK
  guideline) — never upload to Supabase, never log to any remote sink.
- MUST NOT keep more HK metadata than the raw-attr allow-list.

### Version

V1.

---

## 11. Real-data fixture contract

### Frozen statement

The parity-test fixture set lives under `tests/fixtures/parity/`
(Cross-review revision H1 — canonical path). Every input has a
`parityMeta` envelope (`id, schemaVersion, describes, privacy,
generatedFrom, tsCommit`). All values are JSON-serialisable
(no `undefined`, no `NaN`, no `Infinity`). Optional fields are
explicitly `null` rather than absent, so a Swift decoder cannot quietly
miss a defaulted value. No real `userId`, `accountId`, `deviceLabel`,
or email anywhere. The existing
`tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` is
re-used (not copied) as the end-to-end pipeline fixture. The licence to
use the redacted real export is owned by the IronPath project (single
user, self-redacted).

### TS sources of truth

| Item | Path:line |
|---|---|
| Existing redacted real-export fixture | `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` |
| Real-data regression fixtures (6 files) | `tests/fixtures/realDataRegression/*.json` |
| Real-export fixtures (2 files) | `tests/fixtures/realExports/*.json` |
| User-comparison fixtures | `tests/fixtures/userComparison/*.json` |
| Privacy guard | `tests/fixturePrivacyGuard.test.ts` |
| Snapshot hash canonical test | `tests/appDataSnapshotHashCanonical.test.ts` |

### Canonical fixture layout (frozen)

```
tests/fixtures/parity/
  inputs/         # input JSON, one per scenario
    app-data/
      snapshot-hash-stable-v1.json
      sanitize-roundtrip-v1.json
    training-decision/
      normal-session-v1.json
      reentry-productive-floor-v1.json
      lapse-dormant-v1.json
    data-repair/
      session-lifecycle-residue-v1.json
      impossible-duration-v1.json
      legacy-final-advice-isolation-v1.json
      screening-issue-score-explosion-v1.json
    focus-mode/
      golden-path-session-v1.json
    presenter/
      today-view-model-v1.json
      plan-view-model-v1.json
    cloud-sync/
      optimistic-concurrency-fresh-read-v1.json
    backup/
      import-export-roundtrip-v1.json
    real-export/
      redacted-2026-05-27.json    # POINTER to tests/fixtures/data-health/...
  golden/         # expected output JSON from the TS engine
  README.md       # fixture index + privacy statement + regen instructions
```

The generator script is `scripts/generate-parity-goldens.mjs` (per QA
Agent §11 and Cross-review revision H1). Re-running the generator is
deterministic (`--check` mode in CI).

### Swift mirror requirements

- Swift tests load fixtures from `tests/fixtures/parity/` via a build-time
  resource copy or a symlink target documented in the iOS-0 plan doc.
- Swift `JSONDecoder.keyDecodingStrategy = .useDefaultKeys` (TS uses
  camelCase; do NOT convert).
- Optional fields decoded as `nil` when absent and as the typed value
  when explicit `null`. Round-trip through Swift `JSONEncoder` produces
  byte-equivalent output for the canonical hash.
- Privacy guard on the iOS side: any Swift fixture that smells like a
  real account ID / email / device name fails CI.

### Parity tests

| TS test | Swift parity test |
|---|---|
| `tests/fixturePrivacyGuard.test.ts` | extended to also scan `tests/fixtures/parity/` (iOS-0) |
| `tests/appDataSnapshotHashCanonical.test.ts` | `AppDataSnapshotHashParityTests.swift` (iOS-0) |
| `tests/parity/parityFixturesGenerationConsistency.test.ts` (new — QA §11 step 3) | gates regeneration |

### MUST NOT

- MUST NOT include real user IDs, emails, device labels, or
  unredacted Supabase tokens in any fixture.
- MUST NOT diverge fixture names from `parity/inputs/<area>/<scenario>-v1.json`
  format — name discipline is part of the contract.
- MUST NOT mutate fixtures from Swift tests at runtime.
- MUST NOT regenerate goldens in CI; CI only `--check`s. Humans
  regenerate locally with `node scripts/generate-parity-goldens.mjs`.
- MUST NOT use `tests/fixtures/ios-contract/` (the alternate path
  proposed by Agent 8). The canonical path is `tests/fixtures/parity/`
  per Cross-review H1; iOS-0 acceptance uses the canonical path.

### Version

V1.

---

## Appendix A — Identifiers Swift must match byte-identically

This appendix consolidates the constants from Data Agent Appendix A and
the cross-agent review §14. Swift must emit / consume / hash these
values byte-identically with TS.

| Identifier | Source | Why exact match matters |
|---|---|---|
| `STORAGE_VERSION = 8` | `src/data/appConfig.ts:4` | Root + settings version field, both written on save. |
| `idempotencyKey` formula `(repairId, sorted unique affectedIds)` joined by `'|'`, hashed with `(hash << 5) - hash + charCode` and `hash >>> 0` | `src/dataHealth/repairs/repairHelpers.ts:4` | Ledger uniqueness across platforms. |
| `computeAppDataHash` | `src/dataHealth/repairs/repairHelpers.ts:71` | Ledger entries, cloud parity. |
| `buildAppDataSnapshotHash` (FNV-1a 32-bit over `stableStringify`) | `src/cloudProduction/accountBoundaryLocalInventory.ts:156` | Cloud upload parity. |
| `MAX_BACKUPS = 5` | `src/dataHealth/autoRepairBackupAdapter.ts:7` | Backup retention. |
| `MAX_DATA_REPAIR_LOG_ENTRIES = 500` | `src/dataHealth/appDataRepairEngine.ts:10` | Receipt cap. |
| `DATA_HEALTH_LEDGER_MAX_ENTRIES = 1000` | `src/dataHealth/appDataRepairTypes.ts:122` | Ledger cap. |
| `DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS = 24` | `src/dataHealth/appDataRepairTypes.ts:123` | Idempotency window. |
| `DATA_HEALTH_TODAY_STATUS_STALE_DAYS = 3` | `src/dataHealth/appDataRepairTypes.ts` | Stale threshold for `todayStatus`. |
| `DATA_HEALTH_HEALTH_DATA_STALE_DAYS = 14` | `src/dataHealth/appDataRepairTypes.ts` | Stale threshold for Apple Health. |
| `KG_PER_LB = 0.45359237` | `src/engines/unitConversionEngine.ts:4` | Unit conversion. |
| Brand symbol `'ironpath.trainingDecision.cleanInput.v1'` | `src/engines/trainingDecisionCleanInput.ts:58` | Cross-language coordination point for the clean-input contract (Swift enforces at compile time). |
| `decisionVersion: 'v2'` | `src/engines/trainingDecisionTypes.ts:429` | Lock for TrainingDecision V2. |
| `ROLE_FLOORS_REENTRY` (main 2 / secondary 2 / accessory 1 / isolation 1) | `src/engines/trainingDecisionEngine.ts:89` | Reentry productive floor. |
| Gap thresholds `0–3 / 4–7 / 8–13 / 14–27 / 28+ days` | `src/engines/effectiveTrainingPhaseEngine.ts:140` | Phase state machine. |

## Appendix B — Forbidden phrases (V2 forbidden-copy scan)

Per `tests/trainingDecisionHardRewriteForbiddenCopyScan.test.ts`, the
following Chinese phrases MUST NOT appear in the Swift bundle (compiled
`.app` resource strings + `Localizable.strings`):

- `力量有进步`
- `恢复压力偏高`
- `下次建议保持重量`
- `本周先控制风险`

A `xcrun strings` scan in `tests/iosForbiddenCopyScanGuard.test.ts`
(TS-side static guard) enforces this on every TestFlight + App Store
build.

## Appendix C — Passive status strings (kept on iOS)

These strings carry the same semantic meaning on iOS as on the web (per
Data Agent Appendix B + Cloud Agent §6.4). Final copy is product /
Architecture Agent's call, but the message taxonomy lives here.

- `数据已自动检查` — clean.
- `已自动修复 X 个旧版本问题` — auto-repaired (X is the applied count).
- `X 个待自动修复` — pending repairs.
- `X 个已隔离，不影响训练建议` — audit-only pending.
- `数据正在自动整理，稍后同步` — backup-failed / busy.
- `数据已整理完成，可同步` — eligible for sync.
- `同步暂缓，等待数据整理完成` — audit blocked.
- `同步暂缓：发现需要先整理的数据` — partially repaired.
- `同步暂缓：缺少修复回执` — missing receipt.
- `同步暂缓：数据无法识别` — invalid AppData.

---

End of Contract Freeze V1.
