# HK-1 — HealthKit Body-Weight Import V1

> **Status: shipped.** First native **capability ungating** (HealthKit, read-only).
> Approved by the architecture owner via
> `docs/ios-native-migration/IOS_NATIVE_CAPABILITY_UNGATING_ROADMAP_V1.md` (§4.1, slice `HK-1`).
> The same PR amends the binding contract `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`
> (§2/§6.1/§6.2/§6.3/§8.2/§10/§17/§18/§22/§25/§27/§28) — read that first; it outranks this doc.

## 1. Scope (what HK-1 does, and does not)

**Does:** after the user authorizes it, read the **latest body-mass sample** from Apple
Health, map it to a canonical `IronPathDomain.HealthMetricSample` (`metricType:
"body_weight"`, `unit: "kg"`), and append it to canonical `AppData.healthMetricSamples`
through the existing iOS-17A DataHealth-gated write path. Device-local, read-only.

**Does NOT:** write back to Apple Health (HK-3); read any other metric or training history
(HK-2); touch network/cloud/account; change the engine or goldens; couple LocalSnapshot to
AppData; bump the AppData schema; write `userProfile.weightKg`. CloudKit/iCloud/Supabase/
URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData remain fully forbidden.

## 2. Where body weight lands — `healthMetricSamples`, NOT `userProfile.weightKg`

The TypeScript source of truth this Swift model mirrors imports Apple-Health body weight as a
`HealthMetricSample { metricType: "body_weight", unit: "kg" }` in `healthMetricSamples[]`
(`src/engines/healthImportEngine.ts`, `src/engines/appleHealthTypeMap.ts`:
`HKQuantityTypeIdentifierBodyMass → "body_weight"`, kg, `Math.max(0, value)`). The **current
body weight is derived** as the latest such sample (`src/engines/healthSummaryEngine.ts` →
`latestBodyWeightKg`). The importer **never** writes `userProfile.weightKg` — that is the
user's self-entered profile field. HK-1 stays faithful: imported readings land in the
time-series; the latest is derived, not overwritten into the profile.

## 3. Architecture (protocol seam → pure mapper → gated write)

CI / `swift test` cannot run HealthKit, so the mapping logic is a **pure function** behind an
injectable seam; the real `HKHealthStore` reader compiles on device only.

| Layer | File | Notes |
| --- | --- | --- |
| Domain | `IronPathDomain/HealthMetricSampleImport.swift` | `AppData.appendingHealthMetricSample(_:)` — pure open-bag append; rewrites only `healthMetricSamples`; `schemaVersion` unchanged; **dedup by content id** (idempotent re-import). |
| Persistence | `IronPathPersistence/CanonicalSessionWriter.swift` | Extracted `performGatedAppend`; added `appendHealthMetricSample(_:validate:)` — **same** gated path as `appendCompletedSession` (§8.2), not a second write path. |
| HealthKit (pure) | `IronPathHealthKit/BodyMassReading.swift` | `BodyMassReading` value type + `BodyMassSampleSource` protocol seam (read-only: authorize + read latest). |
| HealthKit (pure) | `IronPathHealthKit/HealthKitBodyMassMapper.swift` | `BodyMassReading` → `HealthMetricSample` (kg, `max(0,·)`, content-addressed id mirroring TS `hashText`). |
| HealthKit (pure) | `IronPathHealthKit/HealthKitBodyMassImporter.swift` | Orchestrates authorize → read latest → map. Uses the seam; no HealthKit import. |
| HealthKit (device) | `IronPathHealthKit/HealthKitBodyMassSource.swift` | **The ONLY file that imports HealthKit / uses `HKHealthStore`/`HKQuantityType`.** `#if os(iOS)`; host `swift test` excludes it. Read-only: `requestAuthorization(toShare: [], read: [bodyMass])`, newest-first `HKSampleQuery`, `doubleValue(for: .gramUnit(with: .kilo))`. |
| App | `IronPath/HealthKitBodyWeightImportModel.swift` | `@MainActor` view-model; opts into the live source + `JSONFileAppDataStore.applicationSupport()` on first tap; honest status (`.imported(kg)`/`.noData`/`.failed`/`.unavailable`). Mirrors `FocusModeMvpState` (the gate closure routes the candidate through `processIncomingAppData` read-only). |
| App | `IronPath/HealthKitBodyWeightImportSection.swift` | Thin Section (button + status) mounted in `ProfileRootView` (我的). |

Package graph (acyclic, `IronPathDomain` stays the leaf): `IronPathHealthKit → IronPathDomain`
(same shape as `Persistence`/`DataHealth`).

## 4. Permissions & entitlements

- **`Info.plist`** (`ios/IronPath/Info.plist`): `NSHealthShareUsageDescription` — a Chinese
  string stating IronPath reads the latest body weight **read-only**, stores it **on device**
  (kg), and never uploads or writes back.
