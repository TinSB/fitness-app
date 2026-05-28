# iOS Native Migration Entry Gate V1 — Agent 6 Report
## QA / Test / Parity Agent

> Audit scope: docs / planning only. No runtime code touched, no fixtures
> exported, no Swift files created.
> Date: 2026-05-27. Working tree: `peaceful-hugle-21e407`.
> Co-agents on this audit: Agent 1 (product), Agent 2 (TS core logic),
> Agent 3 (data safety / repair), Agent 4 (cloud sync), Agent 5 (iOS
> architecture). This report references their scopes but does not redesign
> their contracts.

---

## 1. Mission

Define how the future Swift IronPath app will be **proven** to match the
current TypeScript behaviour — not by re-reading the code, but by running
the same inputs through both and comparing outputs.

Concretely, this report answers:

1. What fixture files must be exported from the TS side so Swift can replay
   them.
2. What parity tests Swift must run, paired engine-by-engine to TS.
3. What golden files (input → expected output JSON) are needed.
4. What real-data corruption cases must be covered.
5. What manual-on-device iPhone smoke tests are required before TestFlight.
6. What "done" means for each iOS phase (P0..P4).
7. What can go wrong at TestFlight and App Store review and how QA catches
   it pre-submission.

This report does **not** design the AppData schema (Agent 3), the cloud
sync contract (Agent 4), or the iOS app architecture (Agent 5). It treats
all three as fixed reference contracts and builds the parity layer on top.

---

## 2. Inputs inspected

| Area | What I looked at |
| --- | --- |
| `tests/` (1360 files, 1358 unique slugs) | `ls tests | awk` slug extraction; categorised by prefix into ~30 buckets |
| `tests/fixtures/` (4 subdirs) | every file enumerated; `realDataRegression/README.md` + headers of 6 JSON fixtures read in full |
| `tests/fixtures/realDataRegression/*.json` (6 files, ~510 lines total) | shapes inspected to derive the fixture contract |
| `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` (25 905 lines) | first 50 lines + line count — anchor for the "redacted real export" pattern |
| `tests/fixtures/realExports/*.json` (2 files, 98 + 98 lines) | full read of `hypertrophy_user_export.json` |
| `tests/fixtures/userComparison/*.json` (2 files) | head read to confirm shape |
| `tests/fixturePrivacyGuard.test.ts` | confirms anonymisation contract |
| `tests/appDataSnapshotHashCanonical.test.ts` | confirms the hash function is the parity primitive |
| `tests/appDataSanitizeParity.test.ts` | confirms the per-fixture sanitize parity pattern |
| `tests/appDataRoundTripRegression.test.ts` | confirms persistence round-trip parity |
| `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` | source of the redacted-fixture parity bar and dirty-data taxonomy |
| `docs/TRAINING_RECOMMENDATION_HARD_REWRITE_V2.md` | source of the V2 TrainingDecision parity surface and `userFacing.*` payload contract |
| `docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md` | source of the `CleanAppDataView → TrainingDecision` boundary contract |
| `docs/DATA_HEALTH_DIAGNOSTICS_CLARITY_PACK.md` | source of the diagnostics redaction policy that the iOS app must also honour |
| `docs/CLOUD_DATABASE_SYNC_REGRESSION_LOCK.md` | source of the "no background sync" claim — relevant for App Store readiness |
| `docs/CLOUD_OPTIMISTIC_CONCURRENCY_V5.md` | source of the V5 fresh-read parity assertions Swift cloud client must match |
| `docs/CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md` | source of the upload eligibility guard contract |
| `src/engines/enginePipeline.ts` (top 80 lines) | confirms `buildEnginePipeline` is the single entry point parity tests hang off |
| `src/engines/trainingDecisionTypes.ts` (top 290 lines) | confirms the exported decision-shape types Swift must structurally mirror |
| `src/dataHealth/cleanAppDataView.ts` (top 50 lines) | confirms the `CleanAppDataView` shape that is the pre-engine input |
| `src/data/appConfig.ts` | `STORAGE_VERSION = 8` confirmed as the current schema lock |
| Peer agent reports: `TS_CORE_LOGIC_AGENT.md`, `PRODUCT_TRAINING_DOMAIN_AGENT.md` | for engine portability classification and product-feature parity boundary |

---

## 3. Existing test family inventory (high-level buckets)

I did not enumerate all 1358 slugs in the report — too noisy. Below are the
buckets that the iOS parity strategy actually depends on, with rough counts
(`ls tests | grep -i <prefix> | wc -l`) and a note on what each bucket
already guarantees.

| Bucket | Approx count | What it guards today (and what Swift must replicate) |
| --- | --- | --- |
| `trainingDecisionHardRewrite*` | 12 | The V2 single-source-of-truth contract: `decisionVersion === 'v2'`, owned fields, reentry productive floor, signal-only legacy engines, forbidden-copy scan, arbitration coherence, AppData stability, daily-adjustment shape, decision stability / signature. **The primary parity bar.** |
| `trainingDecisionCleanInputContract*` | 3 | Brand-tagged `CleanTrainingDecisionInput` — Swift must enforce the same boundary via its type system (likely a Swift `struct` with private init). |
| `appData*`, `appDataSnapshotHashCanonical*`, `appDataRoundTripRegression*`, `appDataSanitizeParity*` | ~10 | Hash determinism, JSON round-trip, sanitize parity, ownership. The hash function is the single parity primitive for cloud sync. |
| `dataHealth*`, `dataRepair*`, `realDataHealthRepair*` | ~40 | Detection + dry-run + apply behaviour for each repair, idempotency, audit-only repairs, runtime guards. |
| `cloudOptimisticConcurrencyV5*`, `cloudSubsequentUploadFlow*`, `firstUploadExplicit*`, `cloudUploadEligibilityEnforcement*` | ~10 | Cloud write path: V3 eligibility guard, V4 expected-previous-hash, V5 fresh-read TOCTOU close. Owned by Agent 4 — Swift parity is referenced, not designed here. |
| `cloudSyncConflict*`, `conflictOfflineRollback*`, `cloudReadMirror*`, `cloudParityCheck*` | ~20 | Read-path conflict detection, offline rollback, parity check vs cloud. |
| `focusMode*`, `sessionBuilder*`, `equipmentAware*` | ~15 | MVP training-session UI engine layer — Focus Mode interaction state machine, session creation, equipment-aware load model. |
| `*DocsParity*` | 91 | **Test pattern only**, not behaviour. Each one pins a doc paragraph to a code constant. iOS migration will need an analogous Swift pattern — see §4. |
| `*BoundaryStillBlocked*` | ~70 | Phase locks. Web-only — these stay TypeScript and remain frozen during iOS work. |
| `presenter*`, `today*`, `plan*`, `record*`, `progress*` | ~30 | View-model output. Swift presenters must produce structurally identical `userFacing.*` payloads. |
| `backup*`, `import*`, `export*`, `roundtrip*` | ~10 | Backup file format compatibility — critical for "import the user's existing TS backup into iOS". |
| `fixturePrivacyGuard`, `observabilityRedaction*` | 3 | Privacy lock on fixtures and observability output. iOS must inherit the same lock. |

