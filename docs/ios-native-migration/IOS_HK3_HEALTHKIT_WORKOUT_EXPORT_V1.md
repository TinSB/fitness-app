# HK-3 — HealthKit Workout WRITE-BACK (Export) V1

> **Status: shipped.** The FIRST and ONLY Apple-Health **write** in the native iOS tree:
> a user-triggered, idempotent, native-only **export** of IronPath's own completed
> sessions to Apple Health as `HKWorkout`s.
> Approved by the architecture owner via
> `docs/ios-native-migration/IOS_NATIVE_CAPABILITY_UNGATING_ROADMAP_V1.md` (§4.1, slice `HK-3`;
> open question 1 — "read-only first, write-back HK-3 later" — resolved by activating HK-3).
> The same PR amends the binding contract `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`
> (§2/§6.1/§6.2/§8.2/§16/§17/§18/§22/§27/§28) — read that first; it outranks this doc.

## 1. Scope (what HK-3 does, and does not)

**Does:** after the user taps **写回 Apple 健康** in the 我的 (Profile) tab, read IronPath's
own native **completed** sessions from canonical `AppData.history`, map each (NATIVE-ONLY) to a
pure `WorkoutExportRequest`, and write any session not already present in Apple Health as an
`HKWorkout` via `HKHealthStore.save`. Each exported workout is tagged with the IronPath session
id in metadata (`com.ironpath.sessionID`); a pre-export query skips ids already present, so
re-tapping is an idempotent no-op. Device-local. Honest status (exported / skipped-duplicate /
failed counts) — never a fake success.

**Does NOT:** write back any **other** Apple-Health type (body weight, heart rate, energy,
distance, standalone metrics — those stay read-only); export imported Apple-Health workouts
(structural no-loop-back — see §2); auto-export (only an explicit tap); write `AppData` or move
the source of truth; touch network/cloud/account; change the engine or goldens; bump the AppData
schema; add a new app file or edit `project.pbxproj` code. CloudKit/iCloud/Supabase/URLSession/
WebView/auth/UserDefaults/SQLite/CoreData/SwiftData remain fully forbidden. Remote/push stays
gated. Writing **other** HealthKit types and standalone metric sampling remain forbidden
(deferred — their own approved slice).

## 2. The hard red lines

**AppData stays the source of truth; Apple Health is a DERIVED export target.** Export READS
`AppData.history` and WRITES Apple Health. It never writes `AppData`, never bumps the schema, and
never makes Apple Health a second source of truth. The contract's source-of-truth boundary is
untouched (§8).

**Native-only / structural no-loop-back.** The pure `HealthKitWorkoutExporter.exportRequests`
accepts **only** `[TrainingSession]` (canonical native `history`). An `ImportedWorkoutSample`
(the DERIVED Apple-Health import bag from HK-2) can **never** be passed — a compile-time
guarantee — so an Apple-Health-imported workout is never written back to Apple Health. A
defensive filter additionally rejects any history entry tagged `source: "healthkit_import"`
(belt-and-suspenders; native `history` carries no such tag by construction). The exporter source
references `ImportedWorkoutSample` **nowhere** (guarded).

**Never automatic.** Export runs ONLY from the explicit button tap. No `.task` / `onAppear`
triggers it (guarded).

## 3. Idempotency (no app-side dedup storage)

Each exported `HKWorkout` carries metadata `com.ironpath.sessionID = <session.id>`. Before
exporting, the adapter runs an `HKSampleQuery` with
`HKQuery.predicateForObjects(withMetadataKey:)` and collects the session ids already present in
Apple Health; any request whose id is in that set is **skipped** (counted as a duplicate, not
re-written). The idempotency state therefore lives **in Apple Health**, not in app-side storage —
no extra file, no AppData field, no schema bump. Re-tapping export after a successful run reports
"已全部写回过 · 跳过 N 条重复".

## 4. Architecture (pure seam → pure mapper → adapter write)

CI / host `swift test` cannot run HealthKit, so the mapping logic is a **pure function** behind an
injectable seam; the real `HKWorkout` build + save compiles on device only.

