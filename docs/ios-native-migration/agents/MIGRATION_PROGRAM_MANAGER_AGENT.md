# iOS Native Migration Entry Gate V1 — Migration Program Manager Agent

Status: planning-only (docs only, no runtime source touched)
Author: Agent 8 — Migration Program Manager
Audit suite: iOS Native Migration Entry Gate V1 (multi-agent, 8 agents running in parallel)
Branch: `claude/peaceful-hugle-21e407`
Last updated: 2026-05-27

This is one of 8 sibling reports. Other agents (Root Cause / Architecture / UI / Data Safety / Recommendation / Regression / Implementation) are producing focused findings in parallel. This report is the **program-level plan** that sequences those findings into a deliverable iOS app. It does NOT design the architecture (Agent 5), the data-repair internals (Agent 3), or the UI (Agent 4); it sequences them.

---

## 1. Mission

Produce a realistic task-by-task roadmap for the iOS native rewrite, expressed in the team's existing V-stamped cadence (`iOS-N <feature> V1`, matching `#385`–`#391`). Each task is independently approvable, shippable, testable. The roadmap names exact dependencies, acceptance criteria (with named tests), pre-merge gates, and stop conditions. Output is one markdown report — no code under `src/`, `apps/`, `tests/`, `supabase/`, `packages/` is touched; no Xcode project is created.

The user prescribed 11 tasks (iOS-0 through iOS-10). This agent: (1) confirms the dependency graph, (2) defines what each ships + does not ship, (3) defines the earliest usable iPhone build, (4) defines pre-TestFlight + pre-App-Store gates, (5) defines stop conditions. This is the gate document for "we are ready to start iOS-0 or not".

---

## 2. Inputs inspected

### 2.1 Recent main commits (program cadence evidence)

```
1905f03 Data Integrity Remediation Planning V1: planning-only triage of 3 audits (#389)
cd65459 Cloud Optimistic Concurrency V5: client-side fresh-read preflight (#390)
ca3a592 TrainingDecision Clean Input Contract Lock V1: branded factory + static guards (#391)
1c61590 Cloud Subsequent Upload Flow V4: safe post-first-upload contract (#388)
86a4222 Cloud Upload Eligibility Enforcement V3: mandatory upload guard (#387)
94ad9b0 Data Health Cloud Restore Linkage V2: central ingress pipeline (#386)
6d73dcd Real Data Health Repair System V1 — automation-first immunity layer (#385)
fe0a858 Training Recommendation Hard Rewrite V2 (#384)
dbd2964 Rebuild IronPath Codex Skills for Claude V1 (#382)
324c466 Training Cycle Gap Auto Re-entry State Machine V1 (#381)
04483f2 Real iPhone Sync Cloud Conflict V3 (#380)
```

Pattern observations (used as load-bearing input to this plan):

- Every shipped feature carries a `V1` / `V2` / `V3` stamp.
- Most features ship in pairs: `*_PLAN.md` (planning) → `*_V1.md` (delivered) / `*_V2.md` / etc.
- Some features (`Data Integrity Remediation Planning V1`) ship as **docs-only PRs** that gate implementation.
- "Lock" docs (`TrainingDecision Clean Input Contract Lock V1`) are a separate artifact that enforces invariants once a feature stabilizes.
- "Entry Gate" docs (`CLOUD_AUTH_SYNC_ENTRY_GATE.md`) are used when a sub-system has many dependencies that must all be green before progress is allowed.

This iOS migration adopts the same cadence verbatim. Each iOS-N task is a `V1`. Each one starts as `*_PLAN.md` if non-trivial, then ships as `*_V1.md` when delivered, then earns a `*_LOCK.md` if it stabilizes.

### 2.2 Planning + lock docs inspected

- `docs/DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md` — exemplar of planning-only triage. Confirms the cadence: planning → tasks doc → per-task PR → per-task lock.
- `docs/DATA_INTEGRITY_REMEDIATION_TASKS_V1.md` — exemplar of per-task acceptance specs (scope / non-goals / files / safety / schema / tests / smoke / merge rules). This report mirrors that schema for every iOS task below.
- `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` + `*_PLAN.md` — confirms the "automation-first immunity layer" + "no popup" UX bar and the fixture-driven test convention (`tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`).
- `docs/TRAINING_RECOMMENDATION_HARD_REWRITE_V2.md` + `*_PLAN.md` — confirms the "single source of truth, no fallback" pattern and the practice of hard-deleting legacy modules rather than leaving compatibility shims.
- `docs/CLOUD_OPTIMISTIC_CONCURRENCY_V5.md` + `*_PLAN.md` — confirms the "explicit user action, no silent overwrite, no fake success" cloud contract.
- `docs/CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md` + `*_PLAN.md` — confirms the upload-eligibility hard gate that the iOS port must inherit.
- `docs/CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md` + `*_PLAN.md` — confirms the post-first-upload contract.
- `package.json` — confirms the TS stack (React 19 + Vite + Vitest + Supabase) and the script surface (`typecheck`, `test`, `build`, `api:dev:build`) that the contract-fixture export must hook into.

### 2.3 Required iOS task list (input from user)

| Stamp | Task |
|---|---|
| iOS-0 | Contract Fixture Export V1 |
| iOS-1 | Xcode Project Bootstrap V1 |
| iOS-2 | AppData Swift Models V1 |
| iOS-3 | Data Health Swift Port V1 |
| iOS-4 | TrainingDecision Swift Port V1 |
| iOS-5 | Native Focus Mode MVP V1 |
| iOS-6 | Plan / History / Progress Native Screens V1 |
| iOS-7 | Explicit Cloud Sync iOS V1 |
| iOS-8 | HealthKit Adapter V1 |
| iOS-9 | TestFlight Internal Acceptance V1 |
| iOS-10 | App Store Readiness V1 |

This report adds nothing to that list. It defines what each task means and how they connect.

---

## 3. Program cadence observation

The team's shipped cadence is the program contract. iOS inherits it unchanged.

**V1 → V2 → V3 sequencing**: Every feature ships as a numbered version. V1 is intentionally minimal; V2 widens coverage only after V1 proves safe in production; V3+ adds enforcement (static guards, hard contracts). No iOS task starts at V2 or skips to V3 enforcement before V1 is green. Consequences: iOS-7 is explicit-action-only (matches TS V3/V4/V5); iOS-3 ports only V1 repairs (deferred V2/V3 work in `DATA_INTEGRITY_REMEDIATION_TASKS_V1.md` stays deferred); iOS-4 ports TS V2 verbatim with no parallel "lightweight" engine.

**Planning-first-then-impl**: Three of the four most recent feature PRs shipped a `*_PLAN.md` before any code. iOS-0 and iOS-1 are trivial enough to skip a planning doc (one PR each). iOS-2 through iOS-8 each MUST have a `docs/ios-native-migration/IOS_N_*_PLAN.md` merged before the implementation PR opens. iOS-9 / iOS-10 docs ARE the deliverable.

**Lock-doc pattern**: After stabilization, lock docs capture invariants (see `TrainingDecision Clean Input Contract Lock V1`). iOS adopts this post-iOS-4 (`IOS_4_TRAINING_DECISION_SWIFT_LOCK_V1.md`) and post-iOS-7 (`IOS_7_EXPLICIT_CLOUD_SYNC_LOCK_V1.md`). Optional in V1, expected in V1.5+.

**Docs-only PR pattern**: `Data Integrity Remediation Planning V1` shipped as a docs-only PR. The 8 agent reports + this roadmap follow the same pattern — `docs/ios-native-migration/*.md` only, no Xcode project, no Swift, no package change.

---

## 4. Task list

Each task follows the schema from `docs/DATA_INTEGRITY_REMEDIATION_TASKS_V1.md` adapted for iOS:

- Goal
- Non-goals
- Likely files / project area
- Dependencies
- Acceptance criteria
- Tests (named)
- Manual iPhone smoke
- Risks
- Merge / release rule

> **Note**: file paths under `ios/` are proposed. The actual structure is decided by Agent 5 (Architecture). This report names them as anchors so dependencies are unambiguous.

---

### iOS-0 — Contract Fixture Export V1

**Goal**: Produce a deterministic, versioned set of JSON contract fixtures from the existing TS engines so the Swift port can be test-driven against the exact same inputs and expected outputs. This is the bedrock dependency for iOS-3 and iOS-4. Without it, the Swift port is guess-driven.

**Non-goals**:
- No Xcode project (that is iOS-1).
- No Swift code.
- No changes to runtime TS engines — fixtures are exported via a new `scripts/export-ios-contract-fixtures.mjs` that calls existing pure engines.
- No schema bump.
- No new repair logic.
- No cloud / Supabase touches.

