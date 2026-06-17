// FR-TR10 热身阶梯合同：六种 loadType + compound/isolation + 空杆 + 轻负荷收敛 + assisted 方向反转
// + 吸附档位 + 单调严格小于工作重 + 确定性。值为 MVP 保守起步值（待校准），测试锁定结构与不变量。

import XCTest
@testable import RedeTrainingDecision

final class WarmupLadderEngineTests: XCTestCase {
    private func gen(
        work: Double, loadType: String = "external", equipment: String = "barbell",
        kind: String = "compound", start: Double = 20, unit: LoadUnit = .kg
    ) -> [WarmupStep] {
        WarmupLadderEngine.generate(workWeightKg: work, loadType: loadType, equipment: equipment, kind: kind, startWeightKg: start, unit: unit)
    }

    // MARK: external

    func testBarbellCompoundFullLadder() {
        let steps = gen(work: 100, equipment: "barbell", kind: "compound")
        XCTAssertEqual(steps.map(\.targetWeightKg), [20, 50, 70, 90], "空杆 + 50/70/90%")
        XCTAssertEqual(steps.map(\.targetReps), [8, 5, 3, 1])
        XCTAssertEqual(steps.first?.kind, .emptyBar, "杠铃首级=空杆动作模式预热")
        XCTAssertTrue(steps.dropFirst().allSatisfy { $0.kind == .percent })
    }

    func testDumbbellIsolationTwoLevelsNoEmptyBar() {
        let steps = gen(work: 20, equipment: "dumbbell", kind: "isolation", start: 5)
        XCTAssertFalse(steps.contains { $0.kind == .emptyBar }, "非杠铃无空杆")
        XCTAssertEqual(steps.count, 2, "isolation 两级")
        XCTAssertTrue(steps.allSatisfy { $0.targetWeightKg < 20 }, "热身严格轻于工作组")
    }

    func testWorkAtFloorYieldsNoWarmup() {
        XCTAssertTrue(gen(work: 20, equipment: "barbell").isEmpty, "工作重=空杆地板 → 无需热身")
    }

    func testLightLoadCollapsesToMinimal() {
        // 轻负荷：百分比档大多被夹到地板而去重，只剩空杆（+ 至多一档），全 < 工作重。
        let steps = gen(work: 25, equipment: "barbell", kind: "compound")
        XCTAssertEqual(steps.first?.kind, .emptyBar)
        XCTAssertTrue(steps.allSatisfy { $0.targetWeightKg < 25 })
        XCTAssertLessThanOrEqual(steps.count, 3, "轻负荷阶梯收敛")
    }

    func testExternalLadderMonotonicAndBelowWork() {
        let steps = gen(work: 140, equipment: "barbell", kind: "compound")
        let ws = steps.map(\.targetWeightKg)
        XCTAssertEqual(ws, ws.sorted(), "重量单调不减")
        XCTAssertEqual(ws.count, Set(ws).count, "无重复档")
        XCTAssertTrue(ws.allSatisfy { $0 < 140 }, "全部严格小于工作重")
    }

    func testLbModeSnapsToPoundGrid() {
        // lb 模式：空杆吸附为 45lb（≈20.41kg），百分比档落 5lb 格。
        let steps = gen(work: 225 / 2.2046226218, equipment: "barbell", kind: "compound", unit: .lb)
        XCTAssertEqual(steps.first?.kind, .emptyBar)
        // 每档换算回 lb 应是 5 的倍数（吸附到磅格）。
        for s in steps {
            let lb = (s.targetWeightKg * 2.2046226218).rounded()
            XCTAssertEqual(lb.truncatingRemainder(dividingBy: 5), 0, accuracy: 0.5, "落 5lb 格: \(lb)")
        }
    }

    // MARK: bodyweight / band（无重量轴）

    func testBodyweightCompoundOneMovementPrep() {
        let steps = gen(work: 0, loadType: "bodyweight", equipment: "bodyweight", kind: "compound", start: 0)
        XCTAssertEqual(steps.count, 1)
        XCTAssertEqual(steps.first?.kind, .movementPrep)
        XCTAssertEqual(steps.first?.targetWeightKg, 0, "无重量轴")
    }

    func testBodyweightIsolationNoWarmup() {
        XCTAssertTrue(gen(work: 0, loadType: "bodyweight", equipment: "bodyweight", kind: "isolation", start: 0).isEmpty)
    }

    func testBandTreatedAsMovementPrep() {
        let steps = gen(work: 0, loadType: "band", equipment: "band", kind: "compound", start: 0)
        XCTAssertEqual(steps.map(\.kind), [.movementPrep])
    }

    // MARK: bodyweight-plus（负重自重）

    func testBodyweightPlusPureBodyweightFirstThenLoad() {
        let steps = gen(work: 40, loadType: "bodyweight-plus", equipment: "bodyweight", kind: "compound", start: 0)
        XCTAssertEqual(steps.first?.targetWeightKg, 0, "首级纯自重")
        XCTAssertEqual(steps.first?.kind, .movementPrep)
        XCTAssertTrue(steps.contains { $0.kind == .percent && $0.targetWeightKg > 0 && $0.targetWeightKg < 40 }, "再加一档外挂、轻于工作外挂")
    }

    // MARK: assisted（方向反转：热身辅助更多=更轻）

    func testAssistedWarmupHasMoreAssistThanWork() {
        let steps = gen(work: 30, loadType: "assisted", equipment: "selectorized", kind: "compound", start: 0)
        XCTAssertFalse(steps.isEmpty)
        XCTAssertTrue(steps.allSatisfy { $0.targetWeightKg > 30 }, "热身辅助量 > 工作辅助量（更轻=更安全）")
        // 展示序从最多辅助递减逼近工作辅助。
        let ws = steps.map(\.targetWeightKg)
        XCTAssertEqual(ws, ws.sorted(by: >), "辅助量递减")
    }

    // MARK: 通用

    func testUnknownLoadTypeYieldsNoWarmup() {
        XCTAssertTrue(gen(work: 50, loadType: "made-up").isEmpty, "未知负重语义安全降级=无热身")
    }

    func testDeterministic() {
        XCTAssertEqual(gen(work: 100, equipment: "barbell"), gen(work: 100, equipment: "barbell"), "同输入必同阶梯")
    }
}
