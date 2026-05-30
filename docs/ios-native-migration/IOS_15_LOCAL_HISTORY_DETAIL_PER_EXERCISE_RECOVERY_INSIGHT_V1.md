# iOS-15 Local History Detail + Per-Exercise Recovery Insight V1

> Status: product-loop bundle (single PR). Local-only. No Cloud, HealthKit,
> Supabase, network, WebView, auth, or production sync.
>
> Binding contract: obey [`docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`](../IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md).
> This bundle is an **Allowed Change Pattern** (§19.2 extend an active package with
> pure logic + §19.3 improve the thin app layer). It introduces **no** source-of-truth
> change, **no** new platform/persistence dependency, and keeps restore an
> in-memory draft (§13). If any step here would conflict with that document, stop
> and escalate before writing code.

## Goal

Make the saved-session **detail** surface explain, per exercise, exactly what a
"continue this session" (restore-to-local-draft) would and would not bring back,
add a coarse **date-range** filter to the history list, and give the user a small,
honest **"resume where you left off"** affordance — all as pure, testable logic in
`IronPathLocalSnapshot` with a thin SwiftUI renderer.

## Why iOS-15 follows iOS-14

iOS-14 made native local history feel like a product: local search, a
most-common-scenario summary, a real wall-clock for grouping, and a polished
history/detail surface, on top of iOS-13's grouped history + restore
reconciliation. The reconciliation logic already computes *exactly* which saved
exercises still exist, which drifted away, and which current exercises are new —
but the **detail sheet does not yet show that per row**, so the user can't see
what a restore will preserve before they tap it. iOS-15 surfaces that existing
signal at the per-exercise level, plus a date-range filter and a resume hint.

This is the task named as **"Next recommended task"** at the end of the iOS-14
bundle doc and in §27 of the master architecture document.

## Product-level scope

A coherent, single-PR bundle across detail UX, history filtering, restore
*transparency* (not new restore semantics), package tests, and guards/docs. Pure
logic lives in the `IronPathLocalSnapshot` package (unit-tested via `swift test`);
the app stays a thin renderer. Target **no new app Swift files → no
`project.pbxproj` change** (new *package* source files are picked up automatically
by SPM and do not touch the pbxproj).

In scope:

1. **Per-exercise recovery insight** in the saved-session detail sheet — each
   exercise row shows whether it is restorable (`可恢复`) or has drifted
   (`已变更`), plus a short, honest drift note and a list of new current
   exercises the snapshot has no progress for.
2. **Date-range filter** on the history list — a coarse `全部 / 最近 7 天 /
   最近 30 天` control composed with the existing search / scenario /
   completed-only filters.
3. **"Resume where you left off" affordance** — a small label
   (`上次练到第 N / 总 个动作：<name>`) remapped into the current scenario order,
   with a `从这里继续` action wired to the **existing** in-memory draft restore
   (no new restore path, honest failure messaging).

Out of scope (see Non-goals): full AppData restore, set-by-set timelines,
analytics/charts, fuzzy search, custom calendar date pickers, snapshot
editing/deletion, and `iOS-4B6` user-facing arbitration trace.

## Existing building blocks this bundle reuses (no rewrite)

All of the data this bundle needs already exists in `IronPathLocalSnapshot`; iOS-15
is a **projection + presentation** layer over it, not new business logic.

- `LocalDraftRestorePlanner.reconcile(from:against:)` →
  `LocalDraftRestoreReconciliation { plan, matchedExerciseIds,
  unmatchedSnapshotIds, missingCurrentIds, hasDrift }`. This is the authoritative
  per-id matched/unmatched/missing signal. **iOS-15 must not change its
  semantics** — it only projects it into per-row view values.
- `LocalDraftRestorePlan { orderedExerciseIds, completedSetsByExerciseId,
  resumeExerciseIndex }` — supplies the remapped resume cursor for the resume
  affordance.
- `LocalCompletedSessionSnapshot` exercise rows carry `exerciseId`, `name`,
  `completedSets`, `targetSets`; the snapshot carries `scenarioId`,
  `scenarioLabel`, `sessionIntent`, `createdAtIso`, `resumeExerciseIndex`,
  `totalCompletedSets`, `totalTargetSets`.
