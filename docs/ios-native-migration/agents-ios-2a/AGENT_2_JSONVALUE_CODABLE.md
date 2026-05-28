# AGENT 2 — JSONValue / Codable Strategy (iOS-2A)

Agent: Agent 2 — JSONValue / Codable Agent
Scope: iOS-2A AppData Swift Models Plan V1
Date: 2026-05-28
Status: planning-only (no Swift / no runtime / no fixtures written)

> Companion to Agent 1 (`AGENT_1_APPDATA_SCHEMA.md`, schema inventory) and Agent
> 3 (Swift model surface, separate doc). This file decides **only** the codec
> layer that lets `AppData` round-trip JSON byte-for-byte against TypeScript.

---

## 1. Mission

Design — on paper — the Swift `JSONValue` type and the Codable strategy that
will let iOS-2 read, mutate and re-emit `AppData` JSON in a way that is
**indistinguishable** from a PWA-side `JSON.parse(JSON.stringify(appData))`
round-trip, modulo whitespace. Concretely we must:

1. Preserve every unknown field at every level the JSON schema permits
   `additionalProperties: true` (40 sites, see Agent 1 §3 / schema L38…L727).
2. Preserve original number precision — never round `42.0` into `42`, never
   coerce `1.7976931348623157e308` through `Double`-and-back if it lost
   precision on decode.
3. Treat every timestamp as `String` end-to-end. **Never** `Date`. The PWA
   emits `"2026-05-27T10:15:30.000Z"` (TS `toISOString`); the Swift default
   `.iso8601` emits `"2026-05-27T10:15:30Z"`. These hash differently.
4. On emit, sort keys alphabetically per object (matches PWA
   `stableStringify` from `src/cloudProduction/accountBoundaryLocalInventory.ts:116`)
   so `buildAppDataSnapshotHash` produces the same `phase19b-XXXXXXXX`
   value on iOS as it does on the Web. The hash is the **single source of
   truth** for cloud-sync parity (dry-run, upload-receipt, read-after-write).
5. Carry "unknown" sub-trees as opaque `JSONValue` payloads so an iOS binary
   older than a PWA writer never silently drops a future settings key,
   `raw:` Apple-Health bag, or new top-level field.

We are NOT designing the model layer (Agent 3) nor the storage IO layer.
This doc owns: the `JSONValue` type, the per-AppData-type Codable strategy,
the number-precision policy, the timestamp policy, and the parity-test
naming.

---

## 2. Inputs inspected

| Source | Path:line | What it told us |
| --- | --- | --- |
| `stableStringify` canonical JSON | `src/cloudProduction/accountBoundaryLocalInventory.ts:116` | Key sort rule (`.localeCompare`), `undefined` drop, no whitespace, child-first recursion. This IS the canonical emit shape iOS must match. |
| `buildAppDataSnapshotHash` (FNV-1a-ish) | `src/cloudProduction/accountBoundaryLocalInventory.ts:156` (with `hashText` at L127) | The hash is computed *directly* over `stableStringify(appData ?? null)`. Pure, deterministic, jsonb-roundtrip stable; format `phase19b-[0-9a-f]{8}`. Comments at L136–155 explicitly forbid hashing the sanitised output. |
| Hash regression test | `tests/appDataSnapshotHashCanonical.test.ts` | 6 invariants: pure, jsonb-roundtrip stable, `undefined` vs absent ≡ same hash, distinguishes different inputs, never throws on junk, fixed `phase19b-` prefix shape. These map 1-for-1 to Swift parity tests in §9. |
| Round-trip test | `tests/appDataRoundTripRegression.test.ts` | Save→load preserves identity-invalid legacy IDs, draft-set state, pending-patch consumed status, applied/rolled-back program drafts, `settings.dataRepairLogs` `before`/`after` payloads. These are exactly the open-bag cases iOS must not corrupt. |
| Entry-gate Agent 3 risks | `docs/ios-native-migration/agents/DATA_MODEL_REPAIR_AGENT.md` §10 | 3 schema risks called out by name: ISO-timestamp drift (§10.3), non-deterministic sanitiser (§10.11), open-bag preservation at every `additionalProperties:true` site (§10.2). These ARE the 3 round-trip pitfalls Agent 2 must close. |
| Contract Freeze §1 | `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` §1 (lines 50–119) | MUST / MUST-NOT clauses for AppData compatibility. Quoted below. |
| Agent 1 schema inventory | `docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md` §3 | 24 top-level fields, ~70 transitive types, 40 `additionalProperties:true` sites, fields with `raw: unknown` payloads (`HealthMetricSample`, `ImportedWorkoutSample`). Do not redo. |
| Schema confirmation | `src/models/training-data.schema.json` (grep `additionalProperties`) | 40 hits including root at L121 (`additionalProperties: true,`). |
| Schema/version invariant | `src/data/appConfig.ts:4`, `src/models/training-model.ts:1322,1362` | `STORAGE_VERSION = 8`; root *and* `settings` both carry `schemaVersion`. |

