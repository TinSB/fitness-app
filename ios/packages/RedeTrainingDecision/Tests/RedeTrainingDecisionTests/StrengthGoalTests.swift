// 力量 vs 增肌目标分支（owner 拍板：两套口径，2026-06-16）。
// primaryGoal=strength → 复合主项降到 3-6 次 / RIR 1 / 休息 ≥180s；孤立/二级保持增肌区间。
// 默认（hypertrophy/general/未填）= 增肌口径，零行为变化。
// 回归协议（2026-07-08）：todayISO 拉近种子历史（原日期距最后一场 ≥21 天触发停练
// 重启改变轮换指针——本测试意图是目标塑形，非回归场景）。

import XCTest
@testable import RedeTrainingDecision

final class StrengthGoalTests: XCTestCase {
    private func firstDay(goal: String, exerciseId: String) throws -> ExercisePrescriptionPlan {
        // 无历史 → 今天 push-a（count 0）；bench/lateral 均在 push-a。
        let json = #"{"schemaVersion":8,"history":[],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6,"primaryGoal":"\#(goal)"}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-05-16")
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
        XCTAssertEqual(s.repLowerBound, 12, "孤立下限不变")
        XCTAssertEqual(s.repUpperBound, 20, "孤立（侧平举）在力量目标下仍保持高次增肌区间")
        XCTAssertEqual(s.targetRir, 2.0)
    }

    /// 审查 m-2 修复：pull-a 主拉(垂直拉/杠铃划船)标 kind:compound 后，力量目标也塑形（原本全 nil-kind 漏掉）。
    func testStrengthShapesPullMainAfterKindFix() throws {
        // count 1 → pull-a；今天主拉 = lat-pulldown（kind compound）。
        let sessions = (0..<1).map { _ in #"{"id":"h0","date":"2026-05-10","completed":true,"exercises":[]}"# }.joined()
        let json = #"{"schemaVersion":8,"history":[\#(sessions)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6,"primaryGoal":"strength"}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-05-16")
        let p = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input)))
        XCTAssertEqual(p.dayCode, "pull-a")
        let pulldown = try XCTUnwrap(p.exercises.first { $0.exerciseId == "lat-pulldown" })
        XCTAssertEqual(pulldown.repUpperBound, 6, "力量目标下主拉降到 3-6 次")
        XCTAssertEqual(pulldown.targetRir, 1.0)
    }
}
