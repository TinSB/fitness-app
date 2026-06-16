// 磅用户处方落真实哑铃梯子（2026-06-15 单位原生重构）——证明引擎接线真用了梯子，
// 不只是 LoadGrid 单测。磅哑铃：保持→吸附最近真实格；轻段进阶→2.5lb；中段→5lb。

import Foundation
import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class LbGridPrescriptionTests: XCTestCase {
    private let lbPerKg = 2.204_622_621_8
    private func lb(_ kg: Double) -> Double { kg * lbPerKg }

    /// db-bench-press（哑铃）单组完成历史；weightKg 由参数给，reps/rir 控制进阶分支。
    private func sessionJSON(_ id: String, _ date: String, weightKg: Double, reps: Int, rir: Int) -> String {
        """
        {"id":"\(id)","templateId":"upper","date":"\(date)","completed":true,"endReason":"completedAll",
         "exercises":[{"id":"\(id)-e","exerciseId":"db-bench-press","sets":[
           {"id":"\(id)-e-1","setIndex":1,"exerciseId":"db-bench-press","reps":\(reps),"rir":\(rir),"weight":\(weightKg),"done":true,"completionStatus":"completed"}]}]}
        """
    }

    private func firstExercise(weightKg: Double, reps: Int, rir: Int, today: String = "2026-06-09") throws -> ExercisePrescriptionPlan {
        // 上肢日：sessions.count 偶数 → upper（daySequence[0]）。2 条历史 → count=2 → upper；
        // last = 最近一条（s1）。两条同重同次同 RIR，使 last 明确。
        let hist = [
            sessionJSON("s0", "2026-06-03", weightKg: weightKg, reps: reps, rir: rir),
            sessionJSON("s1", "2026-06-06", weightKg: weightKg, reps: reps, rir: rir),
        ].joined(separator: ",")
        let json = """
        {"schemaVersion":9,
         "programTemplate":{"splitType":"upper-lower","daysPerWeek":4,"primaryGoal":"hypertrophy"},
         "userProfile":{"trainingLevel":"intermediate","equipmentScenario":"commercial-gym","unitSystem":"lb","weeklyTrainingDays":4,"primaryGoal":"hypertrophy"},
         "history":[\(hist)]}
        """
        let value = try JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))
        let appData = try AppData(decoding: value)
        let input = try CleanTrainingDecisionInput.make(from: CleanAppDataViewBuilder.build(from: appData), todayISO: today)
        let verdict = TodayVerdictEngine.evaluate(input)
        let plan = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        // db-bench-press 是上肢首动作
        return try XCTUnwrap(plan.exercises.first { $0.exerciseId == "db-bench-press" })
    }

    func testHoldSnapsToRealLbDumbbell() throws {
        // 上次 30kg（=66.1lb，非真实哑铃）+ 区间内 → 保持 → 吸附最近真实格 65lb（非 66 直转）
        let ex = try firstExercise(weightKg: 30, reps: 8, rir: 2)
        XCTAssertEqual(lb(ex.targetWeightKg), 65, accuracy: 0.1, "保持也吸附到真实 65lb 哑铃，不留 66lb")
    }

    func testLightSegmentProgressesByTwoPointFive() throws {
        // 上次 ~20lb（9.07kg）打满 repMax 且有余力 → 进阶一档 = 轻段 2.5lb → 22.5lb
        let ex = try firstExercise(weightKg: 20 / lbPerKg, reps: 12, rir: 2)
        XCTAssertEqual(lb(ex.targetWeightKg), 22.5, accuracy: 0.1, "轻段进阶 2.5lb → 22.5lb")
    }

    func testMidSegmentProgressesByFive() throws {
        // 上次 ~40lb（18.14kg）打满 repMax → 进阶一档 = 中段 5lb → 45lb
        let ex = try firstExercise(weightKg: 40 / lbPerKg, reps: 12, rir: 2)
        XCTAssertEqual(lb(ex.targetWeightKg), 45, accuracy: 0.1, "中段进阶 5lb → 45lb")
    }
}
