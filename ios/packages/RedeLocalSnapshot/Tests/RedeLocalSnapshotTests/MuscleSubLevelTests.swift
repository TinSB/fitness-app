// 子肌群等级（2026-07-09，owner 拍板「详情页+效果优先+归属直接进」）。
// 语义锁：children 表只 back=[lats,upper-back,traps]、shoulders=[front/side/rear-delt]
//（胸腿等无子层）；子分数=子暴露（锚 12 组/周,大块的量分给 2-3 子块）×freq+**继承
// 大块 performance**（强度是大块属性,子块共享——区分度全靠暴露）；曲线/置信封顶
// 沿大块同款；0 量子块如实显示（Lv.1+0 组——「你的斜方 0 组」正是钻取价值）；
// 子层纯展示不进 tier/balance/决策（防低置信污染）。

import XCTest
@testable import RedeLocalSnapshot

final class MuscleSubLevelTests: XCTestCase {
    private let mondays = ["2026-06-01", "2026-06-08", "2026-06-15",
                           "2026-06-22", "2026-06-29", "2026-07-06"]

    private func fineRows(_ spec: [(String, Double)]) -> [MuscleVolumeAggregator.ContributionRow] {
        // spec: (子肌群 raw, 每周组数)——6 周均匀
        var rows: [MuscleVolumeAggregator.ContributionRow] = []
        for monday in mondays {
            for (raw, sets) in spec where sets > 0 {
                rows.append(.init(dateISO: monday, muscleRaw: raw, weight: 1.0, setCount: Int(sets)))
            }
        }
        return rows
    }

    func testChildrenTableOnlyBackAndShoulders() {
        XCTAssertEqual(MuscleSubLevelBuilder.children(of: .back), ["lats", "upper-back", "traps"])
        XCTAssertEqual(MuscleSubLevelBuilder.children(of: .shoulders), ["front-delt", "side-delt", "rear-delt"])
        XCTAssertNil(MuscleSubLevelBuilder.children(of: .chest))
        XCTAssertNil(MuscleSubLevelBuilder.children(of: .quads))
    }

    func testSubLevelsSplitByExposure() {
        // 背阔 12 组/周（满锚）、上背 6 组/周（半量）、斜方 0——等级梯度如实
        let subs = MuscleSubLevelBuilder.subLevels(
            parent: .back,
            fineRows: fineRows([("lats", 12), ("upper-back", 6)]),
            parentPerformanceScore: 15, parentConfidence: .high,
            nowISO: "2026-07-07", config: .current)
        XCTAssertEqual(subs.map(\.muscleRaw), ["lats", "upper-back", "traps"])
        let lats = subs[0]; let upper = subs[1]; let traps = subs[2]
        XCTAssertGreaterThan(lats.level, upper.level)
        XCTAssertGreaterThan(upper.level, traps.level)
        XCTAssertEqual(traps.weeklyEffectiveAvg, 0)      // 0 量如实
        XCTAssertEqual(traps.level, 1)                   // 0 量=Lv.1 精确锁（审查 S1：
                                                          // 不继承 parent performance——
                                                          // 没练过的部位不吃大块强度分）
    }

    func testParentPerformanceInheritedEqually() {
        // 同暴露、不同 parent performance：等级同升（强度是大块属性子块共享）
        let low = MuscleSubLevelBuilder.subLevels(
            parent: .back, fineRows: fineRows([("lats", 12)]),
            parentPerformanceScore: 0, parentConfidence: .high,
            nowISO: "2026-07-07", config: .current)
        let high = MuscleSubLevelBuilder.subLevels(
            parent: .back, fineRows: fineRows([("lats", 12)]),
            parentPerformanceScore: 30, parentConfidence: .high,
            nowISO: "2026-07-07", config: .current)
        XCTAssertGreaterThan(high[0].level, low[0].level)
    }

    func testConfidenceCapAppliesToSubLevels() {
        // 大块 low 置信 → 子块同封 Lv.5（§3.4 行为表达沿大块）
        let subs = MuscleSubLevelBuilder.subLevels(
            parent: .back, fineRows: fineRows([("lats", 12)]),
            parentPerformanceScore: 30, parentConfidence: .low,
            nowISO: "2026-07-07", config: .current)
        XCTAssertLessThanOrEqual(subs[0].level, MuscleLevelModelConfig.current.lowConfidenceLevelCap)
    }

    func testIrrelevantFineRowsIgnored() {
        // 非本大块的细粒度行（front-delt 混进 back 的输入）如实忽略
        let subs = MuscleSubLevelBuilder.subLevels(
            parent: .back, fineRows: fineRows([("lats", 6), ("front-delt", 12)]),
            parentPerformanceScore: 15, parentConfidence: .high,
            nowISO: "2026-07-07", config: .current)
        XCTAssertEqual(subs.first { $0.muscleRaw == "lats" }?.weeklyEffectiveAvg ?? 0, 6, accuracy: 0.01)
        XCTAssertNil(subs.first { $0.muscleRaw == "front-delt" })
    }
}
