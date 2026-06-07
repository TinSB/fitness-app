// CompletedTrainingTimeline — History real-AppData read path V1.
//
// Pure, deterministic read-model for the 记录 (History) surface: ONE unified,
// most-recent-first list of the user's REAL completed training, merged from two
// honest sources and tagged by origin:
//   • NATIVE completed sessions — the canonical `AppData.history` records (the §8
//     source of truth), supplied here as the DataHealth-CLEANED `[TrainingSession]`.
//   • Apple-Health IMPORTS — the DERIVED, display-only `importedWorkoutSamples`
//     (HK-2). These are NEVER canonical training and NEVER engine input (§8.2);
//     here they are listed and tagged "来自 Apple 健康", nothing more.
//
// === why a neutral `SupplementalNativeCompletion` (no LocalSnapshot dependency) ===
// A native session completed WITHOUT per-set detail is saved ONLY to the local
// Focus snapshot store (`IronPathLocalSnapshot`), never to canonical `history`:
// `FocusModeMvpState.persistCanonicalSession` returns `.skipped` when nothing was
// logged per-set. To lose NOTHING in the unified timeline, the caller may supply
// those snapshot-only completions as neutral `SupplementalNativeCompletion` values.
// They are merged in and DEDUPED BY ID against the canonical natives — the
// canonical record always wins (it is the source of truth), so a session that IS
// in canonical `history` is shown ONCE, from canonical (no duplicate rows). The
// neutral value keeps this Domain leaf — and the DataHealth layer above it — FREE
// of any `IronPathLocalSnapshot` import: the two packages stay decoupled (§12);
// only the thin app layer reads both stores and feeds this builder.
//
// 100% pure value logic — NO IO, NO clock, NO AppData mutation. Foundation-only
// (Domain is the leaf, §6.3). The thin SwiftUI surface formats each row (timestamp,
// the Apple-Health workout label via IronPathHealthKit); this type only SELECTS
// which real records to show, in what order, with which source tag.

import Foundation

/// Origin tag for one unified timeline row.
public enum CompletedTrainingSource: String, Equatable, Sendable {
    /// A native IronPath completed session — the canonical `history` record, or a
    /// snapshot-only completion with no canonical counterpart. Rendered "原生".
    case native
    /// An Apple-Health-imported workout (`importedWorkoutSamples`). DERIVED /
    /// display-only — never a canonical session, never engine input. Rendered
    /// "来自 Apple 健康".
    case appleHealth

    /// The Chinese-first origin label the surface renders — and the 来源标签 search
    /// target of the History text search (the 记录 search + source filter slice).
    public var displayLabel: String {
        switch self {
        case .native: return "原生"
        case .appleHealth: return "来自 Apple 健康"
        }
    }
}

/// A native completed session reduced to the fields the timeline row renders.
public struct NativeCompletedTraining: Equatable, Sendable {
    /// Canonical session id (== the local snapshot id for natively-logged sessions).
    /// Used for the unified ordering's identity and for dedup. May be nil.
    public let id: String?
    /// The instant the session finished, ISO-8601 (sort + display). nil → sorts last.
    public let occurredAtIso: String?
    /// Number of performed exercises recorded.
    public let exerciseCount: Int
    /// Number of performed sets recorded.
    public let performedSetCount: Int
    /// The performed exercise names — the 动作名 search target only (NOT used for
    /// counts or ordering). Empty when the source carried none. Defaulted so the
    /// only constructor (the builder below) is the sole place that populates it.
    public let exerciseNames: [String]

    public init(
        id: String?,
        occurredAtIso: String?,
        exerciseCount: Int,
        performedSetCount: Int,
        exerciseNames: [String] = []
    ) {
        self.id = id
        self.occurredAtIso = occurredAtIso
        self.exerciseCount = exerciseCount
        self.performedSetCount = performedSetCount
        self.exerciseNames = exerciseNames
    }
}

/// A native completion supplied from OUTSIDE canonical `history` (e.g. the local
/// Focus snapshot store), so the unified timeline loses nothing. Deduped by `id`
/// against the canonical natives — canonical always wins. A NEUTRAL value so this
/// Domain leaf needs no `IronPathLocalSnapshot` import (the two stay decoupled).
public struct SupplementalNativeCompletion: Equatable, Sendable {
    public let id: String?
    public let occurredAtIso: String?
    public let exerciseCount: Int
    public let performedSetCount: Int
    /// The performed exercise names from the snapshot-only completion (the 动作名
    /// search target). Defaulted empty so existing callers/tests are unaffected;
    /// the thin app layer supplies them from the local Focus snapshot read-only.
    public let exerciseNames: [String]

    public init(
        id: String?,
        occurredAtIso: String?,
        exerciseCount: Int,
        performedSetCount: Int,
        exerciseNames: [String] = []
    ) {
        self.id = id
        self.occurredAtIso = occurredAtIso
        self.exerciseCount = exerciseCount
        self.performedSetCount = performedSetCount
        self.exerciseNames = exerciseNames
    }
}

/// One row of the unified completed-training timeline.
public enum CompletedTrainingEntry: Equatable, Sendable {
    /// A native completed session (canonical or snapshot-only). Tagged "原生".
    case native(NativeCompletedTraining)
    /// A DERIVED Apple-Health-imported workout. Tagged "来自 Apple 健康".
    case imported(ImportedWorkoutSample)