**Likely files / project area**:
- `scripts/export-ios-contract-fixtures.mjs` — Node script that invokes pure TS engines and writes fixtures.
- `tests/fixtures/ios-contract/` — `appdata-clean-v1.json` (input), `cleanAppDataView-v1.json` (expected projection), `trainingDecision-v1.json` (expected v2 output), `dataHealthRepair-v1.json` (expected repair ledger / receipts).
- `tests/iosContractFixtureExport.test.ts`, `iosContractFixtureStaticGuards.test.ts`.
- `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md`.

**Dependencies**: None. This is the root of the dependency graph.

**Acceptance criteria**:
- `npm run typecheck`, `npm test` (including the new `iosContractFixtureExport.test.ts`), and `npm run build` all pass.
- `node scripts/export-ios-contract-fixtures.mjs` is deterministic — two consecutive runs produce byte-identical files (`git diff` empty).
- All fixtures share the same redacted baseline as `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`.
- Each fixture has envelope `{ schemaVersion, generatedAtIso, sourceCommitSha, payload }` so the Swift side can detect drift.
- Zero new TS dependencies; `package.json` unchanged.

**Tests** (named):
- `tests/iosContractFixtureExport.test.ts` — fixtures non-empty; `buildCleanAppDataView / runTrainingDecision / runRepairRegistry` outputs match every fixture; re-running export is byte-identical.
- `tests/iosContractFixtureStaticGuards.test.ts` — every fixture has the envelope; `sourceCommitSha` matches `git rev-parse HEAD`; `schemaVersion` matches `src/models/training-model.ts:SCHEMA_VERSION`.

**Manual iPhone smoke**: N/A — no iPhone involvement at this stage.

**Risks**:
- TS engine non-determinism leaks into the fixture (e.g. an engine calls `Date.now()` or `Math.random()` directly). Mitigation: the export script pins `nowIso` to a fixed value and the static guard test re-runs to confirm zero diff.
- Engines that depend on `localStorage` cannot be invoked from a Node export script. Mitigation: only invoke pure engines (`buildCleanAppDataView`, `buildTrainingDecision`, `appDataRepairEngine.runRepair`). UI / DOM / storage engines are explicitly out of scope for this fixture export.

**Merge / release rule**:
- One PR.
- Title: `iOS-0 Contract Fixture Export V1`.
- Must include `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md`.
- No `--admin` merge.
- No `--no-verify`.
- iOS-1 may NOT open until this PR is merged.

---

### iOS-1 — Xcode Project Bootstrap V1

**Goal**: Create the iOS Xcode project skeleton with the minimum viable scaffolding to host the Swift port. No business logic.

**Non-goals**:
- No SwiftData. No Core Data. No persistence layer choice (that is decided in iOS-2 by Agent 5).
- No HealthKit entitlement (iOS-8).
- No CloudKit / Supabase wiring (iOS-7).
- No analytics SDK. No Sentry. No Crashlytics. (These require explicit user approval — see stop conditions.)
- No third-party dependencies beyond Apple's standard frameworks unless explicitly approved.
- No App Store metadata (iOS-10).

**Likely files / project area**:
- `ios/IronPath.xcodeproj/` + `ios/IronPath/IronPathApp.swift` (`@main` entry with placeholder `ContentView`), `Info.plist` (minimum viable, display name `IronPath`), `Assets.xcassets/` (placeholder app icon + accent color), `ios/README.md`.
- `docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md`.
- No changes to `src/`, `apps/`, `tests/`, `supabase/`, `packages/`.

**Dependencies**:
- iOS-0 merged.

**Acceptance criteria**:
- `xcodebuild build` succeeds with zero warnings; app boots in Simulator (iPhone 15 Pro, iOS 17+) and shows placeholder.
- `ios/README.md` documents min Xcode version, min iOS target (proposed iOS 17.0 — confirmed by Agent 5), and run-on-simulator / run-on-device instructions.
- Bundle ID set; no provisioning profile committed; no third-party SwiftPM / CocoaPods / Carthage dependency.
- Existing TS app on `main` unaffected (`typecheck`, `test`, `build` all still pass).

**Tests** (named):
- No Swift unit tests in this task (no business logic).
- `tests/iosBootstrapStaticGuards.test.ts` — asserts `project.pbxproj` exists; `ios/README.md` cites iOS-0 as prerequisite; no `Package.swift` in V1.
- `tests/iosBootstrapNoForbiddenSdkGuards.test.ts` — grep guard: no `Sentry / Crashlytics / Firebase / Mixpanel / Amplitude / Segment` in `ios/` (case-insensitive).

**Manual iPhone smoke**: Build for Simulator (iPhone 15 Pro, iOS 17) — app launches, shows placeholder, no crash, no console error. Build for a real iPhone (developer signing) — installs and launches.

**Risks**:
- Over-scoping V1: the temptation to add SwiftData / TCA / Combine / Observation in this task. **Resisted**: V1 is bare scaffolding only.
- Premature persistence choice: SwiftData vs Core Data vs raw JSON file. **Not decided here** — that is Agent 5's call, formalized in iOS-2's plan doc.
- Bundle ID conflicts with existing PWA bundle. Mitigation: confirm via App Store Connect before merge.

**Merge / release rule**:
- One PR.
- Title: `iOS-1 Xcode Project Bootstrap V1`.
- Must include `docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md`.
- No `--admin` merge.

---

### iOS-2 — AppData Swift Models V1

**Goal**: Port the `AppData` TypeScript model surface (`src/models/training-model.ts`) to Swift `Codable` structs that round-trip with the iOS-0 fixtures byte-for-byte (modulo JSON key ordering).

**Non-goals**:
- No persistence (file I/O, SwiftData, Core Data) — that is decided here in the plan doc but implemented as a thin adapter in iOS-3.
- No data repair logic (iOS-3).
- No decision logic (iOS-4).
- No UI binding (iOS-5/iOS-6).
- No schema bump on the TS side. Swift models mirror TS exactly.
- No "Swift-idiomatic restructuring" that changes the wire shape. Wire shape is the contract.

**Likely files / project area**:
- `ios/IronPath/Models/` — `AppData.swift`, `TrainingSession.swift`, `TrainingSetLog.swift`, `ExercisePrescription.swift`, `Settings.swift`, `SchemaVersion.swift` (single source of truth for the Swift-side schema version constant).
- `ios/IronPathTests/AppDataCodableRoundTripTests.swift`, `AppDataSchemaVersionGuardTests.swift`.
- `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1.md` (planning + delivered combined; includes the persistence-decision section).
- No changes to `src/` other than (possibly) the fixture envelope check.

**Dependencies**:
- iOS-1 merged.
- iOS-0 merged.

**Acceptance criteria**:
- `xcodebuild test` on iPhone 15 simulator passes.
- `AppDataCodableRoundTripTests` decodes every iOS-0 fixture, re-encodes it, and asserts `Equatable` equality with the original.
- Decoded `schemaVersion` matches Swift `SchemaVersion.current` for every fixture.
- Unknown-field stance is explicitly recorded in the plan doc (strict reject vs preserve).
- `tests/iosContractFixtureExport.test.ts` still green (no TS regression).

**Tests** (named):
- `AppDataCodableRoundTripTests.swift` — for each fixture: decode → re-encode → decode → assert equality.
- `AppDataSchemaVersionGuardTests.swift` — `SchemaVersion.current` matches the TS value; iOS-0 envelope is the source of truth, so this test fails if Swift drifts.
- `tests/iosAppDataSwiftModelStaticGuards.test.ts` — greps `ios/IronPath/Models/`: every top-level model is `Codable` + `struct` (immutable default); no `@Observable` / `@Model` (SwiftData) / `@objc` annotation in V1.

**Manual iPhone smoke**: Run `AppDataCodableRoundTripTests` on Simulator, then on a real iPhone via Xcode test plan.

**Risks**:
- TS uses optional fields heavily; Swift `Codable` is strict. Mitigation: every field defaults to `nil` / is marked `Optional` in Swift, with explicit `CodingKeys` to match TS camelCase.
- TS uses `Record<string, T>` ad-hoc; Swift maps these to `[String: T]`. Mitigation: the iOS-0 fixture export normalizes key order.
- Date encoding: TS uses ISO strings, Swift defaults to `Date.timeIntervalSinceReferenceDate`. Mitigation: Swift `JSONDecoder.dateDecodingStrategy = .iso8601` everywhere; static test enforces this.
- Premature SwiftData: introducing `@Model` here couples the model layer to a specific persistence stack before Agent 5 has decided. **Resisted**: V1 uses plain `Codable struct` only.

**Merge / release rule**:
- One PR.
- Title: `iOS-2 AppData Swift Models V1`.
- Must include `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1.md` with the persistence-decision section.
- No `--admin` merge.
- iOS-3 may NOT open until this PR is merged.

---

### iOS-3 — Data Health Swift Port V1

