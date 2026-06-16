// 力量 vs 增肌目标分支（owner 拍板：两套口径，2026-06-16）。
// primaryGoal=strength → 复合主项降到 3-6 次 / RIR 1 / 休息 ≥180s；孤立/二级保持增肌区间。
// 默认（hypertrophy/general/未填）= 增肌口径，零行为变化。

import XCTest
@testable import RedeTrainingDecision

final class StrengthGoalTests: XCTestCase {
    private func firstDay(goal: String, exerciseId: String) throws -> ExercisePrescriptionPlan {
        // 无历史 → 今天 push-a（count 0）；bench/lateral 均在 push-a。
        let json = #"{"schemaVersion":8,"history":[],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6,"primaryGoal":"\#(goal)"}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-16")
        let p = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input)))
        return try XCTUnwrap(p.exercises.first { $0.exerciseId == exerciseId })
    }

    func testStrengthLowersRepsAndRirOnCompoundMain() throws {
        let s = try firstDay(goal: "strength", exerciseId: "bench-press") // push-a 复合主项
        XCTAssertEqual(s.repLowerBound, 3)
        XCTAssertEqual(s.repUpperBound, 6)
        XCTAssertEqual(s.targetRir, 1.0)
        XCTAssertGreaterThanOrEqual(s.restSeconds, 180)
    }

    func testHypertrophyKeepsCompoundMainUnchanged() throws {
        let h = try firstDay(goal: "hypertrophy", exerciseId: "bench-press")
        XCTAssertEqual(h.repLowerBound, 6)
        XCTAssertEqual(h.repUpperBound, 8)
        XCTAssertEqual(h.targetRir, 2.0)
    }

    func testStrengthLeavesIsolationAtHypertrophyRange() throws {
        let s = try firstDay(goal: "strength", exerciseId: "lateral-raise") // 孤立槽
        XCTAssertEqual(s.repUpperBound, 20, "孤立（侧平举）在力量目标下仍保持高次增肌区间")
        XCTAssertEqual(s.targetRir, 2.0)
    }
}