| Layer | File | Notes |
| --- | --- | --- |
| HealthKit (pure) | `IronPathHealthKit/WorkoutExport.swift` | `WorkoutExportRequest` + `WorkoutExportSummary` values + the `WorkoutExportSink` WRITE seam (`requestExportAuthorization` + `export`). HealthKit-free. |
| HealthKit (pure) | `IronPathHealthKit/HealthKitWorkoutExporter.swift` | NATIVE-ONLY mapper: `[TrainingSession]` → `[WorkoutExportRequest]` (completed-only, valid start≤end window, activity = TraditionalStrengthTraining, session-id carried). Owns `metadataSessionIDKey = "com.ironpath.sessionID"`. No HealthKit, no `Date()` wall-clock (instants parsed from the sessions' own ISO strings), never references `ImportedWorkoutSample`. |
| HealthKit (device) | `IronPathHealthKit/HealthKitBodyMassSource.swift` | `HealthKitWorkoutSource` ALSO conforms to `WorkoutExportSink` (HK-3) in the **same single** `#if os(iOS)` file. `requestExportAuthorization` shares ONLY the workout type (`toShare: [workoutType]`); `export` queries existing session-id-tagged workouts, then builds `HKWorkout(...)` + `HKHealthStore.save` for the missing ones, returning an honest summary. The activity-name → `HKWorkoutActivityType` map is compile-checked. No `HKQuantitySample` construction — no other type is written. |
| App | `IronPath/ProfileRootView.swift` | Inlined `HealthKitWorkoutExportModel` (`@MainActor`; opts into the live `HealthKitWorkoutSource` + `JSONFileAppDataStore.applicationSupport()` on first tap; reads `AppData.history`; honest status) + `HealthKitWorkoutExportSection` (the 写回 Apple 健康 button + status). **No new app file → `project.pbxproj` untouched** (the N-2 / HK-2 precedent). Never imports HealthKit (uses the `WorkoutExportSink` seam); never reads `importedWorkoutSamples`. |

Package graph unchanged (`IronPathHealthKit → IronPathDomain`); no new package, no new
dependency edge.

## 5. Permissions & entitlements

- **`Info.plist`**: adds **`NSHealthUpdateUsageDescription`** (the share/write usage string) —
  HK-1/HK-2 only declared the read string (`NSHealthShareUsageDescription`). On a real device the
  first export tap triggers the system HealthKit **write** permission sheet for the workout type.
- **Entitlement** (`ios/IronPath/IronPath.entitlements`): `com.apple.developer.healthkit = true`
  — **reused from HK-1**. No new entitlement; no clinical-records; no background delivery.
- **`project.pbxproj`**: **untouched** for code (no new app file). The only project change is the
  added `NSHealthUpdateUsageDescription` Info.plist key (no new file, no new target).

HealthKit hides write-denial the same way it hides read-denial: a denied write surfaces as a
`failed`/empty honest summary, never a fabricated success.

> Note: `HKWorkout(activityType:start:end:duration:totalEnergyBurned:totalDistance:metadata:)` is
> deprecated on iOS 17+ but remains the documented "save a finished workout via
> `HKHealthStore.save`" path the task specifies; it compiles with a deprecation warning (the build
> does not treat warnings as errors). A migration to `HKWorkoutBuilder` is a later refinement.

## 6. Privacy & data safety

- **On-device only.** Sessions are read from the local canonical JSON store and written to the
  local Apple Health database. No network, no cloud, no telemetry (master §16). Nothing leaves the
  device.
- **Write is bounded.** `toShare: [workoutType]` — the app shares ONLY the workout type, and
  writes ONLY `HKWorkout`s. No body-mass / heart-rate / quantity-sample write. Guarded
  (`iosBootstrapForbiddenImports` + `iosHealthKitWorkoutExportStaticGuards`).
- **Read paths unchanged.** HK-1/HK-2/HK-2b body-mass + workout reads still use `toShare: []`.
- **Idempotent + honest.** Re-export is a no-op (queried from Health). A per-session save failure
  is counted and surfaced, never hidden; a thrown authorization error surfaces as `failed`.

## 7. Rollback

1. **Feature:** revert this PR. HK-1/HK-2/HK-2b (reads) are independent and unaffected; the
   HealthKit entitlement stays (HK-1 owns it). Removing the `NSHealthUpdateUsageDescription` key
   removes the write prompt.
