# iOS-2B AppData Swift Models V1 — Implementation

> Status: implementation. The 17 Swift model files declared in iOS-2A
> plan §5 are now under `ios/packages/IronPathDomain/`, the 5 Swift
> parity tests pass via `swift test`, the snapshot-hash parity
> fixture is copied + byte-equality-guarded, and the iOS-1
> no-business-logic guard is narrowly evolved to exempt the
> sanctioned model surface inside `IronPathDomain`. No business
> logic, no on-disk storage, no engine wiring, no cloud sync, no
> HealthKit — all deferred to iOS-3 / iOS-4 / iOS-5 / iOS-7 / iOS-8.

> Parent docs:
> - `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1_PLAN.md` (the iOS-2A plan)
> - `docs/ios-native-migration/IOS_2B_APPDATA_SWIFT_MODELS_IMPLEMENTATION_V1_TASK.md` (the iOS-2A task spec)
> - `docs/ios-native-migration/agents-ios-2a/AGENT_{1..5}_*.md` (5 scan reports)
> - `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` §1, §3, §8, §9
> - `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` §18 stop conditions

---

## 1. Goal

Materialise the iOS-2A plan: 17 hand-written Swift model files plus 5
parity tests inside `ios/packages/IronPathDomain/`. The implementation
proves three things:

1. **Round-trip parity.** `AppData.init(decoding:)` accepts the iOS-0
   snapshot-hash fixture's `payload`, and `AppData.canonicalJSONString()`
   reproduces the byte-equal canonical form that the TypeScript
   `stableStringify` emits at
   `src/cloudProduction/accountBoundaryLocalInventory.ts:116`.
2. **Hash parity.** The Swift FNV-1a (32-bit, seed `2166136261`,
   prime `16777619`) computed over the canonical string emits the
   exact iOS-0 golden hash `phase19b-611afec7` for the snapshot-hash
   fixture. This is the first verified TS↔Swift byte-equal contract
   in the IronPath repository.
3. **No regressions in iOS-0 / iOS-1.** Parity goldens still report
   `0 changed`. iOS-1 forbidden-import + no-business-logic guards
   evolve narrowly (`AppData` is sanctioned inside IronPathDomain only;
   `TrainingDecision`, `CleanAppDataView`, `AutoRepairOrchestrator`,
   `CloudSnapshot`, `buildTrainingDecision`, `buildFocusStepQueue`,
   `writeSnapshot`, `AppDataRepairLedger` REMAIN forbidden).

---

## 2. iOS-2A dependency confirmation