**Implication for iOS**: the TS-side test count (5500+) does not need to be
matched 1:1. Swift parity needs to match the **behaviour** the
`trainingDecisionHardRewrite*` + `realDataHealthRepair*` + cloud-V3..V5
buckets pin, not every boundary test. Expect ~150–250 Swift parity tests as
the realistic bar, plus the cross-language fixture-replay tests in §5.

---

## 4. Parity test plan — TS engine → Swift engine pairing

Pairing strategy: every Swift module that owns a piece of recommendation,
data-repair, or cloud-write logic must have a paired test that:

1. Reads a fixture JSON from `tests/fixtures/parity/` (new directory — see §11).
2. Calls the Swift implementation.
3. Calls the TS implementation via a Node sidecar (`scripts/parity-replay.mjs`,
   spawned from Swift test, talking JSON over stdio).
4. Diffs the outputs structurally (`expect(swiftOutput).toEqual(tsOutput)`
   on the Node side, `XCTAssertEqual` on the Swift side after re-parse).

The sidecar approach is preferred over "compare to a frozen golden file"
because golden files drift silently when TS changes; a live sidecar fails
loudly the moment TS and Swift diverge. Golden files (§5) are still used
for offline CI runs and for cases where the Node sidecar is impractical
(e.g. Apple-Health-specific iOS HealthKit integration).

| TS engine / module | TS entry point | Swift target | Parity test name (proposed) | Priority |
| --- | --- | --- | --- | --- |
| `cleanAppDataView.ts` | `buildCleanAppDataView(appData)` | `CleanAppDataView.build(_:)` | `CleanAppDataViewParityTests` | P0 |
| `enginePipeline.ts` | `buildEnginePipeline(appData, currentDate)` | `EnginePipeline.build(_:currentDate:)` | `EnginePipelineParityTests` | P0 |
| `trainingDecisionContext.ts` | `buildTrainingDecisionContext` | `TrainingDecisionContext.build(_:)` | `TrainingDecisionContextParityTests` | P0 |
| `trainingDecisionEngine.ts` | `buildTrainingDecision(input)` | `TrainingDecision.build(_:)` | `TrainingDecisionEngineParityTests` | P0 |
| `exercisePrescriptionEngine.ts` (`applyStatusRules`) | `applyStatusRules(...)` | `ExercisePrescription.applyStatusRules(_:)` | `ExercisePrescriptionEngineParityTests` | P0 |
| `sessionBuilder.ts` (`createSession`) | `createSession(...)` | `SessionBuilder.createSession(_:)` | `SessionBuilderParityTests` | P1 |
| `focusModeStateEngine.ts` | `buildFocusTrainingPlan(...)` | `FocusMode.buildPlan(_:)` | `FocusModeStateMachineParityTests` | P1 |
| `effectiveSetEngine.ts` | `buildEffectiveVolumeSummary(history)` | `EffectiveSetEngine.summary(_:)` | `EffectiveSetEngineParityTests` | P1 |
| `readinessEngine.ts` | `buildReadinessResult(...)` | `Readiness.build(_:)` | `ReadinessEngineParityTests` | P1 |
| `dailyTrainingAdjustmentEngine.ts` | `buildDailyTrainingAdjustment(...)` | `DailyAdjustment.build(_:)` | `DailyAdjustmentParityTests` | P1 |
| `loadFeedbackEngine.ts` | `buildLoadFeedbackBias(...)` | `LoadFeedback.bias(_:)` | `LoadFeedbackParityTests` | P1 |
| `adaptiveRecommendationEngine.ts` | `getLoadBias(...)` | `AdaptiveRecommendation.loadBias(_:)` | `AdaptiveRecommendationParityTests` | P1 |
| `dataHealthRepairEngine.ts` + `repairs/*` | each `RepairDefinition` (detect, dryRun, apply) | `DataRepair.<name>` | `DataRepair<Name>ParityTests` (×9 for V1 repairs) | P0 |
| `autoRepairOrchestrator.ts` | `runAutoRepairOrchestrator({ triggeredBy })` | `AutoRepairOrchestrator.run(_:)` | `AutoRepairOrchestratorParityTests` | P0 |
| `appDataRepairLedger.ts` | `appendLedgerEntry`, `isIdempotentMatch` | `RepairLedger.append(_:)`, `RepairLedger.isIdempotentMatch(_:)` | `RepairLedgerParityTests` | P0 |
| `appDataSanitize.ts` | `sanitizeData(data)` | `AppDataSanitize.sanitize(_:)` | `AppDataSanitizeParityTests` | P0 |
| `appDataMigration.ts` (incl. `STORAGE_VERSION = 8`) | `migrateTrainingData(raw)` | `AppDataMigration.migrate(_:)` | `AppDataMigrationParityTests` | P0 |
| `accountBoundaryLocalInventory.ts` (`buildAppDataSnapshotHash`) | `buildAppDataSnapshotHash(appData)` | `AppDataSnapshot.hash(_:)` | `AppDataSnapshotHashParityTests` | **P0 — critical** |
| `cloudSubsequentUploadFlow.ts` (V4) | `runCloudSubsequentUpload(...)` | `CloudSync.runSubsequentUpload(_:)` | `CloudSubsequentUploadParityTests` (defer to Agent 4 contract) | P2 |
| `cloudOptimisticConcurrencyV5*` | `readLatestSnapshot` fresh-read path | (Agent 4 design) | `CloudOptimisticConcurrencyV5ParityTests` | P2 |
| `uploadEligibilityGuard.ts` | `ensureCloudUploadEligible({...})` | `UploadEligibilityGuard.ensure(_:)` | `UploadEligibilityGuardParityTests` | P2 |
| `e1rmEngine.ts` | `estimateOneRepMax(weight, reps)` | `E1RM.estimate(weight:reps:)` | `E1RMEngineParityTests` | P1 |
| `unitConversionEngine.ts` | `convertKgToDisplayWeight(...)` | `UnitConversion.kgToDisplay(_:)` | `UnitConversionParityTests` | P1 |
| Presenters (`todayPresenter`, `planPresenter`, `recordPresenter`, `trainingPresenter`, `dataHealthPresenter`) | each `build*ViewModel(...)` | `*Presenter.build(_:)` | `*PresenterParityTests` (5 files) | P1 |

