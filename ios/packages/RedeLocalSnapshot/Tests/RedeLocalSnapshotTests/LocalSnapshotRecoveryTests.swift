// LocalSnapshotRecoveryTests — iOS-15 Local History Detail + Per-Exercise
// Recovery Insight V1.
//
// REAL unit tests for the pure recovery-insight projection and the coarse
// date-range filter. Run via `swift test`. Local-only and deterministic
// (injected `now`); never touches disk, AppData, the engine, the cloud, or the
// network.

import XCTest
@testable import RedeLocalSnapshot

final class LocalSnapshotRecoveryTests: XCTestCase {

    // MARK: - Builders

    private func exercise(_ id: String, completed: Int, target: Int, name: String? = nil) -> LocalCompletedExerciseSnapshot {
        LocalCompletedExerciseSnapshot(
            exerciseId: id, name: name ?? id, role: "accessory",
            progress: LocalCompletedSetProgressSnapshot(completedSets: completed, targetSets: target)
        )
    }

    private func snapshot(
        id: String = "focus-normal-1",
        scenario: String = "normal",
        label: String = "普通",
        createdAtIso: String = "2026-05-27T10:00:00.000Z",
        exercises: [LocalCompletedExerciseSnapshot],
        resume: Int? = 0
    ) -> LocalCompletedSessionSnapshot {
        let totalC = exercises.reduce(0) { $0 + $1.completedSets }
        let totalT = exercises.reduce(0) { $0 + $1.targetSets }
        return LocalCompletedSessionSnapshot(
            snapshotId: id, createdAtIso: createdAtIso,
            scenarioId: scenario, scenarioLabel: label, sessionIntent: "normal-session",
            activePhase: "base", deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: totalC, totalTargetSets: totalT,
            exercises: exercises, resumeExerciseIndex: resume
        )
    }

    // MARK: - Recovery insight

    func testInsightAllMatchedNoDrift() {
        let snap = snapshot(exercises: [
            exercise("a", completed: 1, target: 3),
            exercise("b", completed: 2, target: 2),
            exercise("c", completed: 0, target: 2),
        ], resume: 1)
        let insight = LocalSnapshotRecovery.insight(from: snap, currentExerciseIds: ["a", "b", "c"])
        XCTAssertEqual(insight.rows.map(\.exerciseId), ["a", "b", "c"])
        XCTAssertTrue(insight.rows.allSatisfy { $0.status == .restorable })
        XCTAssertTrue(insight.newCurrentExerciseIds.isEmpty)
        XCTAssertFalse(insight.hasDrift)
        XCTAssertTrue(insight.isRestorable)
        XCTAssertEqual(insight.resumeExerciseIndex, 1)   // "b" at current index 1
        XCTAssertEqual(insight.resumeExerciseName, "b")
        XCTAssertEqual(insight.currentExerciseCount, 3)
        // rows carry the saved completed/target counts (read-only display).
        XCTAssertEqual(insight.rows.first(where: { $0.exerciseId == "a" })?.completedSets, 1)
        XCTAssertEqual(insight.rows.first(where: { $0.exerciseId == "a" })?.targetSets, 3)
    }

    func testInsightPartialDrift() {
        // snapshot a,b,c; current a,c,d (b changed/removed, d new)
        let snap = snapshot(exercises: [
            exercise("a", completed: 1, target: 3),
            exercise("b", completed: 2, target: 2),
            exercise("c", completed: 1, target: 2),
        ], resume: 0)
        let insight = LocalSnapshotRecovery.insight(from: snap, currentExerciseIds: ["a", "c", "d"])
        XCTAssertEqual(insight.rows.map(\.exerciseId), ["a", "b", "c"])   // saved order
        XCTAssertEqual(insight.rows.first(where: { $0.exerciseId == "a" })?.status, .restorable)
        XCTAssertEqual(insight.rows.first(where: { $0.exerciseId == "b" })?.status, .changed)
        XCTAssertEqual(insight.rows.first(where: { $0.exerciseId == "c" })?.status, .restorable)
        XCTAssertEqual(insight.newCurrentExerciseIds, ["d"])
        XCTAssertTrue(insight.hasDrift)
        XCTAssertTrue(insight.isRestorable)
    }

