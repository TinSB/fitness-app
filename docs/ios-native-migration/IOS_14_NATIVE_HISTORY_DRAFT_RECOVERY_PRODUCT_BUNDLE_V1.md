# iOS-14 Native History + Draft Recovery Product Bundle V1

> Status: product-loop bundle (single PR). Local-only. No Cloud, HealthKit,
> Supabase, network, WebView, auth, or production sync.

## Goal

Advance the local-first iOS app from "history list + restore" into a more
complete native local history and draft-recovery experience: local search,
a recent-training summary, a real-clock option so grouping spans real days, and
polished history/detail surfaces — without losing any safety discipline.

## Why iOS-14 follows iOS-13

iOS-13 shipped grouped history (Today/Earlier/Older) + restore reconciliation.
iOS-14 makes the surface feel like a real product: lightweight local search,
a most-common-scenario summary, and a real wall-clock for the running app so
"Today / Earlier / Older" actually tracks real days (tests/previews keep the
deterministic clock).

## Product-level scope

A coherent multi-area bundle (history UX + search + summary + clock + detail +
tests + diagnostics + guards/docs). Pure logic lives in the `IronPathLocalSnapshot`
package (testable); the app stays a thin renderer. No new app Swift files → **no
`project.pbxproj` change**.

## History improvements

- New pure `LocalSnapshotHistory.filtered(_:query:scenarioId:completedOnly:)` —
  lightweight local search (matches scenario label / session intent / exercise
  name, case-insensitive) + scenario + completed-only filters, preserving order;
  the view groups afterwards. No database, no index, no network.
- The history view adds a **search field** and uses the pure filter, then the
  grouped sections (Today/Earlier/Older, newest-first) + per-session completion
  ratio. Local-only disclaimer / clear remain.

## Detail improvements

The detail sheet keeps a readable exercise list, completed/target sets, the
`schema v{N}` badge + restore-eligibility label, the local-only label, and the
"继续这次训练（本机草稿）" action with honest failure messaging.

## Draft recovery improvements

Carried from iOS-13 and re-locked: `restoreDraft` reconciles saved exercise ids
against the current scenario (matched-only counts, reported unmatched/missing,
remapped resume cursor); ANY failure leaves the current in-memory session
untouched (no fake restore); the in-session restored-draft banner shows drift;
completing a restored draft writes a NEW snapshot (append).

## Filtering / search / sorting decision

Implemented as a pure helper + a search field (Area B): newest-first remains the
default ordering (the store + grouping preserve it); scenario filter + completed-
only + free-text search are all local and fast. No fuzzy index, no database.

## Local stats decision

Extended `LocalSnapshotStats` with `mostCommonScenarioLabel` (mode; ties resolve
toward the most recent). The history summary now shows total sessions / completed
sets / target sets / completion % + most-common scenario + last session date.
No charts, no analytics engine, no TS changes.

## Clock / grouping decision

`FocusModeMvpState` gains `systemClock` (`{ Date() }`) + `useSystemClock()`; the
shell calls it once on launch so the RUNNING app stamps real timestamps and
groups by real days. The default `clock` stays the deterministic reference date,
so package tests and SwiftUI previews remain reproducible and never flaky — the
grouping helper is unit-tested with explicit injected `now`/timestamps.

## IronPathLocalSnapshot tests added

The package test target now covers (on top of iOS-13's 30): filter by scenario +
completed-only, filter by free-text query (scenario / intent / exercise name,
blank = all, no-match = empty), and the most-common-scenario stat (mode + tie
toward most recent). 33 tests total via `swift test`.

## Diagnostics / failure honesty

The history diagnostics row (valid / skipped-invalid / quarantined / schema
v1·v2 / migrated counts + latest restore status with drift) and the in-session
restored-draft banner remain. No scary raw technical dump.

## Safety boundaries

Pure logic in the leaf package; restore is an in-RAM draft (NOT AppData) and
never feeds TrainingDecision raw; the real clock is an explicit opt-in (default
deterministic). The store remains the only disk-touching code. No Cloud/CloudKit/
iCloud, no `IronPathCloudSync`, no HealthKit, no Supabase, no `URLSession`/network,
no WebKit, no `UserDefaults`, no SQLite/CoreData/SwiftData, no auth.

## Non-goals (deferred)

- **Full AppData restore** — deferred behind the DataHealth ingress /
  `buildCleanAppDataView` clean-input contract.
- No full analytics/calendar app (coarse grouping + simple summary only).
- **iOS-4B6** (userFacing / full `arbitrationTrace`) — deferred / parallel.

## Validation

`parity --check` (14/0) + `--list`; `test:parity` / `test:ios` / `validate:ios`;
`api:dev:build`; `typecheck`; `npm test`; `build`; `scan-production-dist-safety`;
`package.json`/`package-lock.json` byte-identical (no pnpm/yarn lock);
`git diff --check`; `swift test` × 10 packages (IronPathLocalSnapshot = 33
tests); `xcodebuild` generic + iPhone 17 Pro.

## Manual Simulator smoke checklist

1. App launches; saved local history appears (grouped, real-day grouping).
2. Empty state works when there are no saved sessions.
3. Grouping / scenario filter / completed-only / search all work.
4. Saved detail opens.
5. Restore-to-local-draft works; restored progress matches saved for matched
   exercises; a reconciliation note appears on drift.
6. Continue a restored draft; completing it writes a NEW snapshot.
7. The recent-summary card (sessions / sets / completion % / most-common /
   last session) appears.
8. Invalid / unsupported / corrupt snapshots do not crash.
9. Diagnostics/history understandable; no cloud/network prompts; no crash.

## Remaining risks

- Synchronous main-actor IO (snapshots are tiny; acceptable).
- The running app now uses real timestamps, so the saved-history demo is no
  longer reproducible across runs — by design; tests/previews stay deterministic.
- Search is substring (not fuzzy); fine for a small local list.

## Next recommended task

**iOS-15 Local History Detail + Per-Exercise Recovery Insight V1** — per-exercise
restore detail (show matched/unmatched per row in the detail sheet), an optional
date-range filter, and a small "resume where you left off" affordance. Full
AppData restore stays deferred behind the DataHealth / `buildCleanAppDataView`
gate. iOS-4B6 remains deferred.