### Critical-path parity bar

The minimum set that must be green before Swift can claim "logic parity"
(P0 deliverable below):

- `AppDataSnapshotHashParityTests` (the hash function — every other cloud
  parity check depends on it).
- `AppDataMigrationParityTests` (`STORAGE_VERSION = 8` migrations must
  produce byte-identical sanitized output).
- `AppDataSanitizeParityTests` (`pureSanitizeData` already proves
  cross-implementation parity within TS; Swift joins as a third
  implementation).
- `CleanAppDataViewParityTests` (the input contract to the recommendation
  engine).
- `TrainingDecisionEngineParityTests` (`userFacing.*` payloads byte-equal).
- `DataRepair<Name>ParityTests` for the 9 V1 repairs (detect + dryRun +
  apply; idempotency key must match).
- `AutoRepairOrchestratorParityTests` (boot-time orchestration produces an
  identical ledger entry sequence).
- `RepairLedgerParityTests` (ledger append + idempotency match).

If any of these is red, Swift IronPath is not allowed onto a device.

### Forbidden-copy parity scan

`trainingDecisionHardRewriteForbiddenCopyScan` proves that certain wall
phrases (`力量有进步`, `恢复压力偏高`, `下次建议保持重量`, `本周先控制风险`) never
appear in the TS bundle. The Swift bundle scan needs the **same** forbidden
list with a Swift-specific implementation (e.g. a `XCTest` that scans the
compiled `.app` resource strings + `Localizable.strings`).

### What is **not** ported as parity tests

- Docs-parity tests (`*DocsParity*`). These pin TS code to TS-side
  docs. The iOS app gets its own docs-parity pattern (Swift unit test
  reads `docs/ios-native-migration/*.md` and asserts a constant is
  present); the existing TS docs-parity tests stay TS-only.
- Boundary-still-blocked tests (`*BoundaryStillBlocked*`). Web-only phase
  locks. They remain frozen and untouched during the iOS work.
- Web persistence tests (`apiBackedRead*`, `apiPrimary*`,
  `apiWriteThrough*`, `apiStorageAdapter*`, `bootFromApi*`). The iOS app
  uses Core Data / SwiftData / Files, not the Web `apiBacked*` adapters.
- DevAPI tests (`devApi*`). DevApi is a dev-only Web facility.
- React UI tests (`*.tsx` test files). iOS UI is independent — there is
  no UI parity test between Web and iOS. See §12.

---

## 5. Golden fixture plan

### Why golden files in addition to the live sidecar

Two reasons golden files exist alongside the §4 Node sidecar:

1. **CI hermeticity**. The Swift CI on macOS / GitHub Actions must not
   require a working Node + npm install + Vite chain just to run unit
   tests. Golden files let Swift CI run pure-Swift.
2. **Drift detection**. The Node sidecar catches drift the moment it
   happens. Golden files catch drift between Swift CI and the last green
   TS commit (rebuilt on TS-side changes via a script).

### Fixture format conventions

All fixtures live under (proposed new directory):

```
tests/fixtures/parity/
  inputs/         # input JSON (AppData or sub-shapes), one per scenario
  golden/         # expected output JSON from the TS engine for each input
  README.md       # fixture index + privacy statement + regen instructions
```

Conventions:

- Every input JSON has a `parityMeta` block at the top:

  ```json
  {
    "parityMeta": {
      "id": "training-decision/normal-session-v1",
      "schemaVersion": 8,
      "describes": "Healthy 5-week hypertrophy user, push day, normal readiness",
      "privacy": "synthetic — no real user data",
      "generatedFrom": "src/engines/trainingDecisionEngine.ts buildTrainingDecision",
      "tsCommit": "<filled by generator script>"
    },
    "input": { ... AppData or sub-shape ... }
  }
  ```

- Every golden JSON has a `parityMeta` block referencing the input by id:

  ```json
  {
    "parityMeta": {
      "of": "training-decision/normal-session-v1",
      "engine": "trainingDecisionEngine.buildTrainingDecision",
      "tsCommit": "<sha>",
      "generatedAt": "<iso>",
      "deterministic": true
    },
    "output": { ... TrainingDecision JSON ... }
  }
  ```

- All values are JSON-serialisable (no `undefined`, no `NaN`, no `Infinity`
  — the `appDataSnapshotHashCanonical` test already enforces this on the
  TS side; the parity fixture format inherits it).
- Optional fields are explicitly `null` rather than absent, so a Swift
  decoder cannot quietly miss a defaulted value.
- No real `userId`, `accountId`, `deviceLabel`, or email anywhere. The
  existing `fixturePrivacyGuard.test.ts` lock extends to this new
  directory (the Swift CI gets a parallel check).

### Top fixtures to export (ordered by usefulness)