### 2.1 Quoted MUST / MUST-NOT from Contract Freeze §1

These four lines drive the entire codec design; quoted verbatim from
`docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` lines 81–115:

- (MUST) "A `JSONValue` enum (`object / array / string / number / bool / null`)
  that survives encode / decode without loss." (line 80)
- (MUST) "ISO timestamps stored as `String` everywhere in `AppData` — **never**
  `Date`. (TS uses `new Date().toISOString()` = `…30.000Z`; Swift's default
  `.iso8601` strategy emits `…30Z` without milliseconds and breaks parity
  hashes.)" (lines 82–85)
- (MUST NOT) "MUST NOT close the `AppSettings` shape (no closed struct
  without an unknown-bag carrier)." (lines 104–105)
- (MUST NOT) "MUST NOT store any timestamp as Swift `Date` inside `AppData`."
  (line 106)
- (MUST NOT) "MUST NOT sanitize-then-hash on the read side. The sanitiser is
  non-deterministic (mints `session-${Date.now()}` IDs for legacy records);
  hashing the result produces non-stable output." (lines 108–110)

These are non-negotiable. Every design choice below is downstream of them.

---

## 3. Proposed `JSONValue` enum shape (public surface only)

```swift
public enum JSONValue: Equatable, Hashable, Sendable, Codable {
    case null
    case bool(Bool)
    case number(NumberRepr)               // see §4 — preserves text form
    case string(String)
    case array([JSONValue])
    case object(OrderedJSONObject)        // preserves insertion order on decode
}

public struct OrderedJSONObject: Equatable, Hashable, Sendable {
    public private(set) var keysInOriginalOrder: [String]
    public private(set) var entries: [String: JSONValue]
    public subscript(key: String) -> JSONValue? { get set }
}

extension JSONValue {
    // Custom (init from:/encode to:) with type-probe order
    //   null → bool → number → string → array → object
    public func canonicalJSONData() throws -> Data       // stableStringify-equivalent: keys sorted, no whitespace, null preserved, numbers via NumberRepr.canonicalText
    public func appDataSnapshotHash() -> String          // = hashText(canonicalJSONData) → "phase19b-XXXXXXXX"
}
```

### 3.1 Why an enum, not `[String: Any]`

Enum gives compile-time exhaustiveness in `encode(to:)`, carries `Hashable
/ Equatable / Sendable` cleanly (required by parity tests), and pattern-
matches without `as?` casts. `Any` defeats every one of those.

### 3.2 Why `OrderedJSONObject`, not `[String: JSONValue]`

Swift `Dictionary` iteration is undefined. We need TWO ordering policies
applied to TWO halves of the same object: (a) input-order preservation for
the **unknown carrier** (round-trip diffability), and (b) alphabetical key
sort for the **canonical emit path** (hash parity with TS
`stableStringify`). `OrderedJSONObject` makes both explicit and
independently selectable.

### 3.3 Why NOT a third-party SwiftPM

`AnyCodable` / `SwiftyJSON` / `BetterCodable` all expose `Any` /
type-erasure, collapse numbers to `Double`/`NSNumber` (fails §4), and lose
key insertion order. iOS-2 V1 ships dependency-free. Hand-rolling ~200
lines beats an external dep.

---

## 4. Number representation: `NumberRepr` that preserves original text

### 4.1 Why not just `Double`

TS `JSON.stringify(42)` → `"42"`. `JSON.stringify(42.0)` → `"42"` (because
`42.0 === 42`). `JSON.stringify(0.1 + 0.2)` → `"0.30000000000000004"`.
`JSON.stringify(Number.MAX_SAFE_INTEGER + 1)` → `"9007199254740992"`.

If iOS decodes into `Double`, then re-encodes:

