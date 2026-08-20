// 组内掉速与目标次数（owner 2026-08-19 真机截图）。
//
// 真机事实：拉 A · 面拉 40 lb 三组 —— 15×RIR3 → 15×RIR1 → 12×RIR0。
// 旧引擎三组全判 onPlan：RIR 1 够不着力竭线（≤0.5）、15 次高于区间下界（12），
// 于是第 3 组原样挂 40 lb × 20 —— 一个用户三组一次都没到过的数。
// 缺的是两件事：① 只看上一组绝对值、不看组间趋势；② 目标次数恒等于计划值、从不回落。
//
// 本文件钉死这两条的修复，并守住不得误伤的边界（掉一档不算掉速、缺 RIR 不猜、
// 力竭仍优先、自重无重量轴、辅助方向不反转）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class NextSetFatigueTests: XCTestCase {
    private let lbPerKg = 2.204_622_621_8
    private func kg(_ lb: Double) -> Double { lb / lbPerKg }

    private func completed(_ weight: Double, _ reps: Int, rir: Double? = 2, pain: Bool = false) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: weight, reps: reps, rir: rir, painReported: pain)
    }

    /// owner 的真实处方：rear-delt 槽 12–20 次 ×3 组，cable × lb = 5 lb 一档。
    private var facePullPlan: ExerciseSetPlan {
        ExerciseSetPlan(
            exerciseId: "face-pull", restSeconds: 60,
            repLowerBound: 12, repUpperBound: 20, stepKg: kg(5),
            sets: (1...3).map { PlannedSet(index: $0, targetWeightKg: kg(40), targetReps: 20, targetRir: 2) }
        )
    }

    // MARK: - owner 那一场的完整重放

    /// 端到端：面拉三组按 owner 真机实际逐组喂进去，每一组的建议都钉死。
    /// 真机旧行为：40×20 → 40×20 → 40×20（三组全 onPlan，目标一次没变）。
    func testOwnerFacePullSessionEndToEnd() throws {
        let plan = facePullPlan
        var logged: [CompletedSetObservation] = []

        // 第 1 组：照计划 40 lb × 20
        let first = try XCTUnwrap(NextSetEngine.recommend(plan: plan, completed: logged))
        XCTAssertEqual(first.targetWeightKg, kg(40), accuracy: 0.0001)
        XCTAssertEqual(first.targetReps, 20)
        XCTAssertEqual(first.reason, .onPlan)

        // 实际做了 15 次、RIR 3 → 第 2 组重量不动（还有余力），但目标次数落到 15
        logged.append(completed(kg(40), 15, rir: 3))
        let second = try XCTUnwrap(NextSetEngine.recommend(plan: plan, completed: logged))
        XCTAssertEqual(second.targetWeightKg, kg(40), accuracy: 0.0001)
        XCTAssertEqual(second.targetReps, 15)
        XCTAssertEqual(second.reason, .onPlan)

        // 又是 15 次但 RIR 掉到 1 → 第 3 组降一档到 35 lb，目标次数仍是 15
        logged.append(completed(kg(40), 15, rir: 1))
        let third = try XCTUnwrap(NextSetEngine.recommend(plan: plan, completed: logged))
        XCTAssertEqual(third.targetWeightKg, kg(35), accuracy: 0.0001)
        XCTAssertEqual(third.targetReps, 15)
        XCTAssertEqual(third.reason, .fatigueDrop)

        // 三组打完 → 动作结束
        logged.append(completed(kg(35), 12, rir: 0))
        XCTAssertNil(NextSetEngine.recommend(plan: plan, completed: logged))
    }

    // MARK: - 掉速降重

    /// RIR 3 → 1（掉两档）：第 3 组必须降一档重量。真机上它一动不动。
    func testRirDropAcrossSetsEasesNextSet() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 15, rir: 3), completed(kg(40), 15, rir: 1)]
        ))
        XCTAssertEqual(rec.targetWeightKg, kg(35), accuracy: 0.0001)
        XCTAssertEqual(rec.reason, .fatigueDrop)
    }

    /// 掉一档（3 → 2）不算掉速：正常波动不该打断稳定推进。
    func testSingleRirStepDropDoesNotEase() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 15, rir: 3), completed(kg(40), 15, rir: 2)]
        ))
        XCTAssertEqual(rec.targetWeightKg, kg(40), accuracy: 0.0001)
        XCTAssertEqual(rec.reason, .onPlan)
    }

    /// 缺 RIR 不猜掉速（沿用「无 RIR 数据不猜」）。
    func testRirDropNeedsBothSetsRir() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 15, rir: nil), completed(kg(40), 15, rir: 1)]
        ))
        XCTAssertEqual(rec.targetWeightKg, kg(40), accuracy: 0.0001)
        XCTAssertEqual(rec.reason, .onPlan)
    }

    /// 只有一组：无相邻组可比，不判掉速。
    func testFirstSetHasNoDropSignal() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 20, rir: 1)]
        ))
        XCTAssertEqual(rec.targetWeightKg, kg(40), accuracy: 0.0001)
        XCTAssertEqual(rec.reason, .onPlan)
    }

    /// 安全瀑布顺序不变：力竭先于掉速被报出。
    func testNearFailureOutranksFatigueDrop() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 15, rir: 3), completed(kg(40), 15, rir: 0)]
        ))
        XCTAssertEqual(rec.reason, .lastSetNearFailure)
    }

    /// 疼痛仍是最高优先级。
    func testPainOutranksFatigueDrop() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 15, rir: 3), completed(kg(40), 15, rir: 1, pain: true)]
        ))
        XCTAssertEqual(rec.reason, .painReported)
        XCTAssertEqual(rec.safetyFlags, [.painReported])
    }

    // MARK: - 目标次数按执行事实封顶

    /// 上组只做到 15 → 下一组目标就是 15，不回弹到计划的 20。
    func testTargetRepsCappedByPreviousActual() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 15, rir: 3)]
        ))
        XCTAssertEqual(rec.targetReps, 15)
    }

    /// 上不越计划：超额完成不把目标推高（涨次数是跨场次双重渐进的事）。
    func testTargetRepsNeverExceedPlan() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 22, rir: 3)]
        ))
        XCTAssertEqual(rec.targetReps, 20)
    }

    /// 下不破区间：掉到 8 次 → 目标回到下界 12，并按次数掉底降重。
    func testTargetRepsNeverBelowRepFloor() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 8, rir: 3)]
        ))
        XCTAssertEqual(rec.targetReps, 12)
        XCTAssertEqual(rec.reason, .belowRepFloor)
    }

    /// 跟着实际走、不是单调下降：这组比上组多做了，目标跟着回上去。
    func testTargetRepsFollowActualBackUp() throws {
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: facePullPlan,
            completed: [completed(kg(40), 14, rir: 3), completed(kg(40), 18, rir: 2)]
        ))
        XCTAssertEqual(rec.targetReps, 18)
    }

    // MARK: - 负重语义不得误伤

    /// 自重无重量轴：掉速只落到次数目标，重量恒不动。
    func testFatigueDropOnBodyweightKeepsWeightAxis() throws {
        let plan = ExerciseSetPlan(
            exerciseId: "push-up", restSeconds: 60,
            repLowerBound: 8, repUpperBound: 20, loadType: "bodyweight",
            sets: (1...3).map { PlannedSet(index: $0, targetWeightKg: 0, targetReps: 20, targetRir: 2) }
        )
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: plan, completed: [completed(0, 18, rir: 3), completed(0, 14, rir: 1)]
        ))
        XCTAssertEqual(rec.targetWeightKg, 0)
        XCTAssertEqual(rec.targetReps, 14)
        XCTAssertEqual(rec.reason, .fatigueDrop)
    }

    /// 辅助器械方向是安全红线：掉速 = 加辅助（更轻），绝不能变成减辅助。
    func testFatigueDropOnAssistedAddsAssistance() throws {
        let plan = ExerciseSetPlan(
            exerciseId: "assisted-pull-up", restSeconds: 90,
            repLowerBound: 6, repUpperBound: 10, stepKg: 5, loadType: "assisted",
            sets: (1...3).map { PlannedSet(index: $0, targetWeightKg: 20, targetReps: 10, targetRir: 2) }
        )
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: plan, completed: [completed(20, 9, rir: 3), completed(20, 8, rir: 1)]
        ))
        XCTAssertEqual(rec.targetWeightKg, 25)
        XCTAssertEqual(rec.reason, .fatigueDrop)
    }

    /// 大重量复合稳定推进不被误伤：RIR 2 → 2、次数达标 → 原样延续。
    func testStableHeavyCompoundUntouched() throws {
        let plan = ExerciseSetPlan(
            exerciseId: "bench-press", restSeconds: 180,
            repLowerBound: 6, repUpperBound: 8,
            sets: (1...3).map { PlannedSet(index: $0, targetWeightKg: 60, targetReps: 6, targetRir: 2) }
        )
        let rec = try XCTUnwrap(NextSetEngine.recommend(
            plan: plan, completed: [completed(60, 6, rir: 2), completed(60, 6, rir: 2)]
        ))
        XCTAssertEqual(rec.targetWeightKg, 60)
        XCTAssertEqual(rec.targetReps, 6)
        XCTAssertEqual(rec.reason, .onPlan)
    }
}