| # | Fixture path | Input shape | Expected output | Owning TS engine |
| --- | --- | --- | --- | --- |
| 1 | `parity/inputs/training-decision/normal-session-v1.json` | Full AppData, healthy 5-week PPL user, no pain, no lapse, normal readiness | `TrainingDecision` JSON (`decisionVersion: 'v2'`, `userFacing.*` complete) | `trainingDecisionEngine.buildTrainingDecision` |
| 2 | `parity/inputs/training-decision/reentry-productive-floor-v1.json` | AppData with 14-day gap, mesocycle in deload→reentry transition | `TrainingDecision` with `activePhase=reentry`, `sessionIntent=reentry-productive`, all compounds 2 sets | `trainingDecisionEngine` + `exercisePrescriptionEngine` |
| 3 | `parity/inputs/training-decision/lapse-dormant-v1.json` | AppData with 60-day gap | `TrainingDecision` with full bias reset, `pickSuggestedTemplate` returns Push A | `trainingLapseEngine` chained into `trainingDecisionEngine` |
| 4 | `parity/inputs/app-data/sanitize-roundtrip-v1.json` | Lightly dirty AppData (mixed kg/lb, missing optional fields) | `sanitizeData(input) === sanitizeData(sanitizeData(input))` (idempotent) | `appDataSanitize.sanitizeData` |
| 5 | `parity/inputs/app-data/snapshot-hash-stable-v1.json` | Empty AppData + AppData with one session + AppData with optional field undefined vs absent | `buildAppDataSnapshotHash` matches across all three transformations | `accountBoundaryLocalInventory.buildAppDataSnapshotHash` |
| 6 | `parity/inputs/data-repair/session-lifecycle-residue-v1.json` | Session marked completed but with running rest timer + `currentExerciseId` set | Repair receipt JSON: `{ status: 'applied', repairId: 'sessionLifecycleResidueV1', affectedIds: […], idempotencyKey: '…' }` | `repairs/sessionLifecycleResidueV1` |
| 7 | `parity/inputs/data-repair/impossible-duration-v1.json` | Session with `durationMin = 4204`, `finishedAt - startedAt = 70h` | Repair receipt + post-state with sane duration | `repairs/impossibleDurationV1` |
| 8 | `parity/inputs/data-repair/legacy-final-advice-isolation-v1.json` | Session with `explanations[…]`, exercise with `suggestion`, `adjustment`, `warning` | `CleanAppDataView` strips all legacy advice; AppData unchanged | `repairs/legacyFinalAdviceIsolationGuardV1` |
| 9 | `parity/inputs/data-repair/screening-issue-score-explosion-v1.json` | `issueScores.scapular_control = 1846` with all `movementFlags = 'good'` | Runtime guard caps to ≤12; AppData unchanged | `repairs/screeningIssueScoreRuntimeGuardV1` |
| 10 | `parity/inputs/focus-mode/golden-path-session-v1.json` | Template + AppData + first user `logSet` action | `FocusTrainingPlan` + state after one logged set | `focusModeStateEngine` |
| 11 | `parity/inputs/presenter/today-view-model-v1.json` | EnginePipelineResult | `TodayViewModel` JSON | `todayPresenter.buildTodayViewModel` |
| 12 | `parity/inputs/presenter/plan-view-model-v1.json` | EnginePipelineResult | `PlanViewModel` JSON | `planPresenter.buildPlanViewModel` |
| 13 | `parity/inputs/cloud-sync/optimistic-concurrency-fresh-read-v1.json` | localSyncState + gateway stub + expectedPreviousHash | `runCloudSubsequentUpload` returns each of `unchanged`, `cloud_conflict`, `remote_changed`, `remote_unavailable`, `ok` (5 scenarios in one fixture file) | `cloudSubsequentUploadFlow` + V5 fresh-read |
| 14 | `parity/inputs/backup/import-export-roundtrip-v1.json` | A full backup export JSON | `import(export(import(x))) === import(export(x))` (idempotent backup file format) | `backup.ts` |
| 15 | `parity/inputs/real-export/redacted-2026-05-27.json` | Pointer to the existing `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` (re-used, not copied) | `runAutoRepairOrchestrator` produces the same ledger entries on Swift and TS | full pipeline (orchestrator + repairs) |

### Top 5 to export first (iOS-0 bootstrap — see §11)

1. `parity/inputs/app-data/snapshot-hash-stable-v1.json` — unblocks every
   cloud-sync parity test.
2. `parity/inputs/training-decision/normal-session-v1.json` — unblocks the
   primary recommendation parity bar.
3. `parity/inputs/data-repair/session-lifecycle-residue-v1.json` —
   unblocks the data-repair parity bar.
4. `parity/inputs/real-export/redacted-2026-05-27.json` — unblocks the
   end-to-end pipeline parity bar.
5. `parity/inputs/focus-mode/golden-path-session-v1.json` — unblocks the
   MVP Focus Mode flow on device.

### Generator script (TS-side)

The generator (proposed `scripts/generate-parity-goldens.mjs`) reads each
input under `tests/fixtures/parity/inputs/`, runs the named engine, writes
the matching golden, and embeds the current `git rev-parse HEAD` into the
`tsCommit` field. The script is **not** auto-run on CI; it is a developer
tool with a `--check` mode that fails if any golden is stale. CI runs
`--check`; humans run it without flags to regenerate. This matches the
existing `*DocsParity*` discipline.

---

## 6. Real-data corruption cases to test

The TS side already pins these against `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`. iOS must reproduce all of them, plus the cases that the existing TS tests defend against in `tests/fixtures/realDataRegression/`.

