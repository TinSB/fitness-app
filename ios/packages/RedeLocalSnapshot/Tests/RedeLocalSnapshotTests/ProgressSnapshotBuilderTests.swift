// M4-1（FR-PR1/2/3 数据派生）：固定历史 → 确定的历史/e1RM/PR/周训练量投影。
// 口径锁定（与已落盘实现对齐）：e1RM = Epley w×(1+r/30)（同 SessionSummary）；
// PR = 顶组重量严格大于全部更早历史的同动作顶组（首练不发奖，同 M3 保守口径）；
// volume = Σ 重量×次数；周聚合 = ISO 周（周一起始），纯字符串日期数学，无时区依赖。

import XCTest
@testable import RedeLocalSnapshot

final class ProgressSnapshotBuilderTests: XCTestCase {
    private func set(_ w: Double, _ r: Int) -> SnapshotSetRecord {
        SnapshotSetRecord(weightKg: w, reps: r)
    }

    private func session(
        _ id: String, _ date: String,
        _ exercises: [(String, [SnapshotSetRecord])],
        duration: Int? = nil
    ) -> SnapshotSessionRecord {
        SnapshotSessionRecord(
            id: id, dateISO: date,
            exercises: exercises.map { SnapshotExerciseRecord(exerciseId: $0.0, sets: $0.1) },
            durationMinutes: duration
        )
    }

    // MARK: - 空输入

