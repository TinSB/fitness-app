// CompletedTrainingTimelineFilter — 记录 (History) search + source filter V1.
//
// Pure, IO-free, order-PRESERVING filtering over the unified completed-training
// timeline (`CompletedTrainingTimeline`, the #439 unified read-for-display model).
// The 记录 surface feeds a text query + a source segment and renders the filtered
// timeline; when nothing matches it shows an honest "没有匹配的记录" state. This is
// the SAME pure-filter discipline `RedeLocalSnapshot.LocalSnapshotHistory.filtered`
// already carries for the (separate) LocalSnapshot history surface — mirrored here for
// the unified timeline. The two stay DECOUPLED: this is a fresh Domain leaf type, NOT
// a reuse of the LocalSnapshot enums (no `RedeLocalSnapshot` import, §12).
//
// 100% pure value logic — NO IO, NO ambient clock, NO AppData, NO mutation, and NO
// Date (AppData instants are ISO-8601 strings end-to-end, §9; the leaf never types a
// `Date`). Foundation only, for the String case-folding/trim the query needs (Domain
// is the leaf, §6.3). Read-only: the filter only SELECTS which already-resolved rows
// to show; it never reorders, edits, or fabricates a row.

import Foundation

/// The source segment for the unified timeline filter: 全部 / 原生 / 来自 Apple 健康.
public enum CompletedTrainingSourceFilter: String, CaseIterable, Hashable, Sendable {
    /// 全部 — every row, regardless of origin.
    case all
    /// 原生 — only native completed sessions.
    case native
    /// 来自 Apple 健康 — only DERIVED Apple-Health-imported workouts.
    case appleHealth

    /// Chinese-first control label (matches the row tags the surface renders).
    public var title: String {
        switch self {
        case .all: return "全部"
        case .native: return "原生"
        case .appleHealth: return "来自 Apple 健康"
        }
    }

    /// Whether this segment admits a row of the given origin. `.all` admits every row.
    public func admits(_ source: CompletedTrainingSource) -> Bool {
        switch self {
        case .all: return true
        case .native: return source == .native
        case .appleHealth: return source == .appleHealth
        }
    }
}

extension CompletedTrainingTimeline {

    /// Lightweight, local-only filter/search over the unified timeline. `query`
    /// matches (case-insensitively, whitespace-trimmed) a row's `searchableText` —
    /// the origin label (来源标签) plus a native session's exercise names (动作名) or
    /// an imported workout's type; `source` keeps only that origin (全部 keeps both).
    /// Both filters COMPOSE (logical AND); each defaults to a no-op, so `filtered()`
    /// returns the timeline unchanged. Pure; PRESERVES input order (most-recent-first
    /// is already baked in by `make`). No database, no search index, no network, no
    /// ambient clock, no Date.
    public func filtered(
        query: String = "",
        source: CompletedTrainingSourceFilter = .all
    ) -> CompletedTrainingTimeline {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let kept = entries.filter { entry in
            guard source.admits(entry.source) else { return false }
            if !q.isEmpty, !entry.searchableText.lowercased().contains(q) { return false }
            return true
        }
        return CompletedTrainingTimeline(entries: kept)
    }
}