| Case | TS test that pins it today | Swift parity test required |
| --- | --- | --- |
| `schemaVersion` mismatch (raw export claims v < 8) | `appDataMigration*` | `AppDataMigrationParityTests.case_v7_to_v8` |
| `schemaVersion` mismatch (raw export claims v > 8 — i.e. coming from a future version) | `appDataMigration*` (returns null / forces recovery) | `AppDataMigrationParityTests.case_v9_returns_recovery_state` |
| Missing `dataHealthRepairLedger` (clean install) | `realDataHealthRepair*` | `RepairLedgerParityTests.case_empty_ledger` |
| Missing repair receipt for a repair that the ledger records as applied | `realDataHealthRepairPipeline` | `RepairLedgerParityTests.case_missing_receipt_detected` |
| Idempotent repair re-run (same `idempotencyKey` arrives twice) | `realDataHealthRepairUnits.test.ts` | `RepairLedgerParityTests.case_idempotent_match_skips` |
| Backup-first failure (IndexedDB write throws) | `realDataHealthRepairPipeline` (`status='backup_failed'`) | `AutoRepairOrchestratorParityTests.case_backup_fail_no_mutation` (Swift backs up to its own local store) |
| Dangling exercise ID (`baseId` references a deleted exercise) | indirect: `replacementEquivalenceAuditV1` | `DataRepairReplacementEquivalenceParityTests.case_dangling_baseId` |
| Replacement / equivalence chain mismatch (assisted-pull-up on horizontal-pull chain) | `replacementEquivalenceAuditV1` | (audit-only) `DataRepairReplacementEquivalenceParityTests.case_vertical_pull_on_horizontal_pull` |
| `NaN` / `Infinity` in load field | `appDataSanitizeParity` (already drops them) | `AppDataSanitizeParityTests.case_nan_load_dropped` |
| Negative weight | (implicit via sanitize) | `AppDataSanitizeParityTests.case_negative_weight_zeroed` |
| Set with `done = false` but full weight / reps / RIR (incomplete draft) | `realDataIncompleteDraftRegression`, `tests/fixtures/realDataRegression/incomplete-draft-sets-session.json` | `EffectiveSetEngineParityTests.case_incomplete_draft_excluded_from_volume` |
| kg / lb unit mismatch (`actualWeightKg = 45` but `displayUnit = 'lb'`, `displayWeight = 45`) | `realDataUnitDisplayRegression`, `tests/fixtures/realDataRegression/legacy-unit-display.json` | `UnitConversionParityTests.case_legacy_display_uses_actualWeightKg_as_source` |
| Set-ID collisions across sessions (42/48 IDs duplicated) | `setIndexRenumberV1` + (implicit) | `SessionBuilderParityTests.case_duplicate_set_ids_renumbered` |
| `setIndex` collapse (all zeros) | `setIndexRenumberV1` | `DataRepairSetIndexRenumberParityTests` |
| Impossible duration (`durationMin = 4204`) | `impossibleDurationV1` | `DataRepairImpossibleDurationParityTests` |
| `restTimerState.isRunning = true` on completed session | `sessionLifecycleResidueV1` | `DataRepairSessionLifecycleResidueParityTests` |
| Stale `todayStatus` (`date = 2026-05-04` vs `now = 2026-05-27`) | `staleTodayStatusV1` + `realDataTodaySorenessRegression` | `DataRepairStaleTodayStatusParityTests` |
| Stale Apple Health (latest sample 29 days old, `useHealthDataForReadiness=true`) | `staleHealthReadinessGuardV1` | `DataRepairStaleHealthReadinessParityTests` (note: Swift HealthKit reads are a separate domain — Agent 5 P2) |
| `screeningProfile.adaptiveState.issueScores` explosion (1846 with all flags `good`) | `screeningIssueScoreRuntimeGuardV1` + `screeningIssueScoreRepairV1` | `DataRepairScreeningIssueScoreParityTests` |
| Legacy final-advice fields on every session (`suggestion`, `adjustment`, `warning`, `prescription.weeklyAdjustment`, `explanations`) | `legacyFinalAdviceIsolationGuardV1` | `DataRepairLegacyFinalAdviceParityTests` |
| Duplicate plan-adjustment drafts by `sourceFingerprint` | `realDataPlanDraftRegression`, `tests/fixtures/realDataRegression/duplicate-plan-draft.json` | `PlanAdjustmentDedupParityTests` |
| PPL cycle boundary out-of-order completed | `realDataPplCycleBoundaryRegression`, `tests/fixtures/realDataRegression/ppl-cycle-boundary-history.json` | `MesocycleEngineParityTests.case_out_of_order_ppl_boundary` |
| Soreness ghost (old soreness leaking into today) | `realDataTodaySorenessRegression`, `tests/fixtures/realDataRegression/stale-today-soreness.json` | `ReadinessEngineParityTests.case_stale_soreness_ignored` |
| Performance-drop phantom (drop record references a missing session) | implicit via runtime guard | `CleanAppDataViewParityTests.case_phantom_performance_drop_filtered` |
| AppData missing required `userProfile` field | `appDataSanitize*` | `AppDataSanitizeParityTests.case_missing_userProfile_defaults` |
| Cloud snapshot hash mismatch (V5 `remote_changed`) | `cloudOptimisticConcurrencyV5*` | (Agent 4 owns) — referenced |
| Upload eligibility blocked (`pending_safe_repairs`) | `cloudUploadEligibilityEnforcement*` | (Agent 4 owns) — referenced |

---

## 7. Manual iPhone smoke plan — pre-TestFlight checklist

These flows run on a real physical iPhone (not simulator), against a clean
install, then again against an upgrade install from a TS-backup import.
Every flow has a hard pass / fail criterion and must be repeated on at
least one Apple-silicon iPhone (A15 or later) and one minimum-supported
iPhone (the bar Agent 5 sets — likely iPhone 12 / iOS 17).

### Flow 1 — Install + first launch (clean)

- Pass: app launches, first-launch onboarding completes, AppData is created
  at the iOS-equivalent of `STORAGE_VERSION = 8`, no auto-repair runs
  (nothing dirty to repair), no network call, no permissions prompt other
  than what Agent 5 documents.
- Fail: any crash before the home tab renders, any non-Apple-Health network
  call before the user opts in.

### Flow 2 — First-launch auto-repair (upgrade install)

- Setup: import the user's TS-side backup JSON via the new "Import backup"
  flow (Flow 7) into a fresh install. Verify auto-repair runs on the next
  boot.
- Pass: orchestrator runs, ledger appended, no popup, "已自动修复 X 个旧版本
  问题" status line visible on the Data Health screen, AppData hash changes
  in the expected way (matches the TS-side parity golden).
- Fail: popup shown, AppData hash matches an unexpected value, ledger
  empty after dirty input, any repair receipt missing its `before` /
  `after` sample.

### Flow 3 — Log a single set in a session (golden path)

- Pass: open today's planned session, start training, log one set
  (weight, reps, RIR), complete the set, the set persists to disk before
  the user kills the app, on re-launch the set is intact, the `actualSetDraft`
  is cleared, the Focus Mode state machine advances correctly to the next
  step.
- Fail: data loss after kill, double-counted set, set persisted but
  `restTimerState.isRunning = true` after the session is completed (this
  is exactly the bug `sessionLifecycleResidueV1` repairs — must not
  re-occur on iOS).

### Flow 4 — Finish a full session

- Pass: full session of 3 exercises × 3 sets each, finish via the explicit
  "结束训练" action, session moves from `activeSession` to `history`, the
  Today recommendation updates immediately, no rest timer left running,
  no `currentExerciseId` left pointing at a finished session.
- Fail: any of the above invariants broken.

### Flow 5 — Export backup to file

- Pass: "导出备份" produces a JSON file, the file is shareable via the
  iOS share sheet, the file parses on the TS side without error, the
  sanitized form on the TS side matches the iOS-side sanitized form
  (the parity replay can be done offline via the §11 generator).
- Fail: file unreadable, file fails TS-side sanitize, file contains
  any field the privacy fixture lock forbids (real names, tokens, etc).

### Flow 6 — Import backup from file (round trip)

- Pass: a backup produced by the same iOS device imports back cleanly
  (`import(export(x))` round trip is idempotent); a backup produced by
  the TS Web app imports cleanly with `auto-repair` running once and
  producing a deterministic ledger entry sequence.
