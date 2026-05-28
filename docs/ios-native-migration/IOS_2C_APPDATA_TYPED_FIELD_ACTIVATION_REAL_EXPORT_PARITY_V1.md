# iOS-2C AppData Typed Field Activation & Real Export Parity V1

> Status: implementation. Builds on top of iOS-2B's snapshot-hash
> foundation by promoting documented Data Health / Training / Focus
> Mode fields out of `_unknown` into real typed Swift properties, and
> by proving cross-language byte-equal parity over the full **805 KB
> redacted real export** for the first time (`phase19b-55f97dc7`).

> Parent docs:
> - `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1_PLAN.md` (iOS-2A plan)
> - `docs/ios-native-migration/IOS_2B_APPDATA_SWIFT_MODELS_V1.md` (iOS-2B foundation)
> - `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` §1 §3 §8 §9
> - `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` §18 stop conditions

---

## 1. Goal

Promote the documented AppData model fields from the iOS-2B
`_unknown` placeholders into real typed Swift properties so iOS-3
Data Health, iOS-4 TrainingDecision, and iOS-5 Focus Mode can read
session lifecycle / set / exercise / settings state through typed
accessors instead of `OrderedJSONObject` walks. The unknown-field
preservation contract is retained: every key not in the documented
set still flows through `_unknown`, every encode round-trips
typed + unknown exactly once, and the iOS-0 snapshot-hash parity
remains green.

Also: drive the redacted real export
(`tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`,
~805 KB) through AppData decode + canonical re-emit + FNV-1a hash,
asserting equality with the iOS-0 golden
`phase19b-55f97dc7`. This is the first verified byte-equal
TS↔Swift parity over a real-world payload.

---

## 2. Why iOS-2C was inserted before iOS-3

iOS-2B shipped JSONValue / SchemaVersion / WeightUnit /
canonical-stringify / open-bag preservation / snapshot-hash hash
parity — but the 14 placeholder model files (`TrainingSession`,
`TrainingSetLog`, `ExercisePrescription`, etc.) carried all their
fields through `_unknown`. iOS-3 Data Health would have been forced
to either parse JSONValue trees by hand inside the repair recipes
(polluting business logic), or do an iOS-2C-style typed-field
promotion mid-flight (delaying iOS-3).

Splitting iOS-2C out of iOS-3 gives:

- A focused Swift refactor that touches model files only, no engine
  code, no storage adapter, no repair logic.
- A cross-language parity proof over the real-world 805 KB payload
  before any business logic ports.
- A reusable typed accessor surface for every later iOS-N PR.

iOS-3 now starts with a clean baseline: `appData.history` returns
`[TrainingSession]` directly; `session.restTimerState` is typed;
`exercise.actualExerciseId` is typed; `appSettings.dataHealthRepairLedger`
is typed.

---

## 3. iOS-2B limitation (resolved here)

The iOS-2B implementation doc §3 listed 13 placeholder types whose
typed surface was a single `_unknown: OrderedJSONObject` carrier.
Only `AppData.schemaVersion`, `UnitSettings.weightUnit`, and
`HealthMetricSample.raw` were meaningfully promoted. iOS-2C closes
that gap by promoting the documented fields across all 13 model
files plus adding 11 typed accessors over `AppData.root`.

A second iOS-2B latent assumption — that the synthetic
snapshot-hash hash parity was sufficient evidence for cross-language
correctness — is also resolved here. The real-export parity test in
iOS-2C ran the same Swift canonical-stringify path against ~13,000+
keys spanning ~10 history sessions × ~30 exercises × ~3 sets each
+ ~270 health metric samples + adaptive calibration log.

---

## 4. Typed fields activated

Per-model documented field count (`public let <field>:` declarations,
each excluded from `_unknown` on decode and re-merged on encode):