**Goal**: Port the V1 data-health repair system (`src/dataHealth/`) to Swift so that the iOS app applies the same Runtime Guard projection and the same Safe Auto Repair set on cold start, before any decision engine runs.

**Non-goals**:
- No new repair IDs beyond the 9 active V1 IDs already in the TS registry.
- No deferred V2/V3 repairs (`partialCompletionDerivedQualityV1`, `replacementEquivalenceCanonicalV1`, `replacementEquivalenceRecordRewriteV3`, etc. — these belong to follow-up tasks per `DATA_INTEGRITY_REMEDIATION_TASKS_V1.md`).
- No new ledger schema. The Swift port writes the same `DataHealthRepairLedgerEntry` shape into `settings.dataHealthRepairLedger`.
- No cloud / Supabase touches — Data Health stays local-only.
- No silent rewrite of user data without backup-first.
- No popup UI for repair receipts — match the TS "no popup" UX bar.

**Likely files / project area**:
- `ios/IronPath/DataHealth/` — Swift siblings to every file in `src/dataHealth/`: `CleanAppDataView.swift`, `DataHealthRuntimeGuard.swift`, `AutoRepairOrchestrator.swift`, `AppDataRepairEngine.swift`, `AppDataRepairRegistry.swift`, `AppDataIngressPipeline.swift`, `AppDataRepairTypes.swift`, `AppDataRepairLedger.swift`, `AutoRepairBackupAdapter.swift` (file-system backup in Application Support directory, NOT IndexedDB).
- `ios/IronPath/DataHealth/Repairs/` — one Swift file per V1 repair ID: `SessionLifecycleResidueV1`, `ImpossibleDurationV1`, `StaleTodayStatusV1`, `StaleHealthReadinessGuardV1`, `ScreeningIssueScoreRuntimeGuardV1`, `ScreeningIssueScoreRepairV1`, `LegacyFinalAdviceIsolationGuardV1`, `SetIndexRenumberV1`, `ReplacementEquivalenceAuditV1`.
- `ios/IronPathTests/CleanAppDataViewSwiftPortTests.swift`, `AppDataRepairRegistrySwiftPortTests.swift`, `AutoRepairOrchestratorSwiftPortTests.swift`, `AppDataIngressPipelineSwiftPortTests.swift` (all new).
- `docs/ios-native-migration/IOS_3_DATA_HEALTH_SWIFT_PORT_V1.md` (new).

**Dependencies**:
- iOS-2 merged.

**Acceptance criteria**:
- Every Swift repair's `detect` and `dryRun` output is byte-equal to the TS fixture.
- Every Swift repair `apply` produces JSON-equal `repairedData` to the TS post-repair fixture.
- `idempotencyKey` is deterministic and matches the TS-side computation.
- `AutoRepairOrchestrator` runs the safe-auto set, persists the ledger, and is idempotent across two runs (second run reports `status='skipped'` for already-applied repairs).
- Backup-first enforced: `AutoRepairBackupAdapter.snapshot` failure halts repairs and records `status='backup_failed'`.
- `DataHealthRepairLedgerEntry` shape matches the TS type byte-for-byte (re-encoded through `Codable`).
- `CleanAppDataView.build(appData:)` JSON equals TS `buildCleanAppDataView(appData)` for every iOS-0 fixture.

**Tests** (named):
- `CleanAppDataViewSwiftPortTests.swift` — JSON equality vs `cleanAppDataView-v1.json` for every fixture.
- `AppDataRepairRegistrySwiftPortTests.swift` — `detect / dryRun / apply` fixture-equal output for all 9 repair IDs.
- `AutoRepairOrchestratorSwiftPortTests.swift` — backup-first; idempotent re-run; backup-failure halts repair; ledger entries match TS.
- `AppDataIngressPipelineSwiftPortTests.swift` — central ingress output matches TS `processIncomingAppData`.
- `tests/iosDataHealthSwiftPortStaticGuards.test.ts` — every TS V1 repair has a Swift sibling; no v2/v3 scaffold imports; no `UserDefaults` for ledger (must use file system).

**Manual iPhone smoke**: Boot Simulator with the redacted fixture seeded via debug-only launch flag. Confirm Data Health placeholder UI reports the same repair counts as the TS app and cold-boot repair completes in < 500ms.

**Risks**:
- Date / timestamp drift between Swift and TS — mitigation: single `Clock` protocol with injectable fixed clock for tests.
- IndexedDB → file system: iOS uses Application Support with atomic-write JSON; test suite covers "backup-write fails" path.
- Receipts cap (500 / 1000) must match identically — static guard on the cap constant.
- Premature SwiftData — same as iOS-2, forbidden here.
- Raw AppData leaking into TrainingDecision — Runtime Guard is the firewall; static guard ensures iOS-4 only reads `CleanAppDataView`.

**Merge / release rule**:
- One PR.
- Title: `iOS-3 Data Health Swift Port V1`.
- Must include `docs/ios-native-migration/IOS_3_DATA_HEALTH_SWIFT_PORT_V1.md`.
- No `--admin` merge.
- iOS-4 may NOT open until this PR is merged.

---

### iOS-4 — TrainingDecision Swift Port V1

**Goal**: Port the TS V2 TrainingDecision engine (`src/engines/trainingDecisionEngine.ts` + supporting signal engines) to Swift. Output must be fixture-equal to the TS reference for every iOS-0 fixture.

**Non-goals**:
- No new recommendation logic. Swift mirrors TS V2 verbatim.
- No alternate "lightweight" recommendation path.
- No reading raw `AppData` — input is `CleanAppDataView` only (enforced by static guard, matching `TrainingDecision Clean Input Contract Lock V1`).
- No deletions / additions to the signal engine set without a separate planning PR.
- No popup UI for decision results.

**Likely files / project area**:
- `ios/IronPath/Decision/TrainingDecisionEngine.swift`, `TrainingDecisionContext.swift` (branded factory matching the TS lock).
- `ios/IronPath/Decision/Signals/` — one Swift file per signal in the TS V2 set: EffectivePhase, Lapse, Readiness, DailyAdjustment, Recovery, VolumeAdaptation, Adherence, SupportPlanBudget.
- `ios/IronPath/Decision/UserFacing/DecisionUserFacing.swift`.
- `ios/IronPathTests/TrainingDecisionSwiftPortTests.swift`, `TrainingDecisionCleanInputContractTests.swift`, `TrainingDecisionSignalParityTests.swift`.
- `docs/ios-native-migration/IOS_4_TRAINING_DECISION_SWIFT_PORT_V1.md`.

**Dependencies**:
- iOS-3 merged.
- iOS-2 merged.
- iOS-0 fixtures include TrainingDecision expected outputs.

**Acceptance criteria**:
- `TrainingDecisionEngine.run(cleanView:nowIso:)` JSON equals `tests/fixtures/ios-contract/trainingDecision-v1.json` for every fixture.
- Input is branded `TrainingDecisionContext` (factory-only construction; mirrors the TS lock).
- No Swift file under `ios/IronPath/Decision/` reads `AppData` directly — static guard.
- No Swift file imports a name from the hard-deleted TS legacy set (e.g. `weeklyProgressionRecommendationEngine`, `postWorkoutNextTimeRecommendationEngine`) — grep guard.
- Pure: no I/O, no clock except injected `nowIso`, no `UserDefaults`, no Supabase — static guard on imports.

**Tests** (named):
- `TrainingDecisionSwiftPortTests.swift` — fixture-equal JSON output for every iOS-0 fixture.
- `TrainingDecisionCleanInputContractTests.swift` — `.run` rejects raw `AppData`; `TrainingDecisionContext` only constructible via factory; factory rejects input where the cleaned view's `legacyAdviceIsolated` flag is false.
- `TrainingDecisionSignalParityTests.swift` — fixture parity test per signal engine.
- `tests/iosTrainingDecisionSwiftPortStaticGuards.test.ts` — no `AppData` import under `ios/IronPath/Decision/`; no deleted-TS legacy engine names; every TS V2 signal has a Swift sibling.

**Manual iPhone smoke**: Boot with the iOS-0 fixture seeded; trigger the decision pipeline via a debug-only screen (placeholder UI acceptable); confirm output JSON matches the TS expected output.

**Risks**:
- Numeric precision drift (Double vs Number). Mitigation: every numeric output is rounded to a documented precision before comparison; fixture has the same rounding.
- Date arithmetic drift. Mitigation: every date operation goes through a single `DateMath` utility with a Swift / TS parity test.
- Legacy reintroduction: someone might add a "convenience text" field to the Swift decision engine. **Resisted**: static guard test on the public output struct shape.
- Premature SwiftData: do not store decision output to disk via SwiftData. It is recomputed every read.

