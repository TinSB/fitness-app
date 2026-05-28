# AGENT 3 — Parity / Fixture Plan (iOS-2A)

Agent: Agent 3 — Parity / Fixture Agent
Scope: iOS-2A AppData Swift Models Plan V1
Date: 2026-05-28
Status: planning-only (no fixture writes, no Swift, no script edits)

## 1. Mission

Decide, for the iOS-2 AppData Swift models PR, exactly:

- (a) which iOS-0 parity fixtures iOS-2 *consumes* (read-only, byte-equal
  acceptance bar against the existing TypeScript goldens);
- (b) which Swift parity test files iOS-2 *adds* (file names, assertion
  shape, NO Swift source code in this plan);
- (c) how the contract "JSON equality modulo key ordering" is enforced
  across the TypeScript ↔ Swift boundary (the canonical-stringify rule
  that gates `buildAppDataSnapshotHash` parity); and
- (d) whether the existing iOS-0 fixture set has gaps that block iOS-2
  acceptance, or whether iOS-2 can defer fixture extension to a later
  iOS-N PR.

Out of scope (explicit non-goals):

- Touching anything under `tests/fixtures/parity/inputs/` or
  `tests/fixtures/parity/golden/`. iOS-0 owns those files; iOS-2 is a
  *consumer*.
- Editing `scripts/generate-parity-goldens.mjs` or
  `scripts/parityGoldensEntry.ts`. The TS generator is frozen for iOS-2.
- Writing Swift. iOS-2 implementation lives outside this plan PR.
- Designing the SwiftPM `Package.swift`. That belongs to iOS-1.
- Re-litigating the canonical path. `tests/fixtures/parity/` is pinned by
  Cross-review revision H1 (Contract Freeze §11).

This file is the canonical reference for the iOS-2 Implementation Agent
(Agent 5 in iOS-2A) and for the future iOS-2 PR reviewer.

## 2. Inputs inspected

| Source | Path | What I extracted |
| --- | --- | --- |
| Parity contract README | `tests/fixtures/parity/README.md:1–199` | Five-fixture layout, `parityMeta` + `parityGolden` envelope, regenerate / drift-detect commands, privacy rules, source-commit rule, hard "do not edit golden" rule, extension recipe. |
| Frozen input — snapshot hash | `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json:1–31` | Synthetic AppData with `schemaVersion=8`, `unitSettings.weightUnit=kg/displayUnit=kg`, plus a deliberate forward-unknown `settings.iosOpenBagField` open bag. Hand-authored, `privacy=synthetic`, `generatedAtPolicy=none`. |
| Frozen golden — snapshot hash | `tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json:1–32` | Locks `snapshotHash="phase19b-611afec7"` + `snapshotHashPrefix="phase19b-"` + sorted `topLevelKeys`/`settingsTopLevelKeys` summary + `unitSettingsWeightUnit`. |
| Frozen golden — real export | `tests/fixtures/parity/golden/real-export/redacted-2026-05-27.json:1–73` | Wraps the full pipeline over the redacted real export. Locks `actualSchemaVersion=8`, `snapshotHash="phase19b-55f97dc7"`, `cleanedHistoryLength=10`, full `dataHealthScan` array. Uses the deterministic clock `2026-05-27T10:00:00.000Z`. |
| Pointer input — real export | `tests/fixtures/parity/inputs/real-export/redacted-2026-05-27.json:1–20` | `privacy=redacted-pointer` with `pointer.path=tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` (~823 KB). Documents *why* iOS-0 chose a pointer (avoid doubling the diff on every PR). |
| Generator wrapper | `scripts/generate-parity-goldens.mjs:1–114` | Vite SSR build under `.ironpath/parity-goldens-runner/` + Node spawn. `--check` / `--list`. No new npm dep. Forwards exit code. |
| Generator entry | `scripts/parityGoldensEntry.ts:1–555` | Canonical-stringify rule at L73–84 (`sortKeysDeep` + `JSON.stringify(_, null, 2) + "\n"`). Privacy guard L114–168. `parityMeta` validation L189–227. Per-fixture generators L233–452 (snapshot, training-decision, data-repair, real-export, focus-mode). Driver L466–550. No `Date.now` / `Math.random` in the engine path. |
| iOS-0 design doc | `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md:1–479` | §3 "why fixtures before Xcode", §6 input envelope, §7 golden output shape, §8 determinism rules (sorted keys, fixed clock, no `Math.random`), §11 tests (`parityFixturesContract`, `parityFixturesGenerationConsistency`, `parityFixturesPrivacyGuard`, `iosContractFixtureStaticGuards`), §13 risk #2 — Swift `JSONEncoder` does not sort by default so iOS-2 needs its own canonicaliser. |
| Contract freeze | `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md:878–977` | §11 real-data fixture contract — pinned path, no `undefined`/`NaN`/`Infinity`, optional fields are explicit `null`, `JSONDecoder.keyDecodingStrategy = .useDefaultKeys`, MUST NOT mutate fixtures from Swift tests at runtime, MUST NOT regenerate goldens in CI. Pairs TS `appDataSnapshotHashCanonical.test.ts` → Swift `AppDataSnapshotHashParityTests.swift`. |
| QA Parity Agent | `docs/ios-native-migration/agents/QA_PARITY_AGENT.md:115–163` | §4 engine-by-engine pairing table — `AppDataSnapshotHashParityTests` listed as **P0 — critical**. Critical-path bar §4.2 confirms it must be green before any device-bound Swift build. |
| TS canonical hash test | `tests/appDataSnapshotHashCanonical.test.ts:1–60+` | Documents the four invariants the hash must hold: purity, jsonb-roundtrip equality, `undefined` ≡ absent, phase19b- prefix. Swift parity must reproduce all four. |
| Agent 1 schema inventory | `docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md:260–315, 396–414` | Flagged 35 schema open-bag sites, the 4 non-deterministic-fallback sites in `appDataSanitize.ts`, and the four explicit fixture-coverage gaps (rest-timer, health-metric `raw`, settings open key, adaptive load-bias) the parity tree does NOT yet exercise. |
| Source-of-truth hash | `src/cloudProduction/accountBoundaryLocalInventory.ts:116–157` | Canonical TS `stableStringify` + `hashText` (FNV-1a 32-bit, lower-case hex, `phase19b-` prefix, zero-padded to 8 chars). This is the byte-exact target Swift must reproduce. |
| Storage version | `src/data/appConfig.ts:4` | `STORAGE_VERSION = 8`. Drives `parityMeta.schemaVersion` and the Swift "refuse < 8 / refuse > 8" rule. |

