// 周期化引擎 S2：相位调制接进处方 golden。
// 默认关闭=零行为变化（由现有 162 处方 golden 全绿证明）；这里锁开启态。
// 块锚 2026-05-04（3 场周历史，相邻 7 天成连续序列、稀疏故 verdict 仍 train）；
// 今日 05-20 = 块+16天 = 第 2 周过载；05-27 = 块+23天 = 第 3 周减载。
// 历史只做 db-bench-press（上肢）；今日轮到下肢日（sessions.count=3 → daySequence[1]=lower），
// 下肢动作均首练 → 两次（开/关）同一首练动作，差异纯由 phase 产生。

import Foundation
import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class MesocyclePrescriptionTests: XCTestCase {
    private func session(_ id: String, _ date: String) -> String {
        """
        {"id":"\(id)","templateId":"upper","date":"\(date)","completed":true,"endReason":"completedAll",
         "exercises":[{"id":"\(id)-e","exerciseId":"db-bench-press","sets":[
           {"id":"\(id)-e-1","setIndex":1,"exerciseId":"db-bench-press","reps":6,"rir":2,"weight":30,"done":true,"completionStatus":"completed"}]}]}
        """
    }

    private func firstExercise(today: String, meso: Bool) throws -> ExercisePrescriptionPlan {
        let json = """
        {"schemaVersion":8,
         "programTemplate":{"splitType":"upper-lower","daysPerWeek":4,"primaryGoal":"hypertrophy"},
         "userProfile":{"trainingLevel":"intermediate","equipmentScenario":"commercial-gym","unitSystem":"kg","weeklyTrainingDays":4,"primaryGoal":"hypertrophy"},
         "history":[\(session("s1","2026-05-04")),\(session("s2","2026-05-11")),\(session("s3","2026-05-18"))]}
        """
        let value = try JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))
        let appData = try AppData(decoding: value)
        let input = try CleanTrainingDecisionInput.make(from: CleanAppDataViewBuilder.build(from: appData), todayISO: today)
        let verdict = TodayVerdictEngine.evaluate(input)
        XCTAssertEqual(verdict.call, .train, "测试前提：\(today) 应为 train 态（否则 phase 让位，测不到）")
        let plan = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict, mesocycleEnabled: meso))
        return try XCTUnwrap(plan.exercises.first)
    }

    func testDefaultParamIsOff() throws {
        // 默认参数 = 关闭 = 原 RIR 2.0（零行为变化的回归锚）
        XCTAssertEqual(try firstExercise(today: "2026-05-20", meso: false).targetRir, 2.0)
    }

    func testOverreachWeekActive() throws {
        let off = try firstExercise(today: "2026-05-20", meso: false)
        let on = try firstExercise(today: "2026-05-20", meso: true)
        XCTAssertEqual(on.sets, off.sets + 1, "过载周 +1 组")
        XCTAssertEqual(on.targetRir, 1.0, "过载周 RIR 1.0")
        XCTAssertEqual(on.targetWeightKg, off.targetWeightKg, "过载周重量不动（mult 1.0）")
    }

    func testDeloadWeekActive() throws {
        let off = try firstExercise(today: "2026-05-27", meso: false)
        let on = try firstExercise(today: "2026-05-27", meso: true)
        XCTAssertEqual(on.sets, max(2, off.sets - 1), "减载周 −1 组（下限 2）")
        XCTAssertEqual(on.targetRir, 3.5, "减载周 RIR 3.5")
        XCTAssertLessThan(on.targetWeightKg, off.targetWeightKg, "减载周重量真减（×0.85）")
    }
}