**Merge / release rule**:
- One PR.
- Title: `iOS-4 TrainingDecision Swift Port V1`.
- Must include `docs/ios-native-migration/IOS_4_TRAINING_DECISION_SWIFT_PORT_V1.md`.
- Suggested follow-up: `IOS_4_TRAINING_DECISION_SWIFT_LOCK_V1.md` (lock doc) once the port stabilizes.
- No `--admin` merge.
- iOS-5 may proceed in parallel with iOS-6 once this is merged.

---

### iOS-5 — Native Focus Mode MVP V1

**Goal**: Build the native Focus Mode screen (the workout-execution screen) end-to-end so a user can log a set on a real iPhone. This is the earliest-usable-iPhone-build milestone (see §6).

**Non-goals**:
- No multi-device sync (iOS-7).
- No HealthKit (iOS-8).
- No cloud restore (iOS-7).
- No analytics SDK.
- No "polish" features (haptics tuning, sound cues, picture-in-picture). MVP only.
- No legacy advice text rendered in Focus Mode — same `legacyFinalAdviceIsolationGuardV1` rule as the TS app.
- No reading raw `AppData` in the UI layer — only `CleanAppDataView` projections.

**Likely files / project area**:
- `ios/IronPath/Features/Focus/` — `FocusModeView.swift`, `FocusModeViewModel.swift`, `FocusModeStateEngine.swift` (port of `src/engines/focusModeStateEngine.ts`), `SessionBuilder.swift`, `SetEntryRow.swift`, `RestTimerView.swift`, `FinalizeSessionAction.swift` (port of `finalizeTrainingSession`).
- `ios/IronPath/Storage/AppDataStore.swift` — file-system AppData read/write (atomic write-and-rename, no SwiftData).
- `ios/IronPathTests/FocusModeStateEngineSwiftPortTests.swift`, `FocusModeSessionFinalizeTests.swift`, `AppDataStoreRoundTripTests.swift`.
- `docs/ios-native-migration/IOS_5_NATIVE_FOCUS_MODE_MVP_V1.md`.

**Dependencies**:
- iOS-3 merged.
- iOS-4 merged (Focus Mode reads decision output for warmup / set targets).
- iOS-2 merged.

**Acceptance criteria**:
- On a real iPhone: launch → placeholder day-plan → Start Focus → log warmup + working sets (weight + reps + RIR) → finalize. Session persists via `AppDataStore` (file system) and survives kill/relaunch.
- Set IDs follow TS derivation (`main:${exerciseId}:warmup:0`, etc.) — Swift unit-test verified.
- Finalize writes per-set `completionStatus`, per-exercise `completionStatus`, and (if ended early) `earlyEndReason='incomplete_main_work'` — same shape as TS `finalizeTrainingSession`.
- Focus Mode never renders legacy advice fields (`exercise.suggestion / adjustment / warning`, `prescription.weeklyAdjustment`, `session.explanations`, `session.deloadDecision`) — grep guard.
- State uses Swift `Combine` / `Observation`; no third-party state library.

**Tests** (named):
- `FocusModeStateEngineSwiftPortTests.swift` — fixture parity with TS `focusModeStateEngine` for a canned active session.
- `FocusModeSessionFinalizeTests.swift` — full-completion path: no `earlyEndReason`; end-early path: `earlyEndReason='incomplete_main_work'`; per-set `completionStatus` correct.
- `AppDataStoreRoundTripTests.swift` — atomic file-system round-trip.
- `tests/iosFocusModeStaticGuards.test.ts` — no legacy-advice field references under `Features/Focus/`; `AppDataStore` is the only AppData writer.

**Manual iPhone smoke** (THIS IS THE CRITICAL ONE — see §6):
1. Build for a real iPhone (developer signing).
2. Launch the app.
3. Start a workout session from the placeholder day-plan.
4. Log 1 warmup set: weight 60, reps 5, RIR 4.
5. Log 1 working set: weight 80, reps 8, RIR 2.
6. End the session as "completed".
7. Close and re-open the app.
8. Confirm the session appears in history with the correct values.
9. Confirm the data-health repair count is 0 new repairs.
10. Confirm no crash, no console error.

**Risks**:
- Persistence choice — V1 uses file-system JSON; SwiftData is a V2 decision.
- Active-session crash recovery — atomic write-and-rename in `AppDataStore`; static guard on the write path.
- Set-ID collision with TS-restored sessions — covered by `duplicateSetIdAuditV1` (audit-only, no rewrite).
- Background timer — store `startedAt` timestamp, compute elapsed on foreground.
- Premature multi-device sync — no cloud upload trigger on session finalize.

**Merge / release rule**:
- One PR.
- Title: `iOS-5 Native Focus Mode MVP V1`.
- Must include `docs/ios-native-migration/IOS_5_NATIVE_FOCUS_MODE_MVP_V1.md`.
- No `--admin` merge.
- This is the **earliest usable iPhone build** — see §6.

---

### iOS-6 — Plan / History / Progress Native Screens V1

**Goal**: Build the read-only native screens (Plan, History, Progress) so the user can see their day plan, browse historical sessions, and view PR / e1RM charts on iPhone. Can ship in parallel with iOS-5 once iOS-4 is green.

**Non-goals**:
- No editing affordances. Read-only V1.
- No "Record Edit" / data-flag screens (these are V2 work).
- No analytics SDK, no Sentry.
- No legacy advice text rendering.
- No HealthKit chart overlays (iOS-8).
- No cloud sync UI (iOS-7).

**Likely files / project area**:
- `ios/IronPath/Features/Plan/` — `PlanView.swift`, `PlanViewModel.swift`.
- `ios/IronPath/Features/History/` — `HistoryListView.swift`, `HistorySessionDetailView.swift`.
- `ios/IronPath/Features/Progress/` — `ProgressView.swift`, `E1RMChart.swift`, `PRListView.swift`.
- `ios/IronPath/Decision/Presenters/DecisionUserFacingPresenter.swift` — Swift mirror of the TS `decision.userFacing.*` presenter contract.
- `ios/IronPathTests/PlanViewPresenterTests.swift`, `HistoryListViewModelTests.swift`, `ProgressChartDataTests.swift`.
- `docs/ios-native-migration/IOS_6_PLAN_HISTORY_PROGRESS_NATIVE_SCREENS_V1.md`.

**Dependencies**:
- iOS-4 merged.
- iOS-3 merged.
- iOS-2 merged.

**Acceptance criteria**:
- Plan screen renders next-session prescription using only `decision.userFacing.*`.
- History list shows every finalized session sorted newest first; detail screen matches TS effective-set count, volume, and partial-completion badge for the same fixture.
- Progress shows e1RM trend + PR list using the `e1rmEngine` Swift port (or — V1.5 fallback — reads the iOS-0 fixture directly if Agent 5 defers the port).
- No Swift file in `ios/IronPath/Features/` reads raw `AppData` — only `CleanAppDataView`.
- No screen displays legacy advice text — grep guard.
- Three screens render correctly in dark + light mode with no color-contrast regression vs TS PWA.

**Tests** (named):
- `ios/IronPathTests/PlanViewPresenterTests.swift` — given a fixture, presenter output matches expected.
- `ios/IronPathTests/HistoryListViewModelTests.swift` — given a fixture, the list ordering and per-session badges match expected.
- `ios/IronPathTests/ProgressChartDataTests.swift` — given a fixture, the chart series and PR list match expected.
- `tests/iosReadOnlyScreensStaticGuards.test.ts` (new, TS side) — grep guard: (a) no Swift file in `ios/IronPath/Features/Plan|History|Progress` reads `AppData.exercises[].suggestion` etc.; (b) every screen uses `CleanAppDataView` or `decision.userFacing.*`.

**Manual iPhone smoke**: Boot with iOS-0 fixture seeded → navigate Plan / History / Progress. Confirm partial-completion badge appears on 2 partial fixture sessions (matches TS); e1RM chart renders for at least one exercise (e.g. `lat-pulldown`); no crash, no console error.

**Risks**:
- Charting — SwiftUI Charts (iOS 16+) is the choice; min iOS target locked in iOS-1.
- Over-scoping — V1 is strictly read-only; no edit/delete affordances.
- Premature i18n — match the TS app's existing zh/en mix; no new translation system.
- Premature a11y ramp-up — V1 ships VoiceOver labels on interactive elements; custom rotor / audio descriptions deferred.

**Merge / release rule**:
- One PR.
- Title: `iOS-6 Plan / History / Progress Native Screens V1`.
- Must include `docs/ios-native-migration/IOS_6_PLAN_HISTORY_PROGRESS_NATIVE_SCREENS_V1.md`.
- No `--admin` merge.
- iOS-5 and iOS-6 can both ship before iOS-7.

---

### iOS-7 — Explicit Cloud Sync iOS V1

**Goal**: Port the TS V3/V4/V5 cloud sync contract to iOS — explicit user action only, no background sync, no silent overwrite, no fake success. The iOS app reuses the same Supabase backend and the same `cloud_appdata_snapshots` table.

