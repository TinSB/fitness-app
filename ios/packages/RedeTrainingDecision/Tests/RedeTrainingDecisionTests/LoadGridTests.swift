// LoadGrid 真实梯子合同（2026-06-15 单位原生重构）。
// 底线：公斤 + 磅非哑铃 = 等距，snap/next 必须与旧 roundToIncrement 逐位等价（零回归）；
// 磅哑铃 = 分段梯子（轻段 2.5lb / 中段 5lb），吸附最近、进阶取相邻格。

import XCTest
@testable import RedeTrainingDecision

final class LoadGridTests: XCTestCase {
    private let lbPerKg = 2.204_622_621_8
    private func lb(_ kg: Double) -> Double { kg * lbPerKg }
    private func kg(_ lb: Double) -> Double { lb / lbPerKg }
    /// 旧引擎取整：max(step, round(w/step)*step)。
    private func oldRound(_ w: Double, _ step: Double) -> Double { max(step, (w / step).rounded() * step) }

    // MARK: 零回归——等距器械 snap ≡ 旧 roundToIncrement

    func testKgEquidistantSnapEqualsOldRound() {
        for i in stride(from: 0, through: 1200, by: 3) {     // 0…120kg, 0.3 步
            let w = Double(i) / 10.0
            XCTAssertEqual(LoadGrid.snapKg(w, equipment: "dumbbell", unit: .kg), oldRound(w, 2.5), accuracy: 1e-9, "kg 哑铃零回归 @\(w)")
            XCTAssertEqual(LoadGrid.snapKg(w, equipment: "barbell", unit: .kg), oldRound(w, 2.5), accuracy: 1e-9, "kg 杠铃零回归 @\(w)")
            XCTAssertEqual(LoadGrid.snapKg(w, equipment: "selectorized", unit: .kg), oldRound(w, 5), accuracy: 1e-9, "kg 选重栈零回归 @\(w)")
        }
    }

    func testLbNonDumbbellSnapEqualsOldRound() {
        // 磅杠铃/选重栈仍等距（step = lb档÷lbPerKg），与旧 roundToIncrement 同式
        let barStep = LoadGrid.stepKg(equipment: "barbell", unit: .lb)
        let selStep = LoadGrid.stepKg(equipment: "selectorized", unit: .lb)
        for i in stride(from: 0, through: 1200, by: 3) {
            let w = Double(i) / 10.0
            XCTAssertEqual(LoadGrid.snapKg(w, equipment: "barbell", unit: .lb), oldRound(w, barStep), accuracy: 1e-9, "lb 杠铃零回归 @\(w)")
            XCTAssertEqual(LoadGrid.snapKg(w, equipment: "selectorized", unit: .lb), oldRound(w, selStep), accuracy: 1e-9, "lb 选重栈零回归 @\(w)")
        }
    }

    func testNextRungKgEquidistantEqualsOldStepLogic() {
        // 等距进阶 ≡ snap(w)±step（旧引擎 roundToIncrement(w±step,step) 等价）
        for i in stride(from: 5, through: 1200, by: 7) {
            let w = Double(i) / 10.0
            let upKg = LoadGrid.nextRungKg(w, equipment: "dumbbell", unit: .kg, up: true)
            XCTAssertEqual(upKg, oldRound(w, 2.5) + 2.5, accuracy: 1e-9, "kg 进阶一档 @\(w)")
            let downKg = LoadGrid.nextRungKg(w, equipment: "dumbbell", unit: .kg, up: false)
            XCTAssertEqual(downKg, max(2.5, oldRound(w, 2.5) - 2.5), accuracy: 1e-9, "kg 回退一档 @\(w)")
        }
    }

    // MARK: 磅哑铃分段梯子（owner 例子 + 边界）

    func testLbDumbbellSnapsToRealRungs() {
        func snapLb(_ kgVal: Double) -> Double { lb(LoadGrid.snapKg(kgVal, equipment: "dumbbell", unit: .lb)) }
        XCTAssertEqual(snapLb(30),   65, accuracy: 0.05, "30kg→65lb（最近，非 66 直转）")
        XCTAssertEqual(snapLb(25),   55, accuracy: 0.05, "25kg→55lb")
        XCTAssertEqual(snapLb(22.5), 50, accuracy: 0.05, "22.5kg→50lb（49.6 吸到 50）")
        XCTAssertEqual(snapLb(7.5),  17.5, accuracy: 0.05, "7.5kg→17.5lb（轻段 2.5 档）")
        XCTAssertEqual(snapLb(10),   22.5, accuracy: 0.05, "10kg=22.05lb→22.5lb（轻段）")
    }

    func testLbDumbbellLightSegmentUsesTwoPointFive() {
        // 轻段进阶一档 = 2.5lb；中段 = 5lb
        let from20 = LoadGrid.nextRungKg(kg(20), equipment: "dumbbell", unit: .lb, up: true)
        XCTAssertEqual(lb(from20), 22.5, accuracy: 0.05, "20lb 轻段 +一档 = 22.5lb")
        let from30 = LoadGrid.nextRungKg(kg(30), equipment: "dumbbell", unit: .lb, up: true)
        XCTAssertEqual(lb(from30), 35, accuracy: 0.05, "30lb 中段 +一档 = 35lb")
        let from30down = LoadGrid.nextRungKg(kg(30), equipment: "dumbbell", unit: .lb, up: false)
        XCTAssertEqual(lb(from30down), 25, accuracy: 0.05, "30lb 中段往下回到 25lb 段界（相邻真实格）")
    }

    func testLbDumbbellFloorIsFivePounds() {
        XCTAssertEqual(lb(LoadGrid.snapKg(0.5, equipment: "dumbbell", unit: .lb)), 5, accuracy: 0.05, "下限一只 5lb 哑铃")
    }
}
