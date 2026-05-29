# iOS-12 Native Local Restore + History + Testability Mega Bundle V1

> Status: product-loop bundle (single PR). Local-only. No Cloud, HealthKit,
> Supabase, network, WebView, auth, or production sync.

## Goal

Turn the local-first training MVP into a **testable, trustworthy** loop: real
Swift unit tests for the snapshot/migration/restore logic, stronger restore
fidelity, clearer saved history/detail, honest diagnostics + failure states.

## Why this combines the old iOS-11/iOS-12 work into one product loop

Per the user, the pace had been too slow with one-field PRs. This bundle does a
full product stage at once: it extracts the pure local-snapshot logic into a
real Swift package so it can carry XCTest (the testability the prior plan kept
deferring), AND hardens restore fidelity, history/detail UX, diagnostics, and
failure honesty in the same loop.

## Execution strategy

Internal checkpoints, each gated by build + swift test + guard regression:
CP1 extract pure logic to a new `IronPathLocalSnapshot` Swift package +
public-ify + add the pure restore planner → CP2 pbxproj (drop moved files, add
the package dependency) + app imports → CP3 real XCTest → CP4 restore fidelity +
history/detail/diagnostics UX → CP5 guards + docs → CP6 full validation + merge.

## Testability design chosen

**A new local Swift package `ios/packages/IronPathLocalSnapshot`** holding the
pure, IO-confined logic (model, validation, migration, stats, the app-local JSON
store, and a new restore-to-draft planner), with an XCTest test target. This is
the repo's established, robust testing pattern — the existing 9 local packages
are all tested via `swift test --package-path …`, which CI/validation already
runs. It deliberately AVOIDS an app unit-test target (Xcode scheme test action /
host app), which is the fragile pbxproj surgery the task flagged as a stop
condition. The package is a pure leaf (Foundation only, no dependencies); the
app target gains one local package product dependency (the 10th, mirroring the
existing pattern) and `import IronPathLocalSnapshot` in the 3 consuming files.

## Swift tests added

`IronPathLocalSnapshotTests` (21 tests, `swift test`):
- snapshot encode/decode round trip; v1 JSON decodes without `resumeExerciseIndex`
- validation: valid v1/v2 pass; unsupported future schema, empty id/timestamp,
  negative counts, completed>target, totals mismatch, empty exercises, invalid
  resume index all rejected
- migration: v1→current fills resume + bumps version; **does not mutate source**;
  current is no-op; **future version not downgraded**; below-minimum not promoted
- stats derivation (totals / ratio / most-recent)
- restore plan: **order preserved**, **completed counts preserved**, resume
  cursor clamped, impossible/empty rejected
- store on a temp dir: save/load round trip; **append (not overwrite) on each
  completion**; **backup-before-overwrite** of the latest pointer; corrupt file
  skipped + quarantined; **v1 file migrated on decode**; clear removes only its
  own prefixed files (leaves unrelated files).

## Restore fidelity improvements

`FocusModeMvpState.restoreDraft` now delegates to the pure, unit-tested
`LocalDraftRestorePlanner`: it preserves exercise order, preserves completed set
counts, clamps the resume cursor into range, and rejects impossible/empty
progress. On ANY failure (unknown scenario OR planner rejection) it sets an
honest `.failed` status and returns BEFORE touching the current in-memory
session — no fake restore. A renamed/missing exercise id from an older template
is safely ignored at render (count lookup by id), never a crash. Completing a
restored draft writes a NEW local snapshot (append), never a destructive
overwrite (covered by `testStoreAppendsRatherThanOverwrites`).

## Saved history/detail improvements

- Detail sheet: a `schema v{N}` badge + a "本机可恢复继续" restore-eligibility
  label + the existing scenario / sessionIntent / phase / deload / sets summary +
  "继续这次训练（本机草稿）".
- History: local-only disclaimer, latest card, recent list, stats row, clear,
  and an invalid/skipped warning when present.

## Diagnostics improvements

The local storage diagnostics row shows: valid / skipped-invalid / quarantined
counts, backup + local-copy presence, `schema v1 / v2 / 已迁移` counts, and a
new **最近恢复** (latest restore) status — all local, no scary technical dump,
no raw file paths for normal users.

## Failure handling

No fake success on save/load/restore/migration failure; the current in-memory
session is never silently destroyed on a failed restore; an invalid snapshot
cannot be restored as valid (planner + validator reject it); an unsupported
future schema is never downgraded into valid; a corrupt file is skipped/
quarantined and cannot crash the app (covered by tests).

## Safety boundaries

Pure logic in a leaf package (Foundation only); the store is the only disk-
touching code and is sandboxed to one Application Support subdirectory; restore
is an in-RAM draft (NOT AppData). No Cloud/CloudKit/iCloud, no `IronPathCloudSync`,
no HealthKit, no Supabase, no `URLSession`/network, no WebKit, no `UserDefaults`,
no SQLite/CoreData/SwiftData, no AppData read/write, no auth.

## Non-goals (deferred)

- **Full AppData restore** — still deferred behind the DataHealth ingress /
  `buildCleanAppDataView` clean-input contract; iOS-12 restore only rebuilds an
  in-RAM draft and never feeds TrainingDecision raw bytes.
- **iOS-4B6** (userFacing / full `arbitrationTrace`) — deferred / parallel.

## Validation

`parity --check` (14/0) + `--list`; `test:parity` / `test:ios` / `validate:ios`;
`api:dev:build`; `typecheck`; `npm test`; `build`; `scan-production-dist-safety`;
`package.json`/`package-lock.json` byte-identical (no pnpm/yarn lock);
`git diff --check`; `swift test` × **10** packages (incl. the new
`IronPathLocalSnapshot` — 21 tests); `xcodebuild` generic + iPhone 17 Pro.

## Manual Simulator smoke checklist

1. App launches without crash.
2. Existing saved sessions still appear (v1 files migrate forward silently).
3. Saved session detail opens (schema badge + restore-eligibility shown).
4. Restore-to-local-draft works; restored progress matches the saved progress.
5. The user can continue the restored draft ("已恢复本机草稿" banner).
6. Completing the restored draft writes a NEW snapshot (history grows).
7. Invalid / unsupported / corrupt snapshots do not crash the app.
8. Diagnostics / history UI remains understandable (counts + 最近恢复).
9. No cloud / network prompts; no crash.

## Remaining risks

- Synchronous main-actor IO (snapshots are tiny; acceptable for V1).
- Deterministic clock → identical display timestamps in the demo.
- Restore maps counts by exercise id; renamed template ids are ignored at render
  (no crash, no bad data) — full id reconciliation is a future nicety.
- The new package adds one local dependency edge (additive, mirrors the existing
  9 packages); validated by `swift test` + `xcodebuild`.

## Next recommended task

**iOS-13 Local History Product Surface + Restore Reconciliation V1** — a richer
(still local) saved-history surface (grouping, per-card completion ratio,
search) + explicit exercise-id reconciliation on restore (report renamed/missing
ids), with the package test target extended. Full AppData restore stays deferred
behind the DataHealth / `buildCleanAppDataView` gate. iOS-4B6 remains deferred.