- `LocalSnapshotHistory.grouped(_:now:calendar:)` and
  `.filtered(_:query:scenarioId:completedOnly:)`, plus the UTC-pinned
  `utcCalendar` and the internal ISO-8601 `parseDate` approach — the date-range
  filter reuses the same parsing + UTC calendar discipline.

## Detail design — per-exercise recovery insight (pure)

New **pure, IO-free** projection in the `IronPathLocalSnapshot` package (new source
file, e.g. `LocalSnapshotRecovery.swift`), built on top of `reconcile`:

```
public enum LocalRecoveryStatus: Equatable {
    case restorable     // saved exercise still exists in the current scenario
    case changed        // saved exercise no longer in the current scenario (renamed/removed)
}

public struct LocalSnapshotRecoveryRow: Equatable {
    public let exerciseId: String
    public let name: String
    public let completedSets: Int
    public let targetSets: Int
    public let status: LocalRecoveryStatus
}

public struct LocalSnapshotRecoveryInsight: Equatable {
    public let rows: [LocalSnapshotRecoveryRow]   // saved exercises, saved order
    public let newCurrentExerciseIds: [String]    // current exercises absent from the snapshot
    public let resumeExerciseIndex: Int?          // remapped into current order (nil if nothing restorable)
    public var hasDrift: Bool                      // any changed row OR any new current exercise
}

public enum LocalSnapshotRecovery {
    public static func insight(
        from snapshot: LocalCompletedSessionSnapshot,
        currentExerciseIds: [String]
    ) -> LocalSnapshotRecoveryInsight   // pure; never touches disk/AppData/engine
}
```

Rules:

- The projection **derives entirely** from `reconcile(...)`'s output; `restorable`
  ⇔ id ∈ `matchedExerciseIds`, `changed` ⇔ id ∈ `unmatchedSnapshotIds`,
  `newCurrentExerciseIds` = `missingCurrentIds`. Saved order is preserved.
- It **applies no progress and mutates nothing** — it is a read-only view for the
  detail sheet. Restore still happens only through the existing
  `restoreDraft` path.
- If `reconcile` fails (empty / impossible progress), `insight` returns a row set
  flagged so the UI shows an honest "this saved session can't be continued"
  state — never a fake/partial restore preview.
- Pure: no clock, no disk, no network. Fully unit-tested.

## Detail design — date-range filter (pure)

Add a coarse, local-only date-range filter to `LocalSnapshotHistory` (extend the
existing `filtered(...)` with an optional `dateRange` parameter, or add a sibling
pure helper `inRange(_:from:to:calendar:)`):

- Ranges are coarse and computed against an **injected `now`** + the existing
  UTC-pinned calendar: `全部` (no bound), `最近 7 天`, `最近 30 天` (calendar-day
  spans, consistent with `grouped`).
- Reuses the same ISO-8601 parsing as `grouped`; **unparseable timestamps are
  excluded from a bounded range but never crash and are never silently dropped
  from `全部`.**
- Pure; preserves input order (the view groups afterwards). Composes with the
  existing `query` / `scenarioId` / `completedOnly` filters — order of
  application is documented and tested. No database, no index, no network.

## Detail design — resume affordance (thin UI over existing restore)

- The snapshot already carries `resumeExerciseIndex`; `reconcile`/`plan` already
  remap it into the **current** scenario order. The detail sheet shows a small,
  short label `上次练到第 N / 总 个动作：<name>` using that remapped cursor.
- A `从这里继续` action calls the **existing** `FocusModeMvpState.restoreDraft`
  flow (matched-only counts, clamped resume cursor). **No new restore semantics,
  no new disk path.** A failed restore leaves the current in-memory session
  untouched (no fake success); the existing in-session restored-draft drift
  banner still applies.
- If nothing is restorable (all `changed`), the affordance degrades to an honest
  empty/disabled state with one clear explanation — no misleading "continue".

## Thin app-layer changes (render + wiring only)

No business logic enters the app layer; all of it is delegated to the package.

- `FocusSavedSessionDetailView` — add a per-exercise recovery section (row: name,
  `completed/target` sets, a **short** status badge `可恢复` / `已变更`), a
  one-line drift note when `hasDrift`, a compact "新动作（本机无进度）" list for
  `newCurrentExerciseIds`, and the resume affordance. Keep exercise metadata
  collapsed per the AGENTS UI rules; badges stay short; keep the existing
  `schema v{N}` badge, restore-eligibility label, and local-only label.
