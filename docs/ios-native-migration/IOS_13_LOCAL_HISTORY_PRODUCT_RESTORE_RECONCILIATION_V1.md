# iOS-13 Local History Product Surface + Restore Reconciliation V1

> Status: product-loop bundle (single PR). Local-only. No Cloud, HealthKit,
> Supabase, network, WebView, auth, or production sync.

## Goal

Make the saved-session area feel like a real local training history product, and
make restore-to-local-draft safer by explicitly reconciling exercise ids between
a saved snapshot and the current scenario.

## Why iOS-13 follows iOS-12

iOS-12 extracted the local-snapshot logic into the `IronPathLocalSnapshot` Swift
package with real tests, and shipped a basic flat history + a restore planner
that trusted the snapshot's own exercise ids. iOS-13 builds the product surface
on top: grouped history, completion ratios, and — most importantly — restore
reconciliation so template drift between save and restore degrades safely and
honestly instead of injecting stale ids into a live session.

## Product-level scope

A coherent bundle across history UX, restore safety, package tests, and
diagnostics — not a one-field PR. Pure logic lives in the package (testable);
the app stays a thin renderer. No new app Swift files, so no `project.pbxproj`
change.

## Local history improvements

- **Grouped sections** via a pure `LocalSnapshotHistory.grouped(_:now:)` helper:
  Today / Earlier (≤7 days) / Older, newest-first within each section, empty
  sections omitted, unparseable timestamps bucketed to Older (never dropped).
- **Richer cards**: scenario · sessionIntent · activePhase, completed/target
  sets with a per-session **completion ratio**, and a compact timestamp.
- Local-only disclaimer (`仅保存在本机 · 不同步云端 · 可清除`), stats row,
  scenario/completed filters, and a confirmation-gated clear all remain.

## Saved detail improvements

The detail sheet keeps a readable exercise list, completed/target sets, the
`schema v{N}` badge + restore-eligibility label, the local-only label, and the
"继续这次训练（本机草稿）" action. Failure states stay honest.

## Restore reconciliation design

`LocalDraftRestorePlanner.reconcile(from:against currentExerciseIds:)` (pure):
1. Runs the base plan (rejects empty / impossible progress exactly as before).
2. Partitions saved exercise ids against the **current scenario's** exercise ids:
   - `matchedExerciseIds` — saved ids still present (restored, snapshot order).
   - `unmatchedSnapshotIds` — saved ids no longer present (renamed/removed) —
     **reported, never applied**.
   - `missingCurrentIds` — current exercises new since the save (start at 0).
3. Applies completed counts **only to matched ids** (never injects stale ids).
4. **Remaps the resume cursor** into the current row order (prefers the saved
   resume exercise if it still exists, else the first matched exercise, else 0).

The app's `FocusModeMvpState.restoreDraft` derives the current scenario's
exercise ids deterministically (`FocusModePreviewData.sampleCoreSlice(for:)` ∩
the template set — the same rows the shell shows), reconciles, and applies the
matched-only plan. On ANY failure (unknown scenario OR planner rejection) it
sets an honest `.failed` status and returns BEFORE mutating the current
in-memory session — no fake restore. Completing a restored draft writes a NEW
snapshot (append), never a destructive overwrite.

## IronPathLocalSnapshot tests added

The package test target now covers (in addition to iOS-12's 22): reconcile with
all matched (counts + resume preserved), reconcile reporting missing/renamed ids
(counts applied only to matched), reconcile remapping the resume cursor to
current order, reconcile with no matches (applies nothing), reconcile rejecting
impossible progress, and history grouping (Today/Earlier/Older newest-first,
empty, unparseable→Older). 29 tests total via `swift test`.

## Diagnostics / failure honesty

- The history diagnostics "最近恢复" line now surfaces reconciliation drift:
  `已恢复「…」· 跳过旧动作 N · 新动作 M`.
- The in-session restored-draft banner adds a drift note when applicable.
- Existing local storage status (valid / skipped-invalid / quarantined / schema
  v1/v2 / migrated counts) remains.

## Safety boundaries

Pure logic in the leaf package; restore is an in-RAM draft (NOT AppData) and
never feeds TrainingDecision raw bytes (the scenario slice is regenerated
deterministically, only matched completed counts are applied). The store remains
the only disk-touching code. No Cloud/CloudKit/iCloud, no `IronPathCloudSync`,
no HealthKit, no Supabase, no `URLSession`/network, no WebKit, no `UserDefaults`,
no SQLite/CoreData/SwiftData, no auth.

## Non-goals (deferred)

- **Full AppData restore** — still deferred behind the DataHealth ingress /
  `buildCleanAppDataView` clean-input contract.
- No full analytics/calendar app (grouping is coarse: Today/Earlier/Older only).
- **iOS-4B6** (userFacing / full `arbitrationTrace`) — deferred / parallel.

## Validation

`parity --check` (14/0) + `--list`; `test:parity` / `test:ios` / `validate:ios`;
`api:dev:build`; `typecheck`; `npm test`; `build`; `scan-production-dist-safety`;
`package.json`/`package-lock.json` byte-identical (no pnpm/yarn lock);
`git diff --check`; `swift test` × 10 packages (IronPathLocalSnapshot = 29
tests); `xcodebuild` generic + iPhone 17 Pro.

## Manual Simulator smoke checklist

1. App launches; saved local history appears (grouped Today/Earlier/Older).
2. Empty state works when there are no saved sessions.
3. History cards are readable (scenario / intent / phase / sets / completion %).
4. Saved detail opens.
5. Restore-to-local-draft works; restored progress matches saved progress for
   matched exercises.
6. A reconciliation note appears when saved/current exercises drift.
7. The user can continue a restored draft; completing it writes a NEW snapshot.
8. Invalid / unsupported / corrupt snapshots do not crash.
9. Diagnostics/history UI remains understandable; no cloud/network prompts; no crash.

## Remaining risks

- Synchronous main-actor IO (snapshots are tiny; acceptable).
- Deterministic clock → in the demo all snapshots group under Today; the grouping
  helper is unit-tested with distinct timestamps.
- Reconciliation matches by exact exercise id; a true "rename with same exercise"
  is treated as removed+added (reported honestly), not fuzzy-matched.

## Next recommended task

**iOS-14 Local History Detail Polish + Real-Clock Option V1** — optional
injected real-time clock so history grouping spans real days, per-exercise
restore detail in the detail sheet, and a small history search/filter pass.
Full AppData restore stays deferred behind the DataHealth / `buildCleanAppDataView`
gate. iOS-4B6 remains deferred.
