// SavedSessionSetDisplayProjection — DEEP-EDIT-1 display-from-canonical V1.
//
// The pure, IO-free read-side resolver that backs the 记录 (History) saved-session
// detail's per-set "上次成绩" values. It is the read companion to the Today (#437),
// Profile (#438), History (#439), and Plan (#440) read-for-display paths and lives
// here in DataHealth — the owner of the `CleanAppDataView` (§10) the canonical read
// routes through — keeping the import graph a DAG (`DataHealth → Domain` only; NO
// edge to `RedeLocalSnapshot`).
//
// === why canonical-FIRST (DEEP-EDIT-1 follow-up) ===
// DEEP-EDIT-1 lets the user correct ONE logged set's 重量/次数/RIR in place inside
// canonical `AppData.history[].exercises[].sets[]` (the source of truth, §8) through
// the sanctioned gated write. The LocalSnapshot `setLogs` is only a DERIVED display
// copy written ALONGSIDE the canonical record (§12) — it is NOT rewritten by a later
// correction, so reading it back would show a STALE (pre-correction) value after a
// cold start. This resolver therefore prefers the CANONICAL value for any set that
// reached `history` (matched by session id == snapshotId / exercise id / setIndex —
// the exact identity the DEEP-EDIT-1 write locates), so a correction shows up
// PERSISTENTLY (cold start too); a set with no canonical counterpart (a snapshot-only
// / legacy session, which is inherently uneditable) honestly falls back to the
// LocalSnapshot copy. The in-RAM display override the detail UI used before is no
// longer needed for persistence.
//
// === why a neutral `SavedSessionSetFallback` (no LocalSnapshot dependency) ===
// The fallback is the LocalSnapshot display copy, but this resolver takes it as a
// NEUTRAL value the thin app layer translates from `LocalCompletedSetEntrySnapshot`,
// so this DataHealth leaf needs no `RedeLocalSnapshot` import — the two packages
// stay decoupled (§12), and the match is done HERE in DataHealth, never in the
// snapshot store (the snapshot never reads canonical AppData). Mirrors exactly how
// `CompletedTrainingTimeline` takes a neutral `SupplementalNativeCompletion`.
//
// 100% pure value logic — NO IO, NO clock, NO AppData mutation. The thin app loader
// supplies the DataHealth-CLEANED `[TrainingSession]` (already routed through the
// genuine `buildCleanAppDataView`, the §10 chokepoint); this resolver only SELECTS,
// per set, the canonical-or-fallback metrics. Read-only: it never writes anything.

import Foundation
import RedeDomain

/// Identity of one logged set inside a saved session, as the 记录 saved-session detail
/// projects it: the exercise id + the stored 0-based set index. The lookup key for the
/// resolved per-set display values below.
public struct SavedSessionSetKey: Hashable, Sendable {
    public let exerciseId: String
    public let setIndex: Int

    public init(exerciseId: String, setIndex: Int) {
        self.exerciseId = exerciseId
        self.setIndex = setIndex
    }
}

/// The resolved per-set DISPLAY metrics (重量 kg / 次数 / RIR) one detail row renders.
/// Weight is kilograms (the storage unit; the UI converts to the display unit at render
/// time). Every metric is optional so a blank field stays an honest "not entered" —
/// never a fabricated 0.
public struct SavedSessionSetDisplayValue: Equatable, Sendable {
    public let weightKg: Double?
    public let reps: Int?
    public let rir: Int?

    public init(weightKg: Double?, reps: Int?, rir: Int?) {
        self.weightKg = weightKg
        self.reps = reps
        self.rir = rir
    }
}

/// A neutral per-set fallback the thin app layer translates from the LocalSnapshot
/// display copy (`LocalCompletedSetEntrySnapshot`). NEUTRAL so this resolver needs no
/// `RedeLocalSnapshot` import (the snapshot store stays decoupled from canonical
/// AppData, §12). Mirrors `SupplementalNativeCompletion`.
public struct SavedSessionSetFallback: Equatable, Sendable {
    public let exerciseId: String
    public let setIndex: Int
    public let weightKg: Double?
    public let reps: Int?
    public let rir: Int?

