# iOS-2 AppData Swift Models V1 — Plan

> Status: **planning-only**. No Swift model files land in this PR. The
> 5 independent scan agents have produced their reports under
> `docs/ios-native-migration/agents-ios-2a/`; this doc synthesises them
> into a single implementation contract for the future iOS-2B PR.

> Parent docs:
> - `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` (§6 recommended strategy, §18 stop conditions)
> - `docs/IOS_NATIVE_MIGRATION_TASKS_V1.md` (iOS-2 section)
> - `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` (11 frozen contracts; iOS-2 owns §1, touches §3 §8 §9)
> - `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md` (parity bar this plan is measured against)
> - `docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md` (the Xcode + 8-package scaffold this plan slots into)

> Sibling agent reports:
> - `docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md`
> - `docs/ios-native-migration/agents-ios-2a/AGENT_2_JSONVALUE_CODABLE.md`
> - `docs/ios-native-migration/agents-ios-2a/AGENT_3_PARITY_FIXTURE.md`
> - `docs/ios-native-migration/agents-ios-2a/AGENT_4_XCODE_PACKAGE_LAYOUT.md`
> - `docs/ios-native-migration/agents-ios-2a/AGENT_5_DATA_SAFETY.md`

---

## 1. Executive summary

iOS-2 ships the **Swift AppData model layer** inside the
`IronPathDomain` package created by iOS-1. The Swift types are pure
value types — `struct` + `enum` — that round-trip the TypeScript
AppData JSON byte-for-byte. iOS-2 does NOT introduce storage adapters
(iOS-3's job), repair logic (iOS-3), TrainingDecision (iOS-4), cloud
sync (iOS-7), HealthKit (iOS-8), or UI (iOS-5).

The single load-bearing design choice is the **`JSONValue` /
`OrderedJSONObject` carrier**: every AppData type that the TS schema
marks `additionalProperties: true` (37 sites confirmed by Agent 1)
keeps its unknown keys verbatim in an `_unknown: OrderedJSONObject`
side bag, in original input order, so re-encoding produces a JSON
that the iOS-0 parity goldens still recognise.

Two splits inside iOS-2 itself:

- **iOS-2A** (this PR): plan + implementation task spec + docs-parity
  tests. Zero Swift. Zero model files. Reviewable in one sitting.
- **iOS-2B** (next PR): 17 Swift model files + 5 Swift parity tests +
  the canonical fixture copied into `IronPathDomain` test resources +
  a byte-equality CI guard that keeps the copied fixture in sync with
  `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json`.

The 5 agent reports are unanimous on the four hard rules: **no
`SwiftData` / no `CoreData`**, **no `Date` for any persisted
timestamp** (Strings end-to-end), **no `@Model` / no `@Observable`
on AppData-shaped value types**, and **no third-party SwiftPM
dependency** (including the still-pending `supabase-swift` Cross-review
H2 decision, which iOS-2 does not pre-empt).

---

## 2. Why this is planning-only

The Migration Program Manager Agent (Entry Gate Agent 8) explicitly
identified the AppData Swift port as the highest-risk single port
across all of iOS-2..iOS-10:

- The TS schema carries **37 open-bag sites** (Agent 1, §3) — every
  one of them is a silent-data-loss vector if the Swift Codable
  implementation forgets to install a side bag.
- TS uses **4 non-deterministic fallback sites** during sanitize /
  migrate (`Date.now()` and `new Date().toISOString()` calls in
  `src/storage/appDataMigration.ts:39` and `src/storage/appDataSanitize.ts:550, 588, 639`)
  — every one of them is a Swift-side trap if the port "helpfully"
  re-mints the same fallback.
- The FNV-1a snapshot hash (`src/cloudProduction/accountBoundaryLocalInventory.ts:156`)
  depends on **stable JSON stringification semantics** that Swift's
  default `JSONEncoder` does not match without explicit configuration.
- The `STORAGE_VERSION = 8` migration ladder (`src/storage/appDataMigration.ts`)
  has gaps the Swift side cannot fill alone.

A multi-agent **planning** pass before the implementation PR catches
these traps as text — and as docs-parity assertions — before they
turn into committed Swift code. The implementation PR (iOS-2B) then
lands against a frozen spec, not against improvised judgement.

---

## 3. iOS-1 dependency confirmation

Baseline at branch creation (`claude/ios-2a-appdata-swift-models-plan-v1`
based on `origin/main @ cc2faaa`):

- `ios/IronPath.xcworkspace/contents.xcworkspacedata` ✓
- `ios/IronPath.xcodeproj/project.pbxproj` ✓
- `ios/IronPath.xcodeproj/xcshareddata/xcschemes/IronPath.xcscheme` ✓
- `ios/packages/IronPathDomain/Package.swift` ✓
- `ios/packages/IronPathDomain/Sources/IronPathDomain/IronPathDomain.swift` ✓ (placeholder `IronPathDomainVersion`)
- `ios/packages/IronPathDomain/Tests/IronPathDomainTests/IronPathDomainTests.swift` ✓ (placeholder smoke test)
- `scripts/generate-parity-goldens.mjs --check` → **0 changed**
- `scripts/generate-parity-goldens.mjs --list` → 5 ids

iOS-1 PR #394 (commit `cc2faaa`) merged on 2026-05-28T05:57:58Z. iOS-2
inherits all 8 packages, the `iOS 17.0` deployment target, and the
SwiftUI placeholder app target. **No iOS-1 file moves are sanctioned
inside iOS-2.**

---

## 4. AppData schema inventory

Cited from `docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md`.

- **AppData own fields**: 24 (`src/models/training-model.ts:1362–1387`).
- **Transitive types persisted**: ~45 named TS interfaces / types.
- **Open-bag (`additionalProperties: true`) sites in JSON-Schema**:
  35 object-level + 5 typed open-maps + 1 top-level → **37 distinct
  hits**. Two additional TS-only open-bag holes exist outside the
  JSON-Schema: `AppSettings.[key: string]` (`src/models/training-model.ts:1342`)
  and `DataRepairLogEntry.before / after: unknown`
  (`src/models/training-model.ts:1356`).
- **Non-deterministic fallback sites**: 4.
  - `src/storage/appDataMigration.ts:39` — `exercise-${Date.now()}`
  - `src/storage/appDataSanitize.ts:550` — `new Date().toISOString()` (session.createdAt)
  - `src/storage/appDataSanitize.ts:588` — `new Date().toISOString()` (programAdjustmentDraft.createdAt)
  - `src/storage/appDataSanitize.ts:639` — `session-${Date.now()}`
- **`STORAGE_VERSION = 8`** confirmed at `src/data/appConfig.ts:4`. The
  ladder defines `migrateToV1..V6` then jumps directly to
  `STORAGE_VERSION` (versions 6 / 7 / 8 are functionally
  indistinguishable). Swift must treat any `schemaVersion < 8` as a
  required upgrade and any `schemaVersion > 8` as a refuse-to-load
  signal (NOT silent downgrade).

The implementation task spec (`docs/ios-native-migration/IOS_2B_APPDATA_SWIFT_MODELS_IMPLEMENTATION_V1_TASK.md`)
carries the full 45-row inventory table forward.

---

## 5. Swift model file layout

Per Agent 4. All 17 new files under
`ios/packages/IronPathDomain/Sources/IronPathDomain/`; all 5 new
tests under `ios/packages/IronPathDomain/Tests/IronPathDomainTests/`.

Model files:

```
ios/packages/IronPathDomain/Sources/IronPathDomain/
├── JSONValue.swift                      // §6
├── SchemaVersion.swift                  // §9
├── WeightUnit.swift                     // §10
├── AppData.swift                        // 24 fields + _unknown carrier
├── AppSettings.swift                    // open-bag + repair ledger fields
├── UserProfile.swift
├── TrainingSession.swift                // ~55 fields
├── TrainingSetLog.swift                 // ~25 fields
├── ActualSetDraft.swift
├── ExercisePrescription.swift           // ~30 fields
├── MesocyclePlan.swift
├── ScreeningProfile.swift
├── ProgramTemplate.swift
├── HealthMetricSample.swift             // raw: JSONValue?
├── UnitSettings.swift                   // weightUnit kg/lb
├── TodayStatus.swift
└── AdaptiveCalibrationState.swift       // float-precision risk
```

Test files (§13):

```
ios/packages/IronPathDomain/Tests/IronPathDomainTests/
├── AppDataCodableRoundTripTests.swift
├── AppDataSchemaVersionGuardTests.swift
├── AppDataOpenBagPreservationTests.swift
├── AppDataIsoTimestampStaticGuardTests.swift
└── AppDataUnitFieldPreservationTests.swift
```

The iOS-1 placeholder files
(`IronPathDomain.swift` with `IronPathDomainVersion`,
`IronPathDomainTests.swift` with `testVersionIsBootstrap`) **stay**.
The placeholder is a smoke test for the Swift toolchain and SwiftPM
discovery; iOS-2B does not delete it.

Target membership: every new file → existing `IronPathDomain`
target's source set (models) or `IronPathDomainTests` target's source
set (tests). **No changes to the other 7 packages in iOS-2B.**

---

## 6. JSONValue design

Per Agent 2. The implementation is hand-written; **no third-party
SwiftPM dependency** (no SwiftyJSON, no ZippyJSON, no Codable
helpers).

Public surface (pseudocode, full Swift lands in iOS-2B):

```swift
public enum JSONValue: Sendable, Hashable {
    case null
    case bool(Bool)
    case number(NumberRepr)
    case string(String)
    case array([JSONValue])
    case object(OrderedJSONObject)
}

public struct OrderedJSONObject: Sendable, Hashable {
    private var entries: [(String, JSONValue)]
    public var keys: [String] { entries.map { $0.0 } }
    public subscript(_ key: String) -> JSONValue? { /* preserves first-write order */ }
    /* Decoder pass appends in input order; subscript-set updates in place; canonical emit re-sorts. */
}

public enum NumberRepr: Sendable, Hashable {
    case integer(Int64)
    case decimal(Decimal)          // V1 default
    // case originalText(String)   // V2 — deferred (see §11)
}

public extension JSONValue {
    init(decoding data: Data) throws  /* feeds Foundation JSONSerialization with .fragmentsAllowed */
    func canonicalJSONData() throws -> Data
        /* sorted keys, no whitespace, matches stableStringify() in
           src/cloudProduction/accountBoundaryLocalInventory.ts:116 */
}
```

Key behaviours:

- **`OrderedJSONObject`** preserves the input key order from the
  source JSON. This matters because the TS PWA does NOT sort
  `appData.history`'s settings keys before persistence; only the
  hash / cloud-upload paths normalise via `stableStringify`. The
  Swift round-trip MUST preserve original order so byte-equal
  comparison against an unsorted golden still passes.
- **`canonicalJSONData()`** is the one-place-only sort-on-emit
  helper. Used by `AppDataSnapshotHashParityTests` and the future
  iOS-7 cloud upload. Never used by file-system writes (those keep
  input order).
- **`NumberRepr.decimal(Decimal)`** is the V1 default. Swift `Decimal`
  preserves up to 38 significant decimal digits with no IEEE-754
  rounding, matching the TS JSON.stringify behaviour for typical
  IronPath numeric ranges (weights, percentages, RIR).
  `NumberRepr.originalText(String)` is **deferred to V2**; only
  needed if a future fixture surfaces a number whose canonical
  `Decimal` re-encoding differs from the TS-side text (e.g.
  `0.30000000000000004`). Agent 2 §4 documents the V2 escalation
  signal: any failing `AppDataSnapshotHashParityTests` row whose
  diff is purely number-formatting indicates V2 is needed.
- **`init(decoding:)`** delegates to Foundation's
  `JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])`
  and then converts `NSNumber → NumberRepr.integer/.decimal` based
  on the `objCType` discriminator. This avoids hand-rolling a JSON
  tokeniser in V1.

The full Codable surface — `init(from decoder:)` and `encode(to
encoder:)` on every AppData model type — is the bulk of iOS-2B. See §11.

---

## 7. Unknown field / open-bag preservation strategy

Per Agent 1, Agent 2, Agent 5.

Every model type whose TS counterpart marks
`additionalProperties: true` carries a side bag:

```swift
public struct AppSettings: Codable, Sendable, Hashable {
    public let knownFieldOne: String?
    public let knownFieldTwo: Int?
    /* … 24 other documented fields … */
    public let _unknown: OrderedJSONObject  /* preserves every key not in the documented set */
}
```

Decode contract:

1. The `init(from decoder:)` reads each documented key explicitly.
2. After reading documented keys, it iterates the **remaining**
   `CodingKey` set from the same container into `OrderedJSONObject`,
   preserving the order they appeared in the source JSON.
3. The set of "documented keys" is a `Set<String>` constant per
   type, declared next to the type's `CodingKeys` enum.

Encode contract:

1. Emit each documented key in **the order the model author chose**,
   matching the order Agent 1's inventory pins.
2. After documented keys, emit every `_unknown` entry in **its
   stored order** (which equals the input order).

**Schema-bump migration rule** (Agent 2 §6): when a future schema
version promotes a `_unknown.someKey` to a documented field, the
migration step on the Swift side MUST:

- Move the value out of `_unknown` into the new documented slot.
- Leave the relative ordering of remaining `_unknown` entries
  unchanged.
- Validate the lifted value matches the new field's declared type;
  refuse the load if mismatch.

The 37 documented open-bag sites are tracked in Agent 1's inventory.
The iOS-2B implementation MUST install a `_unknown` carrier at every
site. The static-guard test
`AppDataOpenBagPreservationTests` (§13) drives synthetic future-key
JSON through every type's round-trip and asserts the keys survive.

---

## 8. Timestamp policy: String, never Date

Per Agent 2 §7 and Agent 5 §3.3.

**Every persisted timestamp field is `String`, end-to-end.** No `Date`
conversion at any layer of `IronPathDomain`. The ISO format honoured
is the same one TypeScript emits:
`YYYY-MM-DDTHH:MM:SS.sssZ` (millisecond precision, trailing `Z`).

Categories of timestamp fields the iOS-2B types must declare as
`String`:

- `AppData` — none direct, but lots transitively
- `TrainingSession`: `date`, `startedAt`, `finishedAt`, `editedAt`,
  every `editHistory[].editedAt`, every
  `appliedCoachActions[].appliedAt`, `restTimerState.startedAt`,
  every `loadFeedback[].submittedAt`, every
  `supportExerciseLogs[].loggedAt`
- `TrainingSetLog`: `completedAt`
- `ActualSetDraft`: `completedAt` (if present)
- `BodyWeightEntry`: `date`
- `ProgramAdjustmentDraft` / History: `createdAt`, `appliedAt`
- `AppSettings.dataHealthRepairLedger[]`: `createdAt`,
  `repairedAt`
- `AppSettings.dataHealthAutoRepairSummary`: `lastRunAt`
- `HealthMetricSample`: `recordedAt`, `importedAt`
- `HealthImportBatch`: `importedAt`
- `DismissedCoachAction`: `dismissedAt`
- `DismissedDataHealthIssue`: `dismissedAt`
- `TodayStatus`: `date`
- `MesocyclePlan` weekly: `weekStart`
- AdaptiveCalibrationState entries: every `appliedAt`
- (Full enumerable list lives in Agent 2 §7 and is carried into the
  iOS-2B task spec.)

The reason: TS emits ISO via `new Date().toISOString()` which
**always** includes `.SSS` milliseconds. Swift `ISO8601DateFormatter`
default options emit `YYYY-MM-DDTHH:MM:SSZ` (no milliseconds), and
even with `.withFractionalSeconds` the format differs in handling of
zero-millisecond timestamps. Any `Date` round-trip would break the
FNV-1a hash on the first millisecond-zero timestamp encountered. The
**only safe answer** is "never round-trip through `Date` at the
model layer." If display formatting is needed in iOS-5+ UI, that's a
view-model concern outside `IronPathDomain`.

A static-guard test (`AppDataIsoTimestampStaticGuardTests`)
introspects `IronPathDomain`'s public types via the Swift runtime
(`Mirror`) and fails the build if any documented timestamp slot has
type `Date` instead of `String`.

---

## 9. schemaVersion policy

Per Agent 1 §6 and Agent 5 §3.5.

`SchemaVersion.swift` introduces:

```swift
public struct SchemaVersion: RawRepresentable, Codable, Comparable, Sendable {
    public let rawValue: Int
    public static let current: SchemaVersion = SchemaVersion(rawValue: 8)
}
```

Rules:

- On decode, `AppData.init(from:)` reads `schemaVersion` first.
- If `schemaVersion < 8`: the Swift binary REFUSES the load with a
  documented error (`SchemaVersionError.upgradeRequired(found:Int)`).
  iOS-3 (which owns the storage adapter) decides whether to
  surface a "please open the PWA once to migrate" UI prompt; iOS-2
  only owns the refusal contract.
- If `schemaVersion > 8`: the Swift binary REFUSES the load with
  `SchemaVersionError.futureIncompatible(found:Int)`. **Never
  silently downgrade.** Future PWA writes that bump to v9 MUST
  ship alongside a Swift `SchemaVersion.current = 9` bump and
  matching migration step.
- If `schemaVersion == 8`: load proceeds.
- The Swift binary **never** rewrites the `schemaVersion` field of
  a loaded AppData. Even on save, the field is round-tripped
  byte-equal (i.e. if the input was `"schemaVersion": 8`, the
  output is `"schemaVersion": 8`, not `"schemaVersion": 8.0`).

The `AppDataSchemaVersionGuardTests` (§13) drives all three branches
(below, equal, above) and asserts the refusal errors.

---

## 10. kg/lb unit policy

Per Agent 5 §3.6, Agent 1 §3.

- **Storage is always kg.** `TrainingSetLog.weight`,
  `BodyWeightEntry.weight`, `ExercisePrescription.startWeight`, and
  every weight field declared in Agent 1's inventory store the
  numeric value in kilograms.
- **`UnitSettings.weightUnit: WeightUnit`** is an enum with cases
  `.kg` and `.lb`. It governs DISPLAY ONLY.
- iOS-2 model layer **never** converts kg→lb or lb→kg. The view layer
  (iOS-5+) handles display formatting via a separate `IronPathL10n`
  helper.
- Optional `actualWeightKg` and `displayWeight` fields (per
  `TrainingSetLog` definition) round-trip verbatim. They are NOT
  recomputed by the Swift model layer.

The Contract Freeze §8 clause is quoted at full length in Agent 5
§3.6 and carried verbatim into the iOS-2B task spec.

`AppDataUnitFieldPreservationTests` (§13) drives a fixture with
heterogeneous unit fields and asserts byte-equal round-trip.

---

## 11. Codable round-trip strategy

Per Agent 2 §5 and §9.

Every AppData model type implements **custom Codable**, not
synthesised. The standard synthesised `Codable` would drop unknown
keys, which violates the open-bag rule (§7).

Pattern (each model type):

```swift
public struct TrainingSession: Codable, Sendable, Hashable {
    public let id: String
    public let date: String
    // … 53 other documented fields …
    public let _unknown: OrderedJSONObject

    private enum CodingKeys: String, CodingKey { case id, date /* … */ }
    private static let documentedKeys: Set<String> = ["id", "date", /* … */]

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: GenericCodingKey.self)
        self.id = try container.decode(String.self, forKey: .init(stringValue: "id")!)
        // … explicit decode for each documented key …
        self._unknown = try OrderedJSONObject(decodingResidual: container,
                                              excluding: Self.documentedKeys)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: GenericCodingKey.self)
        try container.encode(id, forKey: .init(stringValue: "id")!)
        // … explicit encode for each documented key in declared order …
        try _unknown.encodeResidual(into: &container)
    }
}
```

`GenericCodingKey` is a `String` → `CodingKey` helper, ~10 LOC, lives
inside `JSONValue.swift`.

`OrderedJSONObject(decodingResidual:excluding:)` is the workhorse
that iterates `container.allKeys`, skips the documented set, and
decodes each remaining key's value as `JSONValue`. Symmetric
`encodeResidual(into:)` does the inverse.

**Equality of round-trip**: tested at the canonical-stringify level
(§12). The raw round-trip output may have different whitespace and
key order compared to the input; the parity test re-runs
`canonicalJSONData()` on both sides and byte-compares.

---

## 12. Parity fixture strategy

Per Agent 3 and Agent 4.

### Which iOS-0 fixtures iOS-2 consumes

| Fixture id (input)                                | Consumed by iOS-2? | What iOS-2 asserts                                                                                  |
|---------------------------------------------------|--------------------|------------------------------------------------------------------------------------------------------|
| `app-data/snapshot-hash-stable-v1`                | **YES** (primary)  | Round-trip + canonical-stringify + FNV-1a hash matches `phase19b-611afec7` from the golden          |
| `real-export/redacted-2026-05-27` (pointer)       | **YES** (secondary)| Decode → re-encode → byte-equal-after-canonicalize. Asserts schemaVersion=8 + open-bag preservation.|
| `training-decision/normal-session-v1`             | YES (decode only)  | Loads pointer AppData; decode into Swift AppData; no engine call.                                   |
| `data-repair/session-lifecycle-residue-v1`        | YES (decode only)  | Decodes the synthetic AppData with residue session into Swift; no engine call.                      |
| `focus-mode/golden-path-session-v1`               | NO                 | Focus mode fixture is a `TrainingSession`, not an `AppData`. iOS-5 consumes; iOS-2 ignores.        |

### Fixture gaps — DEFER

Agent 3 §6 evaluated four candidate gaps and recommended **defer all
four**:

1. **`TrainingSession.restTimerState != null`** — transitively covered
   by the redacted real export (Agent 3 §6 case (a)). Add a comment
   block in `AppDataOpenBagPreservationTests.swift` listing the
   defer.
2. **`HealthMetricSample.raw != null`** — same defer. The synthetic
   fixture has zero health samples; the real export probably has
   some. Add the same comment block.
3. **`AdaptiveCalibrationEntry.loadBias` non-trivial float** — same
   defer. `AppDataUnitFieldPreservationTests` already exercises the
   same Double-precision plumbing.
4. **Unknown future settings key** — **already covered** by the
   `iosOpenBagField` in `inputs/app-data/snapshot-hash-stable-v1.json`.

**iOS-2A introduces NO new parity fixture.** The Contract Freeze §11
clause that "fixture changes require version-bumped acts plus
re-running the generator" is preserved.

Conditional escalation: if the iOS-2B implementer greps the redacted
real export and finds zero `restTimerState != null` AND zero
`healthMetricSamples` with non-null `raw`, gaps 1 and 2 are NOT
transitively covered and iOS-2B is authoritatively blocked until a
`synthetic-open-bag-edge-v1.json` fixture lands first. Agent 3 §6
documents the exact grep commands.

### How fixtures reach the Swift test target

Per Agent 4 §10. **Option A** (chosen):

1. iOS-2B copies
   `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json`
   and
   `tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json`
   into
   `ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/`.
2. `Package.swift`'s test target gets ONE edit:
   `.testTarget(name: "IronPathDomainTests",
                dependencies: ["IronPathDomain"],
                resources: [.copy("Fixtures")])`.
3. Swift tests load via `Bundle.module.url(forResource:, withExtension:)`.
4. A **byte-equality CI guard** (TS-side, added in iOS-2B alongside the
   copy) asserts the copied bytes are identical to the canonical
   parity-tree bytes. The guard runs in vitest under the
   `iosAppDataFixtureParityDocsGuard.test.ts` test name.

Symlinks were rejected (Agent 4 §10): Git's symlink tracking is
inconsistent on Windows worktrees and the `Bundle.module` resolution
under `.build/` does not follow symlinks reliably.

---

## 13. Swift test plan

5 test files. Each name + assertion shape; iOS-2B authors the actual
Swift.

### `AppDataCodableRoundTripTests.swift`

- For each input fixture in `Fixtures/`:
  - Decode into `AppData` (Swift type).
  - Re-encode via `JSONEncoder` (raw, may differ in key order).
  - Canonical-stringify both sides via `canonicalJSONData()`.
  - Assert byte-equal.
- For the snapshot-hash fixture specifically:
  - Compute FNV-1a per `src/cloudProduction/accountBoundaryLocalInventory.ts:127–134`.
  - Assert the result equals `phase19b-611afec7` (the golden).

### `AppDataSchemaVersionGuardTests.swift`

- Mutate the snapshot-hash input fixture's JSON in memory:
  - `schemaVersion = 7` → expect `SchemaVersionError.upgradeRequired(found: 7)`.
  - `schemaVersion = 8` → expect successful decode.
  - `schemaVersion = 9` → expect `SchemaVersionError.futureIncompatible(found: 9)`.
- Assert that on successful decode, the encoded output's `schemaVersion`
  is the same integer literal that was decoded (no `8.0` drift).

### `AppDataOpenBagPreservationTests.swift`

- For each documented open-bag site (37 listed in Agent 1):
  - Inject a synthetic future key (`"_iosTestFutureKey": <JSONValue>`).
  - Decode, encode, canonical-stringify.
  - Assert the synthetic key survives with the same value and
    relative ordering.
- Comment block at top documents the three deferred gaps (Agent 3 §6).

### `AppDataIsoTimestampStaticGuardTests.swift`

- Use Swift `Mirror` (or compile-time `staticAssert` macros if iOS-2B
  prefers) to introspect every documented timestamp slot listed in §8.
- Assert each slot's declared type is `String` or `String?`.
- Fail with a precise file:line message if any slot is `Date`.

### `AppDataUnitFieldPreservationTests.swift`

- Load a fixture with non-trivial weight values.
- Decode, encode, canonical-stringify.
- Assert weights round-trip byte-equal.
- Assert `UnitSettings.weightUnit` enum cases round-trip
  (`kg` / `lb`).
- Assert no implicit kg↔lb conversion happens (cross-check by
  loading a fixture where `weightUnit = lb` but stored weights are
  in kg — the stored numeric values must come back unchanged).

---

## 14. TS static guard plan

Three TS docs-parity tests, prefix `iosAppDataSwiftModel*` and
`iosAppDataFixture*`:

### `iosAppDataSwiftModelStaticGuards.test.ts`

- Scans every `.swift` file under
  `ios/packages/IronPathDomain/Sources/IronPathDomain/`:
  - Asserts none of `import SwiftData`, `import CoreData`,
    `@Model`, `@Observable` appear on a model-type declaration.
  - Asserts no `Date` field appears in a model struct (regex
    `: Date\b` and `: Date?\b` on field declarations).
  - Asserts every model file declares exactly one top-level public
    type matching the file name.
- Mirrors `iosBootstrapForbiddenImports.test.ts` patterns from iOS-1.

### `iosAppDataNoSwiftDataCoreDataGuards.test.ts`

- Scans `IronPathDomain` (sources AND tests) and `Package.swift`:
  - No `.package(url: …)` of any kind.
  - No `import Supabase`, `import HealthKit`, `import GoTrue`, etc.
    (reuse the iOS-1 forbidden-imports list).
  - No `@Model` macro applied anywhere.
  - No `@Observable` applied to a public type (private view models
    are not in iOS-2 scope; this guard reserves the question).

### `iosAppDataFixtureParityDocsGuard.test.ts`

- Asserts the fixture copy under
  `ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/`
  is byte-identical to the canonical
  `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json`
  and
  `tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json`.
- This is the byte-equality CI guard Agent 4 §10 mandates.
- The test runs even if iOS-2B never opens Xcode — pure Node, pure
  byte compare.

These three TS guards are added in **iOS-2B**, NOT iOS-2A. iOS-2A's
own docs-parity tests are the smaller set in §17 / Phase 4 of this
plan.

---

## 15. Xcode validation plan

Per Agent 4 §9 and §11.

iOS-2B will run, in order:

```bash
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS Simulator' build \
  CODE_SIGNING_ALLOWED=NO
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build \
  CODE_SIGNING_ALLOWED=NO
(cd ios/packages/IronPathDomain && swift test)
```

The `IronPath` scheme's test action remains intentionally unconfigured
(iOS-1 deferred Testables wiring; iOS-2B does NOT configure it
either). `swift test` per `IronPathDomain` runs all five new parity
tests and reports per-test pass/fail. iOS-2B's PR body documents the
run count.

`project.pbxproj` is **not edited** in iOS-2B. SwiftPM auto-discovers
source files inside the package's `Sources/IronPathDomain/` and
`Tests/IronPathDomainTests/` directories. The pbxproj only references
the package via `XCLocalSwiftPackageReference`, which is unchanged.

`IronPath.xcscheme` is **not edited** in iOS-2B. The scheme references
the app target, which transitively depends on `IronPathDomain`. Any
build-time error introduced by the new model files surfaces in the
scheme's build action without scheme edits.

The iOS-1 `iosBootstrap*` tests evolve in **iOS-2B** to acknowledge
that `IronPathDomain/Sources/IronPathDomain/*.swift` may contain
more than just the version constant. The exact tests that need
updating:

- `iosBootstrapNoBusinessLogic.test.ts`'s
  "every package source file declares only a version constant"
  assertion currently asserts `≤ 1` public declarations per source
  file. iOS-2B relaxes this assertion **for `IronPathDomain` only**:
  multiple public declarations are allowed in the model files. The
  smoke-test on `IronPathDomainVersion.value == "0.0.1-bootstrap"`
  remains.
- `iosBootstrapNoBusinessLogic.test.ts`'s
  forbidden-symbol scan currently includes `struct AppData` /
  `struct TrainingDecision` / `struct CleanAppDataView` / etc. iOS-2B
  EXEMPTS `AppData` (and the other 16 model names) from the scan
  because iOS-2 is the sanctioned task that introduces them.
  `TrainingDecision`, `CleanAppDataView`, and other still-deferred
  contracts REMAIN forbidden until iOS-3 / iOS-4 takes them.

The exact `iosBootstrap*` evolution diff is part of iOS-2B's
implementation task spec, not iOS-2A.

---

## 16. Data safety rules

Per Agent 5. **Quoted with citation.**

### Hard MUST-NOT (13 rules)

1. **MUST NOT** use `SwiftData`.
   *Source:* Entry Gate §18 Stop Condition (the per-task derivation),
   Cross-review H2 storage strategy.
2. **MUST NOT** use `Core Data`. *Same source.*
3. **MUST NOT** add `@Model` macro anywhere. *Same source.*
4. **MUST NOT** add `@Observable` to AppData-shaped value types.
   View models in iOS-5+ are a separate decision; the model layer
   itself stays pure value types decodable from JSON.
5. **MUST NOT** use `Date` for any persisted timestamp. Use `String`
   end-to-end. *Source:* Agent 3 (Entry Gate) ISO timestamp drift,
   reaffirmed in Agent 5 §3.3, AGENT_2 §7.
6. **MUST NOT** drop unknown JSON keys on decode. Each open-bag site
   carries `_unknown: OrderedJSONObject`. *Source:* Contract Freeze
   §1.
7. **MUST NOT** silently downgrade `schemaVersion`. If incoming JSON
   has `schemaVersion > 8`, refuse the load (not rewrite).
   *Source:* Contract Freeze §1, Agent 1 §6, Agent 5 §3.5.
8. **MUST NOT** coerce kg↔lb↔kg at the model layer. Storage is kg;
   `weightUnit` is display only. *Source:* Contract Freeze §8.
9. **MUST NOT** close the `AppSettings` open bag. iOS-only future
   settings live INSIDE the open bag, not as a Swift sibling
   property that would break PWA round-trip. *Source:* Contract
   Freeze §1, Agent 5 §3.7.
10. **MUST NOT** modify any TypeScript runtime source from iOS-2B.
    *Source:* iOS-1 contract.
11. **MUST NOT** modify `package.json` / `package-lock.json` /
    introduce `pnpm-lock.yaml`. *Source:* every prior iOS PR's stop
    condition.
12. **MUST NOT** add `import Supabase` / `import HealthKit` / any
    third-party SwiftPM dependency. Stop Condition #7 (Entry Gate
    §18) + Cross-review H2 still outstanding.