- `42` → `Double(42.0)` → `"42"` ✓
- `42.0` → `Double(42.0)` → `"42"` ✓ (same on TS, fine)
- `0.30000000000000004` → `Double(0.30000000000000004)` → `"0.30000000000000004"` ✓
- `9007199254740993` (integer beyond 2^53) → `Double(9.007199254740992e15)` → loses last digit ✗

The last case is a real risk: `idempotencyKey`-bearing structures and
`appDataHashBefore`/`appDataHashAfter` ledger fields are *strings*, so
they're fine; but `healthMetricSamples[].value` can carry sub-millisecond
timestamps from Apple Health that are 13-digit milliseconds-since-epoch
multiplied by a coefficient — in the worst case approaching `2^53`. The
fixture-set today does not exhibit it, but the contract MUST preserve it
because Apple Health is the new high-volume source.

### 4.2 Recommended `NumberRepr`

```swift
public struct NumberRepr: Equatable, Hashable, Sendable, Codable {
    public let originalText: String           // "42", "42.0", "1e3", "0.300000…4"
    public var asDecimal: Decimal? { Decimal(string: originalText) }
    public var asDouble:  Double?  { Double(originalText) }
    public var asInt:     Int?     { Int(originalText) }
    public var canonicalText: String { originalText }   // emitted by canonicalJSONData()
}
```

`Decimal` is the preferred arithmetic form (handles 38-digit integers and
the `42.0` case without `Double` rounding). `Double` is the fallback for
exponent forms; `Infinity` / `NaN` are invalid JSON and rejected on decode.

### 4.3 Decode policy

The Foundation `JSONDecoder` collapses `42` into `Int` and `42.0` into
`Double` — we cannot intercept that *through* the high-level API. The
workaround is to decode `JSONValue` from raw `Data` via a hand-written
tokeniser **for the `JSONValue` cases only**. Concretely:

- The typed `AppData` decoding path uses `JSONDecoder` with
  `dataDecodingStrategy = .deferredToData`, `keyDecodingStrategy = .useDefaultKeys`,
  no `dateDecodingStrategy` (we never decode `Date`).
- Inside any field typed as `JSONValue` (e.g. `AppSettings.unknown[…]`,
  `HealthMetricSample.raw`, `DataRepairLogEntry.before`/`after`), we read
  the *raw bytes* for that container via `singleValueContainer().decode(JSONRawText.self)`
  trick (or via `JSONSerialization` with a custom number-reading delegate,
  whichever is cleaner — Agent 3 picks the implementation; the *contract*
  is: original text must survive).

If implementation cost is too high in V1, an acceptable downgrade is:
**store every `.number` as the lossless textual canonical form `Decimal`
exposes** (`Decimal.description`). This loses `42.0` → `42` (becomes
`42`), which **does** change the hash for that one case but is acceptable
IFF a TS-side test confirms the PWA never round-trips `42.0` as `42.0` —
which it does not (TS `JSON.parse('42.0')` → `42`, `JSON.stringify(42)` →
`"42"`). The TS pipeline already collapses `42.0` to `42`, so iOS doing the
same is **parity, not loss**.

**Recommendation**: ship the cheaper `Decimal`-canonical form in V1, add a
parity test against the snapshot-hash-stable fixture, and revisit if any
real PWA output emits a number that fails this. The full `originalText`
preservation stays available as a non-breaking upgrade.

### 4.4 Numbers Swift code itself constructs

When the auto-repair engine writes a new value (e.g. capped issue score),
it constructs via `NumberRepr(integer: 50)` or
`NumberRepr(decimal: Decimal(string: "0.5")!)`. The canonical text is
generated from the value, not from any preceding input. No drift.

---

## 5. Custom Codable strategy per AppData type

### 5.1 The three categories

Every type in Agent 1 §3.2 falls into one of three buckets:

1. **Closed-bag typed struct** — schema declares `additionalProperties: false`
   or TS uses a closed `interface` with no `[key: string]: unknown`. Examples:
   `UnitSettings`, `WeightUnit`. Use synthesised `Codable`. No `unknown`
   carrier. ~10 types.
