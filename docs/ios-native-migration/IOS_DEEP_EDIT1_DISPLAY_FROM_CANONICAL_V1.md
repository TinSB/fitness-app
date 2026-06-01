# DEEP-EDIT-1 follow-up — saved-session detail per-set values read CANONICAL V1

> **Status: shipped.** A pure, read-only display refinement. No new write path, no
> boundary change, no engine/golden change. Amends the master contract by **one line in
> §27** only (a read-for-display milestone alongside #437–#440); §1–§26 are unchanged.

## 1. Problem

DEEP-EDIT-1 lets the user correct ONE logged set's 重量(weight)/ 次数(reps)/ RIR in
place inside canonical `AppData.history[].exercises[].sets[]` (the source of truth, §8)
through the sanctioned, DataHealth-gated write (`CanonicalSessionWriter.updateHistorySet`).

But the 记录 (History) saved-session detail rendered each set's "上次成绩" from the
**LocalSnapshot `setLogs`** — a DERIVED display copy written ALONGSIDE the canonical
record (§12), and NOT rewritten by a later correction. So after a correction:

- **Same session:** the detail showed the new value only via an **in-RAM override**
  (`@State overrides`) set right after the `.saved` write.
- **After a cold start:** the override was gone, and the row fell back to the **stale**
  LocalSnapshot copy — showing the PRE-correction value. The correction was persisted in
  canonical AppData, but the display had drifted.

## 2. Fix (read-only)

The detail's per-set values now read **CANONICAL-FIRST**: for a set that reached canonical
`history`, show the authoritative (corrected) metrics from `AppData.history`; for a set
with no canonical counterpart (a snapshot-only / legacy session, which is inherently
uneditable), fall back to the LocalSnapshot copy. A correction therefore shows up
**persistently** (cold start too), and the in-RAM value override is no longer needed.

This reuses the established **read-for-display** shape (Today #437 / Profile #438 /
History #439 / Plan #440): the thin app layer loads the canonical document, routes it
through DataHealth's clean view (`buildCleanAppDataView`, the §10 chokepoint), and a pure
package projection selects what to render. It is **read-only** — it writes nothing.

## 3. Design

### 3.1 Pure projection (DataHealth) — `SavedSessionSetDisplayProjection.swift`

`resolveSavedSessionSetDisplay(snapshotId:canonicalHistory:snapshotFallbacks:)` →
`[SavedSessionSetKey: SavedSessionSetDisplayValue]`.

For each neutral `SavedSessionSetFallback`, it looks up the canonical session whose
`id == snapshotId`, then the exercise matching `exerciseId` (by `id` OR `exerciseId`),
then the set with the stored `setIndex` — **the exact identity `AppData.withUpdatedHistorySet`
and the DEEP-EDIT-1 write gate use**. On a hit it returns the canonical `weight`(kg) /
`reps` / `rir` (read with the same `NumberRepr`/`JSONValue` accessors the write gate
verifies against); on a miss it returns the fallback. Pure, IO-free, deterministic, **zero
`: Date`**.

Mirrors `HistoryDisplayProjection` / `CompletedTrainingTimeline`: it takes the
DataHealth-CLEANED `[TrainingSession]` plus a **neutral** fallback (the
`SavedSessionSetFallback`, translated by the app layer from `LocalCompletedSetEntrySnapshot`),
so this DataHealth leaf needs **no `IronPathLocalSnapshot` import** — the snapshot store
stays decoupled from canonical AppData (§12), and the match is done here in DataHealth,
never in the snapshot.

Unit-tested by `SavedSessionSetDisplayProjectionTests` (canonical built from JSON and run
through the genuine `buildCleanAppDataView`): canonical-hit shows the corrected value over
the stale snapshot; no-matching-session / empty-history fall back; partial (some sets
canonical, some not); exercise matched by `exerciseId` when `id` differs; an honestly
cleared canonical metric stays `nil` (never fabricated).

### 3.2 App read path (view-model) — `FocusModeMvpState.canonicalSetDisplay(for:)`

Translates the snapshot's `setLogs` into neutral fallbacks, reads the cleaned canonical
history through the SAME read-only DataHealth ingress the edit gate uses
(`processIncomingAppData(..., source: .localStorageLoad, options: allowMutation:false /
allowAutoRepair:false)` → `cleanView.cleanedHistory` — routes through `buildCleanAppDataView`,
§10; read-only options override the source defaults so nothing is mutated/repaired/written),
calls the pure projection, and returns `[exerciseId: [setIndex: LocalCompletedSetEntrySnapshot]]`
using the LocalSnapshot display type the detail row already renders. A nil store /
unreadable / missing document collapses canonical to empty, and the projection then returns
the snapshot fallbacks unchanged (honest, never a crash). The canonical store token stays
funnelled in the view-model — the presentation files carry none.

### 3.3 Detail view — `FocusSavedSessionDetailView`

Injects `loadCanonicalSetDisplay` (the host wires `state.canonicalSetDisplay(for:)`; nil in
previews → snapshot copy). Loads it `.onAppear` and refreshes it after a committed
correction; the row renders `canonicalSetDisplay[exerciseId]?[setIndex] ?? entry`. The
in-RAM value override is removed; a small `correctedKeys` set drives the "已修正" marker for
the current session only (the value itself comes from canonical). The two-step
「编辑→保存」 wiring (`onSaveSet` → `updateLoggedSet`) is **unchanged**.

## 4. Hard lines honored

- **Read-only.** No new write path, no AppData write, no engine/golden change, no schema
  bump. The DEEP-EDIT-1 edit-write path is untouched.
- **LocalSnapshot append-only + decoupled.** The snapshot store is not given an update
  capability and never reads canonical AppData; the match is in the app/DataHealth layer.
  The DataHealth projection takes a neutral fallback — no `IronPathLocalSnapshot` import.
- **`IronPathDomain` source zero `: Date`** (the projection lives in DataHealth and adds no
  `Date`-typed field anywhere).
- **Presentation files stay free of any canonical-store token** — the
  `FocusModeMvpState` / `FocusSavedSession*View` static guards (no bare `AppData`, no
  `buildCleanAppDataView(`) still hold; the read is funnelled through the view-model, which
  already reaches canonical only via the sanctioned package seam.

## 5. Validation

- `npx vitest run tests/ios` — all iOS static guards green (incl. the
  LocalTrainingPersistenceMega / NativeLocalRestore / AppDataSwiftModel guards that lock the
  no-bare-`AppData` / no-`buildCleanAppDataView(` / no-`: Date` invariants).
- `swift test --package-path ios/packages/IronPathDataHealth` — the new
  `SavedSessionSetDisplayProjectionTests` + the existing DataHealth suite green.
- `xcodebuild ... -scheme IronPath ... build` — the app target compiles.

## 6. DoD

- [x] Detail per-set values read canonical-first (corrections persist, cold start correct);
      fall back to LocalSnapshot when no canonical match.
- [x] Pure matching projection with unit tests; zero `: Date`; iOS guards green.
- [x] Read-only; LocalSnapshot append-only + decoupled from AppData; engine/goldens
      untouched.
- [x] Two-step edit→save wiring unchanged.
- [x] No new write path, no boundary change; master contract amended by §27 only.
