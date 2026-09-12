// sticky 的训练日边界（2026-09-11）。
//
// 缺陷：sticky 此前按 movementPattern **全局**取「最近一场做过的动作」，不区分那个动作
// 是用户换来的、还是模板在另一个训练日本来就排的。于是模板刻意安排的 A/B 动作差异
// （full-a 杠铃卧推 / full-c 哑铃卧推）会被 sticky 当成用户选择固化——后练的永久顶替
// 先练的，第一轮之后杠铃卧推再也回不来，A/B 分化被同化。
//
// 触发不需要用户做任何事：新用户、零换动作、每次都照做，第二轮就发生。
// 修复：sticky 先在**同一 templateId（训练日）**的历史里找；找不到才回退全局
// （旧数据无 templateId → 逐字回退到原行为，golden 零变化）。

import XCTest
@testable import RedeTrainingDecision

final class StickyDayCodeTests: XCTestCase {
    /// full-a 排杠铃卧推、full-c 排哑铃卧推（都是模板本来的安排，用户没换过任何动作）。
    /// 第 4 场轮回 full-a 时，胸推槽必须还是杠铃卧推。
    private func historyJSON(withTemplateIds: Bool) -> String {
        func tid(_ code: String) -> String {
            withTemplateIds ? #""templateId":"\#(code)","# : ""
        }
        return """
        {"schemaVersion":11,
         "programTemplate":{"splitType":"full-body","daysPerWeek":3},
         "history":[
           {"id":"s1","date":"2026-05-20","completed":true,\(tid("full-a"))
            "exercises":[{"id":"e1","exerciseId":"bench-press",
              "sets":[{"id":"x1","setIndex":0,"weight":60,"reps":8,"rir":2,"done":true}]}]},
           {"id":"s2","date":"2026-05-22","completed":true,\(tid("full-b"))
            "exercises":[{"id":"e2","exerciseId":"incline-db-press",
              "sets":[{"id":"x2","setIndex":0,"weight":22.5,"reps":8,"rir":2,"done":true}]}]},
           {"id":"s3","date":"2026-05-24","completed":true,\(tid("full-c"))
            "exercises":[{"id":"e3","exerciseId":"db-bench-press",
              "sets":[{"id":"x3","setIndex":0,"weight":30,"reps":8,"rir":2,"done":true}]}]}
         ]}
        """
    }

    func testStickyDoesNotLeakAcrossTrainingDays() throws {
        let input = try TestSupport.makeInput(appDataJSON: historyJSON(withTemplateIds: true),
                                              todayISO: "2026-05-26")
        let rx = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input, verdict: TodayVerdictEngine.evaluate(input)))
        XCTAssertEqual(rx.dayCode, "full-a", "第 4 场应轮回 full-a")
        let ids = rx.exercises.map(\.exerciseId)
        XCTAssertTrue(
            ids.contains("bench-press"),
            "full-a 的杠铃卧推被别的训练日顶替了——用户从没换过动作。实得：\(ids)"
        )
        XCTAssertFalse(
            ids.contains("db-bench-press"),
            "full-c 的哑铃卧推不该爬进 full-a。实得：\(ids)"
        )
    }

    /// 旧数据没有 templateId：必须逐字保持原有全局 sticky 行为，不因本次修复变动。
    func testLegacySessionsWithoutTemplateIdKeepGlobalSticky() throws {
        let input = try TestSupport.makeInput(appDataJSON: historyJSON(withTemplateIds: false),
                                              todayISO: "2026-05-26")
        let rx = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input, verdict: TodayVerdictEngine.evaluate(input)))
        XCTAssertEqual(rx.dayCode, "full-a")
        // 无 templateId → 回退全局：最近一场胸推是 db-bench-press，沿用旧行为粘住它。
        XCTAssertTrue(
            rx.exercises.map(\.exerciseId).contains("db-bench-press"),
            "旧数据行为必须零变化（全局 sticky）"
        )
    }

    /// 用户在本训练日真的换过动作时，sticky 仍须粘住——修复不能把 FR-TR6 一起关掉。
    func testStickyStillHoldsWithinSameTrainingDay() throws {
        let json = """
        {"schemaVersion":11,
         "programTemplate":{"splitType":"full-body","daysPerWeek":3},
         "history":[
           {"id":"s1","date":"2026-05-20","completed":true,"templateId":"full-a",
            "exercises":[{"id":"e1","exerciseId":"db-bench-press",
              "sets":[{"id":"x1","setIndex":0,"weight":30,"reps":8,"rir":2,"done":true}]}]},
           {"id":"s2","date":"2026-05-22","completed":true,"templateId":"full-b","exercises":[]},
           {"id":"s3","date":"2026-05-24","completed":true,"templateId":"full-c","exercises":[]}
         ]}
        """
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-05-26")
        let rx = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input, verdict: TodayVerdictEngine.evaluate(input)))
        XCTAssertEqual(rx.dayCode, "full-a")
        XCTAssertTrue(
            rx.exercises.map(\.exerciseId).contains("db-bench-press"),
            "同一训练日内上次实际做的动作必须继续粘住（FR-TR6 不受影响）"
        )
    }
}