> Not inspected: `tests/fixtures/parity/inputs/training-decision/`,
> `tests/fixtures/parity/inputs/data-repair/`, `tests/fixtures/parity/inputs/focus-mode/`.
> Those fixtures belong to iOS-4 / iOS-3 / iOS-5 consumers respectively
> and are out of scope for iOS-2's AppData Codable surface (see §3).

## 3. Which fixtures iOS-2 consumes (table)

iOS-2's contract is the *AppData Codable surface*: `decode → re-encode →
canonicalise → hash` must be byte-identical to TS. Of the five iOS-0
fixtures, iOS-2 is the **named consumer of two** (per README L162, L165
and IOS_0 §5 L133–139), and uses a third as a hand-shaped Codable
"hardest case" pointer.

| # | Fixture id | Input path | Golden path | Why iOS-2 consumes it | iOS-2 test that asserts it |
| --- | --- | --- | --- | --- | --- |
| 1 | `app-data/snapshot-hash-stable-v1` | `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json` | `tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json` | Locks `buildAppDataSnapshotHash` over a **tiny, synthetic AppData-shaped** payload that intentionally carries (a) the kg `unitSettings.weightUnit`, (b) a closed `knownField`, and (c) a forward-unknown `settings.iosOpenBagField`. Proves the Swift hash matches `phase19b-611afec7` byte-for-byte. | `AppDataSnapshotHashParityTests.swift` (primary), `AppDataOpenBagPreservationTests.swift` (round-trip side), `AppDataUnitFieldPreservationTests.swift` (kg/lb side). |
| 2 | `real-export/redacted-2026-05-27` | `tests/fixtures/parity/inputs/real-export/redacted-2026-05-27.json` (pointer wrapper) | `tests/fixtures/parity/golden/real-export/redacted-2026-05-27.json` | The full-pipeline reference. iOS-2 consumes only the *AppData decoding + snapshot-hash* slice of this golden (`actualSchemaVersion`, `snapshotHash`, top-level shape). iOS-3 / iOS-4 own the `dataHealthScan` / `cleanedHistoryLength` slices. iOS-2 consumes this because it is the only fixture whose AppData is non-synthetic, large (~823 KB), and exercises real open-bag content. | `AppDataSnapshotHashParityTests.swift` (asserts `snapshotHash="phase19b-55f97dc7"` after Swift decode → re-encode), `AppDataCodableRoundTripTests.swift` (Swift decode → Swift encode → re-decode is identity), `AppDataSchemaVersionGuardTests.swift` (asserts top-level `schemaVersion === 8`). |
| 3 | *(transitive, via pointer)* `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` | same | n/a (the golden lives at row 2) | This is the actual ~823 KB AppData blob the pointer in row 2 dereferences. iOS-2 must dereference the same way the TS generator does (`loadPointerAppData` at `scripts/parityGoldensEntry.ts:257`). The Swift test reads this file directly (NOT a copy under `Tests/Resources/`) — see §7. | Used by all six iOS-2 parity tests; not its own row in the fixture set. |

iOS-2 does NOT consume:

- `training-decision/normal-session-v1` — iOS-4 (Clean Input Contract).
- `data-repair/session-lifecycle-residue-v1` — iOS-3 (AutoRepair).
- `focus-mode/golden-path-session-v1` — iOS-5 (Focus Mode).

Acceptance bar (from `tests/fixtures/parity/README.md:22–24`):

> Your Swift engine must produce the JSON under
> `golden/<category>/<fixture-id>.json` when fed the corresponding
> input under `inputs/<category>/<fixture-id>.json`. No drift.

For iOS-2 specifically this collapses to: *given fixture row 1 or row 2
above, the Swift `AppDataSnapshot.hash(_:)` returns the exact
`snapshotHash` string in the golden.* Everything else iOS-2 asserts
(round-trip, open-bag survival, ISO timestamp passthrough, kg/lb field
preservation, schema-version guard) is plumbing that must hold for that
collapse to be true.

## 4. Swift parity tests to create (file names + assertion shape, NOT code)

Six new XCTest files under the future iOS-2 test target (likely
`Tests/IronPathAppDataTests/` or whatever iOS-1 names it). Each is
described as *what it asserts*, not as Swift source.

### 4.1 `AppDataCodableRoundTripTests.swift`

**Owner:** the Swift `AppData` `Codable` conformance and every
transitive `Codable` struct/enum reachable from it (Agent 1 §3.1 + §3.2,
~70 types).

**Inputs:** both fixtures from §3 row 1 + row 2 (via the row-2 pointer).

**Assertions:**

1. **Decode succeeds.** Loading the redacted real-export AppData bytes
   produces a non-nil `AppData` struct with no thrown error. No optional
   field decodes to a Swift `nil` when the JSON value is the explicit
   string `null`-coded sentinel (Contract Freeze §11.4 — optional fields
   `nil` when absent, typed when explicit `null`).
2. **Re-encode → re-decode is the identity.** Take the decoded value,
   encode with the iOS-2 canonical encoder (see §7), decode again,
   compare structurally (field-by-field). The two `AppData` values are
   equal under whatever `Equatable` Agent 5 ships (or via a
   key-by-key recursive walk if `Equatable` is too noisy on `extraJSON`
   bags).
3. **Hash invariance across round-trip.** `hash(decoded) ==
   hash(reEncodedThenReDecoded)`. This is the iOS analogue of the TS
   `jsonb-roundtrip stable` invariant at
   `tests/appDataSnapshotHashCanonical.test.ts:29–33`.
4. **No mutation of the on-disk fixture.** Contract Freeze §11 MUST NOT
   — the test reads the path, never writes it.

**Why this is the gate test:** if (2) fails, every other parity test
fails by transitivity. If (3) fails, cloud sync's "上传完成但云端校验失败"
regression returns on iOS.

### 4.2 `AppDataOpenBagPreservationTests.swift`

**Owner:** the `extraJSON: [String: JSONValue]` (or equivalent
side-bag) conformance Agent 1 §4 marked as mandatory for the 35 schema
open-bag sites + the two TS-only open holes (`AppSettings`,
`DataRepairLogEntry.before/after`).

**Inputs:** fixture §3 row 1 (the synthetic case carries the
deliberate `settings.iosOpenBagField` key; the golden's
`stableStringifyHashInputSummary.settingsTopLevelKeys` array proves it
survives canonicalisation as `["iosOpenBagField", "knownField"]`).

**Assertions:**

1. **Unknown top-level `settings` key survives decode.** After Swift
   decodes the fixture into `AppData`, the unknown `iosOpenBagField` is
   reachable via the `AppSettings.extraJSON` bag (Agent 1 §3.1, AppSettings
   row) without loss of its nested `iosOnlyHint` payload.
2. **Unknown key survives re-encode.** After Swift re-encodes the
   `AppData`, the resulting JSON (canonicalised) contains
   `"iosOpenBagField"` at the exact position sorted-keys produces, with
   its nested object intact.
3. **Hash is unchanged by round-trip.** `buildAppDataSnapshotHash`
   (Swift) of `decoded` equals `phase19b-611afec7`, and equals the hash
   of `reEncoded`. This proves the open-bag bag is participating in
   canonical-stringify, not bypassed.
4. **Coverage probe.** The test enumerates at least the AppSettings
   open-bag site for now and documents (via a `// MARK:` comment) that
   broader open-bag coverage is deferred to a future fixture extension
   (see §6).

