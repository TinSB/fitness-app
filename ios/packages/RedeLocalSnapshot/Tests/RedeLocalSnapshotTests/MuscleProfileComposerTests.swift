// B1（2026-07-07）：喂数管线包内组合层——rows/touches/e1rmRows → 完整 MuscleDevelopmentProfile。
// 语义锁：空输入=10 肌群全 calibrating（冷启动灰屏）；非空 rows → 非空聚合（批次 A 注意事项①
// 完整性断言）；touches unique 计数（同 session 两动作同肌群=1 次触达）；e1RM 只吃主肌群行；
// milestone floor 端到端生效；previous* rawValue 直通（非法键丢弃不崩）；estimates 按
// rawValue 排序确定（注意事项②）；previousPeaks 高值保留（max 单调跨 compose 生效）。

import XCTest
@testable import RedeLocalSnapshot

final class MuscleProfileComposerTests: XCTestCase {
    /// 6 个 ISO 周一（2026-06-01 起，周期性种子的日期锚）。
    private let mondays = ["2026-06-01", "2026-06-08", "2026-06-15",
                           "2026-06-22", "2026-06-29", "2026-07-06"]
    private let now = "2026-07-07"

    /// chest 6 周 × 每周 8 组 × 6 场触达 × 2 动作族的标准种子（够解锁、有暴露分）。
    private func chestSeed() -> (rows: [MuscleVolumeAggregator.ContributionRow],
                                 touches: [MuscleTouchRow]) {
        var rows: [MuscleVolumeAggregator.ContributionRow] = []
        var touches: [MuscleTouchRow] = []
        for (index, monday) in mondays.enumerated() {
            rows.append(.init(dateISO: monday, muscleRaw: "chest", weight: 1.0, setCount: 8))
            touches.append(.init(muscleRaw: "chest", sessionId: "s\(index)",
                                 familyId: index % 2 == 0 ? "horizontal-press" : "fly"))
        }
        return (rows, touches)
    }

    private func compose(rows: [MuscleVolumeAggregator.ContributionRow] = [],
                         touches: [MuscleTouchRow] = [],
                         e1rmRows: [MuscleE1RMRow] = [],
                         bestActual: [String: Double] = [:],
                         bestE1Rm: [String: Double] = [:],
                         previousLevels: [String: Int] = [:],
                         previousPeaks: [String: Int] = [:],
                         previousTierRaw: String? = nil) -> MuscleDevelopmentProfile {
        MuscleProfileComposer.compose(MuscleProfileComposer.Input(
            rows: rows, touches: touches, e1rmRows: e1rmRows,
            bestActualKgByExercise: bestActual, bestE1RmKgByExercise: bestE1Rm,
            unitSystem: "kg", previousLevels: previousLevels, previousPeaks: previousPeaks,
            previousTierRaw: previousTierRaw, nowISO: now))
    }

    func testEmptyInputYieldsAllCalibrating() {
        let p = compose()
        XCTAssertEqual(p.estimates.count, MuscleGroupID.allCases.count)
        XCTAssertTrue(p.estimates.allSatisfy { $0.decision == .insufficientData })
        // 校准中 level 占位 1（估算器头注契约：UI 灰显、不进 tier/balance）
        XCTAssertTrue(p.estimates.allSatisfy { $0.currentLevel == 1 })
        XCTAssertEqual(p.overallTier, .calibrating)
        XCTAssertNil(p.balanceScore)
        XCTAssertTrue(p.strengthMilestones.isEmpty)
        XCTAssertTrue(p.breakthroughs.isEmpty)
    }

    func testSeededChestUnlocksWhileOthersStayCalibrating() {
        let seed = chestSeed()
        let p = compose(rows: seed.rows, touches: seed.touches)
        let chest = p.estimates.first { $0.muscleId == .chest }
        // 完整性断言（注意事项①）：非空历史绝不折叠成"全员校准中"
        XCTAssertNotEqual(chest?.decision, MuscleDevelopmentDecision.insufficientData)
        XCTAssertGreaterThan(chest?.currentLevel ?? 0, 0)
        XCTAssertGreaterThan(chest?.score.exposureScore ?? 0, 0)
        // 未触达肌群保持校准中（逐肌群解锁，§6.5.9）
        let back = p.estimates.first { $0.muscleId == .back }
        XCTAssertEqual(back?.decision, .insufficientData)
    }

    func testTouchesCountUniqueSessionsNotRows() {
        // 区分力边界（审查 m2 加固）：2 场 × 每场 2 行同肌群 → unique=2 <3 不解锁；
        // 若误按行数计（4 ≥3）会解锁——两种实现在此产生相反结果。组数给 2/场
        //（总 4 <8）确保「或 8 组」支路不会替它解锁。
        var rows: [MuscleVolumeAggregator.ContributionRow] = []
        var touches: [MuscleTouchRow] = []
        for (index, monday) in mondays.prefix(2).enumerated() {
            rows.append(.init(dateISO: monday, muscleRaw: "biceps", weight: 1.0, setCount: 2))
            touches.append(.init(muscleRaw: "biceps", sessionId: "s\(index)", familyId: "curl"))
            touches.append(.init(muscleRaw: "biceps", sessionId: "s\(index)", familyId: "curl"))
        }
        let p = compose(rows: rows, touches: touches)
        let biceps = p.estimates.first { $0.muscleId == .biceps }
        XCTAssertEqual(biceps?.decision, .insufficientData)   // 行数计数会在此失败
        // 对照组：补第 3 个不同 session → 解锁（证明卡住的确是 unique 计数）
        rows.append(.init(dateISO: mondays[2], muscleRaw: "biceps", weight: 1.0, setCount: 2))
        touches.append(.init(muscleRaw: "biceps", sessionId: "s2", familyId: "curl"))
        let p2 = compose(rows: rows, touches: touches)
        XCTAssertNotEqual(p2.estimates.first { $0.muscleId == .biceps }?.decision,
                          MuscleDevelopmentDecision.insufficientData)
    }

