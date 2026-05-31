# HK-3b — Workout export: migrate `HKWorkout` init → `HKWorkoutBuilder` V1

> **Status: shipped.** A technical-debt cleanup of the HK-3 workout **export** write-back. It swaps
> the deprecated `HKWorkout(activityType:…)` initializer + `HKHealthStore.save` for
> `HKWorkoutBuilder` (`beginCollection` → `addMetadata` → `endCollection` → `finishWorkout`), the
> non-deprecated iOS 17+ path. **Equivalent replacement — behavior / metadata / idempotency /
> authorization unchanged.** The only observable effect is that the iOS 17 deprecation warning is
> gone. No new capability, no boundary change, no contract revision.

## 1. Scope (what HK-3b does, and does not)

**Does:** in the single `#if os(iOS)` adapter `HealthKitBodyMassSource.swift`, change *how* the HK-3
export constructs and saves each exported `HKWorkout`. The deprecated one-shot initializer

```swift
let workout = HKWorkout(
    activityType: Self.exportActivityType(request.activityTypeName),
    start: request.start, end: request.end, duration: request.durationSeconds,
    totalEnergyBurned: nil, totalDistance: nil,
    metadata: [HealthKitWorkoutExporter.metadataSessionIDKey: request.sessionId]
)
try await store.save(workout)
```

becomes the builder sequence

```swift
let configuration = HKWorkoutConfiguration()
configuration.activityType = Self.exportActivityType(request.activityTypeName)
let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: nil)
try await builder.beginCollection(at: request.start)
try await builder.addMetadata([HealthKitWorkoutExporter.metadataSessionIDKey: request.sessionId])
try await builder.endCollection(at: request.end)
_ = try await builder.finishWorkout()   // persists to the bound `store`
```

**Does NOT:** change any exported value, the `toShare` set, the idempotency logic, the authorization
flow, the honest-failure semantics, the native-only / no-loop-back guarantee, or any contract
boundary. It touches **only** the HK call inside the one adapter (plus the static-guard token names
and docs that named the old mechanism). The pure mapper (`HealthKitWorkoutExporter`), the
`WorkoutExportSink` seam, the Domain types, the app layer, `Info.plist`, entitlements, and
`project.pbxproj` are all **untouched**. No other HealthKit type is written; no body-mass / heart-rate
write; no network / cloud / remote; no AppData / source-of-truth change.

## 2. Why this is an equivalent, behavior-preserving replacement

| Aspect | Old (`HKWorkout` init + `save`) | New (`HKWorkoutBuilder`) | Equivalent? |
| --- | --- | --- | --- |
| Activity type | `activityType:` arg | `configuration.activityType` | Same value (`exportActivityType(...)`). |
| Start / end | `start:` / `end:` | `beginCollection(at:)` / `endCollection(at:)` | Same instants (`request.start` / `request.end`). |
| Duration | `duration: request.durationSeconds` (explicit) | derived from the begin→end collection window | `request.durationSeconds == end − start` by construction (the pure mapper sets `durationSeconds = end.timeIntervalSince(start)`), and there are no pause events, so the builder-derived duration equals the explicit value. |
| Energy / distance | `totalEnergyBurned: nil`, `totalDistance: nil` | no samples / statistics added | Both unset — identical. |
| Session-id metadata | `metadata:` arg (`com.ironpath.sessionID`) | `addMetadata([...])` with the same key/value | Same metadata on the finished workout; the idempotency query (`predicateForObjects(withMetadataKey:)`) reads it back identically. |
| Persistence | `HKHealthStore.save(workout)` | `finishWorkout()` on a builder bound to the same `store` | Both create + save one `HKWorkout` to Apple Health. |
| Idempotency (skip already-exported) | pre-export `exportedSessionIDs()` query | **unchanged** | Identical. |
| Authorization | `toShare: [workoutType]`, read `[workoutType]` | **unchanged** | Identical — still the only non-empty `toShare`, still only the workout type. |
| Honest failure | the `save` runs in `do/catch` → `failed += 1` on throw | the whole `beginCollection…finishWorkout` runs in `do/catch` → `failed += 1` on any throw | Same contract: `exported` on full success, `failed` on error, never a fake success; one failure does not abort the rest. |

The exported `WorkoutExportSummary` (`exported` / `skippedDuplicate` / `failed`) is computed exactly as
before. Re-export remains an idempotent no-op (state lives in Apple Health, queried by the session-id
metadata key — no app-side dedup storage, no schema bump).

## 3. The deprecation warning (the reason for this slice)

HK-3 compiled with exactly one deprecation warning (the compiler itself pointed at the fix):

```
HealthKitBodyMassSource.swift:285:27: warning:
  'init(activityType:start:end:duration:totalEnergyBurned:totalDistance:metadata:)'
  was deprecated in iOS 17.0: Use HKWorkoutBuilder
```