    public init(exerciseId: String, setIndex: Int, weightKg: Double?, reps: Int?, rir: Int?) {
        self.exerciseId = exerciseId
        self.setIndex = setIndex
        self.weightKg = weightKg
        self.reps = reps
        self.rir = rir
    }
}

/// Pure projection: the per-set DISPLAY values for ONE saved session, CANONICAL-FIRST.
///
/// For each `snapshotFallbacks` set, if the cleaned `canonicalHistory` has a session
/// whose `id == snapshotId` AND an exercise matching `exerciseId` (by `id` OR
/// `exerciseId`) AND a set with the stored `setIndex`, the resolved value is that
/// CANONICAL set's metrics (`weight` kg / `reps` / `rir`) — i.e. the DEEP-EDIT-1
/// correction, which therefore persists across a cold start. Otherwise (no canonical
/// session — a snapshot-only / legacy session — or the canonical session lacks that
/// exercise/set) the value honestly falls back to the LocalSnapshot copy.
///
/// The result covers EXACTLY the supplied fallback sets (one entry per fallback), keyed
/// by `SavedSessionSetKey`, so the detail row always finds a value. Honest by
/// construction: an empty `canonicalHistory` (missing / first-launch / unreadable
/// document the loader collapsed to `[]`) yields the fallbacks unchanged — never a
/// fabricated row, never a crash.
public func resolveSavedSessionSetDisplay(
    snapshotId: String,
    canonicalHistory: [TrainingSession],
    snapshotFallbacks: [SavedSessionSetFallback]
) -> [SavedSessionSetKey: SavedSessionSetDisplayValue] {
    // The canonical session for this saved snapshot, if it reached canonical history
    // (a native session logged WITH per-set detail). nil → a snapshot-only / legacy
    // session: inherently uneditable, so every set falls back to the LocalSnapshot copy.
    let session = canonicalHistory.first { $0.id == snapshotId }

    var result: [SavedSessionSetKey: SavedSessionSetDisplayValue] = [:]
    result.reserveCapacity(snapshotFallbacks.count)
    for fallback in snapshotFallbacks {
        let key = SavedSessionSetKey(exerciseId: fallback.exerciseId, setIndex: fallback.setIndex)
        if let canonical = canonicalSet(in: session, exerciseId: fallback.exerciseId, setIndex: fallback.setIndex) {
            // Canonical has this set → show its (possibly DEEP-EDIT-1-corrected) metrics,
            // read with the SAME accessors the DEEP-EDIT-1 write gate verifies against.
            result[key] = SavedSessionSetDisplayValue(
                weightKg: canonical.weight?.doubleValue,
                reps: canonical.reps?.intValue,
                rir: canonical.rir?.intValue
            )
        } else {
            // No canonical counterpart → honest fall back to the LocalSnapshot copy.
            result[key] = SavedSessionSetDisplayValue(
                weightKg: fallback.weightKg,
                reps: fallback.reps,
                rir: fallback.rir
            )
        }
    }
    return result
}

/// The canonical logged set matching the saved-session detail's identity: the FIRST
/// exercise whose `id` OR `exerciseId == exerciseId`, then the set whose stored
/// `setIndex == setIndex` — the exact lookup `AppData.withUpdatedHistorySet` and the
/// DEEP-EDIT-1 write gate use. nil when `session` is nil or has no such exercise/set.
private func canonicalSet(in session: TrainingSession?, exerciseId: String, setIndex: Int) -> TrainingSetLog? {
    guard let session,
          let exercise = (session.exercises ?? []).first(where: {
              $0.id == exerciseId || $0.exerciseId == exerciseId
          }),
          let set = (exercise.sets ?? []).first(where: { $0.setIndex?.intValue == setIndex })
    else { return nil }
    return set
}