    func testInsightAllChangedNothingRestorable() {
        let snap = snapshot(exercises: [
            exercise("old1", completed: 2, target: 2),
            exercise("old2", completed: 1, target: 3),
        ], resume: 1)
        let insight = LocalSnapshotRecovery.insight(from: snap, currentExerciseIds: ["new1", "new2"])
        XCTAssertEqual(insight.rows.map(\.exerciseId), ["old1", "old2"])   // still shown
        XCTAssertTrue(insight.rows.allSatisfy { $0.status == .changed })
        XCTAssertEqual(insight.newCurrentExerciseIds, ["new1", "new2"])
        XCTAssertTrue(insight.hasDrift)
        XCTAssertFalse(insight.isRestorable)              // nothing to continue
        XCTAssertNil(insight.resumeExerciseIndex)
        XCTAssertNil(insight.resumeExerciseName)
    }

    func testInsightEmptyAndImpossibleAreHonestlyNonRestorable() {
        // empty exercises -> reconcile fails -> honest non-restorable
        let empty = snapshot(exercises: [], resume: nil)
        let e = LocalSnapshotRecovery.insight(from: empty, currentExerciseIds: ["a"])
        XCTAssertFalse(e.isRestorable)
        XCTAssertTrue(e.rows.isEmpty)
        XCTAssertNil(e.resumeExerciseIndex)
        XCTAssertFalse(e.hasDrift)                        // no rows, no new ids
        XCTAssertEqual(e.currentExerciseCount, 1)

        // impossible progress (completed > target) -> reconcile fails too
        let impossible = LocalCompletedSessionSnapshot(
            snapshotId: "id", createdAtIso: "2026-05-27T10:00:00.000Z",
            scenarioId: "normal", scenarioLabel: "普通", sessionIntent: "x",
            activePhase: "base", deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: 9, totalTargetSets: 1,
            exercises: [exercise("a", completed: 9, target: 1)])
        let i = LocalSnapshotRecovery.insight(from: impossible, currentExerciseIds: ["a"])
        XCTAssertFalse(i.isRestorable)
        XCTAssertTrue(i.rows.isEmpty)
        XCTAssertNil(i.resumeExerciseIndex)
    }

    func testInsightPreservesSavedOrder() {
        // saved order c,a,b; all exist in current (different order)
        let snap = snapshot(exercises: [
            exercise("c", completed: 1, target: 2),
            exercise("a", completed: 0, target: 2),
            exercise("b", completed: 2, target: 2),
        ], resume: 0)
        let insight = LocalSnapshotRecovery.insight(from: snap, currentExerciseIds: ["a", "b", "c"])
        XCTAssertEqual(insight.rows.map(\.exerciseId), ["c", "a", "b"])   // SAVED order preserved
        XCTAssertTrue(insight.rows.allSatisfy { $0.status == .restorable })
    }

    func testInsightResumeRemapsToCurrentOrder() {
        // saved [a,b], resume idx1 -> "b"; current order [b,a] -> b at index 0
        let snap = snapshot(exercises: [
            exercise("a", completed: 1, target: 3),
            exercise("b", completed: 0, target: 2),
        ], resume: 1)
        let insight = LocalSnapshotRecovery.insight(from: snap, currentExerciseIds: ["b", "a"])
        XCTAssertEqual(insight.resumeExerciseIndex, 0)
        XCTAssertEqual(insight.resumeExerciseName, "b")
        XCTAssertEqual(insight.currentExerciseCount, 2)
    }

    func testInsightIsEquatableForIdenticalInputs() {
        let snap = snapshot(exercises: [exercise("a", completed: 1, target: 2)], resume: 0)
        let a = LocalSnapshotRecovery.insight(from: snap, currentExerciseIds: ["a"])
        let b = LocalSnapshotRecovery.insight(from: snap, currentExerciseIds: ["a"])
        XCTAssertEqual(a, b)
    }

    // MARK: - Date-range filter

    private func dated(
        _ id: String, _ iso: String, scenario: String = "normal",
        completed: Int = 2, target: Int = 2
    ) -> LocalCompletedSessionSnapshot {
        snapshot(id: id, scenario: scenario, createdAtIso: iso,
                 exercises: [exercise("x", completed: completed, target: target)])
    }

    private func at(_ iso: String) -> Date {
        ISO8601DateFormatter().date(from: iso)!
    }

    func testDateRangeAllKeepsEverythingIncludingUnparseable() {
        let snaps = [
            dated("a", "2026-05-27T10:00:00.000Z"),
            dated("bad", "not-a-date"),
            dated("old", "2020-01-01T10:00:00.000Z"),
        ]
        let out = LocalSnapshotHistory.filtered(snaps, dateRange: .all, now: at("2026-05-27T12:00:00Z"))
        XCTAssertEqual(out.map(\.id), ["a", "bad", "old"])   // all kept, order preserved
    }