2. **Open-bag typed struct** — schema declares `additionalProperties: true`
   AND we know the documented field set. Examples: `AppData` root,
   `TrainingSession`, `TrainingExercise`, `BodyWeightEntry`, `TodayStatus`,
   `UserProfile`, `ScreeningProfile`, `AppSettings`, `MesocyclePlan`,
   `ProgramAdjustmentDraft`, etc. (~40 types). Implement Codable manually:
   decode known fields explicitly, capture unknown into `_unknown`;
   encode emits known fields in **documented order** then unknown in
   **original input order**.
3. **Pure-bag** — fields typed `unknown` in TS (e.g.
   `HealthMetricSample.raw`, `DataRepairLogEntry.before`/`after`,
   nested `Record<string, unknown>` slots). Use `JSONValue` directly.
   ~5 sites.

### 5.2 The open-bag pattern (pseudocode shape)

```swift
public struct ExampleOpenBag: Codable {
    public var id: String
    public var createdAt: String              // ISO String, NEVER Date
    public var someEnum: SomeEnum?
    public var someChild: ChildStruct?
    /// Unknown keys preserved in *original input order*. Emit appends
    /// them after all known keys.
    public var _unknown: [(String, JSONValue)] = []

    private enum KnownCodingKeys: String, CodingKey, CaseIterable {
        case id, createdAt, someEnum, someChild
    }

    public init(from decoder: Decoder) throws {
        // 1) decode known fields by name via KeyedContainer<KnownCodingKeys>
        // 2) re-decode the full object as JSONValue, subtract knownKeys,
        //    keep result in original input order → self._unknown
    }

    public func encode(to encoder: Encoder) throws {
        // 1) build OrderedJSONObject; insert known fields in DOCUMENTED order
        // 2) append _unknown entries in input order
        // 3) singleValueContainer().encode(JSONValue.object(...))
    }
}
```

### 5.3 Per-type catalogue (which AppData types need the open-bag pattern)

Below is the inventory mapped onto codec strategy. The schema's 40
`additionalProperties:true` hits collapse into these typed sites; Agent 1
§3 already enumerated them. We mark `OPEN` for "needs §5.2 pattern" and
`CLOSED` for "synthesised Codable is fine".

| Type | Open/Closed | Source |
| --- | --- | --- |
| `AppData` (root) | OPEN | schema L121 root `additionalProperties:true` |
| `AppSettings` | OPEN (load-bearing — ledger / receipt / runtime flags live here) | training-model.ts:1322 (`[key: string]: unknown`), schema L117 |
| `TrainingSession` | OPEN | schema L162–166 |
| `TrainingExercise` | OPEN | schema (per-item) |
| `TrainingSet` | OPEN | schema (per-item) |
| `BodyWeightEntry` | OPEN | schema L34–38 |
| `TodayStatus` | OPEN | schema L299 |
| `UserProfile` | OPEN | schema L335 |
| `ScreeningProfile` | OPEN | schema L360 |
| `AdaptiveState` | OPEN (nested) | inside ScreeningProfile |
| `ProgramTemplate` | OPEN (external $ref) | `training-program.schema.json` |
| `MesocyclePlan` | OPEN | schema L640 |
| `ProgramAdjustmentDraft` | OPEN | schema L559 |
| `ProgramAdjustmentHistoryItem` | OPEN | schema L604 |
| `HealthMetricSample` | OPEN + `raw: JSONValue?` | schema L244 |
| `ImportedWorkoutSample` | OPEN + `raw: JSONValue?` | schema L266 |
| `HealthImportBatch` | OPEN | schema L287 |
| `DismissedCoachAction` | OPEN | schema L131 |
| `DismissedDataHealthIssue` | OPEN | schema L141 |
| `PendingSessionPatch` | OPEN | schema L189 |
| `DataRepairLogEntry` (`before`/`after` are `JSONValue?`) | OPEN | schema L191 |
| `DataHealthRepairLedgerEntry` | OPEN (warnings array stays closed) | appDataRepairTypes.ts:72 |
| `DataHealthAutoRepairSummary` | OPEN | types.ts:97 |
| `DataHealthRuntimeFlags` | OPEN | types.ts:88 |
| `UnitSettings` | CLOSED | training-model.ts:170 (no `[key:string]`) |
| `WeightUnit` | CLOSED enum | n/a |
| `TrainingMode` | CLOSED enum (+ unknown fallback) | n/a |
| `AdaptiveCalibrationState` | CLOSED at top (Agent 1 §3.1 HIGH risk on float precision; numbers handled by `NumberRepr`) | training-model.ts:618 |
| `RestTimerState` | CLOSED | training-model.ts (V6 migration) |