**Why this matters:** if open-bag bags drop on Swift decode, a TS-side
forward-compat key (e.g. `settings.coachActionOverride`) silently
vanishes the moment iOS becomes a writer.

### 4.3 `AppDataSchemaVersionGuardTests.swift`

**Owner:** the iOS-2 bootstrap rule from Agent 1 §6: refuse anything
that is not `schemaVersion == 8` until a Swift migration ladder lands.

**Inputs:**

- Both §3 fixtures (`schemaVersion=8`, must accept).
- Three in-test fabricated payloads (NOT new fixture files): `v=7`,
  `v=9`, `v=undefined`. Built in-memory by mutating the decoded §3 row
  1 payload — the test does not write these to disk and does not commit
  them as fixtures.

**Assertions:**

1. **`v == 8` → accept.** The Swift decoder accepts both §3 fixtures
   without throwing.
2. **`v == 7` → typed error.** The decoder throws a
   `AppDataMigrationError.needsMigration(from: 7, to: 8)` (or whatever
   Agent 5 names it) and does NOT silently up-version.
3. **`v == 9` → typed error.** The decoder throws a
   `AppDataMigrationError.forwardIncompat(seen: 9, supported: 8)` and
   does NOT silently down-version.
4. **`v == undefined` → typed error.** No silent fallback to 0 or 8.
5. **Shadow-field rule.** When `top.schemaVersion == 8` but
   `top.settings.schemaVersion == 7`, the rule is `version = max(...)`
   per Agent 1 §6 — the decoder accepts. When both are `< 8`, it
   throws.

**Why this matters:** the TS migration ladder is brittle (Agent 1 §6 —
`migrateToV6` jumps straight to STORAGE_VERSION, no v7 / v8 stops). The
Swift port MUST NOT inherit that brittleness as a runtime branch.

