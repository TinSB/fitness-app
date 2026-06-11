// M4-3（判断先行）：趋势判断 + 周对比的 typed 推导——verdict 句子的数据源。
// 规则（MVP 起步值）：趋势窗口 = 最近 4 个 e1RM 点，delta = 末−首；
// |delta| < 2.5 → flat；<2 点 → calibrating（校准期不下结论）。
// 周对比 = 本周 vs 严格上一个 ISO 周；上周无数据 → noComparison。

import XCTest
@testable import RedeLocalSnapshot

final class ProgressInsightTests: XCTestCase {
    private func point(_ sessionId: String, _ date: String, _ e1rm: Double) -> ProgressSnapshot.E1RMPoint {
        ProgressSnapshot.E1RMPoint(sessionId: sessionId, dateISO: date, e1RmKg: e1rm)
    }

    private func trend(_ id: String, _ points: [ProgressSnapshot.E1RMPoint]) -> ProgressSnapshot.ExerciseTrend {
        ProgressSnapshot.ExerciseTrend(
            exerciseId: id,
            points: points,
            latestE1RmKg: points.last?.e1RmKg ?? 0,
            bestE1RmKg: points.map(\.e1RmKg).max() ?? 0,
            bestWeightKg: 0
        )
    }

    // MARK: - 趋势判断

    func testFewerThanTwoPointsIsCalibrating() {
        let assessment = TrendInsight.assess(trend("bench-press", [point("s1", "2026-06-01", 72)]))
        XCTAssertEqual(assessment.call, .calibrating)
        XCTAssertEqual(assessment.windowSessionCount, 1)
    }

    func testRisingWindowIsUpWithDelta() {
        let assessment = TrendInsight.assess(trend("bench-press", [
            point("s1", "2026-06-01", 70), point("s2", "2026-06-03", 72.5),
            point("s3", "2026-06-05", 75), point("s4", "2026-06-08", 77.5),
        ]))
        XCTAssertEqual(assessment.call, .up)
        XCTAssertEqual(assessment.deltaKg, 7.5, accuracy: 1e-9)
        XCTAssertEqual(assessment.windowSessionCount, 4)
    }

    func testWindowIsLastFourPointsOnly() {
        // 6 个点：窗口取末 4 个（s3..s6），delta = 80−70 = 10
        let assessment = TrendInsight.assess(trend("bench-press", [
            point("s1", "2026-06-01", 90), point("s2", "2026-06-02", 85),
            point("s3", "2026-06-03", 70), point("s4", "2026-06-04", 72),
            point("s5", "2026-06-05", 76), point("s6", "2026-06-08", 80),
        ]))
        XCTAssertEqual(assessment.call, .up)
        XCTAssertEqual(assessment.deltaKg, 10, accuracy: 1e-9)
        XCTAssertEqual(assessment.windowSessionCount, 4)
    }

    func testSmallDeltaIsFlat() {
        let assessment = TrendInsight.assess(trend("bench-press", [
            point("s1", "2026-06-01", 72), point("s2", "2026-06-05", 73),
        ]))
        XCTAssertEqual(assessment.call, .flat)
    }

    func testFallingWindowIsDown() {
        let assessment = TrendInsight.assess(trend("bench-press", [
            point("s1", "2026-06-01", 80), point("s2", "2026-06-05", 72),
        ]))
        XCTAssertEqual(assessment.call, .down)
        XCTAssertEqual(assessment.deltaKg, -8, accuracy: 1e-9)
    }

    // MARK: - 关键动作选择（趋势图画谁：点数最多，平手取 exerciseId 字典序）

    func testKeyExercisePicksMostTrainedThenLexical() {
        let snapshot = ProgressSnapshot(
            history: [],
            exerciseTrends: [
                trend("bench-press", [point("a", "2026-06-01", 70), point("b", "2026-06-03", 72)]),
                trend("squat", [point("a", "2026-06-01", 100), point("b", "2026-06-03", 102)]),
                trend("row", [point("a", "2026-06-01", 60)]),
            ],
            weeklyVolume: []
        )
        XCTAssertEqual(TrendInsight.keyExercise(of: snapshot)?.exerciseId, "bench-press")
    }

    func testKeyExerciseIsNilForEmptySnapshot() {
        let snapshot = ProgressSnapshot(history: [], exerciseTrends: [], weeklyVolume: [])
        XCTAssertNil(TrendInsight.keyExercise(of: snapshot))
    }

