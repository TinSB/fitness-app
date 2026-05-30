# iOS-17A — Native Per-Set Logging Mega V1 (17c + 17d)

- **Status:** Implemented
- **Baseline:** `3b75722` — iOS-17C Plan + Today Read-only Surface V1 (#424)
- **Binding contract:** `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (v1.1; this PR amends §2/§8/§9/§12/§27)
- **Supersedes the "Next" proposal in §27:** combines the planned **17c** (canonical write path) and **17d** (history/detail summary) into one validated vertical slice.

## 1. Goal

Turn the iOS-17b **in-RAM** per-set capture (weight/reps/RIR, kg-stored) into a **durable** record:

1. **Capture** — performed sets are entered in the existing `FocusSetChecklistView` (shipped in 17b) and held in `FocusModeMvpState.capturedSetDraftsByExerciseId` as typed `ActualSetDraft`s.
2. **Persist (the boundary)** — on completion the performed sets are appended to the **canonical** `AppData.history` (the source of truth, §8) through the **first native canonical-AppData write path**.
3. **Present** — the saved-session detail sheet renders a per-exercise **"上次成绩"** summary backed by a derived LocalSnapshot **v3** `setLogs` display copy.

This is the first PR in the migration that **writes** canonical AppData on device, so §8 is amended in the same change (the amend-in-same-PR rule, §1.1).

## 2. Where performed sets live — and why

| Field | Role | iOS-17A use |
| --- | --- | --- |
| `TrainingSession.focusActualSetDrafts` | in-progress editing buffer | **NOT used for the durable record.** The DataHealth session-lifecycle guard treats a non-empty draft buffer on a `completed` session as **residue** and clears it; `SessionLifecycleResidueRepair` would strip it from disk on the next boot. Storing performed sets here = silent data loss on reload. |
| `ExercisePrescription.sets: [TrainingSetLog]` | the recorded session's per-set log | **The permanent home.** The lifecycle guard and `SetIndexRenumberRepair` (completed sessions are "historical and left untouched") never mutate it. Stable through the clean view + auto-repair. |

`NativeCompletedSessionTests.testCompletedSessionShapeAndLifecycleSafety` pins that the canonical completed session sets **no** lifecycle/draft fields, and the DataHealth gate (below) refuses any write whose sets don't survive the clean view.

## 3. Components (by package — logic stays in packages, app layer thin)

### `IronPathDomain` (pure, no IO) — `NativeCompletedSession.swift`
- `NativePerformedExercise` — identity + the captured drafts to promote.
- `NativeCompletedSessionBuilder.setLog/exercise/completedSession` — promote `ActualSetDraft` → `TrainingSetLog` (kg verbatim in `weight`, `done=true`, blank fields stay nil) → `ExercisePrescription.sets` → a `completed`/`focusSessionComplete` `TrainingSession`. Exercises with no performed sets are omitted.
- `AppData.appendingHistorySession(_:)` — open-bag-preserving append (rewrites only `history`, no `schemaVersion` change, value-semantics non-mutating).
- `AppData.emptyCurrent()` — minimal current-schema base for the first-ever write.
- Tests: `NativeCompletedSessionTests` (promotion, aggregation, lifecycle-safety, open-bag + existing-history preservation, canonical round-trip).

### `IronPathPersistence` — `CanonicalSessionWriter.swift`
- `CanonicalSessionWriter.appendCompletedSession(_:baseIfMissing:validate:)` — the write seam:
  load existing (missing → seed base; **unreadable → refuse**) → append candidate → **injected DataHealth gate** (reject → no write) → **backup-before-overwrite** (only when a prior file exists) → **atomic save** → honest typed errors (`CanonicalSessionWriteError`). Returns `PerformedSessionWriteResult` (createdNew? backupURL?).
- `JSONFileAppDataStore.applicationSupport()` — the sanctioned canonical store under `Application Support/IronPathAppData/` (distinct dir from the Focus-history store).
- The gate is a **closure injected by the app**, so the package keeps its single edge `Persistence → Domain` (it does not import DataHealth).
- Tests: `CanonicalSessionWriterTests` (first-write-no-backup, second-write-backs-up-first, unreadable-never-overwritten, gate-rejection-writes-nothing, gate-sees-candidate, backup/save failure honesty, end-to-end round trip through the real store).

### `IronPathLocalSnapshot` — v3 derived display copy
- `LocalCompletedSetEntrySnapshot` (`setIndex` + kg `weightKg?`/`reps?`/`rir?`) + `LocalCompletedExerciseSnapshot.setLogs: [...]?`.
- `currentSchemaVersion = 3`; `acceptedSchemaVersions = {1,2,3}`; v1/v2 migrate forward with `setLogs == nil`. Validation rejects negative per-set metrics/index.
- **Derived display only** — written alongside the canonical write, never read back as a source of truth (§12 rule 5).
- Tests: `LocalSetLogsV3Tests` + amended `IronPathLocalSnapshotTests` (the "future/unsupported" version literal moved from 3 → 4).

### App layer (thin — no new files, `project.pbxproj` untouched)
- `FocusModeMvpState`: injects an optional `AppDataStore` (opted in by the shell via `useApplicationSupportAppDataStore()`, mirroring `useSystemClock()`); `completeSession` performs the canonical write (via the writer + a DataHealth gate closure that calls `processIncomingAppData` read-only and accepts only when the appended session survives the clean view with all sets intact) and derives the v3 `setLogs`; new honest `canonicalSaveStatus` (`saved`/`skipped`/`failed`).
- `FocusModeShellView`: opts the running app into canonical persistence in `.task`; shows a `canonicalSaveBanner`.
- `FocusSavedSessionDetailView`: renders the per-set "上次成绩" lines (kg → display-unit conversion via `WeightConversion`); legacy/no-detail sessions honestly show "无逐组明细".

## 4. Boundary & data-safety statement

- **Source-of-truth impact:** activates (does **not** move) the canonical write boundary already named in §8. Canonical AppData still lives in `JSONFileAppDataStore`.
- **Not a restore (§14):** append-only of newly-created local data; never replaces/merges an external document. The full-AppData restore gate is untouched.
- **Data safety:** kg end-to-end; open-bag preserved; no `schemaVersion` bump on AppData; backup-before-overwrite + atomic + no-fake-success; LocalSnapshot v3 is a guarded migration and a derived copy only.
- **Forbidden systems untouched:** no CloudKit/iCloud/Supabase/HealthKit/URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData; no stub package touched; package import graph unchanged; `package.json`/lockfile unchanged; `project.pbxproj` unchanged.

## 5. Validation

- Swift packages: `IronPathDomain`, `IronPathPersistence`, `IronPathLocalSnapshot` `swift test` green; other packages sanity-tested.
- `xcodebuild` green on both `generic/platform=iOS` and `platform=iOS Simulator,name=iPhone 17 Pro` (local signing disabled with `CODE_SIGNING_ALLOWED=NO`).
- TypeScript gate (`npm run api:dev:build && typecheck && test && build`) green — no TS/engine output changed, so no parity-golden regeneration; `git diff --check` clean; deps byte-unchanged.