13. **MUST NOT** add Sentry / Crashlytics / Firebase / analytics
    SDK. Stop Condition #8.

### Hard MUST (5 rules)

1. Timestamps as `String` in ISO-8601 with `.SSSZ` ms precision.
2. `[String: JSONValue]` (via `OrderedJSONObject`) open bags at
   every site in Agent 1's 37-row inventory.
3. Canonical key-sorted JSON when emitting for hash / cloud upload
   comparison.
4. Preserve unknown enum string values verbatim. Never substitute a
   default if the string doesn't match a known case — store as the
   underlying `String` and surface via a `case unknown(String)`
   variant where the type permits.
5. Validate `schemaVersion == 8` on read; refuse-or-defer on
   mismatch (per §9).

### What iOS-2 does NOT decide

- Cloud sync semantics (iOS-7).
- Repair semantics (iOS-3).
- UI / view models (iOS-5+).
- Local storage adapter (iOS-3 owns the on-disk format and the
  `AppDataStore` protocol).

The 13 MUST-NOT + 5 MUST list is repeated verbatim in the iOS-2B
implementation task spec so the implementing agent has a single
authoritative checklist.

---

## 17. Implementation task checklist

iOS-2A delivers:

- [x] This plan doc (`docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1_PLAN.md`).
- [x] 5 agent reports under `docs/ios-native-migration/agents-ios-2a/`.
- [ ] Implementation task spec
      (`docs/ios-native-migration/IOS_2B_APPDATA_SWIFT_MODELS_IMPLEMENTATION_V1_TASK.md`).
