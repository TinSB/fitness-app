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

    /// iOS-14: lightweight, local-only filter/search over saved snapshots.
    /// `query` matches (case-insensitively) the scenario label, session intent,
    /// or any exercise name; `scenarioId` keeps only that scenario; `completedOnly`
    /// keeps only fully-completed sessions. Pure; preserves input order (the view
    /// groups afterwards). No database, no search index, no network.
    public static func filtered(
        _ snapshots: [LocalCompletedSessionSnapshot],
        query: String = "",
        scenarioId: String? = nil,
        completedOnly: Bool = false
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
            return true
        }
    }
}
