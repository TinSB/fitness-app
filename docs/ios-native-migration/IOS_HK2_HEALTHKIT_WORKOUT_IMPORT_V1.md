# HK-2 — HealthKit Workout-History Import V1

> **Status: shipped.** A read-only HealthKit scope refinement (workout history) **within**
> the already-ungated read-only HealthKit boundary opened by HK-1.
> Approved by the architecture owner via
> `docs/ios-native-migration/IOS_NATIVE_CAPABILITY_UNGATING_ROADMAP_V1.md` (§4.1, slice `HK-2`).
> The same PR amends the binding contract `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`
> (§2/§6.1/§6.2/§8.2/§10/§17/§18/§27) — read that first; it outranks this doc.

## 1. Scope (what HK-2 does, and does not)

**Does:** after the user authorizes it, read **recent workouts** (newest first) from Apple
Health — **type / start–end / duration / active energy** — map each to a derived
`IronPathDomain.ImportedWorkoutSample` (`source: "healthkit_import"`), and append them to
canonical `AppData.importedWorkoutSamples` through the existing iOS-17A / HK-1 DataHealth-gated
write path. Device-local, read-only. The 我的 (Profile) tab lists the imported summaries,
each clearly marked **“来自 Apple 健康”**.

**Does NOT:** write back to Apple Health (HK-3); inject imported workouts into canonical
training `history`; feed them into the `IronPathTrainingDecision` engine (readiness / e1RM /
volume); touch network/cloud/account; change the engine or goldens; couple LocalSnapshot to
AppData; bump the AppData schema. CloudKit/iCloud/Supabase/URLSession/WebView/auth/UserDefaults/
SQLite/CoreData/SwiftData remain fully forbidden.

## 2. The hard red line — derived / external, NEVER canonical training, NEVER engine input

An imported Apple-Health workout is **derived / external** data, not a native canonical
`TrainingSession`. Two structural facts enforce this and are guarded:

1. **Separate bag.** Imported workouts land in `AppData.importedWorkoutSamples[]`, a bag
   **distinct** from canonical `AppData.history[]`. The pure open-bag append
   (`AppData.appendingImportedWorkoutSample`) rewrites **only** `importedWorkoutSamples`; it is
   not `appendingHistorySession` and never writes the `history` key. The TS source of truth
   models the same split (`importedWorkoutSamples` vs `history` in `training-model.ts`).
2. **Engine never reads it.** The native `IronPathTrainingDecision` engine does **not** port
   `buildHealthSummary` (the TS sample→summary aggregation): its core slice always passes
   `healthSummary: nil` (`TrainingDecisionReadiness.swift`, `TrainingDecisionCoreSliceEngine.swift`).
   So `importedWorkoutSamples` — like HK-1's `healthMetricSamples` — is **display-only** on
   native. `tests/iosHealthKitWorkoutImportStaticGuards.test.ts` pins this: **no**
   `IronPathTrainingDecision` source references `importedWorkoutSamples`.

> This is a deliberate divergence from the TS PWA, where `importedWorkoutSamples` *does* feed
> `readinessEngine` via `buildHealthSummary`. On native that aggregation is unported, so the
> import stays display-only. If a future slice ever wants imported workouts to influence
> readiness, that is a **source-of-truth/engine-input change requiring its own approved,
> contract-amending task** — not HK-2.

## 3. The `source: "healthkit_import"` tag

Imported workouts carry `source: "healthkit_import"` — an unambiguous marker that the row is a
**derived Apple-Health import**, never canonical native training. This is deliberately distinct
from HK-1's body-weight `source: "apple_health_export"`. It is native-only, lives in the
open-bag `ImportedWorkoutSample.source` (a `String?`, not the TS `HealthDataSource` enum), never
round-trips to the TS PWA, and does not affect the gate (which matches by content `id`).

## 4. Architecture (protocol seam → pure mapper → gated write)

CI / `swift test` cannot run HealthKit, so the mapping logic is a **pure function** behind an
injectable seam; the real `HKWorkout` reader compiles on device only.

