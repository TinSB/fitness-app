# HK-2b — Workout Distance + Avg/Max Heart Rate V1

> **Status: shipped.** A read-only **field** refinement of the HK-2 workout-history import —
> per-workout **distance** and **average / maximum heart rate** — **within** the already-ungated
> read-only HealthKit boundary opened by HK-1 and refined by HK-2. Pre-sanctioned by the
> binding contract's own §27 "Next" list ("richer workout fields (distance, heart rate)").
> The same PR makes a **minimal** amendment to `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`
> (§17/§18/§27) — read that first; it outranks this doc.

## 1. Scope (what HK-2b does, and does not)

**Does:** when the user runs the existing HK-2 workout import, additionally lift two derived
sub-fields off each Apple-Health workout:

- **Distance** (`distanceMeters`, SI meters) — read from the workout's own
  `HKWorkout.statistics(for:)` using the activity-appropriate distance quantity type
  (walking/running, cycling, swimming). Non-distance activities (strength training, yoga, …)
  honestly carry no distance.
- **Average + maximum heart rate** (`avgHeartRate` / `maxHeartRate`, bpm) — read **read-only**
  from the `heartRate` samples within the workout's start–end window via a discrete
  `HKStatisticsQuery` (`.discreteAverage` + `.discreteMax`).

Both land on the existing derived `IronPathDomain.ImportedWorkoutSample` (which already reserved
these fields in HK-2), are stored through the same DataHealth-gated §8.2 write path, and are
shown in the 我的 (Profile) import list when present, still marked **"来自 Apple 健康"**.

**Does NOT:** write back to Apple Health (HK-3); add a standalone heart-rate **metric**
(`heartRate` is read only as a *workout sub-field*, never a first-class `HealthMetricSample`);
inject imported workouts into canonical training `history`; feed them (or any sub-field) into
the `IronPathTrainingDecision` engine (readiness / e1RM / volume); touch network/cloud/account;
change the engine or goldens; bump the AppData schema; add a new app file or edit
`project.pbxproj`. CloudKit/iCloud/Supabase/URLSession/WebView/auth/UserDefaults/SQLite/CoreData/
SwiftData remain fully forbidden.

## 2. The hard red line is unchanged — derived / external, NEVER canonical, NEVER engine input

HK-2b adds **fields**, not a new data path. Distance and heart rate are sub-fields of an
imported Apple-Health workout, which remains **derived / external** data:

1. **Separate bag.** They live on `ImportedWorkoutSample` rows in `AppData.importedWorkoutSamples`
   — the bag SEPARATE from canonical `AppData.history`. No new landing point; the open-bag append
   (`AppData.appendingImportedWorkoutSample`) is untouched.
2. **Engine never reads it.** The native `IronPathTrainingDecision` engine references
   `importedWorkoutSamples` **nowhere** — guarded by `tests/iosHealthKitWorkoutImportStaticGuards.test.ts`
   (test 9). That guard covers the **whole** record, so distance/heart rate are display-only by
   the same structural fact as the rest of the workout summary. Making any of these influence the
   engine, or merging them into canonical history, is a **source-of-truth/engine-input change
   requiring its own approved, contract-amending task** — not HK-2b.

## 3. No schema bump — the shape was already reserved

`ImportedWorkoutSample` (Swift) and `ImportedWorkoutSample` (TS, `src/models/training-model.ts`)
**already declared** `distanceMeters?`, `avgHeartRate?`, `maxHeartRate?` in HK-2. HK-2b only
**populates** them from the live read; old records simply keep them `nil`. Open-bag fidelity and
the unknown-key preservation are unchanged; `schemaVersion` is **not** bumped.

## 4. Architecture (where the change lives)

CI / `swift test` cannot run HealthKit, so the mapping stays a **pure function** behind the
injectable seam; the real `HKWorkout`/heart-rate reads compile on device only.