- **Entitlement** (`ios/IronPath/IronPath.entitlements`, new): `com.apple.developer.healthkit
  = true`. Intentionally **no** `com.apple.developer.healthkit.access` (no clinical records) and
  **no** background delivery. No iCloud / App Groups / network entitlements.
- **`project.pbxproj`** (justified — first capability ungating): `CODE_SIGN_ENTITLEMENTS =
  IronPath/IronPath.entitlements` on both Debug + Release; file references + Sources-phase
  entries for the entitlements file and the two new app Swift files. Deployment target, device
  family, package-ref count (10), and the single native target are unchanged.

On a real device the first import tap triggers the system HealthKit permission sheet. Apple
Health intentionally **hides read-denial**, so a denied/empty read both surface as `.noData`
("nothing to import") — never a fake success.

## 5. Privacy & data safety

- **On-device only.** HealthKit is read, mapped, and written to the local canonical JSON store.
  No network, no cloud, no telemetry (master §16). HealthKit data never leaves the device.
- **Read-only.** `toShare: []` — the app shares nothing back to Apple Health. Guarded.
- **Gated import (master §8.2/§10).** The candidate is routed through
  `processIncomingAppData(.importRestore, allowMutation:false, allowAutoRepair:false)` and the
  write proceeds only if the imported sample survives `buildCleanAppDataView`. Backup-before-
  overwrite + atomic save + honest throw; a present-but-unreadable document is never
  overwritten; no schema bump (open-bag append). Re-importing the same reading is a no-op
  (content-id dedup).
- **kg storage.** Weight is stored in kilograms end-to-end; display conversion is a view concern.

## 6. Rollback

1. **Per-write:** every overwrite is preceded by a timestamped `…backup-<ISO>` copy of the
   canonical document (the `JSONFileAppDataStore` guarantee). A bad import can be reverted by
   restoring that backup.
2. **Feature:** revert this PR. Removing the entitlement + `NSHealthShareUsageDescription` +
   `CODE_SIGN_ENTITLEMENTS` returns the app to no-HealthKit; `IronPathHealthKit` can return to an
   inert stub (its `Version` constant is retained for the bootstrap probe regardless).
3. **Data:** imported samples are ordinary `healthMetricSamples` entries; they can be dropped by
   a future DataHealth recipe without affecting other AppData (open-bag preserved).

## 7. Static guard updates (shipped in sync — master §22)

- `tests/iosBootstrapForbiddenImports.test.ts`: the three HealthKit-token bans
  (`import HealthKit` / `HKHealthStore` / `HKQuantityType`) now exempt the single adapter file
  `HealthKitBodyMassSource.swift` (`allowInFile`). A new block asserts that file is the **sole**
  holder of those tokens, is **read-only** (`toShare: []`, no `.save(`, no `HKQuantitySample(`),
  and is `#if os(iOS)`.
- `tests/iosBootstrapPackageGraph.test.ts`: `IronPathHealthKit: ['../IronPathDomain']` added to
  `SANCTIONED_LOCAL_PATH_DEPS`.
- Unchanged & still green (verified): `iosArchitectureBoundaryStaticGuards` (whole-ios bans do
  not include HealthKit; the shell surface still imports no HealthKit), `iosLocalJsonPersistence`
  (#16 scoped to the persistence file set), `iosRemainingRepairRecipes` (scoped to DataHealth),
  `iosBootstrapTargetSettings` / `ProjectStructure`, `iosNativeFocusModeShell`.

## 8. Validation (slow lane)

- `swift test`: `IronPathDomain` (incl. `HealthMetricSampleImportTests`),
  `IronPathPersistence` (incl. the `appendHealthMetricSample` suite), `IronPathHealthKit`
  (incl. `HealthKitBodyMassImportTests`: mapper rules + injected-sample importer via a fake
  `BodyMassSampleSource`).
- `npm run api:dev:build && npm run typecheck && npm test && npm run build`; `git diff --check`;
  `package.json` / `package-lock.json` byte-unchanged.
- `xcodebuild` `generic/platform=iOS` **and** `platform=iOS Simulator,name=iPhone 17 Pro`
  (`CODE_SIGNING_ALLOWED=NO`) — both BUILD SUCCEEDED.

(Exact counts/SHAs are recorded in the PR description from real command output.)

## 9. Follow-ons

- **HK-2** — read training history / workouts (still gated; its own slice).
- **HK-3** — write IronPath sessions back to Apple Health (separate privacy review; the
  `toShare` set stays empty until then).
- A read surface that renders the **derived latest body weight** (with display-unit conversion)
  could consume `healthMetricSamples` like the PWA's `healthSummaryEngine`.