- Fail: round trip changes any persistent field other than the ledger /
  receipt slots, import fails on a valid TS backup.

### Flow 7 — Explicit cloud upload

- Pass: when the user is signed in and explicitly taps "Upload now", the
  V3 eligibility guard runs; if `ok=false` the user sees the reason from
  the §10 copy table; if `ok=true` the V4 + V5 flow runs and either
  short-circuits (`unchanged`), succeeds, or returns `cloud_conflict` /
  `remote_changed` / `remote_unavailable` with the correct UI state.
- Fail: any background upload, any upload without explicit user gesture,
  any upload that bypasses the eligibility guard.

### Flow 8 — Explicit cloud download (read mirror)

- Pass: the user can pull the cloud snapshot via an explicit action; the
  pull does not auto-overwrite local; the user must confirm before apply;
  conflict resolution surfaces the same diff shape the TS app shows
  today.
- Fail: any automatic apply, any local data loss without confirmation.

### Flow 9 — Offline mode

- Pass: with Airplane Mode on, all read flows work, all write flows work
  to local storage, no error toast about network, cloud sync UI shows
  "offline" with no spinner stuck.
- Fail: app crashes offline, write fails offline, any non-cancellable
  network spinner.

### Flow 10 — Force-quit during write

- Pass: kill the app mid-set-log; on re-launch the partial state is
  recoverable (set is either in `activeSession` with `done=true` or
  cleared back to a draft).
- Fail: any state where the same set is both logged and lost.

### Flow 11 — Battery and storage budget (smoke level)

- Pass: 30-minute idle in Focus Mode does not drain battery below an
  Agent-5-defined threshold; AppData persisted footprint is within the
  expected order of magnitude of the TS export (Agent 3 sets the bar).
- Fail: app uses >5% battery in 30 min idle, AppData on disk is >10× the
  TS-side equivalent.

### Flow 12 — Forbidden-copy scan on the device build

- Pass: a `xcrun strings` scan of the shipped `.app` resource bundle does
  not contain any of the V2-forbidden phrases (`本周先控制风险`, `下次建议
  保持重量`, `恢复压力偏高`, `力量有进步`).
- Fail: any of those strings present.

### Cross-flow invariant: no Sentry / Crashlytics

The smoke checklist explicitly verifies that no external observability
library is bundled. The user must approve any addition; default behaviour
is no crash reporting. This is documented in the
`DATA_HEALTH_DIAGNOSTICS_CLARITY_PACK.md` redaction policy and inherited
here.

---

## 8. iOS phase "done" definitions

These are the exit criteria each phase must meet before the next is
allowed to start. Agent 5 owns the architecture inside each phase; this
report owns the test bar that proves the phase is done.

### P0 — Domain ports compile + critical-path parity tests green

- All P0 engines in §4 ported and compile under the iOS minimum target.
- All P0 parity tests in §4 pass against the §5 golden fixtures.
- The §11 iOS-0 fixture pack is exported from TS and checked in.
- The `AppDataSnapshotHashParityTests` matches byte-for-byte across
  Swift, TS pure, and TS facade implementations.
- No UI shipped yet; the iOS test target is the only thing running.
- **Exit gate**: `swift test` green; the 9 V1 repairs all parity-tested.

### P1 — MVP Focus Mode flow works on device

- Today / Plan / Training (Focus Mode) / Record / Settings shell screens
  are implemented to a level where the §7 Flow 3 + Flow 4 smoke tests
  pass.
- All P1 parity tests in §4 pass.
- Auto-repair runs on boot and writes a real ledger entry on a real
  device, against the §11 iOS-0 redacted real-export fixture.
- Backup export + import (Flows 5 + 6) round-trip cleanly on device.
- No cloud sync, no HealthKit yet.
- **Exit gate**: Flows 1, 2, 3, 4, 5, 6, 9, 10, 12 pass on a real
  iPhone; full P1 parity suite green.

### P2 — Cloud sync + HealthKit

- Cloud sync wired via the V3 + V4 + V5 contracts (Agent 4 design).
- HealthKit read wired via the existing `appleHealthStreamingImportEngine`
  / `healthSummaryEngine` parity contract; iOS-native HealthKit feed
  produces a `healthSummary` shape that passes
  `ReadinessEngineParityTests.case_health_summary_present`.
- All P2 parity tests in §4 pass.
- The §6 cloud-corruption cases all return the documented reasons.
- The §7 Flow 7 + Flow 8 manual smoke tests pass on a real iPhone, with
  the Agent 4 cloud test account.
- **Exit gate**: every cloud-corruption case returns the right reason;
  no background sync; no automatic upload; eligibility guard cannot be
  bypassed by a contrived caller in the iOS code.

### P3 — TestFlight

- §9 TestFlight readiness checklist green.
- All P0 + P1 + P2 parity tests green on CI.
- One full week of dogfood internal-testing has no crashes filed.
- No external observability library bundled (verified by a build-time
  scan).
- All `*.strings` files pass the forbidden-copy scan.
- **Exit gate**: app accepted by App Store Connect; internal-tester
  install works end to end including the §11 fixture-import smoke.

### P4 — App Store

- §10 App Store readiness risks all addressed and documented.
- Privacy strings (Info.plist) match the Agent 4 + Agent 5 inventory of
  what the app actually does.
- HealthKit usage descriptions are present and accurate.
- The "no background sync" claim is verifiable (no `UIBackgroundModes`
  entries other than what Agent 5 explicitly justifies).
- Screenshots and App Store metadata match the actual shipped flows.
- **Exit gate**: App Store review approval; a public TestFlight build
  available; a documented rollback plan in case a critical bug ships
  to the App Store.

---

## 9. TestFlight readiness checklist

This is the literal go / no-go list before submitting the first build to
TestFlight. Every item must be a yes.

- [ ] P0 + P1 + P2 parity tests are green on the merge commit being
      submitted (CI artefact link recorded in the release notes).
- [ ] §11 iOS-0 fixture pack is in the repo and referenced by every
      parity test that uses it.
- [ ] §7 Flows 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12 all pass on the
      submission build on a real iPhone (test report attached to the
      release notes).
- [ ] No external crash-reporting / telemetry library bundled. Verified
      by inspecting the linked frameworks in the `.ipa`. User has not
      approved any addition.
- [ ] No `URLSession` request fires before the user has explicitly tapped
      a cloud-sync or sign-in action. Verified by Charles Proxy or
      equivalent on a clean install.