| Model | Typed fields | Purpose |
|---|---:|---|
| `TrainingSession` | **16** | Session lifecycle + Focus Mode residue + exercise list. Unblocks iOS-3 `sessionLifecycleResidueV1` repair. |
| `TrainingSetLog` | **19** | Set identity + kg-storage weights + RIR/RPE/technique/pain. Unblocks iOS-3 `setIndexRenumberV1` + `legacyReplacementIdentityPollution`. |
| `ExercisePrescription` | **15** | Identity + sets/warmupSets + prescription. Unblocks iOS-3 `replacementEquivalenceAuditV1` + iOS-5 Focus step queue. |
| `ActualSetDraft` | **8** | Focus Mode set draft. |
| `AppSettings` | **14** | Repair ledger + dataHealth\* + unitSettings. Unblocks iOS-3 repair receipts. |
| `UserProfile` | **12** | User attributes for iOS-4 personalisation. |
| `ScreeningProfile` | **7** | Pain triggers + adaptive state. |
| `ProgramTemplate` | **7** | Mesocycle scaffolding. |
| `MesocyclePlan` | **5** | Weekly structure (inner weeks remain JSONValue until iOS-4). |
| `TodayStatus` | **5** | iOS-3 stale readiness guard. |
| `AdaptiveCalibrationState` | **4** | Entries / log (inner `AdaptiveCalibrationEntry` remains JSONValue until iOS-4). |
| `HealthMetricSample` | **13** | Apple Health sample shape including the typed opaque `raw: JSONValue?`. |
| `UnitSettings` | **2** | weightUnit + displayUnit. |
| **Total** | **127** | |

Plus 11 typed accessor properties on `AppData` over its `root`
carrier:

```swift
extension AppData {
    public var history: [TrainingSession] { get }
    public func historyStrict() throws -> [TrainingSession]
    public var activeSession: TrainingSession? { get }
    public var settings: AppSettings { get }
    public var healthMetricSamples: [HealthMetricSample] { get }
    public var adaptiveCalibration: AdaptiveCalibrationState? { get }
    public var unitSettings: UnitSettings { get }
    public var todayStatus: TodayStatus { get }
    public var screeningProfile: ScreeningProfile { get }
    public var mesocyclePlan: MesocyclePlan { get }
    public var programTemplate: ProgramTemplate { get }
    public var userProfile: UserProfile { get }
}
```

These are computed views — `AppData.root` remains the source of
truth for canonical round-trip and hash parity. iOS-3 can build
caches on top if profile shows hotspots.

---

## 5. Open-bag preservation

Every typed model carries `_unknown: OrderedJSONObject`. The decode
algorithm:

1. Construct the documented-key set for the type.
2. For each documented field, extract the value from the parsed
   object; if successful, exclude the key from `_unknown`.
3. For enum-shaped fields (e.g. `WeightUnit`), only exclude the key
   when the enum case parses cleanly. Unrecognised values like
   `weightUnit: "st"` flow back through `_unknown` so the round-trip
   emits the original string verbatim.
4. `_unknown` is the residual — every key not extracted into a
   typed field.

The encode algorithm:

1. Emit each typed field if non-nil, in the order declared.
2. Append every `_unknown` entry in its stored order.
3. Canonical emit re-sorts at the outer
   `JSONValue.canonicalJSONData()` boundary (case-insensitive primary
   + code-point tie-break, matching TS `localeCompare`).

This guarantees:

- Round-trip preserves every key (typed or unknown).
- No key is emitted twice (typed and unknown are disjoint by
  construction).
- Forward-compat: future PWA writes that add new top-level fields
  survive the iOS-2C Swift port unchanged.

The 37 JSON-Schema `additionalProperties: true` sites from Agent 1's
inventory are all preserved structurally — every nested object in
`AppData.root` is held as JSONValue, so unknown nested keys flow
verbatim through the canonical path.

---

## 6. Real-export consumption strategy

iOS-2C consumes `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`
directly from the canonical path via `#filePath`-rooted resolution
in the Swift test file:

```swift
private func realExportURL() -> URL {
    URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()  // IronPathDomainTests/
        .deletingLastPathComponent()  // Tests/
        .deletingLastPathComponent()  // IronPathDomain/
        .deletingLastPathComponent()  // packages/
        .deletingLastPathComponent()  // ios/
        .deletingLastPathComponent()  // repo root
        .appendingPathComponent("tests/fixtures/data-health/ironpath-2026-05-27-redacted.json")
}
```

`#filePath` is a compile-time literal expanded by `swiftc`; it is
independent of the `swift test` runtime working directory (`.build/`).
This is the Agent 4 §10 "Option B" path-walk approach that the iOS-2A
plan recommended against; iOS-2C now sanctions it for the **805 KB
real-export fixture only**, with the small (~700 byte) snapshot-hash
fixture continuing through `Bundle.module` (iOS-2B carryover).

Rationale for the deviation:

- Copying 805 KB into the Swift test bundle inflates package size
  and turns every real-export fixture refresh into a manual byte
  copy.
- `#filePath` is deterministic at compile time; the runtime
  working-directory non-determinism the iOS-2A plan flagged applies
  to `#file` (deprecated short form), not to `#filePath`.