- `FocusSavedSessionHistoryView` — add the coarse date-range control
  (`全部 / 最近 7 天 / 最近 30 天`) feeding the pure filter, composed with the
  existing search field + scenario + completed-only filters. Empty state keeps a
  title + explanation + one action.
- `FocusModeMvpState` — expose the current scenario's exercise ids for the open
  snapshot (already derivable from the active scenario/slice) so the detail view
  can call `LocalSnapshotRecovery.insight`, and hold the selected date-range as
  in-RAM UI state. **No new disk IO, no new restore semantics, deterministic
  clock stays the default** (`useSystemClock()` remains the single launch-time
  opt-in).

## Safety boundaries (re-locked)

- **Pure logic in the leaf package** (`IronPathLocalSnapshot`, Foundation-only);
  the app stays a thin renderer (§5, §15, §19).
- **Restore stays an in-memory draft (§13).** Recovery insight is read-only
  presentation; the resume action reuses the existing `restoreDraft` (matched-only,
  no fake success). This bundle does **not** touch the §14 full-AppData-restore
  gate.
- **`IronPathLocalSnapshot` stays decoupled from `IronPathDomain`/AppData**
  (§6.3, §8, §12). The recovery insight consumes a snapshot + a plain
  `[String]` of current exercise ids — never AppData. The history store remains
  the only disk-touching code.
- **Local-only.** No iCloud/CloudKit/ubiquity, no `IronPathCloudSync`, no
  HealthKit, no Supabase, no `URLSession`/network, no WebKit, no `UserDefaults`,
  no SQLite/CoreData/SwiftData. `iosLocalJsonPersistenceStaticGuards` stays green
  (§22).
- **Determinism.** The date-range filter takes an injected `now` + UTC-pinned
  calendar; package tests/previews stay reproducible. The running app keeps using
  the real wall-clock via the existing single opt-in.
- **No engine output change** → **no parity-golden regeneration**;
  `TrainingDecision` is untouched; `iOS-4B6` user-facing arbitration trace stays
  deferred.
- **No stub package touched**; no `project.pbxproj` change (no new *app* files);
  `package.json` / `package-lock.json` byte-identical.

## Non-goals (deferred)

- **Full AppData restore** — deferred behind the DataHealth ingress /
  `buildCleanAppDataView` clean-input contract (§14). iOS-15 only makes the
  *existing* in-memory draft restore more transparent.
- No set-by-set timeline, no analytics/charts, no calendar app.
- No fuzzy search; no custom from/to date picker (coarse ranges only — a custom
  range is a possible iOS-16 stretch).
- No snapshot editing/deletion.
- **`iOS-4B6`** (userFacing / full `arbitrationTrace`) — deferred / parallel.

## Validation

This is a **Swift + docs** change → §21.1 (CI / TypeScript) **and** §21.2 (local
Swift) both apply. No TS source changes, so no parity-golden regeneration.