- [ ] Docs-parity tests with prefix `iosAppDataSwiftModelsPlan*`.
- [ ] Validation: parity check, npm test, build, Xcode generic +
      iPhone 17 Pro build, lockfile + whitespace clean.
- [ ] PR opened with no auto-merge.

iOS-2B (next PR, NOT this one) delivers:

- [ ] 17 Swift model files under
      `ios/packages/IronPathDomain/Sources/IronPathDomain/`.
- [ ] 5 Swift parity test files under
      `ios/packages/IronPathDomain/Tests/IronPathDomainTests/`.
- [ ] 2 canonical fixture files copied into
      `ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/`.
- [ ] One-line `Package.swift` edit:
      `resources: [.copy("Fixtures")]` on the test target.
- [ ] Three TS static-guard tests
      (`iosAppDataSwiftModelStaticGuards`,
      `iosAppDataNoSwiftDataCoreDataGuards`,
      `iosAppDataFixtureParityDocsGuard`).
- [ ] `iosBootstrapNoBusinessLogic.test.ts` evolution to permit
      `IronPathDomain` model types (whitelisted by name).
- [ ] Full validation matrix (parity, npm, Xcode generic, iPhone 17 Pro,
      `swift test`).
- [ ] PR opened with no auto-merge, no `--admin`.

