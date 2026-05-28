# iOS Native Migration — Tasks V1

> Status: docs / planning only. **No implementation lands in this PR.**
> See `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` §17 for the program-level DAG.
> See `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` for the 11 frozen contracts every task here cites.
> Version: V1. Last updated: 2026-05-27.

## Scope statement

This document defines the 11 implementation tasks (`iOS-0` through
`iOS-10`) that take the IronPath PWA to a shipped native iOS app, in
the same `V1` cadence the project already uses (`#384`–`#391`). Each
task gets its own H2 section with goal / non-goals / files /
dependencies / acceptance criteria / tests / manual smoke / risks /
merge rule.

**Out of scope for this PR**:

- Creating any Swift file.
- Creating any Xcode project.
- Modifying any source under `src/`, `apps/`, `tests/`, `supabase/`,
  `packages/`.
- Adding any package dependency.
- Auto-merging this or any sibling iOS-N PR.

This is the planning artefact only. The first implementation work is
`iOS-0 Contract Fixture Export V1`, which opens after this planning PR
merges. (See Entry Gate §18 Stop Conditions for the full enforcement
list.)

## DAG of dependencies (ASCII)

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
                          iOS-3                     (iOS-2 also enables
                  (Data Health Swift Port V1)        iOS-4 — but iOS-4
                            │                       needs iOS-3 too)
                            ▼
                          iOS-4
                  (TrainingDecision Swift Port V1)
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

### Parallelisation rules

- iOS-0 → iOS-1 → iOS-2 are **strictly sequential**. No parallelisation.
- iOS-3 and iOS-4 may **open in parallel** once iOS-2 is merged, but
  iOS-4 **cannot merge** until iOS-3 is merged (iOS-4 imports
  `CleanAppDataView` from iOS-3).
- iOS-5 and iOS-6 may **develop in parallel** once iOS-4 is merged. Both
  must merge before iOS-9 starts.
- iOS-7 and iOS-8 may **develop in parallel** once iOS-5 is merged
  (Cross-review revision M7 — they are parallel siblings, not
  sequential).
- iOS-9 is **strictly after** iOS-3 + iOS-4 + iOS-5 + iOS-6 + iOS-7 +
  iOS-8 all merged.
- iOS-10 is **strictly after** iOS-9 merged.

## The 3 HIGH revisions absorbed into the relevant tasks

Per `docs/ios-native-migration/IOS_NATIVE_MIGRATION_CROSS_AGENT_REVIEW_V1.md`,
this Tasks doc absorbs these 3 HIGH-severity revisions explicitly:

- **H1 — Parity-fixture directory canonicalisation.** The canonical
  path is `tests/fixtures/parity/` (Agent 6 wins; it generalises beyond
  iOS). iOS-0 acceptance criteria below reference this canonical path.
  Agent 8's original proposal of `tests/fixtures/ios-contract/` is
  resolved against.
- **H2 — `supabase-swift` SDK is DEFERRED-APPROVAL.** Agent 4
  recommends the official Supabase Swift SDK; Stop Condition #10 (this
  doc, repeated per task) forbids any SwiftPM dependency without
  explicit user approval. **iOS-1 does NOT add `supabase-swift`.**
  iOS-7 cannot start until the user explicitly approves one of three
  paths: (a) add `supabase-swift` as the one allowed SwiftPM
  dependency; (b) hand-roll GoTrue + REST in plain `URLSession`; (c)
  defer cloud sync entirely from V1 and ship local-only first. This
  blocking decision is reflected in iOS-7's "Dependencies" section.
- **H3 — In-app account deletion is required if cloud sync ships in
  V1.** App Store Guideline 5.1.1(v). Added to iOS-7 acceptance
  criteria explicitly. Added to iOS-10 App Store Readiness checklist
  explicitly. Mirrored in Contract Freeze §5 (Auth contract).

## Stop conditions (front-matter — repeated verbatim from Entry Gate §18)

- iOS V1 MUST NOT ship a WebView wrapper of the existing PWA as its
  final architecture.
- iOS V1 MUST NOT enable background sync by default.
- iOS V1 MUST NOT feed raw AppData into TrainingDecision — only
  CleanAppDataView equivalents.
- iOS V1 MUST NOT upload partially-repaired AppData.
- iOS V1 MUST NOT silently overwrite cloud snapshots on conflict.
- DO NOT create an Xcode project before iOS-0 Contract Fixture Export
  V1 is green.
- DO NOT add any third-party SwiftPM dependency (including
  `supabase-swift`) without explicit user approval.
- DO NOT add Sentry / Crashlytics / analytics SDKs without explicit
  user approval.
- DO NOT request HealthKit write permission unless a feature actually
  writes back.
- DO NOT ship cloud sync in V1 without an in-app account deletion flow.
- DO NOT use `gh pr merge --admin` to bypass branch protection.

---

## iOS-0 Contract Fixture Export V1

### Goal

Produce a deterministic, versioned set of JSON contract fixtures under
`tests/fixtures/parity/` (Cross-review H1 — canonical path), exported
from the existing TS engines, so the Swift port can be test-driven
against the exact same inputs and expected outputs.

### Non-goals

- No Xcode project (that is iOS-1).
- No Swift code anywhere.
- No changes to runtime TS engines — fixtures are exported via a new
  `scripts/generate-parity-goldens.mjs` that calls existing pure engines.
- No schema bump on the TS side.
- No new repair logic.
- No cloud / Supabase touches.

### Likely files / project area

- `scripts/generate-parity-goldens.mjs` — Node script that invokes pure
  TS engines and writes goldens; supports `--check` mode for CI.
- `tests/fixtures/parity/inputs/` — at minimum the 5 fixtures named
  below ("Top 5" per QA Agent §5).
- `tests/fixtures/parity/golden/` — generated output JSON, one per
  input.
- `tests/fixtures/parity/README.md` — fixture index + privacy
  statement + regen instructions.
- `tests/parity/parityFixturesGenerationConsistency.test.ts` — CI
  guard: re-running the generator produces zero diff.
- `tests/fixturePrivacyGuard.test.ts` — extended to include the new
  directory.
- `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md`
  (planning doc shipped in this same PR).

### Dependencies

None. This is the **root** of the iOS dependency graph.

### Acceptance criteria

- `npm run typecheck`, `npm test` (including
  `tests/parity/parityFixturesGenerationConsistency.test.ts`), and
  `npm run build` all pass.
- `node scripts/generate-parity-goldens.mjs --check` exits 0 (two
  consecutive runs produce byte-identical files; `git diff` empty).
- All five "top 5" fixtures (QA Agent §5) exist under
  `tests/fixtures/parity/inputs/`:
  1. `app-data/snapshot-hash-stable-v1.json`
  2. `training-decision/normal-session-v1.json`
  3. `data-repair/session-lifecycle-residue-v1.json`
  4. `real-export/redacted-2026-05-27.json` (pointer to existing
     `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`)
  5. `focus-mode/golden-path-session-v1.json`
- Every input JSON has a `parityMeta` envelope (`id, schemaVersion,
  describes, privacy, generatedFrom, tsCommit`).
- `tests/fixturePrivacyGuard.test.ts` is extended and passes on the new
  directory (no real `userId`, `email`, `deviceLabel`, or Supabase
  tokens).
- Zero new TS dependencies; `package.json` unchanged.
- The planning doc
  `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md`
  explicitly notes the canonical path resolution against
  `tests/fixtures/ios-contract/` (H1).

### Tests

- `tests/parity/parityFixturesGenerationConsistency.test.ts` (new) —
  asserts the generator is deterministic and goldens match.
- `tests/fixturePrivacyGuard.test.ts` (extended) — scans the new
  directory.
- `tests/iosContractFixtureStaticGuards.test.ts` (new) — every fixture
  has the envelope; `sourceCommitSha` matches `git rev-parse HEAD`;
  `schemaVersion` matches `src/data/appConfig.ts` `STORAGE_VERSION`.

### Manual iPhone smoke

N/A — no iPhone involvement at this stage.

### Risks

- TS engine non-determinism leaks into the fixture (e.g. an engine
  calls `Date.now()` or `Math.random()`). Mitigation: the export
  script pins `nowIso` to a fixed value; the determinism test re-runs
  to confirm zero diff.
- Engines that depend on `localStorage` cannot be invoked from a Node
  export script. Mitigation: only invoke pure engines
  (`buildCleanAppDataView`, `buildTrainingDecision`,
  `appDataRepairEngine.runRepair`, `buildFocusTrainingPlan`). UI /
  DOM / storage engines are explicitly out of scope.
- Fixture-path conflict with an existing Agent 8 reference to
  `tests/fixtures/ios-contract/`. Resolved per H1 — canonical is
  `tests/fixtures/parity/`.

### Merge / release rule

