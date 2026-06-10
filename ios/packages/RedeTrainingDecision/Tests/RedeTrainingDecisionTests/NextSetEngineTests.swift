// M3-1 验收②：下一组建议——尊重 session 内执行事实（§6.3：用户第一组 85，
// 第二组建议继续 85；完全按计划执行则保持计划形状），安全信号优先。
// 引擎零文案：reason/safety 全 typed code。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class NextSetEngineTests: XCTestCase {
    private let exercisePlan = ExerciseSetPlan(
        exerciseId: "bench-press",
        restSeconds: 180,
        repLowerBound: 6,
        repUpperBound: 8,
        sets: (1...3).map { PlannedSet(index: $0, targetWeightKg: 60, targetReps: 6, targetRir: 2) }
    )

    private func completed(_ weight: Double, _ reps: Int, rir: Double? = 2, pain: Bool = false) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: weight, reps: reps, rir: rir, painReported: pain)
    }

    // 完全按计划执行 → 保持计划形状
    func testOnPlanKeepsPlannedTarget() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(plan: exercisePlan, completed: [completed(60, 6)]))
        XCTAssertEqual(rec.targetWeightKg, 60)
        XCTAssertEqual(rec.targetReps, 6)
        XCTAssertEqual(rec.restSeconds, 180)
        XCTAssertEqual(rec.reason, .onPlan)
        XCTAssertTrue(rec.safetyFlags.isEmpty)
    }

    // 用户偏离计划（第一组完成 65）→ 第二组建议延续 65（尊重执行事实）
    func testUserDeviationCarriesForward() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(plan: exercisePlan, completed: [completed(65, 6)]))
        XCTAssertEqual(rec.targetWeightKg, 65)
        XCTAssertEqual(rec.reason, .onPlan)
    }

    // 上一组接近力竭（RIR ≤ 0.5）→ 下一组 −2.5
    func testNearFailureEasesNextSet() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(plan: exercisePlan, completed: [completed(60, 6, rir: 0)]))
        XCTAssertEqual(rec.targetWeightKg, 57.5)
        XCTAssertEqual(rec.reason, .lastSetNearFailure)
    }

    // 上一组次数掉出区间下限 → 下一组 −2.5
    func testBelowRepFloorEasesNextSet() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(plan: exercisePlan, completed: [completed(60, 4)]))
        XCTAssertEqual(rec.targetWeightKg, 57.5)
        XCTAssertEqual(rec.reason, .belowRepFloor)
    }

    // 疼痛信号：安全 flag + 减重（安全优先级最高）
    func testPainReportedFlagsAndEases() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(plan: exercisePlan, completed: [completed(60, 6, rir: 0, pain: true)]))
        XCTAssertEqual(rec.targetWeightKg, 57.5)
        XCTAssertEqual(rec.reason, .painReported)
        XCTAssertEqual(rec.safetyFlags, [.painReported])
    }

    // 疼痛独立场景：RIR 正常但报疼痛——安全规则必须独立生效
    func testPainAloneWithNormalRirStillEases() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(plan: exercisePlan, completed: [completed(60, 6, rir: 2, pain: true)]))
        XCTAssertEqual(rec.targetWeightKg, 57.5)
        XCTAssertEqual(rec.reason, .painReported)
        XCTAssertEqual(rec.safetyFlags, [.painReported])
    }

    // 完成数超过计划组数（防御边界）→ nil
    func testOverCompletedReturnsNil() {
        let four = [completed(60, 6), completed(60, 6), completed(60, 6), completed(60, 6)]
        XCTAssertNil(NextSetEngine.recommend(plan: exercisePlan, completed: four))
    }

    // 第一组之前 → 按计划第 1 组
    func testFirstSetFollowsPlan() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(plan: exercisePlan, completed: []))
        XCTAssertEqual(rec.targetWeightKg, 60)
        XCTAssertEqual(rec.reason, .onPlan)
    }

    // 全部组完成 → nil（动作结束）
    func testAllSetsDoneReturnsNil() {
        let done = [completed(60, 6), completed(60, 6), completed(60, 6)]
        XCTAssertNil(NextSetEngine.recommend(plan: exercisePlan, completed: done))
    }

    // 减重下限 2.5kg
    func testEaseNeverGoesBelowFloor() throws {
        let tinyPlan = ExerciseSetPlan(
            exerciseId: "lateral-raise", restSeconds: 60, repLowerBound: 12, repUpperBound: 20,
            sets: (1...2).map { PlannedSet(index: $0, targetWeightKg: 2.5, targetReps: 12, targetRir: 2) }
        )
        let rec = try XCTUnwrap(NextSetEngine.recommend(plan: tinyPlan, completed: [completed(2.5, 12, rir: 0)]))
        XCTAssertEqual(rec.targetWeightKg, 2.5)
    }

    // 无 RIR 数据：不猜，不触发力竭规则
    func testNoRirDataSkipsNearFailureRule() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(plan: exercisePlan, completed: [completed(60, 6, rir: nil)]))
        XCTAssertEqual(rec.targetWeightKg, 60)
        XCTAssertEqual(rec.reason, .onPlan)
    }
}
