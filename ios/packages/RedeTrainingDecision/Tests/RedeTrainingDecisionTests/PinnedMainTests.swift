// 槽位点名主项（preferredId，2026-06-16）：解决「槽位按 rank 选、无法点名具体动作」的限制。
// B 日按权威 §3 点名主项——legs-B 硬拉 + 保加利亚、pull-B 宽握下拉 + 俯身支撑划船——
// 这些是同 pattern/器械下 rank 非最小、原本选不到的动作。点名须通过候选过滤，否则优雅回退。
// 回归协议（2026-07-08）：todayISO 拉近种子历史（原 2026-06-16 距最后一场 ≥21 天，
// 无意触发停练重启改变轮换指针——本测试意图是轮换/点名，非回归场景）。

import XCTest
@testable import RedeTrainingDecision

final class PinnedMainTests: XCTestCase {
    /// dayCount 决定今天的 dayCode（count % 6，splitType=push-pull-legs）；空场计数、日期窗外 → train。
    private func planOn(dayCount: Int) throws -> TodayPrescription {
        let sessions = (0..<dayCount).map { i in
            #"{"id":"h\#(i)","date":"2026-05-\#(String(format: "%02d", 10 + i))","completed":true,"exercises":[]}"#
        }.joined(separator: ",")
        let json = #"{"schemaVersion":8,"history":[\#(sessions)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-05-16")
        return try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input)))
    }

    func testLegsBPinsDeadliftAndBulgarian() throws {
        let p = try planOn(dayCount: 5) // count 5 → legs-b
        XCTAssertEqual(p.dayCode, "legs-b")
        let ids = Set(p.exercises.map(\.exerciseId))
        XCTAssertTrue(ids.contains("deadlift"), "legs-B 后链主项应点名硬拉：\(ids)")
        XCTAssertTrue(ids.contains("bulgarian-split-squat"), "legs-B 应含保加利亚分腿蹲：\(ids)")
        XCTAssertFalse(ids.contains("squat"), "legs-B 不应出现 legs-A 的杠铃深蹲（A/B 区分）")
    }

    func testPullBPinsWideGripAndChestSupported() throws {
        let p = try planOn(dayCount: 4) // count 4 → pull-b
        XCTAssertEqual(p.dayCode, "pull-b")
        let ids = Set(p.exercises.map(\.exerciseId))
        XCTAssertTrue(ids.contains("wide-grip-pulldown"), "pull-B 垂直拉应点名宽握下拉：\(ids)")
        XCTAssertTrue(ids.contains("chest-supported-db-row"), "pull-B 主项应点名俯身支撑划船：\(ids)")
        XCTAssertFalse(ids.contains("lat-pulldown"), "pull-B 不应出现 pull-A 的高位下拉（A/B 区分）")
    }
}
