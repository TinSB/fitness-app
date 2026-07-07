// MLE-1b（2026-07-07）：贡献行 → 每肌群每 ISO 周 fractional 组数时序。
// 语义锁：贡献以原始值行传入（muscleRaw 字符串桥接两包同值枚举，Master §5 禁跨包
// 依赖）；周锚复用 SnapshotDayMath.isoWeekStart；未知 muscleRaw 防御跳过；
// fractionalSets = setCount × weight 按（肌群, 周）累加。

import XCTest
@testable import RedeLocalSnapshot

final class MuscleVolumeAggregatorTests: XCTestCase {
    private func row(_ dateISO: String, _ muscle: String, _ weight: Double, sets: Int)
        -> MuscleVolumeAggregator.ContributionRow {
        MuscleVolumeAggregator.ContributionRow(
            dateISO: dateISO, muscleRaw: muscle, weight: weight, setCount: sets)
    }

    func testSingleSessionAggregatesByMuscleAndWeek() {
        // 2026-07-06 是周一（该周 weekStart 即 2026-07-06）
        let rows = [
            row("2026-07-06", "chest", 1.0, sets: 3),
            row("2026-07-06", "triceps", 0.5, sets: 3),
            row("2026-07-06", "chest", 1.0, sets: 2), // 同周第二个胸动作
        ]
        let series = MuscleVolumeAggregator.weeklyFractionalSets(rows: rows)
        XCTAssertEqual(series[.chest]?["2026-07-06"], 5.0)      // 3 + 2
        XCTAssertEqual(series[.triceps]?["2026-07-06"], 1.5)    // 3 × 0.5
    }

    func testCrossWeekSplitsByISOWeek() {
        let rows = [
            row("2026-07-05", "back", 1.0, sets: 4), // 周日 → 周锚 2026-06-29
            row("2026-07-06", "back", 1.0, sets: 4), // 周一 → 周锚 2026-07-06
        ]
        let series = MuscleVolumeAggregator.weeklyFractionalSets(rows: rows)
        XCTAssertEqual(series[.back]?["2026-06-29"], 4.0)
        XCTAssertEqual(series[.back]?["2026-07-06"], 4.0)
    }

    func testUnknownMuscleRawIsDefensivelySkipped() {
        let rows = [
            row("2026-07-06", "forearm", 1.0, sets: 3),   // 契约外（上游本应过滤，防御）
            row("2026-07-06", "not-a-muscle", 1.0, sets: 3),
            row("2026-07-06", "quads", 1.0, sets: 2),
        ]
        let series = MuscleVolumeAggregator.weeklyFractionalSets(rows: rows)
        XCTAssertEqual(series.count, 1)
        XCTAssertEqual(series[.quads]?["2026-07-06"], 2.0)
    }

    func testInvalidDateAndEmptyInputAreSafe() {
        XCTAssertTrue(MuscleVolumeAggregator.weeklyFractionalSets(rows: []).isEmpty)
        let rows = [row("not-a-date", "chest", 1.0, sets: 3)]
        XCTAssertTrue(MuscleVolumeAggregator.weeklyFractionalSets(rows: rows).isEmpty)
    }

    func testZeroSetRowsContributeNothing() {
        let rows = [row("2026-07-06", "chest", 1.0, sets: 0)]
        let series = MuscleVolumeAggregator.weeklyFractionalSets(rows: rows)
        XCTAssertNil(series[.chest]?["2026-07-06"])
    }

    func testNegativeAndNonPositiveWeightRowsAreSkipped() {
        // 防御 guard（setCount > 0 && weight > 0）被误改（如 != 0）时转红（审查 MINOR）
        let rows = [
            row("2026-07-06", "chest", 1.0, sets: -3),
            row("2026-07-06", "back", 0, sets: 4),
            row("2026-07-06", "quads", -0.5, sets: 4),
        ]
        XCTAssertTrue(MuscleVolumeAggregator.weeklyFractionalSets(rows: rows).isEmpty)
    }
}