    // MARK: - 周对比（FR-PR3「与上周对比一句话」素材）

    private func week(_ start: String, _ volume: Double, sets: Int = 10, sessions: Int = 3) -> ProgressSnapshot.WeeklyVolume {
        ProgressSnapshot.WeeklyVolume(weekStartISO: start, totalVolumeKg: volume, setCount: sets, sessionCount: sessions)
    }

    func testAdjacentWeeksCompare() {
        // 2026-06-08 的上一个 ISO 周 = 2026-06-01
        let comparison = WeeklyInsight.compare(latest: week("2026-06-08", 5500), weeks: [
            week("2026-06-08", 5500), week("2026-06-01", 5000),
        ])
        XCTAssertEqual(comparison, .vsPreviousWeek(deltaPercent: 10))
    }

    func testGapWeekIsDistinctFromFirstWeek() {
        // 上一个 ISO 周（2026-06-01）无数据（隔周训练）→ 不硬比，但不是「第一周」
        let comparison = WeeklyInsight.compare(latest: week("2026-06-08", 5500), weeks: [
            week("2026-06-08", 5500), week("2026-05-25", 5000),
        ])
        XCTAssertEqual(comparison, .previousWeekMissing)
    }

    func testFirstWeekHasNoComparison() {
        let comparison = WeeklyInsight.compare(latest: week("2026-06-08", 5500), weeks: [week("2026-06-08", 5500)])
        XCTAssertEqual(comparison, .firstWeek)
    }

    func testDeltaPercentIsRoundedToInteger() {
        let comparison = WeeklyInsight.compare(latest: week("2026-06-08", 5125), weeks: [
            week("2026-06-08", 5125), week("2026-06-01", 4500),
        ])
        XCTAssertEqual(comparison, .vsPreviousWeek(deltaPercent: 14)) // 13.88… → 14
    }

    func testZeroPreviousVolumeMeansNoComparison() {
        let comparison = WeeklyInsight.compare(latest: week("2026-06-08", 5500), weeks: [
            week("2026-06-08", 5500), week("2026-06-01", 0),
        ])
        XCTAssertEqual(comparison, .previousWeekMissing)
    }

    // MARK: - §6.2 相对带宽 + 关键动作复合优先（2026-06-11）

    func testSmallLiftTrendIsNoLongerAlwaysFlat() {
        // 侧平举量级：e1RM 10 → 带宽 max(1.25, 0.3) = 1.25；+1.5 必须判 up
        // （旧绝对带宽 2.5 会把 ±25% 全部吃成 flat）
        let assessment = TrendInsight.assess(trend("lateral-raise", [
            point("s1", "2026-06-01", 10), point("s2", "2026-06-08", 11.5),
        ]))
        XCTAssertEqual(assessment.call, .up)
    }

    func testBigLiftBandScalesRelative() {
        // e1RM 100 → 带宽 3.0：+2.6（旧口径已判 up）现在如实 flat——3% 内是噪声
        let assessment = TrendInsight.assess(trend("squat", [
            point("s1", "2026-06-01", 100), point("s2", "2026-06-08", 102.6),
        ]))
        XCTAssertEqual(assessment.call, .flat)
    }

    func testKeyExercisePrefersCompoundOverPointCount() {
        let snapshot = ProgressSnapshot(
            history: [],
            exerciseTrends: [
                trend("lateral-raise", [point("s1", "2026-06-01", 10), point("s2", "2026-06-03", 10),
                                        point("s3", "2026-06-05", 10), point("s4", "2026-06-08", 10)]),
                trend("squat", [point("s1", "2026-06-01", 100), point("s2", "2026-06-08", 102)]),
            ],
            weeklyVolume: []
        )
        let facts = ["squat": ExerciseStatsFacts(loadFactor: 1.0, isCompound: true)]
        // 复合优先：深蹲 2 点也压过侧平举 4 点
        XCTAssertEqual(TrendInsight.keyExercise(of: snapshot, facts: facts)?.exerciseId, "squat")
        // facts 缺省 → 退化为旧「点数最多」口径
        XCTAssertEqual(TrendInsight.keyExercise(of: snapshot)?.exerciseId, "lateral-raise")
    }
}