| Layer | File | HK-2b change |
| --- | --- | --- |
| HealthKit (pure) | `IronPathHealthKit/WorkoutReading.swift` | Seam value gains `avgHeartRateBpm` / `maxHeartRateBpm` (`distanceMeters` already present). Still HealthKit-free. |
| HealthKit (pure) | `IronPathHealthKit/HealthKitWorkoutMapper.swift` | Carries distance + avg/max heart rate into the derived sample (round-to-1-decimal + clamp ≥ 0, same rule as energy/duration; honest `nil` when the reading recorded none). |
| HealthKit (device) | `IronPathHealthKit/HealthKitBodyMassSource.swift` | The SAME single `#if os(iOS)` adapter: `requestAuthorization(toShare: [], read: [workoutType, heartRateType])`; distance via `workout.statistics(for:)` (activity-mapped type); avg/max heart rate via a read-only `HKStatisticsQuery` over the workout window. **No `HKHealthStore.save`, no `HKWorkout(...)` construction.** |
| App | `IronPath/ProfileRootView.swift` | The import-row subtitle now appends distance (km ≥ 1 km, else m) + heart rate ("心率 平均/最高 bpm") when present; footer text updated. View holds no logic; **no new app file → `project.pbxproj` untouched**. |
| Domain / Persistence | — | **Unchanged.** Fields and the gated write path already accommodate this. |

Package graph unchanged (`IronPathHealthKit → IronPathDomain`); no new package, no new
dependency edge.

## 5. Permissions & entitlements

- **`Info.plist`** (`ios/IronPath/Info.plist`): `NSHealthShareUsageDescription` — **reused**.
  A single read-only HealthKit usage string covers all reads (body mass, workouts, and the
  workout-window heart-rate read). **No new key.**
- **Entitlement** (`ios/IronPath/IronPath.entitlements`): `com.apple.developer.healthkit = true`
  — **reused from HK-1**. No new entitlement; no clinical records; no background delivery.
- **`project.pbxproj`**: **untouched** (no new app-target files; the UI change is inlined).
- **Authorization scope:** the workout import's read set is extended from `[workoutType]` to
  `[workoutType, heartRateType]`. On a real device the import permission sheet now additionally
  asks for **heart rate** read access. Distance needs no separate type — it rides along with
  workout access (like energy). Apple Health intentionally **hides read-denial**, so a denied
  heart-rate read surfaces as `nil` heart rate (the workout still imports) — never a fake value.

## 6. Privacy & data safety

- **On-device only.** HealthKit is read, mapped, and written to the local canonical JSON store.
  No network, no cloud, no telemetry (master §16). **HealthKit data — heart rate included — never
  leaves the device.**
- **Read-only.** `toShare: []` — the app shares nothing back to Apple Health. Guarded
  (`iosBootstrapForbiddenImports` sole-holder + read-only assertions;
  `iosHealthKitWorkoutImportStaticGuards` HK-2b block).
- **No new banned symbol token.** Heart rate is read via `HKQuantityType(.heartRate)` — the
  **already-exempted** `HKQuantityType` token — and `HKStatisticsQuery` (never on the ban list).
  The `iosBootstrapForbiddenImports` sole-holder list is therefore **unchanged**: the single
  adapter file stays the only HealthKit-token holder.
- **Gated import (master §8.2/§10).** Unchanged: each candidate still routes through
  `processIncomingAppData(.importRestore, allowMutation:false, allowAutoRepair:false)`;
  backup-before-overwrite + atomic save + honest throw; content-id dedup; no schema bump.
- **SI storage.** Distance is meters; heart rate is bpm; duration minutes; energy kcal. Display
  formatting (km, "平均/最高 bpm") is a pure view concern.
- **Honest degradation.** A workout with no distance / no heart-rate samples carries `nil` for
  those fields — never a fabricated 0. A heart-rate query failure degrades that one field to
  `nil` without aborting the import.