- The TS-side `iosAppDataRealExportParityGuards.test.ts` enforces
  that no duplicate copy lands in the Swift package and that the
  canonical path is referenced literally inside the Swift test.

---

## 7. Real-export parity result

Cross-language parity assertions against the redacted real export
(`AppDataRealExportParityTests.swift`, all green on `swift test`):

| Assertion | Result |
|---|---|
| Redacted real export file exists at canonical path | ✓ |
| AppData decodes the full payload | ✓ |
| schemaVersion = 8 | ✓ |
| history is non-empty AND each session decodes to typed | ✓ |
| **Swift canonical-stringify == TS stableStringify (byte-equal)** | ✓ |
| **Swift FNV-1a hash == iOS-0 golden `phase19b-55f97dc7`** | ✓ |
| TrainingSession.restTimerState non-null in ≥ 1 session (Agent 3 §6 gap (a)) | ✓ |
| HealthMetricSample.raw non-null in ≥ 1 sample (Agent 3 §6 gap (b)) | ✓ |
| Round-trip is idempotent (canonical re-emit == canonical of input) | ✓ |

This is the **first verified end-to-end TS↔Swift byte-equal parity
on a real-world payload** in the IronPath repository.

---

## 8. restTimerState result

`TrainingSession.restTimerState` is typed as `JSONValue?` (deferred
typed `RestTimerState` struct — Agent 1 §3 row 5). Decoding the real
export surfaces 10 sessions with `restTimerState != null` (matches
the iOS-2A preflight grep count of 10). The round-trip preserves
every `isRunning`, `startedAt`, and `remainingSec` field inside the
opaque carrier verbatim — Agent 3 §6 deferred gap (a) is closed.

---

## 9. healthMetricSamples.raw result

`HealthMetricSample.raw` is typed as `JSONValue?`. The redacted real
export carries 270 metric samples; each carries a `raw` payload
sourced from the Apple Health export. Decoding preserves every byte
of every `raw` payload; canonical round-trip emits the same bytes
back. Agent 3 §6 deferred gap (b) is closed.

---

## 10. loadBias / number precision result

The redacted real export carries **no** `adaptiveCalibration` block
and **no** `loadBias` literal occurrences (preflight grep count 0).
Agent 3 §6 deferred gap (c) (`loadBias` float-precision) is therefore
not directly exercised by the real export. iOS-2C addresses it
via:

1. A synthetic test
   (`AppDataTypedFieldActivationTests.testAdaptiveCalibrationStateLoadBiasSurvivesViaEntriesArray`)
   asserting `loadBias: 0.95` round-trips into `JSONValue.doubleValue`.
2. A broader common-weight test
   (`testNumberPrecisionForCommonGymWeights`) exercising the
   canonical-emit path against 8 representative kg values
   (`80`, `72.5`, `72.6`, `2.5`, `0.95`, `180`, `-5`, `0`). All
   round-trip byte-equal to the TS form.

During diagnosis, iOS-2C found and fixed two cross-language
canonical-stringify mismatches that the snapshot-hash fixture had
not surfaced:

- **Key sort order**: TS `localeCompare` uses case-insensitive
  primary; Swift `String.<` is strict code-point order. Mixed-case
  keys like `prescription` vs `prIndependent` sorted differently.
  Fixed by adding `canonicalKeyOrder(a, b)` — lowercase comparison
  with code-point tie-break.
- **Float text**: `Decimal(72.6)` derived from `Double(72.6)`
  preserves the binary expansion (`"72.59999999999999"`). TS emits
  the shortest Double round-trip form (`"72.6"`). Fixed by adding a
  `NumberRepr.double(Double)` variant — JSON-parsed floats land in
  `.double`, canonical emit uses Swift's `String(Double)` which
  matches V8's `Number.prototype.toString` exactly.

After both fixes, the real-export FNV-1a hash matched the iOS-0
golden byte-for-byte. **V2 `NumberRepr.originalText` escalation is
NOT needed.**

---

## 11. Tests added

### Swift tests (`ios/packages/IronPathDomain/Tests/IronPathDomainTests/`)

