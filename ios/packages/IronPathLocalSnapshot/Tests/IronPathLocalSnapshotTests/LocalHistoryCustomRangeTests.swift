// LocalHistoryCustomRangeTests — iOS-16 Custom History Date Range V1.
//
// REAL unit tests for the pure CUSTOM from/to date-range filter added to
// LocalSnapshotHistory. Run via `swift test`. Local-only and deterministic
// (absolute from/to bounds + injected `now` for the coarse range); never touches
// disk, AppData, the engine, the cloud, or the network.

import XCTest
@testable import IronPathLocalSnapshot

final class LocalHistoryCustomRangeTests: XCTestCase {

    // MARK: - Builders

    private func exercise(_ id: String, completed: Int, target: Int) -> LocalCompletedExerciseSnapshot {
        LocalCompletedExerciseSnapshot(
            exerciseId: id, name: id, role: "accessory",
            progress: LocalCompletedSetProgressSnapshot(completedSets: completed, targetSets: target)
        )
    }

    private func dated(
        _ id: String, _ iso: String, scenario: String = "normal",
        completed: Int = 2, target: Int = 2
    ) -> LocalCompletedSessionSnapshot {
        LocalCompletedSessionSnapshot(
            snapshotId: id, createdAtIso: iso,
            scenarioId: scenario, scenarioLabel: scenario == "normal" ? "普通" : "减载周",
            sessionIntent: "normal-session", activePhase: "base",
            deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: completed, totalTargetSets: target,
            exercises: [exercise("x", completed: completed, target: target)],
            resumeExerciseIndex: 0
        )
    }

