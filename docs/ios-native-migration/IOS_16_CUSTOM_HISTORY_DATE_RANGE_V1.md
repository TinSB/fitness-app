# iOS-16 Custom History Date Range V1

> Status: product-loop bundle (single PR). Local-only. No Cloud, HealthKit,
> Supabase, network, WebView, auth, or production sync.
>
> Binding contract: obey [`docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`](../IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md).
> This bundle is an **Allowed Change Pattern** (§19.2 extend an active package with
> pure logic + §19.3 improve the thin app layer + §19.5 documentation). It
> introduces **no** source-of-truth change, **no** new platform/persistence
> dependency, **no** snapshot-schema change, and keeps restore an in-memory draft
> (§13). If any step here would conflict with that document, stop and escalate
> before writing code.

## Goal

Let the user filter the local saved-session history by an **explicit custom
from/to date range** (day granularity, inclusive), complementing the coarse
`全部 / 最近 7 天 / 最近 30 天` control shipped in iOS-15 — all as pure, testable
logic in `IronPathLocalSnapshot` with a thin SwiftUI renderer. Also refresh the
master architecture document's milestone/baseline lines so they reflect the
merged iOS-15 state.

## Why iOS-16 follows iOS-15

iOS-15 added a coarse date-range filter (`LocalHistoryDateRange` = all / 7d / 30d,
measured in calendar days against an injected `now`), the per-exercise recovery
insight, and an honest resume affordance. The coarse buckets answer "recently?"
but not "what did I do between two specific dates?". iOS-16 closes that gap with
an absolute, inclusive `[from, to]` interval — the natural next increment, and
the smallest one that does not require touching the snapshot schema.

## Product-level scope

A coherent, single-PR bundle: a pure custom-range filter in the
`IronPathLocalSnapshot` package (unit-tested via `swift test`), a thin SwiftUI
control to drive it, and a documentation refresh. The app stays a thin renderer.
Target **no new app Swift files → no `project.pbxproj` change** (the new package
source file is picked up automatically by SPM).

In scope:

1. **Pure custom from/to filter** — a new `LocalHistoryCustomDateRange` value type
   and an additive `customRange:` parameter on `LocalSnapshotHistory.filtered(...)`,
   plus a directly-testable `isWithin(_:from:to:calendar:)`.
2. **Thin SwiftUI custom date control** — a toggle that reveals two day-granular
   `DatePicker`s, composed with the existing search / scenario / completed-only /
   coarse-range filters.
3. **Architecture doc refresh** — baseline/milestone/progress lines moved to the
   merged iOS-15 state.

Out of scope (see Non-goals): a per-exercise "last set summary", any snapshot
schema change, charts/analytics, fuzzy search, and full AppData restore.

## Existing building blocks this bundle reuses (no rewrite)

- `LocalSnapshotHistory.filtered(_:query:scenarioId:completedOnly:dateRange:now:calendar:)`
  — the iOS-14/15 pure filter; iOS-16 adds **one** optional parameter to it.
- `LocalSnapshotHistory.utcCalendar` + the internal ISO-8601 `parseDate` — reused
  verbatim for day-granular comparison, so the custom range agrees with grouping.
- `LocalHistoryDateRange` (coarse enum, `CaseIterable`) — **left untouched**; the
  segmented control depends on its raw/CaseIterable contract.
- `FocusModeMvpState.clock` (injectable, deterministic by default) — used only to
  seed sensible default picker dates; never an inline `Date()`.

## Detail design — pure custom range (IronPathLocalSnapshot)

New value type + additive filter parameter (no new public function on the hot
path beyond a test entry point):

```
public struct LocalHistoryCustomDateRange: Equatable {
    public let from: Date
    public let to: Date
    public init(from: Date, to: Date)
}

// additive parameter (defaulted -> existing call sites unchanged):
public static func filtered(
    _ snapshots: [LocalCompletedSessionSnapshot],
    query: String = "", scenarioId: String? = nil, completedOnly: Bool = false,
    dateRange: LocalHistoryDateRange = .all,
    customRange: LocalHistoryCustomDateRange? = nil,   // iOS-16
    now: Date? = nil, calendar: Calendar = .utcCalendar
) -> [LocalCompletedSessionSnapshot]

// directly testable membership:
public static func isWithin(_ iso: String, from: Date, to: Date, calendar: Calendar = .utcCalendar) -> Bool
```

Rules:

- **Inclusive calendar-day interval**, UTC-pinned by default: a snapshot whose
  timestamp lands on `from`'s day through `to`'s day (inclusive) matches —
  `startOfDay(from) <= startOfDay(snap) <= startOfDay(to)`.
- **Reversed interval is NORMALIZED** (bounds swapped at compare time), so two
  independent day pickers can never produce an empty result by ordering alone.