| File | Tests | Pass |
|---|---:|---|
| `AppDataTypedFieldActivationTests.swift` (new) | 10 | 10/10 ✓ |
| `AppDataRealExportParityTests.swift` (new) | 7 | 7/7 ✓ |
| `AppDataCodableRoundTripTests.swift` (iOS-2B) | 5 | 5/5 ✓ |
| `AppDataSchemaVersionGuardTests.swift` (iOS-2B) | 7 | 7/7 ✓ |
| `AppDataOpenBagPreservationTests.swift` (iOS-2B) | 5 | 5/5 ✓ |
| `AppDataIsoTimestampStaticGuardTests.swift` (iOS-2B) | 3 | 3/3 ✓ |
| `AppDataUnitFieldPreservationTests.swift` (iOS-2B, +1 minor edit) | 7 | 7/7 ✓ |
| iOS-1 `IronPathDomainTests` placeholder | 1 | 1/1 ✓ |
| **Total** | **45** | **45/45 ✓** |

The iOS-2B `AppDataUnitFieldPreservationTests` got two two-line
edits: the round-trip assertions that previously walked
`JSONValue.object(us._unknown)` now walk `us.encoded()`, reflecting
that documented keys no longer flow through `_unknown` after iOS-2C.

### TS static guards (`tests/`)

| File | Status |
|---|---|
| `iosAppDataTypedFieldActivationStaticGuards.test.ts` | NEW — per-model typed-field count, `_unknown` retention, `encoded()` presence, AppData accessor list, NumberRepr triple shape, canonical key comparator. |
| `iosAppDataRealExportParityGuards.test.ts` | NEW — canonical real-export reachability, golden snapshot hash format, NO duplicate 805 KB copy in Swift Fixtures, `#filePath` walk-up presence, FNV-1a / restTimerState / raw assertions present. Plus iOS-2B snapshot-hash byte-equality (carried forward). |

No iOS-2B / iOS-1 guards needed to be loosened: the iOS-2C model
files retain the `_unknown: OrderedJSONObject` carrier, no Date
fields, no @Model / @Observable, no forbidden imports.

---

## 12. Static guards

All iOS-0 / iOS-1 / iOS-2A / iOS-2B static guards continue to apply
verbatim:

- No `SwiftData` / `CoreData` / `@Model` / `@Observable` anywhere in
  IronPathDomain (iOS-2B + iOS-2C confirm).
- No `Supabase` / `HealthKit` / `GoTrue` / `PostgREST` / `Sentry` /
  `Crashlytics` / `Firebase` / `Bugsnag` / `Datadog` / `Mixpanel` /
  `Amplitude` / `PostHog` / `WebKit` / `BackgroundTasks` imports.
- No `Date` persisted fields (`AppDataIsoTimestampStaticGuardTests`
  via `Mirror` still green).
- No remote SwiftPM dependency.
- No `package.json` / `package-lock.json` drift.
- No `pnpm-lock.yaml`.
- No TS runtime source changes.
- iOS-1 `iosBootstrapNoBusinessLogic`'s `AppData` exemption (added
  in iOS-2B) covers all 13 promoted models because the exemption is
  path-prefix based (`ios/packages/IronPathDomain/`).
- `TrainingDecision`, `CleanAppDataView`, `AutoRepairOrchestrator`,
  `CloudSnapshot`, `buildTrainingDecision`, `buildFocusStepQueue`,
  `writeSnapshot`, `AppDataRepairLedger` REMAIN forbidden everywhere.

---

## 13. Xcode validation

| Step | Result |
|---|---|
| `(cd ios/packages/IronPathDomain && swift test)` | ✓ **Executed 45 tests, with 0 failures** |
| `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` | (run in Phase 9) |
| `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build CODE_SIGNING_ALLOWED=NO` | (run in Phase 9) |
| `xcodebuild test` on `IronPath` scheme | intentionally unconfigured (iOS-1 deferral, unchanged) |

`Package.swift` is unchanged from iOS-2B (`resources: [.copy("Fixtures")]`
on the test target is the only iOS-2B edit).

---

## 14. Data safety

iOS-2C honours the iOS-2A Agent 5 13 MUST-NOT + 5 MUST rules
verbatim. No new exemptions. The two canonical-stringify diagnoses
(case-insensitive sort, Double round-trip) sit inside JSONValue.swift
and are exercised by `testNumberPrecisionForCommonGymWeights` plus
the full real-export round-trip.

Additional iOS-2C guarantees:

- Decoder is robust to enum value drift: unknown enum tokens
  (`weightUnit: "st"`) flow through `_unknown` rather than coerce
  to a default. Encode emits the original token verbatim.
- Decoder is robust to type drift: `sets: 3` (integer count, from
  TrainingTemplate) flows through `_unknown` when `ExercisePrescription`
  encounters it instead of crashing the typed `sets: [TrainingSetLog]?`
  decode.