- [ ] No `HealthKit` request fires before the user has explicitly turned
      on health-data-for-readiness. Verified by inspecting the
      `HKHealthStore` calls.
- [ ] `Info.plist` privacy strings (`NSHealthShareUsageDescription`,
      etc.) exist for every system permission the app can request, with
      accurate Chinese-first copy matching the `DATA_HEALTH_DIAGNOSTICS_CLARITY_PACK.md`
      tone.
- [ ] No `UIBackgroundModes` set unless Agent 5 has documented a specific
      justification reviewed by Agent 4.
- [ ] App size budget defined and met (Agent 5 sets the bar — typically
      <50 MB for an MVP).
- [ ] Crash budget defined: zero crashes during the §7 smoke run on
      two physical devices. Any crash blocks submission.
- [ ] Forbidden-copy scan run on the shipped resources (Flow 12) — green.
- [ ] Build is reproducible: a second build from the same commit
      produces a binary that passes the same tests.
- [ ] Release notes mention every behaviour delta from the TS Web app
      (especially: no offline service worker, no PWA install banner, no
      browser-only diagnostics screen).
- [ ] Rollback story documented: if TestFlight users hit a bug, what is
      the minimum-effort path back to a stable build.

---

## 10. App Store readiness risks

These are the risks that block App Store *review* (as distinct from
TestFlight, which is more permissive). Each risk has a mitigation.

### R1 — Privacy strings mismatch what the app does

- Risk: `Info.plist` claims health permissions the app does not actually
  use, or fails to claim ones it does use. Apple rejects on both ends.
- Mitigation: the §9 checklist verifies parity between
  `NSHealthShareUsageDescription` text and the actual `HKHealthStore`
  read types. Test: a `swift test` parity check that compares the
  HealthKit type set used in `appleHealth*` engine parity to the
  declared `Info.plist` set.

### R2 — HealthKit usage description vague

- Risk: Apple rejects vague descriptions like "for fitness tracking".
- Mitigation: descriptions follow the same Chinese-first owner-facing
  copy policy as the data-health pack — explain *why* and *what
  decision it informs*. Sample copy:
  `"IronPath 使用你的最近睡眠、心率与活动数据，仅在本地生成今天的训练建议；不会上传外部服务器。"`

### R3 — "No background sync" claim mismatches actual behaviour

- Risk: app claims local-first but actually fires background tasks; or
  vice-versa, declares `UIBackgroundModes` but uses them lightly enough
  that Apple rejects on "background-mode misuse".
- Mitigation: `CLOUD_DATABASE_SYNC_REGRESSION_LOCK.md` locks "no
  background sync". The iOS app must have a Swift parity test
  (`BackgroundModesParityTests`) that asserts the Info.plist contains
  no `UIBackgroundModes` entries other than what Agent 5 explicitly
  justifies (likely empty).

### R4 — Screenshots show flows that do not exist

- Risk: marketing screenshots reference Web-only screens (DevApi, the
  prototype, the API panel) that the iOS app does not ship.
- Mitigation: §9 checklist requires screenshot review; only screens
  Agent 5 has shipped may appear.

### R5 — Tracking transparency / IDFA

- Risk: Apple rejects apps that do tracking without the
  `NSUserTrackingUsageDescription` flow.
- Mitigation: the app does no tracking. The §9 "no external
  observability library" rule means the IDFA flow is never used.
  Verified by linker symbol scan.

### R6 — Local-first but with a hidden Supabase auto-call

- Risk: a future PR adds an automatic Supabase call that bypasses the
  explicit-opt-in policy. Apple may not catch this, but a user can.
- Mitigation: parity test `SupabaseClientGuardParityTests` — Swift
  equivalent of the TS `cloudDatabaseSyncRegressionLock` boundary —
  asserts that the Supabase client is never instantiated on launch and
  never instantiated without an explicit user action.

### R7 — Data residency / GDPR / DSAR

- Risk: cloud sync target (Supabase) data residency is not declared in
  App Store privacy nutrition labels.
- Mitigation: privacy labels include "Health & Fitness — Linked to
  user, used for app functionality only, not used for tracking"; cloud
  sync explicitly flagged as user-controlled, opt-in, deletable.
  Agent 4 confirms the data residency story; this report ensures the
  nutrition label matches it.

### R8 — Chinese-only copy fails review for non-CN regions

- Risk: app submitted globally but UI is Chinese-only. Apple does not
  reject for language alone but may reject metadata if it does not match
  the supported regions.
- Mitigation: if the App Store listing region is China-only, the
  Chinese-first copy is fine. If global, Agent 5 must ship at least
  one English fallback for the App Store description. The in-app copy
  remains Chinese-first per the user's instructions.

### R9 — Healthkit-derived data sent to a third party

- Risk: HealthKit guideline forbids sending HK data to a third party
  without explicit user consent and a specific privacy description.
- Mitigation: HK data is used only locally for readiness; never
  uploaded to Supabase or any third party. Parity test
  `HealthKitDataLocalOnlyParityTests` asserts that the HK summary never
  enters `buildAppDataSnapshotHash` of the cloud snapshot — it lives
  in a separate Health snapshot scoped to the device.

### R10 — Subscription / monetisation guideline

- Risk: if Agent 5 adds a paid tier, App Store has strict guidelines.
- Mitigation: out of scope for V1; the audit only covers the free
  flow. If monetisation is added, that is its own audit.

---

## 11. iOS-0 contract fixture export — the very first task

This is what the user runs on the TS side, **before** any Swift code is
written, to bootstrap parity. It produces the minimum set of
JSON-serialisable inputs + golden outputs that every later Swift parity
test depends on.

### Step 0 — Reserve the directory

```
mkdir -p tests/fixtures/parity/inputs
mkdir -p tests/fixtures/parity/golden
```

Add to `tests/fixturePrivacyGuard.test.ts` (or a sibling): a parallel
guard that asserts `tests/fixtures/parity/` contains no real user data.

### Step 1 — Write the 5 input fixtures listed in §5

These are the five "top fixtures to export first":

1. `parity/inputs/app-data/snapshot-hash-stable-v1.json`
2. `parity/inputs/training-decision/normal-session-v1.json`
3. `parity/inputs/data-repair/session-lifecycle-residue-v1.json`
4. `parity/inputs/real-export/redacted-2026-05-27.json` (pointer to the
   existing `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`
   to avoid duplicating 25 905 lines)
5. `parity/inputs/focus-mode/golden-path-session-v1.json`