- **Absolute** — the custom range needs no `now`; passing `now: nil` does not
  disable it (only the coarse range depends on `now`).
- **Unparseable timestamps** are excluded from a bounded custom range but never
  crash, and are never dropped when `customRange` is nil (mirrors the coarse rule).
- **Composes (logical AND)** with `query` / `scenarioId` / `completedOnly` and the
  coarse `dateRange`; the caller disables a filter by passing `.all` / `nil`.
- **Order-preserving**; pure; no disk, no network, no clock of its own.

## Detail design — thin app-layer control (render + wiring only)

- `FocusModeMvpState` holds the custom-range UI state in RAM:
  `historyCustomRangeEnabled: Bool`, `historyCustomFrom/To: Date` (defaulting to
  the deterministic reference instant — **never** an inline `Date()`), a computed
  `historyCustomRange: LocalHistoryCustomDateRange?` (nil when off), and
  `setHistoryCustomRangeEnabled(_:)` which, on first enable, seeds `[~30d ago, now]`
  from the injectable clock. No disk, no IO, no engine; the deterministic clock
  stays the default (`useSystemClock()` remains the single launch-time opt-in).
- `FocusSavedSessionHistoryView` adds a `按自定义日期筛选` toggle that reveals two
  `DatePicker`s (`.date` granularity, UTC-pinned to match grouping). When custom
  is active it **takes over**: `filteredHistory` passes `.all` for the coarse
  range and the active `customRange`, composed with search / scenario / completed.
  The coarse segmented control is `.disabled` while custom is on. The empty state
  keeps a title + explanation + one action.

## Safety boundaries (re-locked)

- **Pure logic in the leaf package** (`IronPathLocalSnapshot`, Foundation-only);
  the app stays a thin renderer (§5, §15, §19).
- **No snapshot schema change, no new persistence field, no schemaVersion bump,
  no disk-format change** — the filter reads only the existing `createdAtIso`.
- **`IronPathLocalSnapshot` stays decoupled from `IronPathDomain`/AppData**
  (§6.3, §8, §12). The history store remains the only disk-touching code.
- **Restore stays an in-memory draft (§13)** — this bundle does not touch
  `reconcile` / `restoreDraft` or the §14 full-AppData-restore gate.
- **`LocalHistoryDateRange` raw/CaseIterable contract is untouched** (the
  segmented control depends on it); custom range is a separate value type.
- **Local-only.** No iCloud/CloudKit/ubiquity, no `IronPathCloudSync`, no
  HealthKit, no Supabase, no `URLSession`/network, no WebKit, no `UserDefaults`,
  no SQLite/CoreData/SwiftData. `iosLocalJsonPersistenceStaticGuards` stays green.
- **Determinism.** Default picker dates + the coarse range derive from the
  injectable clock (deterministic by default); package tests use absolute
  from/to + injected `now`, so they never depend on the wall clock.
- **No engine output change** → **no parity-golden regeneration**;
  `TrainingDecision` untouched; `iOS-4B6` user-facing arbitration trace stays
  deferred.
- **No stub package touched**; **no `project.pbxproj` change** (no new *app*
  files); `package.json` / `package-lock.json` byte-identical.

## Non-goals (deferred)

- **Per-exercise "last set summary" (weight / reps / RIR) in the detail row** —
  **deferred and gated.** The current `LocalCompletedSessionSnapshot` stores only
  per-exercise `completedSets` / `targetSets`, NOT individual set weight/reps/RIR.
  Surfacing a real last-set summary would require **adding a persisted field to
  the snapshot + a schemaVersion bump + a forward migration + new guards** — a
  data-safety-relevant change that belongs in its own approved task, not here
  (this PR explicitly does not bump the schema; see §9/§12/§18 of the master doc).
- **Full AppData restore** — deferred behind the DataHealth ingress /
  `buildCleanAppDataView` gate (§14). iOS-16 changes only how history is filtered.
- No charts/analytics/calendar app; no fuzzy search; no snapshot editing/deletion.
- **`iOS-4B6`** (userFacing / full `arbitrationTrace`) — deferred / parallel.

## Validation

This is a **Swift + docs** change → §21.1 (CI / TypeScript) **and** §21.2 (local
Swift) both apply. No TS source changes, so no parity-golden regeneration.

```bash
# Inner loop (after each package change):
swift test --package-path ios/packages/IronPathLocalSnapshot   # existing 48 + new custom-range tests

# Wrap-up (run once before the PR; must pass NORMALLY, no --admin):
npm run api:dev:build
npm run typecheck
npm test
npm run build
git diff --check                 # no whitespace/conflict markers
# package.json + package-lock.json MUST be byte-identical

# (sanity) the other 9 packages remain green:
#   for p in IronPathDomain IronPathDataHealth IronPathTrainingDecision \
#            IronPathPersistence IronPathL10n IronPathHealthKit \
#            IronPathCloudSync IronPathBackup IronPathUIKit; do
#     (cd ios/packages/$p && swift test); done

# App build (both destinations):
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' build
  # If the generic build fails locally with "requires a development team", append
  # CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO (local env limitation, not a
  # code issue; CI does not build Swift).
```

