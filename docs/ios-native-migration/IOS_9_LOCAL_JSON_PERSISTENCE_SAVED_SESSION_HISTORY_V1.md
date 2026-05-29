# iOS-9 Local JSON Persistence + Saved Session History V1

> Status: implementation bundle (single PR). Local-only. No Cloud, no
> HealthKit, no Supabase, no network, no auth, no production sync.

## 1. Goal

Upgrade the iOS native Focus MVP from an **in-memory** completed-session
preview (iOS-8) to **safe, app-local JSON persistence** plus a small
**saved-session history** surface. After this task:

- Completing a session writes a JSON snapshot under the app sandbox.
- The latest saved session is loaded and shown on launch.
- A short "recent saved sessions" list is shown on the plan screen.
- The user can clear local saved sessions.
- A save failure shows an honest error and never a fake success.

Everything stays on-device. No cloud, no HealthKit, no Supabase, no network,
no auth, no multi-device sync.

## 2. Why iOS-9 follows iOS-8

iOS-8 (#412) delivered the native local training MVP: live deload exposure on
`TrainingDecisionCoreSlice`, an in-session set tracker, a completion action,
and an **in-RAM** saved-session preview (`FocusCompletedSessionSummary`). iOS-8
explicitly deferred on-disk persistence: the preview was cleared on app
restart by design, and the iOS-8 doc + static guards locked "no disk egress
anywhere under `ios/IronPath/`".

iOS-9 is exactly that deferred follow-up: it introduces the **first** sanctioned
disk write in the app target — a small, local-only JSON snapshot store — so the
completed-session preview survives relaunch and grows into a short history,
without touching any cloud/health/auth surface and without disturbing the
canonical `AppData` domain store.

## 3. Larger-step strategy

This is a single, bounded implementation bundle (not a planning-only PR). It
ships Features A–F together: the Codable snapshot model, the app-local JSON
store (atomic write + backup-before-overwrite + scoped clear), the UI wiring
(save on completion, load on launch, history list, clear, honest failure),
static guards, this doc, and full validation.

Discovery confirmed the safest V1 home for the store is the **app target**
(`ios/IronPath/`), not a Swift package: it keeps the package graph byte-frozen,
avoids coupling a presentation-layer record to the `AppData`-bound
`IronPathPersistence` package, and needs no `Package.swift` change.

## 4. Persistence model (decision)

- **App-target store, not IronPathPersistence.** The existing
  `JSONFileAppDataStore` is bound to the canonical `AppData` domain model and
  `AppData.canonicalJSONData()`. Reusing it would force mapping the Focus
  snapshot into `AppData` (a broad AppData schema concern — forbidden here) or
  adding a new store type to that package (a package-graph change — avoided).
- **Small presentation record, not domain data.** The snapshot carries only the
  engine-derived context the local preview already renders, plus a `source`
  marker (`local-ios-focus-mvp`). It is never a raw export and never the
  canonical `AppData`.
- **Deterministic.** No `UUID()`/random ids: the `snapshotId` is
  `focus-<scenarioId>-<index>`, and history ordering uses a monotone file
  sequence — so previews/tests stay reproducible.

## 5. Snapshot schema

`LocalCompletedSessionSnapshot` (Codable):

| field | type | notes |
| --- | --- | --- |
| `schemaVersion` | Int | `1`; lets a future loader reject/migrate old files |
| `snapshotId` | String | deterministic `focus-<scenarioId>-<index>` |
| `createdAtIso` | String | ISO-8601 from the injectable clock |
| `scenarioId` | String | scenario `rawValue` (`normal` / `productiveFloor` / `severeRest` / `deloadWeek`) |
| `scenarioLabel` | String | short CJK label for display |
| `sessionIntent` | String | engine `slice.sessionIntent` |
| `activePhase` | String | engine `slice.activePhase` |
| `deloadLevel` | String | engine `slice.deload.level` |
| `deloadStrategy` | String | engine `slice.deload.strategy` |
| `totalCompletedSets` | Int | aggregate |
| `totalTargetSets` | Int | aggregate |
| `exercises` | `[LocalCompletedExerciseSnapshot]` | per-exercise lines |
| `source` | String | always `local-ios-focus-mvp` |

`LocalCompletedExerciseSnapshot` (Codable): `exerciseId`, `name`, `role`,
`progress: LocalCompletedSetProgressSnapshot`.

`LocalCompletedSetProgressSnapshot` (Codable): `completedSets`, `targetSets`.

## 6. Storage location

```
<App sandbox>/Library/Application Support/IronPathLocalSnapshots/
  focus-session-0001-normal.json       ← append-only history entry
  focus-session-0002-deloadWeek.json
  focus-session-latest.json            ← rolling "latest" pointer (overwritten)
  focus-session-latest.json.bak        ← backup taken BEFORE each overwrite
```

Resolved via `FileManager.default.url(for: .applicationSupportDirectory, …,
create: true)` + the fixed `IronPathLocalSnapshots` subdirectory. **Not** the
documents dir, **not** iCloud, **not** a shared/ubiquity container, **not**
`UserDefaults`, **not** SQLite/CoreData/SwiftData.

## 7. Backup-before-overwrite behavior

- **History entries are append-only.** Each save computes a fresh sequence
  number (`max existing + 1`) so a completed session never overwrites a prior
  one — the history simply grows.
- **The rolling latest pointer is the overwrite target.** Before
  `focus-session-latest.json` is overwritten, the store copies the existing
  pointer to `focus-session-latest.json.bak`. A bad new write therefore cannot
  destroy the last good "latest". This is live behavior on the hot path (every
  save after the first), not dead code.
- **Atomic writes.** `Data.write(.atomic)` renames a temp sibling into place,
  so a mid-write crash leaves the previous file intact.

## 8. Load latest / list snapshots

- `loadLatest()` reads the latest pointer; if it is missing it falls back to the
  highest-sequence history entry; returns `nil` when nothing is saved.
- `listSnapshots()` enumerates `focus-session-<seq>-…json` history files, decodes
  each, skips any single corrupt file (so one bad file can't hide the rest), and
  returns newest-first.
- On launch, `FocusModeShellView.task` calls `state.loadSavedSessions()`, which
  populates `latestSaved` + `savedHistory`. The plan screen shows the latest
  card + a capped recent list.

## 9. Clear saved sessions safety

`clear()` enumerates only the **direct** children of the sanctioned directory
and removes only **regular files** whose names start with the store's own
`focus-session-` prefix (history + latest pointer + its `.bak`). It never
deletes the directory, never recurses, never wildcards a broad path, never
touches anything outside the sanctioned directory, and never mutates `AppData`.
The UI clear action is behind a confirmation dialog.

## 10. Failure handling / no fake success

- Every mutating store call **throws** a `LocalSnapshotStoreError` on failure.
- `FocusModeMvpState.completeSession` sets `saveStatus = .saved` **only** inside
  the `do { try snapshotStore.save(…) }` success path. The `catch` sets
  `saveStatus = .failed(message)` and `saveErrorMessage`.
- On failure the in-RAM `completedSummary` is kept, so the completion preview is
  still usable; the completed screen shows a red "本地保存失败：… · 本次预览仍可用"
  banner instead of a success message.
- Launch/refresh read errors are non-fatal: the surface shows "nothing saved
  yet" plus a soft error note.

## 11. UI changes

- **Plan screen**: new `FocusSavedSessionHistoryView` below the actions — a
  local-only disclaimer (`仅保存在本机 · 不同步云端 · 可清除`), the latest saved
  card, a capped recent list (date/time · scenario · sessionIntent ·
  completed/target sets), and a "清除本机已保存训练" button (confirmation dialog).
- **Completed screen**: a save-status banner above the existing in-RAM preview —
  green "已保存到本机 · 可在计划页查看历史" on success, red failure banner otherwise.
- **Launch**: `state.loadSavedSessions()` loads the latest + history.

## 12. Safety boundaries

- The store is the **only** disk-touching file in the app target.
  `FocusModeMvpState` delegates all IO to it and never references `FileManager`.
- IO is confined to one Application Support subdirectory; filenames are
  sanitized; clear is prefix-scoped.
- No Cloud / CloudKit / iCloud, no `IronPathCloudSync`, no HealthKit, no
  Supabase, no `URLSession`/network, no WebKit, no `UserDefaults`, no
  SQLite/CoreData/SwiftData, no `AppData` read/write, no auth.

## 13. Non-goals

- No cloud / multi-device sync, no cloud restore.
- No HealthKit, no Supabase, no network, no WebView, no auth/account.
- No full history app, no charts, no calendar.
- No broad `AppData` persistence or schema migration; no destructive AppData
  mutation.
- No TypeScript runtime changes, no parity/golden changes, no
  package.json/package-lock changes.
- **iOS-4B6** (userFacing / full `arbitrationTrace` builders) remains
  **deferred** and is intentionally out of scope here; it can proceed in
  parallel and does not block iOS-9.

## 14. Tests / guards

- `tests/iosLocalJsonPersistenceStaticGuards.test.ts` — 28 assertions covering
  the model, store behaviors, app-local path, atomic write,
  backup-before-overwrite, load/list/clear, scoped delete, completion-save
  wiring, the local-only disclaimer, the history surface, no-fake-success, the
  full forbidden-import/backend bans, parity-golden invariance, and
  package/lockfile invariance, plus iOS-4B6-deferred in this doc.
- `tests/iosNativeLocalTrainingMvpMegaMigrationStaticGuards.test.ts` (iOS-8) —
  its whole-app-tree "no disk egress" ban now **excludes the one sanctioned
  store file** (`LocalSessionSnapshotStore.swift`); the no-disk boundary stays
  enforced for every other (presentation) file. The store's disk egress is
  locked by the iOS-9 guards instead.
- **App-target XCTest is deferred.** Adding an app unit-test target would mean
  risky `project.pbxproj` surgery. Per the iOS-9 task's Feature F guidance, the
  store is locked by static guards + `xcodebuild` + the documented manual
  Simulator smoke below. Pure-Swift package unit tests are not added because the
  store lives in the app target (a package home was rejected — see §4).

## 15. Validation

Run from the repo root:

```
node scripts/generate-parity-goldens.mjs --check       # 14 fixtures / 0 changed
node scripts/generate-parity-goldens.mjs --list
node scripts/test-tiers.mjs test:parity
node scripts/test-tiers.mjs test:ios
node scripts/test-tiers.mjs validate:ios
npm run api:dev:build
npm run typecheck
npm test
npm run build
node scripts/scan-production-dist-safety.mjs
git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml   # empty
test ! -e pnpm-lock.yaml
git diff --check

swift test --package-path ios/packages/IronPathDomain
swift test --package-path ios/packages/IronPathDataHealth
swift test --package-path ios/packages/IronPathPersistence
swift test --package-path ios/packages/IronPathTrainingDecision
swift test --package-path ios/packages/IronPathCloudSync
swift test --package-path ios/packages/IronPathHealthKit
swift test --package-path ios/packages/IronPathBackup
swift test --package-path ios/packages/IronPathL10n
swift test --package-path ios/packages/IronPathUIKit

xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS Simulator' build
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

## 16. Manual Simulator smoke checklist

1. App launches without crash.
2. Complete a session → the completed screen shows the in-RAM preview **and** a
   green "已保存到本机" banner.
3. Return to the plan screen → the saved-session history section shows the
   latest card.
4. Quit and relaunch the app → the latest saved preview still appears (loaded
   from disk on launch).
5. The saved-session recent list appears once ≥2 sessions are saved.
6. Complete another session → the latest preview updates and the list grows /
   updates.
7. Tap "清除本机已保存训练" → confirm → the history section returns to its empty
   state.
8. No cloud / network / account prompts appear at any point.
9. No crash throughout.

## 17. Remaining risks

- **Synchronous IO on the main actor.** Snapshots are tiny, so the synchronous
  read/write on the `@MainActor` state is acceptable for V1; a future task can
  move it off-main if files grow.
- **Deterministic clock.** The demo keeps the iOS-8 deterministic clock, so all
  snapshots show the same reference timestamp; history rows are distinguished by
  scenario + set counts + sequence. Injecting a real-time clock is a follow-up.
- **No schema migration yet.** `schemaVersion` is recorded but a bump-time
  migration path is not implemented; an unreadable/old file is skipped, not
  migrated.
- **No app-target unit tests.** Store internals are covered by static guards +
  `xcodebuild` + manual smoke, not XCTest (deferred — see §14).
- **`snapshotId` is display-only and can drift from the file sequence.** The
  on-disk filename sequence (`max + 1`, store-assigned) is the source of truth
  for uniqueness and ordering and is always unique; the `snapshotId`
  (`focus-<scenarioId>-<index>` from the in-memory history count) is a display
  identifier and could collide/skew if an in-memory refresh is stale. This never
  causes data loss or breaks reproducibility; aligning the id with the
  store-assigned sequence is a low-priority follow-up.

## 18. Next task recommendation

**iOS-10 Local Snapshot DataHealth Ingress + Schema-Versioned Restore V1** —
read saved snapshots back through a `DataHealth` validation/ingress pass on
launch (schema-version check, defensive decode, quarantine of corrupt files),
and add the first pure-Swift package-level tests for snapshot round-trip. This
keeps persistence local-only while hardening restore. iOS-4B6
(userFacing/full `arbitrationTrace`) remains deferred and can proceed in
parallel.