### 4.4 `AppDataIsoTimestampStaticGuardTests.swift`

**Owner:** the iOS-2 contract that *Swift code MUST NOT mint a new
timestamp when one is missing* (Agent 1 §5 — four sites in
`appDataSanitize.ts` + `appDataMigration.ts` that currently back-fill
with `new Date().toISOString()` / `Date.now()`).

**Inputs:**

- Both §3 fixtures (must round-trip every present timestamp byte-equal).
- Two in-test fabricated payloads that *delete* `createdAt` from a
  `ProgramAdjustmentDraft` and `id` from a `TrainingSession`,
  respectively.

**Assertions:**

1. **Present timestamps round-trip byte-equal.** For every ISO string
   present in the §3 fixture (`startedAt`, `finishedAt`, `editedAt`,
   `createdAt`, `appliedAt`, `dismissedAt`, etc.), Swift decode → Swift
   encode produces the *exact same characters* — no millisecond
   normalisation, no timezone re-formatting, no `Z` ↔ `+00:00` swap.
2. **Missing required timestamp is a typed error.** When the in-test
   fabricated payload is decoded, the Swift decoder throws a
   `AppDataValidationError.missingRequiredField("createdAt")` and does
   NOT back-fill with `Date().iso8601`.
3. **Static-grep guard.** A runtime-grep `XCTFail` ensures no AppData
   module source file uses `Date()` / `ISO8601DateFormatter().string(from: Date())`
   as a *fallback*. The Swift side MAY store timestamps as `String` to
   make this trivially true — the test pins the contract, not storage.

**Why this matters:** the cloud-sync hash divergence root cause
(`accountBoundaryLocalInventory.ts:136–155` doc comment) was exactly
a wall-clock fallback in the canonicalisation path.

### 4.5 `AppDataUnitFieldPreservationTests.swift`

**Owner:** the kg / lb fields (`unitSettings.weightUnit`,
`unitSettings.displayUnit`, `unitSettings.defaultIncrementKg`,
`unitSettings.defaultIncrementLb`, `unitSettings.customIncrementsKg`,
`unitSettings.customIncrementsLb`, and the per-set `weight` +
`actualWeightKg` + `displayWeight` floats on `TrainingSetLog`).

**Inputs:** both §3 fixtures (synthetic has `weightUnit=kg /
displayUnit=kg`; redacted real-export carries the full unit-conversion
matrix).

**Assertions:**

1. **Enum fidelity.** `weightUnit` decodes to a typed Swift enum
   (`UnitSystem.kg` / `.lb`) and re-encodes to the same lower-case
   string `"kg"` / `"lb"` — NOT `"KG"`, NOT `"Kg"`.
2. **Float precision.** `defaultIncrementKg`, `defaultIncrementLb`, and
   every `customIncrement*` element round-trip byte-equal after
   canonical re-encode. Specifically, JS `0.5` → Swift `Double(0.5)` →
   JS `"0.5"` (NOT `"0.50000000000000001"`).
3. **No kg ↔ lb auto-conversion on read.** Swift decode does NOT
   recompute `actualWeightKg` from `weight` even if the two appear
   inconsistent. The Codable layer is dumb pass-through.
4. **Hash invariant.** Hash of fixture row 1 after Swift round-trip ==
   `phase19b-611afec7` — locks both the kg fields and the unit enum
   into the canonical-stringify form.

**Why this matters:** the fixture summary at
`golden/app-data/snapshot-hash-stable-v1.json:30` captures
`unitSettingsWeightUnit: "kg"`. iOS-2 is the first Swift code to
consume it; silent normalisation on read propagates drift to iOS-4.

### 4.6 `AppDataSnapshotHashParityTests.swift`

**Owner:** the byte-exact `buildAppDataSnapshotHash` reproduction.
QA Parity Agent §4 marks this **P0 — critical**; Contract Freeze §11
explicitly pairs the TS test `appDataSnapshotHashCanonical.test.ts` to
this Swift file.

**Inputs:** both §3 fixtures.

**Assertions:**

1. **Synthetic fixture hash.** `Swift.AppDataSnapshot.hash(decoded(row 1)) ==
   "phase19b-611afec7"`.
2. **Real-export hash.** `Swift.AppDataSnapshot.hash(decoded(row 2)) ==
   "phase19b-55f97dc7"`.
3. **Purity.** Three repeated calls on the same decoded value return the
   same hash (TS test invariant #1 at
   `tests/appDataSnapshotHashCanonical.test.ts:20–27`).
4. **Jsonb-roundtrip stability.** Hash of `decoded` equals hash of
   `decode(canonicalEncode(decoded))` — the iOS analogue of TS
   invariant #2 at L29–33.
5. **`undefined` ≡ absent.** Per TS invariant #3 at L35–44, a Swift
   `nil`-coded `dataRepairLogs` produces the same hash as an absent
   `dataRepairLogs` key. Implementation hint: the Swift canonical
   encoder must omit `nil` keys, not emit `"dataRepairLogs": null`.