New package tests to add (pure, deterministic) — at minimum: inclusive
boundaries (from day + to day), single-day interval, reversed-interval
normalization, unparseable excluded-from-bounded-but-no-crash, nil-range keeps
everything, composition with the coarse range (intersection) and with
query/scenario/completedOnly, order preserved, now-independence, and
`isWithin(_:from:to:)` direct boundaries.

## Manual Simulator smoke checklist

1. History plan screen → `按自定义日期筛选` toggle appears; off by default.
2. Turn it on → two day pickers appear, seeded to roughly the last 30 days; the
   coarse segmented control greys out (custom takes over).
3. Pick a `从`/`到` window that brackets some saved sessions → the list shows only
   those; combine with search / scenario / 仅完成 → still composes correctly.
4. Pick `到` earlier than `从` → still returns the same window (normalized), no
   empty-by-ordering surprise; no crash.
5. Turn custom off → the coarse `全部 / 最近 7 天 / 最近 30 天` control re-enables
   and works as before. Empty state intact when nothing matches.
6. Determinism: previews/tests stable (deterministic clock); the running app uses
   real timestamps via the existing single opt-in.
7. No cloud/network/auth prompts anywhere; no crash on invalid/unsupported
   snapshots.

## Remaining risks

- Day-granular UTC comparison can surprise across time zones; the UTC-pinned
  calendar keeps it consistent with existing grouping — documented and tested
  with absolute from/to.
- A very wide custom range over a large local list is still a linear scan; fine
  for a small local history (the list is already capped in the view).

## Next recommended task

**iOS-17 (proposed)** — a per-exercise "last set summary" in the saved-session
detail row. This is **gated**: it requires adding a persisted per-set field to
`LocalCompletedSessionSnapshot` + a schemaVersion bump + a forward migration +
guards, so it must be its own approved task (master §9/§12/§18). `iOS-4B6` and
full AppData restore remain deferred behind their gates (§14, §17).

---

## Appendix — §25 Future Task Prompt Template (filled)

```markdown
## Task: iOS-16 Custom History Date Range V1

**Baseline commit:** 2918afa  (latest origin/main; iOS-15 #420)
**Goal:** Add a custom from/to date-range filter to the local history list (completing iOS-15's coarse ranges) and refresh the architecture doc's milestone/baseline lines.
**Scope:** One vertical slice — a pure custom-range filter in IronPathLocalSnapshot, rendered by the thin SwiftUI history view, plus a documentation refresh. No restore/reconcile change, no snapshot-schema change.

**Allowed files / systems:**
- ios/packages/IronPathLocalSnapshot/**            (additive custom-range filter + tests)
- ios/IronPath/FocusSavedSessionHistoryView.swift  (render only)
- ios/IronPath/FocusModeMvpState.swift             (in-RAM UI state only; no new IO)
- docs/ios-native-migration/**, docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md (descriptive refresh, §19.5)

**Forbidden files / systems:**
- snapshot persistence field / schemaVersion bump / disk-format change (no per-set last-set summary)
- LocalHistoryDateRange raw/CaseIterable contract (segmented control depends on it)
- reconcile / restoreDraft semantics (restore stays an in-memory draft)
- project.pbxproj (no new app files); package.json / package-lock.json
- Any stub package (HealthKit/CloudSync/Backup/UIKit)
- CloudKit/iCloud/Supabase/HealthKit/URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData
- IronPathDomain/AppData coupling into IronPathLocalSnapshot

**Source-of-truth impact:** none.
**Data safety impact:** Restore stays an in-memory draft (§13); no snapshot schema/open-bag/timestamp change; LocalSnapshot stays decoupled from AppData; no full-restore gate (§14) work.

**Validation commands:**
- swift test for ios/packages/IronPathLocalSnapshot (+ sanity on the other 9)
- npm run api:dev:build && npm run typecheck && npm test && npm run build ; git diff --check
- xcodebuild iPhone 17 Pro Simulator + generic/platform=iOS
- No parity-golden regeneration (engine output unchanged)

**PR & merge rules:**
- Branch from latest origin/main (no worktree); never commit to main  → branch: ios-16-custom-history-date-range
- Open PR; wait for required checks; if repo auto-merge is disabled, `gh pr checks <n> --watch` then a normal squash merge
- No --admin; no branch-protection bypass

**Cleanup rules:**
- Commit only intended files (NOT .claude/*); run git writes serially; delete branch after squash merge; leave repo clean
```