**Non-goals**:
- No background sync. Period.
- No silent overwrite of cloud snapshots on conflict.
- No automatic conflict resolution. Conflicts surface as an explicit UI choice.
- No multi-device merge logic — the V1 contract on TS is "last writer wins after explicit user choice".
- No CloudKit. The cloud backend is Supabase, same as the TS app.
- No partial-AppData upload — the upload-eligibility guard rejects partially-repaired data.
- No analytics SDK.

**Likely files / project area**:
- `ios/IronPath/Cloud/` — `CloudSyncService.swift`, `CloudUploadEligibilityGuard.swift` (Swift mirror of `uploadEligibilityGuard.ts`), `CloudUploadOrchestrator.swift` (Swift mirror of `runProductionFullAcceptanceSync`), `CloudConflictResolver.swift` (explicit user choice), `SupabaseClient.swift` (plain `URLSession` + `Codable`, NO `supabase-swift` SDK in V1).
- `ios/IronPath/Features/Settings/CloudSyncSettingsView.swift`.
- `ios/IronPathTests/CloudUploadEligibilityGuardTests.swift`, `CloudConflictResolverTests.swift`, `CloudSyncOptimisticConcurrencyTests.swift`, `CloudSubsequentUploadFlowTests.swift`.
- `docs/ios-native-migration/IOS_7_EXPLICIT_CLOUD_SYNC_V1.md` and follow-up `IOS_7_EXPLICIT_CLOUD_SYNC_LOCK_V1.md`.