    func testDateRangeLast7DaysCalendarBoundary() {
        let now = at("2026-05-27T12:00:00Z")
        let snaps = [
            dated("d0", "2026-05-27T08:00:00.000Z"),     // today
            dated("d7", "2026-05-20T23:00:00.000Z"),     // 7 calendar days ago (included)
            dated("d8", "2026-05-19T01:00:00.000Z"),     // 8 days ago (excluded)
            dated("future", "2026-05-28T09:00:00.000Z"), // future (excluded)
        ]
        let out = LocalSnapshotHistory.filtered(snaps, dateRange: .last7Days, now: now).map(\.id)
        XCTAssertEqual(out, ["d0", "d7"])
    }

    func testDateRangeLast30DaysCalendarBoundary() {
        let now = at("2026-05-27T12:00:00Z")
        let snaps = [
            dated("d0", "2026-05-27T08:00:00.000Z"),
            dated("d30", "2026-04-27T10:00:00.000Z"),    // 30 days ago (included)
            dated("d31", "2026-04-26T10:00:00.000Z"),    // 31 days ago (excluded)
        ]
        let out = LocalSnapshotHistory.filtered(snaps, dateRange: .last30Days, now: now).map(\.id)
        XCTAssertEqual(out, ["d0", "d30"])
    }

    func testDateRangeUnparseableExcludedFromBoundedButNeverCrashes() {
        let now = at("2026-05-27T12:00:00Z")
        let snaps = [dated("ok", "2026-05-27T08:00:00.000Z"), dated("bad", "not-a-date")]
        XCTAssertEqual(LocalSnapshotHistory.filtered(snaps, dateRange: .last7Days, now: now).map(\.id), ["ok"])
        XCTAssertEqual(LocalSnapshotHistory.filtered(snaps, dateRange: .last30Days, now: now).map(\.id), ["ok"])
    }

    func testDateRangeComposesWithOtherFilters() {
        let now = at("2026-05-27T12:00:00Z")
        let snaps = [
            dated("recent-normal", "2026-05-27T08:00:00.000Z", scenario: "normal", completed: 2, target: 2),
            dated("recent-deload", "2026-05-26T08:00:00.000Z", scenario: "deloadWeek", completed: 2, target: 2),
            dated("old-normal", "2026-01-01T08:00:00.000Z", scenario: "normal", completed: 2, target: 2),
            dated("recent-partial", "2026-05-25T08:00:00.000Z", scenario: "normal", completed: 1, target: 2),
        ]
        // last7Days + scenario "normal" + completedOnly -> only recent-normal
        let out = LocalSnapshotHistory.filtered(
            snaps, scenarioId: "normal", completedOnly: true, dateRange: .last7Days, now: now
        ).map(\.id)
        XCTAssertEqual(out, ["recent-normal"])
    }

    func testDateRangePreservesInputOrder() {
        let now = at("2026-05-27T12:00:00Z")
        let snaps = [
            dated("c", "2026-05-27T03:00:00.000Z"),
            dated("a", "2026-05-27T09:00:00.000Z"),
            dated("b", "2026-05-26T09:00:00.000Z"),
        ]
        // all within 7d; order must be preserved (the view groups afterward)
        XCTAssertEqual(LocalSnapshotHistory.filtered(snaps, dateRange: .last7Days, now: now).map(\.id), ["c", "a", "b"])
    }

    func testDateRangeAllWithoutClockKeepsEverything() {
        // No `now` + `.all` is the default call shape used by older sites.
        let snaps = [dated("a", "2026-05-27T10:00:00.000Z"), dated("b", "2020-01-01T10:00:00.000Z")]
        XCTAssertEqual(LocalSnapshotHistory.filtered(snaps).map(\.id), ["a", "b"])
    }

    func testIsWithinDirectBoundaryAndFuture() {
        let now = at("2026-05-27T12:00:00Z")
        XCTAssertTrue(LocalSnapshotHistory.isWithin("2026-05-27T00:00:00.000Z", range: .last7Days, now: now))
        XCTAssertTrue(LocalSnapshotHistory.isWithin("2026-05-20T23:00:00.000Z", range: .last7Days, now: now))  // 7d
        XCTAssertFalse(LocalSnapshotHistory.isWithin("2026-05-19T23:00:00.000Z", range: .last7Days, now: now)) // 8d
        XCTAssertFalse(LocalSnapshotHistory.isWithin("2026-05-28T00:00:00.000Z", range: .last7Days, now: now)) // future
        XCTAssertTrue(LocalSnapshotHistory.isWithin("not-a-date", range: .all, now: now))                       // all keeps unparseable
        XCTAssertFalse(LocalSnapshotHistory.isWithin("not-a-date", range: .last30Days, now: now))              // bounded excludes
    }
}
