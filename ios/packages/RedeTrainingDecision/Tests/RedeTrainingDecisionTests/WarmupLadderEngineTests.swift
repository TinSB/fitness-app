// FR-TR10 热身阶梯合同：六种 loadType + compound/isolation + 空杆 + 轻负荷收敛 + assisted 方向反转
// + 吸附档位 + 单调严格小于工作重 + 确定性。值为 MVP 保守起步值（待校准），测试锁定结构与不变量。

import XCTest
@testable import RedeTrainingDecision

final class WarmupLadderEngineTests: XCTestCase {
    /// repMin（次数区间下限）默认 5：力量式爬坡（2026-10-20 前的唯一口径）；增肌式另有专门的测试。
    private func gen(
        work: Double, repMin: Int = 5, loadType: String = "external", equipment: String = "barbell",
        kind: String = "compound", unit: LoadUnit = .kg, scope: WarmupScope = .full
    ) -> [WarmupStep] {
        WarmupLadderEngine.generate(workWeightKg: work, workRepMin: repMin, loadType: loadType, equipment: equipment,
                                    kind: kind, unit: unit, scope: scope)
    }

    private let lbPerKg = 2.2046226218
    private func lb(_ steps: [WarmupStep]) -> [Double] { steps.map { ($0.targetWeightKg * lbPerKg).rounded() } }

    // MARK: external

    func testBarbellCompoundFullLadder() {
        let steps = gen(work: 100, equipment: "barbell", kind: "compound")
        XCTAssertEqual(steps.map(\.targetWeightKg), [20, 50, 70, 90], "空杆 + 50/70/90%")
        XCTAssertEqual(steps.map(\.targetReps), [8, 5, 3, 1])
        XCTAssertEqual(steps.first?.kind, .emptyBar, "杠铃首级=空杆动作模式预热")
        XCTAssertTrue(steps.dropFirst().allSatisfy { $0.kind == .percent })
    }

    func testDumbbellIsolationLightCollapsesToOneStepNoEmptyBar() {
        // 20 kg：60/80% 吸附成 12.5 / 15，只差一格（< 两格）→ 只留 12.5 一级。
        let steps = gen(work: 20, equipment: "dumbbell", kind: "isolation")
        XCTAssertFalse(steps.contains { $0.kind == .emptyBar }, "非杠铃无空杆")
        XCTAssertEqual(steps.map(\.targetWeightKg), [12.5])
        XCTAssertTrue(steps.allSatisfy { $0.targetWeightKg < 20 }, "热身严格轻于工作组")
    }

    func testHeavierIsolationKeepsTwoLevels() {
        let steps = gen(work: 40, equipment: "cable", kind: "isolation")
        XCTAssertEqual(steps.map(\.targetWeightKg), [25, 32.5], "60/80% 间隔够大时两级都留")
    }

    // MARK: 台阶最小间隔（训练流审查 P1）

    func testOwnerBench70lbIsEmptyBarOnly() {
        // 真机实测：杠铃卧推 70 lb 此前给 45 → 50 → 65。50 只比空杆重 5 lb，65 离工作重只差一格。
        // （力量组口径；增肌组见 testOwnerBench70lbAtHypertrophyRepsGetsBarThenOneLightSet。）
        let steps = gen(work: 70 / lbPerKg, equipment: "barbell", kind: "compound", unit: .lb)
        XCTAssertEqual(lb(steps), [45])
        XCTAssertEqual(steps.map(\.kind), [.emptyBar])
    }

    func testModerateBarbellLbLadderIsSpaced() {
        XCTAssertEqual(lb(gen(work: 95 / lbPerKg, equipment: "barbell", kind: "compound", unit: .lb)), [45, 65, 85])
        XCTAssertEqual(lb(gen(work: 135 / lbPerKg, equipment: "barbell", kind: "compound", unit: .lb)), [45, 70, 95, 120])
    }

    func testAdjacentRungsKeepMinimumGap() {
        let cases: [(work: Double, equipment: String, kind: String, unit: LoadUnit)] = [
            (31.75, "barbell", "compound", .lb), (43, "barbell", "compound", .lb), (61, "barbell", "compound", .kg),
            (100, "barbell", "compound", .kg), (45, "selectorized", "compound", .lb), (40, "selectorized", "compound", .kg),
            (14, "dumbbell", "isolation", .lb), (30, "cable", "isolation", .kg), (60, "plate-loaded", "compound", .kg),
        ]
        for work in [20.0, 30, 50, 80] {   // assisted 镜像：辅助量递减，离工作辅助量至少两格
            let step = LoadGrid.stepKg(equipment: "selectorized", unit: .kg)
            let ws = gen(work: work, loadType: "assisted", equipment: "selectorized", kind: "compound")
                .map(\.targetWeightKg)
            for (a, b) in zip(ws, ws.dropFirst()) {
                XCTAssertGreaterThanOrEqual(a - b, max(2 * step, work * 0.1) - 1e-6, "assisted \(work): \(ws)")
            }
            if ws.count > 1, let last = ws.last { XCTAssertGreaterThanOrEqual(last - work, 2 * step - 1e-6) }
        }
        for c in cases {
            let step = LoadGrid.stepKg(equipment: c.equipment, unit: c.unit)
            let steps = gen(work: c.work, equipment: c.equipment, kind: c.kind, unit: c.unit)
            let ws = steps.map(\.targetWeightKg)
            for (a, b) in zip(ws, ws.dropFirst()) {
                XCTAssertGreaterThanOrEqual(b - a, max(2 * step, c.work * 0.1) - 1e-6, "\(c): \(ws)")
            }
            // 复合动作「至少 1 级」的地板补位除外：只有一级时它可以离工作重不足两格。
            if ws.count > 1, let top = ws.last {
                XCTAssertGreaterThanOrEqual(c.work - top, 2 * step - 1e-6, "\(c): 最高一级离工作重至少两格 \(ws)")
            }
        }
    }