Base: `origin/main` @ `33b124c` (iOS-2A PR #395 merge).

| Check | Result |
|---|---|
| `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1_PLAN.md` | ✓ present |
| `docs/ios-native-migration/IOS_2B_APPDATA_SWIFT_MODELS_IMPLEMENTATION_V1_TASK.md` | ✓ present |
| 5 agent reports under `docs/ios-native-migration/agents-ios-2a/` | ✓ present |
| `ios/IronPath.xcworkspace` + `ios/IronPath.xcodeproj` (iOS-1) | ✓ present |
| `ios/packages/IronPathDomain/Package.swift` + placeholder source | ✓ present |
| `node scripts/generate-parity-goldens.mjs --check` | ✓ **0 changed** |

Hard preflight (per iOS-2A plan §19 condition 2) results:

| Probe | Count | Required | Result |
|---|---:|---:|---|
| `"restTimerState": {` in redacted real export | **10** | ≥ 1 | ✓ pass |
| `"healthMetricSamples": […non-empty…]` | array starts at line 23633 with at least one sample carrying `raw` | non-empty | ✓ pass |
| `"raw":` non-null | **85** | ≥ 1 | ✓ pass |

All three conditions met; iOS-2B proceeded without the
`synthetic-open-bag-edge-v1.json` escalation.

---

## 3. Files implemented

### 17 Swift model files (`ios/packages/IronPathDomain/Sources/IronPathDomain/`)

| File | Public type | Notes |
|---|---|---|
| `JSONValue.swift` | `enum JSONValue` + `OrderedJSONObject` + `NumberRepr` + `GenericCodingKey` + `JSONValueError` | Hand-written; canonical-stringify implementation matches TS `stableStringify` |
| `SchemaVersion.swift` | `struct SchemaVersion` + `enum SchemaVersionError` | Refusal contract: `< 8 → upgradeRequired`, `> 8 → futureIncompatible` |
| `WeightUnit.swift` | `enum WeightUnit: String` | `.kg` / `.lb`, display only |
| `AppData.swift` | `struct AppData` | typed `schemaVersion` + full-tree `root: OrderedJSONObject` |
| `AppSettings.swift` | `struct AppSettings` | open-bag carrier (TS index signature site) |
| `UserProfile.swift` | `struct UserProfile` | placeholder |
| `TrainingSession.swift` | `struct TrainingSession` | placeholder |
| `TrainingSetLog.swift` | `struct TrainingSetLog` | placeholder |
| `ActualSetDraft.swift` | `struct ActualSetDraft` | placeholder |
| `ExercisePrescription.swift` | `struct ExercisePrescription` | placeholder |
| `MesocyclePlan.swift` | `struct MesocyclePlan` | placeholder |
| `ScreeningProfile.swift` | `struct ScreeningProfile` | placeholder |
| `ProgramTemplate.swift` | `struct ProgramTemplate` | placeholder |
| `HealthMetricSample.swift` | `struct HealthMetricSample` | exposes typed `raw: JSONValue?` for the open-bag payload |
| `UnitSettings.swift` | `struct UnitSettings` | exposes typed `weightUnit: WeightUnit?` for the UnitFieldPreservation test |
| `TodayStatus.swift` | `struct TodayStatus` | placeholder |
| `AdaptiveCalibrationState.swift` | `struct AdaptiveCalibrationState` | placeholder |

All 17 placeholder types carry `_unknown: OrderedJSONObject` so future
iOS-N PRs can promote documented fields without breaking round-trip.
None declares any `Date` property. None uses `@Model` or `@Observable`.
None imports `SwiftData`, `CoreData`, `HealthKit`, `Supabase`,
analytics SDKs, or `URLSession`.

The iOS-1 placeholder `IronPathDomain.swift` (with
`IronPathDomainVersion.value == "0.0.1-bootstrap"`) is preserved
unchanged.

### 5 Swift parity test files (`ios/packages/IronPathDomain/Tests/IronPathDomainTests/`)

| File | Tests | Pass |
|---|---:|---|
| `AppDataCodableRoundTripTests.swift` | 5 | 5/5 ✓ |
| `AppDataSchemaVersionGuardTests.swift` | 7 | 7/7 ✓ |
| `AppDataOpenBagPreservationTests.swift` | 5 | 5/5 ✓ |
| `AppDataIsoTimestampStaticGuardTests.swift` | 3 | 3/3 ✓ |
| `AppDataUnitFieldPreservationTests.swift` | 7 | 7/7 ✓ |
| Total new Swift parity assertions | **27** | **27/27 ✓** |

Plus the iOS-1 placeholder `IronPathDomainTests.testVersionIsBootstrap`
still passes → **28/28 total** across `swift test`.

### 2 fixture files (`ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/`)

- `snapshot-hash-stable-v1-input.json` (byte-identical to `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json`)
- `snapshot-hash-stable-v1-golden.json` (byte-identical to `tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json`)

### `Package.swift` — one-line edit

```diff
- .testTarget(name: "IronPathDomainTests", dependencies: ["IronPathDomain"]),
+ .testTarget(
+     name: "IronPathDomainTests",
+     dependencies: ["IronPathDomain"],
+     resources: [.copy("Fixtures")]
+ ),
```

The other 7 packages (`IronPathDataHealth` / `IronPathPersistence` /
`IronPathCloudSync` / `IronPathHealthKit` / `IronPathBackup` /
`IronPathL10n` / `IronPathUIKit`) are NOT touched.

### 3 TypeScript static-guard tests (`tests/`)

| File | Assertions |
|---|---:|
| `iosAppDataSwiftModelStaticGuards.test.ts` | each of 17 required model files exists + declares matching public type; no `: Date` field; no `@Model` / `@Observable` |
| `iosAppDataNoSwiftDataCoreDataGuards.test.ts` | no `import SwiftData` / `CoreData` / `HealthKit` / `Supabase` / `GoTrue` / `PostgREST` / `Sentry` / `Crashlytics` / `Firebase` / `Bugsnag` / `Datadog` / `Mixpanel` / `Amplitude` / `PostHog` / `WebKit` / `BackgroundTasks`; `Package.swift` declares no remote dependency and has exactly the `resources: [.copy("Fixtures")]` edit |
| `iosAppDataFixtureParityDocsGuard.test.ts` | byte-equality between Swift `Fixtures/` copies and canonical iOS-0 parity fixtures |

### iOS-1 test evolution

- `tests/iosBootstrapNoBusinessLogic.test.ts`: the
  `AppData_struct_or_class` entry now carries an `exemptPrefixes:
  ['ios/packages/IronPathDomain/']` field. The per-package
  "version-constant-only" assertion comment updated to document the
  IronPathDomain expansion. No other entries (`TrainingDecision`,
  `buildTrainingDecision`, `CleanAppDataView`,
  `AutoRepairOrchestrator`, `AppDataRepairLedger`, `CloudSnapshot`,
  `writeSnapshot`, `buildFocusStepQueue`) change — they REMAIN
  forbidden.
- `tests/iosBootstrapForbiddenImports.test.ts`: unchanged.
- `tests/iosAppDataSwiftModelsPlanDocsParity.test.ts` (iOS-2A
  planning-only guard): the two assertions that locked "no Swift
  models / no Fixtures/ in iOS-2A" evolve to "if Swift models /
  Fixtures/ exist, the iOS-2B implementation doc must accompany
  them". Same pattern used in iOS-1 / iOS-2A evolutions on `ios/`.

---

## 4. JSONValue design

Per Agent 2 §3. Hand-written enum with associated values:

```swift
public enum JSONValue {
    case null
    case bool(Bool)
    case number(NumberRepr)     // .integer(Int64) | .decimal(Decimal)
    case string(String)
    case array([JSONValue])
    case object(OrderedJSONObject)
}

public struct OrderedJSONObject {
    public let entries: [Entry]
    public subscript(_ key: String) -> JSONValue?
    public var keys: [String]
    public func canonicalized() -> OrderedJSONObject  // lexically sorted by key
}
```

Foundation interop:

- `JSONValue.init(decoding: Data)` uses
  `JSONSerialization.jsonObject(with:options:[.fragmentsAllowed])`
  then recursively maps the Foundation `Any` into the enum cases.
- Decode preserves no input order — `OrderedJSONObject(fromFoundation:)`
  sorts ingest keys alphabetically. The round-trip contract
  compares canonical-stringified bytes on both sides, so order is
  irrelevant.

Canonical emit (`canonicalJSONData()`):

- Object keys sorted lexicographically.
- No whitespace.
- Numbers emitted via `canonicalDecimalString()` — integral decimals
  collapse to integer form (matching TS `JSON.stringify`'s `42.0 → "42"`).
- Strings escaped per RFC-8259 (the subset IronPath actually uses).
- The `<` / `>` / `=` characters round-trip verbatim (they're
  printable ASCII, not escaped by TS `JSON.stringify` either).

Number representation:

- `NumberRepr.integer(Int64)` for any whole-number value.
- `NumberRepr.decimal(Decimal)` for everything else.
- `originalText` preservation deferred to V2 — Agent 2 §4 documents
  the escalation signal (a failing hash-parity row whose diff is
  purely number formatting). For the snapshot-hash fixture, the V1
  representation is sufficient: the FNV-1a hash matches the iOS-0
  golden exactly.

FNV-1a is implemented inside the Swift test file
(`AppDataCodableRoundTripTests.fnv1aPhase19b`) so the production
model surface stays focused on data shape, not hashing concerns.
iOS-3 / iOS-7 will likely move FNV-1a to a shared helper when the
cloud upload path needs it.

---

## 5. Open-bag preservation

Per Agent 1 §3 (37 open-bag sites in JSON-Schema + 2 TS-only sites).
The iOS-2B carrier strategy is **structural fidelity**: `AppData.root`
holds the full top-level object verbatim; every nested object lands
verbatim inside `root` because the JSONValue tree never collapses
unknown nested objects into typed structs. The 14 placeholder
model types (`TrainingSession`, `TrainingSetLog`, …, `AppSettings`)
each carry `_unknown: OrderedJSONObject` so that when future iOS-N
PRs split AppData decoding across them, the carriers are already in
place.

The `AppDataOpenBagPreservationTests` drives three round-trip cases:

1. The fixture's `settings.iosOpenBagField` survives the full
   `AppData` round-trip (locked).
2. A synthetically-injected top-level `_iosTestFutureKey` survives.
3. A nested injected `settings._nestedFutureBag.deep` survives.

Three Agent 3 §6 deferred gaps are documented as
`FUTURE_FIXTURE_NEEDED` in the open-bag test file: (a)
`TrainingSession.restTimerState != null`, (b) `HealthMetricSample.raw
!= null`, (c) `AdaptiveCalibrationEntry.loadBias`. All three are
transitively covered by the redacted real-export pointer fixture
which iOS-2B does NOT consume — see §9.

---

## 6. Timestamp String policy

Per Agent 2 §7 and Agent 5 §3.3. No model type declares any `Date`
property. `AppDataIsoTimestampStaticGuardTests` walks every public
model type with `Mirror` reflection and asserts no `Date`-typed slot
exists. The detector regex requires word-boundary continuation, so
`Foundation.DateFormatter` / `Foundation.DateComponents` /
`Foundation.DateInterval` / `MyType_Date` are NOT false-positives.

The TS-side `iosAppDataSwiftModelStaticGuards.test.ts` re-runs the
guard at the source level by scanning every `.swift` file under
`Sources/IronPathDomain/` for `: Date\b` and `: Date?\b` field
declarations.

---

## 7. schemaVersion policy

`SchemaVersion.current` is hard-coded `8` matching
`src/data/appConfig.ts:4`. `AppData.init(decoding:)` extracts the
`schemaVersion` field first and calls `SchemaVersion.validate(found:)`
which throws:

- `SchemaVersionError.upgradeRequired(found: Int)` when `found < 8`
- `SchemaVersionError.futureIncompatible(found: Int)` when `found > 8`
- `SchemaVersionError.missingOrInvalid` when the field is missing or
  not a number

The seven assertions in `AppDataSchemaVersionGuardTests` exercise all
four branches plus the canonical-emit round-trip preserving
`"schemaVersion":8` as an integer literal (no `8.0` drift).

iOS-2B does NOT implement schemaVersion migration. iOS-3 (storage
adapter) will decide whether to surface a UI prompt or attempt an
in-place upgrade.

---

## 8. kg/lb policy

Per Contract Freeze §8 and Agent 5 §3.6. `WeightUnit` is a `String`
enum with `.kg` and `.lb`. `UnitSettings.weightUnit` is the lone
typed weight-related field iOS-2B exposes; everything else flows
through `_unknown`.

`AppDataUnitFieldPreservationTests` locks:

- `weightUnit: "kg"` decodes to `.kg`
- `weightUnit: "lb"` decodes to `.lb`
- `weightUnit: "st"` (unknown future unit) decodes to `nil` BUT the
  string survives round-trip via the `_unknown` carrier verbatim
- Numeric weight values round-trip as the SAME literal — no implicit
  kg→lb→kg coercion
- The fixture's `unitSettings.weightUnit = "kg"` survives the full
  `AppData` round-trip

---

## 9. Fixture parity strategy

iOS-2A plan §12 named two fixtures iOS-2 consumes:

- `app-data/snapshot-hash-stable-v1` (primary) — **iOS-2B consumes**.
- `real-export/redacted-2026-05-27` pointer (secondary) — **iOS-2B defers** consumption.

The deferral is conservative: the redacted real export is 805 KB,
copying it into the Swift test bundle would meaningfully inflate
the package, and the path-walk alternative was rejected by Agent 4
§10. Loading the real export from `swift test` is now an iOS-2C
concern (a future PR that promotes typed fields out of
`_unknown` and needs the broader fixture coverage anyway). All five
iOS-2B parity tests run against the synthetic snapshot-hash fixture
only; the primary contract surfaces (FNV-1a hash, open-bag
preservation, schemaVersion guard, unit-field preservation) are all
exercised end-to-end against the iOS-0 golden.

Byte-equality guard: `iosAppDataFixtureParityDocsGuard.test.ts`
compares the Swift `Fixtures/` copies against the canonical
`tests/fixtures/parity/inputs/app-data/...` and
`tests/fixtures/parity/golden/app-data/...` paths. Any drift in
either copy fails CI immediately. The guard runs in vitest without
Xcode involvement.

---

## 10. Tests added

| Layer | Test file | Count | Pass |
|---|---|---:|---|
| Swift | `AppDataCodableRoundTripTests.swift` | 5 | ✓ |
| Swift | `AppDataSchemaVersionGuardTests.swift` | 7 | ✓ |
| Swift | `AppDataOpenBagPreservationTests.swift` | 5 | ✓ |
| Swift | `AppDataIsoTimestampStaticGuardTests.swift` | 3 | ✓ |
| Swift | `AppDataUnitFieldPreservationTests.swift` | 7 | ✓ |
| TS | `iosAppDataSwiftModelStaticGuards.test.ts` | 26+ | ✓ |
| TS | `iosAppDataNoSwiftDataCoreDataGuards.test.ts` | 18+ | ✓ |
| TS | `iosAppDataFixtureParityDocsGuard.test.ts` | 3 | ✓ |
| TS evolution | `iosBootstrapNoBusinessLogic.test.ts` | (existing — narrowed) | ✓ |
| TS evolution | `iosAppDataSwiftModelsPlanDocsParity.test.ts` | (existing — evolved) | ✓ |

---

## 11. Xcode validation

| Destination | Action | Result |
|---|---|---|
| `(cd ios/packages/IronPathDomain && swift test)` | run | ✓ **28 tests, 0 failures** |
| `generic/platform=iOS Simulator` | `xcodebuild build` | reported in PR body |
| `platform=iOS Simulator,name=iPhone 17 Pro` | `xcodebuild build` | reported in PR body |

`xcodebuild test` on the IronPath scheme remains intentionally
unconfigured (iOS-1 deferral, unchanged by iOS-2B). `swift test`
inside `IronPathDomain` is the validation path; iOS-2B's PR body
documents the exact `swift test` output.

---

## 12. Data safety

The 13 MUST-NOT and 5 MUST rules from Agent 5 are mechanically
enforced:

- **No `Date` fields** — `AppDataIsoTimestampStaticGuardTests` (Mirror)
  + `iosAppDataSwiftModelStaticGuards` (source scan).
- **No `SwiftData` / `CoreData`** — `iosAppDataNoSwiftDataCoreDataGuards`
  + `iosAppDataSwiftModelStaticGuards`.
- **No `@Model` / `@Observable`** — `iosAppDataSwiftModelStaticGuards`.
- **No `Supabase` / `HealthKit` / 3rd-party SwiftPM** —
  `iosAppDataNoSwiftDataCoreDataGuards` + iOS-1's still-running
  `iosBootstrapForbiddenImports.test.ts`.
- **schemaVersion refusal** — `AppDataSchemaVersionGuardTests`
  branch coverage.
- **Open-bag preservation** — `AppDataOpenBagPreservationTests` +
  the JSONValue carrier shape.
- **kg storage / lb display** — `AppDataUnitFieldPreservationTests`.
- **No silent downgrade** — `SchemaVersion.validate(found:)` throws
  on `> 8` and `< 8`.
- **Cross-language hash equality** — `AppDataCodableRoundTripTests.testFnv1aSnapshotHashMatchesIos0Golden`.
- **iOS-0 parity stable** — `node scripts/generate-parity-goldens.mjs --check`
  reported `0 changed` after iOS-2B work.

---

## 13. Non-goals

What iOS-2B does NOT do (and explicitly defers to future iOS-N PRs):

- On-disk persistence — iOS-3 owns the `AppDataStore` protocol +
  JSON-snapshot adapter.
- Data Health repair / sanitize / migration — iOS-3.
- TrainingDecision engine / CleanAppDataView Swift port — iOS-3 (for
  CleanAppDataView) and iOS-4 (for TrainingDecision).
- Focus Mode UI — iOS-5.
- Plan / History / Progress screens — iOS-6.
- Cloud sync / Supabase / network — iOS-7.
- HealthKit live read — iOS-8.
- TestFlight + App Store — iOS-9 / iOS-10.
- Real-export fixture consumption — deferred to iOS-2C, before iOS-3
  ships the storage adapter.
- Per-type typed field promotion out of `_unknown` — iOS-2C / iOS-3 /
  iOS-4 each promote what they need.

---

## 14. Remaining risks

| # | Risk | Severity | Mitigation |
|---|------|---:|---|
| 1 | `_unknown` carrier swallowing every nested struct means no typed-field guards yet — the open-bag tests prove round-trip, not field-by-field typing | MEDIUM | Future iOS-N PRs promote fields one type at a time; the tests for those promotions live in the same PR |
| 2 | Number precision V1 (`Decimal` + integer collapse) hasn't been exercised by floats with > 6 decimal places — the snapshot-hash fixture's values are all integers or simple kg | MEDIUM | Real-export consumption in iOS-2C will exercise `loadBias` floats; if any FNV-1a row diverges, V2 (`NumberRepr.originalText`) lands then |
| 3 | The Swift FNV-1a in the test file is a copy of the algorithm, not shared with future iOS-7 cloud upload | LOW | Move to `IronPathPersistence` or a shared utility when iOS-7 lands; until then, the test-local copy is the single source |
| 4 | `iosBootstrapNoBusinessLogic`'s `exemptPrefixes` mechanism is new — future iOS-N PRs might mis-use it to over-exempt | MEDIUM | The exempt list is reviewer-visible; every addition surfaces in the PR diff |
| 5 | Real-export fixture deferred — `restTimerState` / `HealthMetricSample.raw` / `loadBias` open-bag survival not yet end-to-end-tested in Swift | MEDIUM | Documented as `FUTURE_FIXTURE_NEEDED` in `AppDataOpenBagPreservationTests.swift`; iOS-2C will consume |
| 6 | Cross-review H2 (`supabase-swift` SDK decision) still outstanding | LOW | iOS-2B added no Supabase / GoTrue / PostgREST imports; H2 unchanged |
| 7 | If the iOS-2C PR copies the redacted real export into `Fixtures/`, the Swift test bundle grows by ~805 KB | LOW | iOS-2C can pick path-walk-via-`#filePath` (now validated against the snapshot-hash fixture's success); the byte-equality guard generalises to any new copy |

---

## 15. Final verdict

iOS-2B ships the Swift AppData model layer with one verified
end-to-end cross-language contract (`phase19b-611afec7` FNV-1a hash
parity) and the scaffolding for the remaining 36 open-bag sites to
land verbatim through future iOS-N PRs. No iOS-0 / iOS-1 / iOS-2A
guard is loosened beyond a narrow `AppData` exemption inside
`IronPathDomain`. The PR is mergeable.

iOS-3 (Data Health Swift Port V1) is the next task. It will land the
storage adapter, CleanAppDataView Swift port, AutoRepairOrchestrator,
and the 9 V1 repair recipes. The Cross-review H2 SDK decision still
does NOT block iOS-3 / iOS-4 / iOS-5 / iOS-6.

End of iOS-2B implementation doc.