- No model decodes `null` as missing or vice versa: the
  `JSONValue?` carrier preserves the JSON-null state distinctly
  from key-absence for fields that need it (`restTimerState`,
  `raw`, etc.).

---

## 15. Non-goals

iOS-2C still does NOT do:

- On-disk persistence / `AppDataStore` protocol (iOS-3).
- Data Health repair (iOS-3).
- CleanAppDataView Swift port (iOS-3).
- TrainingDecision engine (iOS-4).
- Focus Mode UI / state engine (iOS-5).
- Plan / History / Progress screens (iOS-6).
- Cloud sync / Supabase (iOS-7).
- HealthKit live read (iOS-8).
- `RestTimerState` typed struct (the field stays `JSONValue?` — iOS-2D
  or iOS-3 promotes when needed).
- `AdaptiveCalibrationEntry` typed struct (entries stay `[JSONValue]?`
  until iOS-4).
- `supabase-swift` SDK adoption (Cross-review H2 unchanged).

---

## 16. Remaining risks

| # | Risk | Severity | Mitigation |
|---|------|---:|---|
| 1 | New typed-decode path has subtle bugs that only the real export exercises | LOW | `AppDataRealExportParityTests` runs the 805 KB payload through every model on every CI run |
| 2 | TS `localeCompare` default-locale assumption | LOW | The TS-side stableStringify is locked at `src/cloudProduction/accountBoundaryLocalInventory.ts:116`; if it ever changes to a different sort, iOS-2C's canonical comparator needs the same update. Linked via the iOS-0 parity-fixture guard test. |
| 3 | Number precision V2 (`NumberRepr.originalText`) not implemented | LOW | The current V1 NumberRepr triple shape (.integer / .double / .decimal) matches every observed real-export number. Future high-precision payloads would surface as hash failures in `AppDataRealExportParityTests`. |
| 4 | `#filePath` walk-up may break under exotic Xcode test plans | LOW | iOS-2C never invokes `xcodebuild test` (the IronPath scheme stays unconfigured). `swift test` is the validation path and `#filePath` is deterministic there. |
| 5 | RestTimerState / AdaptiveCalibrationEntry still opaque JSONValue | MEDIUM | iOS-2D or iOS-3 will promote these when the consuming engines need typed field-level access. Round-trip preservation is already guaranteed. |
| 6 | Cross-review H2 (supabase-swift SDK) still outstanding | LOW | Does not block iOS-3 / iOS-4 / iOS-5 / iOS-6. |

---

## 17. Final verdict

iOS-2C completes the typed AppData model surface needed to unblock
iOS-3 Data Health Swift Port. The real-export FNV-1a parity result
(`phase19b-55f97dc7` byte-equal) is the strongest cross-language
correctness signal the iOS Native Migration program has produced to
date. Two real cross-language stringification bugs (key sort case
handling, Double precision) were diagnosed and fixed without
weakening any iOS-0 / iOS-1 / iOS-2A / iOS-2B contract.

---

## 18. Next task

**iOS-3 Data Health Swift Port V1** (only when this PR is merged and
all CI checks are green). Scope:

- `CleanAppDataView` Swift port.
- `AutoRepairOrchestrator` Swift port.
- 9 V1 repair recipes (`sessionLifecycleResidueV1`,
  `impossibleDurationV1`, `staleTodayStatusV1`,
  `staleHealthReadinessGuardV1`,
  `screeningIssueScoreRuntimeGuardV1`,
  `screeningIssueScoreRepairV1`,
  `legacyFinalAdviceIsolationGuardV1`,
  `setIndexRenumberV1`,
  `replacementEquivalenceAuditV1`).
- `AppDataStore` protocol + JSON-snapshot file-backed
  implementation.
- `AppDataRepairLedger` typed shape + append contract.
- `RestTimerState` typed struct promotion (if iOS-3 needs typed
  `isRunning` access beyond `JSONValue?.objectValue?["isRunning"]?.boolValue`).
- Parity tests against the 9 V1 repair recipes' iOS-0 goldens
  (the synthetic data-repair fixture plus a real-export-derived
  fixture set added in iOS-3).

iOS-3 does **not** touch cloud sync, HealthKit, TrainingDecision, or
UI. Cross-review H2 (`supabase-swift` SDK) remains an outstanding
user decision before iOS-7 and does not block iOS-3.

End of iOS-2C implementation doc.