- One PR.
- Title: `iOS-0 Contract Fixture Export V1`.
- Branch name: `claude/ios-0-contract-fixture-export-v1`.
- Must include `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.** **No `--no-verify`.**
- **No third-party SDK without explicit user approval.**
- iOS-1 may NOT open until this PR is merged.

---

## iOS-1 Xcode Project Bootstrap V1

### Goal

Create the iOS Xcode project skeleton with the minimum viable
scaffolding to host the Swift port. No business logic. The project
layout adopts Agent 5's 8-SPM-package map (Cross-review revision M6).

### Non-goals

- No SwiftData. No Core Data. No persistence implementation (iOS-2 and
  iOS-3 cover this; the slot is `protocol AppDataStore` from
  `IronPathPersistence`).
- No HealthKit entitlement (iOS-8).
- No CloudKit / Supabase wiring (iOS-7).
- No analytics SDK. No Sentry. No Crashlytics.
- **No third-party SwiftPM / CocoaPods / Carthage dependency.** The
  `supabase-swift` decision (H2) is deferred to iOS-7 prerequisites.
- No App Store metadata (iOS-10).

### Likely files / project area

- `IronPath.xcworkspace` (root) with `IronPath.xcodeproj` and the 8
  local SPM packages under `Packages/`.
- `IronPathApp/` (the app target):
  - `IronPathApp.swift` (`@main` entry).
  - `RootView.swift` (placeholder).
  - `Resources/Assets.xcassets` (placeholder app icon + accent
    color).
  - `Resources/Localizable.strings` (zh-Hans placeholder slot).
  - `Resources/Info.plist` (display name `IronPath`, minimum
    `Info.plist`).
- `Packages/IronPathDomain/`, `Packages/IronPathDataHealth/`,
  `Packages/IronPathPersistence/`, `Packages/IronPathCloudSync/`,
  `Packages/IronPathHealthKit/`, `Packages/IronPathBackup/`,
  `Packages/IronPathL10n/`, `Packages/IronPathUIKit/` — each with a
  minimal `Package.swift` and a placeholder Swift source.
- `Tests/IronPathAppTests/` (one launch test).
- `README.md` documents min Xcode version, min iOS target (iOS 17.0 per
  Cross-review M8), and run instructions.
- `docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md` (plan
  + delivery in one doc — trivial).

### Dependencies

- iOS-0 merged.

### Acceptance criteria

- `xcodebuild build -workspace IronPath.xcworkspace -scheme IronPath`
  succeeds with zero warnings; app boots in Simulator (iPhone 15 Pro,
  iOS 17+) and shows placeholder.
- All 8 SPM packages compile.
- `README.md` documents min Xcode version, min iOS target (iOS 17.0),
  bundle ID, run-on-simulator / run-on-device instructions, and cites
  the iOS-0 merge SHA.
- No provisioning profile committed.
- No third-party SwiftPM / CocoaPods / Carthage dependency.
- Existing TS app on `main` unaffected (`typecheck`, `test`, `build`
  all still pass).

### Tests

- `tests/iosBootstrapStaticGuards.test.ts` (new, TS side) — asserts
  `IronPath.xcodeproj/project.pbxproj` exists; `README.md` cites iOS-0
  as prerequisite; no third-party `Package.swift` consumer outside
  `Packages/` (i.e. no remote SwiftPM dep declared).
- `tests/iosBootstrapNoForbiddenSdkGuards.test.ts` (new) — grep guard:
  no `Sentry / Crashlytics / Firebase / Mixpanel / Amplitude / Segment`
  in `IronPathApp/` or `Packages/` (case-insensitive).
- One XCUITest in `Tests/IronPathAppTests/` that launches the app and
  asserts it does not crash.

### Manual iPhone smoke

Build for Simulator (iPhone 15 Pro, iOS 17) — app launches, shows
placeholder, no crash, no console error. Build for a real iPhone
(developer signing) — installs and launches.

### Risks

- Over-scoping V1: temptation to add SwiftData / TCA / Combine /
  Observation modelling in this task. **Resisted**: V1 is bare
  scaffolding.
- Premature persistence: SwiftData vs Core Data vs raw JSON. **Not
  decided here**; the protocol slot is in place but the
  implementation lives in iOS-3 (Data Health) and is JSON-file per
  Contract Freeze §1 + Stop Condition #9.
- Bundle ID conflict with existing PWA. Mitigation: confirm via App
  Store Connect before merge.
- Workspace vs project layout disagreement (Cross-review M6) — resolved
  in favour of Agent 5's 8-package map.

### Merge / release rule

- One PR.
- Title: `iOS-1 Xcode Project Bootstrap V1`.
- Branch name: `claude/ios-1-xcode-project-bootstrap-v1`.
- Must include `docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.**

---

## iOS-2 AppData Swift Models V1

### Goal

Port the `AppData` TypeScript model surface
(`src/models/training-model.ts:1362`) to Swift `Codable` structs that
round-trip with the iOS-0 fixtures byte-for-byte (modulo JSON key
ordering). All unknown fields preserved via `[String: JSONValue]`
carriers (per Contract Freeze §1).

### Non-goals