| Layer | File | Notes |
| --- | --- | --- |
| Domain | `IronPathDomain/ImportedWorkoutSample.swift` | Typed open-bag value (mirrors TS `ImportedWorkoutSample`): id, source, workoutType, start/end, durationMin, activeEnergyKcal, distanceMeters, … `_unknown`. |
| Domain | `IronPathDomain/ImportedWorkoutSampleImport.swift` | `AppData.appendingImportedWorkoutSample(_:)` — pure open-bag append; rewrites **only** `importedWorkoutSamples`; `schemaVersion` unchanged; **dedup by content id**; + a read-only `importedWorkoutSamples` accessor. |
| Persistence | `IronPathPersistence/CanonicalSessionWriter.swift` | `appendImportedWorkoutSample(_:validate:)` + batch `appendImportedWorkoutSamples(_:validate:)` — **same** gated `performGatedAppend` path as `appendCompletedSession` / `appendHealthMetricSample` (§8.2), not a second write path. The batch folds the whole history list into **one** load → gate → backup → save. |
| HealthKit (pure) | `IronPathHealthKit/WorkoutReading.swift` | `WorkoutReading` value + `WorkoutSampleSource` protocol seam (read-only: authorize + read recent). |
| HealthKit (pure) | `IronPathHealthKit/HealthKitWorkoutMapper.swift` | `WorkoutReading` → `ImportedWorkoutSample` (source `"healthkit_import"`, durationMin/kcal SI, content-addressed `workout-<hash>` id mirroring TS `hashText`). Also `displayLabel(forWorkoutType:)` mirroring `formatAppleWorkoutType`. |
| HealthKit (pure) | `IronPathHealthKit/HealthKitWorkoutImporter.swift` | Orchestrates authorize → read recent → map each. Uses the seam; no HealthKit import. |
| HealthKit (device) | `IronPathHealthKit/HealthKitBodyMassSource.swift` | Adds `HealthKitWorkoutSource` to the **same single** file that imports HealthKit. `#if os(iOS)`; host `swift test` excludes it. Read-only: `requestAuthorization(toShare: [], read: [HKObjectType.workoutType()])`, newest-first `HKSampleQuery`, energy via `statistics(for: HKQuantityType(.activeEnergyBurned))`. **No `HKHealthStore.save`, no `HKWorkout(...)` construction.** |
| App | `IronPath/ProfileRootView.swift` | Inlined `HealthKitWorkoutImportModel` (`@MainActor`, opts into the live source + `JSONFileAppDataStore.applicationSupport()` on first tap; honest status) + `HealthKitWorkoutImportSection` (button + “来自 Apple 健康” list). **No new app file → `project.pbxproj` untouched** (mirrors the N-2 precedent). |

Package graph unchanged (`IronPathHealthKit → IronPathDomain`); no new package, no new
dependency edge.

## 5. Permissions & entitlements

- **`Info.plist`** (`ios/IronPath/Info.plist`): `NSHealthShareUsageDescription` — **reused from
  HK-1** (the same read-only HealthKit usage string already covers workout reads). No new key.
- **Entitlement** (`ios/IronPath/IronPath.entitlements`): `com.apple.developer.healthkit = true`
  — **reused from HK-1**. No new entitlement; no clinical-records access; no background delivery.
- **`project.pbxproj`**: **untouched.** No new app-target files (the model + section are inlined
  in the existing `ProfileRootView.swift`); the new package sources are SPM-auto-included.

On a real device the first import tap triggers the system HealthKit permission sheet (now
including the workout type). Apple Health intentionally **hides read-denial**, so a denied/empty
read both surface as `.noData` (“nothing to import”) — never a fake success.

## 6. Privacy & data safety

- **On-device only.** HealthKit is read, mapped, and written to the local canonical JSON store.
  No network, no cloud, no telemetry (master §16). HealthKit data never leaves the device.
- **Read-only.** `toShare: []` — the app shares nothing back to Apple Health. Guarded
  (`iosBootstrapForbiddenImports` + `iosHealthKitWorkoutImportStaticGuards`).
