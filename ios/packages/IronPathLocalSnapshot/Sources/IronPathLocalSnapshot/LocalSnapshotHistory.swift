// LocalSnapshotHistory — iOS-13 Local History Product Surface + Restore
// Reconciliation V1.
//
// Pure, IO-free grouping of saved snapshots into a small, readable local history
// (Today / Earlier / Older), newest-first within each section. Extracted here so
// the grouping logic carries real unit tests (swift test) and the SwiftUI layer
// stays a thin renderer. NO disk, network, cloud, AppData — just date bucketing
// over the snapshots the store already returned.

import Foundation

/// A coarse, human-readable time bucket for the local history surface.
public enum LocalHistoryGroup: String, Equatable {
    case today      // 今天
    case earlier    // 最近 7 天
    case older      // 更早

    /// Chinese-first section title.
    public var title: String {
        switch self {
        case .today: return "今天"
        case .earlier: return "最近 7 天"
        case .older: return "更早"
        }
    }
}

/// iOS-15: a coarse, local-only date range for filtering the history list.
public enum LocalHistoryDateRange: String, CaseIterable, Equatable {
    case all          // 全部 (no bound)
    case last7Days    // 最近 7 天
    case last30Days   // 最近 30 天

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

/// iOS-16: an explicit, local-only custom date interval for the history filter,
/// complementing the coarse `LocalHistoryDateRange`. `from`/`to` are absolute
/// instants; membership compares CALENDAR DAYS (UTC by default) INCLUSIVELY, so
/// any snapshot whose timestamp lands on `from`'s day through `to`'s day matches.
/// A reversed interval (`from` later than `to`) is NORMALIZED (the two bounds are
/// swapped at compare time) so two independent day pickers can never yield an
/// empty result by ordering alone. Absolute by design — it needs no `now`.
public struct LocalHistoryCustomDateRange: Equatable {
    public let from: Date
    public let to: Date

    public init(from: Date, to: Date) {
        self.from = from
        self.to = to
    }
}

/// One non-empty history section (newest snapshot first).
public struct LocalHistorySection: Equatable {
    public let group: LocalHistoryGroup
    public let snapshots: [LocalCompletedSessionSnapshot]

    public init(group: LocalHistoryGroup, snapshots: [LocalCompletedSessionSnapshot]) {
        self.group = group
        self.snapshots = snapshots
    }
}

public enum LocalSnapshotHistory {

    /// UTC-pinned calendar so the day buckets agree with the UTC timestamps the
    /// snapshots store + the UTC labels the UI renders.
    public static let utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    private static func parseDate(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d }
        let alt = ISO8601DateFormatter()
        alt.formatOptions = [.withInternetDateTime]
        return alt.date(from: iso)
    }

    /// Group snapshots into Today / Earlier (≤7d) / Older, each newest-first.
    /// Sections are returned in [today, earlier, older] order, and only when
    /// non-empty. Snapshots whose timestamp can't be parsed fall into `older`
    /// (defensive — never dropped, never a crash). Pure.
    public static func grouped(
        _ snapshots: [LocalCompletedSessionSnapshot],
        now: Date,
        calendar: Calendar = LocalSnapshotHistory.utcCalendar
    ) -> [LocalHistorySection] {
        guard !snapshots.isEmpty else { return [] }

        // Stable newest-first ordering: parsed date desc, then createdAtIso desc
        // (so equal/unparseable timestamps keep a deterministic order).
        let sorted = snapshots.sorted { a, b in
            let da = parseDate(a.createdAtIso)
            let db = parseDate(b.createdAtIso)
            switch (da, db) {
            case let (.some(x), .some(y)) where x != y: return x > y
            default: return a.createdAtIso > b.createdAtIso
            }
        }

        var today: [LocalCompletedSessionSnapshot] = []
        var earlier: [LocalCompletedSessionSnapshot] = []
        var older: [LocalCompletedSessionSnapshot] = []
        // Calendar-day spans (not rolling 24h windows): compare start-of-day to
        // start-of-day so "earlier" means 1–7 calendar days ago, deterministically.
        let startNow = calendar.startOfDay(for: now)
        for snap in sorted {
            guard let date = parseDate(snap.createdAtIso) else { older.append(snap); continue }
            if calendar.isDate(date, inSameDayAs: now) {
                today.append(snap)
            } else if let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: startNow).day,
                      days >= 1, days <= 7 {
                earlier.append(snap)
            } else {
                older.append(snap)
            }
        }

