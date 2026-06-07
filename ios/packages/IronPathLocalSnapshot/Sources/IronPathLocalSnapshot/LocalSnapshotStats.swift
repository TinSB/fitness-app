// LocalSnapshotStats — iOS-10 Local Training Persistence Mega Bundle V1
// (Iteration 7: local stats summary).
//
// Small, derived-only summary computed from the locally-saved snapshots. This
// is NOT an analytics engine and NOT a legacy web implementation-engine port — it is a handful
// of sums over the `[LocalCompletedSessionSnapshot]` the store already returns.
//
// 100% pure value logic — NO FileManager, NO disk, NO network, NO cloud, NO
// AppData, NO charts. Pure so it stays unit-testable later without app-test
// chaos and so it never trips the iOS-8 whole-tree no-disk boundary.

import Foundation

public struct LocalSnapshotStats: Equatable {
    public let totalSessions: Int
    public let totalCompletedSets: Int
    public let totalTargetSets: Int
    /// completed / target, clamped to [0, 1]; 0 when there is no target volume.
    public let completionRatio: Double
    public let mostRecentScenarioLabel: String?
    public let lastSavedIso: String?
    /// iOS-14: the scenario label that appears most often across saved sessions
    /// (ties broken toward the most recent, since snapshots arrive newest-first).
    public let mostCommonScenarioLabel: String?

    public init(
        totalSessions: Int,
        totalCompletedSets: Int,
        totalTargetSets: Int,
        completionRatio: Double,
        mostRecentScenarioLabel: String?,
        lastSavedIso: String?,
        mostCommonScenarioLabel: String? = nil
    ) {
        self.totalSessions = totalSessions
        self.totalCompletedSets = totalCompletedSets
        self.totalTargetSets = totalTargetSets
        self.completionRatio = completionRatio
        self.mostRecentScenarioLabel = mostRecentScenarioLabel
        self.lastSavedIso = lastSavedIso
        self.mostCommonScenarioLabel = mostCommonScenarioLabel
    }

    public static let empty = LocalSnapshotStats(
        totalSessions: 0,
        totalCompletedSets: 0,
        totalTargetSets: 0,
        completionRatio: 0,
        mostRecentScenarioLabel: nil,
        lastSavedIso: nil,
        mostCommonScenarioLabel: nil
    )

    /// Derive stats from valid snapshots. Expects newest-first ordering (as the
    /// store returns); the "most recent" fields read the first element.
    public static func derive(from snapshots: [LocalCompletedSessionSnapshot]) -> LocalSnapshotStats {
        guard !snapshots.isEmpty else { return .empty }
        let totalCompleted = snapshots.reduce(0) { $0 + $1.totalCompletedSets }
        let totalTarget = snapshots.reduce(0) { $0 + $1.totalTargetSets }
        let ratio: Double
        if totalTarget > 0 {
            ratio = min(1.0, max(0.0, Double(totalCompleted) / Double(totalTarget)))
        } else {
            ratio = 0
        }
        let mostRecent = snapshots.first
        // Most-common scenario label: highest count; ties resolved toward the
        // most recent (snapshots are newest-first, so the first to reach the max
        // count wins). Pure, deterministic.
        var counts: [String: Int] = [:]
        var bestLabel: String? = nil
        var bestCount = 0
        for snap in snapshots {
            let c = (counts[snap.scenarioLabel] ?? 0) + 1
            counts[snap.scenarioLabel] = c
            if c > bestCount {
                bestCount = c
                bestLabel = snap.scenarioLabel
            }
        }
        return LocalSnapshotStats(
            totalSessions: snapshots.count,
            totalCompletedSets: totalCompleted,
            totalTargetSets: totalTarget,
            completionRatio: ratio,
            mostRecentScenarioLabel: mostRecent?.scenarioLabel,
            lastSavedIso: mostRecent?.createdAtIso,
            mostCommonScenarioLabel: bestLabel
        )
    }

    /// Whole-percent completion for compact display (e.g. "80%").
    public var completionPercentText: String {
        "\(Int((completionRatio * 100).rounded()))%"
    }
}