**Dependencies**:
- iOS-5 merged (so there is local data to upload).
- iOS-3 merged (so eligibility guard is available).
- iOS-6 merged (so users have a UI to see what they're uploading).

**Acceptance criteria**:
- Upload happens ONLY on explicit "Upload to Cloud" tap — no automatic upload.
- Upload blocked when `CloudUploadEligibilityGuard.evaluate(appData:)` returns `ok=false` — passive status with reason.
- Conflict detection: client does fresh cloud-snapshot read before upload (matches V5 fresh-read preflight). If cloud is ahead, explicit "Overwrite cloud" / "Keep cloud, discard local" / "Cancel" choice. No silent merge.
- Restore (download): explicit "Restore from Cloud" tap → `AppDataIngressPipeline.processIncoming` runs on downloaded snapshot before persisting.
- Wire-contract identical to TS V5 (same JSON shape, column names, RLS rules).
- No offline-write capability — uploads only when device is online.

**Tests** (named):
- `ios/IronPathTests/CloudUploadEligibilityGuardTests.swift` — port every TS test in `tests/uploadEligibilityGuard*.test.ts`.
- `ios/IronPathTests/CloudConflictResolverTests.swift` — covers all 3 user choices.
- `ios/IronPathTests/CloudSyncOptimisticConcurrencyTests.swift` — port `tests/cloudOptimisticConcurrencyV5Behavior.test.ts`.
- `ios/IronPathTests/CloudSubsequentUploadFlowTests.swift` — port `tests/cloudSubsequentUploadFlowBehavior.test.ts`.
- `tests/iosCloudSyncStaticGuards.test.ts` (new, TS side) — grep guard: (a) no Swift file under `ios/IronPath/Cloud/` schedules a background task; (b) no Swift file imports `BackgroundTasks` framework; (c) every upload call site imports `CloudUploadEligibilityGuard`.

**Manual iPhone smoke**:
1. Log in via Supabase auth.
2. Run a session on iOS, finalize, tap "Upload to Cloud" — succeeds.
3. From PWA on a second device, run + upload a different session.
4. Tap "Upload to Cloud" on iOS again — conflict UI surfaces; verify all three choices (Cancel / Overwrite / Keep cloud).
5. Tap "Restore from Cloud" — local AppData replaced after ingress pipeline; zero new Data Health repairs.

**Risks**:
- Auth — V1 uses Supabase email magic link via `SFSafariViewController`; no biometric / Sign-In-with-Apple (V2).
- Token refresh — refresh on cold start; if refresh fails, prompt re-auth (no silent logout).
- Premature background sync — `BackgroundTasks` framework forbidden by static guard.
- Premature CloudKit — V1 is Supabase only.
- App Store review — remote-server use disclosed in iOS-10 nutrition label and reviewer notes.

**Merge / release rule**:
- One PR for V1, one PR for the lock doc.
- Title: `iOS-7 Explicit Cloud Sync iOS V1`.
- Must include `docs/ios-native-migration/IOS_7_EXPLICIT_CLOUD_SYNC_V1.md`.
- No `--admin` merge.
- iOS-8 may proceed in parallel with iOS-7 once iOS-5 is merged.

---

### iOS-8 — HealthKit Adapter V1

**Goal**: Add a HealthKit read-only adapter so the iOS app can pull body weight / heart-rate samples into AppData for readiness scoring. Read-only — no write-back.

**Non-goals**:
- **No HealthKit write permission requested.** Read-only V1. (See stop conditions.)
- No background HealthKit observation. Read on app foreground only.
- No "Apple Watch companion app" — V1 is iPhone only.
- No new readiness logic — the data feeds existing `staleHealthReadinessGuardV1` and existing readiness signals.
- No analytics SDK.

**Likely files / project area**:
- `ios/IronPath/HealthKit/` — `HealthKitAdapter.swift`, `HealthKitImporter.swift` (converts HealthKit samples to AppData's `appleHealthData` shape), `HealthKitPermissionsView.swift`.
- `ios/IronPath/Info.plist` — add `NSHealthShareUsageDescription` ONLY. NO `NSHealthUpdateUsageDescription`.
- `ios/IronPath.xcodeproj/project.pbxproj` — add HealthKit capability (read-only; no background delivery).
- `ios/IronPathTests/HealthKitImporterTests.swift`, `HealthKitPermissionFlowTests.swift`.
- `docs/ios-native-migration/IOS_8_HEALTHKIT_ADAPTER_V1.md`.

**Dependencies**:
- iOS-5 merged.
- iOS-3 merged (uses `staleHealthReadinessGuardV1`).

**Acceptance criteria**:
- "Connect HealthKit" tap → permission sheet asks ONLY for read scopes (body mass, HR, resting HR, HRV).
- Permission is NOT requested at app launch — only on explicit opt-in (matches PWA pattern of explicit user action).
- Foreground refresh pulls last 14 days into `AppData.appleHealthData` and triggers the data-health pipeline.
- Denied permission → app still works using subjective inputs.
- Info.plist contains ONLY `NSHealthShareUsageDescription` (NO `NSHealthUpdateUsageDescription`). Entitlements do NOT enable `com.apple.developer.healthkit.background-delivery`. Both enforced by static guards.

**Tests** (named):
- `ios/IronPathTests/HealthKitImporterTests.swift` — given mock HealthKit samples, the importer produces an `appleHealthData` shape that matches the TS schema.
- `ios/IronPathTests/HealthKitPermissionFlowTests.swift` — UI test that confirms the permission sheet text and scopes.
- `tests/iosHealthKitStaticGuards.test.ts` (new, TS side) — grep guard: (a) `Info.plist` does NOT contain `NSHealthUpdateUsageDescription`; (b) entitlements file does NOT enable background delivery; (c) no Swift file calls `HKHealthStore.requestAuthorization` with a write toType.

**Manual iPhone smoke**: On a real iPhone with HealthKit populated (body weight, HR from Apple Watch) tap "Connect HealthKit" — system sheet shows only read scopes; approve → readiness screen uses imported data. On a second device, deny permission → app still functions. Verify `staleHealthReadinessGuardV1` marks > 14d-old samples correctly.

**Risks**:
- App Store review on HealthKit copy — descriptions reviewed in iOS-10.
- Background delivery — forbidden by stop condition #8 + static guard.
- Write-back — forbidden by stop condition #8 + Info.plist guard.
- Multi-device HealthKit — V1 is iPhone-only; no cross-device merge.

**Merge / release rule**:
- One PR.
- Title: `iOS-8 HealthKit Adapter V1`.
- Must include `docs/ios-native-migration/IOS_8_HEALTHKIT_ADAPTER_V1.md`.
- No `--admin` merge.

---

### iOS-9 — TestFlight Internal Acceptance V1

**Goal**: Submit the iOS app to TestFlight for internal acceptance testing. The deliverable is a checklist of green gates and a TestFlight build link.

**Non-goals**:
- No public TestFlight beta yet.
- No App Store submission (iOS-10).
- No new feature work.
- No analytics SDK.

**Likely files / project area**:
- `docs/ios-native-migration/IOS_9_TESTFLIGHT_INTERNAL_ACCEPTANCE_V1.md` (new).
- `docs/ios-native-migration/IOS_9_TESTFLIGHT_TEST_PLAN.md` (new).
- No code changes beyond version bump in `ios/IronPath/Info.plist`.

**Dependencies**:
- iOS-5 merged.
- iOS-6 merged.
- iOS-7 merged.
- iOS-8 merged.
- iOS-3 merged.
- iOS-4 merged.

**Acceptance criteria** (the pre-TestFlight gate — see §7):
- All iOS-0 through iOS-8 PRs merged.
- Full Swift test suite green; full TS test suite green; all `tests/ios*StaticGuards.test.ts` green.
- App builds in Release config with zero warnings.
- Real-iPhone end-to-end smoke run: cold-start → log a full workout (1 warmup + 3 working sets across 3 exercises) → end normally → verify in History → Upload to Cloud → Restore from Cloud on a freshly-installed instance → HealthKit permission flow (read-only).
- No crash logs in Xcode Organizer for the test build.
- App Store Connect upload succeeds; TestFlight build distributed to the internal testers group.
- Internal testers complete the 15+ scenario test plan in `IOS_9_TESTFLIGHT_TEST_PLAN.md`.

**Tests** (named):
- All Swift unit tests under `ios/IronPathTests/`.
- All TS static guards under `tests/ios*StaticGuards.test.ts`.
- Manual test plan checklist in `IOS_9_TESTFLIGHT_TEST_PLAN.md` — 15+ scenarios, all checked.

**Manual iPhone smoke**: The full TestFlight test plan, run on 3+ real iPhones (different iOS versions: 17, 18 if available).

**Risks**:
- ASC upload rejection — dry-run with `xcrun altool` before the official upload.
- HealthKit permission misconfiguration — iOS-8 static guards.
- Cold-launch crash with empty AppData — iOS-5 empty-AppData smoke test.
- TS / Swift output drift at scale — TestFlight test plan compares PWA + iOS history on the same account.

**Merge / release rule**:
- One PR (docs only — the deliverable IS the TestFlight build, the PR just records the gate).
- Title: `iOS-9 TestFlight Internal Acceptance V1`.
- Must include both `IOS_9_TESTFLIGHT_INTERNAL_ACCEPTANCE_V1.md` and `IOS_9_TESTFLIGHT_TEST_PLAN.md`.
- No `--admin` merge.
- iOS-10 may NOT open until this PR is merged AND the TestFlight build has passed the internal test plan.

---

### iOS-10 — App Store Readiness V1

**Goal**: Submit the iOS app to the public App Store for review. The deliverable is the App Store Connect listing, the privacy nutrition label, the marketing copy, and the screenshot set.

**Non-goals**:
- No new feature work.
- No new SDK additions.
- No analytics SDK.
- No new HealthKit scopes.
- No CloudKit.
- No subscription / IAP in V1 (free-to-use, matching the PWA).
- No localization beyond Chinese + English in V1.

**Likely files / project area**:
- `docs/ios-native-migration/IOS_10_APP_STORE_READINESS_V1.md` (new) — checklist + reviewer-facing notes.
- `docs/ios-native-migration/IOS_10_APP_STORE_PRIVACY_NUTRITION_LABEL.md` (new).
- `docs/ios-native-migration/IOS_10_APP_STORE_REVIEWER_NOTES.md` (new) — explains HealthKit usage in detail to head off rejection.
- `docs/ios-native-migration/IOS_10_APP_STORE_SCREENSHOTS_PLAN.md` (new).
- `ios/IronPath/Info.plist` — version + build number bumps.

**Dependencies**:
- iOS-9 merged.
- TestFlight internal acceptance passed.

**Acceptance criteria** (the pre-App-Store gate — see §8):
- iOS-9 acceptance passed.
- App Store Connect listing complete: name, subtitle, description, keywords, category (Health & Fitness), age rating, marketing/support URLs, screenshots for iPhone 6.5" + 6.7".
- Privacy nutrition label accurately reflects: Health & Fitness data read from HealthKit (NOT linked to identity, processed on-device); Identifiers — email (linked); User Content — workout data (linked, used to provide service); NO third-party analytics / crash / advertising.
- Reviewer notes explain HealthKit usage in plain language with scopes + user benefit.
- 3+ internal testers, 7+ days in TestFlight, zero critical bugs.
- All 11 stop conditions in §9 are green.
- Marketing copy reviewed by program owner; submission reaches "Waiting for Review".

**Tests** (named):
- All prior tests still green.
- `tests/iosAppStoreReadinessStaticGuards.test.ts` (new) — asserts: (a) no `NSHealthUpdateUsageDescription` in Info.plist; (b) no analytics SDK imports anywhere; (c) the privacy nutrition label doc lists no advertising data; (d) the reviewer notes doc exists.

**Manual iPhone smoke**: Install final TestFlight build on 3+ devices → run full test plan once more → zero new Data Health repairs → one full end-to-end pass (login → log workout → upload → cloud restore on second device) → ASC submission reaches "Waiting for Review".

**Risks**:
- HealthKit rejection — most common fitness-app rejection cause; reviewer notes doc is explicit.
- "Background sync without disclosure" — N/A in V1 (no background sync); static guards confirm.
- Marketing copy vs nutrition label mismatch — program owner final review.
- "Duplicates existing app" rejection if PWA is listed — confirm unique bundle ID in App Store Connect.
- Cloud sync rejection over hardcoded Supabase URL — reviewer notes explain.

**Merge / release rule**:
- One PR (docs only).
- Title: `iOS-10 App Store Readiness V1`.
- Must include all four docs above.
- No `--admin` merge.
- Submission to App Review is gated on this PR being merged AND the program owner explicitly approving the submission.

---

## 5. Sequencing diagram

```
                                          iOS-0
                                  (Contract Fixture Export V1)
                                            │
                                            ▼
                                          iOS-1
                                  (Xcode Project Bootstrap V1)
                                            │
                                            ▼
                                          iOS-2
                                   (AppData Swift Models V1)
                                            │
                            ┌───────────────┴───────────────┐
                            ▼                               ▼
                          iOS-3                          (iOS-2 also enables iOS-4
                  (Data Health Swift                       but iOS-4 needs iOS-3 too)
                       Port V1)
                            │
                            ▼
                          iOS-4
                  (TrainingDecision
                    Swift Port V1)
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
              iOS-5                   iOS-6
        (Native Focus Mode      (Plan / History /
            MVP V1)              Progress Native
                │                   Screens V1)
                │                       │
                └───────────┬───────────┘
                            ▼
                ┌───────────┴───────────┐
                ▼                       ▼
              iOS-7                   iOS-8
       (Explicit Cloud           (HealthKit
         Sync iOS V1)             Adapter V1)
                │                       │
                └───────────┬───────────┘
                            ▼
                          iOS-9
                  (TestFlight Internal
                    Acceptance V1)
                            │
                            ▼
                         iOS-10
                  (App Store Readiness V1)
                            │
                            ▼
                       [App Review]
                            │
                            ▼
                       [Public App Store]
```

### Parallelization rules

- iOS-0 → iOS-1 → iOS-2 are STRICTLY sequential. No parallelization.
- iOS-3 and iOS-4 can be opened in parallel ONCE iOS-2 is merged, BUT iOS-4 cannot merge until iOS-3 is merged (iOS-4 imports `CleanAppDataView` from iOS-3).
- iOS-5 and iOS-6 can be developed in parallel ONCE iOS-4 is merged. Both must merge before iOS-9 starts.
- iOS-7 and iOS-8 can be developed in parallel ONCE iOS-5 is merged.
- iOS-9 is strictly after iOS-3 + iOS-4 + iOS-5 + iOS-6 + iOS-7 + iOS-8 all merged.
- iOS-10 is strictly after iOS-9 merged.

### What cannot parallelize, ever

- Two PRs touching `ios/IronPath/Models/` at the same time. The model layer is a single point of contention; serialize.
- Two PRs touching `ios/IronPath/DataHealth/` at the same time. Same reason.
- Two PRs touching `ios/IronPath/Cloud/` at the same time.

---

## 6. Earliest usable iPhone build

**Definition**: A build the user can install on their personal iPhone via TestFlight (or developer signing for sideload) and use to log a real workout end-to-end on real hardware, with the same correctness guarantees as the TS PWA.

**Composition**: iOS-0 + iOS-1 + iOS-2 + iOS-3 + iOS-4 + iOS-5.

**Reasoning**:
- iOS-0: the fixture export is the only way to test-drive parity.
- iOS-1: gives us a project to build.
- iOS-2: gives us models to round-trip.
- iOS-3: gives us a Runtime Guard so the user's existing dirty AppData doesn't poison the experience on first launch.
- iOS-4: gives us a working day-plan / set-target prescription via TrainingDecision.
- iOS-5: gives us the Focus Mode screen — the place where the user actually logs sets.

**NOT required for earliest usable build**:
- iOS-6 (Plan / History / Progress): nice-to-have but not blocking the "log a set" demo. The user can verify the session in History after closing and re-opening the app via a debug-only history dump.
- iOS-7 (Cloud Sync): the earliest usable build is local-only. The user can manually export AppData via the TS PWA, import to iOS via a debug-only "paste JSON" affordance (NOT shipped to TestFlight — dev only).
- iOS-8 (HealthKit): subjective readiness inputs only. No HealthKit needed.
- iOS-9 / iOS-10: TestFlight / App Store are for distribution, not for the user's personal use.

**Acceptance smoke for the earliest usable build**:
1. Open the iOS app on a real iPhone after `iOS-5` is merged.
2. Confirm the day-plan screen shows next-session prescription (from TrainingDecision V2).
3. Tap "Start" — enter Focus Mode.
4. Log 1 warmup set + 2 working sets across at least 2 exercises.
5. End the session normally.
6. Close the app, kill it from the app switcher.
7. Re-open — confirm AppData persists, the session appears in history (debug-only history dump is acceptable at this stage), no data-health repair issues are surfaced.

This milestone is the program-level gate for "the iOS rewrite is real, not theoretical". If we cannot reach it within the timeline budget, that triggers a stop condition (§9).

---

## 7. Pre-TestFlight gate

Before opening iOS-9, ALL of the following MUST be green:

1. **iOS-0 through iOS-8 all merged** to `main` via standard PR flow. No `--admin`, no `--no-verify`, no branch-protection bypass.
2. **TS test suite green**: `npm run typecheck && npm test && npm run build` returns 0.
3. **Swift test suite green**: `xcodebuild test -project ios/IronPath.xcodeproj -scheme IronPath -destination 'platform=iOS Simulator,name=iPhone 15'` returns 0.
4. **All `tests/ios*StaticGuards.test.ts` green** — these enforce:
   - No analytics SDK imports.
   - No background sync framework imports.
   - No HealthKit write capability.
   - No raw `AppData` reads in UI / Decision / Cloud layers.
   - No legacy advice field reads in UI.
   - No `--admin` merge anywhere in the iOS PR history (CI log scan).
5. **Cold-start smoke on a real iPhone**: log a full session, finalize, kill app, re-open, confirm history persists.
6. **Cloud round-trip smoke**: upload from iOS, download to TS PWA, compare AppData hash — equal.
7. **HealthKit permission smoke**: deny + approve paths both succeed without crash.
8. **Data Health smoke**: cold-boot with a seeded fixture, confirm the same repair counts as the TS PWA.
9. **No new `*_PLAN.md` open without an `_V1.md` companion**: every iOS-N task that shipped must have BOTH a plan doc and a delivered doc, in the same cadence as `docs/CLOUD_OPTIMISTIC_CONCURRENCY_V5*.md`.
10. **Stop conditions check**: every one of the 11 stop conditions in §9 is verified to NOT apply.
11. **Program owner approval**: explicit written sign-off on the iOS-9 PR.

If any one of these is amber/red, the gate is closed.

---

## 8. Pre-App-Store gate

Before submitting to App Review (the iOS-10 deliverable), ALL of the following MUST be green:

1. **iOS-9 TestFlight internal acceptance passed**: 3+ testers, 7+ days, zero critical bugs.
2. **All pre-TestFlight gate items still green** (re-verify; nothing regressed).
3. **Privacy nutrition label complete and accurate**:
   - Health & Fitness data: read from HealthKit. NOT linked to user identity in V1.
   - Identifiers: email. Linked to user identity.
   - User Content: workout data. Linked to user identity.
   - **No advertising data. No third-party analytics. No tracking.**
4. **App Store reviewer notes**:
   - Explain HealthKit scopes in plain language.
   - Cite each scope's user benefit.
   - State explicitly that HealthKit data is read-only and processed on-device.
   - State explicitly that cloud sync is opt-in and explicit, not background.
5. **Marketing copy reviewed by program owner**.
6. **Screenshots produced for iPhone 6.5" and 6.7"** at minimum.
7. **Bundle ID confirmed unique** in App Store Connect (no PWA collision).
8. **App icon meets Apple HIG** (no transparency, no rounded corners pre-applied, all required sizes).
9. **Support URL and Marketing URL both reachable** and contain accurate IronPath information.
10. **No `--admin` merge in the iOS PR history**.
11. **Program owner explicit sign-off** on the submission PR.

If any one is red, the gate is closed and the submission is delayed until it goes green.

---

## 9. Stop conditions

These are the explicit halt-and-rethink triggers. Each one must appear verbatim in the final roadmap and is enforced by static tests, code review, or human gate at every PR.

1. **iOS V1 MUST NOT ship a WebView wrapper of the existing PWA as its final architecture.** A WebView is acceptable ONLY as a dev-only escape hatch (e.g. a debug-only "open PWA in WKWebView" affordance for testing) and MUST NOT be shipped to TestFlight or the App Store as a primary feature. Static guard: no `WKWebView` import in `ios/IronPath/Features/`.
2. **iOS V1 MUST NOT enable background sync by default.** No `BGTaskScheduler` registration. No `applicationDidEnterBackground` upload trigger. No "auto-sync on plug-in" feature. Static guard: no import of the `BackgroundTasks` framework in `ios/IronPath/`.
3. **iOS V1 MUST NOT feed raw AppData into TrainingDecision — only CleanAppDataView equivalents.** Enforced by Swift compile-time type contract (`TrainingDecisionContext` is branded) and by static guard test on imports under `ios/IronPath/Decision/`.
4. **iOS V1 MUST NOT upload partially-repaired AppData.** Every upload call site must consult `CloudUploadEligibilityGuard.evaluate` first. Enforced by static guard.
5. **iOS V1 MUST NOT silently overwrite cloud snapshots on conflict.** Conflicts surface an explicit user choice. Enforced by `CloudConflictResolverTests` and by static guard that every upload call goes through `CloudConflictResolver`.
6. **DO NOT create an Xcode project before iOS-0 Contract Fixture Export V1 is green.** iOS-1 PR opens ONLY after iOS-0 is merged. Enforced by PR linkage (iOS-1 PR body must cite the iOS-0 merge SHA).
7. **DO NOT add Sentry / Crashlytics / analytics SDKs without explicit user approval.** Static guard test greps for `Sentry`, `Crashlytics`, `Firebase`, `Mixpanel`, `Amplitude`, `Segment` (case-insensitive) in `ios/` and fails if any are found.
8. **DO NOT request HealthKit write permission unless a feature actually writes back.** Info.plist must not contain `NSHealthUpdateUsageDescription` in V1. Entitlements must not enable `com.apple.developer.healthkit.background-delivery`. Enforced by static guard.
9. **DO NOT introduce SwiftData / Core Data in iOS-1 through iOS-3.** Persistence in V1 is file-system JSON. The decision to adopt SwiftData (if ever) is a separate V2 task with its own planning doc.
10. **DO NOT add third-party Swift packages without explicit user approval.** No SwiftPM dependency, no CocoaPods, no Carthage. The V1 baseline is Apple's standard frameworks + plain `URLSession` for Supabase REST.
11. **DO NOT skip the planning doc for iOS-2 through iOS-8.** Each one MUST have a `docs/ios-native-migration/IOS_N_*_PLAN.md` merged before its implementation PR opens. Matches the team's existing cadence.

### When a stop condition trips

If a stop condition trips during a PR review:
- The PR is blocked.
- A new planning PR is opened in the form of `docs/ios-native-migration/IOS_N_*_STOP_CONDITION_*.md` explaining the trigger.
- The program owner decides whether to revise the stop condition (rare) or revise the offending PR (default).
- No code merges until the stop condition is reconciled.

---

## 10. Merge / deploy / test rules

These apply to EVERY iOS-N PR.

### 10.1 Per-PR pre-merge checklist

- PR title is `iOS-N <Feature> V1` (or V1.5 / V2 etc.); PR body cites its planning doc by path.
- If a data-health surface is touched (iOS-3 specifically), the PR body answers the 10 questions in `docs/DATA_REPAIR_POLICY.md`.
- Local: `npm run typecheck`, `npm test`, `npm run build` all pass.
- Local: `xcodebuild build` (iOS-1+) and `xcodebuild test` (iOS-2+) pass.
- Every new Swift file is `Codable`-clean where applicable, has no force-unwraps outside tests, and has at least one paired unit test.
- No `--admin` merge, no `--no-verify`, no branch-protection bypass.
- No new third-party dependency, no new HealthKit scope, no new analytics SDK, no `BackgroundTasks` import.
- All `tests/ios*StaticGuards.test.ts` green.
- The PR does not touch the existing TS runtime (`src/`, `apps/api/src/`, `tests/`) except for the contract fixture export (iOS-0) and static guard tests.
- Stop conditions in §9 re-checked.

### 10.2 Deploy rules

- The iOS app is never auto-deployed from `main` to TestFlight. Deployment is explicit, manual, and gated on a separate `iOS-N <Feature> V1 — Release.md` doc.
- The TS PWA continues to deploy from `main` via the existing Vercel flow. The iOS work does NOT change the PWA deploy pipeline.
- Supabase schema changes (none expected in V1) follow the existing `supabase/` migration flow.

### 10.3 Test rules

- TS-side: every iOS task adds at least one TS-side static guard test under `tests/ios*StaticGuards.test.ts`. This ensures the TS test suite blocks regressions in the iOS contract (e.g. someone removes a fixture, someone adds a forbidden SDK, someone enables background sync).
- Swift-side: every iOS task adds at least one Swift unit test under `ios/IronPathTests/`.
- Fixture-driven: every behavioral test uses the iOS-0 fixture set as the source of truth.
- Manual iPhone smoke: every iOS-N task has at least one manual iPhone smoke step. Tests on simulator alone are insufficient for iOS-5 onward.
- No skipped tests in the merged state. Skipped tests must have an open issue tracking their resolution.

### 10.4 Rollback rules

- If iOS-9 TestFlight reveals a P0 bug, the affected iOS-N PR is reverted and re-opened with the fix.
- If iOS-10 App Review rejects the app, the rejection reason is mapped to one of the stop conditions in §9 OR a new task is opened (`iOS-10.1 <Fix> V1`).
- No "fix forward" via `--admin` merge to bypass the test suite. Ever.

---

## 11. Program-level risks

### 11.1 Over-scoping V1
Team ships V1 → V2 → V3 progressions; iOS has 11 V1 tasks. Temptation: land a "V1.5" feature (e.g. rest timer with HealthKit HR overlay) that delays App Store. **Mitigation**: every V1 task has explicit non-goals. Anything outside them is a separate V2 task with its own planning doc.

### 11.2 Premature SwiftData
SwiftData is Apple-recommended; tempting in iOS-2/iOS-3. **Mitigation**: stop condition #9. V1 uses file-system JSON. SwiftData is a V2 decision with a separate planning doc.

### 11.3 Premature background sync
"Auto-upload on plug-in" introduces App Store review complexity, battery disclosure, and silent-overwrite risk. **Mitigation**: stop condition #2. Background sync is V2+.

### 11.4 Premature multi-device sync
Temptation: CloudKit-backed iPhone/iPad/Watch sync. **Mitigation**: V1 uses Supabase + explicit upload only, same as the TS PWA. Multi-device merge is V2+.

### 11.5 App Store reviewer flagging HealthKit usage
HealthKit-related rejections are common; vague usage descriptions get flagged. **Mitigation**: stop condition #8 and the iOS-10 reviewer-notes doc.

### 11.6 TS / Swift output drift
As TS engines evolve (especially TrainingDecision), the Swift port falls behind silently. **Mitigation**: iOS-0 fixtures versioned with the source commit SHA; static guard test fails if Swift output diverges. A "Swift port refresh" PR opens whenever the TS engine moves materially.

### 11.7 Cadence drift on iOS-3 / iOS-4
Data-health and TrainingDecision are the highest-effort tasks; temptation to ship "lightweight" versions. **Mitigation**: stop condition #3 + fixture-equal parity requirement.

### 11.8 PR review bottleneck
Eight parallel agent reports + 11 iOS PRs = high reviewer load. **Mitigation**: every iOS PR explicitly names its dependencies and stop conditions so reviewers can fast-path routine checks.

### 11.9 Migration distracts from PWA stability
The PWA on `main` has just stabilized (cloud V5, decision V2, data-health V1). **Mitigation**: iOS PRs do NOT touch `src/`, `apps/api/`, `tests/` except for fixture export and static guards.

### 11.10 Stop condition leakage
A future engineer implements a "convenient" feature that violates a stop condition. **Mitigation**: every stop condition is enforced by a static guard test that fails CI; the conditions are also documented in `docs/ios-native-migration/IOS_STOP_CONDITIONS.md` (opened in iOS-1).

### 11.11 User device fragmentation
iOS 17 / 18 / 26 matrix grows. **Mitigation**: iOS-1 plan doc fixes the minimum iOS target; TestFlight test plan covers at least two iOS versions.

---

## 12. Non-goals (program-level)

NOT in scope for the iOS migration V1 program:

- WebView wrapper as the primary architecture; background sync; auto-upload; silent conflict resolution; multi-device merge logic.
- Apple Watch companion app; iPad-specific layout (iPhone-only in V1); macOS Catalyst.
- HealthKit write-back; background HealthKit observation.
- Sign-In-with-Apple; biometric login; push notifications.
- In-App Purchases / subscriptions; third-party analytics / crash reporting / advertising.
- Localization beyond zh-Hans + en; public TestFlight beta (internal only); App Store featuring requests; marketing campaigns.
- SwiftData / Core Data; CloudKit; WidgetKit; App Clips; Live Activities; Dynamic Island; Lock Screen widgets; Siri Shortcuts; App Intents.
- Universal Links beyond the basic Supabase auth callback.

Any of the above being added requires a new task list and a new program-level plan.

---

## 13. Open questions

These remain unanswered. Sibling agents resolve some; the rest need program-owner input.

**Architecture (Agent 5)**: Minimum iOS target — iOS 17.0 (proposed) vs 16.0? Folder layout — feature-folder vs layer-folder? State management — plain `@Observable`, MVVM, TCA? Networking — plain `URLSession` only?

**Data safety (Agent 3)**: How does `AutoRepairBackupAdapter` interact with iCloud Drive backup? Does the Swift port include `replacementEquivalenceAuditV1`? Is the Data Health passive line user-facing in V1 or dev-only?

**Recommendation (Agent 6)**: Full signal-engine set verbatim, or a curated subset? Any iOS-specific signals (Apple Watch HR during set) — default NO, V2.

**UI (Agent 4)**: Dark mode default vs system default? Color tokens — re-derive from Tailwind or hand-tune? Typography — SF Pro? Charting — SwiftUI Charts (no third-party).

**Regression (Agent 7)**: Swift + TS test integration in CI? `xcodebuild` host — Xcode Cloud vs GitHub Actions macOS? SwiftUI snapshot tests yes/no?

**Program owner**: Bundle ID? Apple Developer account? App Store category (Health & Fitness assumed)? App name? Internal testers — who? Launch geographies? Public beta — yes/when? Marketing copy author? Privacy policy URL — reuse PWA or iOS-specific?

**Cross-cutting**: Need a "migrate from PWA" flow (export → paste JSON)? Preserve PWA storage when iOS app installs (default NO)? Will PWA continue after iOS-10 (default YES — additive surface, not replacement)?

---

## 14. How this report connects to the other 7 agents

| Agent | What this plan needs from them |
|---|---|
| 1 — Root Cause | Confirmation that the user's pain points are addressed by the V1 task set. |
| 2 — Regression Risk | Confirmation that iOS-0..iOS-10 do not regress the TS PWA. |
| 3 — Data Safety | Swift API surface for `AppDataRepairRegistry` and the backup-adapter contract (iOS-3). |
| 4 — UI | SwiftUI design tokens, navigation patterns, screen acceptance criteria (iOS-5 / iOS-6). |
| 5 — Architecture | Persistence choice, minimum iOS target, module structure under `ios/IronPath/`. |
| 6 — Recommendation | TrainingDecision V2 port readiness, signal-engine completeness (iOS-4). |
| 7 — Implementation | Pre-merge checklist refinement, macOS CI flow, Swift test runner integration. |

Together the 8 reports form `IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md`, mergeable as a single docs-only entry-gate PR matching the cadence of `DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md`.

---

## 15. Final verdict (program-level)

The iOS migration is feasible as 11 sequential-with-parallel-windows V1 tasks. The earliest usable iPhone build (log a set on a real device) is reachable by the end of iOS-5, requiring iOS-0..iOS-4 + iOS-5 in strict order. TestFlight is reachable after iOS-8. App Store is reachable after iOS-9.

Critical safeguards:
- Stop conditions §9 are enforced by static guard tests, not human review alone.
- No `--admin` merge, anywhere.
- No third-party SDK without explicit user approval.
- No background sync, no HealthKit write, no silent conflict resolution.

Critical dependencies on parallel agents:
- Agent 5 must publish the persistence + minimum-iOS-target decision before iOS-2 can open its planning doc.
- Agent 3 must publish the data-safety boundaries before iOS-3 can open its planning doc.
- Agent 4 must publish the design system tokens before iOS-5 / iOS-6 can open their planning docs.

If those three sibling reports land green, this roadmap is executable as-is. If any of them contradicts a task in §4, the offending task is rewritten in a `_V1.1.md` revision before the implementation PR opens.

Implementation is BLOCKED until:
- This planning doc is merged.
- The 7 sibling agent reports are merged.
- The program owner provides written sign-off on iOS-0.

End of report.