    func testEmptyHistoryProducesEmptySnapshot() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [])
        XCTAssertTrue(snapshot.history.isEmpty)
        XCTAssertTrue(snapshot.exerciseTrends.isEmpty)
        XCTAssertTrue(snapshot.weeklyVolume.isEmpty)
    }

    // MARK: - 历史投影（FR-PR1）

    func testHistoryIsNewestFirstWithVolumeAndSetCount() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6), set(60, 6)])], duration: 45),
            session("s2", "2026-06-03", [("squat", [set(80, 5)])]),
        ])
        XCTAssertEqual(snapshot.history.map(\.sessionId), ["s2", "s1"])
        let s1 = snapshot.history[1]
        XCTAssertEqual(s1.dateISO, "2026-06-01")
        XCTAssertEqual(s1.totalVolumeKg, 720) // 60×6×2
        XCTAssertEqual(s1.setCount, 2)
        XCTAssertEqual(s1.durationMinutes, 45)
        XCTAssertEqual(snapshot.history[0].totalVolumeKg, 400)
    }

    /// wave-9：辅助器械不进跨会话吨位/e1RM/趋势（辅助量裸加=方向反）；组数仍如实计。
    func testAssistedExcludedFromVolumeAndE1RM() {
        let facts: [String: ExerciseStatsFacts] = [
            "assisted-pull-up": ExerciseStatsFacts(loadFactor: 1.0, isCompound: true, isAssisted: true),
            "bench-press": ExerciseStatsFacts(loadFactor: 1.0, isCompound: true),
        ]
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("assisted-pull-up", [set(30, 8)]), ("bench-press", [set(60, 6)])]),
        ], facts: facts)
        XCTAssertEqual(snapshot.history[0].totalVolumeKg, 360, "吨位仅 bench 60×6=360；辅助 30×8 不计")
        XCTAssertEqual(snapshot.history[0].setCount, 2, "辅助组仍如实计数")
        XCTAssertFalse(snapshot.exerciseTrends.contains { $0.exerciseId == "assisted-pull-up" },
                       "辅助器械不产 e1RM 趋势点（重量轴是辅助量）")
    }

    func testSameDateKeepsInputOrderNewestFirst() {
        // 同日两场：历史 newest-first 下，输入靠后的视为更晚。
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("am", "2026-06-03", [("bench-press", [set(60, 5)])]),
            session("pm", "2026-06-03", [("bench-press", [set(62.5, 5)])]),
        ])
        XCTAssertEqual(snapshot.history.map(\.sessionId), ["pm", "am"])
    }

    func testTopSetPicksMaxWeightThenMoreReps() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [
                ("bench-press", [set(60, 6), set(62.5, 4), set(62.5, 6)]),
            ]),
        ])
        let top = snapshot.history[0].topSet
        XCTAssertEqual(top?.exerciseId, "bench-press")
        XCTAssertEqual(top?.weightKg, 62.5)
        XCTAssertEqual(top?.reps, 6)
    }

    // MARK: - PR 口径（FR-PR2，保守：首练不发奖、严格大于）

    func testFirstExposureIsNeverPR() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)])]),
        ])
        XCTAssertEqual(snapshot.history[0].prExerciseIds, [])
    }

    func testHeavierTopThanAllEarlierSessionsIsPR() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)])]),
            session("s2", "2026-06-03", [("bench-press", [set(62.5, 5)])]),
            session("s3", "2026-06-05", [("bench-press", [set(61, 8)])]), // 低于 62.5 → 非 PR
        ])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s2" })?.prExerciseIds, ["bench-press"])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s3" })?.prExerciseIds, [])
    }

    func testEqualTopWeightIsNotPR() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)])]),
            session("s2", "2026-06-03", [("bench-press", [set(60, 8)])]), // 同重多次 ≠ 重量 PR
        ])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s2" })?.prExerciseIds, [])
    }

    func testDuplicateExerciseEntriesInOneSessionMergeBeforePRJudgment() {
        // 同场同 exerciseId 两条（热身/工作组分录）：先合并再判 PR——
        // 首练日场内自比不发奖；e1RM 每场每动作只产出一个点；prIds 无重复。
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [
                ("bench-press", [set(60, 6)]),
                ("bench-press", [set(62.5, 5)]),
            ]),
            session("s2", "2026-06-03", [
                ("bench-press", [set(65, 4)]),
                ("bench-press", [set(64, 6)]),
            ]),
        ])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s1" })?.prExerciseIds, [])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s2" })?.prExerciseIds, ["bench-press"])
        let trend = snapshot.exerciseTrends.first(where: { $0.exerciseId == "bench-press" })
        XCTAssertEqual(trend?.points.count, 2)
        XCTAssertEqual(trend?.points.first?.e1RmKg ?? 0, 62.5 * (1 + 5.0 / 30), accuracy: 1e-9)
    }

    func testSameDayLaterSessionCanPROverEarlierSession() {
        // 同日两场是两个独立的「场」：pm 顶组超过 am → pm 发 PR（场级口径）。
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("am", "2026-06-03", [("bench-press", [set(60, 5)])]),
            session("pm", "2026-06-03", [("bench-press", [set(62.5, 5)])]),
        ])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "am" })?.prExerciseIds, [])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "pm" })?.prExerciseIds, ["bench-press"])
    }

    // MARK: - e1RM 趋势（FR-PR2，Epley 顶组）

    func testE1RMPointsUseEpleyOnSessionTopSet() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(62.5, 6), set(60, 8)])]),
        ])
        let trend = snapshot.exerciseTrends.first(where: { $0.exerciseId == "bench-press" })
        // 顶组 62.5×6（重量优先）→ 62.5×(1+6/30) = 75.0
        XCTAssertEqual(trend?.points.first?.e1RmKg ?? 0, 75.0, accuracy: 1e-9)
        XCTAssertEqual(trend?.points.first?.dateISO, "2026-06-01")
        XCTAssertEqual(trend?.points.first?.sessionId, "s1")
    }

    func testExerciseTrendIsOldestToNewestWithLatestAndBest() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)])]),   // e1RM 72
            session("s2", "2026-06-03", [("bench-press", [set(62.5, 6)])]), // e1RM 75
            session("s3", "2026-06-05", [("bench-press", [set(60, 5)])]),   // e1RM 70
        ])
        let trend = snapshot.exerciseTrends.first(where: { $0.exerciseId == "bench-press" })
        XCTAssertEqual(trend?.points.map(\.sessionId), ["s1", "s2", "s3"])
        XCTAssertEqual(trend?.latestE1RmKg ?? 0, 70.0, accuracy: 1e-9)
        XCTAssertEqual(trend?.bestE1RmKg ?? 0, 75.0, accuracy: 1e-9)
        XCTAssertEqual(trend?.bestWeightKg, 62.5)
    }

    func testExerciseTrendsSortedByExerciseIdForDeterminism() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [
                ("squat", [set(80, 5)]),
                ("bench-press", [set(60, 6)]),
            ]),
        ])
        XCTAssertEqual(snapshot.exerciseTrends.map(\.exerciseId), ["bench-press", "squat"])
    }

    // MARK: - 周训练量（FR-PR3，ISO 周·周一起始）

    func testWeeklyVolumeBucketsByISOWeekMondayStart() {
        // 2026-06-07 是周日、2026-06-08 是周一 → 两个不同的周桶。
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-07", [("bench-press", [set(60, 6)])]),
            session("s2", "2026-06-08", [("squat", [set(80, 5)])]),
        ])
        XCTAssertEqual(snapshot.weeklyVolume.map(\.weekStartISO), ["2026-06-08", "2026-06-01"])
        XCTAssertEqual(snapshot.weeklyVolume[1].totalVolumeKg, 360)
        XCTAssertEqual(snapshot.weeklyVolume[0].totalVolumeKg, 400)
    }

    func testWeeklyVolumeAggregatesSetsAndSessions() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-02", [("bench-press", [set(60, 6), set(60, 6)])]),
            session("s2", "2026-06-04", [("squat", [set(80, 5)])]),
        ])
        XCTAssertEqual(snapshot.weeklyVolume.count, 1)
        let week = snapshot.weeklyVolume[0]
        XCTAssertEqual(week.weekStartISO, "2026-06-01")
        XCTAssertEqual(week.totalVolumeKg, 1120)
        XCTAssertEqual(week.setCount, 3)
        XCTAssertEqual(week.sessionCount, 2)
    }

    // MARK: - 防御与确定性

    func testInvalidDateEntriesAreSkippedEverywhere() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("bad", "2026-13-01", [("bench-press", [set(60, 6)])]),
            session("worse", "not-a-date", [("squat", [set(80, 5)])]),
            session("good", "2026-06-03", [("bench-press", [set(60, 6)])]),
        ])
        XCTAssertEqual(snapshot.history.map(\.sessionId), ["good"])
        XCTAssertEqual(snapshot.exerciseTrends.count, 1)
        XCTAssertEqual(snapshot.weeklyVolume.count, 1)
    }

    func testSameInputProducesEqualSnapshots() {
        let sessions = [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)]), ("squat", [set(80, 5)])]),
            session("s2", "2026-06-03", [("bench-press", [set(62.5, 5)])]),
        ]
        XCTAssertEqual(
            ProgressSnapshotBuilder.build(sessions: sessions),
            ProgressSnapshotBuilder.build(sessions: sessions)
        )
    }

    // MARK: - 日期数学（内部口径锁定）

    func testWeekStartHandlesLeapYearAndYearBoundary() {
        // 2024-02-29（闰日，周四）→ 该周周一 = 2024-02-26
        XCTAssertEqual(SnapshotDayMath.isoWeekStart(of: "2024-02-29"), "2024-02-26")
        // 2026-01-01（周四）→ 周一落在上一年 2025-12-29
        XCTAssertEqual(SnapshotDayMath.isoWeekStart(of: "2026-01-01"), "2025-12-29")
        // 周一自身不动
        XCTAssertEqual(SnapshotDayMath.isoWeekStart(of: "2026-06-08"), "2026-06-08")
        XCTAssertNil(SnapshotDayMath.isoWeekStart(of: "2026-02-30"))
    }

    // MARK: - §6.2 吨位系数（owner 拍板 B 案 2026-06-11）

    func testVolumeAppliesLoadFactorFromFacts() {
        let facts = ["db-bench-press": ExerciseStatsFacts(loadFactor: 2.0, isCompound: true)]
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [
                ("db-bench-press", [set(30, 10)]),   // 单只 30 → 吨位 30×10×2 = 600
                ("bench-press", [set(60, 5)]),       // facts 缺省 → ×1 = 300
            ]),
        ], facts: facts)
        XCTAssertEqual(snapshot.history.first?.totalVolumeKg, 900)
        XCTAssertEqual(snapshot.weeklyVolume.first?.totalVolumeKg, 900)
        // e1RM/PR 永不乘系数（只作用于吨位统计）
        let trend = snapshot.exerciseTrends.first { $0.exerciseId == "db-bench-press" }
        XCTAssertEqual(trend?.bestWeightKg, 30)
    }
}