- **Gated import (master §8.2/§10).** Each candidate is routed through
  `processIncomingAppData(.importRestore, allowMutation:false, allowAutoRepair:false)` and the
  write proceeds only if the imported workouts survive `buildCleanAppDataView`. Backup-before-
  overwrite + atomic save + honest throw; a present-but-unreadable document is never overwritten;
  no schema bump (open-bag append). Re-importing the same workout is a no-op (content-id dedup).
- **SI / kg storage.** Duration is minutes, energy is kcal, distance (when populated) is meters;
  body weight elsewhere stays kilograms. Display formatting is a view concern.

## 7. Rollback

1. **Per-write:** every overwrite is preceded by a timestamped `…backup-<ISO>` copy of the
   canonical document (the `JSONFileAppDataStore` guarantee). A bad import can be reverted by
   restoring that backup.
2. **Feature:** revert this PR. HK-1 (body weight) is independent and unaffected; the HealthKit
   entitlement / usage string stay (HK-1 owns them).
3. **Data:** imported workouts are ordinary `importedWorkoutSamples` entries; they can be dropped
   by a future DataHealth recipe without affecting other AppData (open-bag preserved).

## 8. Static guard updates (shipped in sync — master §22)

- `tests/iosBootstrapForbiddenImports.test.ts`: the HealthKit-token bans now also cover
  `HKWorkout` / `HKWorkoutActivityType`, exempting the single adapter file `HealthKitBodyMassSource.swift`
  (`allowInFile`). The boundary block adds those tokens to the **sole-holder** list and adds
  read-only assertions (no `HKWorkout(` construction, no `HKWorkoutBuilder`).
- `tests/iosHealthKitWorkoutImportStaticGuards.test.ts` (new): pins the pure layer
  (HealthKit-free seam/mapper/importer, `source "healthkit_import"`), the derived landing point
  (`importedWorkoutSamples`, never `history`), the single gated write path (one `store.save`),
  the **display-only red line** (no `IronPathTrainingDecision` source reads
  `importedWorkoutSamples`), the thin honest app layer, and this doc.
- Unchanged & still green: `iosBootstrapPackageGraph` (`IronPathHealthKit → IronPathDomain`
  already sanctioned by HK-1; no new edge), `iosBootstrapTargetSettings` / `ProjectStructure`
  (no new package, no new target, `project.pbxproj` untouched).

## 9. Validation (slow lane)

- `swift test`: `IronPathDomain` (incl. `ImportedWorkoutSampleImportTests`),
  `IronPathPersistence` (incl. the workout `appendImportedWorkoutSample(s)` suite),
  `IronPathHealthKit` (incl. `HealthKitWorkoutImportTests`: mapper rules + display labels +
  injected-sample importer via a fake `WorkoutSampleSource`).
- `npm run api:dev:build && npm run typecheck && npm test && npm run build`; `git diff --check`;
  `package.json` / `package-lock.json` byte-unchanged.
- `xcodebuild` `generic/platform=iOS` **and** `platform=iOS Simulator,name=iPhone 17 Pro`
  (`CODE_SIGNING_ALLOWED=NO`) — both BUILD SUCCEEDED.

(Exact counts/SHAs are recorded in the PR description from real command output.)

## 10. Real-device smoke checklist (manual, post-merge)

1. Build & run on a device signed into iCloud with Apple Health data containing ≥1 workout.
2. 我的 → **从 Apple 健康导入训练历史** → grant **workout** read access in the system sheet.
3. Confirm the imported workouts list appears, each marked **“来自 Apple 健康”**, with type /
   date / minutes / kcal.
4. Re-tap import → the list does **not** duplicate (content-id dedup).
5. Deny access on a fresh install → status reads “没有可导入的训练，或未授权读取” (no fake success).
6. Confirm 训练 (Focus) history and 今日 readiness are **unchanged** by the import (display-only).
7. Confirm no network traffic (the import is fully on-device).

## 11. Follow-ons

- **HK-3** — write IronPath sessions back to Apple Health (separate privacy review; the
  `toShare` set stays empty until then).
- Richer workout fields (distance, avg/max heart rate) — the `ImportedWorkoutSample` shape and
  the gated path already accommodate them; the V1 read keeps the summary to type / start–end /
  duration / energy.