Each input is hand-written from the existing test data plus the
description in §5; this is a one-time human-driven cost.

### Step 2 — Write the generator script

`scripts/generate-parity-goldens.mjs`:

- For each input JSON under `tests/fixtures/parity/inputs/`:
  - Read it, validate against the `parityMeta` shape.
  - Call the named TS engine (`enginePipeline.buildEnginePipeline`,
    `trainingDecisionEngine.buildTrainingDecision`, `repairs/<name>`,
    `focusModeStateEngine.buildFocusTrainingPlan`).
  - Write the resulting golden JSON under
    `tests/fixtures/parity/golden/`.
- Has a `--check` mode that exits non-zero if any golden differs from
  the freshly computed output.

### Step 3 — Write the corresponding TS-side parity check

`tests/parity/parityFixturesGenerationConsistency.test.ts` (new test
file, lives under `tests/parity/`):

- Walks `tests/fixtures/parity/inputs/`, reads the matching golden,
  re-runs the named engine, asserts equality.
- This guarantees Swift and TS always have the same reference.

### Step 4 — Commit and tag

The commit message is the parity baseline; the SHA is embedded in
every `parityMeta.tsCommit` field. Future drift is detectable because
the SHA changes when the golden is regenerated.

### Step 5 — Hand off to Agent 5 (iOS architecture)

Agent 5 picks up the fixture pack and builds the Swift `XCTest` targets
that consume it. The Node sidecar from §4 is set up once and lives in
`scripts/parity-replay.mjs`.

### What the user must do (concrete)

1. Create the directory structure in Step 0.
2. Hand-write the 5 input fixtures in Step 1, using the existing tests
   under `tests/realData*` as references.
3. Implement the generator in Step 2.
4. Run `node scripts/generate-parity-goldens.mjs` to write the goldens.
5. Add the new parity test from Step 3.
6. Commit. This is the iOS-0 commit.

Estimated effort: half-day to one day, depending on how careful Step 1
is. The output is what every later Swift parity test depends on.

---

## 12. Non-goals

This report deliberately does **not**:

- Specify any UI parity between Web and iOS. iOS has an independent
  UI (Agent 5). The Web app's React tree, CSS, MobileAppShell, BottomNav,
  ProfileView styling — none of it is a parity target. The only parity
  is at the engine + presenter view-model layer.
- Specify any UI snapshot tests (e.g. `XCSnapshotTesting`). Those are
  iOS-internal and not cross-language.
- Design the AppData schema. `STORAGE_VERSION = 8` is taken as fixed.
  Agent 3 owns schema; this report only assumes the schema is identical.
- Design the cloud sync contract. Agent 4 owns V3 + V4 + V5; this report
  cites the parity bar as "match Agent 4's contract" and the test names
  follow Agent 4's lead.
- Reproduce the docs-parity test pattern in Swift word-for-word. The
  Swift app gets its own docs-parity pattern (a Swift unit test reads
  the relevant `docs/ios-native-migration/*.md` and asserts a constant
  is present); the existing 91 TS docs-parity tests stay TS-only.
- Add Sentry / Crashlytics / external telemetry. None added without
  user approval.
- Replicate the 91 `*BoundaryStillBlocked` tests. Phase locks are
  TypeScript-only and remain frozen during the iOS work.
- Test the prototype / `prototype.html` flow. That is dev-only and not
  part of the iOS product.
- Define a CI matrix or GitHub Actions workflow. Agent 5 owns the CI
  structure; this report supplies the test names and exit gates.

---

## 13. Open questions

These need a human or another agent's decision before P0 starts.

1. **Node sidecar vs frozen goldens**: should every Swift parity test
   spawn a Node sidecar, or rely on frozen goldens? My recommendation:
   golden files in CI, sidecar in a `--live-parity` mode for local dev
   and the nightly job. Needs Agent 5's CI input.

2. **Minimum iOS target**: iOS 17 (broader compatibility) or iOS 18
   (more SwiftData features)? Affects what HealthKit API is available
   and what the parity bar is for Apple Health imports. Agent 5 + Agent 1
   decide.

3. **Schema evolution after `STORAGE_VERSION = 8`**: if Agent 3 bumps
   the schema during the iOS migration, every parity fixture is
   invalidated. Does the iOS-0 fixture pack target v8 only, or also
   include an upgrade-fixture from v7 → v8 → v9? My recommendation:
   include the v7 → v8 fixture only (the upgrade path that already
   exists); defer v9 until Agent 3 ships it.

4. **Auto-repair on iOS — same trigger?**: TS triggers
   `runAutoRepairOrchestrator({ triggeredBy: 'boot' })` via an
   `App.tsx` `useEffect`. iOS equivalent is likely
   `AppDelegate.didFinishLaunching` or a SwiftUI `App.task`. Whichever
   Agent 5 picks, the parity test must pass the same `triggeredBy:
   'boot'` value so the ledger entry matches.

5. **HealthKit vs `healthSummary` engine boundary**: the TS app reads
   Apple Health via XML import + streaming engine; the iOS app reads
   via HealthKit live. The boundary is the `HealthSummary` shape — but
   the *input* differs. Parity tests cover the `buildHealthSummary →
   readinessEngine → trainingDecision` chain; the upstream HK read is
   iOS-native and not parity-tested vs TS. Agreed?

6. **Backup file format compatibility**: do we commit to "the TS
   backup .json file imports cleanly into iOS forever"? My
   recommendation: yes, for v8. This is the migration story for
   existing TS users.

7. **Cloud sync account model**: Agent 4 owns this. The parity bar
   here assumes the same `ownerUserId` / `accountId` model. If Agent 4
   changes it, this report's cloud parity section needs an update.

8. **Forbidden-copy list — full source**: V2's forbidden-copy scan
   lists 4 phrases. Is that the canonical list, or are there phrases
   the dataHealth pack also forbids? Need a consolidated list in
   `docs/ios-native-migration/forbidden-copy-list.md` before P3.

9. **Crash budget for P3 (TestFlight)**: zero is the right bar but
   internal-tester crashes happen. What is the acceptable crash rate
   before P4 (App Store)? My recommendation: zero P0 crashes, ≤1 P1
   crash per 1000 sessions in TestFlight before promoting to P4.

10. **Privacy nutrition labels — exact text**: the Chinese-first copy
    in §10 R2 is illustrative. The actual text needs Agent 1 (product)
    + a legal review before submission.

---

## End of Agent 6 report.