- No persistence I/O (that is iOS-3 / Architecture §4.4 default impl).
- No data repair logic (iOS-3).
- No decision logic (iOS-4).
- No UI binding (iOS-5 / iOS-6).
- No schema bump on the TS side. Swift models mirror TS exactly.
- No "Swift-idiomatic restructuring" that changes the wire shape.
- **No `@Model` (SwiftData) or `@Observable` annotations on model
  types** (Stop Condition #9).

### Likely files / project area

- `Packages/IronPathDomain/Sources/IronPathDomain/Model/AppData.swift`
- `Packages/IronPathDomain/Sources/IronPathDomain/Model/AppSettings.swift`
  (manual `Codable` with `unknown: [String: JSONValue]` carrier)
- `Packages/IronPathDomain/Sources/IronPathDomain/Model/JSONValue.swift`
  (custom enum)
- `Packages/IronPathDomain/Sources/IronPathDomain/Model/TrainingSession.swift`,
  `TrainingSetLog.swift`, `ActualSetDraft.swift`, `ExercisePrescription.swift`,
  `MesocyclePlan.swift`, `UserProfile.swift`, `ScreeningProfile.swift`,
  `ProgramTemplate.swift`, `HealthMetricSample.swift`,
  `UnitSettings.swift`, `TodayStatus.swift`,
  `AdaptiveCalibrationState.swift`, `SchemaVersion.swift`
  (single source of truth for the Swift-side `STORAGE_VERSION = 8`
  constant)
- `Packages/IronPathDomain/Tests/IronPathDomainTests/AppDataCodableRoundTripTests.swift`,
  `AppDataSchemaVersionGuardTests.swift`,
  `AppDataOpenBagPreservationTests.swift`
- `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1_PLAN.md`
  merged before implementation PR opens (Stop Condition #11).
- `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1.md`
  (delivery doc).

### Dependencies

- iOS-1 merged.
- iOS-0 merged.

### Acceptance criteria

- `xcodebuild test` on iPhone 15 simulator passes.
- `AppDataCodableRoundTripTests` decodes every iOS-0 fixture, re-encodes
  it, and asserts `Equatable` equality with the original.
- Decoded `schemaVersion` matches Swift `SchemaVersion.current` (= 8)
  for every fixture.
- `AppSettings` round-trips an unknown key preserved through
  `unknown: [String: JSONValue]`.
- `AppDataOpenBagPreservationTests` asserts unknown keys at every level
  with `additionalProperties: true` in the schema survive encode /
  decode.
- ISO timestamps decoded as `String`, not `Date`. Verified by
  `AppDataIsoTimestampStaticGuardTests`.
- `tests/iosContractFixtureStaticGuards.test.ts` still green (no TS
  regression).
- Planning doc merged before the implementation PR opens.

### Tests

- `AppDataCodableRoundTripTests.swift` — for each fixture: decode →
  re-encode → decode → assert equality.
- `AppDataSchemaVersionGuardTests.swift` — `SchemaVersion.current`
  matches the TS value.
- `AppDataOpenBagPreservationTests.swift` — unknown keys preserved
  across encode/decode.
- `tests/iosAppDataSwiftModelStaticGuards.test.ts` (new, TS side) —
  greps `Packages/IronPathDomain/Sources/IronPathDomain/Model/`:
  every top-level model is `Codable + struct`; **no `@Observable` /
  `@Model` / `@objc` annotation in V1**.

### Manual iPhone smoke

Run `AppDataCodableRoundTripTests` on Simulator, then on a real iPhone
via Xcode test plan.

### Risks

- TS uses optional fields heavily; Swift `Codable` is strict.
  Mitigation: every optional field is `Optional` in Swift with explicit
  `CodingKeys`.
- TS uses `Record<string, T>` ad-hoc; Swift maps to `[String: T]`.
  Mitigation: iOS-0 fixture export normalises key order.
- Date encoding drift (Contract Freeze §1 — Swift's default `.iso8601`
  drops milliseconds). Mitigation: store as `String`, never `Date`.
- Premature SwiftData (Stop Condition #9). Mitigation: static guard
  rejects `@Model` / `@Observable` on model types.

### Merge / release rule

- One PR for the planning doc, one PR for the implementation.
- Title: `iOS-2 AppData Swift Models V1`.
- Branch name: `claude/ios-2-appdata-swift-models-v1`.
- Must include `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.**
- iOS-3 may NOT open until this PR is merged.

---

## iOS-3 Data Health Swift Port V1

### Goal

Port the V1 data-health repair system (`src/dataHealth/`) to Swift so
that the iOS app applies the same Runtime Guard projection and the
same Safe Auto Repair set on cold start, before any decision engine
runs. Preserves Contract Freeze §4 (Data Health repair contract)
verbatim.

### Non-goals

- No new repair IDs beyond the 9 active V1 IDs.
- No deferred V2/V3 repairs (`partialCompletionDerivedQualityV1`,
  `replacementEquivalenceCanonicalV1`,
  `replacementEquivalenceRecordRewriteV3`, etc. — these belong to
  follow-up V2 tasks per
  `docs/DATA_INTEGRITY_REMEDIATION_TASKS_V1.md`).
- No new ledger schema. The Swift port writes the same
  `DataHealthRepairLedgerEntry` shape into
  `settings.dataHealthRepairLedger`.
- No cloud / Supabase touches — Data Health stays local-only.
- No silent rewrite of user data without backup-first.
- No popup UI for repair receipts — match the TS "no popup" UX bar.

### Likely files / project area

- `Packages/IronPathDataHealth/Sources/IronPathDataHealth/` — Swift
  siblings to every file in `src/dataHealth/`:
  `CleanAppDataView.swift`, `DataHealthRuntimeGuard.swift`,
  `AutoRepairOrchestrator.swift`, `AppDataRepairEngine.swift`,
  `AppDataRepairRegistry.swift`, `AppDataIngressPipeline.swift`,
  `AppDataRepairTypes.swift`, `AppDataRepairLedger.swift`,
  `RepairHelpers.swift` (with the `hashIdempotencyKey` +
  `computeAppDataHash` byte-identical ports).
- `Packages/IronPathDataHealth/Sources/IronPathDataHealth/Repairs/` —
  one Swift file per V1 repair: `SessionLifecycleResidueV1`,
  `ImpossibleDurationV1`, `StaleTodayStatusV1`,
  `StaleHealthReadinessGuardV1`, `ScreeningIssueScoreRuntimeGuardV1`,
  `ScreeningIssueScoreRepairV1`, `LegacyFinalAdviceIsolationGuardV1`,
  `SetIndexRenumberV1`, `ReplacementEquivalenceAuditV1`.
- `Packages/IronPathPersistence/Sources/IronPathPersistence/` —
  `AppDataStore.swift` (protocol), `JSONFileAppDataStore.swift`
  (default impl), `FileBackupAdapter.swift` (file-system, NOT
  IndexedDB, retention 5).
- `Packages/IronPathDataHealth/Tests/IronPathDataHealthTests/` — for
  every fixture, byte-equal parity tests per Contract Freeze §4.
- `docs/ios-native-migration/IOS_3_DATA_HEALTH_SWIFT_PORT_V1_PLAN.md`
  merged before implementation.
- `docs/ios-native-migration/IOS_3_DATA_HEALTH_SWIFT_PORT_V1.md`.

### Dependencies

- iOS-2 merged.

### Acceptance criteria

- Every Swift repair's `detect` and `dryRun` output is byte-equal to
  the TS golden fixture (for the same iOS-0 input).
- Every Swift repair `apply` produces JSON-equal `repairedData` to
  the TS post-repair golden.
- `idempotencyKey` is deterministic and matches the TS-side
  computation byte-identically.
- `AutoRepairOrchestrator` runs the safe-auto set, persists the
  ledger, and is idempotent across two runs (second run reports
  `status='skipped'` for already-applied repairs).
- Backup-first enforced:
  `AutoRepairBackupAdapter.snapshot` failure halts repairs and records
  `status='backup_failed'`; AppData unchanged.
- `DataHealthRepairLedgerEntry` shape matches the TS type byte-for-byte
  (re-encoded through `Codable`).
- `CleanAppDataView.build(appData:clock:)` JSON equals TS
  `buildCleanAppDataView(appData)` for every iOS-0 fixture.
- `computeAppDataHash` and `buildAppDataSnapshotHash` Swift outputs
  match TS outputs byte-identically on the iOS-0 fixture set (gating
  test for cloud sync work in iOS-7).
- `MAX_BACKUPS = 5`, `MAX_DATA_REPAIR_LOG_ENTRIES = 500`,
  `DATA_HEALTH_LEDGER_MAX_ENTRIES = 1000`,
  `DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS = 24`,
  `DATA_HEALTH_TODAY_STATUS_STALE_DAYS = 3`,
  `DATA_HEALTH_HEALTH_DATA_STALE_DAYS = 14` — all Swift constants
  match TS verbatim.

### Tests

- `CleanAppDataViewSwiftPortTests.swift` — JSON equality vs golden for
  every fixture.
- `AppDataRepairRegistrySwiftPortTests.swift` — `detect / dryRun /
  apply` fixture-equal output for all 9 repair IDs.
- `AutoRepairOrchestratorSwiftPortTests.swift` — backup-first;
  idempotent re-run; backup-failure halts repair; ledger entries match
  TS.
- `AppDataIngressPipelineSwiftPortTests.swift` — central ingress
  output matches TS `processIncomingAppData`.
- `AppDataSnapshotHashParityTests.swift` —
  `buildAppDataSnapshotHash` byte-identical between Swift and TS for
  every iOS-0 fixture.
- `tests/iosDataHealthSwiftPortStaticGuards.test.ts` (new, TS side) —
  every TS V1 repair has a Swift sibling; no V2/V3 scaffold imports;
  no `UserDefaults` writes for the ledger (must use file system);
  static guard on the deletion-banned list (no
  `history.removeAll` etc. — Data Agent §9.5).

### Manual iPhone smoke

Boot Simulator with the redacted fixture seeded via debug-only launch
flag (sideloaded via a dev-only "Paste JSON" affordance, NOT shipped to
TestFlight). Confirm Data Health placeholder UI reports the same
repair counts as the TS app; cold-boot repair completes in < 500ms;
backup file appears under
`<AppGroup>/ironpath/backups/autoRepair_<isoTs>_<hash8>.json`.

### Risks

- Date / timestamp drift between Swift and TS. Mitigation: single
  `Clock` protocol with injectable fixed clock for tests; ISO strings
  not Swift `Date`.
- IndexedDB → file system: iOS uses Application Support with
  atomic-write JSON; test suite covers "backup-write fails" path.
- Receipts cap (500 / 1000) must match identically — static guard on
  the cap constants.
- Premature SwiftData — forbidden by Stop Condition #9.
- Raw AppData leaking into TrainingDecision — `CleanAppDataView` is the
  firewall; static guard ensures iOS-4 reads only `CleanAppDataView`.
- Hash arithmetic overflow drift between TS `(hash << 5) - hash + char`
  and Swift `(hash &<< 5) &- hash &+ char`. Mitigation: golden test
  vectors covering 0, 1, 64, 256, 1024-char inputs.

### Merge / release rule

- One PR for the planning doc, one PR for the implementation.
- Title: `iOS-3 Data Health Swift Port V1`.
- Branch name: `claude/ios-3-data-health-swift-port-v1`.
- Must include `docs/ios-native-migration/IOS_3_DATA_HEALTH_SWIFT_PORT_V1.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.**
- iOS-4 may NOT open until this PR is merged.

---

## iOS-4 TrainingDecision Swift Port V1

### Goal

Port the TS V2 TrainingDecision engine
(`src/engines/trainingDecisionEngine.ts` + supporting signal engines)
to Swift. Output must be fixture-equal to the TS reference for every
iOS-0 fixture, **including the dev-only
`hiddenDebugSignals.arbitrationTrace` array** (Cross-review revision
M4). Preserves Contract Freeze §2 and §3 verbatim.

### Non-goals

- No new recommendation logic. Swift mirrors TS V2 verbatim.
- No alternate "lightweight" recommendation path.
- No reading raw `AppData` — input is `CleanTrainingDecisionInput`
  only (factory-only construction, fileprivate init, see Contract
  Freeze §3).
- No deletions / additions to the signal engine set without a separate
  planning PR.
- No popup UI for decision results.
- No re-introduction of any of the 9 hard-deleted legacy engines
  (Contract Freeze §2).

### Likely files / project area

- `Packages/IronPathDomain/Sources/IronPathDomain/Decision/TrainingDecisionEngine.swift`
- `Packages/IronPathDomain/Sources/IronPathDomain/Decision/TrainingDecisionContext.swift`
  (input context aggregator)
- `Packages/IronPathDomain/Sources/IronPathDomain/Decision/TrainingDecisionCleanInput.swift`
  (branded factory matching the TS lock; `fileprivate init` +
  single `TrainingDecisionInputFactory.make(from:)` entrypoint)
- `Packages/IronPathDomain/Sources/IronPathDomain/Decision/Signals/` —
  one Swift file per signal in the TS V2 set: `EffectivePhase`,
  `Lapse`, `Readiness`, `DailyAdjustment`, `Recovery`,
  `VolumeAdaptation`, `Adherence`, `SupportPlanBudget`.
- `Packages/IronPathDomain/Sources/IronPathDomain/Decision/UserFacing/DecisionUserFacing.swift`
  (closed enums per reason code; copy authored in `IronPathL10n`).
- `Packages/IronPathDomain/Tests/IronPathDomainTests/TrainingDecisionEngineParityTests.swift`,
  `TrainingDecisionCleanInputContractTests.swift`,
  `TrainingDecisionSignalParityTests.swift`,
  `TrainingDecisionForbiddenCopyScanTests.swift`,
  `EffectivePhaseGapStateMachineParityTests.swift`.
- `docs/ios-native-migration/IOS_4_TRAINING_DECISION_SWIFT_PORT_V1_PLAN.md`
  merged before implementation.
- `docs/ios-native-migration/IOS_4_TRAINING_DECISION_SWIFT_PORT_V1.md`.
- Optional follow-up: `docs/ios-native-migration/IOS_4_TRAINING_DECISION_SWIFT_LOCK_V1.md`
  once the port stabilises.

### Dependencies

- iOS-3 merged.
- iOS-2 merged.
- iOS-0 fixtures include TrainingDecision expected outputs (including
  the `arbitrationTrace` array).

### Acceptance criteria

- `TrainingDecisionEngine.run(cleanView:nowIso:)` JSON equals
  `tests/fixtures/parity/golden/training-decision/normal-session-v1.json`
  (and the other training-decision goldens) for every iOS-0 fixture.
- The full `hiddenDebugSignals.arbitrationTrace` array (e.g. the
  `AR-1-severe-override`, `AR-2-reentry-override`,
  `AR-3-productive-floor` entries) matches the TS output byte-equal
  (M4).
- Input is the branded `CleanTrainingDecisionInput` (factory-only
  construction; mirrors TS lock; Swift is **stricter** because the
  init is `fileprivate`).
- No Swift file under `Decision/` reads `AppData` directly — TS-side
  static guard `tests/iosTrainingDecisionSwiftPortStaticGuards.test.ts`.
- No Swift file imports a name from the hard-deleted TS legacy set —
  grep guard.
- Pure: no I/O, no clock except injected `nowIso`, no `UserDefaults`,
  no Supabase — static guard on imports.
- `decisionVersion = "v2"` constant matches `src/engines/trainingDecisionTypes.ts:429`.
- `ROLE_FLOORS_REENTRY = (main 2, secondary 2, accessory 1, isolation
  1)` Swift constant matches `src/engines/trainingDecisionEngine.ts:89`.
- Gap thresholds (`0–3 / 4–7 / 8–13 / 14–27 / 28+`) match
  `src/engines/effectiveTrainingPhaseEngine.ts:140`.
- Forbidden-copy scan green on the Swift bundle (Contract Freeze
  Appendix B).

### Tests

- `TrainingDecisionEngineParityTests.swift` — fixture-equal JSON
  output for every iOS-0 training-decision fixture, **including
  `arbitrationTrace`**.
- `TrainingDecisionCleanInputContractTests.swift` — `.run` rejects
  raw `AppData` at compile time; `TrainingDecisionInputFactory` is
  the only construction site.
- `TrainingDecisionSignalParityTests.swift` — fixture parity per
  signal engine.
- `EffectivePhaseGapStateMachineParityTests.swift` — every gap window
  resolves to the same `activePhase` + `volumeMultiplier` +
  `intensityBias` + `compactLabel` as TS.
- `TrainingDecisionForbiddenCopyScanTests.swift` — the 4 forbidden
  phrases never appear in the compiled `Decision/` outputs.
- `tests/iosTrainingDecisionSwiftPortStaticGuards.test.ts` (new, TS
  side) — no `AppData` import under
  `Packages/IronPathDomain/Sources/IronPathDomain/Decision/`; no
  deleted-TS legacy engine names; every TS V2 signal has a Swift
  sibling.

### Manual iPhone smoke

Boot with the iOS-0 fixture seeded; trigger the decision pipeline via
a debug-only screen (placeholder UI acceptable); confirm output JSON
matches the TS expected output.

### Risks

- Numeric precision drift (Double vs Number). Mitigation: every
  numeric output is rounded to a documented precision before
  comparison; fixture has the same rounding.
- Date arithmetic drift. Mitigation: every date operation goes through
  a single `DateMath` utility with a Swift / TS parity test.
- Legacy reintroduction: someone might add a "convenience text" field
  to the Swift decision engine. **Resisted**: static guard test on the
  public output struct shape; forbidden-copy scan.
- Premature SwiftData: do not store decision output to disk; it is
  recomputed every read.
- AR trace regression (M4) — silently dropping the dev-only trace
  array. Mitigation: parity test asserts the array byte-equal.

### Merge / release rule

- One PR for the planning doc, one PR for the implementation,
  optional follow-up lock-doc PR.
- Title: `iOS-4 TrainingDecision Swift Port V1`.
- Branch name: `claude/ios-4-training-decision-swift-port-v1`.
- Must include `docs/ios-native-migration/IOS_4_TRAINING_DECISION_SWIFT_PORT_V1.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.**
- iOS-5 may proceed in parallel with iOS-6 once this is merged.

---

## iOS-5 Native Focus Mode MVP V1

### Goal

Build the native Focus Mode screen (the workout-execution screen)
end-to-end so a user can log a real set on a real iPhone. This is the
**earliest usable iPhone build** milestone (Program Manager §6).
Preserves Contract Freeze §9 (Session lifecycle contract) verbatim.

### Non-goals

- No multi-device sync (iOS-7).
- No HealthKit (iOS-8).
- No cloud restore (iOS-7).
- No analytics SDK.
- No "polish" features (haptics tuning, sound cues, picture-in-picture).
  MVP only.
- No legacy advice text rendered in Focus Mode — same
  `legacyFinalAdviceIsolationGuardV1` rule as the TS app.
- No reading raw `AppData` in the UI layer — only `CleanAppDataView`
  projections.
- No Plan / History / Progress screens (iOS-6).

### Likely files / project area

- `IronPathApp/Screens/Today/` — `TodayScreen.swift`,
  `TodayViewModel.swift` (placeholder day-plan).
- `IronPathApp/Screens/Training/Focus/` — `FocusModeScreen.swift`,
  `FocusModeViewModel.swift`, `SetEntryRow.swift`, `RestTimerView.swift`,
  `FinalizeSessionAction.swift`.
- `Packages/IronPathDomain/Sources/IronPathDomain/Engines/FocusModeStateEngine.swift`
  (port of `src/engines/focusModeStateEngine.ts:141` —
  `buildFocusStepQueue` etc.).
- `Packages/IronPathDomain/Sources/IronPathDomain/Engines/FocusModeInteractionState.swift`
  (port of `src/engines/focusModeInteractionState.ts:100`).
- `Packages/IronPathDomain/Sources/IronPathDomain/Engines/RestTimerEngine.swift`
  (port of `src/engines/restTimerEngine.ts` with injected `Clock`).
- `Packages/IronPathDomain/Sources/IronPathDomain/Engines/SessionBuilder.swift`,
  `EffectiveSetEngine.swift`, `ActionableLoadContract.swift`,
  `EquipmentAwareLoadModel.swift`, `WarmupPolicyEngine.swift`,
  `SetAnomalyEngine.swift`, `ReplacementEngine.swift`,
  `CurrentExerciseSelector.swift`, `TrainingCompletionEngine.swift`.
- `Packages/IronPathPersistence/Sources/IronPathPersistence/JSONFileAppDataStore.swift`
  (used here for the first time — atomic write-and-rename).
- `Packages/IronPathUIKit/Sources/IronPathUIKit/` — `ActionButton`,
  `GlassCard`, `SegmentedControl`, `StatusBadge`, `BottomSheet`
  primitives.
- `Tests/` — `FocusModeStateEngineSwiftPortTests.swift`,
  `FocusModeInteractionStateParityTests.swift`,
  `FocusModeSessionFinalizeTests.swift`,
  `AppDataStoreRoundTripTests.swift`,
  `RestTimerEngineParityTests.swift`,
  `EffectiveSetEngineParityTests.swift`,
  `ReplacementEngineParityTests.swift`.
- `docs/ios-native-migration/IOS_5_NATIVE_FOCUS_MODE_MVP_V1_PLAN.md`
  merged before implementation.
- `docs/ios-native-migration/IOS_5_NATIVE_FOCUS_MODE_MVP_V1.md`.

### Dependencies

- iOS-3 merged.
- iOS-4 merged.
- iOS-2 merged.

### Acceptance criteria

- On a real iPhone: launch → placeholder day-plan → Start Focus → log
  warmup + working sets (weight + reps + RIR) → finalise. Session
  persists via `AppDataStore` (file system) and survives
  kill/relaunch.
- Set IDs follow TS derivation
  (`main:{exerciseId}:warmup:0`, `main:{exerciseId}:working:0`) —
  Swift unit-test verified.
- Finalise writes per-set `completionStatus`, per-exercise
  `completionStatus`, and (if ended early)
  `earlyEndReason='incomplete_main_work'` — same shape as TS
  `finalizeTrainingSession`.
- Focus Mode never renders legacy advice fields
  (`exercise.suggestion / adjustment / warning`,
  `prescription.weeklyAdjustment`, `session.explanations`,
  `session.deloadDecision`) — grep guard.
- State uses Swift `@Observable` (iOS 17+); no third-party state
  library.
- Focus Mode is presented as `.fullScreenCover` from the `.training`
  tab (Architecture Agent §6.3); tab bar disappears.
- Correction step renders "完成纠偏" (NOT "完成一组") — interaction
  state machine validated by `FocusModeInteractionStateParityTests`.
- Empty-bar fallback works: theoretical 17 lb resolves to empty
  Olympic bar / feasible 45 lb (~20.4 kg) — Product Agent §3.6.
- Set anomaly second confirmation fires on improbable values.

### Tests

- `FocusModeStateEngineSwiftPortTests.swift` — fixture parity with TS
  `focusModeStateEngine` for a canned active session.
- `FocusModeInteractionStateParityTests.swift` — covers all 7×7×10×5×5
  state tuples documented in Product Agent §3.3 (sample subset).
- `FocusModeSessionFinalizeTests.swift` — full-completion path: no
  `earlyEndReason`; end-early path: `earlyEndReason='incomplete_main_work'`;
  per-set `completionStatus` correct.
- `AppDataStoreRoundTripTests.swift` — atomic file-system round-trip;
  partial-write recovery from the previous-version backup.
- `EffectiveSetEngineParityTests.swift` — RIR / technique / pain
  scoring constants byte-equal with TS.
- `ReplacementEngineParityTests.swift` — 4-ID identity preserved across
  bench-press → dumbbell-bench substitution; PR keys to
  `recordExerciseId`.
- `tests/iosFocusModeStaticGuards.test.ts` (new, TS side) — no
  legacy-advice field references under `Screens/Training/Focus/`;
  `AppDataStore` is the only AppData writer in Swift production code.

### Manual iPhone smoke

(This is the critical smoke for the "earliest usable iPhone build"
milestone — Program Manager §6.)

1. Build for a real iPhone (developer signing).
2. Launch the app.
3. Start a workout session from the placeholder day-plan.
4. Log 1 warmup set: weight 60, reps 5, RIR 4.
5. Log 1 working set: weight 80, reps 8, RIR 2.
6. End the session as "completed".
7. Close and re-open the app.
8. Confirm the session appears in the debug-only history dump with the
   correct values.
9. Confirm the data-health repair count is 0 new repairs (because the
   session was logged via the proper pipeline).
10. Confirm no crash, no console error.
11. Verify that on a correction step, the action bar says "完成纠偏",
    not "完成一组" (R2 regression check).

### Risks

- Persistence choice — V1 uses file-system JSON; SwiftData is V2 (Stop
  Condition #9).
- Active-session crash recovery — atomic write-and-rename in
  `JSONFileAppDataStore`; static guard on the write path.
- Set-ID collision with TS-restored sessions — covered by
  `SetIndexRenumberV1` (already ported in iOS-3).
- Background timer — store `startedAt` ISO string; compute elapsed on
  foreground (mirrors `restTimerEngine.ts` wall-clock semantics).
- Premature multi-device sync — no cloud upload trigger on session
  finalise.
- 4-ID identity collapse — covered by Contract Freeze §9 + parity
  tests.

### Merge / release rule

- One PR for the planning doc, one PR for the implementation.
- Title: `iOS-5 Native Focus Mode MVP V1`.
- Branch name: `claude/ios-5-native-focus-mode-mvp-v1`.
- Must include `docs/ios-native-migration/IOS_5_NATIVE_FOCUS_MODE_MVP_V1.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.**
- This is the **earliest usable iPhone build** milestone.

---

## iOS-6 Plan / History / Progress Native Screens V1

### Goal

Build the read-only native screens (Plan, History, Progress) so the
user can see their day plan, browse historical sessions, and view PR /
e1RM charts on iPhone. Can ship in parallel with iOS-5 once iOS-4 is
green.

### Non-goals

- No editing affordances. Read-only V1.
- No "Record Edit" / data-flag screens (V2 work).
- No analytics SDK, no Sentry.
- No legacy advice text rendering.
- No HealthKit chart overlays (iOS-8).
- No cloud sync UI (iOS-7).

### Likely files / project area

- `IronPathApp/Screens/Progress/` — `ProgressScreen.swift`,
  `PlanSubview.swift` (Plan is a sub-route, per Architecture Agent
  §6.4), `E1RMChart.swift`, `PRListView.swift`, `AssessmentSubview.swift`,
  `RecordsSubview.swift`.
- `IronPathApp/Screens/History/` — `HistoryListScreen.swift`,
  `HistorySessionDetailScreen.swift`.
- `Packages/IronPathDomain/Sources/IronPathDomain/Engines/` (additions
  needed for read-only views): `E1RMEngine.swift`, `Analytics.swift`,
  `HistoryCalendarSummary.swift`, `SessionHistoryEngine.swift`,
  `SessionPostSummaryEngine.swift`, `SessionDetailSummaryEngine.swift`,
  `WeeklyMuscleBalanceEngine.swift`, `PlateauDetectionEngine.swift`,
  `VolumeAdaptationEngine.swift`.
- `IronPathApp/Presenters/` — `TodayPresenter.swift`,
  `PlanPresenter.swift`, `RecordPresenter.swift` (Swift mirrors of TS
  presenter contracts; see TS Core Logic Agent §4).
- `Tests/` — `PlanViewPresenterTests.swift`,
  `HistoryListViewModelTests.swift`,
  `ProgressChartDataTests.swift`,
  `E1RMEngineParityTests.swift`.
- `docs/ios-native-migration/IOS_6_PLAN_HISTORY_PROGRESS_NATIVE_SCREENS_V1_PLAN.md`
  merged before implementation.
- `docs/ios-native-migration/IOS_6_PLAN_HISTORY_PROGRESS_NATIVE_SCREENS_V1.md`.

### Dependencies

- iOS-4 merged.
- iOS-3 merged.
- iOS-2 merged.

### Acceptance criteria

- Plan sub-route renders next-session prescription using only
  `decision.userFacing.plan`.
- History list shows every finalised session sorted newest first;
  detail screen matches TS effective-set count, volume, and
  partial-completion badge for the same fixture.
- Progress shows e1RM trend + PR list using the `E1RMEngine` Swift
  port — fixture parity.
- No Swift file in `Screens/` reads raw `AppData` — only
  `CleanAppDataView` or `decision.userFacing.*`.
- No screen displays legacy advice text — grep guard.
- All three screens render correctly in dark + light mode with no
  color-contrast regression vs TS PWA.
- Tab order is Today / Train / History / Progress / Settings (per
  Architecture §6.1 and Cross-review §14 #20).

### Tests

- `PlanViewPresenterTests.swift` — given a fixture, presenter output
  matches expected.
- `HistoryListViewModelTests.swift` — given a fixture, the list
  ordering and per-session badges match expected.
- `ProgressChartDataTests.swift` — given a fixture, the chart series
  and PR list match expected.
- `E1RMEngineParityTests.swift` — fixture-equal e1RM estimates for
  representative session histories.
- `tests/iosReadOnlyScreensStaticGuards.test.ts` (new, TS side) —
  greps: (a) no Swift file in `Screens/` reads
  `AppData.exercises[].suggestion` etc.; (b) every screen uses
  `CleanAppDataView` or `decision.userFacing.*`; (c) tab order
  matches the canonical 5-tab list.

### Manual iPhone smoke

Boot with iOS-0 fixture seeded → navigate Plan / History / Progress.
Confirm partial-completion badge appears on partial fixture sessions
(matches TS); e1RM chart renders for at least one exercise (e.g.
`lat-pulldown`); no crash, no console error. Verify Plan is rendered
inside the Progress tab as a sub-route (NOT a top-level tab).

### Risks

- Charting — SwiftUI Charts (iOS 16+) is the choice; min iOS target
  iOS 17 locked in iOS-1.
- Over-scoping — V1 is strictly read-only; no edit/delete affordances.
- Plan-as-sub-route navigation (Cross-review revision M9 + Architecture
  Agent §6.4): documented as an intentional choice with rollback path,
  not a default; if a future agent wants to split Plan into a top-level
  tab, that is a new V2 task with its own planning doc.
- Premature i18n — match the TS app's existing zh/en mix; no new
  translation system.
- Premature a11y ramp-up — V1 ships VoiceOver labels on interactive
  elements; custom rotor / audio descriptions deferred.

### Merge / release rule

- One PR for the planning doc, one PR for the implementation.
- Title: `iOS-6 Plan / History / Progress Native Screens V1`.
- Branch name: `claude/ios-6-plan-history-progress-native-screens-v1`.
- Must include `docs/ios-native-migration/IOS_6_PLAN_HISTORY_PROGRESS_NATIVE_SCREENS_V1.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.**
- iOS-5 and iOS-6 can both ship before iOS-7.

---

## iOS-7 Explicit Cloud Sync iOS V1

### Goal

Port the TS V3/V4/V5 cloud sync contract to iOS — explicit user action
only, no background sync, no silent overwrite, no fake success. The
iOS app reuses the same Supabase backend and the same
`cloud_appdata_snapshots` table. Preserves Contract Freeze §5, §6, §7
verbatim. Includes the in-app account deletion flow (Cross-review
revision H3 + Stop Condition #10).

### Non-goals

- No background sync. Period.
- No silent overwrite of cloud snapshots on conflict.
- No automatic conflict resolution. Conflicts surface as an explicit
  UI choice.
- No multi-device merge logic — V1 contract is "last writer wins after
  explicit user choice".
- No CloudKit. The cloud backend is Supabase, same as the TS app.
- No partial-AppData upload — the upload-eligibility guard rejects
  partially-repaired data.
- No analytics SDK.
- No `delete` / `update` on `cloud_appdata_snapshots` from the client
  (the table is append-only).

### **Required user decision before this task can start (Cross-review H2)**

iOS-7 cannot open its planning doc until the user explicitly chooses
**one** of the three paths below. This is a blocking gate on iOS-7,
not a runtime detail. The choice gates which Likely Files / Acceptance
Criteria apply.

- **Path A — Approve `supabase-swift` as the one allowed SwiftPM
  dependency.** Pros: official Keychain-backed storage, automatic
  GoTrue token refresh, security-reviewed crypto, Cloud Agent §4
  recommendation. Cons: external dependency, version-pin pain. If
  chosen, iOS-7 plan doc records the approval verbatim, the
  `Package.swift` of `IronPathCloudSync` adds the dependency, and a
  test pins the version.
- **Path B — Hand-roll GoTrue + REST in plain `URLSession` + Swift
  `Codable`.** Pros: no third-party dependency (matches Stop Condition
  #10); the wire contract in Contract Freeze §5 does not depend on
  the SDK. Cons: hand-rolling auth is security-sensitive; PKCE / token
  refresh / Keychain integration must be audited per-bug. Cloud Agent
  §4.1 last paragraph acknowledges this is acceptable: "If the
  Supabase Swift SDK is later judged unsuitable … we can defer the SDK
  choice. The wire contract … does not depend on the SDK".
- **Path C — Defer cloud sync entirely from V1.** Ship local-only iOS
  V1; cloud sync becomes V1.5 / V2. If chosen, iOS-7 is rescheduled to
  V1.5 and iOS-9 / iOS-10 ship without cloud sync (which means in-app
  account deletion is **NOT** required per H3 / Security Agent §10.1,
  because no account is created in the app). This is the
  lowest-blocker path.

### Likely files / project area (assuming Path A or B)

- `Packages/IronPathCloudSync/Sources/IronPathCloudSync/` —
  `CloudSyncService.swift`, `CloudSyncGateway.swift` (protocol),
  `SupabaseGateway.swift` (concrete impl — Path A or B),
  `CloudUploadEligibilityGuard.swift` (Swift mirror of
  `uploadEligibilityGuard.ts`),
  `CloudUploadOrchestrator.swift` (Swift mirror of
  `runProductionFullAcceptanceSync`),
  `CloudConflictResolver.swift` (explicit user choice — V3 banner
  pattern),
  `IdentityProvider.swift` (auth surface).
- `IronPathApp/Screens/Settings/AccountAndSync/` —
  `CloudSyncSettingsView.swift`, `SignInView.swift`,
  `ConflictReviewView.swift`, `AccountDeletionView.swift` (H3 — in-app
  deletion flow).
- `supabase/functions/account-delete/` — Edge Function for
  service-role-keyed deletion (or `SECURITY DEFINER` Postgres function),
  invoked from the client with the authenticated user's `auth.uid()`
  (Security Agent §10.3). Server-side task tracked under iOS-7.
- `Tests/` —
  `CloudUploadEligibilityGuardTests.swift`,
  `CloudConflictResolverTests.swift`,
  `CloudSyncOptimisticConcurrencyTests.swift`,
  `CloudSubsequentUploadFlowTests.swift`,
  `FirstUploadExplicitApplyTests.swift`,
  `AccountDeletionFlowTests.swift` (H3).
- `docs/ios-native-migration/IOS_7_EXPLICIT_CLOUD_SYNC_V1_PLAN.md`
  merged before implementation (records the H2 path).
- `docs/ios-native-migration/IOS_7_EXPLICIT_CLOUD_SYNC_V1.md`.
- `docs/ios-native-migration/IOS_7_EXPLICIT_CLOUD_SYNC_LOCK_V1.md` (lock
  doc once stabilises).

### Dependencies

- **User decision on H2 path (blocking).**
- iOS-5 merged (so there is local data to upload).
- iOS-3 merged (so eligibility guard is available).
- iOS-6 merged (so users have a UI to see what they are uploading).

### Acceptance criteria

- Upload happens ONLY on explicit "Upload to Cloud" tap — no automatic
  upload, no `BGTaskScheduler` / `BGAppRefreshTask` registration.
- Upload blocked when
  `CloudUploadEligibilityGuard.evaluate(appData:source:snapshotKind:)`
  returns `ok: false` — passive status with reason; banner / inline
  row only, no modal.
- V5 mandatory fresh-read preflight: before any insert, the client
  calls `gateway.readLatestSnapshot(...)`. Throw →
  `.remoteUnavailable`; returned hash mismatch → `.remoteChanged`.
- Conflict detection: 10 conflict types preserved (`local_newer`,
  `cloud_newer`, `both_changed`, `owner_mismatch`, `schema_mismatch`,
  `cloud_missing`, `local_missing`, `backend_primary_mismatch`,
  `session_account_mismatch`, `device_identity_mismatch`). Each with
  the right severity / UI tone.
- Conflict resolution UI: three explicit choices
  (`Overwrite cloud / Keep cloud, discard local / Cancel`); default
  is `Cancel`. No silent merge.
- Restore (download): explicit "Restore from Cloud" tap →
  `AppDataIngressPipeline.processIncoming` runs on downloaded snapshot
  before persisting.
- Wire-contract identical to Contract Freeze §5 (same JSON shape,
  column names, RLS rules).
- Local cloud receipt slot:
  `UserDefaults` scoped to `auth.uid()` (Cross-review M5), NOT inside
  `AppData.settings`.
- **In-app account deletion (H3)**: a "Delete account" entry under
  `设置 → 账号与同步 → 删除账号` (Security Agent §10.2 sample
  location). Functional spec: show what will be deleted; offer "Export
  my data first"; final confirmation (type "DELETE" or hold-to-confirm);
  invokes server-side Edge Function (or `SECURITY DEFINER` function);
  receipt to `cloud_export_delete_requests` (when wired); local sign-out;
  no soft-delete grace period in V1.
- No offline-write capability — uploads only when device is online.
- No service-role key in iOS bundle (build-phase scan).
- Email/password Supabase signup only — no Sign in with Apple in V1
  (Contract Freeze §5 + Security Agent §8 R7).

### Tests

- `CloudUploadEligibilityGuardTests.swift` — port every TS test in
  `tests/uploadEligibilityGuard*.test.ts`.
- `CloudConflictResolverTests.swift` — covers all 3 user choices and
  10 conflict types.
- `CloudSyncOptimisticConcurrencyTests.swift` — port
  `tests/cloudOptimisticConcurrencyV5Behavior.test.ts`.
- `CloudSubsequentUploadFlowTests.swift` — port
  `tests/cloudSubsequentUploadFlowBehavior.test.ts`.
- `FirstUploadExplicitApplyTests.swift` — port
  `tests/firstUploadExplicitApply.test.ts`. The contract is `no
  download, no apply, no local mutation`.
- `AccountDeletionFlowTests.swift` (H3) — happy path: server
  acknowledges, client signs out, local AppData preserved (NOT deleted
  by default; user can opt to also delete local). Sad path: server
  rejects, client surfaces banner.
- `tests/iosCloudSyncStaticGuards.test.ts` (new, TS side) — (a) no
  Swift file under `Packages/IronPathCloudSync/` schedules a
  background task; (b) no Swift file imports `BackgroundTasks`
  framework; (c) every upload call site imports
  `CloudUploadEligibilityGuard`; (d) no `update` / `delete` / `upsert`
  method on `CloudSyncGateway`; (e) the account deletion entry point
  exists under `IronPathApp/Screens/Settings/AccountAndSync/`.

### Manual iPhone smoke

1. Log in via Supabase email/password.
2. Run a session on iOS, finalise, tap "Upload to Cloud" — succeeds.
3. From PWA on a second device (same account), run + upload a
   different session.
4. Tap "Upload to Cloud" on iOS again — conflict UI surfaces; verify
   all three choices (Cancel / Overwrite / Keep cloud).
5. Tap "Restore from Cloud" — local AppData replaced after ingress
   pipeline; zero new Data Health repairs.
6. Sign out; verify local AppData is preserved (NOT deleted).
7. Sign in as a different account; verify the per-`auth.uid()` slot
   prevents the previous account's receipt from being reused.
8. Trigger account deletion via Settings → Account & Sync → Delete
   account: type "DELETE", confirm; verify server acknowledges,
   client signs out, no auth session remains.
9. Verify the build does not register any `UIBackgroundModes` slot
   beyond what Architecture Agent §10 explicitly justifies (likely
   empty).

### Risks

- Auth — V1 uses Supabase email/password via PKCE; no biometric / SIWA
  (V2). Token refresh on cold start; if refresh fails, prompt re-auth
  (no silent logout).
- Premature background sync — `BackgroundTasks` framework forbidden by
  static guard.
- Premature CloudKit — V1 is Supabase only.
- App Store review — remote-server use disclosed in iOS-10 nutrition
  label and reviewer notes; in-app account deletion (H3) addresses
  Guideline 5.1.1(v).
- Hash parity drift between Swift and TS — gated by
  `AppDataSnapshotHashParityTests` (already shipped in iOS-3).
- ISO timestamp serialisation drift (Contract Freeze §1) — gated by
  storing timestamps as `String`, never `Date`.
- Service-role key in bundle — forbidden; build-phase scan blocks.
- Account-deletion server-side mechanism (Edge Function vs Postgres
  function) — orchestrator owns this choice; design recorded in the
  iOS-7 planning doc.

### Merge / release rule

- One PR for the planning doc (records the H2 path), one PR for the
  implementation, one PR for the lock doc.
- Title: `iOS-7 Explicit Cloud Sync iOS V1`.
- Branch name: `claude/ios-7-explicit-cloud-sync-v1`.
- Must include `docs/ios-native-migration/IOS_7_EXPLICIT_CLOUD_SYNC_V1.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.** If Path A is
  chosen, the user approval is captured in the planning doc as the
  one sanctioned dependency.
- iOS-8 may proceed in parallel with iOS-7 once iOS-5 is merged.

---

## iOS-8 HealthKit Adapter V1

### Goal

Add a HealthKit read-only adapter so the iOS app can pull body weight,
heart-rate, HRV, sleep, steps, and active energy samples into AppData
for readiness scoring. Read-only — no write-back. Preserves Contract
Freeze §10 (Health data freshness contract) verbatim.

### Non-goals

- **No HealthKit write permission requested.** Read-only V1 (Stop
  Condition #9 — DO NOT request HealthKit write permission unless a
  feature actually writes back).
- No background HealthKit observation. Read on app foreground only.
- No "Apple Watch companion app" — V1 is iPhone only.
- No new readiness logic — the data feeds existing
  `staleHealthReadinessGuardV1` (already ported in iOS-3) and existing
  readiness signals (already ported in iOS-4).
- No analytics SDK.
- No XML import path. The PWA's
  `appleHealthXmlImportEngine.ts` is **not ported in V1** (Architecture
  Agent §8.4); P2 reserved.

### Likely files / project area

- `Packages/IronPathHealthKit/Sources/IronPathHealthKit/` —
  `HealthKitAdapter.swift` (protocol),
  `RealHealthKitAdapter.swift` (concrete impl over `HKHealthStore`),
  `HealthKitImporter.swift` (converts `HKQuantitySample` /
  `HKWorkout` to IronPath's `HealthMetricSample` /
  `ImportedWorkoutSample`),
  `HealthKitPermissionsView.swift`.
- `IronPathApp/Resources/Info.plist` — add
  `NSHealthShareUsageDescription` **only**.
  **No `NSHealthUpdateUsageDescription`.**
- `IronPath.xcodeproj/project.pbxproj` — add HealthKit capability
  (read-only; **no** `com.apple.developer.healthkit.background-delivery`).
- `Tests/` — `HealthKitImporterTests.swift`,
  `HealthKitPermissionFlowTests.swift`,
  `HealthKitDataLocalOnlyParityTests.swift` (HK samples never enter
  `buildAppDataSnapshotHash`; Security Agent §8 R9).
- `docs/ios-native-migration/IOS_8_HEALTHKIT_ADAPTER_V1_PLAN.md` merged
  before implementation.
- `docs/ios-native-migration/IOS_8_HEALTHKIT_ADAPTER_V1.md`.

### Dependencies

- iOS-5 merged (so the Today screen can consume HK readiness signals).
- iOS-3 merged (`staleHealthReadinessGuardV1` provides the freshness
  rule).

### Acceptance criteria

- "Connect HealthKit" tap → permission sheet asks ONLY for read scopes
  (the 11 types listed in Contract Freeze §10).
- Permission is NOT requested at app launch — only on explicit opt-in
  (matches PWA pattern of explicit user action).
- Pre-prompt explainer screen renders before the system sheet
  (Architecture Agent §8.2 + Security Agent §4.1).
- Foreground refresh pulls last 14 days into AppData and triggers the
  data-health pipeline (running on the cleaned view).
- Denied permission → app still works using subjective readiness
  inputs.
- Info.plist contains ONLY `NSHealthShareUsageDescription` (Chinese
  copy per Contract Freeze §10). **NO `NSHealthUpdateUsageDescription`.**
  Entitlements do NOT enable
  `com.apple.developer.healthkit.background-delivery`. Both enforced
  by static guards.
- HK samples ingested with the same raw-attr allow-list as the TS XML
  parsers (`type, sourceName, unit, startDate, endDate, value,
  workoutActivityType, duration, durationUnit`). Drop everything else
  at the boundary.
- HK samples never enter the cloud snapshot hash
  (`HealthKitDataLocalOnlyParityTests`).

### Tests

- `HealthKitImporterTests.swift` — given mock HK samples, the importer
  produces an `AppData.healthMetricSamples`-shaped payload that
  matches the TS `appleHealthTypeMap` map.
- `HealthKitPermissionFlowTests.swift` — UI test confirming the
  permission sheet text and scopes.
- `HealthKitDataLocalOnlyParityTests.swift` — HK samples never enter
  `buildAppDataSnapshotHash`.
- `tests/iosHealthKitStaticGuards.test.ts` (new, TS side) — (a)
  `Info.plist` does NOT contain `NSHealthUpdateUsageDescription`; (b)
  entitlements file does NOT enable background delivery; (c) no Swift
  file calls `HKHealthStore.requestAuthorization(toShare:read:)` with
  a non-empty `toShare`.

### Manual iPhone smoke

On a real iPhone with HealthKit populated (body weight, HR from Apple
Watch) tap "Connect HealthKit" — system sheet shows only read scopes;
approve → readiness screen uses imported data. On a second device, deny
permission → app still functions. Verify `staleHealthReadinessGuardV1`
marks > 14d-old samples correctly. Verify in iOS Settings → Privacy →
Health that IronPath's listed permissions are read-only and do not
include any write scopes.

### Risks

- App Store review on HealthKit copy — descriptions reviewed in iOS-10
  reviewer notes.
- Background delivery — forbidden by Stop Condition #9 + static guard.
- Write-back — forbidden by Stop Condition #9 + Info.plist guard.
- Multi-device HealthKit — V1 is iPhone-only; no cross-device merge.
- HealthKit authorisation revocation: iOS does not notify on revoke;
  every fetch checks `currentAuthorizationStatus` first and surfaces
  a "重新授权 Apple 健康" banner if denied (Architecture Agent §13.6).

### Merge / release rule

- One PR for the planning doc, one PR for the implementation.
- Title: `iOS-8 HealthKit Adapter V1`.
- Branch name: `claude/ios-8-healthkit-adapter-v1`.
- Must include `docs/ios-native-migration/IOS_8_HEALTHKIT_ADAPTER_V1.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.**

---

## iOS-9 TestFlight Internal Acceptance V1

### Goal

Submit the iOS app to TestFlight for internal acceptance testing. The
deliverable is a checklist of green gates and a TestFlight build link.

### Non-goals

- No public TestFlight beta yet.
- No App Store submission (iOS-10).
- No new feature work.
- No analytics SDK.

### Likely files / project area

- `docs/ios-native-migration/IOS_9_TESTFLIGHT_INTERNAL_ACCEPTANCE_V1.md`
  (new) — checklist + build link.
- `docs/ios-native-migration/IOS_9_TESTFLIGHT_TEST_PLAN.md` (new) — 15+
  scenarios.
- No code changes beyond `Info.plist` version + build number bumps.

### Dependencies

- iOS-5 merged.
- iOS-6 merged.
- iOS-7 merged (or H2 Path C chosen — defer cloud).
- iOS-8 merged.
- iOS-3 merged.
- iOS-4 merged.

### Acceptance criteria

- All iOS-0 through iOS-8 PRs merged (with H2 Path A or B; if Path C,
  iOS-7 deferred to V1.5 and noted in the planning doc).
- Full Swift test suite green; full TS test suite green; all
  `tests/ios*StaticGuards.test.ts` green.
- App builds in Release config with zero warnings.
- Real-iPhone end-to-end smoke run: cold-start → log a full workout
  (1 warmup + 3 working sets across 3 exercises) → end normally →
  verify in History → Upload to Cloud → Restore from Cloud on a
  freshly-installed instance → HealthKit permission flow (read-only)
  → Account deletion flow (H3) end-to-end.
- No crash logs in Xcode Organizer for the test build.
- App Store Connect upload succeeds; TestFlight build distributed to
  the internal testers group.
- Internal testers complete the 15+ scenario test plan in
  `IOS_9_TESTFLIGHT_TEST_PLAN.md`.
- No external observability library bundled (verified by inspecting
  the linked frameworks in the `.ipa`).
- No `URLSession` request fires before the user has explicitly tapped
  a cloud-sync or sign-in action.
- No `HealthKit` request fires before the user has explicitly opted
  in.
- No `UIBackgroundModes` set beyond what Architecture Agent §10
  explicitly justifies (likely empty).
- Forbidden-copy scan run on the shipped resources — green (Contract
  Freeze Appendix B).

### Tests

- All Swift unit tests under `Packages/*/Tests/` and
  `Tests/IronPathAppTests/`.
- All TS static guards under `tests/ios*StaticGuards.test.ts`.
- Manual test plan checklist in `IOS_9_TESTFLIGHT_TEST_PLAN.md` — 15+
  scenarios, all checked.

### Manual iPhone smoke

The full TestFlight test plan, run on 3+ real iPhones (different iOS
versions: 17, 18 if available). The 12-flow checklist from QA Agent
§7 (Flow 1 install + first launch, Flow 2 first-launch auto-repair,
Flow 3 log a single set, Flow 4 finish a full session, Flow 5 export
backup, Flow 6 import backup, Flow 7 explicit cloud upload, Flow 8
explicit cloud download, Flow 9 offline mode, Flow 10 force-quit
during write, Flow 11 battery/storage budget smoke, Flow 12
forbidden-copy scan).

### Risks

- ASC upload rejection — dry-run with `xcrun altool` before the
  official upload.
- HealthKit permission misconfiguration — iOS-8 static guards.
- Cold-launch crash with empty AppData — iOS-5 empty-AppData smoke
  test.
- TS / Swift output drift at scale — TestFlight test plan compares
  PWA + iOS history on the same account.

### Merge / release rule

- One PR (docs only — the deliverable IS the TestFlight build; the PR
  records the gate).
- Title: `iOS-9 TestFlight Internal Acceptance V1`.
- Branch name: `claude/ios-9-testflight-internal-acceptance-v1`.
- Must include both `IOS_9_TESTFLIGHT_INTERNAL_ACCEPTANCE_V1.md` and
  `IOS_9_TESTFLIGHT_TEST_PLAN.md`.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.**
- iOS-10 may NOT open until this PR is merged AND the TestFlight build
  has passed the internal test plan.

---

## iOS-10 App Store Readiness V1

### Goal

Submit the iOS app to the public App Store for review. The deliverable
is the App Store Connect listing, the privacy nutrition label, the
marketing copy, and the screenshot set. **In-app account deletion**
(H3) is explicit in the readiness checklist.

### Non-goals

- No new feature work.
- No new SDK additions.
- No analytics SDK.
- No new HealthKit scopes.
- No CloudKit.
- No subscription / IAP in V1 (free-to-use, matching the PWA).
- No localisation beyond zh-Hans + en in V1.

### Likely files / project area

- `docs/ios-native-migration/IOS_10_APP_STORE_READINESS_V1.md` (new) —
  checklist + reviewer-facing notes.
- `docs/ios-native-migration/IOS_10_APP_STORE_PRIVACY_NUTRITION_LABEL.md`
  (new) — exact nutrition-label entries.
- `docs/ios-native-migration/IOS_10_APP_STORE_REVIEWER_NOTES.md` (new)
  — explains HealthKit usage in detail to head off rejection.
- `docs/ios-native-migration/IOS_10_APP_STORE_SCREENSHOTS_PLAN.md`
  (new) — screenshot set for iPhone 6.5" + 6.7".
- `IronPathApp/Resources/Info.plist` — version + build number bumps.

### Dependencies

- iOS-9 merged.
- TestFlight internal acceptance passed.

### Acceptance criteria

- iOS-9 acceptance passed.
- App Store Connect listing complete: name, subtitle, description,
  keywords, category (Health & Fitness), age rating, marketing /
  support URLs, screenshots for iPhone 6.5" + 6.7".
- Privacy nutrition label accurately reflects:
  - Health & Fitness data read from HealthKit (Linked to user, used
    for app functionality, NOT used for tracking).
  - Identifiers — User ID (Linked) when cloud sync is enabled.
  - Contact Info — Email Address (Linked) only if user signs up for
    cloud sync.
  - User Content — workout data (Linked).
  - **No advertising data. No third-party analytics. No tracking.**
- Reviewer notes explain HealthKit scopes in plain language with the
  per-scope user benefit; state explicitly that HK data is read-only
  and processed on-device; state explicitly that cloud sync is opt-in
  and explicit, not background.
- **In-app account deletion flow (H3) is shipped and verifiable** by
  the App Store reviewer (Settings → 账号与同步 → 删除账号 → confirm).
- 3+ internal testers, 7+ days in TestFlight, zero critical bugs.
- All 11 Stop Conditions in Entry Gate §18 are green.
- Marketing copy reviewed by program owner; submission reaches
  "Waiting for Review".
- `ITSAppUsesNonExemptEncryption = NO` in `Info.plist` (Contract Freeze
  §10 + Security Agent §9).
- `NSUserTrackingUsageDescription` is **absent** (no tracking).
- App icon meets Apple HIG (no transparency, no rounded corners
  pre-applied, all required sizes).
- Support URL and Marketing URL both reachable and contain accurate
  IronPath information.
- Bundle ID confirmed unique in App Store Connect (no PWA collision).
- No `--admin` merge in the iOS PR history (verified by CI log scan).
- Program owner explicit sign-off on the submission PR.

### Tests

- All prior tests still green.
- `tests/iosAppStoreReadinessStaticGuards.test.ts` (new) — asserts:
  - no `NSHealthUpdateUsageDescription` in `Info.plist`;
  - no analytics SDK imports anywhere;
  - the privacy nutrition label doc lists no advertising data;
  - the reviewer notes doc exists;
  - `ITSAppUsesNonExemptEncryption = NO`;
  - the deletion-flow screen exists (Settings → Account & Sync →
    Delete account).

### Manual iPhone smoke

Install final TestFlight build on 3+ devices → run full test plan once
more → zero new Data Health repairs → one full end-to-end pass (login
→ log workout → upload → cloud restore on second device → account
deletion on third device) → ASC submission reaches "Waiting for
Review".

### Risks

- HealthKit rejection — most common fitness-app rejection cause;
  reviewer notes doc is explicit.
- "Background sync without disclosure" — N/A in V1 (no background
  sync); static guards confirm.
- "Account creation without in-app deletion" (Guideline 5.1.1(v)) —
  addressed by H3 + iOS-7 account deletion flow + iOS-10 acceptance
  checklist line.
- Marketing copy vs nutrition label mismatch — program owner final
  review.
- "Duplicates existing app" rejection if PWA is listed — confirm
  unique bundle ID in App Store Connect.
- Cloud sync rejection over hardcoded Supabase URL — reviewer notes
  explain.
- Privacy policy URL missing — required for any App Store submission;
  hosted at a project-owned domain.

### Merge / release rule

- One PR (docs only).
- Title: `iOS-10 App Store Readiness V1`.
- Branch name: `claude/ios-10-app-store-readiness-v1`.
- Must include all four docs above.
- PR review **required**.
- **No `--admin` merge.** **No auto-merge.**
- **No third-party SDK without explicit user approval.**
- Submission to App Review is gated on this PR being merged AND the
  program owner explicitly approving the submission.

---

## Appendix A — Per-PR pre-merge checklist (apply to every iOS-N PR)

- PR title is `iOS-N <Feature> V1` (or V1.5 / V2 etc.); PR body cites
  its planning doc by path.
- If a data-health surface is touched (iOS-3 specifically), the PR body
  answers the 10 questions in `docs/DATA_REPAIR_POLICY.md`.
- Local: `npm run typecheck`, `npm test`, `npm run build` all pass.
- Local: `xcodebuild build` (iOS-1+) and `xcodebuild test` (iOS-2+)
  pass.
- Every new Swift file is `Codable`-clean where applicable, has no
  force-unwraps outside tests, and has at least one paired unit test.
- No `--admin` merge, no `--no-verify`, no branch-protection bypass.
- No new third-party dependency unless explicitly approved (H2 path A).
- No new HealthKit scope unless the feature actually uses it.
- No new analytics SDK.
- No `BackgroundTasks` import.
- All `tests/ios*StaticGuards.test.ts` green.
- The PR does not touch the existing TS runtime (`src/`, `apps/api/src/`,
  `tests/`) except for the contract fixture export (iOS-0) and static
  guard tests.
- Stop conditions in front-matter re-checked.

## Appendix B — Per-PR rollback rule

- If iOS-9 TestFlight reveals a P0 bug, the affected iOS-N PR is
  reverted and re-opened with the fix.
- If iOS-10 App Review rejects the app, the rejection reason is
  mapped to one of the Stop Conditions in Entry Gate §18 OR a new
  task is opened (`iOS-10.1 <Fix> V1`).
- **No "fix forward" via `--admin` merge to bypass the test suite.
  Ever.**

---

End of Tasks V1.
