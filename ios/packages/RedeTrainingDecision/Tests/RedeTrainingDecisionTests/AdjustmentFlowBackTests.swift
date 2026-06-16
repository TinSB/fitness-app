// M4-4（用户指令 2026-06-10）：训练中自主调整必须回流——显式合同锁定。
// 链条：用户改重量打勾（实际执行）→ 下一组建议跟随 → 完成落盘只记实际值
// → 下一场处方以实际值为基线渐进。各环节既有测试已覆盖，本文件把整条链
// 作为单一合同钉死，防止任何一环将来被「回拉到计划值」。

import Foundation
import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class AdjustmentFlowBackTests: XCTestCase {
    func testAdjustedWeightFlowsToNextSetThenPersistsThenSeedsNextSession() throws {
        // 首练日：计划起始 30kg（目录值）
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)
        let plannedKg = try XCTUnwrap(flow.currentTargetWeightKg)

        // 高手把第一组改成 50（≠ 计划值），打勾
        let adjusted = CompletedSetObservation(weightKg: 50, reps: 6, rir: 2, painReported: false)
        XCTAssertNotEqual(plannedKg, 50)
        flow.logSet(adjusted)
        flow.restFinished()

        // ① 下一组建议跟随实际执行，不回拉计划值
        XCTAssertEqual(flow.currentRecommendation?.targetWeightKg, 50)

        // 完成整个第一动作后提前结束
        flow.logSet(adjusted)
        flow.restFinished()
        flow.logSet(adjusted)
        flow.restFinished()
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        // ② 落盘只记实际值（50），不记处方目标
        let session = CompletedSessionBuilder.build(
            from: flow, sessionId: "s-adjust", dateISO: "2026-06-09",
            startedAtISO: "t0", finishedAtISO: "t1", durationMinutes: 30
        )
        XCTAssertEqual(session.exercises.first?.sets.map(\.weight), [50, 50, 50])

        // ③ 下一场处方以 50 为基线（双重渐进：满上限有余力 → +2.5）
        // 补满一整轮 6 天（PPL×2），第 7 场轮转回推日——卧推重新上单
        let historyInput = try TestSupport.makeInput(
            appDataJSON: #"""
            {"schemaVersion": 8,
             "programTemplate": {"splitType": "push-pull-legs"},
             "history": [
               {"id": "s-adjust", "date": "2026-06-06", "completed": true, "templateId": "push-a",
                "exercises": [{"exerciseId": "bench-press", "sets": [
                  {"weight": 50, "reps": 8, "rir": 2}, {"weight": 50, "reps": 8, "rir": 2}, {"weight": 50, "reps": 8, "rir": 2}]}]},
               {"id": "s-pull", "date": "2026-06-07", "completed": true, "templateId": "pull-a",
                "exercises": [{"exerciseId": "lat-pulldown", "sets": [{"weight": 55, "reps": 8, "rir": 2}]}]},
               {"id": "s-legs", "date": "2026-06-08", "completed": true, "templateId": "legs-a",
                "exercises": [{"exerciseId": "squat", "sets": [{"weight": 80, "reps": 5, "rir": 2}]}]},
               {"id": "s-pushb", "date": "2026-06-09", "completed": true, "templateId": "push-b", "exercises": []},
               {"id": "s-pullb", "date": "2026-06-10", "completed": true, "templateId": "pull-b", "exercises": []},
               {"id": "s-legsb", "date": "2026-06-11", "completed": true, "templateId": "legs-b", "exercises": []}
             ]}
            """#,
            todayISO: "2026-06-13"
        )
        let nextVerdict = TodayVerdictEngine.evaluate(historyInput)
        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(input: historyInput, verdict: nextVerdict))
        let bench = try XCTUnwrap(next.exercises.first { $0.exerciseId == "bench-press" })
        XCTAssertEqual(bench.previousWeightKg, 50)
        // 双重渐进精确值：3×8 全满上限（repMax=8）有余力（RIR 2）→ 50 + 2.5；
        // 绝不回拉目录值 30
        XCTAssertEqual(bench.targetWeightKg, 52.5)
        XCTAssertEqual(bench.change, .increase)
    }
}
