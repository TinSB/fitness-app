# AGENT 5 — Data Safety (iOS-2A AppData Swift Models Plan V1)

Agent: Agent 5 — Data Safety Agent
Scope: iOS-2A AppData Swift Models Plan V1
Date: 2026-05-28
Status: planning-only (no Swift, no source edits, no fixture writes)

## 1. Mission

This report catalogues **every data-safety rule the iOS-2 Swift port of
`AppData` MUST NOT violate, and every counterpart positive rule it MUST
satisfy**, with line-anchored citations into the freeze docs and TS source
of truth.

iOS-2 (this planning slice) is responsible for **Swift `Codable` model
types only**: it defines the *shape* of `AppData` and all transitive types
on the Swift side and the JSON-codec behaviour around them. It does **not**
choose the storage layer (iOS-3), the data-health repair runtime (iOS-3),
the TrainingDecision engine (iOS-4), the cloud sync transport (iOS-7), nor
any view-model / SwiftUI surface (iOS-5..iOS-10).

The rules in §3 are therefore scoped to what a Swift model layer can do
wrong: drop unknown JSON keys, mint Swift `Date` values, coerce units,
silently downgrade a schemaVersion, introduce SwiftData annotations, pull
in a forbidden dependency, or generate non-deterministic codec output.
Anything broader (storage adapter choice, cloud sync semantics, repair
semantics) is explicitly out of scope for iOS-2 and is enumerated in §6.

The strictest framing: **iOS-2's model types are a JSON-bytes-faithful
mirror of the TS `AppData` document**. Round-trip parity is the bar.
Anything that breaks it — including "harmless" Swift idioms like
`@Model`, `Date`, `Measurement<UnitMass>`, or `JSONDecoder.keyDecodingStrategy
= .convertFromSnakeCase` — is a data-safety violation.

## 2. Inputs inspected

| Source | Path | Coverage |
| --- | --- | --- |
| Contract Freeze §1 (AppData) | `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md:50-118` | Full clause including MUST NOT list. |
| Contract Freeze §3 (Clean input) | `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md:218-294` | Boundary into iOS-4; only what touches model construction is consumed here. |
| Contract Freeze §4 (Data Health repair) | `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md:298-387` | Open-bag carriers under `settings.*`; deletion-banned list. |
| Contract Freeze §8 (kg / lb) | `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md:639-697` | Persisted kg; display-only lb; `KG_PER_LB = 0.45359237`. |
| Contract Freeze §9 (Session lifecycle) | `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md:701-784` | 4-ID identity; `RestTimerState`; deterministic set IDs. |
| Entry Gate §18 (stop conditions) | `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md:1030-1062` | 11 stop conditions; #1, #2, #4, #6, #7, #8 directly bind iOS-2. |
| Entry Gate §7 (contract freeze list) | `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md:344-368` | Names the 11 frozen contracts and the V1 lock. |
| DATA_MODEL_REPAIR_AGENT §10.1-§10.12 | `docs/ios-native-migration/agents/DATA_MODEL_REPAIR_AGENT.md:602-678` | The 3 critical data-loss risks: ladder collapse, open-bag drop, ISO timestamp drift. |
| SECURITY_PRIVACY_AGENT §6 | `docs/ios-native-migration/agents/SECURITY_PRIVACY_AGENT.md:204-214` | Data minimisation rules that apply to AppData persistence. |
| Storage version | `src/data/appConfig.ts:4` | `STORAGE_VERSION = 8` confirmed. |
| Upload eligibility (TS impl) | `src/dataHealth/uploadEligibility.ts:39-106` | What is checked pre-upload — iOS-2 models must round-trip the ledger / receipt fields the guard reads. |
| Agent 1 (iOS-2A AppData Schema) | `docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md` | 24 top-level fields, 35 open-bag sites, 4 non-deterministic fallback sites. |

## 3. The hard MUST-NOT list for iOS-2

Each entry is a **veto rule**. Violating any one of them is grounds for
blocking the iOS-2 PR.

### 3.1 No SwiftData / Core Data / SQLite for `AppData` model types

> Contract Freeze §1 MUST NOT (line 103):
> "MUST NOT introduce SwiftData / Core Data / SQLite for `AppData` in V1."

> Entry Gate §19 risk #5 (line 1072): "Stop Condition #9 (SwiftData / Core
> Data forbidden in iOS-1 through iOS-3). Static guard on `@Model` /
> `@Observable` annotations on model types in iOS-2."

Forbidden in `Sources/IronPathModels/**/*.swift`:

- `import SwiftData`
- `import CoreData`
- `import SQLite3` for AppData persistence (CommonCrypto / Compression for
  unrelated reasons is fine but should not appear in this module)
