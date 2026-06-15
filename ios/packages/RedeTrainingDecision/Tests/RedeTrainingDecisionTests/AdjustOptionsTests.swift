// M5-3 快改刻度轨（拍板 2026-06-10）：语义档位生成器合同。
// 档位由引擎事实生成（跟随/上组/计划/轻重一档），按值去重（固定优先级
// 跟随>上组>计划>轻重档）后升序——位置稳定是肌肉记忆的前提，测试钉死。
// 预演=落盘同规则：AdjustPreview 必须与打勾后的真实下一组建议完全一致。

import Foundation
import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class AdjustOptionsTests: XCTestCase {
    // MARK: - 档位生成

    func testDistinctAnchorsAscendingWithRoles() {
        // 跟随 60 / 上组 62.5 / 计划 55 → 轻一档 57.5、重一档 62.5（与上组撞值）
        let options = AdjustOptionsBuilder.options(followKg: 60, lastActualKg: 62.5, plannedKg: 55)
        XCTAssertEqual(options.map(\.weightKg), [55, 57.5, 60, 62.5])
        XCTAssertEqual(options.map(\.role), [.plan, .lighter, .follow, .last])
    }

    func testHeavierCollapsesIntoLastByPriority() {
        // 重一档 85 与上组 85 撞值 → 上组（优先级 2）胜出，重一档（4）消失
        let options = AdjustOptionsBuilder.options(followKg: 82.5, lastActualKg: 85, plannedKg: 80)
        let at85 = options.filter { $0.weightKg == 85 }
        XCTAssertEqual(at85.map(\.role), [.last])
    }

    func testPlanCollapsesIntoLastByPriority() {
        // 计划 85 与上组 85 撞值 → 上组（2）胜出计划（3）
        let options = AdjustOptionsBuilder.options(followKg: 80, lastActualKg: 85, plannedKg: 85)
        let at85 = options.filter { $0.weightKg == 85 }
        XCTAssertEqual(at85.map(\.role), [.last])
        XCTAssertEqual(options.map(\.weightKg), [77.5, 80, 82.5, 85])
    }

    func testFirstSetNoLastFollowEqualsPlanCollapsesToFollow() {
        // 首组：无上组、跟随==计划 → 跟随（1）胜出，恰好 3 档
        let options = AdjustOptionsBuilder.options(followKg: 60, lastActualKg: nil, plannedKg: 60)
        XCTAssertEqual(options.map(\.weightKg), [57.5, 60, 62.5])
        XCTAssertEqual(options.map(\.role), [.lighter, .follow, .heavier])
    }

    func testNonPositiveCandidatesFiltered() {
        // 跟随 2.5 → 轻一档 0 不合法，被过滤；档位仍升序
        let options = AdjustOptionsBuilder.options(followKg: 2.5, lastActualKg: nil, plannedKg: 2.5)
        XCTAssertFalse(options.contains { $0.weightKg <= 0 })
        XCTAssertEqual(options.map(\.weightKg), [2.5, 5])
    }

    func testDeterministicForSameInputs() {
        let a = AdjustOptionsBuilder.options(followKg: 60, lastActualKg: 62.5, plannedKg: 55)
        let b = AdjustOptionsBuilder.options(followKg: 60, lastActualKg: 62.5, plannedKg: 55)
        XCTAssertEqual(a, b)
    }

    // MARK: - 磅哑铃档位走真实梯子（2026-06-15 单位原生）

    private var lbPerKg: Double { 2.204_622_621_8 }
    private func lb(_ kg: Double) -> Double { kg * lbPerKg }
    private func kg(_ lb: Double) -> Double { lb / lbPerKg }

    func testLbDumbbellLightSegmentUsesRealLadder() {
        // follow=20lb（轻段）：轻一档 17.5lb、重一档 22.5lb（2.5lb 真实梯子，非旧等距 15/25）
        let options = AdjustOptionsBuilder.options(followKg: kg(20), lastActualKg: nil, plannedKg: kg(20),
                                                   equipment: "dumbbell", unit: .lb)
        let weightsLb = options.map { lb($0.weightKg) }
        XCTAssertEqual(weightsLb.count, 3)
        XCTAssertEqual(weightsLb[0], 17.5, accuracy: 0.05)
        XCTAssertEqual(weightsLb[1], 20, accuracy: 0.05)
        XCTAssertEqual(weightsLb[2], 22.5, accuracy: 0.05)
        XCTAssertEqual(options.map(\.role), [.lighter, .follow, .heavier])
    }

    func testLbDumbbellMidSegmentUsesFivePound() {
        // follow=40lb（中段）：轻一档 35lb、重一档 45lb（5lb）
        let options = AdjustOptionsBuilder.options(followKg: kg(40), lastActualKg: nil, plannedKg: kg(40),
                                                   equipment: "dumbbell", unit: .lb)
        let weightsLb = options.map { ($0.weightKg * lbPerKg * 10).rounded() / 10 }
        XCTAssertEqual(weightsLb.first, 35)
        XCTAssertEqual(weightsLb.last, 45)
    }

    func testKgUnchangedWithDefaultEquipment() {
        // 公斤零回归：默认 dumbbell/kg 等距 2.5kg，与旧 followKg±step 逐字段一致
        let options = AdjustOptionsBuilder.options(followKg: 60, lastActualKg: 62.5, plannedKg: 55)
        XCTAssertEqual(options.map(\.weightKg), [55, 57.5, 60, 62.5])
    }

    // MARK: - 预演 = 落盘同规则（合同）

    func testPreviewMatchesPostLogRecommendation() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-10"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)
        let plan = try XCTUnwrap(flow.currentExercise)

        // 三种暂存：正常 / 力竭（RIR 0 → 安全降档）/ 次数掉底
        let stagedCases = [
            CompletedSetObservation(weightKg: 50, reps: 8, rir: 2, painReported: false),
            CompletedSetObservation(weightKg: 50, reps: 8, rir: 0, painReported: false),
            CompletedSetObservation(weightKg: 50, reps: max(1, plan.repLowerBound - 2), rir: 2, painReported: false),
        ]
        for staged in stagedCases {
            let preview = AdjustPreview.project(
                plan: plan, completed: flow.completedInCurrentExercise, staged: staged
            )
            var sandbox = flow
            sandbox.logSet(staged)
            sandbox.restFinished()
            XCTAssertEqual(preview, sandbox.currentRecommendation, "预演与落盘后真实建议不一致：\(staged)")
        }

        // RIR 不记（nil）：引擎不猜 → 不触发力竭规则，跟随实际重量
        let skipped = CompletedSetObservation(weightKg: 47.5, reps: 8, rir: nil, painReported: false)
        let preview = AdjustPreview.project(plan: plan, completed: [], staged: skipped)
        XCTAssertEqual(preview?.targetWeightKg, 47.5)
        XCTAssertEqual(preview?.reason, .onPlan)
    }

    func testPreviewNilOnFinalSet() throws {
        // 最后一组打勾后动作结束 → 预演为 nil（渲染层显示「本动作完成」）
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-10"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        let flow = TrainFlowState(prescription: prescription)
        let plan = try XCTUnwrap(flow.currentExercise)
        let obs = CompletedSetObservation(weightKg: 50, reps: 8, rir: 2, painReported: false)
        XCTAssertGreaterThanOrEqual(plan.sets.count, 2)
        // 暂存的是最后一组 → 打勾后动作结束，预演 nil
        let allButOne = Array(repeating: obs, count: plan.sets.count - 1)
        XCTAssertNil(AdjustPreview.project(plan: plan, completed: allButOne, staged: obs))
        // 暂存的是倒数第二组 → 还有下一组，预演非 nil
        let allButTwo = Array(repeating: obs, count: plan.sets.count - 2)
        XCTAssertNotNil(AdjustPreview.project(plan: plan, completed: allButTwo, staged: obs))
    }
}
