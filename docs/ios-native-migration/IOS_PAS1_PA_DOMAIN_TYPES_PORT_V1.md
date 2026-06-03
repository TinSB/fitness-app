# PA-S1 — PA Domain Type-Family Port (V1)

**Slice:** PA-S1 (the Plan-Adaptive track's type ground-floor)
**Package:** `IronPathDomain` (pure value types only)
**Status:** PURE TYPES — not wired into any UI or engine yet.
**Baseline:** latest `origin/main` (PA-S0 `#476`).

## Why

The Plan-Adaptive (PA) track is the program self-adjustment surface
(`programAdjustmentEngine` / `identity` / `coachAction` and two more
engines). All of them consume a shared PA domain type vocabulary that did
not exist in Swift yet. PA-S1 is the **foundation** slice: it ports that
vocabulary as pure `IronPathDomain` value types so the engine slices that
follow have a faithful, lossless, parity-pinned type surface to build on.

This slice ships **zero** runtime/engine logic, **zero** writes, **zero**
UI, and touches **no** existing golden.

## Types ported (faithful mirror of `src/models/training-model.ts`)

| Swift type | TS source | Notes |
| --- | --- | --- |
| `EstimateConfidence` | `:153` | closed enum `low`/`medium`/`high` |
| `AdjustmentChangeType` | `:1139` | closed enum (7 cases, snake_case raw values) |
| `DayTemplate` | `:218` | one training day inside a rich program |
| `ExerciseTemplate` | `:345` (`extends ExerciseMetadata` `:313`) | metadata fields FLATTENED (Swift has no struct inheritance; `ExerciseMetadata` is not a standalone Swift type) |
| `TrainingTemplate` | `:513` | nested `exercises: [ExerciseTemplate]` |
| `WeeklyActionRecommendation` | `:1077` | `confidence: EstimateConfidence`, anonymous `suggestedChange` → raw |
| `AdjustmentChange` | `:1148` | `type: AdjustmentChangeType` |
| `ProgramAdjustmentDraft` | `:1172` | nested `changes: [AdjustmentChange]`, `diffPreview: ProgramAdjustmentDiff` |
| `ProgramAdjustmentHistoryItem` | `:1200` | nested `changes`, `sourceProgramSnapshot: ProgramTemplate` |
| `ProgramAdjustmentDiff` | `:1220` | anonymous-object `changes` array → raw |

### Paradigm (identical to the existing Domain types)

Each type is a `struct` (`Equatable`/`Hashable`/`Sendable`) with:

- `init(decoding value: JSONValue) throws` + `func encoded() -> JSONValue`
  (the `ProgramTemplate` / `MesocyclePlan` / `UnitSettings` paradigm — NOT
  raw Swift `Codable`);
- an `_unknown: OrderedJSONObject` **open bag** that carries every field
  not promoted to a typed property;
- a key-sorted **canonical** round-trip: `decode → encoded()` is
  byte-identical to the canonical form of the input, at every nesting
  level.

All stored properties are `Optional` (the `ProgramTemplate` convention —
a partially-formed document still decodes); the TS requiredness of each
field is recorded in an in-line comment.

### Field-type rules (sibling precedents)

- **string-union → `String`** — the `ProgramTemplate.primaryGoal`
  precedent. Preserves an unknown future member losslessly.
- **closed union → enum, decoded with the "extracted-set" rule** — the
  `UnitSettings.weightUnit` precedent. A key is lifted out of `_unknown`
  ONLY when its raw token maps to a known case; an unrecognised token
  stays in the open bag and round-trips verbatim (never dropped).
- **number → `NumberRepr`**, **boolean → `Bool`**, **`string[]` → `[String]`**.
- **tuple `[number, number]` / `Record<…>` / anonymous-object arrays /
  not-yet-typed nested structs (`AdjustmentEffectReview`, `TechniqueStandard`,
  `ExerciseEquivalenceChain`, …) → raw `JSONValue`** — the
  `MesocyclePlan.weeks` precedent for structures the consuming engine does
  not yet need typed. Lossless.

Shared open-bag (de)serialization plumbing lives in
`PACodableSupport.swift` (a `PAJSONCodable` protocol + `PADecode` /
`PAEncode` helpers). These factor out the EXACT same serialization the
existing Domain types write inline (kept DRY so the 45-field
`ExerciseTemplate` stays readable). **No business logic.**

## `ProgramTemplate` rich/thin reconciliation (additive — no escalation)

The TS `ProgramTemplate` (`:228`) is **rich** (`dayTemplates` +
`weeklyMuscleTargets`), but the Swift `ProgramTemplate` is the **thin**
persisted struct that EDIT-4 edits in place
(`withConfigScalars` → `AppData.withUpdatedProgramConfig`).

Promoting the rich fields to STORED typed fields would (a) change the
struct's `documentedKeys` / `init(decoding:)` / `encoded()`, and (b) force
`withConfigScalars` to carry the new fields forward — i.e. it would change
`ProgramTemplate` decode/encode **and** touch the EDIT-4 write path. That
is the contract's stop-and-escalate trigger.

**PA-S1 therefore does NOT promote.** It adds READ-ONLY typed
**projections** in `ProgramTemplate+PARich.swift`:

```swift
extension ProgramTemplate {
    public var dayTemplates: [DayTemplate]? { /* decode on demand from _unknown */ }
    public var weeklyMuscleTargets: [String: NumberRepr]? { /* decode on demand */ }
}
```

Consequences (all verified):

- `ProgramTemplate.swift` is **byte-unchanged**.
- `documentedKeys` / `init(decoding:)` / `encoded()` / `withConfigScalars`
  / `AppData.withUpdatedProgramConfig` are untouched.
- `schemaVersion` is **NOT** bumped.
- The rich fields physically stay in `_unknown`, so a rich program
  document round-trips through the thin struct **byte-identically** and
  EDIT-4 carries them forward verbatim exactly as before.
- The PA engines get typed read access via `programTemplate.dayTemplates`.

See §9 (PA-S1 note) and §27.

## Testing

`PADomainTypesParityTests` (inline TS-shaped JSON fixtures — the
`ScreeningProfileEditTests` precedent, so **no new golden** and the parity
fixture-count guards are untouched). Per type: field-by-field shape
assertions + open-bag preservation + canonical round-trip; plus
unknown-enum-token preservation and the `ProgramTemplate` rich-projection
+ thin byte-identical rich round-trip.

## Verification (all green)

| Check | Result |
| --- | --- |
| `npm run typecheck` | `TC=0` |
| `npx vitest run` | `ALL=0` — 1373 files / 7331 tests |
| `swift test` `IronPathDomain` | `DOM=0` — 188 tests |
| `swift test` `IronPathPersistence` | `PER=0` (EDIT-4 still green) |
| `xcodebuild … build` | `XC=0` — BUILD SUCCEEDED |

`git diff --check` clean; `project.pbxproj` / `Package.swift` /
`package.json` / `package-lock.json` / `.claude` byte-unchanged; new
sources + test are `--diff-filter=A`; zero golden `--diff-filter=M`.

## Red-line compliance

- Faithful shape, no omission, no deviation (TS source line cited per field).
- Pure types: zero runtime/business logic (only open-bag (de)serialization),
  zero writes, zero `: Date`.
- `ProgramTemplate` additive: no persistence / EDIT-4 / §9 schema breakage.
- Reuses the existing thin `ProgramTemplate` (not redefined).
- Existing goldens zero drift; counts in sync (75 → 75).
- Did not touch `pbxproj` / deps / `Package.swift` / `.claude`.
