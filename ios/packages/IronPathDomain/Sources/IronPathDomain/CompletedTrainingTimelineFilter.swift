// CompletedTrainingTimelineFilter — 记录 (History) search + source filter V1.
//
// Pure, IO-free, order-PRESERVING filtering over the unified completed-training
// timeline (`CompletedTrainingTimeline`, the #439 unified read-for-display model).
// The 记录 surface feeds a text query + a source segment (+ an optional coarse date
// range) and renders the filtered timeline; when nothing matches it shows an honest
// "没有匹配的记录" state. This is the SAME pure-filter discipline
// `IronPathLocalSnapshot.LocalSnapshotHistory.filtered` already carries for the
// (separate) LocalSnapshot history surface — mirrored here for the unified timeline.
// The two stay DECOUPLED: this is a fresh Domain leaf type, NOT a reuse of the
// LocalSnapshot enums (no `IronPathLocalSnapshot` import, §12).
//
// 100% pure value logic — NO IO, NO ambient clock (the date range takes an INJECTED
// `now`; `.all` / a nil clock never drops a row), NO AppData, NO mutation. Foundation
// only (Domain is the leaf, §6.3). Read-only: the filter only SELECTS which already-
// resolved rows to show; it never reorders, edits, or fabricates a row.

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

/// A coarse, local-only date range for the unified timeline filter, mirroring
/// `LocalHistoryDateRange` (kept as a SEPARATE Domain type so this leaf needs no
/// `IronPathLocalSnapshot` import — the packages stay decoupled, §12).
public enum CompletedTrainingDateRange: String, CaseIterable, Hashable, Sendable {
    /// 全部 — unbounded (keeps every row, including undated / unparseable ones).
    case all
    /// 最近 7 天 — inclusive 7-calendar-day span ending at the injected `now`.
    case last7Days
    /// 最近 30 天 — inclusive 30-calendar-day span ending at the injected `now`.
    case last30Days

    /// Chinese-first control label.
    public var title: String {
        switch self {
        case .all: return "全部"
        case .last7Days: return "最近 7 天"
        case .last30Days: return "最近 30 天"
        }
    }

    /// Inclusive calendar-day bound (days ago); nil for `.all` (unbounded).
    var dayBound: Int? {
        switch self {
        case .all: return nil
        case .last7Days: return 7
        case .last30Days: return 30
        }
    }
}

extension CompletedTrainingTimeline {

    /// UTC-pinned calendar so the date buckets agree with the UTC timestamps the
    /// timeline carries + the UTC labels the surface renders (mirrors
    /// `LocalSnapshotHistory.utcCalendar`).
    public static let utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    /// Lightweight, local-only filter/search over the unified timeline. `query`
    /// matches (case-insensitively, whitespace-trimmed) a row's `searchableText` —
    /// the origin label (来源标签) plus a native session's exercise names (动作名) or
    /// an imported workout's type; `source` keeps only that origin (全部 keeps both);
    /// `dateRange` keeps only rows within a coarse, calendar-day span measured against
    /// the INJECTED `now`. All filters COMPOSE (logical AND); each defaults to a
    /// no-op, so `filtered()` returns the timeline unchanged. Pure; PRESERVES input
    /// order (most-recent-first is already baked in by `make`). No database, no search
    /// index, no network, no ambient clock.
    public func filtered(
        query: String = "",
        source: CompletedTrainingSourceFilter = .all,
        dateRange: CompletedTrainingDateRange = .all,
        now: Date? = nil,
        calendar: Calendar = CompletedTrainingTimeline.utcCalendar
    ) -> CompletedTrainingTimeline {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let kept = entries.filter { entry in
            guard source.admits(entry.source) else { return false }
            if !q.isEmpty, !entry.searchableText.lowercased().contains(q) { return false }
            return CompletedTrainingTimeline.isWithin(
                entry.occurredAtIso, range: dateRange, now: now, calendar: calendar
            )
        }
        return CompletedTrainingTimeline(entries: kept)
    }

    /// Whether a row's OPTIONAL ISO-8601 instant falls within a coarse date range,
    /// measured in calendar days against an INJECTED `now` (UTC-pinned by default).
    /// `.all` (or a nil `now`) keeps everything — including a nil / unparseable
    /// timestamp — so a missing clock can never silently drop history. A BOUNDED
    /// range parses the timestamp; a nil / UNPARSEABLE timestamp is EXCLUDED from a
    /// bounded range but never crashes (and is never dropped from `.all`). A
    /// future-dated row (days < 0) is outside any "last N days" range. Mirrors
    /// `LocalSnapshotHistory.isWithin`. Exposed for direct unit testing.
    public static func isWithin(
        _ iso: String?,
        range: CompletedTrainingDateRange,
        now: Date?,
        calendar: Calendar = CompletedTrainingTimeline.utcCalendar
    ) -> Bool {
        guard let bound = range.dayBound else { return true }           // .all — unbounded
        guard let now else { return true }                              // no clock — skip date filtering
        guard let iso, let date = parseDate(iso) else { return false }  // nil/unparseable — excluded from bounded range
        let startNow = calendar.startOfDay(for: now)
        let startDate = calendar.startOfDay(for: date)
        guard let days = calendar.dateComponents([.day], from: startDate, to: startNow).day else { return false }
        return days >= 0 && days <= bound
    }

    /// Parse an ISO-8601 instant, tolerating both fractional-second and plain forms
    /// (the same two the surface + `LocalSnapshotHistory` parse). nil when neither
    /// parses — the caller treats that as "excluded from a bounded range".
    static func parseDate(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d }
        let alt = ISO8601DateFormatter()
        alt.formatOptions = [.withInternetDateTime]
        return alt.date(from: iso)
    }
}