## 7. Rollback

1. **Per-write:** every overwrite is preceded by a timestamped `…backup-<ISO>` copy (the
   `JSONFileAppDataStore` guarantee). A bad import can be reverted by restoring that backup.
2. **Feature:** revert this PR. HK-1 (body weight) and HK-2 (workout summary) are unaffected; the
   HealthKit entitlement / usage string stay. The fields revert to unpopulated (`nil`).
3. **Data:** distance/heart rate are ordinary open-bag fields on `importedWorkoutSamples`; they
   can be dropped by a future DataHealth recipe without affecting other AppData.

## 8. Static guard updates (shipped in sync — master §22)

- `tests/iosHealthKitWorkoutImportStaticGuards.test.ts`: adds an **HK-2b block** — the seam
  carries `avgHeartRateBpm`/`maxHeartRateBpm` (+ `distanceMeters`); the pure mapper carries them
  into the derived sample; the single adapter reads them **read-only** (heart rate added to the
  read set, `toShare: []`, distance via `statistics`, heart rate via discrete `HKStatisticsQuery`,
  no `.save`/no `HKWorkout(` construction); and this doc exists. The pre-existing **display-only
  red line** (test 9 — no `IronPathTrainingDecision` source reads `importedWorkoutSamples`) is
  unchanged and now covers distance/heart rate too.
- `tests/iosBootstrapForbiddenImports.test.ts`: **unchanged.** Heart rate introduces no new banned
  HealthKit symbol (it reuses the exempted `HKQuantityType`), so the sole-holder list and the
  read-only assertions stay as HK-2 left them.
- Unchanged & still green: `iosBootstrapPackageGraph`, `iosBootstrapTargetSettings`,
  `ProjectStructure` (no new package, no new target, `project.pbxproj` untouched).

## 9. Validation (slow lane)

- `swift test`: `IronPathHealthKit` (incl. `HealthKitWorkoutImportTests` — new HK-2b cases:
  carries distance + avg/max heart rate, rounds/clamps, honest `nil` when absent, and a canonical
  round-trip), `IronPathDomain`, `IronPathPersistence`.
- `npm run api:dev:build && npm run typecheck && npm test && npm run build`; `git diff --check`;
  `package.json` / `package-lock.json` byte-unchanged.
- `xcodebuild` `generic/platform=iOS` **and** `platform=iOS Simulator,name=iPhone 17 Pro`
  (`CODE_SIGNING_ALLOWED=NO`) — both BUILD SUCCEEDED.

(Exact counts/SHAs are recorded in the PR description from real command output.)

## 10. Real-device smoke checklist (manual, post-merge)

1. Build & run on a device with Apple Health data containing ≥ 1 workout that recorded distance
   and heart rate (e.g. an Apple Watch outdoor run/walk).
2. 我的 → **从 Apple 健康导入训练历史** → grant **workout** AND **heart rate** read access in the
   system sheet.
3. Confirm distance (e.g. "5.2 公里") and heart rate (e.g. "心率 148/172 bpm") appear on the
   relevant rows, still marked **"来自 Apple 健康"**. A strength workout shows no distance.
4. Deny **heart rate** only → workouts still import with distance/energy; heart rate is simply
   absent (no fake value).
5. Re-tap import → no duplicates (content-id dedup; distance/heart rate are not part of the id).
6. Confirm 训练 (Focus) history and 今日 readiness are **unchanged** by the import (display-only).
7. Confirm no network traffic — heart rate and all reads stay fully on-device.

## 11. Follow-ons

- **HK-3** — write IronPath sessions back to Apple Health (separate privacy review; `toShare`
  stays empty until then).
- Standalone health metrics as first-class `healthMetricSamples` (e.g. resting heart rate, VO₂max)
  remain **forbidden** without their own approved, contract-amending slice (§18) — HK-2b's heart
  rate is strictly a **workout sub-field**, not a tracked metric.
