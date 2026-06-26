// FR-TR6 换动作候选 `swapCandidates`：只返回**引擎真会接受**的替代——同 pattern + 守该槽 equipment 偏好 +
// 守场景白名单 + 排除已用。关键守护：lower 日复合深蹲槽 equipment=machineClasses，故只列 machine 类深蹲
// （pendulum/smith…），杠铃/哑铃/自重深蹲被排除（点了引擎也换不成、像「没实现」）。

import XCTest
@testable import RedeTrainingDecision

final class SwapCandidatesTests: XCTestCase {

    func testLowerCompoundSquatOnlyOffersMachineClassSquats() {
        // hack-squat（plate-loaded）在 lower 日复合深蹲槽（equipment=machineClasses）。
        let result = TodayPrescriptionEngine.swapCandidates(
            for: "hack-squat", dayCode: "lower",
            currentIds: ["hack-squat", "db-rdl", "leg-press"],  // leg-press 已在计划→应排除
            equipmentScenario: nil
        )
        // 应只含 machine 类深蹲，绝不含杠铃/哑铃/自重深蹲。
        for valid in result {
            let e = ExerciseCatalog.minimal.entry(id: valid)
            XCTAssertEqual(e?.movementPattern, "squat-pattern", "\(valid) 必须同 pattern")
            XCTAssertTrue(EquipmentRegistry.machineClasses.contains(e?.equipment ?? ""), "\(valid) 必须 machine 类器械（守槽 equipment 偏好）")
        }
        XCTAssertFalse(result.contains("hack-squat"), "排除自己")
        XCTAssertFalse(result.contains("leg-press"), "排除已在计划里的")
        XCTAssertFalse(result.contains("squat"), "杠铃深蹲被槽 equipment 偏好排除（引擎换不成）")
        XCTAssertFalse(result.contains("goblet-squat"), "哑铃深蹲被排除")
        XCTAssertFalse(result.contains("bodyweight-squat"), "自重深蹲被排除")
        XCTAssertTrue(result.contains("pendulum-squat") || result.contains("smith-squat"), "至少含一个 machine 类深蹲（真能换成的）")
    }

    func testUnknownExerciseOrDayReturnsEmpty() {
        XCTAssertTrue(TodayPrescriptionEngine.swapCandidates(for: "no-such", dayCode: "lower", currentIds: [], equipmentScenario: nil).isEmpty)
        XCTAssertTrue(TodayPrescriptionEngine.swapCandidates(for: "hack-squat", dayCode: "no-such-day", currentIds: [], equipmentScenario: nil).isEmpty)
    }
}