    // MARK: 已热过的部位（scope = .alreadyWarm）

    func testAlreadyWarmCompoundGetsOneBridgeStepNearSeventyPercent() {
        let steps = gen(work: 100, equipment: "barbell", kind: "compound", scope: .alreadyWarm)
        XCTAssertEqual(steps.map(\.targetWeightKg), [70])
        XCTAssertEqual(steps.first?.index, 1)
        XCTAssertEqual(steps.first?.kind, .percent, "过渡步不是空杆")
    }

    func testAlreadyWarmIsolationGetsNoWarmup() {
        XCTAssertTrue(gen(work: 40, equipment: "cable", kind: "isolation", scope: .alreadyWarm).isEmpty)
    }

    func testAlreadyWarmLightCompoundGetsNoWarmup() {
        // 完整阶梯只有空杆 → 没有带负重的一级可做过渡 → 不热身。
        XCTAssertTrue(gen(work: 70 / lbPerKg, equipment: "barbell", kind: "compound", unit: .lb, scope: .alreadyWarm).isEmpty)
        XCTAssertTrue(gen(work: 0, loadType: "bodyweight", equipment: "bodyweight", kind: "compound",
                          scope: .alreadyWarm).isEmpty, "纯自重动作模式预热在已热部位上省掉")
    }

    func testAssistedLadderIsSpacedToo() {
        // 审查 2026-10-18：辅助器械此前不走间隔规则，工作辅助 20 kg 给 30 / 25（各差一格）。
        XCTAssertEqual(gen(work: 20, loadType: "assisted", equipment: "selectorized", kind: "compound")
            .map(\.targetWeightKg), [30], "离工作辅助量不足两格的 25 不给")
        XCTAssertEqual(lb(gen(work: 60 / lbPerKg, loadType: "assisted", equipment: "selectorized", kind: "compound",
                              unit: .lb)), [80])
        XCTAssertEqual(gen(work: 50, loadType: "assisted", equipment: "selectorized", kind: "compound")
            .map(\.targetWeightKg), [70, 60], "间隔够大时两级都留，辅助量递减")
        XCTAssertEqual(gen(work: 15, loadType: "assisted", equipment: "selectorized", kind: "compound")
            .map(\.targetWeightKg), [20], "20 离工作辅助量只有一格、全被筛掉：复合动作保留辅助最多的一级")
    }

    func testAlreadyWarmBridgeMustBeTwoStepsBelowWork() {
        // 审查 2026-10-18：完整阶梯只剩被夹到地板的保底级、离工作重不足两格时，拿它当过渡步等于先做一组
        // 几乎一样重的 → 不热身。（2026-10-20 起非杠铃地板是最轻一格：5 kg 哑铃只有 2.5 kg 那一级。）
        XCTAssertTrue(gen(work: 5, equipment: "dumbbell", kind: "compound", scope: .alreadyWarm).isEmpty)
        XCTAssertEqual(gen(work: 27.5, equipment: "dumbbell", kind: "compound", scope: .alreadyWarm)
            .map(\.targetWeightKg), [20], "取最接近 70% 且离工作重至少两格的一级")
    }

    // MARK: 增肌式爬坡 + 器械从最轻一格起（2026-10-20 owner 真机反馈）

    func testOwnerLatPulldownGetsLightPulldownSetsFirst() {
        // 拉日第一个动作高位下拉（目录：绳索器械、复合、5 lb 一格、起始约 120 lb）。以前起始重量当地板，
        // owner 当天 75 lb 低于它 → 判「已在最低档」→ 一组都没有，只剩开合跳。
        let today = gen(work: 75 / lbPerKg, repMin: 8, equipment: "cable", kind: "compound", unit: .lb)
        XCTAssertEqual(lb(today), [40, 55])
        XCTAssertEqual(today.map(\.targetReps), [10, 5])
        XCTAssertTrue(today.allSatisfy { $0.kind == .percent })
        XCTAssertEqual(lb(gen(work: 100 / lbPerKg, repMin: 8, equipment: "cable", kind: "compound", unit: .lb)), [50, 75])
    }