    func testE1RMRowsFeedPerformanceEvidence() {
        let seed = chestSeed()
        // 基线窗（6-24 周前）旧点 + 近窗（6 周内）新高点 → rising（窗口口径 §6.5.6）
        let e1rm: [MuscleE1RMRow] = [
            .init(muscleRaw: "chest", dateISO: "2026-04-06", e1RmKg: 80),
            .init(muscleRaw: "chest", dateISO: "2026-04-20", e1RmKg: 80),
            .init(muscleRaw: "chest", dateISO: "2026-07-06", e1RmKg: 88),
        ]
        let p = compose(rows: seed.rows, touches: seed.touches, e1rmRows: e1rm)
        let chest = p.estimates.first { $0.muscleId == .chest }
        XCTAssertTrue(chest?.evidence.contains { $0.code == "e1rmRising" } ?? false)
        XCTAssertGreaterThan(chest?.score.performanceScore ?? 0,
                             MuscleLevelModelConfig.v1.performanceBaseScore - 0.001)
    }

    func testMilestoneFloorAppliesEndToEnd() {
        // 审查 M1 加固：种子必须让曲线级 <10，floor 才有事可做——用有/无 milestone
        // 对照自证（chestSeed 满暴露曲线级 12 > floor 10，floor 在那儿是死代码）。
        // 3 场 × 3 组（解锁但暴露低）→ 曲线级远低于 10。
        var rows: [MuscleVolumeAggregator.ContributionRow] = []
        var touches: [MuscleTouchRow] = []
        for (index, monday) in mondays.prefix(3).enumerated() {
            rows.append(.init(dateISO: monday, muscleRaw: "chest", weight: 1.0, setCount: 3))
            touches.append(.init(muscleRaw: "chest", sessionId: "s\(index)", familyId: "horizontal-press"))
        }
        let without = compose(rows: rows, touches: touches)
        let chestBefore = without.estimates.first { $0.muscleId == .chest }
        XCTAssertLessThan(chestBefore?.currentLevel ?? 99, 10)      // 对照组有效性
        let p = compose(rows: rows, touches: touches, bestActual: ["bench-press": 100])
        let chest = p.estimates.first { $0.muscleId == .chest }
        XCTAssertEqual(chest?.currentLevel, 10)                     // floor 真实抬底
        XCTAssertTrue(chest?.evidence.contains { $0.code == "milestoneFloorApplied" } ?? false)
        XCTAssertEqual(chest?.levelProgress, 0)                     // 抬底后不显示假进度
        XCTAssertTrue(p.strengthMilestones.contains { $0.milestoneId == "bench-100kg" })
    }

    func testPreviousPeaksSurviveAndInvalidKeysDropped() {
        let seed = chestSeed()
        let p = compose(rows: seed.rows, touches: seed.touches,
                        previousPeaks: ["chest": 15, "not-a-muscle": 9],
                        previousTierRaw: "garbage-tier")
        let chest = p.estimates.first { $0.muscleId == .chest }
        XCTAssertEqual(chest?.peakLevel, 15)                        // 峰值只升不降
        XCTAssertLessThan(chest?.currentLevel ?? 99, 15)            // 对照：当前级远低于峰值
        // 非法肌群键/非法 tier 字符串如实丢弃、不崩（decode 失败=无记忆教义的类型层面）
        XCTAssertEqual(p.estimates.count, MuscleGroupID.allCases.count)
    }

    func testEstimatesSortedByRawValueDeterministically() {
        let seed = chestSeed()
        let p = compose(rows: seed.rows, touches: seed.touches)
        let ids = p.estimates.map(\.muscleId.rawValue)
        XCTAssertEqual(ids, ids.sorted())                           // 注意事项②：消费方免排序
    }

    func testAggregationIntegrityNonEmptyRowsNonEmptyProfileSignal() {
        // 最小非空输入（1 行）也必须在对应肌群上留下暴露痕迹（进校准计数），
        // 绝不静默丢历史（批次 A 注意事项①的端到端面）。
        let rows = [MuscleVolumeAggregator.ContributionRow(
            dateISO: "2026-07-06", muscleRaw: "quads", weight: 1.0, setCount: 3)]
        let touches = [MuscleTouchRow(muscleRaw: "quads", sessionId: "s0", familyId: "squat")]
        let p = compose(rows: rows, touches: touches)
        let quads = p.estimates.first { $0.muscleId == .quads }
        // 1 场 3 组不够解锁 → 仍校准中，但必须留 shortHistory limitation 痕迹
        //（历史进了管线、只是量不够——绝不静默丢失）
        XCTAssertEqual(quads?.decision, .insufficientData)
        XCTAssertTrue(quads?.limitations.contains { $0.code == "shortHistory" } ?? false)
    }
}