The iOS-2B task spec
(`docs/ios-native-migration/IOS_2B_APPDATA_SWIFT_MODELS_IMPLEMENTATION_V1_TASK.md`)
elaborates each iOS-2B row into a ready-to-run prompt.

---

## 18. Risks

Per Agent 1, Agent 2, Agent 4, Agent 5.

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Silent open-bag drop on decode (37 sites) — Swift Codable synthesis defaults to dropping unknown keys | HIGH | `AppDataOpenBagPreservationTests` drives synthetic future keys through every type; iOS-2B test plan asserts survival at each of the 37 sites |
| 2 | ISO ms-drift via `Date` (`…30.000Z` → `…30Z`) — FNV-1a hash diverges; cloud upload optimistic concurrency fails | HIGH | §8 mandates `String` end-to-end; `AppDataIsoTimestampStaticGuardTests` uses Swift `Mirror` to refuse any `Date` slot at build time |
| 3 | Number-precision drift — Swift `Double` rounds vs JS `Number` exact text | MEDIUM | V1 uses `Decimal`-canonical via `NumberRepr.decimal`; V2 escalation to `NumberRepr.originalText` triggered by any failing hash parity row whose diff is purely number formatting (Agent 2 §4) |
| 4 | Non-deterministic fallbacks (`Date.now()` / mint-on-load) inherited from TS — Swift port "helpfully" re-mints | HIGH | iOS-2 does NOT port the migration / sanitize logic. Those land in iOS-3 (storage adapter), where they MUST hard-fail instead of minting. iOS-2 models alone cannot re-mint because they are pure decoders. |
| 5 | Dependency creep — Apple docs and AI completion push `@Model` / `@Observable` / SwiftData | HIGH | `iosAppDataNoSwiftDataCoreDataGuards.test.ts` is the build-time block. Reviewer guidance: any iOS-N PR that introduces these patterns fails CI. |
| 6 | Fixture-sync drift — Swift-side `Fixtures/` copy diverges from canonical parity tree | MEDIUM | `iosAppDataFixtureParityDocsGuard.test.ts` byte-equality check in vitest |
| 7 | `iosBootstrapNoBusinessLogic.test.ts` evolution is brittle — too permissive and other iOS-N PRs sneak past | MEDIUM | The exemption whitelist is explicit (the 17 model names), declared in the test source, and PR review must approve every addition |
| 8 | Hand-authored `JSONValue` has subtle round-trip bugs that surface only on real-export fixture | MEDIUM | Real-export pointer fixture is in the iOS-2B parity test set; CI fails fast on any divergence |
| 9 | `OrderedJSONObject` order-preservation contract is subtle and easy to break in a refactor | MEDIUM | Round-trip tests at every open-bag site lock the contract |
| 10 | iOS-2B implementer may misread Agent 1's open-bag count and miss a site | HIGH | The 37 sites are enumerated in the iOS-2B task spec by name; the open-bag test iterates that list, not a Swift-side discovered list |

---

## 19. Final verdict

The plan is **APPROVE-with-conditions**. The conditions are:

1. iOS-2B opens against a base where `node scripts/generate-parity-goldens.mjs --check`
   still returns `0 changed`. If that is not true, iOS-2B is blocked.
2. The conditional escalation in §12 — if grep over the redacted real
   export shows zero `restTimerState != null` and zero
   `healthMetricSamples` with non-null `raw`, iOS-2B is blocked until
   a `synthetic-open-bag-edge-v1.json` fixture lands. The first
   actionable step of iOS-2B is that grep, surfaced in the PR body.
3. The Cross-review H2 decision (`supabase-swift` SDK choice) remains
   outstanding. iOS-2 does NOT pre-empt it — none of the 17 model
   files import Supabase, GoTrue, or PostgREST.
4. The plan does NOT modify any iOS-0 parity fixture or generator
   logic. If iOS-2B finds a real gap that requires a fixture change,
   that change is a separate sibling PR with its own iOS-0 contract
   freeze cycle.

This planning doc is the source of truth for iOS-2B. Implementation
proceeds against it verbatim. Any iOS-2B drift from this plan is a
review block.

---

End of iOS-2 plan.