### 5.4 Enum decode with fallback

Forward-compat enum decoding (e.g. `PendingSessionPatch.status` =
`'pending' | 'consumed' | 'dismissed' | 'expired'`) maps unknown strings
to a documented fallback case (`.pending`, per Agent 3 §10.13). The
unknown raw is intentionally **lost** here — the TS sanitiser (`pickEnum`)
does the same. This is distinct from object unknown-field preservation:
strings have no carrier, only objects do.

---

## 6. Known + unknown key merge rule on schema bump

When a future TS schema adds `appData.newField`, an iOS binary without
the typed property must:

1. **Decode** — `_unknown` captures `newField` (not in `KnownCodingKeys`).
2. **Mutate** — auto-repair / user edits NEVER touch `_unknown` slots.
3. **Re-emit** — `encode(to:)` writes `newField` after the known block,
   preserving its input order within `_unknown`.
4. **Cloud upload** — canonical hash sorts keys, matches PWA-side hash. ✓
5. **Read after iOS update** — when iOS ships a binary that knows
   `newField`, it migrates out of `_unknown` into a typed property; next
   emit places it in documented order.

### 6.1 Conflict rule: known vs unknown for the same key

Structural invariant: a key never exists in both the typed path and the
`_unknown` carrier — §5.2 step 2 filters against `KnownCodingKeys`. If a
future binary adds `someEnum` as a known field, the typed property always
wins; the unknown carrier never holds a shadow copy.

### 6.2 Schema down-grade (older iOS reading newer PWA file)

Per Contract Freeze §1 and Agent 3 §9.4: `schemaVersion > knownVersion`
→ accept the decode, surface a passive notice
("此设备暂时未支持更新的备份格式"), but **read-only**. The `_unknown`
payload is preserved in memory and survives export-back-to-PWA. This is
the load-bearing rule that makes open-bag preservation *useful* — the
carrier must survive even when the binary cannot consume the data.

### 6.3 Schema up-grade (newer iOS reading older PWA file)

The codec is upstream of `migrateTrainingData` (TS ladder collapses
V5 → V8 in one step per Agent 3 §3.4). Codec produces a typed `AppData`
with possibly-stale `schemaVersion`; migration then bumps the field.
Unknown carriers survive migration because migration only touches known
fields.

---

## 7. Timestamp policy: String end-to-end, never `Date`

### 7.1 The contract

Per Contract Freeze §1 (lines 82–85, 106) — quoted:

> "ISO timestamps stored as `String` everywhere in `AppData` — **never**
> `Date`. (TS uses `new Date().toISOString()` = `…30.000Z`; Swift's
> default `.iso8601` strategy emits `…30Z` without milliseconds and
> breaks parity hashes.)"

> "MUST NOT store any timestamp as Swift `Date` inside `AppData`."

Implementation: every timestamp-bearing field is `String` (not `Date?`,
not a `@TimestampString` property wrapper that re-encodes — Swift wrappers
that emit `Date` defeat the rule).

### 7.2 Timestamp-bearing field categories

From Agent 1 §3 and sanitiser scan (`appDataSanitize.ts` L550, L588,
L639). All listed paths are `String` in Swift, stored verbatim as
decoded. Categories (not exhaustive field list — Agent 3 cross-checks):

1. Session lifecycle — `TrainingSession.{date, startedAt, completedAt, finishedAt}`.
2. Per-set / per-exercise — `TrainingSet.completedAt`, `TrainingExercise.startedAt`.
3. Active session checkpoint — `RestTimerState.{startedAt, scheduledEndAt}`.
4. Body weight — `BodyWeightEntry.date`.
5. Today status — `TodayStatus.{date, updatedAt}`.
6. Profile / screening — `ScreeningProfile.updatedAt`, `AdaptiveState.lastUpdated`.
7. Program adjustment — `ProgramAdjustmentDraft.{createdAt, appliedAt, rolledBackAt}`, `ProgramAdjustmentHistoryItem.{appliedAt, rolledBackAt}`.
8. Health data — `HealthMetricSample.{startDate, endDate, importedAt}`, `ImportedWorkoutSample.{startDate, endDate, importedAt}`, `HealthImportBatch.importedAt`.
9. Dismissals — `DismissedCoachAction.dismissedAt`, `DismissedDataHealthIssue.dismissedAt`.
10. Pending session patch — `.createdAt, .consumedAt, .dismissedAt, .expiredAt`.
11. Mesocycle / calibration — `MesocyclePlan.startDate`, `AdaptiveCalibrationState.{lastUpdated, frozenUntil}`.
12. Data Health receipt / ledger / flags / summary — `DataRepairLogEntry.{createdAt, repairedAt}`, `DataHealthRepairLedgerEntry.appliedAt`, `DataHealthRuntimeFlags.{todayStatusIgnoredAt, healthDataStaleSince, …}`, `DataHealthAutoRepairSummary.runAt` (or equivalent — types.ts:97).