6. **Distinguishes genuinely different AppData.** Mutating
   `trainingMode` from `"hybrid"` to `"strength"` on the row-1 decoded
   payload yields a different hash (TS invariant #4 at L46–50).
7. **Prefix shape.** `hash` always begins with the literal
   `"phase19b-"` and is followed by 8 lower-case hex characters with
   zero-padding (TS invariant #5; matches
   `accountBoundaryLocalInventory.ts:133`).
8. **Open-bag participation.** Mutating `settings.iosOpenBagField` on
   the row-1 decoded payload yields a different hash. Proves the
   side-bag is fed into the canonical-stringify on the Swift side.

This is the test that fails loudest if any of the other five iOS-2 test
files have a bug. The QA Parity Agent's critical-path bar (§4.2)
explicitly names this file.

### 4.7 Test-file naming summary

| # | File | Owns | Asserts against |
| --- | --- | --- | --- |
| 1 | `AppDataCodableRoundTripTests.swift` | Codable plumbing for ~70 types | §3 row 1 + row 2 |
| 2 | `AppDataOpenBagPreservationTests.swift` | extraJSON bag survival | §3 row 1 (synthetic unknown key) |
| 3 | `AppDataSchemaVersionGuardTests.swift` | STORAGE_VERSION = 8 boundary | §3 row 1 + 3 in-memory mutants |
| 4 | `AppDataIsoTimestampStaticGuardTests.swift` | "do not mint timestamps on read" | §3 row 2 + 2 in-memory mutants |
| 5 | `AppDataUnitFieldPreservationTests.swift` | kg/lb enum + float precision | §3 row 1 + row 2 |
| 6 | `AppDataSnapshotHashParityTests.swift` | `phase19b-` byte-exact hash | §3 row 1 + row 2 |

No new fixture files. No fixture edits. No new TS tests.

## 5. JSON equality modulo key ordering — the rule

The whole iOS-2 parity story stands on one rule:

> **JSON equality modulo key ordering.** Two JSON documents are *parity-equal*
> iff their canonical re-encodings are byte-identical. Canonical
> re-encoding sorts every object's keys lexicographically (UTF-16 code
> unit order, matching JS `String.prototype.localeCompare` default
> collation as used in
> `scripts/parityGoldensEntry.ts:78` — `localeCompare(b)`), drops any
> key whose value is `undefined` / `nil`, recurses into arrays in
> source order (NOT sorted — arrays preserve order), and emits numbers
> via the ECMA-262 `Number.prototype.toString` algorithm.

### 5.1 Decode side — original order is preserved (but does not matter)

The Swift `JSONDecoder` (or any Swift decoder iOS-2 uses) MAY preserve
or discard the original key order — it does not affect parity because
the *comparison form is always the canonical re-encoding*. The one
place key order does need to be preserved is the **extraJSON open bag**:
to keep the Swift side dumb-pass-through, the bag value MUST be stored
in a form that does not assume order (a dictionary is fine — the
canonical encoder sorts on encode). Per Contract Freeze §11.4 the
decoder's `keyDecodingStrategy` MUST be `.useDefaultKeys` (no
camelCase ↔ snake_case conversion).

### 5.2 Encode side — canonical re-encode is the comparison form

The canonical encoding rule iOS-2 must implement matches the TS
generator's own `canonicalStringify` at
`scripts/parityGoldensEntry.ts:73–84`:

```
sortKeysDeep(value):
  if value is null or not an object: return value
  if value is array: return value.map(sortKeysDeep)            // preserve order
  for each (key, v) in entries(value) where v !== undefined:   // drop undefined
    sort entries by key.localeCompare(other)                   // UTF-16 order
    set entry.value = sortKeysDeep(v)                          // recurse
  return new object from sorted entries

canonicalStringify(value):
  return JSON.stringify(sortKeysDeep(value), null, 2) + "\n"
```

Plus the iOS-2-only rule that goes BEYOND the generator's canonical
form, because the *hash* path uses an even tighter
`stableStringify` at `accountBoundaryLocalInventory.ts:116–125`:

```
stableStringify(value):
  if value is null or not an object: return JSON.stringify(value)
  if value is array: return "[" + value.map(stableStringify).join(",") + "]"
  return "{" + entries(value)
    .filter(v !== undefined)
    .sort(left.localeCompare(right))                            // UTF-16 order
    .map(key => JSON.stringify(key) + ":" + stableStringify(v))
    .join(",") + "}"
```

The two differ in indentation only — `canonicalStringify` is
human-readable (2-space + trailing newline) for diff review of golden
files; `stableStringify` is compact for hashing. **Both** use the same
sort key, both drop `undefined`, both recurse arrays in source order.

### 5.3 Collation, numbers, escaping (compact form)

- **Sort key.** `a.localeCompare(b)` in Node uses ICU default; for the
  ASCII-only AppData schema this collapses to UTF-16 code-unit order
  ≡ Swift `String.<`. Agent 5 MUST use `String.<` (or verified
  `.sortedKeys`), NOT `localizedCompare(_:)`, to defend against
  future non-ASCII forward-compat keys.
- **Numbers.** TS `JSON.stringify(n)` = ECMA-262
  `Number.prototype.toString(10)` (shortest round-trippable decimal).
  Swift `Double` IEEE 754 representation matches JS Number. Risk is
  Swift's `JSONEncoder` `NSNumber`-backed printing re-rounding at
  encode time. Agent 5 probe: encode `Double(0.5)` → assert output
  `"0.5"`, not `"0.50000000000000001"`. `NaN` / `Infinity` MUST throw
  (Contract Freeze §11 — `nonConformingFloatEncodingStrategy = .throw`).