    func testOwnerBench70lbAtHypertrophyRepsGetsBarThenOneLightSet() {
        // 审查 2026-10-20：卧推 70 lb、6–10 次 → 空杆 ×8，再 55 ×5（离空杆、离工作重都够两格）。
        // 力量组（下限 ≤5）照旧只给空杆，见 testOwnerBench70lbIsEmptyBarOnly。
        let steps = gen(work: 70 / lbPerKg, repMin: 6, equipment: "barbell", kind: "compound", unit: .lb)
        XCTAssertEqual(lb(steps), [45, 55])
        XCTAssertEqual(steps.map(\.kind), [.emptyBar, .percent])
        XCTAssertEqual(steps.map(\.targetReps), [8, 5])
    }

    func testMultiJointMachinesGetTwoSetsLikeCompounds() {
        // 腿举、器械推胸这类多关节器械（kind = accessory）当天第一个练这个部位时，增肌组也给两级：
        // 一组 50% 就直接上工作重，跨度太大。单关节孤立动作仍是一级。
        XCTAssertEqual(gen(work: 100, repMin: 10, equipment: "plate-loaded", kind: "accessory").map(\.targetWeightKg),
                       [50, 75])
        XCTAssertEqual(gen(work: 100, repMin: 10, equipment: "plate-loaded", kind: "isolation").map(\.targetWeightKg),
                       [50])
        XCTAssertTrue(gen(work: 100, repMin: 10, equipment: "plate-loaded", kind: "accessory", scope: .alreadyWarm).isEmpty,
                      "部位已热过的 accessory 照旧不热身")
    }

    func testHypertrophyWorkUsesTwoLighterSetsNotAHeavySingle() {
        // 练 8–12 次的人不需要最后一组 90% 单次：杠铃 100 kg、8–12 次 → 空杆、50 ×10、75 ×5。
        let steps = gen(work: 100, repMin: 8, equipment: "barbell", kind: "compound")
        XCTAssertEqual(steps.map(\.targetWeightKg), [20, 50, 75])
        XCTAssertEqual(steps.map(\.targetReps), [8, 10, 5])
        // 力量组（区间下限 ≤5）照旧 50/70/90% × 5/3/1。
        XCTAssertEqual(gen(work: 100, repMin: 5, equipment: "barbell", kind: "compound").map(\.targetWeightKg),
                       [20, 50, 70, 90])
    }

    func testHypertrophyIsolationGetsOneLightSet() {
        let steps = gen(work: 40, repMin: 12, equipment: "cable", kind: "isolation")
        XCTAssertEqual(steps.map(\.targetWeightKg), [20])
        XCTAssertEqual(steps.map(\.targetReps), [10])
        // 很轻的孤立动作（离工作重不足两格）不热身。
        XCTAssertTrue(gen(work: 15 / lbPerKg, repMin: 12, equipment: "dumbbell", kind: "isolation", unit: .lb).isEmpty)
    }

    func testAlreadyWarmAssistedBridgeStillHasMoreAssist() {
        let steps = gen(work: 30, loadType: "assisted", equipment: "selectorized", kind: "compound", scope: .alreadyWarm)
        XCTAssertEqual(steps.count, 1)
        XCTAssertTrue(steps.allSatisfy { $0.targetWeightKg > 30 }, "过渡步辅助量仍大于工作辅助量")
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
        let steps = gen(work: 0, loadType: "bodyweight", equipment: "bodyweight", kind: "compound")
        XCTAssertEqual(steps.count, 1)
        XCTAssertEqual(steps.first?.kind, .movementPrep)
        XCTAssertEqual(steps.first?.targetWeightKg, 0, "无重量轴")
    }

    func testBodyweightIsolationNoWarmup() {
        XCTAssertTrue(gen(work: 0, loadType: "bodyweight", equipment: "bodyweight", kind: "isolation").isEmpty)
    }

    func testBandTreatedAsMovementPrep() {
        let steps = gen(work: 0, loadType: "band", equipment: "band", kind: "compound")
        XCTAssertEqual(steps.map(\.kind), [.movementPrep])
    }

    // MARK: bodyweight-plus（负重自重）

    func testBodyweightPlusPureBodyweightFirstThenLoad() {
        let steps = gen(work: 40, loadType: "bodyweight-plus", equipment: "bodyweight", kind: "compound")
        XCTAssertEqual(steps.first?.targetWeightKg, 0, "首级纯自重")
        XCTAssertEqual(steps.first?.kind, .movementPrep)
        XCTAssertTrue(steps.contains { $0.kind == .percent && $0.targetWeightKg > 0 && $0.targetWeightKg < 40 }, "再加一档外挂、轻于工作外挂")
    }

    // MARK: assisted（方向反转：热身辅助更多=更轻）

    func testAssistedWarmupHasMoreAssistThanWork() {
        let steps = gen(work: 30, loadType: "assisted", equipment: "selectorized", kind: "compound")
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
