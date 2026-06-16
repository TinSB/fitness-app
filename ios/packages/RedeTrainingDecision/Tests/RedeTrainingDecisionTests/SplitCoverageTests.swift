// 分化覆盖（审查 evidence gap 补齐 2026-06-16）：5 天 ppl-ul 端到端 5 位轮换 +
// 受限器械（home-dumbbell）B 日优雅降级（不崩、不空、可能少几个槽）。

import XCTest
@testable import RedeTrainingDecision

final class SplitCoverageTests: XCTestCase {
    private func dayCode(splitType: String, count: Int, scenario: String? = nil) throws -> TodayPrescription {
        let sessions = (0..<count).map { i in
            #"{"id":"h\#(i)","date":"2026-05-\#(String(format: "%02d", 10 + i))","completed":true,"exercises":[]}"#
        }.joined(separator: ",")
        let profile = scenario.map { #","userProfile":{"equipmentScenario":"\#($0)"}"# } ?? ""
        // push-pull-legs 是 6 天模式（5 天 PPL 已被 9→10 迁移重映成 ppl-ul）；其余按 5 天。
        // 写对天数才不会被迁移误重映，保住各自的轮换意图。
        let daysPerWeek = splitType == "push-pull-legs" ? 6 : 5
        let json = #"{"schemaVersion":8,"history":[\#(sessions)]\#(profile),"programTemplate":{"splitType":"\#(splitType)","daysPerWeek":\#(daysPerWeek)}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-16")
        return try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input)))
    }

    /// 5 天 PPL+UL 端到端：5 个位置依次 push-a/pull-a/legs-a/upper/lower，全部出处方（腿 2×：legs-a + lower）。
    func testPplUlRotatesThroughFiveDistinctDays() throws {
        let expected = ["push-a", "pull-a", "legs-a", "upper", "lower"]
        for (i, code) in expected.enumerated() {
            let p = try dayCode(splitType: "ppl-ul", count: i)
            XCTAssertEqual(p.dayCode, code, "ppl-ul 第 \(i) 位应为 \(code)")
            XCTAssertFalse(p.exercises.isEmpty, "\(code) 应有动作")
        }
    }

    /// 受限器械（家用哑铃）落 push-b：优雅降级——出处方、动作非空、不崩；个别 cable/machine 专属槽
    /// 软化或留 slotUnfilled 可接受（已知边界，需补目录才全填）。
    func testHomeDumbbellBDayDegradesGracefully() throws {
        let p = try dayCode(splitType: "push-pull-legs", count: 3, scenario: "home-dumbbell")
        XCTAssertEqual(p.dayCode, "push-b")
        XCTAssertFalse(p.exercises.isEmpty, "家用哑铃 push-b 仍应出动作（不空不崩）")
        // 全部产出动作必须是家用哑铃可做的负重类型（不混入 cable/选重机专属）——优雅软化的证据。
        for ex in p.exercises {
            let equip = ExerciseCatalog.minimal.entry(id: ex.exerciseId)?.equipment ?? ""
            XCTAssertTrue(["dumbbell", "barbell", "bodyweight", "band"].contains(equip) || equip.isEmpty,
                          "\(ex.exerciseId) 器械 \(equip) 不应超出家用白名单（软化失败）")
        }
    }
}