    /// Parse a test ISO-8601 instant. Uses the SAME two-step parse as the
    /// source under test (fractional seconds first, then without), so the
    /// `.000Z` fixtures below parse deterministically — a bare
    /// `ISO8601DateFormatter()` would reject fractional seconds and force-unwrap
    /// to nil.
    private func at(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d }
        let alt = ISO8601DateFormatter()
        alt.formatOptions = [.withInternetDateTime]
        return alt.date(from: iso)!
    }

    private func range(_ fromIso: String, _ toIso: String) -> LocalHistoryCustomDateRange {
        LocalHistoryCustomDateRange(from: at(fromIso), to: at(toIso))
    }

    // MARK: - Inclusive boundaries

    func testCustomRangeIncludesBothBoundaryDays() {
        let snaps = [
            dated("before", "2026-05-09T23:00:00.000Z"),   // day before `from` — excluded
            dated("from-day", "2026-05-10T00:30:00.000Z"), // on `from` day — included (boundary)
            dated("mid", "2026-05-15T12:00:00.000Z"),      // inside — included
            dated("to-day", "2026-05-20T23:30:00.000Z"),   // on `to` day — included (boundary)
            dated("after", "2026-05-21T00:10:00.000Z"),    // day after `to` — excluded
        ]
        let out = LocalSnapshotHistory.filtered(
            snaps, customRange: range("2026-05-10T08:00:00.000Z", "2026-05-20T08:00:00.000Z")
        ).map(\.id)
        XCTAssertEqual(out, ["from-day", "mid", "to-day"])
    }

    func testCustomRangeSingleDay() {
        let snaps = [
            dated("same-day-early", "2026-05-15T00:01:00.000Z"),
            dated("same-day-late", "2026-05-15T23:59:00.000Z"),
            dated("next-day", "2026-05-16T00:01:00.000Z"),
        ]
        // from == to == the same calendar day -> only that day's snapshots
        let out = LocalSnapshotHistory.filtered(
            snaps, customRange: range("2026-05-15T12:00:00.000Z", "2026-05-15T12:00:00.000Z")
        ).map(\.id)
        XCTAssertEqual(out, ["same-day-early", "same-day-late"])
    }

    // MARK: - Reversed interval is normalized

    func testCustomRangeReversedIsNormalized() {
        let snaps = [
            dated("a", "2026-05-12T10:00:00.000Z"),
            dated("b", "2026-05-18T10:00:00.000Z"),
            dated("out", "2026-06-01T10:00:00.000Z"),
        ]
        let ordered = LocalSnapshotHistory.filtered(
            snaps, customRange: range("2026-05-10T00:00:00.000Z", "2026-05-20T00:00:00.000Z")
        ).map(\.id)
        let reversed = LocalSnapshotHistory.filtered(
            snaps, customRange: range("2026-05-20T00:00:00.000Z", "2026-05-10T00:00:00.000Z")
        ).map(\.id)
        XCTAssertEqual(ordered, ["a", "b"])
        XCTAssertEqual(reversed, ordered, "from>to must be normalized (swapped), not treated as empty")
    }

    // MARK: - Unparseable timestamps

    func testCustomRangeExcludesUnparseableButNeverCrashes() {
        let snaps = [
            dated("ok", "2026-05-15T10:00:00.000Z"),
            dated("bad", "not-a-date"),
        ]
        let out = LocalSnapshotHistory.filtered(
            snaps, customRange: range("2026-05-10T00:00:00.000Z", "2026-05-20T00:00:00.000Z")
        ).map(\.id)
        XCTAssertEqual(out, ["ok"], "unparseable excluded from a bounded custom range, no crash")
    }

    func testNilCustomRangeKeepsEverythingIncludingUnparseable() {
        let snaps = [
            dated("a", "2026-05-15T10:00:00.000Z"),
            dated("bad", "not-a-date"),
            dated("old", "2020-01-01T10:00:00.000Z"),
        ]
        // customRange defaults to nil -> custom filtering off -> all kept, order preserved
        XCTAssertEqual(LocalSnapshotHistory.filtered(snaps).map(\.id), ["a", "bad", "old"])
        XCTAssertEqual(
            LocalSnapshotHistory.filtered(snaps, customRange: nil).map(\.id),
            ["a", "bad", "old"]
        )
    }

    // MARK: - Composition / priority with the coarse range + other filters

    func testCustomRangeComposesWithCoarseRangeAsIntersection() {
        let now = at("2026-05-27T12:00:00Z")
        let snaps = [
            dated("recent", "2026-05-25T10:00:00.000Z"),   // within last7Days AND within custom
            dated("midmonth", "2026-05-12T10:00:00.000Z"), // within custom, NOT within last7Days
            dated("old", "2026-01-01T10:00:00.000Z"),      // neither
        ]
        // coarse last7Days AND a wide custom interval -> intersection = only `recent`
        let out = LocalSnapshotHistory.filtered(
            snaps,
            dateRange: .last7Days,
            customRange: range("2026-05-01T00:00:00.000Z", "2026-05-27T00:00:00.000Z"),
            now: now
        ).map(\.id)
        XCTAssertEqual(out, ["recent"], "coarse AND custom compose as an intersection")
    }

    func testCustomRangeComposesWithQueryScenarioCompletedOnly() {
        let snaps = [
            dated("keep", "2026-05-15T10:00:00.000Z", scenario: "normal", completed: 2, target: 2),
            dated("wrong-scenario", "2026-05-15T10:00:00.000Z", scenario: "deloadWeek", completed: 2, target: 2),
            dated("partial", "2026-05-16T10:00:00.000Z", scenario: "normal", completed: 1, target: 2),
            dated("out-of-range", "2026-07-01T10:00:00.000Z", scenario: "normal", completed: 2, target: 2),
        ]
        let out = LocalSnapshotHistory.filtered(
            snaps,
            query: "普通",
            scenarioId: "normal",
            completedOnly: true,
            customRange: range("2026-05-10T00:00:00.000Z", "2026-05-20T00:00:00.000Z")
        ).map(\.id)
        XCTAssertEqual(out, ["keep"], "custom range composes (AND) with query + scenario + completedOnly")
    }

    func testCustomRangePreservesInputOrder() {
        // input order is intentionally NOT chronological; the filter must not reorder.
        let snaps = [
            dated("c", "2026-05-12T10:00:00.000Z"),
            dated("a", "2026-05-18T10:00:00.000Z"),
            dated("b", "2026-05-14T10:00:00.000Z"),
        ]
        let out = LocalSnapshotHistory.filtered(
            snaps, customRange: range("2026-05-10T00:00:00.000Z", "2026-05-20T00:00:00.000Z")
        ).map(\.id)
        XCTAssertEqual(out, ["c", "a", "b"], "order preserved (the view groups afterwards)")
    }

    func testCustomRangeIsNowIndependent() {
        // custom range is absolute -> passing now: nil must NOT disable it.
        let snaps = [
            dated("in", "2026-05-15T10:00:00.000Z"),
            dated("out", "2026-08-15T10:00:00.000Z"),
        ]
        let out = LocalSnapshotHistory.filtered(
            snaps,
            customRange: range("2026-05-10T00:00:00.000Z", "2026-05-20T00:00:00.000Z"),
            now: nil
        ).map(\.id)
        XCTAssertEqual(out, ["in"])
    }

    // MARK: - isWithin(_:from:to:) direct

    func testIsWithinDirectBoundariesAndNormalizationAndUnparseable() {
        let from = at("2026-05-10T08:00:00.000Z")
        let to = at("2026-05-20T08:00:00.000Z")
        XCTAssertTrue(LocalSnapshotHistory.isWithin("2026-05-10T00:00:00.000Z", from: from, to: to))  // from boundary
        XCTAssertTrue(LocalSnapshotHistory.isWithin("2026-05-20T23:00:00.000Z", from: from, to: to))  // to boundary
        XCTAssertFalse(LocalSnapshotHistory.isWithin("2026-05-09T23:00:00.000Z", from: from, to: to)) // before
        XCTAssertFalse(LocalSnapshotHistory.isWithin("2026-05-21T00:30:00.000Z", from: from, to: to)) // after
        // normalized: reversed bounds give the same answer
        XCTAssertTrue(LocalSnapshotHistory.isWithin("2026-05-15T00:00:00.000Z", from: to, to: from))
        // unparseable never crashes, excluded
        XCTAssertFalse(LocalSnapshotHistory.isWithin("not-a-date", from: from, to: to))
    }

    // MARK: - Coarse range still works unchanged (regression guard for the additive param)

    func testCoarseRangeStillWorksWithCustomRangeAbsent() {
        let now = at("2026-05-27T12:00:00Z")
        let snaps = [
            dated("d0", "2026-05-27T08:00:00.000Z"),
            dated("d8", "2026-05-19T01:00:00.000Z"),
        ]
        XCTAssertEqual(LocalSnapshotHistory.filtered(snaps, dateRange: .last7Days, now: now).map(\.id), ["d0"])
    }
}
