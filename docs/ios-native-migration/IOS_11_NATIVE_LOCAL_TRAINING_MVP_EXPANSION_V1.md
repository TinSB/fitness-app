# iOS-11 Native Local Training MVP Expansion V1

> Status: feature bundle (single PR). Local-only. No Cloud, HealthKit, Supabase,
> network, WebView, auth, or production sync.

## 1. Goal

Advance the native iOS app from a "local saved-history MVP" toward a more usable
local-first training product by adding **schema evolution + migration**,
**restore-to-local-draft**, and **continue a saved session**, plus the
supporting detail/history/diagnostics UX and honest failure handling.

## 2. Execution strategy

A coherent local-snapshot-evolution bundle built across internal checkpoints,
each gated by a Swift/xcodebuild compile + guard regression:

- **CP1** schema v2 (`resumeExerciseIndex`) + pure forward migration + validator
  (`acceptedSchemaVersions = [1, 2]`, `invalidResumeIndex` rule).
- **CP2** store applies migration on decode; scan reports migrated + per-version
  counts; diagnostics expose them.
- **CP3** restore-to-local-draft + continue (in-RAM; scenario regenerated
  deterministically); honest failure on unknown scenario.
- **CP4** detail "继续这次训练" + history wiring + in-session restored banner +
  version/migration diagnostics in the UI.
- **CP5** guards + doc + full validation + PR + (authorized) auto-merge.

## 3. Features completed

- **Schema v2 + migration**: `LocalCompletedSessionSnapshot.currentSchemaVersion = 2`
  adds optional `resumeExerciseIndex`. `LocalSnapshotMigration.migrate(_:)` is a
  pure, forward-only, non-destructive upgrade (v1 → current, filling defaults);
  it reports `didMigrate` / `originalSchemaVersion` and refuses to downgrade a
  future-version file (`isUnsupportedFutureVersion`).
- **Compatibility**: the store decodes every file through migration, so the rest
  of the app always works against the current schema. v1 files (no
  `resumeExerciseIndex`) decode + migrate cleanly.
- **Restore-to-local-draft + continue**: `FocusModeMvpState.restoreDraft(from:)`
  rebuilds an IN-RAM training draft from a saved snapshot — sets the scenario
  (which regenerates the engine slice deterministically), restores per-exercise
  completed-set counts and the resume cursor, and resumes the in-session flow.
- **Detail / history / diagnostics UX**: detail sheet gains a "继续这次训练
  （本机草稿）" action and shows the schema version; the history diagnostics row
  shows `schema v1 / v2 / 已迁移` counts; the in-session screen shows a
  "已恢复本机草稿" banner.
- **Honest failure**: an unknown scenario id fails restore with a clear message
  and starts NO draft (no fake restore); migrated/invalid files are surfaced.

## 4. Features intentionally deferred

- **Full AppData restore**: still gated behind the DataHealth / `buildCleanAppDataView`
  clean-input contract. iOS-11 restore is a small in-RAM DRAFT rebuild, NOT an
  AppData restore, and never feeds TrainingDecision raw bytes.
- **Pure-Swift package test target** for the snapshot/validation/migration
  utilities — requires a new package or an app test target (package-graph /
  pbxproj risk). Deferred to iOS-12; the pure functions are written IO-free so
  the extraction stays trivial. iOS-11 uses stronger static guards + xcodebuild
  + manual smoke instead (the task allows "Swift tests OR stronger static guards").
- **iOS-4B6** (userFacing / full `arbitrationTrace`) remains deferred / parallel.

## 5. Safety boundaries preserved

- Pure logic (model / validation / migration / stats) lives in IO-free files; all
  disk IO stays inside the one sanctioned store file.
- Restore rebuilds an in-RAM draft only — no AppData read/write, no AppData
  schema migration, no raw AppData → TrainingDecision.
- No Cloud / CloudKit / iCloud, no `IronPathCloudSync`, no HealthKit, no Supabase,
  no `URLSession` / network, no WebKit, no `UserDefaults`, no SQLite/CoreData/
  SwiftData, no auth. Schema v2 is an additive optional field (backward compatible).

## 6. DataHealth / CleanAppDataView boundary

A future full AppData restore MUST pass through the DataHealth ingress /
`buildCleanAppDataView` clean-input contract (the same gate the live engine uses)
before any restored data reaches TrainingDecision. iOS-11 deliberately does not
cross that boundary: restoring a snapshot only rebuilds the local in-RAM draft
from the deterministic scenario + saved set counts.

## 7. Tests / guards

`tests/iosLocalTrainingMvpExpansionStaticGuards.test.ts` — 23 assertions covering
schema v2, the pure forward migration (forward-only, non-destructive,
future-version-safe), store decode-applies-migration + version diagnostics, the
validator resume-index rule, restore-to-draft (scenario + sets + cursor →
in-session), no-fake-restore on failure, the continue UI + restored banner +
diagnostics, the full forbidden-API bans, the not-AppData-restore boundary,
parity-golden invariance, package/lockfile invariance, and iOS-4B6 deferred. The
iOS-8/9/10 guards remain green (iOS-10 guard #2 updated `[1]` → `[1, 2]` for the
new accepted set).

## 8. Validation

`parity --check` (14/0) + `--list`; `test:parity` / `test:ios` / `validate:ios`;
`api:dev:build`; `typecheck`; `npm test`; `build`; `scan-production-dist-safety`;
`package.json`/`package-lock.json` byte-identical (no pnpm/yarn lock);
`git diff --check`; `swift test` × 9 packages; `xcodebuild` generic +
iPhone 17 Pro.

## 9. Manual Simulator smoke checklist

1. App launches without crash.
2. Previously saved sessions load on launch (v1 files migrate forward silently).
3. Saved history list + diagnostics (incl. `schema v1 / v2 / 已迁移`) appear.
4. Tap a saved session → detail sheet opens; tap "继续这次训练（本机草稿）".
5. The session resumes in-session with restored set progress + a "已恢复本机草稿"
   banner; the resume cursor lands on the first incomplete exercise.
6. Add more sets / complete again → it saves a fresh v2 snapshot.
7. A snapshot whose scenario is unknown shows an honest "恢复失败" message and
   starts NO draft.
8. Clear / quarantine / export still work.
9. No cloud / network / account prompts; no crash.

## 10. Remaining risks

- Synchronous main-actor IO (snapshots are tiny; acceptable for V1).
- Deterministic clock → identical display timestamps in the demo.
- `snapshotId` is display-only and can drift from the file sequence (filenames
  stay unique; no data loss).
- No app-target unit tests yet (static guards + xcodebuild + manual smoke cover
  it); recommended as iOS-12.
- Restore maps set counts by exercise id; if a scenario's exercise set ever
  changes ids, unmatched counts are simply ignored (no crash, no bad data).

## 11. Next recommended task

**iOS-12 Local Snapshot Test Target + Restore Fidelity V1** — extract the pure
snapshot model / validation / migration / stats into a local Swift package (or a
sanctioned app test target) with real XCTest round-trip + migration unit tests,
and harden restore fidelity (per-exercise id reconciliation, resume-cursor edge
cases). Full AppData restore stays deferred behind the DataHealth /
`buildCleanAppDataView` gate. iOS-4B6 remains deferred / parallel.