- **Strings.** Both sides escape only the control range + `"`, `\`,
  `\b\f\n\r\t`. Do NOT set `.escapeForwardSlash` (it changes
  `"path/to/x"` → `"path\/to\/x"` and breaks parity). Set
  `outputFormatting = []` explicitly on the canonical encoder.

### 5.4 Golden = human-readable; hash = compact

The goldens under `tests/fixtures/parity/golden/` are 2-space-indented
with trailing newline (per `parityGoldensEntry.ts:84`). The
`snapshotHash` field *inside* those goldens is the FNV-1a of the
*compact* stableStringify form. The iOS-2 parity test does NOT
byte-compare the Swift re-encoder's output to the golden file. It
parses the golden, reads `snapshotHash`, and asserts equality against
Swift's hash of the *Swift-decoded AppData*.

### 5.5 Canonical comparison procedure for Agent 5

```
1. Read golden JSON via Swift JSONDecoder.
2. goldenHash = parityGolden.snapshotHash         (String)
3. Read input JSON via Swift JSONDecoder into AppData.
4. swiftHash = AppDataSnapshot.hash(AppData)      // §4.6
5. XCTAssertEqual(swiftHash, goldenHash)
```

Step 4 is where the canonical-stringify rule (§5.2) gets exercised.

## 6. Fixture gaps — honest assessment

Agent 1 §3 + §7 flagged the following coverage gaps in
`tests/fixtures/parity/inputs/app-data/`:

| Gap | Agent 1 citation | iOS-2 impact | Recommendation |
| --- | --- | --- | --- |
| (a) `TrainingSession.restTimerState != null` | Agent 1 §3.2 "Session & set" — RestTimerState L177 | Open-bag site #23 (`training-data.schema.json:501`) is not exercised by the synthetic fixture. The redacted real-export *probably* contains one, but iOS-2 has no acceptance signal that asserts it specifically. | **Defer.** The real-export fixture transitively covers any `restTimerState` present in `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`. If the iOS-2 round-trip test passes against the real export, this gap is covered de-facto. If grep shows the redacted blob has no live rest-timer, document and revisit in iOS-3. |
| (b) `HealthMetricSample.raw != null` | Agent 1 §3.1 row `healthMetricSamples?` (HIGH risk) + §3.2 "Health / import" | The schema `raw: unknown` is the single most permissive open-bag in the entire model — it can carry an arbitrary JSON structure. If the iOS-2 Codable layer collapses it to a typed enum or drops it, every imported HealthKit sample silently loses its raw payload. The synthetic fixture has zero health samples. | **Defer with named flag.** Add a `// FUTURE_FIXTURE_NEEDED` comment in `AppDataOpenBagPreservationTests.swift` listing this gap. iOS-2 acceptance does NOT require a new fixture — the real-export pointer transitively exercises the path *if* the redacted blob contains samples (grep shows it does). The test should `XCTAssertGreaterThanOrEqual(decodedAppData.healthMetricSamples?.count ?? 0, 0)` and not require >0; the real coverage lives in iOS-3 / iOS-4 when HealthKit ingest lands. |
| (c) `AdaptiveCalibrationEntry.loadBias` with non-trivial float | Agent 1 §3.1 row `adaptiveCalibration?` (HIGH risk) + §3.2 "Adaptive calibration" | The float-precision risk (Agent 1 §7 risk #2) is real but exercised only by the real-export fixture's actual calibration state. The synthetic fixture has no `adaptiveCalibration`. | **Defer.** The `AppDataUnitFieldPreservationTests.swift` already asserts float precision on `defaultIncrementKg` / `customIncrementsKg`, which exercises the same Swift `Double` ↔ JS `Number` plumbing. If unit floats round-trip byte-equal, calibration floats round-trip byte-equal — same code path. Adding a calibration-only fixture would be belt-and-braces but not blocking. |
| (d) `settings.<unknownKey>` for forward-compat | Agent 1 §3.1 row `settings` (HIGH risk) + §3.2 "Settings open-bag" | The synthetic fixture (§3 row 1) **already covers this** via `settings.iosOpenBagField`. | **Already covered.** No gap. |

**Net recommendation: DO NOT add new fixtures in this iOS-2A PR.**

Rationale:

1. The iOS-0 contract (`tests/fixtures/parity/README.md:170–183`) hard-rules
   that fixture changes are deliberate, version-bumped acts that require
   re-running the generator and bumping `parityMeta.tsCommit`. Doing
   that under an iOS-2 PR conflates "Swift port acceptance bar" with
   "iOS-0 fixture freeze update", which the Cross-review explicitly
   warned against.
2. The real-export pointer transitively covers gaps (a), (b), (c) for
   the *iOS-2 round-trip* slice. Specifically, the real-export golden
   pins `actualSchemaVersion=8`, the full `dataHealthScan` array, and
   the `snapshotHash` — any open-bag drop on the Swift side would
   change the snapshot hash and fail
   `AppDataSnapshotHashParityTests.swift` row 2 immediately.
3. Gap (d) — the only one the iOS-2 test plan can NOT defer — is
   already in the synthetic fixture.

**Action for Agent 5 (iOS-2 implementer):** add a single comment block
at the top of `AppDataOpenBagPreservationTests.swift` listing gaps (a),
(b), (c) with a pointer to this report (§6) so the next QA pass knows
they were deliberate defers, not oversights. When iOS-3 lands and
extends the parity fixture set (e.g. with a dedicated open-bag
exhaustiveness fixture), that test file's comment block should be
updated.

**Conditional escalation:** if grep over the redacted real export shows
zero `restTimerState != null` rows AND zero `healthMetricSamples` with
non-null `raw`, then gaps (a) and (b) are NOT transitively covered, and
iOS-2 *should* be authoritatively blocked until a `synthetic-open-bag-
edge-v1.json` fixture is added under
`tests/fixtures/parity/inputs/app-data/`. Agent 5 should perform this
grep as the very first step of the iOS-2 PR and surface the result in
the PR body. If the grep shows ≥1 of each, the defers above stand.

## 7. Cross-language equality semantics — TS rules → Swift encoder
configuration

This table is the one-screen cheat sheet Agent 5 reads while writing
the canonical encoder.

| Rule (TS source of truth) | Swift equivalent / configuration |
| --- | --- |
| Sort object keys lexicographically (`a.localeCompare(b)` at `scripts/parityGoldensEntry.ts:78`; `left.localeCompare(right)` at `accountBoundaryLocalInventory.ts:122`). | Sort with `String.<` (or verified `JSONEncoder.OutputFormatting.sortedKeys` — built-in uses `String.<`, fine for ASCII; probe non-ASCII before relying). NOT `localizedCompare(_:)`. |
| Drop entries with `undefined` value (L121). | Two rules, NOT interchangeable: typed Swift `Optional` `nil` → skip via `encodeIfPresent`; extraJSON bag `JSONValue.null` → emit `"key":null`. Mirrors TS `undefined` (skip) vs `null` (emit). Hash differs by exactly the bytes `"key":null,`. |
| Recurse arrays in source order (L75, L118). | `Array<JSONValue>.map { canonicalEncode($0) }`. Never sort arrays. |
| Number formatting: ECMA-262 `Number.prototype.toString` (L117). | Swift `Double` IEEE 754 matches JS Number. Set `nonConformingFloatEncodingStrategy = .throw` for NaN/Infinity. Probe `0.5`, `0.1+0.2`, `1e21`, `-0`. |
| String escaping: only control range + mandatory escapes. | Swift defaults match. Do NOT set `.escapeForwardSlash`. Probe `"path/to/x"` → must stay `"path/to/x"`. |
| `keyDecodingStrategy = .useDefaultKeys` (Contract Freeze §11.4 — "TS uses camelCase; do NOT convert"). | Set explicitly on every iOS-2 `JSONDecoder`. Default already is, but pin it. |
| `STORAGE_VERSION = 8` (`src/data/appConfig.ts:4`). | Swift `static let STORAGE_VERSION: Int = 8`. Anchor as a contract constant, NOT derived from migration logic. |
| `phase19b-` hash prefix (`accountBoundaryLocalInventory.ts:133`). | Swift emits `"phase19b-"` + 8 lower-case hex chars, zero-padded. `0` hash → `"phase19b-00000000"`, NOT `"phase19b-0"`. |
| FNV-1a 32-bit with `hash ^= charCodeAt(i); hash = Math.imul(hash, 16777619)` (L127–134). | Swift `UInt32` with overflow operators: `hash ^= UInt32(c)`; `hash = hash &* 16777619`. `Math.imul` ≡ `UInt32 &*`. Seed `2166136261`. Final step: `String(format: "%08x", hash)`. **Iterate `String.utf16`, NOT `String.utf8` or `Character`** — `charCodeAt(i)` returns UTF-16 code units. |

The single biggest cross-language risk Agent 5 must verify by
experiment: **UTF-16 vs UTF-8 byte stream for the hash input**. The JS
`charCodeAt(i)` is a UTF-16 code unit. Most ASCII JSON keys are
identical in UTF-16 and UTF-8, but the moment a non-ASCII character
appears (e.g. a forward-compat Chinese repair name in
`DataRepairLogEntry`), `utf16` and `utf8` diverge. **Implementation
hint:** in the Swift hash function, iterate `for c in
text.utf16 { hash ^= UInt32(c); hash = hash &* 16777619 }`. Probe
this by hashing the literal string `"中"` on both sides and asserting
equality.

## 8. Risks

Ranked by parity-blocking severity for iOS-2:

1. **`String.<` vs `JSONEncoder.OutputFormatting.sortedKeys` collation
   drift (HIGH).** Both sort lexicographically, but neither guarantees
   the same behaviour for non-ASCII keys as Node's
   `String.prototype.localeCompare()` default. For today's ASCII-only
   schema (Agent 1 §3.1) this is benign; for tomorrow's forward-compat
   keys it is a parity break. *Mitigation:* hand-rolled canonical
   encoder, probe with `"settings.zünft"` test, and a `// MARK: -
   canonical-sort` comment block in the encoder source citing this
   report.
2. **Float printing divergence (HIGH).** Swift's `Double` →
   `JSONEncoder` may print equivalent IEEE 754 values differently from
   JS `Number.prototype.toString`. The fixture-row-1 hash
   (`phase19b-611afec7`) does NOT exercise floats meaningfully (the
   synthetic AppData has no float values). The real-export fixture
   does, transitively, but a Swift round-trip that re-prints `0.5` as
   `0.50000000000000001` would not surface until the next time a
   numeric edit lands. *Mitigation:* `AppDataUnitFieldPreservationTests.swift`
   §4.5 invariant #2, plus a dedicated probe test for `Double(0.5)` and
   `Double(0.1) + Double(0.2)` encoded JSON output.
3. **UTF-16 vs UTF-8 hash input (HIGH).** TS uses `charCodeAt(i)`
   (UTF-16 code unit). A naive Swift port iterating `text.utf8` will
   diverge the moment any non-ASCII character appears. Today's fixtures
   are ASCII-only so the bug is silent. *Mitigation:* the §7 row on
   FNV-1a explicitly names this. `AppDataSnapshotHashParityTests.swift`
   §4.6 invariant #1 catches it for fixture row 1 (which is
   ASCII-only), but a hand-added probe over the literal string `"中"`
   would surface it earlier; Agent 5 should add such a probe as an
   internal hash-function unit test (separate from parity).