After HK-3b that warning is gone (both `xcodebuild` destinations `BUILD SUCCEEDED` with no
`HKWorkout`-initializer deprecation warning). The build never treated warnings as errors, so this is a
hygiene cleanup, not a functional fix.

## 4. Static guards (token names follow the new API — net protection does not decrease)

This is a guard **token-name** update following the API rename, not a guard weakening (master §22). The
write mechanism the guards pin changed from "the deprecated `HKWorkout` initializer + `save`" to
"`HKWorkoutBuilder` + `finishWorkout`"; every real boundary the guards enforce is unchanged, and the
new symbols are now **confined to the single adapter** (a strictly tighter surface).

- **`tests/iosBootstrapForbiddenImports.test.ts`**
  - `HKWorkoutBuilder` and `HKWorkoutConfiguration` are added to the **forbidden-everywhere /
    `allowInFile`-adapter** list and to the **sole-holder** `healthKitTokens` list — so, like every
    other HealthKit token, they may appear **only** in the one `#if os(iOS)` adapter and nowhere else
    in `ios/` (new confinement → net protection up).
  - The in-adapter `expect(code).not.toMatch(/HKWorkoutBuilder\b/)` negative became the positive
    `expect(code).toMatch(/HKWorkoutBuilder\s*\(/)`. The `no HKQuantitySample` negative and the
    `toShare: []` / `toShare: [workoutType]` / `no bodyMass share` assertions are **unchanged**.
- **`tests/iosHealthKitWorkoutExportStaticGuards.test.ts`**
  - The `HKWorkout\s*\(` and `store\.save\s*\(` positives became `HKWorkoutBuilder\s*\(` and
    `\.finishWorkout\s*\(`. Idempotency (`metadataSessionIDKey` + `withMetadataKey`), native-only,
    user-triggered, honest-status, and `no HKQuantitySample` / `no bodyMass share` assertions are
    **unchanged**.
- **`tests/iosHealthKitWorkoutImportStaticGuards.test.ts`**
  - Comment-only refresh of the one line that named the old mechanism; its `no HKQuantitySample(`
    assertion is unchanged.

Net protection is **not** reduced: it shifts from "exactly one bounded, native-only, idempotent,
user-triggered workout export written with the deprecated `HKWorkout` initializer" to "…written with
`HKWorkoutBuilder`", with the builder symbols newly locked to the single adapter.

## 5. Relationship to the binding contract (`IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`)

**No contract revision.** Every binding rule (§1–§26) stays true after HK-3b: export-only, OUTSIDE the
§8.1 canonical write path, AppData remains the source of truth, idempotent (Health-side state, no
schema bump), native-only / no-loop-back, `toShare: [workoutType]` only, no other Apple-Health type
(no `HKQuantitySample`), confined to the single `#if os(iOS)` adapter, guarded by
`iosHealthKitWorkoutExportStaticGuards` + `iosBootstrapForbiddenImports`. §8.2 describes the export as
writing native sessions "to Apple Health as `HKWorkout`s" — still accurate (the builder produces and
saves `HKWorkout`s).

The only place the master document names the *old* write mechanism is the **§27 milestone table** HK-3
row ("…via `HKHealthStore.save`" and "still no `HKQuantitySample`/`HKWorkoutBuilder`"). §27 is
explicitly **descriptive context** (the table's own footer: "Milestone facts here are descriptive
context; the rules in §1–§26 are binding"), and that row is a historical record of HK-3 as it shipped.
Per this task's scope (contract expected **no revision**; the binding boundary is unchanged), the
master document is **left untouched**; this HK-3b doc records the mechanism migration. A future
housekeeping / contract-amendment pass may add an HK-3b §27 row and refine the HK-3 row's descriptive
mechanism note — that is a doc-amendment concern, not a boundary change.

## 6. Validation

- `swift test --package-path ios/packages/IronPathHealthKit` — the pure export / idempotency tests
  (`HealthKitWorkoutExportTests`) stay green with zero regression. (They exercise the pure
  `HealthKitWorkoutExporter`; the `#if os(iOS)` adapter — the only file changed — is not compiled by
  the host toolchain, so it is validated by `xcodebuild` below.)
- `npm run api:dev:build && npm run typecheck && npm test && npm run build` — all green, including the
  updated HealthKit static guards.
- `git diff --check`; `package.json` / `package-lock.json` byte-unchanged.
- `xcodebuild` `generic/platform=iOS` **and** `platform=iOS Simulator,name=iPhone 17 Pro`
  (`CODE_SIGNING_ALLOWED=NO`): both `BUILD SUCCEEDED`, and the `HKWorkout`-initializer deprecation
  warning is **absent** (it was present before HK-3b — see §3).

## 7. Rollback

Revert this PR. HK-3 export returns to the deprecated `HKWorkout` initializer + `save` (the
deprecation warning returns; behavior is identical either way). No data migration — exported workouts
in Apple Health are unaffected (same activity / window / duration / `com.ironpath.sessionID`
metadata), and IronPath's canonical AppData is untouched by export in both versions.
