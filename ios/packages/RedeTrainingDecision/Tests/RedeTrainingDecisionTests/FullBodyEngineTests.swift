// 全身模式（2-3 天，循证频率映射 2026-06-16）：full-body → full-a/b/c 三变式轮换，
// 每日覆盖全身（股四/后链/胸/背/肩/臂），三变式主项互不相同。每肌群 2-3×/周由「每次都练全身」达成。
// 回归协议（2026-07-08）：todayISO 拉近种子历史（原 2026-06-16 距最后一场 ≥21 天，
// 无意触发停练重启改变轮换指针——本测试意图是轮换/点名，非回归场景）。

import XCTest
@testable import RedeTrainingDecision

final class FullBodyEngineTests: XCTestCase {
    func testDaySequenceIsThreeFullBodyVariants() {
        XCTAssertEqual(TodayPrescriptionEngine.daySequence(splitType: "full-body"), ["full-a", "full-b", "full-c"])
    }

    /// historyCount 决定今天轮到 full-a/b/c（count % 3）；空场计入轮换计数，日期窗外 → train。
    private func plan(historyCount: Int) throws -> TodayPrescription {
        let sessions = (0..<historyCount).map { i in
            #"{"id":"h\#(i)","date":"2026-05-2\#(i)","completed":true,"exercises":[]}"#
        }.joined(separator: ",")
        let json = #"{"schemaVersion":8,"history":[\#(sessions)],"programTemplate":{"splitType":"full-body","daysPerWeek":3}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-05-25")
        return try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input)))
    }

    func testEachFullBodyDayFillsWholeBodyWithDistinctMains() throws {
        let a = try plan(historyCount: 0)
        let b = try plan(historyCount: 1)
        let c = try plan(historyCount: 2)
        XCTAssertEqual(a.dayCode, "full-a")
        XCTAssertEqual(b.dayCode, "full-b")
        XCTAssertEqual(c.dayCode, "full-c")
        for p in [a, b, c] {
            XCTAssertGreaterThanOrEqual(p.exercises.count, 6, "\(p.dayCode) 应 ≥6 个动作（全身一遍；full-c 含小腿为 7）")
            XCTAssertFalse(
                p.dayReasons.contains { if case .slotUnfilled = $0 { return true }; return false },
                "\(p.dayCode) 不应有空槽"
            )
        }
        // 三变式主项互不相同 = 真有变化（深蹲 / 哈克蹲 / 腿举）。
        let mains = Set([a, b, c].map { $0.exercises.first!.exerciseId })
        XCTAssertEqual(mains.count, 3, "三个全身日主项应互不相同：\(mains)")
        // 每日都含一个下肢主项与一个上肢推（全身覆盖抽样校验）。
        for p in [a, b, c] {
            let patterns = Set(p.exercises.compactMap { ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern })
            XCTAssertTrue(patterns.contains("squat-pattern") || patterns.contains("hinge"), "\(p.dayCode) 应含下肢")
            XCTAssertTrue(
                patterns.contains("horizontal-press") || patterns.contains("incline-press") || patterns.contains("vertical-press"),
                "\(p.dayCode) 应含上肢推"
            )
        }
    }
}