- `@Model` macro
- `@Attribute`, `@Relationship`, `@Transient` macros from SwiftData
- `NSManagedObject` subclasses, `NSPersistentContainer`, `.xcdatamodeld`
  artefacts under this module's resources

### 3.2 No `@Observable` on model value types

> Cross-derived from Contract Freeze §1 MUST NOT (line 104) + Entry Gate
> §19 risk #5: model types must remain pure JSON-decodable `Codable`
> value types. `@Observable` is acceptable only on **view models** that
> wrap these types in iOS-5+ (Today / Train / Plan / Progress UI). Putting
> `@Observable` on `struct AppData` / `struct TrainingSession` is
> forbidden because:

- it adds Apple-runtime observation tracking that is not part of the
  JSON-codec contract,
- it constrains the value type to a specific Apple framework epoch
  (`Observation` requires iOS 17+ for the macro, and rewrites property
  access),
- it makes the diff between TS `interface` and Swift `struct` visually
  noisy in review and obscures parity drift.

Allowed in iOS-2: `struct AppData: Codable, Equatable, Sendable` only.

### 3.3 No `Date` for persisted timestamps; use `String` end-to-end

> Contract Freeze §1 MUST NOT (line 106): "MUST NOT store any timestamp as
> Swift `Date` inside `AppData`."

> DATA_MODEL_REPAIR_AGENT §10.3 (lines 619-624): "If Swift encodes `Date`
> values via the default `.iso8601` strategy, the resulting JSON differs
> from the TS encoder, AND `buildAppDataSnapshotHash` will produce a
> different hash for the same logical AppData. This breaks PWA-iOS
> round-trip parity. Fix: keep timestamps as `String` in the Swift
> `AppData`, never `Date`."

Mechanism (paraphrased from the same agent §10.3):

- TS `new Date().toISOString()` emits `"2026-05-27T10:15:30.000Z"`
  (milliseconds always present, `.000` when zero).
- Swift `ISO8601DateFormatter().string(from:)` emits
  `"2026-05-27T10:15:30Z"` (no milliseconds).
- `buildAppDataSnapshotHash` is FNV-1a over `stableStringify(appData)`
  (Contract Freeze §5 lines 414, 429); any byte-level difference between
  the two outputs produces a different hash and shatters cloud sync
  optimistic concurrency.

Every timestamp in iOS-2 model types is therefore typed `String`,
optionally `String?`. List (per Agent 1 §3.1-§3.2 and Agent 1 §5):

- `TrainingSession.startedAt`, `.finishedAt`, `.editedAt`
- `TrainingSetLog.completedAt`
- `BodyWeightEntry.date`
- `HealthMetricSample.startDate`, `.endDate`, `.importedAt`
- `ImportedWorkoutSample.startDate`, `.endDate`, `.importedAt`
- `ProgramAdjustmentDraft.createdAt`, `.appliedAt`, `.rolledBackAt`
- `ProgramAdjustmentHistoryItem.appliedAt`, `.rolledBackAt`
- `PendingSessionPatch.createdAt`, `.consumedAt`, `.dismissedAt`,
  `.expiredAt`
- `RecommendationRecord.date`, `.reconciledAt`
- `AdaptiveCalibrationEntry.lastUpdated`, `.frozenUntil`
- `AdaptiveObservation.date`
- `RestTimerState.startedAt`
- `DismissedCoachAction.dismissedAt`
- `DismissedDataHealthIssue.dismissedAt`
- `HealthImportBatch.importedAt`
- `DataRepairLogEntry.repairedAt` (per Agent 1 §3.2 settings open-bag)

### 3.4 Never drop unknown JSON keys on decode

> Contract Freeze §1 frozen statement (lines 57-60): "unknown fields at
> every level where the JSON schema permits them must be preserved
> through every read / write / sanitize / migrate / repair cycle. The
> Swift port must round-trip a PWA backup byte-stable (modulo JSON key
> ordering) and must never drop a field it does not recognise."

