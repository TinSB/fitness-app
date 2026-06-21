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

    // MARK: - 估算里程碑（FR-PR7 收尾）

    func testEstimatedAboveActualProducesBoth() {
        // 实测 105（跨 100），估算 1RM 145（跨 140）→ 实测 100 + 估算 140 两条，实测在前。
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 105],
            estimatedE1RmKgByExercise: ["barbell-bench": 145],
            eligibleExerciseIds: ["barbell-bench"], unitSystem: "kg"
        )
        XCTAssertEqual(m, [
            StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 100, unitLabel: "kg", isEstimated: false),
            StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 140, unitLabel: "kg", isEstimated: true),
        ])
    }

    func testEstimatedNotAboveActualProducesNoEstimated() {
        // 估算档 == 实测档（都跨 100，都没到 140）→ 不产估算，避免冒充/重复实测。
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 105],
            estimatedE1RmKgByExercise: ["barbell-bench": 120],
            eligibleExerciseIds: ["barbell-bench"], unitSystem: "kg"
        )
        XCTAssertEqual(m, [StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 100, unitLabel: "kg", isEstimated: false)])
    }

    func testEstimatedOnlyWhenNoActual() {
        // 实测 55（未到最低档 60），估算 1RM 102（跨 100）→ 只出估算 100（明确标 estimated）。
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 55],
            estimatedE1RmKgByExercise: ["barbell-bench": 102],
            eligibleExerciseIds: ["barbell-bench"], unitSystem: "kg"
        )
        XCTAssertEqual(m, [StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 100, unitLabel: "kg", isEstimated: true)])
    }

    func testEstimatedRespectsLbLadderNoInterconvert() {
        // lb 用户：估算 1RM 145 kg ≈ 319 lb → 跨 315 lb；实测 103 kg ≈ 227 lb → 225 lb。
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 103],
            estimatedE1RmKgByExercise: ["barbell-bench": 145],
            eligibleExerciseIds: ["barbell-bench"], unitSystem: "lb"
        )
        XCTAssertEqual(m, [
            StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 225, unitLabel: "lb", isEstimated: false),
            StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 315, unitLabel: "lb", isEstimated: true),
        ])
    }

    func testEmptyEstimatedMapKeepsActualOnlyBehavior() {
        // 不传估算（默认空）= 旧行为：只实测。
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 105],
            eligibleExerciseIds: ["barbell-bench"], unitSystem: "kg"
        )
        XCTAssertEqual(m, [StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 100, unitLabel: "kg", isEstimated: false)])
    }

    func testEstimatedBelowLowestThresholdProducesNothing() {
        // 估算 55 + 实测 50 都未到最低档 60 → 空（估算端边界，审查 MINOR-1）。
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-bench": 50],
            estimatedE1RmKgByExercise: ["barbell-bench": 55],
            eligibleExerciseIds: ["barbell-bench"], unitSystem: "kg"
        )
        XCTAssertTrue(m.isEmpty)
    }

    func testMultiExerciseWithEstimatedOrdering() {
        // 两动作各有实测+估算 → 按 exerciseId 升序、同动作实测在前估算在后（审查 MINOR-2）。
        let m = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["barbell-squat": 145, "barbell-bench": 105],
            estimatedE1RmKgByExercise: ["barbell-squat": 185, "barbell-bench": 145],
            eligibleExerciseIds: eligible, unitSystem: "kg"
        )
        XCTAssertEqual(m, [
            StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 100, unitLabel: "kg", isEstimated: false),
            StrengthMilestone(exerciseId: "barbell-bench", achievedThreshold: 140, unitLabel: "kg", isEstimated: true),
            StrengthMilestone(exerciseId: "barbell-squat", achievedThreshold: 140, unitLabel: "kg", isEstimated: false),
            StrengthMilestone(exerciseId: "barbell-squat", achievedThreshold: 180, unitLabel: "kg", isEstimated: true),
        ])
    }
}
