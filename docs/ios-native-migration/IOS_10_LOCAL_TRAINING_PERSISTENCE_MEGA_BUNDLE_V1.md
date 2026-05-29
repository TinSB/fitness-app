# iOS-10 Local Training Persistence Mega Bundle V1

> Status: multi-iteration hardening bundle (single PR). Local-only. No Cloud,
> HealthKit, Supabase, network, WebView, auth, or production sync.

## 1. Goal

Harden the iOS-9 "basic saved sessions" into a broader, robust **local** training
MVP: schema-versioned validation, defensive decode + corrupt-file
skip/quarantine, a validated restore/load path with no fake success, a saved-
session detail screen, newest-first sort + simple filters, a derived local stats
summary, backup-before-overwrite visibility, a local-only debug-copy export, a
storage diagnostics surface, and an explicit DataHealth/AppData restore
boundary. Everything stays on-device.

## 2. Why a larger iOS-10 bundle is allowed

iOS-9 landed the minimum (save / load latest / list / clear). The user
explicitly asked to "move faster and do more in one task" as a multi-iteration
bundle with internal checkpoints. The work is cohesive (it all hardens the same
local snapshot store + its UI) and additive (no engine change, no AppData
change), so it is safe to ship as one PR with per-iteration build/test/guard
checkpoints.

## 3. Larger-step strategy

Twelve internal iterations, each gated by a checkpoint (Swift/xcodebuild compile
+ relevant guards + git-diff/boundary review) before continuing. Pure value
logic (validation, stats) lives in NEW pure files; ALL disk IO stays in the one
sanctioned store file (`LocalSessionSnapshotStore.swift`) so the iOS-8 whole-
tree "no disk egress" boundary keeps holding for every other app file. No
package-graph change, no AppData touch.

## 4. Iterations completed

1. Schema-versioned snapshot validation (pure `LocalSnapshotValidator`).
2. Defensive decode + corrupt-file handling (`scanSnapshots`, per-file `try?`).
3. Corrupt/invalid-file quarantine (in-place rename under a quarantine prefix).
4. Saved history UX hardening (invalid warning, restore status, local note).
5. Local saved-session detail sheet (`FocusSavedSessionDetailView`).
6. Newest-first sort + scenario / completed-only filters.
7. Local stats summary (`LocalSnapshotStats`).
8. Backup-before-overwrite hardening + visibility.
9. Local-only debug-copy export.
10. DataHealth / AppData restore boundary (guard + doc; restore is not AppData).
11. Local storage diagnostics surface.
12. Polish / regression / docs / full validation / auto-merge cleanup.

## 5. Schema validation

`LocalSnapshotValidator.validate(_:)` (pure, IO-free, non-mutating) returns a
typed `LocalSnapshotValidationResult` listing every `LocalSnapshotValidationIssue`:
`unsupportedSchemaVersion`, `emptySnapshotId`, `emptyCreatedAtIso`,
`negativeSetCount`, `completedExceedsTarget`, `totalsMismatch`, `emptyExercises`.
`acceptedSchemaVersions = [1]`. An unsupported version, missing id/timestamp,
negative counts, completed > target (aggregate or per-exercise), totals that
disagree with the per-exercise sums, or empty exercises all reject the snapshot.
Validation NEVER mutates a file into "valid" — an invalid file stays invalid.

## 6. Defensive decode

`scanSnapshots()` enumerates history files and decodes each with a per-file
`try?`, so corrupt JSON is COUNTED (in `invalidNames`), never fatal. Valid +
schema-validated snapshots populate the list (newest first); everything else is
skipped. The latest valid snapshot still loads when a corrupt file is present.
A genuine directory-resolution failure throws an honest error.

## 7. Corrupt-file skip/quarantine behavior

`quarantineInvalid()` renames each corrupt/invalid history file IN PLACE inside
the sanctioned directory, from `focus-session-<seq>-…json` to
`focus-session-quarantine-<seq>-…json`. No recursion, no directory move/wipe, no
iCloud. Quarantined files keep the store prefix (so `clear()` still removes them)
but no longer match the history `<digits>-` pattern (so they never appear as
normal history rows). A rename failure throws (no fake success).

## 8. Restore/load result model

On launch/refresh the state runs `scanSnapshots()` (valid list + invalid count),
loads the rolling latest pointer via `loadLatest()`, then shows it ONLY if it
passes validation (`validatedLatest`); otherwise it falls back to the newest
valid history entry. An invalid latest is never presented as a successful
restore.

## 9. Saved history UX

The plan-screen history surface shows: the local-only disclaimer
(`仅保存在本机 · 不同步云端 · 可清除`), a restore-status line, the latest card
(tap to open detail), a local stats row, sort/filter controls, the recent list,
a local export control, a storage-diagnostics row, and a confirmation-gated
clear. A non-scary local warning appears when invalid files were skipped, with a
"隔离无效存档（仅本机）" action. Save/load failures show honest messages; the
training UI stays usable.

## 10. Saved session detail

`FocusSavedSessionDetailView` (local-only sheet): date/time, scenario,
sessionIntent, activePhase, deload level/strategy, completed/target sets, the
per-exercise rows, the source note, and a small developer line with the schema
version + snapshot id. No charts, no calendar, no cloud restore.