```bash
# TypeScript / CI parity (run locally for confidence; no TS source changed):
npm run api:dev:build
npm run typecheck
npm test
npm run build
git diff --check                 # no whitespace/conflict markers
# package.json + package-lock.json MUST be byte-identical

# Swift (mandatory, local — CI does not build/test Swift):
cd ios/packages/IronPathLocalSnapshot && swift test   # existing 33 + new recovery-insight & date-range tests
# (sanity) the other 9 packages remain green:
#   for p in IronPathDomain IronPathDataHealth IronPathTrainingDecision \
#            IronPathPersistence IronPathL10n IronPathHealthKit \
#            IronPathCloudSync IronPathBackup IronPathUIKit; do
#     (cd ios/packages/$p && swift test); done

# App build (both destinations):
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' build
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

New package tests to add (pure, deterministic) — at minimum:

- recovery insight: all-matched (no drift), partial drift (some `changed` +
  some new current), all-`changed` (nothing restorable), empty/impossible
  snapshot (honest non-restorable), saved-order preservation, resume-index
  remap into current order.
- date-range filter: `全部` keeps all (incl. unparseable), `最近 7 天` /
  `最近 30 天` calendar-day boundaries with injected `now`, unparseable excluded
  from bounded ranges but never crash, composition with query/scenario/
  completed-only, order preserved.

## Manual Simulator smoke checklist

1. Open a saved session detail → each exercise row shows `可恢复` / `已变更`
   correctly; metadata stays collapsed; badges are short.
2. A snapshot whose scenario drifted shows `已变更` rows + a `新动作（本机无进度）`
   list honestly; no crash.
3. Resume affordance shows `上次练到第 N / 总 个动作：<name>` using the remapped
   cursor; `从这里继续` restores an in-RAM draft (matched-only); a forced failure
   leaves the current session untouched (no fake restore); the drift banner still
   appears on drift.
4. When nothing is restorable, the resume affordance degrades to an honest
   disabled/empty state.
5. Date-range control (`全部 / 最近 7 天 / 最近 30 天`) filters correctly and
   composes with search + scenario + completed-only; empty state intact.
6. Determinism: previews/tests stable (deterministic clock); the running app uses
   real timestamps.
7. No cloud/network/auth prompts anywhere; no crash on invalid/unsupported
   snapshots.

## Remaining risks

- The recovery insight depends on the caller supplying the **current** scenario's
  exercise ids; if the app passes stale ids the labels would mislead. Mitigation:
  derive ids from the same scenario/slice the detail sheet is rendering, and unit
  test the projection against fixed id sets.
- Coarse date ranges (calendar-day spans) can surprise across time zones; the
  UTC-pinned calendar keeps it consistent with existing grouping — documented and
  tested with injected `now`.
- Substring search + coarse ranges only; fine for a small local list.

## Next recommended task

**iOS-16 (proposed)** — optional custom from/to date-range picker on history, and
a small per-exercise "last set summary" in the detail row (still pure, still
local-first, still derived from existing snapshot fields). `iOS-4B6` and full
AppData restore remain deferred behind their gates (§14, §17).

---

## Appendix — §25 Future Task Prompt Template (filled)

```markdown
## Task: iOS-15 Local History Detail + Per-Exercise Recovery Insight V1

**Baseline commit:** a890c89  (latest origin/main; iOS-14 baseline 64f37e7 + master-architecture doc)
**Goal:** Show, per exercise in the saved-session detail sheet, what a restore would/would not bring back; add a coarse date-range history filter; add an honest "resume where you left off" affordance.
**Scope:** One vertical slice — a pure recovery-insight projection + a pure date-range filter in IronPathLocalSnapshot, rendered by the thin SwiftUI detail/history views. No new restore semantics.

**Allowed files / systems:**
- ios/packages/IronPathLocalSnapshot/**            (new pure LocalSnapshotRecovery + date-range filter + tests)
- ios/IronPath/FocusSavedSessionDetailView.swift   (render only)
- ios/IronPath/FocusSavedSessionHistoryView.swift  (render only)
- ios/IronPath/FocusModeMvpState.swift             (wiring/in-RAM UI state only; no new IO)
- docs/ios-native-migration/**

**Forbidden files / systems:**
- project.pbxproj (no new app Swift files; SPM picks up new package files)
- package.json / package-lock.json
- Any stub package (HealthKit/CloudSync/Backup/UIKit)
- CloudKit/iCloud/Supabase/HealthKit/URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData
- IronPathDomain/AppData coupling into IronPathLocalSnapshot

**Source-of-truth impact:** none.
**Data safety impact:** Restore stays an in-memory draft (§13) — recovery insight is read-only; resume reuses the existing restoreDraft (matched-only, no fake success). No open-bag/schema/timestamp change. LocalSnapshot stays decoupled from AppData. No full-restore gate (§14) work.

**Validation commands:**
- npm run typecheck && npm test && npm run build ; git diff --check
- swift test for ios/packages/IronPathLocalSnapshot (+ sanity on the other 9)
- xcodebuild generic + iPhone 17 Pro
- No parity-golden regeneration (engine output unchanged)

**PR & merge rules:**
- Branch from latest origin/main (no worktree); never commit to main  → branch: ios-15-local-history-detail-per-exercise-recovery-insight
- Open PR; wait for required checks; auto-merge (squash) only if checks pass & protection allows normally
- No --admin; no branch-protection bypass

**Cleanup rules:**
- Commit only intended files (NOT .claude/*); delete branch after squash merge; leave repo clean
```