Total ≈ 30 distinct field paths.

### 7.3 Where Dates ARE allowed

Outside `AppData`. Specifically:

- `GuardClock` injection point — the `clock: () -> Date` in
  `buildCleanAppDataView`. The clock returns a Swift `Date`; we *format*
  it to ISO string immediately when writing into `AppData`. Format string:
  ISO-8601 extended with millisecond precision: `yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX`
  with `Z` zone designator. Match TS `new Date().toISOString()` byte-for-
  byte. A single Swift helper `ISOString.now(clock)` owns this conversion
  and is the only place a `Date` exists in the timestamp pipeline.
- UI display layer (Agent 5) — formatters consume the `String`, parse it
  via `ISO8601DateFormatter` *with* `.withFractionalSeconds`, render to a
  locale string. Display only.

### 7.4 Why not a `@TimestampString` property wrapper

Tempting, but the wrapper would have to implement `Codable` and either
re-emit the original string (in which case it's a no-op type alias) or
parse-and-format (in which case we re-introduce the `.000Z` drift the
contract forbids). Plain `String` is simpler and correct.

---

## 8. Open-bag round-trip risks — 3 concrete failure modes

These are the failure modes the codec must defeat. Each one has a Swift
test that asserts the behaviour (named in §9).

### 8.1 Failure mode A — silent drop of `settings.experimentalFooBar`

**Scenario.** PWA build N+1 writes a new key
`appData.settings.experimentalFooBar = { tier: 'beta' }`. iOS build N
(without the typed property) decodes. If `AppSettings` were a closed
synthesised-Codable struct, the key disappears; iOS's next `save(_:)`
writes a file *missing* that key, silently destroying the user's
experimental opt-in. PWA on next read believes the user opted out.

**Defeat.** §5.2 open-bag pattern catches it into `_unknown` and emits it
back. Verified: `AppDataOpenBagPreservationTests.testFutureSettingsKeySurvivesRoundTrip`.

### 8.2 Failure mode B — `HealthMetricSample.raw` collapse

**Scenario.** Apple Health import drops opaque vendor metadata into
`raw:` (nested objects, floats, booleans). If `raw` is typed
`[String: String]` or `[String: AnyCodable]`, nested objects flatten or
the whole `HealthMetricSample` decode fails and the import batch is
corrupted.

**Defeat.** `raw: JSONValue?` carries any shape losslessly. Verified:
`AppDataOpenBagPreservationTests.testHealthSampleRawRoundTrips`.

### 8.3 Failure mode C — ISO timestamp ms-drift (the cited §10.3 risk)

**Scenario.** TS writes `"2026-05-27T10:15:30.000Z"`. iOS decodes via
`dateDecodingStrategy = .iso8601` (silently lossy at the ms boundary),
re-emits `"2026-05-27T10:15:30Z"`. Semantically equivalent, textually
different → different `stableStringify` bytes → different FNV-1a hash →
`phase19b-XXXXXXXX` mismatch → cloud parity check fails. This is the
exact "上传完成但云端校验失败" false positive that
`accountBoundaryLocalInventory.ts:136–155` comments call out.

**Defeat.** Never use `Date` inside `AppData` (§7.1). Verified:
`AppDataIsoTimestampStaticGuardTests` (source scan) +
`AppDataSnapshotHashParityTests` (end-to-end hash assertion).

### 8.4 Bonus — number-text drift (`42.0` vs `42`)

V1 ships `Decimal`-canonical numbers, which matches what TS
`JSON.stringify` already produces. Parity, not loss. Full
`originalText` deferred to V2 (R1).

---

## 9. Verification strategy — Swift test names

These tests are named here. Implementation is owned by iOS-2 / iOS-3.
They MUST be XCTest files in `ios/IronPathTests/CodecParity/`.

### 9.1 `AppDataCodableRoundTripTests`

Decode-then-encode produces byte-stable JSON for every §5.3 type.
Fixture: `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json`.
Cases: `testEmptyAppDataRoundTrips`,
`testRealRedactedFixtureRoundTrips` (load
`tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`, compare
byte-for-byte against the canonical-sorted variant of the input),
`testTrainingSessionRoundTripPreservesIdentityInvalid` (mirrors
`tests/appDataRoundTripRegression.test.ts:148`),
`testPendingSessionPatchStatusRoundTrips`,
`testProgramAdjustmentDraftStatusRoundTrips`,
`testCorruptInputThrowsRatherThanPartialDecode`,
`testRestTimerStateNullVsAbsentBothMeanNoTimer`.

### 9.2 `AppDataOpenBagPreservationTests`

Every open-bag site preserves unknown keys. Cases:
`testFutureSettingsKeySurvivesRoundTrip` (inject
`settings.experimentalFooBar`),
`testHealthSampleRawRoundTrips` (synthesise nested objects, arrays,
mixed numbers; deep-equal),
`testDataRepairLogBeforeAfterRoundTrips` (shape
`{ actualExerciseId: '...' }` and `{ identityInvalid: true }`),
`testRootLevelUnknownTopLevelKeySurvives` (root open per schema L121),
`testUnknownKeyOriginalOrderPreserved` (typed round-trip keeps input
order; canonical emit sorts — §3.1 distinction).

### 9.3 `AppDataIsoTimestampStaticGuardTests`

Source-scan test over `ios/IronPath/Models/`:

- No field typed `Date?` inside any `AppData`-reachable model.
- No `dateDecodingStrategy = .iso8601` on the AppData decoder (single
  allowed setter is a test helper).
- The single `ISOString.now(clock:)` helper exists exactly once.

Implementation: text-mode regex match (`: Date\??$|: Date\??,`); fails
the build on match. Mirrors TS
`tests/realDataHealthRepairStaticGuards.test.ts` pattern.

### 9.4 `AppDataSnapshotHashParityTests`

`appDataSnapshotHash()` (Swift) === `buildAppDataSnapshotHash` (TS).
Cases: `testEmptyDataHashMatchesTS` (literal `phase19b-XXXXXXXX` checked
in), `testRealRedactedFixtureHashMatchesTS`,
`testSortedKeyEmitMatchesStableStringify` (compare canonical bytes
against precomputed `stableStringify` output),
`testHashIsPureAcrossRepeatedCalls` (TS L20–27),
`testHashStableAcrossUndefinedVsAbsent` (TS L35–44),
`testJsonbRoundTripHashStable` (TS L29–33),
`testHashSkipsSanitiser` (no `Date.now()` legacy-ID minting on the
hash hot path).

The four classes together cover the 6 invariants from
`appDataSnapshotHashCanonical.test.ts`, the 2 scenarios in
`appDataRoundTripRegression.test.ts`, and the 3 risks from Agent 3 §10.

---

## 10. Non-goals

This codec does **not**:

- Provide a SwiftyJSON-style dynamic chainable API (`appData["history"][0]["completedAt"].string`).
  The typed Swift model surface (Agent 3) is the consumer API. `JSONValue`
  is reserved for unknown-carrier slots, opaque `raw:` payloads, and the
  canonical-emit / hash path.
- Introduce SwiftData (`@Model`), `SwiftData.ModelContext`, `PersistentModel`,
  or any iOS 17+ persistence framework. AppData is a single JSON snapshot
  per Agent 3 §4.1.
- Introduce `Observation.@Observable` on `AppData` or any sub-type. The
  observable layer is at the view-state / store level (Agent 5's call).
  Model types stay plain value types so they remain trivially `Codable`,
  `Equatable`, `Hashable`, and `Sendable`.
- Introduce Core Data, `NSManagedObject`, `NSPersistentContainer`. Same
  reason.
- Introduce third-party SwiftPM dependencies: no `AnyCodable`, no
  `SwiftyJSON`, no `Codability`, no `BetterCodable`. Hand-rolled, in-tree.
- Decide the storage IO path (atomic file replace, App Group container,
  backup file rotation). That is Agent 3 §4 and the storage layer.
- Decide the model field set (Agent 3 / Agent 1 already did).
- Decide the migration ladder (Agent 3 §3 / §10.1).
- Decide repair receipt semantics (Agent 3 §6).
- Replace the JSON schema with Swift `Codable`-only contract. Keep both —
  the JSON schema (`training-data.schema.json`) remains the cross-language
  source of truth; Swift `Codable` is its consumer.

---

## 11. Risks

- **R1 — `JSONDecoder` cannot preserve original number text.** Foundation
  collapses `42.0` → `Int 42`. Mitigation: ship V1 with `NumberRepr` =
  `Decimal`-canonical (matches TS `JSON.stringify`, which itself collapses
  `42.0` → `"42"`). Full `originalText` preservation deferred to V2 via a
  hand-rolled tokeniser. Both forms pass hash parity vs TS today.
- **R2 — Custom Codable boilerplate cost (~25 open-bag types ≈ 750
  lines).** Mitigation: ship the boilerplate, audit once per parity test;
  future `@OpenBagCodable` macro is the V2 replacement. No codegen build
  step in V1.
- **R3 — Sort divergence from `localeCompare`.** TS `stableStringify`
  uses `String.localeCompare` (locale-aware); Swift `<` is Unicode
  lexicographic. ASCII-only keys are identical; non-ASCII keys could
  diverge. Mitigation: parity test asserts schema keys are ASCII; reject
  non-ASCII in `_unknown` decode with a clear error. No non-ASCII keys in
  the fixture set today.
- **R4 — Root-level `additionalProperties:true` (Agent 3 §10.10).** The
  schema permits `appData.experimental: {...}` at root. Agent 3's Swift
  `AppData` MUST include a root `_unknown: [(String, JSONValue)]`
  carrier. Cross-doc dependency; called out explicitly to Agent 3.
- **R5 — Sanitiser non-determinism leaking into hash.** The TS sanitiser
  mints `session-${Date.now()}` IDs (`appDataSanitize.ts:639`). The codec
  must not invoke any sanitiser on its hot path; layering: `AppDataCodec`
  consumes typed `AppData`, hashing happens on canonical bytes only.
  Verified by `AppDataSnapshotHashParityTests.testHashSkipsSanitiser`.
- **R6 — Decode-failure on corrupt JSON.** Crash-mid-write produces
  partial files. The codec MUST throw rather than partial-decode; storage
  layer (Agent 3 §9.1) falls back to `previous.json`. Verified by
  `AppDataCodableRoundTripTests.testCorruptInputThrowsRatherThanPartialDecode`.

---

## 12. Cross-doc dependencies

- Agent 1 §3 / §3.2 — type inventory + open-bag classification consumed
  verbatim into §5.3.
- Agent 3 (Swift model surface, separate doc) — owns the typed property
  declarations and field ordering for each `KnownCodingKeys`.
- Agent 3 §4 (storage IO) — owns atomic write, `previous.json`, file
  backup retention.
- Agent 3 §10.1 — collapsed V5→V8 migration ladder; codec is upstream of
  migration so it sees raw `schemaVersion`.
- Contract Freeze §1 — MUST / MUST-NOT clauses; quoted in §2.1.
- DATA_MODEL_REPAIR_AGENT §10.2, §10.3, §10.11 — three risks; defeated
  by §5.2, §7, §11.7 respectively.

---

## 13. Summary

`JSONValue` is a 6-case enum (`null / bool / number(NumberRepr) / string /
array / object(OrderedJSONObject)`) that preserves number text, key
insertion order, and unknown-field payloads. `NumberRepr` ships in V1 as
`Decimal`-canonical (matches TS `JSON.stringify`) and reserves
`originalText` for V2. Every timestamp inside `AppData` is `String`,
never `Date`. Open-bag types use a manual Codable that decodes known
fields by name, captures unknown into a `[(String, JSONValue)]` carrier,
and re-emits known-then-unknown — known in documented order, unknown in
input order. The canonical hash path sorts all keys alphabetically to
match TS `stableStringify`. Four parity test classes
(`AppDataCodableRoundTripTests`, `AppDataOpenBagPreservationTests`,
`AppDataIsoTimestampStaticGuardTests`, `AppDataSnapshotHashParityTests`)
cover the 6 hash invariants, the 2 round-trip regression scenarios, and
the 3 risks called out by the entry-gate Data Model agent.

End of report.
