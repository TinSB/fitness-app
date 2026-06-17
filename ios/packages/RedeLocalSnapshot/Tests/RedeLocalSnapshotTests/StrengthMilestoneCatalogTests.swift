// FR-PR7 力量里程碑：实测达成、双单位梯分存不互转、未达标不产、确定性。

import XCTest
@testable import RedeLocalSnapshot

final class StrengthMilestoneCatalogTests: XCTestCase {
    private let eligible: Set<String> = ["barbell-bench", "barbell-squat"]

    func testKgUserAchievesHighestCrossedThreshold() {
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 105, "barbell-squat": 145],
            eligibleExerciseIds: eligible, unitSystem: "kg"
        )
        XCTAssertEqual(m, [
            StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 100, unitLabel: "kg"),
            StrengthMilestone(exerciseId: "barbell-squat", achievedThreshold: 140, unitLabel: "kg"),
        ])
    }

    func testLbUserUsesLbLadder() {
        // 103 kg ≈ 227 lb → 跨过 225 lb（不到 315）。
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 103],
            eligibleExerciseIds: ["barbell-bench"], unitSystem: "lb"
        )
        XCTAssertEqual(m, [StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 225, unitLabel: "lb")])
    }

    func testDualLaddersDoNotInterconvert() {
        // 同样 100 kg：kg 用户 = 100 kg 里程碑；lb 用户 = 100 kg(=220 lb) → 135 lb 里程碑。
        let kg = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 100], eligibleExerciseIds: ["barbell-bench"], unitSystem: "kg"
        )
        let lb = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 100], eligibleExerciseIds: ["barbell-bench"], unitSystem: "lb"
        )
        XCTAssertEqual(kg.first?.achievedThreshold, 100)
        XCTAssertEqual(kg.first?.unitLabel, "kg")
        XCTAssertEqual(lb.first?.achievedThreshold, 135)
        XCTAssertEqual(lb.first?.unitLabel, "lb")
    }

    func testBelowLowestThresholdProducesNothing() {
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 50], eligibleExerciseIds: ["barbell-bench"], unitSystem: "kg"
        )
        XCTAssertTrue(m.isEmpty)
    }

    func testNonEligibleAndMissingSkipped() {
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["lateral-raise": 200, "barbell-bench": 0],
            eligibleExerciseIds: eligible, unitSystem: "kg"  // lateral-raise 不 eligible；bench 0kg 跳过
        )
        XCTAssertTrue(m.isEmpty)
    }

    func testDeterministicOrderByExerciseId() {
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-squat": 145, "barbell-bench": 105],
            eligibleExerciseIds: eligible, unitSystem: "kg"
        )
        XCTAssertEqual(m.map(\.exerciseId), ["barbell-bench", "barbell-squat"])  // 升序
    }

    func testNilUnitDefaultsToKg() {
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 100], eligibleExerciseIds: ["barbell-bench"], unitSystem: nil
        )
        XCTAssertEqual(m.first?.unitLabel, "kg")
        XCTAssertEqual(m.first?.achievedThreshold, 100)
    }
}