## 11. Local stats summary

`LocalSnapshotStats.derive(from:)` (pure) computes total sessions, total
completed sets, total target sets, completion ratio, most-recent scenario, and
last-saved time from the valid snapshots only. No analytics engine, no charts,
no TypeScript.

## 12. Backup-before-overwrite

Unchanged from iOS-9 and re-locked here: the rolling latest pointer is copied to
`focus-session-latest.json.bak` BEFORE it is overwritten (live on every save
after the first); history entries are append-only. `hasLatestBackup()` /
diagnostics make the backup's presence visible. The backup file is never a
normal history row. A backup failure throws.

## 13. Export/backup decision

Implemented as a LOCAL-ONLY debug copy: `exportLatestDebugCopy()` copies the
latest pointer to `focus-session-export-latest.json` inside the sanctioned
directory and the UI shows "已生成本机 JSON 副本". NO share sheet, NO Files
picker, NO iCloud, NO network, NO external document provider. The export file
keeps the store prefix (so `clear()` removes it) and is not a history row.

## 14. DataHealth / CleanAppDataView boundary

A `LocalCompletedSessionSnapshot` is a small presentation record. Restoring it
only re-renders the saved preview. A FUTURE full AppData restore is **deferred**
and, when it lands, MUST pass through the DataHealth ingress /
`buildCleanAppDataView` clean-input contract first — the same gate the live
engine uses — rather than restoring raw bytes. A static guard forbids any raw
AppData construction or TrainingDecision engine-input build inside the restore
files.

## 15. What is not full AppData restore yet

This bundle restores only the local saved-session PREVIEW. It does NOT restore
the canonical IronPathDomain `AppData`, does NOT migrate AppData schema, and does
NOT feed restored data into TrainingDecision. Full AppData restore remains a
deferred, DataHealth-gated future task.

## 16. Safety boundaries

- The store is the ONLY disk-touching app file; the state delegates all IO to it
  and never references `FileManager`.
- All IO is confined to one Application Support subdirectory; filenames are
  sanitized; clear/quarantine/export are all prefix-scoped to the store's files.
- No Cloud/CloudKit/iCloud, no `IronPathCloudSync`, no HealthKit, no Supabase, no
  `URLSession`/network, no WebKit, no `UserDefaults`, no SQLite/CoreData/
  SwiftData, no AppData read/write, no auth, no raw AppData→TrainingDecision.

## 17. Tests/guards

`tests/iosLocalTrainingPersistenceMegaStaticGuards.test.ts` — 36 assertions
covering validation, defensive decode, quarantine + scope, restore/no-fake-
success (save + restore + export), detail UI, newest-first sort + filters, stats,
backup-before-overwrite ordering + non-history backup files, local-only export,
the full forbidden-API bans, the AppData/DataHealth restore boundary (no raw
AppData restore into TrainingDecision; future restore references
`buildCleanAppDataView`), parity-golden invariance, package/lockfile invariance,
and iOS-4B6 deferred. The iOS-9 + iOS-8 guards remain green (additive change).
**App-target XCTest is deferred** (would need risky pbxproj test-target surgery);
the pure validation/stats are written IO-free so a future Swift-package test
target can unit-test them without app-test chaos.

## 18. Validation

`parity --check` (14/0) + `--list`; `test:parity` / `test:ios` / `validate:ios`;
`api:dev:build`; `typecheck`; `npm test`; `build`; `scan-production-dist-safety`;
`package.json`/`package-lock.json` byte-identical (no pnpm/yarn lock);
`git diff --check`; `swift test` × 9 packages; `xcodebuild` generic +
iPhone 17 Pro.

## 19. Manual Simulator smoke checklist

1. App launches without crash.
2. Previously saved local snapshots still load on launch.
3. Saved-session list appears.
4. Tapping a saved session opens the detail sheet.
5. Local stats summary appears.
6. A hand-created corrupt file does not crash load/list; the local "invalid
   skipped" warning appears, and "隔离无效存档" moves it out of the list.
7. Clear saved sessions still works (confirmation dialog).
8. Completing a new session still saves and updates latest + list.
9. "生成本机 JSON 副本" shows the local export status; backup/export visible in
   the diagnostics row.
10. No cloud / network / account prompts.
11. No crash throughout.

## 20. Remaining risks

- Synchronous IO on the main actor (snapshots are tiny; acceptable for V1).
- Deterministic clock → identical display timestamps in the demo (rows are
  distinguished by scenario + counts + sequence).
- `snapshotId` is display-only and can drift from the file sequence (filenames
  stay unique; no data loss).
- No schema migration path yet (an unsupported/old file is skipped/quarantined,
  not migrated).
- No app-target unit tests (static guards + xcodebuild + manual smoke cover it).

## 21. Next task recommendation

**iOS-11 Local Snapshot Schema v2 + Migration + Restore-to-Draft V1** — introduce
schema v2 with a forward migration path (v1 → v2), and a SAFE restore-to-in-RAM-
draft (still not full AppData restore), plus the first pure-Swift package test
target for the validation/stats utilities. Full AppData restore stays deferred
behind the DataHealth/`buildCleanAppDataView` gate. iOS-4B6
(userFacing/full `arbitrationTrace`) remains deferred / parallel.