    /// The instant used for the unified ordering (and row display). Native: the
    /// already-resolved `finishedAt ?? date ?? startedAt`. Imported:
    /// `startDate ?? endDate ?? importedAt`. nil → sorts last.
    public var occurredAtIso: String? {
        switch self {
        case .native(let native):
            return native.occurredAtIso
        case .imported(let workout):
            return workout.startDate ?? workout.endDate ?? workout.importedAt
        }
    }

    /// The origin tag the surface renders.
    public var source: CompletedTrainingSource {
        switch self {
        case .native:
            return .native
        case .imported:
            return .appleHealth
        }
    }

    /// The case-insensitive search target for this row (记录 search + source filter):
    /// the origin label (来源标签) PLUS the row's own text — a native session's
    /// exercise names (动作名), or an imported workout's raw type. Newline-joined so a
    /// query never matches across two fields; empty parts dropped. Pure, display-only.
    public var searchableText: String {
        var parts: [String] = [source.displayLabel]
        switch self {
        case .native(let native):
            parts.append(contentsOf: native.exerciseNames)
        case .imported(let workout):
            if let type = workout.workoutType { parts.append(type) }
        }
        return parts.filter { !$0.isEmpty }.joined(separator: "\n")
    }
}

/// The resolved unified timeline the 记录 surface renders verbatim.
public struct CompletedTrainingTimeline: Equatable, Sendable {
    /// Most-recent-first; rows with no timestamp sort LAST. The order is STABLE for
    /// equal timestamps (deterministic across reads).
    public let entries: [CompletedTrainingEntry]

    public init(entries: [CompletedTrainingEntry]) {
        self.entries = entries
    }

    /// True when there is no completed training at all (the honest empty signal).
    public var isEmpty: Bool { entries.isEmpty }

    /// Build the unified timeline. `canonicalHistory` is the DataHealth-CLEANED
    /// `history`; only COMPLETED sessions are listed. `supplementalNatives` are
    /// native completions from OUTSIDE canonical `history` (snapshot-only), merged
    /// in and DEDUPED BY ID — a supplemental whose id already appears in canonical
    /// is dropped (canonical, the source of truth, wins → no duplicate rows).
    /// `importedWorkouts` are the derived Apple-Health summaries: all listed and
    /// tagged. The result is sorted most-recent-first, stably.
    public static func make(
        canonicalHistory: [TrainingSession],
        supplementalNatives: [SupplementalNativeCompletion],
        importedWorkouts: [ImportedWorkoutSample]
    ) -> CompletedTrainingTimeline {
        var entries: [CompletedTrainingEntry] = []
        var canonicalIds = Set<String>()

        for session in canonicalHistory where isCompleted(session) {
            if let id = session.id { canonicalIds.insert(id) }
            entries.append(.native(NativeCompletedTraining(
                id: session.id,
                occurredAtIso: session.finishedAt ?? session.date ?? session.startedAt,
                exerciseCount: (session.exercises ?? []).count,
                performedSetCount: (session.exercises ?? []).reduce(0) { $0 + ($1.sets?.count ?? 0) },
                exerciseNames: (session.exercises ?? []).compactMap(\.name).filter { !$0.isEmpty }
            )))
        }

        for supplemental in supplementalNatives {
            // Dedup: a supplemental that IS the canonical record is shown once, from
            // canonical (the source of truth). A nil id cannot collide, so it is kept.
            if let id = supplemental.id, canonicalIds.contains(id) { continue }
            entries.append(.native(NativeCompletedTraining(
                id: supplemental.id,
                occurredAtIso: supplemental.occurredAtIso,
                exerciseCount: supplemental.exerciseCount,
                performedSetCount: supplemental.performedSetCount,
                exerciseNames: supplemental.exerciseNames
            )))
        }

        for workout in importedWorkouts {
            entries.append(.imported(workout))
        }

        return CompletedTrainingTimeline(entries: sortedMostRecentFirst(entries))
    }

    /// A session counts as completed training when it is flagged complete (the
    /// native builder sets both; a legacy-web-origin session sets `completed`).
    public static func isCompleted(_ session: TrainingSession) -> Bool {
        (session.completed ?? false) || (session.focusSessionComplete ?? false)
    }

    /// Stable descending sort by `occurredAtIso` (ISO-8601 strings sort lexically =
    /// chronologically — the same string ordering the latest-body-weight derivation
    /// already relies on). nil timestamps sort LAST; equal keys keep input order
    /// (the enumerated-offset tie-break makes this deterministic, since Swift's
    /// `sorted(by:)` is not guaranteed stable).
    private static func sortedMostRecentFirst(_ entries: [CompletedTrainingEntry]) -> [CompletedTrainingEntry] {
        entries.enumerated().sorted { lhs, rhs in
            switch (lhs.element.occurredAtIso, rhs.element.occurredAtIso) {
            case let (left?, right?):
                if left != right { return left > right }
                return lhs.offset < rhs.offset
            case (_?, nil):
                return true
            case (nil, _?):
                return false
            case (nil, nil):
                return lhs.offset < rhs.offset
            }
        }.map(\.element)
    }
}
