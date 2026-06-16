// sticky swaps（记住换动作选择，wave-9 进阶可达，owner 拍板 2026-06-13）。
//
// 模型：今日每个槽位，若其 pattern 在当日**唯一出现**，优先「上次该 pattern 实际
// 做的动作」（读历史实际 exerciseId，自然 un-stick）；该动作非法/不存在则回退 rank 默认。
// 当日同 pattern 多槽（如 pull-a 两个 curl）不 sticky，回退默认（避免歧义）。
// 全在 plan() 纯函数内，不碰训练流 reducer 与 draft 重放。
//
// 这也是 prescribeAssisted 进阶/毕业**真正可达**的前提：用户换到辅助引体并完成后，
// 今日页据此直接推荐辅助引体 → prescribeAssisted 经 plan() 生效。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class StickySwapTests: XCTestCase {
    /// 1 场历史 → 今天 pull-a（count%3==1）。历史做过的「该模式动作」今天被粘住。
    private func pullDayPlan(historyExercise: String, weight: Double, reps: Int, rir: Int, level: String = "intermediate") throws -> TodayPrescription {
        let session = #"{"id":"s0","date":"2026-06-10","completed":true,"exercises":[{"exerciseId":"\#(historyExercise)","sets":[{"weight":\#(weight),"reps":\#(reps),"rir":\#(rir)}]}]}"#
        let json = #"{"schemaVersion":8,"userProfile":{"trainingLevel":"\#(level)"},"history":[\#(session)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-13")
        return try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input)))
    }

    /// sticky：上次垂直拉做的是辅助引体 → 今日页直接推荐辅助引体，且 prescribeAssisted 可达
    /// （变强 → 辅助 30−5=25，证明进阶引擎真正跑到了）。
    func testStickyPrescribesLastActualAndAssistedEngineReachable() throws {
        let plan = try pullDayPlan(historyExercise: "assisted-pull-up", weight: 30, reps: 10, rir: 3)
        let vp = try XCTUnwrap(plan.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern == "vertical-pull"
        })
        XCTAssertEqual(vp.exerciseId, "assisted-pull-up", "sticky：今日页直接推荐上次做的辅助引体")
        XCTAssertEqual(vp.loadType, "assisted")
        XCTAssertEqual(vp.targetWeightKg, 25, "prescribeAssisted 经 sticky 可达：变强 → 辅助 30−5=25")
        XCTAssertEqual(vp.change, .increase)
    }

    /// 无该模式历史 → 回退 rank 默认（零行为变化）。
    func testNoHistoryForPatternKeepsRankDefault() throws {
        let plan = try pullDayPlan(historyExercise: "bench-press", weight: 60, reps: 8, rir: 2)
        let vp = try XCTUnwrap(plan.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern == "vertical-pull"
        })
        XCTAssertEqual(vp.exerciseId, "lat-pulldown", "垂直拉无历史 → 仍 rank 默认 lat-pulldown")
    }

    /// un-stick：上次该模式做的是 rank 默认本身 → 仍是默认（粘的是「实际做的」，不残留旧选择）。
    func testStickyUnsticksWhenLastActualIsDefault() throws {
        let plan = try pullDayPlan(historyExercise: "lat-pulldown", weight: 50, reps: 9, rir: 2)
        let vp = try XCTUnwrap(plan.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern == "vertical-pull"
        })
        XCTAssertEqual(vp.exerciseId, "lat-pulldown", "上次做默认 → 仍默认（自然 un-stick）")
    }

    /// 审查 M2：upper-lower 拆分日 8 个 pattern 全唯一、sticky 全激活——覆盖这条更广的面。
    func testStickyActivatesOnUpperLowerSplit() throws {
        // 2 场历史 → 今天 upper（count%2==0）；最近一场垂直拉做的是 pull-up（非默认 lat-pulldown）
        let sessions = [
            #"{"id":"s0","date":"2026-06-08","completed":true,"exercises":[{"exerciseId":"bench-press","sets":[{"weight":60,"reps":8,"rir":2}]}]}"#,
            #"{"id":"s1","date":"2026-06-10","completed":true,"exercises":[{"exerciseId":"pull-up","sets":[{"weight":0,"reps":12,"rir":2}]}]}"#,
        ].joined(separator: ",")
        let json = #"{"schemaVersion":8,"history":[\#(sessions)],"programTemplate":{"splitType":"upper-lower","daysPerWeek":4}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-13")
        let plan = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input)))
        XCTAssertEqual(plan.dayCode, "upper")
        let vp = try XCTUnwrap(plan.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern == "vertical-pull"
        })
        XCTAssertEqual(vp.exerciseId, "pull-up", "upper 日 sticky：垂直拉粘住上次的 pull-up（非默认）")
    }

    /// wave-10：辅助双杠（triceps 族）经 sticky 可达后，到底毕业 → 自重双杠 dip（验证毕业
    /// 派生在新族也对）。3 场历史做辅助双杠、最小辅助 5 还满次有余力 → 今天 push-a 自动换 dip。
    func testAssistedDipGraduatesToBodyweightDip() throws {
        // 一整轮 6 天（PPL×2）→ 今天轮回 push-a；日期早于今日近 7 天窗外 → 保持 train 裁决。
        let s = ["2026-05-25", "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30"].enumerated().map { i, d in
            #"{"id":"s\#(i)","date":"\#(d)","completed":true,"exercises":[{"exerciseId":"assisted-dip","sets":[{"weight":5,"reps":15,"rir":3}]}]}"#
        }.joined(separator: ",")
        let json = #"{"schemaVersion":8,"userProfile":{"trainingLevel":"intermediate"},"history":[\#(s)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-13")
        let plan = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input)))
        XCTAssertEqual(plan.dayCode, "push-a")
        let dipPlan = try XCTUnwrap(plan.exercises.first { $0.exerciseId == "dip" })
        XCTAssertEqual(dipPlan.reason, .assistedGraduated, "辅助双杠到底毕业 → 换自重双杠")
        XCTAssertEqual(dipPlan.targetWeightKg, 0, "毕业后重量轴归 0")
    }

    /// 审查 MINOR-1：上次该模式做的动作已 deprecated → 不在合法候选 → 安全回退 rank 默认。
    func testStickyFallsBackWhenLastActualIsDeprecated() throws {
        let dep = ExerciseCatalogEntry(
            id: "old-pulldown", nameZh: "旧下拉", nameEn: "Old pulldown",
            movementPattern: "vertical-pull", primaryMuscle: "back",
            equipment: "cable", kind: "compound", substitutionGroups: ["vertical-pull"],
            startWeightKg: 50, loadType: "external", rank: -50, deprecated: true
        )
        let cat = ExerciseCatalog(catalogVersion: "test", entries: [dep] + ExerciseCatalog.minimal.entries)
        let session = #"{"id":"s0","date":"2026-06-10","completed":true,"exercises":[{"exerciseId":"old-pulldown","sets":[{"weight":50,"reps":9,"rir":2}]}]}"#
        let json = #"{"schemaVersion":8,"history":[\#(session)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-13")
        let plan = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: cat))
        let vp = try XCTUnwrap(plan.exercises.first {
            cat.entry(id: $0.exerciseId)?.movementPattern == "vertical-pull"
        })
        XCTAssertEqual(vp.exerciseId, "lat-pulldown", "上次做的动作已 deprecated → 回退 rank 默认")
    }
}