2. **Data:** exported workouts live in Apple Health, tagged `com.ironpath.sessionID`; the user can
   delete them in the Health app. IronPath's canonical AppData is untouched by export, so there is
   nothing to roll back on the IronPath side.

## 8. Static guard updates (shipped in sync — master §22)

This slice **modifies** the read-only HealthKit guard (a guard weakening that MUST be justified and
offset — master §22). Net protection does **not** decrease: it shifts from "no Apple-Health write
at all" to "exactly one bounded, native-only, idempotent, user-triggered **workout** export,
confined to the single adapter file".

- `tests/iosBootstrapForbiddenImports.test.ts`: the read-only boundary block becomes a
  **write-bounded** block. It still asserts (a) the single adapter is the **sole holder** of every
  HealthKit token, and (b) read authorization still shares nothing (`toShare: []`). The relaxed
  `.save(` / `HKWorkout(` negatives are **replaced by stronger positives**: export shares ONLY the
  workout type (`toShare: [workoutType]`), NEVER shares body mass, and still constructs **no**
  `HKQuantitySample` and **no** `HKWorkoutBuilder`.
- `tests/iosHealthKitWorkoutImportStaticGuards.test.ts`: the HK-2 / HK-2b adapter tests' legacy
  "no `.save` / no `HKWorkout(`" negatives are relaxed (export now legitimately adds them to the
  same file); the `HKQuantitySample` negative is **kept** (no other type is written). Both point to
  the new export guard.
- `tests/iosHealthKitWorkoutExportStaticGuards.test.ts` (**new**): positively locks the HK-3
  surface — the pure seam + exporter are HealthKit-free; the exporter is native-only
  (`forNativeHistory: [TrainingSession]`), idempotency-anchored (`com.ironpath.sessionID`), and
  never references `ImportedWorkoutSample`; the single adapter shares only the workout type, writes
  only `HKWorkout`s via `save`, queries by the metadata key, and constructs no `HKQuantitySample`;
  the app layer is user-triggered (an explicit button), never auto-exports, reads native
  `history`, is honest, and never imports HealthKit; and this doc exists.
- Unchanged & still green: `iosBootstrapPackageGraph` (`IronPathHealthKit → IronPathDomain`, no new
  edge), `iosBootstrapTargetSettings` / `ProjectStructure` (no new package, no new target, no new
  app file).

## 9. Validation (slow lane)

- `swift test`: `IronPathHealthKit` (incl. `HealthKitWorkoutExportTests`: native-only mapping +
  completed/window/duration rules + the no-loop-back / healthkit_import-tagged exclusion + the
  idempotency anchor), `IronPathDomain`.
- `npm run api:dev:build && npm run typecheck && npm test && npm run build` (incl. the updated +
  new HealthKit static guards); `git diff --check`; `package.json` / `package-lock.json`
  byte-unchanged.
- `xcodebuild` `generic/platform=iOS` **and** `platform=iOS Simulator,name=iPhone 17 Pro`
  (`CODE_SIGNING_ALLOWED=NO` if local signing is unavailable).

(Exact counts / SHAs are recorded in the PR description from real command output.)

## 10. Real-device smoke checklist (manual, post-merge)

1. Build & run on a device signed into iCloud with ≥1 completed IronPath session in `history`.
2. 我的 → **写回 Apple 健康** → grant **workout write** access in the system sheet.
3. Open Apple Health → Workouts → confirm the IronPath sessions appear as workouts (strength
   training, with the right start/duration).
4. Re-tap **写回 Apple 健康** → status reads "已全部写回过 · 跳过 N 条重复" and Apple Health does
   **not** duplicate them (session-id metadata idempotency).
5. Deny write access (or revoke it in Settings → Health) and tap export → an honest failure /
   "当前环境不写回健康数据" / "本机暂无可写回的已完成训练" — never a fake success.
6. Confirm imported Apple-Health workouts (HK-2) are **not** written back (native-only).
7. Confirm no network traffic and that IronPath's own history / today readiness are unchanged
   (export reads, never writes, AppData).

## 11. Follow-ons

- `HKWorkoutBuilder` migration (drop the deprecated `HKWorkout` initializer).
- Richer exported fields (energy / distance / per-set samples) once a native canonical read path
  carries them — still export-only, still native, still device-local.
- Other HealthKit write types / standalone metric sampling remain **forbidden** without their own
  approved, contract-amending slice.