> Contract Freeze §1 Swift mirror requirements (lines 76-90): "`struct
> AppSettings: Codable` with typed properties for known keys AND an
> `unknown: [String: JSONValue] = [:]` carrier; custom `init(from:)`
> and `encode(to:)` that merge known + unknown on encode."

> DATA_MODEL_REPAIR_AGENT §10.2 (lines 615-617): "training-data.schema.json
> has `additionalProperties: true` in 40 places. … iOS MUST implement
> Codable with an 'unknown' carrier (`[String: JSONValue]`) at every level
> that has `additionalProperties: true` in the schema."

> Agent 1 §4: "Object-level 'permit unknown keys' sites" enumerates 35
> hits inside the schema plus 2 TS-only hits
> (`AppSettings[key: string]: unknown` at `training-model.ts:1332`;
> `DataRepairLogEntry.before / after: unknown` at `:1358-1359`).

A `Codable` struct that synthesises `init(from:)` and `encode(to:)`
through the default macro **drops** every key not declared in
`CodingKeys`. Every single one of the 37 open-bag sites in Agent 1 §4
therefore needs a manual `init(from:)` + `encode(to:)` that explicitly
captures the leftover keys into a `[String: JSONValue]` side bag.

### 3.5 Never silently downgrade `schemaVersion`; refuse-or-defer on higher

> Contract Freeze §1 MUST NOT (line 107): "MUST NOT auto-downgrade
> `schemaVersion`."

> Contract Freeze §1 Swift mirror requirements (lines 88-90): "Forward-compat:
> if `schemaVersion > knownVersion`, accept the file **read-only** (per
> Data Agent §9.4). Never auto-downgrade `schemaVersion`; never drop
> unknown fields."

> Agent 1 §6: comparison rule iOS code must implement:
> 1. `let version = max(top.schemaVersion ?? 0, top.settings.schemaVersion ?? 0)`
> 2. if `version < 8` → fail-fast (do NOT silently up-version)
> 3. if `version > 8` → fail-fast forward-incompat
> 4. if `version == 8` → accept, sanitize, run

iOS-2 model layer encodes this as: `AppData.schemaVersion: Int` with
validation invoked from the typed decoder. The model never *rewrites* the
field on decode; rewriting is iOS-3's storage / migration concern only.

### 3.6 Never coerce kg→lb→kg at model layer

> Contract Freeze §8 frozen statement (lines 642-651): "All persisted
> weights are stored in **kg**. Display conversion is unidirectional,
> render-time only. … `KG_PER_LB = 0.45359237` exactly."

> Contract Freeze §8 MUST NOT (lines 684-693):
> - "MUST NOT use `NSMeasurement` / `Measurement<UnitMass>` for the
>   conversion; the rounding differs from `KG_PER_LB = 0.45359237` exact
>   arithmetic."
> - "MUST NOT round-trip kg → lb → kg on read; per-set `displayUnit` is
>   the source of truth for display."
> - "MUST NOT add a `unit` field to `bodyWeights[]` (implicit kg)."
> - "MUST NOT display decimal lb anywhere."

For iOS-2 model types specifically:

- `TrainingSetLog.actualWeightKg: Double?`, `.plannedWeightKg: Double?`
  — kg values, stored verbatim.
- `TrainingSetLog.displayUnit: WeightUnit?` — `kg` / `lb`, preserves the
  unit the user *entered* in; never reinterpreted on read.
- `BodyWeightEntry.value: Double` — implicit kg; no `unit` sibling field.
- `WeightUnit` is `enum WeightUnit: String, Codable { case kg, lb }` only;
  no third case, no associated values.

The model layer **does not** expose any function that mutates a numeric
weight at read time. Conversion lives in iOS-5 view models / UI.

### 3.7 Never close `AppSettings` open bag

> Contract Freeze §1 MUST NOT (line 104): "MUST NOT close the
> `AppSettings` shape (no closed struct without an unknown-bag carrier)."

> Agent 1 §3.1 row for `settings`: "**YES — `[key: string]: unknown`**
> (TS L1332, schema L118) … Open-bag bag: must round-trip unknown keys
> verbatim."

> Agent 1 §4 (lines 308-309): "`AppSettings` `[key: string]: unknown` at
> `training-model.ts:1332`; `DataRepairLogEntry` `before / after: unknown`
> at L1358-1359."

The `AppSettings` struct must declare typed properties for every known
field (per Agent 1 §3.1 cross-references: schemaVersion, dataRepairLogs,
dataHealthRepairLedger, healthIntegrationSettings, dismissed*, etc.) AND
carry an `unknown: [String: JSONValue]` side bag. Same rule for nested
`DataRepairLogEntry.before` and `.after` which are typed `unknown` in TS
and must be `JSONValue` in Swift.

### 3.8 No TS runtime source changes

> Entry Gate §19 row "Migration distracts from PWA stability" (line
> 1083): "iOS PRs do NOT touch `src/`, `apps/api/`, `tests/` except for
> fixture export and static guards."

iOS-2 is planning-only and produces no `src/**` edits, no API edits, no
test edits. The only artefacts touched in iOS-2 are docs under
`docs/ios-native-migration/agents-ios-2a/`. (Implementation PRs that
actually create Swift files come later — iOS-2A is the *plan*.)

### 3.9 No `package.json` / lockfile changes, no `pnpm-lock.yaml` modifications

Same rationale as §3.8. iOS-2A planning never touches the JS dependency
graph. Implementation PRs touching `Sources/IronPathModels/` similarly
never touch `package.json`, `pnpm-lock.yaml`, `apps/*/package.json`.

### 3.10 No Supabase / HealthKit / third-party SwiftPM dependency in this module

> Entry Gate §18 stop condition #7 (lines 1044-1045): "DO NOT add any
> third-party SwiftPM dependency (including `supabase-swift`) without
> explicit user approval."

> Contract Freeze §5 MUST NOT (line 488): "MUST NOT add any third-party
> SwiftPM dependency for the wire layer without explicit user approval."

Even if cloud sync (iOS-7) later approves `supabase-swift`, iOS-2 model
types **must remain transport-agnostic**. The model module's only
dependencies are `Foundation` (`Codable`, `JSONDecoder`, `JSONEncoder`,
`Data`). No `import Supabase`, no `import HealthKit`, no Sentry, no
analytics, no Firebase.

### 3.11 No analytics / Sentry / Crashlytics / Firebase

> Entry Gate §18 stop condition #8 (line 1046): "DO NOT add Sentry /
> Crashlytics / analytics SDKs without explicit user approval."

> SECURITY_PRIVACY_AGENT §6 (line 211): "No tracking SDKs. None in
> `package.json` today. None to be added on iOS."

Model types never reach out for instrumentation. Decode failures do not
log to a remote sink. Validation errors flow through Swift `throw` only.

### 3.12 No `Date.now()` / `Math.random()` equivalents in Swift codec paths

> Contract Freeze §1 MUST NOT (lines 109-111): "MUST NOT sanitize-then-hash
> on the read side. The sanitiser is non-deterministic (mints
> `session-${Date.now()}` IDs for legacy records); hashing the result
> produces non-stable output."

> Agent 1 §5.2 enumerates the 3 non-deterministic fallback sites in TS
> (`appDataSanitize.ts:550, 588, 639`):
> - `pickString(raw.createdAt, new Date().toISOString())` →
>   `ProgramAdjustmentDraft.createdAt`
> - same for `ProgramAdjustmentHistoryItem.appliedAt`
> - `pickString(raw.id, \`session-${Date.now()}\`)` →
>   `TrainingSession.id`

> Agent 1 §5 rule: "the sanitizer port must surface 'missing required
> field' as a typed validation error and refuse to back-fill with a
> wall-clock value."

iOS-2 model decode paths therefore:

- never call `Date()`, `Date.now`, `ISO8601DateFormatter().string(from:)`,
- never call `UUID()` to mint a missing ID,
- never call `Int.random(in:)` / `SystemRandomNumberGenerator`,
- surface missing required keys as typed `DecodingError`.

(Sanitiser logic lives in iOS-3 storage, not iOS-2 models. iOS-3 may
choose either "hard fail" or "use TS-written placeholder verbatim"; the
**model decode itself** never mints clock values.)

### 3.13 No `STORAGE_VERSION` downgrade

> Agent 1 §6 (lines 365-369): "if `version < 8` → fail-fast, do NOT
> silently up-version … if `version > 8` → fail-fast forward-incompat".

> Contract Freeze §1 MUST NOT (line 107): "MUST NOT auto-downgrade
> `schemaVersion`."

A Swift constant `STORAGE_VERSION = 8` is mirrored from
`src/data/appConfig.ts:4` and lives in the IronPathModels module. No code
path in iOS-2 rewrites a higher schemaVersion to 8 or a lower one to 8.

## 4. The hard MUST list (counterpart positive rules)

These rules are the inverse of §3 — what the iOS-2 model layer **must**
do to satisfy the contract.

### 4.1 Timestamps as `String` in ISO-8601 with `.SSSZ` ms precision

> Anchor: Contract Freeze §1 line 84-85: "TS uses `new Date().toISOString()`
> = `'…30.000Z'`; Swift's default `.iso8601` strategy emits `'…30Z'`
> without milliseconds and breaks parity hashes."

All timestamp fields enumerated in §3.3 are typed `String` (or `String?`).
On encode, if the model layer ever **constructs** an ISO timestamp (only
in tests that build a synthetic AppData for parity goldens), it MUST emit
the `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'` shape exactly, including the `.000`
suffix when milliseconds are zero. In production the model layer
**reads** strings from the TS-produced file and re-emits them verbatim —
the encoder never normalises the string representation.

### 4.2 `[String: JSONValue]` open bags at every `additionalProperties: true` site

> Anchor: Agent 1 §4 table — 35 schema sites + 2 TS-only sites = 37 places
> the carrier MUST exist.

The Swift `JSONValue` enum (per Contract Freeze §1 line 81) is:

```
enum JSONValue { case object([String: JSONValue]); case array([JSONValue]);
                 case string(String); case number(Double);
                 case bool(Bool); case null }
```

A small set of model types is allowed to embed *typed `unknown`* fields
(e.g. `HealthMetricSample.raw`, `ImportedWorkoutSample.raw`,
`DataRepairLogEntry.before` / `.after`). These are typed `JSONValue` (NOT
`Any`, NOT `Codable`), so the value round-trips byte-stably.

### 4.3 Canonical key-sorted JSON for hash comparison

> Anchor: Contract Freeze §5 lines 451-455: "`buildAppDataSnapshotHash`
> ported byte-identically: `stableStringify` with sorted keys. FNV-1a
> 32-bit (`(hash ^ byte) * 16777619` with `Int32` overflow arithmetic in
> Swift)."

The model encoder used for **hash input** (NOT necessarily the encoder
used for storage) sorts keys lexicographically at every object level.
Production storage writes can be unsorted; the hash path uses a dedicated
canonical encoder. iOS-2 (this slice) defines the codec interface that
makes this possible — typically by exposing both
`JSONEncoder.OutputFormatting.sortedKeys` and a custom canonical encoder
helper. The actual hash function port lives in iOS-3 / IronPathDataHealth
per the Contract Freeze, but iOS-2 must not block it by encoding
non-canonical JSON.

### 4.4 Preserve unknown enum string values verbatim

> DATA_MODEL_REPAIR_AGENT §10.13 (lines 675-678): "`'pending' | 'consumed'
> | 'dismissed' | 'expired'`. Migration may receive any string; `pickEnum`
> falls back to a default. Swift port: `enum Status: String, Codable
> { ... }` with a `static let fallback: Status = .pending` and a custom
> `init(from:)` that maps unknown values to `fallback`."

> Agent 1 §3.1 row for `trainingMode`: "Swift enum with `unknown`
> fallback."

Every string enum in the model layer either:

- has a `case unknown(String)` to carry the original token, OR
- pairs the typed enum with a side carrier in the parent struct's
  `unknown: [String: JSONValue]` bag and a `static let fallback: Self`
  for the typed property.

The first form is preferred because it preserves the original value at
the field site. Either way: the original token bytes are never lost.

Forbidden Swift idiom for enums: a `do { try enum.init(from:) } catch
{ return .someDefault }` that silently swallows the unknown token without
preserving it.

### 4.5 Validate `schemaVersion == 8` on read

> Anchor: Agent 1 §6 (lines 365-369).

Implementation in iOS-2: a free function or static helper
`AppDataVersionGuard.validate(_:)` that, given a decoded `AppData`,
returns one of:

- `.accept` (schemaVersion == 8)
- `.tooOld(found: Int)` (schemaVersion < 8 — caller in iOS-3 may decide
  to run migration; iOS-2 model layer does not migrate)
- `.tooNew(found: Int)` (schemaVersion > 8 — caller treats as read-only,
  refuses to write)

The model layer **does not throw** on `.tooOld` / `.tooNew`; it surfaces
the typed status so iOS-3 can choose policy. But it also **does not
rewrite** the value either way.

## 5. Cross-checks against parity goldens

Each rule from §3-§4 maps to one or more named Swift parity tests. These
are the tests iOS-2 implementation PRs must add. (Names match the
Contract Freeze parity-test column, lines 95-99.)

| Rule | Parity test | What the test asserts |
| --- | --- | --- |
| §3.1 SwiftData / Core Data forbidden | n/a — enforced by **static guard test** scanning `Sources/IronPathModels/**/*.swift` for forbidden imports (mirror of `tests/iosHealthKitStaticGuards.test.ts` pattern). | Build fails if `import SwiftData` / `import CoreData` / `@Model` / `@Observable` appear. |
| §3.2 `@Observable` forbidden | same static guard | same |
| §3.3 No `Date` for persisted timestamps | `AppDataIsoTimestampStaticGuardTests` | Source-scan asserts no `: Date` or `Date?` annotation on any field of any type under `Sources/IronPathModels/`. |
| §3.3 ISO ms precision | `AppDataCodableRoundTripTests` | Fixture `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json` decoded → re-encoded → byte-equal modulo key order; specifically asserts that any timestamp string contains a literal `.` (ms separator). |
| §3.4 Open-bag preservation | `AppDataOpenBagPreservationTests` | A synthetic input with an unknown `settings.coachActionOverride` key + an unknown `trainingSession.foo` key + an unknown `dataRepairLogEntry.before.bar` value survives decode→encode byte-stably. |
| §3.5 / §3.13 schemaVersion guard | `AppDataSchemaVersionGuardTests` | Decoding a payload with `schemaVersion = 7` returns `.tooOld(7)`; with `9` returns `.tooNew(9)`; with `8` returns `.accept`. Verifies the model NEVER rewrites the field. |
| §3.6 kg/lb no coercion | `AppDataUnitFieldPreservationTests` | A fixture with mixed `displayUnit: 'kg'` / `displayUnit: 'lb'` historical sets round-trips byte-equal; per-set `displayUnit` is preserved verbatim; no `bodyWeights[].unit` field is materialised on encode. |
| §3.7 AppSettings open-bag | `AppDataOpenBagPreservationTests` (specifically the `settings` slice of the fixture) | `unknown` carrier on `AppSettings` round-trips; `DataRepairLogEntry.before/after` typed `JSONValue` round-trips. |
| §3.8 / §3.9 No TS source / lockfile changes | n/a — enforced by **PR CI git diff guard** (Cross-review pattern from Entry Gate §19). | PR fails if planning iOS-2A touches `src/`, `tests/`, `package.json`, `pnpm-lock.yaml`. |
| §3.10 No third-party SwiftPM | static guard on `Package.swift` and `Sources/IronPathModels/**/*.swift` imports | Build fails if a non-Foundation import appears in `IronPathModels`. |
| §3.11 No analytics / Sentry | same static guard | Build fails on `import Sentry`, `import FirebaseAnalytics`, etc. |
| §3.12 No clock/random in codec | `AppDataIsoTimestampStaticGuardTests` (extended) + `AppDataCodableRoundTripTests` (determinism: decode → encode → decode → encode produces byte-identical pairs across two runs). | Source-scan asserts no `Date()`, `Date.now`, `UUID()`, `Int.random`, `SystemRandomNumberGenerator` in any `init(from:)` / `encode(to:)` method of `IronPathModels`. |
| §4.1 ms precision | `AppDataIsoTimestampStaticGuardTests` (positive: every `String` field declared to be a timestamp matches the regex `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z` in the fixture set). | |
| §4.2 `[String: JSONValue]` carriers everywhere | `AppDataOpenBagPreservationTests` (37-site sweep — one assertion per Agent 1 §4 site). | |
| §4.3 Canonical key-sorted JSON | `AppDataSnapshotHashParityTests` | Swift's canonical encoder output for the canonical fixture has byte-identical FNV-1a hash with the TS-side `buildAppDataSnapshotHash`. (This test gates cloud-sync work in iOS-7; iOS-2 model layer is the prerequisite.) |
| §4.4 Preserve unknown enum values | `AppDataOpenBagPreservationTests` (extended) | A fixture with `pendingSessionPatches[0].status = 'future_unknown'` round-trips; the value is not coerced to `'pending'` on encode. |
| §4.5 schemaVersion validation | `AppDataSchemaVersionGuardTests` (as in §3.5) | |

Named Swift parity test file inventory (anchors Agent 1's §3 inventory
and Contract Freeze §1 lines 95-99):

- `AppDataCodableRoundTripTests.swift` — decode→encode byte stability,
  mirrors `tests/appDataRoundTripRegression.test.ts`.
- `AppDataOpenBagPreservationTests.swift` — 37-site open-bag sweep,
  mirrors `tests/realDataHealthRepairFixture.test.ts`.
- `AppDataSchemaVersionGuardTests.swift` — version policy (this is a
  new test, not yet existing TS-side; iOS-2 introduces it on the Swift
  side).
- `AppDataIsoTimestampStaticGuardTests.swift` — static source-scan that
  no model field is typed `Date`, no codec mints clock values.
- `AppDataUnitFieldPreservationTests.swift` — kg / lb round-trip with
  per-set `displayUnit` preservation.
- `AppDataSnapshotHashParityTests.swift` — FNV-1a parity, mirrors
  `tests/appDataSnapshotHashCanonical.test.ts`.

## 6. iOS-2 is NOT the place to:

The boundary line. Each item is owned by a later iOS-N task and is
explicitly excluded from this plan.

1. **Decide cloud sync semantics.** Owned by iOS-7 (Explicit Cloud Sync
   iOS V1). iOS-2 only ensures the model types round-trip byte-stably so
   iOS-7 can layer FNV-1a hashing + Supabase wire on top.
2. **Decide repair semantics.** Owned by iOS-3 (Data Health). The 9
   repair recipes (Contract Freeze §4 lines 332-359) are ported in iOS-3.
   iOS-2 only carries the data slots: `settings.dataRepairLogs`,
   `settings.dataHealthRepairLedger`, `settings.dataRepairBackups`,
   `settings.dataHealthRuntimeFlags`. These are typed model fields with
   open-bag carriers; no logic.
3. **Decide UI / view models / SwiftUI rendering.** Owned by iOS-5
   (Today / Train / Plan / Progress). iOS-2 produces no `@Observable`,
   no `@State`, no `View` types.
4. **Decide local storage adapter.** Owned by iOS-3
   (`JSONFileAppDataStore` per Entry Gate §9.1 lines 437-443). iOS-2
   never touches `FileManager`, atomic write, `App Group`, `previous.json`
   backup. iOS-2 only produces a `Codable` shape that the storage adapter
   can serialise.
5. **Decide migration / sanitise behaviour.** Owned by iOS-3. iOS-2
   surfaces the typed `schemaVersion` validation result (§4.5) but does
   not implement migration steps.
6. **Decide HealthKit ingest.** Owned by iOS-8. iOS-2 only models
   `HealthMetricSample.raw: JSONValue` as the open carrier so iOS-8 can
   write into it. The ingest allow-list logic itself is iOS-8.
7. **Decide TrainingDecision engine.** Owned by iOS-4. iOS-2 does not
   import or implement the decision engine — but it does produce the
   `CleanTrainingDecisionInput` typed *value* shape that iOS-4 will
   accept (Contract Freeze §3 lines 246-262). The compile-time
   factory pattern itself is iOS-4.
8. **Decide auth / account / Supabase wire.** Owned by iOS-7 and the
   companion Security Privacy work. iOS-2 model types know nothing about
   `auth.uid()`, `ownerUserId`, account switch, etc.

## 7. Risks

### 7.1 (HIGH) Open-bag drop on decode

The single largest data-loss risk in iOS-2. The default Swift `Codable`
synthesis drops every unknown key. The model layer has **37 open-bag
sites** (Agent 1 §4) — every one needs a manual `init(from:)` /
`encode(to:)`. Implementation discipline must be reinforced by the
`AppDataOpenBagPreservationTests` 37-site sweep, not by code review alone.

Mitigation: a single `OpenBagCodable` protocol (or compile-time helper)
that the model author can adopt to get the carrier behaviour for free.
iOS-2 plan should specify it.

### 7.2 (HIGH) ISO timestamp drift if any code path constructs a `Date`

The trap: a future contributor (or even the same contributor in a hurry)
introduces a property like `lastUpdated: Date` because Swift's default
`Codable` for `Date` "just works". The hash parity test would catch this,
but only at integration time. The static-guard test in §5 catches it at
build time. iOS-2 plan must mandate the static guard from day one.

### 7.3 (HIGH) Forbidden dependency creep

`@Model` / `@Observable` / SwiftData are *extremely* tempting in 2026 —
the Apple sample code, the WWDC tutorials, and the AI completions all
push toward them. The Entry Gate §18 stop conditions and §19 risk #5
make them forbidden, but only enforcement at build time prevents drift.
iOS-2 plan must specify the static guards covering this, and the iOS-2
implementation PR must add them on day one.

### 7.4 (MEDIUM) Enum widening that silently coerces unknown tokens

`pickEnum` on the TS side falls back to a default for unknown tokens but
preserves the *original token* in the open-bag carrier (when nested in
an open-bag parent). A Swift enum with default `Codable` synthesis would
throw on unknown, which is *better* than coercion, but a panicking
catch-all `init(from:) { ... ?? .default }` would be worse: it loses the
original token forever. The MUST-list rule §4.4 + parity test forces the
`case unknown(String)` or carrier pattern.

### 7.5 (MEDIUM) Float precision on `loadBias`, `volumeMultiplier`, weights

> Agent 1 §7 risk #2: "Swift `Double` printing differs from JS `Number`
> printing for edge values (`0.1 + 0.2`). Parity goldens hash JSON
> output."

iOS-2 model types use `Double` for these floats. The risk lives in the
*JSON encoder*, not in the model type itself. iOS-2 plan flags this so
iOS-3 / iOS-7 can choose a canonical encoder. iOS-2 implementation must
not add Swift-side rounding inside `init(from:)` / `encode(to:)`.

### 7.6 (MEDIUM) Forgetting to add the `unknown` carrier to a NEW model type

When iOS-2 ships and a future iOS-N task adds a new optional field, the
default Codable synthesis trap returns. Mitigation: the
`AppDataOpenBagPreservationTests` static-guard sweep should scan for
*any* struct under `Sources/IronPathModels/` that has the schema annotation
"open" but no `unknown` carrier — a meta-test. iOS-2 plan should list
this as a future hardening.

### 7.7 (LOW) Schema bump risk if PWA introduces V9

iOS-2 fails-fast on `schemaVersion > 8`. If the PWA bumps to V9 before
iOS-2 ships, every iOS user sees a fail-fast on read. Mitigation: the
PWA bump and the iOS-2 V9 update ship in the same release window. This
is a program-management risk, not a model-layer risk.

## 8. Open questions

1. **Does iOS-2 ship the `JSONValue` enum, or is it shared with
   `IronPathDataHealth` (iOS-3)?** Either is workable; the plan should
   commit. Recommendation: ship `JSONValue` in `IronPathModels` (iOS-2)
   so the iOS-3 repair engine can refer to it without taking a
   downstream dependency back on iOS-2. iOS-3 already depends on
   `IronPathModels` per Entry Gate §6.1.
2. **`AppData.schemaVersion` vs `AppData.settings.schemaVersion` write
   policy.** On read, iOS-2 surfaces `max(top, settings)` per Agent 1 §6.
   But the model *does not write* either field — encoding takes whatever
   value was decoded. Is this correct? Or should the model normalise on
   encode (write both to the max)? Per DATA_MODEL_REPAIR_AGENT §10.6
   (line 644) the TS sanitizer "writes both to the same value". That is
   sanitizer work (iOS-3 owns the sanitizer port), not model work, so
   iOS-2 should NOT normalise. Confirm with iOS-3 author.
3. **`HealthMetricSample.raw` / `ImportedWorkoutSample.raw` typing.**
   Contract Freeze §1 line 76 just says "field-by-field" but Agent 1
   §3.1 marks both as HIGH risk because TS uses `unknown`. Recommendation:
   `raw: JSONValue`. Confirm.
4. **`mesocyclePlan.lengthWeeks` strictness.** TS uses literal `4 | 5 | 6`;
   schema uses `integer >= 1`. DATA_MODEL_REPAIR_AGENT §10.9 (lines
   654-656) recommends: "Swift port should match TS strictness (enum /
   restricted set) but accept any integer on decode and normalize to a
   known value at sanitize time. Do not trust upstream input."
   iOS-2 model layer must **not** normalise on decode (per §3.12: no
   clock/random/coercion in codec). Option A: decode into an
   `Int` and have iOS-3 sanitize it. Option B: decode into an enum-like
   that preserves the original int on `case other(Int)`. Recommendation:
   Option A — it keeps the model layer dumb and lets iOS-3 own the
   policy. iOS-2 plan should commit.
5. **`AdaptiveCalibrationEntry` and `AdaptiveObservation` are marked
   "closed" in Agent 1 §3.2 (no `[key: string]` in TS) but their parents
   may be in open-bag containers.** Should the Swift port still carry an
   `unknown: [String: JSONValue]` on these specifically-closed structs,
   to be safe for forward-compat? Recommendation: no (would violate the
   "closed in TS" mirror), but the parent open-bag carrier catches any
   future unknown sibling. Confirm there is no fixture today that puts
   an unknown key directly inside `adaptiveCalibration.entries[i]`.
6. **`ProgramTemplate` references a separate JSON-schema file
   (`training-program.schema.json`).** DATA_MODEL_REPAIR_AGENT §10.7
   (lines 646-648): "iOS needs to bundle both schema files and the
   validator must resolve the `$ref` correctly." This is iOS-2 scope IF
   we ship a Swift JSON-schema validator; it is iOS-3 scope if we
   validate only via the typed `Codable` decode path. iOS-2 plan should
   document: V1 uses typed-decode validation only; JSON-schema is
   reference documentation, not runtime enforcement. Confirm.
7. **Sanitizer port location.** Per Agent 1 §5 and Contract Freeze §1
   line 70, the TS sanitizer is non-deterministic. iOS-3 owns the
   sanitizer port. iOS-2 plan must explicitly state: model decode is
   **not** sanitization. The model layer accepts the raw TS-written
   bytes and surfaces a typed result; sanitization runs as a separate
   pass in iOS-3 storage. Confirm naming so future readers don't
   conflate the two.
8. **Should `decode → encode → decode → encode` byte-stability be
   asserted at the model layer (within iOS-2 tests) or as a cross-module
   integration test (within iOS-7 / cloud sync)?** Per
   `AppDataCodableRoundTripTests` it lives in iOS-2. Confirm scope; this
   is the test that breaks loudest if any §3 rule is violated.

---

End of Agent 5 — Data Safety report for iOS-2A AppData Swift Models Plan V1.