        var sections: [LocalHistorySection] = []
        if !today.isEmpty { sections.append(LocalHistorySection(group: .today, snapshots: today)) }
        if !earlier.isEmpty { sections.append(LocalHistorySection(group: .earlier, snapshots: earlier)) }
        if !older.isEmpty { sections.append(LocalHistorySection(group: .older, snapshots: older)) }
        return sections
    }

    /// iOS-14/15/16: lightweight, local-only filter/search over saved snapshots.
    /// `query` matches (case-insensitively) the scenario label, session intent,
    /// or any exercise name; `scenarioId` keeps only that scenario; `completedOnly`
    /// keeps only fully-completed sessions; `dateRange` keeps only sessions within
    /// a coarse, calendar-day span measured against the INJECTED `now` (iOS-15);
    /// `customRange` (iOS-16) keeps only sessions inside an explicit, inclusive
    /// custom calendar-day interval (absolute — no `now` needed). All filters
    /// COMPOSE (logical AND): when both `dateRange` and `customRange` are active a
    /// snapshot must satisfy both, so the caller can disable one by passing `.all`
    /// / `nil`. Pure; preserves input order (the view groups afterwards). No
    /// database, no search index, no network.
    public static func filtered(
        _ snapshots: [LocalCompletedSessionSnapshot],
        query: String = "",
        scenarioId: String? = nil,
        completedOnly: Bool = false,
        dateRange: LocalHistoryDateRange = .all,
        customRange: LocalHistoryCustomDateRange? = nil,
        now: Date? = nil,
        calendar: Calendar = LocalSnapshotHistory.utcCalendar
    ) -> [LocalCompletedSessionSnapshot] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return snapshots.filter { snap in
            if let scenarioId, snap.scenarioId != scenarioId { return false }
            if completedOnly, !(snap.totalTargetSets > 0 && snap.totalCompletedSets >= snap.totalTargetSets) {
                return false
            }
            if !q.isEmpty {
                let haystack = ([snap.scenarioLabel, snap.sessionIntent] + snap.exercises.map(\.name))
                    .joined(separator: "\n").lowercased()
                if !haystack.contains(q) { return false }
            }
            if !isWithinRange(snap.createdAtIso, range: dateRange, now: now, calendar: calendar) {
                return false
            }
            if !isWithinCustomRange(snap.createdAtIso, range: customRange, calendar: calendar) {
                return false
            }
            return true
        }
    }

    /// iOS-15: whether a snapshot's ISO-8601 timestamp falls within a coarse date
    /// range, measured in calendar days against an INJECTED `now` (UTC-pinned by
    /// default, consistent with `grouped`). Exposed for direct unit testing.
    /// `.all` keeps everything (including unparseable timestamps).
    public static func isWithin(
        _ iso: String,
        range: LocalHistoryDateRange,
        now: Date,
        calendar: Calendar = LocalSnapshotHistory.utcCalendar
    ) -> Bool {
        isWithinRange(iso, range: range, now: now, calendar: calendar)
    }

    /// Internal membership test. `.all` (or a nil `now`) keeps everything so a
    /// missing clock can never silently drop history. A bounded range parses the
    /// timestamp; an UNPARSEABLE timestamp is EXCLUDED from a bounded range but
    /// never crashes (and is never dropped from `.all`). A future-dated snapshot
    /// (days < 0) is outside any "last N days" range.
    private static func isWithinRange(
        _ iso: String,
        range: LocalHistoryDateRange,
        now: Date?,
        calendar: Calendar
    ) -> Bool {
        guard let bound = range.dayBound else { return true }   // .all — unbounded
        guard let now else { return true }                       // no clock — skip date filtering
        guard let date = parseDate(iso) else { return false }    // unparseable — excluded from bounded range
        let startNow = calendar.startOfDay(for: now)
        let startDate = calendar.startOfDay(for: date)
        guard let days = calendar.dateComponents([.day], from: startDate, to: startNow).day else { return false }
        return days >= 0 && days <= bound
    }

    /// iOS-16: whether a snapshot's ISO-8601 timestamp falls inside an explicit
    /// custom calendar-day interval `[from, to]` (inclusive, UTC-pinned by
    /// default). The interval is NORMALIZED so order doesn't matter. Exposed for
    /// direct unit testing. An UNPARSEABLE timestamp is excluded (never crashes).
    public static func isWithin(
        _ iso: String,
        from: Date,
        to: Date,
        calendar: Calendar = LocalSnapshotHistory.utcCalendar
    ) -> Bool {
        isWithinCustomRange(iso, range: LocalHistoryCustomDateRange(from: from, to: to), calendar: calendar)
    }

    /// Internal custom-interval membership. A nil range keeps everything (custom
    /// filtering off). A non-nil range parses the timestamp and compares CALENDAR
    /// DAYS inclusively after NORMALIZING the bounds (so `from > to` is treated
    /// the same as `to > from`); an UNPARSEABLE timestamp is EXCLUDED from the
    /// bounded custom range but never crashes (mirrors the coarse-range rule).
    private static func isWithinCustomRange(
        _ iso: String,
        range: LocalHistoryCustomDateRange?,
        calendar: Calendar
    ) -> Bool {
        guard let range else { return true }                     // no custom range — keep
        guard let date = parseDate(iso) else { return false }    // unparseable — excluded from bounded range
        let dayA = calendar.startOfDay(for: range.from)
        let dayB = calendar.startOfDay(for: range.to)
        let lo = min(dayA, dayB)                                  // normalize: order-independent
        let hi = max(dayA, dayB)
        let day = calendar.startOfDay(for: date)
        return day >= lo && day <= hi
    }
}