4. **Open-bag drop on decode (HIGH per Agent 1 §7 risk #1).** If the
   iOS-2 Codable layer fails to capture unknown keys into an
   `extraJSON` side-bag, fixture row 1's hash diverges by exactly the
   amount of `iosOpenBagField`. The §4.2 test catches this, but
   *only if* the test asserts a specific hash value. The test plan
   above (4.2 invariant #3) does — confirm Agent 5 keeps this strict.
5. **`null` vs absent in the extraJSON bag (MEDIUM).** Swift `nil`
   (typed Optional, skip) vs `JSONValue.null` (bag, emit) must stay
   distinct. No current fixture carries explicit `null`, so a conflation
   bug is silent today. *Mitigation:* §7 row spells this out; bag-type
   implementation MUST distinguish.
6. **Fixture pointer-deref path divergence (MEDIUM).** The real-export
   pointer carries `pointer.path =
   "tests/fixtures/data-health/ironpath-2026-05-27-redacted.json"`,
   resolved from the **repo root**, not the test bundle. If iOS-1's
   `Package.swift` copies fixtures into the bundle and the test uses
   `Bundle.module.url(...)`, deref breaks. *Mitigation:* `#filePath`-
   based relative resolution to repo root. Flag this in iOS-1.
7. **Synthetic fixture's `iosOpenBagField` placement (LOW).** Today the
   golden carries a `settingsTopLevelKeys` summary that double-signals
   the open-bag drop. If iOS-3 removes this summary, only the hash is
   left. *Mitigation:* §4.6 already asserts hash directly, not summary.
8. **Determinism contract on Swift side beyond hash (LOW).** TS has a
   regenerate-twice idempotency test; Swift has no analogue (one-way
   golden → Swift). Risk is a reviewer assuming a Swift-side
   regenerate signal exists. *Mitigation:* docstring at top of
   `AppDataSnapshotHashParityTests.swift` states "Swift CI MUST NOT
   run `scripts/generate-parity-goldens.mjs`".

## 9. Open questions

These are the questions Agent 5 (iOS-2 implementer) and the iOS-2 PR
reviewer must answer before merge. None of them block this planning
document.

1. **Path resolution for the pointer deref.** iOS-1 has not committed
   to a layout. Options: `Package.swift` resource copy / `#filePath`
   macro / symlink. *Suggested default:* `#filePath`-relative to repo
   root, validated by `XCTAssertNotNil` at test setup.
2. **Where does the canonical encoder live?** Dedicated
   `IronPathCanonicalJSON` module (reusable by iOS-3 / iOS-4) vs
   inline in the AppData module. *Suggested default:* dedicated module.
3. **`extraJSON` bag type signature.** *Suggested default:* enum
   `JSONValue { case null, bool, number(Double), int(Int64), string,
   array, object }` — keep `int` distinct so `schemaVersion: 8` does
   NOT stringify as `8.0`.
4. **§4.6 hash test: hard-coded `"phase19b-611afec7"` or parsed from
   the golden?** *Suggested default:* parse from the golden — the
   golden *is* the contract; hard-coding duplicates it.
5. **Should Swift CI invoke `--check` on the TS generator?** *Suggested
   default:* no — TS-side CI already does. Swift CI only loads goldens
   (Contract Freeze §11: "CI MUST NOT regenerate; humans regenerate
   locally"). `--check` is read-only but the rule is path-blanket.
6. **What if the redacted real export evolves (privacy re-scrub)?**
   *Suggested default:* iOS-2 asserts `actualSchemaVersion=8` against
   the golden's `expectedSchemaVersion=8`, which catches a pointer-
   target change without a golden regenerate.
7. **`v=9` fixture: on disk or in-memory?** *Suggested default:*
   in-memory. Committing it would imply forward-compat promise.
8. **Long-term doc location.** Does iOS-2 PR include an
   `IOS_2_APPDATA_SWIFT_MODELS_V1.md` that cites this file? *Suggested
   default:* yes — main acceptance doc cites §3 + §4 here.

---

> **End of Agent 3 report.** No fixtures touched. No Swift written. Six
> Swift test files named and shaped; two iOS-0 fixtures pinned as
> consumers; one transitive pointer-deref fixture; four cross-language
> equality rules documented; four fixture gaps assessed and deferred
> with justification; eight risks ranked; eight open questions left for
> the iOS-2 implementation PR.
