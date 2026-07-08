// 回归协议 v1（2026-07-08，owner 真机 E3「停练 22 天回来还在推腿日+文案生硬」）。
// 语义锁：gap≥21（=MLE detraining 窗同源）循环重启回序列头（override 仍优先）；
// 负荷分档 14-20 ×0.9 / 21-41 ×0.85 / ≥42 ×0.75（42=MLE 强度失窗同源）；
// longGapReentry 全档压制渐进加重（上次打满也不 .increase——一个月前的满分不是今天的依据）；
// 重启点后轮换从重启场重新计数（无状态：从历史扫描，写闸只清 offset 残值）；
// 短 gap（<14）与无重启点历史 = 现状逐字节等价（既有 goldens 兜底零回归）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class ComebackProtocolTests: XCTestCase {
    private let ppl = #"{"splitType": "push-pull-legs"}"#   // 6 日序列，区分度足

    private func plan(historyDates: [String], today: String, program: String? = nil) throws -> TodayPrescription? {
        let json = TestSupport.appDataJSON(historyDates: historyDates, program: program ?? ppl)
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: today)
        let verdict = TodayVerdictEngine.evaluate(input)
        return TodayPrescriptionEngine.plan(input: input, verdict: verdict)
    }

    // owner 真机复现锚：6/15、6/16 两场后停练，7/8（gap 22）回来——
    // 不再接着轮到第 3 日，而是回到序列头重启
    func testOwnerScenarioRestartsCycleAtSequenceHead() throws {
        let p = try XCTUnwrap(try plan(historyDates: ["2026-06-15", "2026-06-16"], today: "2026-07-08"))
        XCTAssertEqual(p.dayCode, "push-a")                      // 重启 ≠ 旧指针 legs-a
        XCTAssertTrue(p.dayReasons.contains(.comebackCycleRestart))
    }

    func testGapTwentyKeepsCycle() throws {   // 乘数 0.9 由既有 testLightVerdictReducesLoad 锁（审查 m5 改名）
        // gap 20（14-20 档）：轻练 ×0.9 但循环不重启（两周出头不至于失去上下文）
        let p = try XCTUnwrap(try plan(historyDates: ["2026-06-15", "2026-06-16"], today: "2026-07-06"))
        XCTAssertEqual(p.dayCode, "legs-a")                      // 2 场 % 6 = index 2 照旧
        XCTAssertFalse(p.dayReasons.contains(.comebackCycleRestart))
    }

    /// 自写 db-bench-press 历史（探针实证 upper 横推槽首选=哑铃卧推；TestSupport
    /// 固定 squat 而 lower 复合槽偏好机器类不选 barbell squat——FR-EQ1）。
    private func planBenchHistory(dates: [String], today: String) throws -> TodayPrescription? {
        let sessions = dates.enumerated().map { index, date in
            "{\"id\": \"s\(index)\", \"date\": \"\(date)\", \"completed\": true, \"exercises\": [{\"exerciseId\": \"db-bench-press\", \"sets\": [{\"weight\": 60, \"reps\": 12, \"rir\": 2}]}]}"
        }.joined(separator: ", ")
        let json = "{\"schemaVersion\": 8, \"history\": [\(sessions)], \"programTemplate\": {\"splitType\": \"upper-lower\"}}"
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: today)
        let verdict = TodayVerdictEngine.evaluate(input)
        return TodayPrescriptionEngine.plan(input: input, verdict: verdict, dayCodeOverride: "upper")
    }

    func testComebackLoadTiers() throws {
        // db-bench 60kg 历史（12 次满 RIR2 本会 increase——同时验证回归压制）：
        // gap 22 → ×0.85=51 吸附 2.5 档=50；gap 43 → ×0.75=45（探针实证锚）
        let restart = try XCTUnwrap(try planBenchHistory(
            dates: ["2026-06-15", "2026-06-16"], today: "2026-07-08"))
        let exercise = try XCTUnwrap(restart.exercises.first { $0.previousWeightKg == 60 })
        XCTAssertNotEqual(exercise.change, .increase)            // 回归压制：不加档
        XCTAssertEqual(exercise.targetWeightKg, 50, accuracy: 0.001)
        XCTAssertLessThan(exercise.targetWeightKg, 60 * 0.9)     // 确实比 light 档更深

        let deep = try XCTUnwrap(try planBenchHistory(
            dates: ["2026-05-25", "2026-05-26"], today: "2026-07-08"))
        let deepExercise = try XCTUnwrap(deep.exercises.first { $0.previousWeightKg == 60 })
        XCTAssertEqual(deepExercise.targetWeightKg, 45, accuracy: 0.001)
    }

    func testComebackSuppressesProgressionIncrease() throws {
        // db-bench 60kg 12 次满 RIR2（非回归时必 increase）+ gap 22 → 全部不加档
        //（审查 S2：原版历史动作命不中重启日槽位，断言空转——planBenchHistory 命中 upper）
        let p = try XCTUnwrap(try planBenchHistory(
            dates: ["2026-06-15", "2026-06-16"], today: "2026-07-08"))
        let withHistory = p.exercises.filter { $0.previousWeightKg != nil }
        XCTAssertFalse(withHistory.isEmpty, "测试未命中任何有历史的动作（空转防御）")
        for exercise in withHistory {
            XCTAssertNotEqual(exercise.change, .increase,
                              "停练 22 天回来不得加重：\(exercise.exerciseId)")
        }
    }

    func testRotationCountsFromRestartPoint() throws {
        // 历史含重启点（7/8 场与 6/16 差 22 天）：其后轮换从重启场重新计数
        let p = try XCTUnwrap(try plan(
            historyDates: ["2026-06-15", "2026-06-16", "2026-07-08"], today: "2026-07-10"))
        XCTAssertEqual(p.dayCode, "pull-a")                      // 重启点后第 1 场 → index 1
        XCTAssertFalse(p.dayReasons.contains(.comebackCycleRestart))
    }

    func testOverrideStillBeatsRestart() throws {
        // 用户显式「今天换一天练」赢过重启（决策在用户；app 层解析 oneTimeDayOverride 后传参）
        let json = TestSupport.appDataJSON(
            historyDates: ["2026-06-15", "2026-06-16"], program: ppl)
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-07-08")
        let verdict = TodayVerdictEngine.evaluate(input)
        let p = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input, verdict: verdict, dayCodeOverride: "legs-b"))
        XCTAssertEqual(p.dayCode, "legs-b")
        XCTAssertFalse(p.dayReasons.contains(.comebackCycleRestart))   // 用户换天≠重启
    }
}
