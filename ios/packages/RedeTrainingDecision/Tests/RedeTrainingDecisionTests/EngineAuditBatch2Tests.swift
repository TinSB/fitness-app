// 引擎审查第二批（2026-10-20，owner 拍板 1–8 条）：
// ① 降重看整场平均 RIR，不看最差一组；④ 保持时目标 = 上次最好 +2；⑤ 每组都剩 ≥4 次一次加两档；
// ⑧ 过载周练到力竭后，下一块从「力竭那次退一档」起，不停在减载周的重量上；
// ② 选重机 lb 一格 5；⑥ 「连续高频 → 减载」一周就结束。
// （③ 孤立动作休息 90 秒见 SessionSetPlanTests 的休息锁；⑦ 加练 / 换动作起始重量见 SessionExerciseEditPlannerTests。）

import Foundation
import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class EngineAuditBatch2Tests: XCTestCase {
    private let lbPerKg = 2.204_622_621_8

    private struct Session {
        let date: String
        let exerciseId: String
        let sets: [(weightKg: Double, reps: Int, rir: Int?)]
        /// 这一场有一组因「不适 / 疼痛」跳过（FR-TR7 的证据通道）。
        var painSkip = false
    }

    private func input(_ sessions: [Session], today: String, split: String = "upper-lower",
                       daysPerWeek: Int = 2, unit: String = "kg") throws -> CleanTrainingDecisionInput {
        let history = sessions.enumerated().map { index, session -> String in
            let sets = session.sets.enumerated().map { setIndex, set in
                let rir = set.rir.map { #","rir":\#($0)"# } ?? ""
                return #"{"setIndex":\#(setIndex + 1),"exerciseId":"\#(session.exerciseId)","reps":\#(set.reps)\#(rir),"weight":\#(set.weightKg),"done":true,"completionStatus":"completed"}"#
            }.joined(separator: ",")
            let skipped = session.painSkip
                ? #","skippedSets":[{"exerciseId":"\#(session.exerciseId)","setIndex":\#(session.sets.count + 1),"reason":"painDiscomfort"}]"#
                : ""
            return #"{"id":"s\#(index)","date":"\#(session.date)","completed":true,"endReason":"completedAll","exercises":[{"id":"s\#(index)-e","exerciseId":"\#(session.exerciseId)","sets":[\#(sets)]}]\#(skipped)}"#
        }.joined(separator: ",")
        let json = """
        {"schemaVersion":9,
         "programTemplate":{"splitType":"\(split)","daysPerWeek":\(daysPerWeek),"primaryGoal":"hypertrophy"},
         "userProfile":{"trainingLevel":"intermediate","equipmentScenario":"commercial-gym","unitSystem":"\(unit)","weeklyTrainingDays":\(daysPerWeek),"primaryGoal":"hypertrophy"},
         "history":[\(history)]}
        """
        let appData = try AppData(decoding: try JSONDecoder().decode(JSONValue.self, from: Data(json.utf8)))
        return try CleanTrainingDecisionInput.make(from: CleanAppDataViewBuilder.build(from: appData), todayISO: today)
    }

    private func prescription(_ exerciseId: String, _ input: CleanTrainingDecisionInput, day: String,
                              mesocycle: Bool = false) throws -> ExercisePrescriptionPlan {
        let verdict = TodayVerdictEngine.evaluate(input)
        let plan = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict,
                                                              mesocycleEnabled: mesocycle, dayCodeOverride: day))
        return try XCTUnwrap(plan.exercises.first { $0.exerciseId == exerciseId }, "\(exerciseId) 不在 \(day) 日")
    }

    private func bench(_ date: String, _ sets: [(Double, Int, Int?)], painSkip: Bool = false) -> Session {
        Session(date: date, exerciseId: "db-bench-press", sets: sets.map { (weightKg: $0.0, reps: $0.1, rir: $0.2) },
                painSkip: painSkip)
    }

    private func lb(_ value: Double) -> Double { value / lbPerKg }

    // MARK: ① 降重看平均 RIR

    func testOwnerLateralRaiseThatHitTheTopIsHeldNotEased() throws {
        // owner 10-06 真实记录：器械侧平举 10 lb 做了 20 / 20 / 19 / 15 次，RIR 2 / 2 / 0 / 0。后两组累到 0 是
        // 正常疲劳——以前「任何一组 0 就降」，下次目标被打回 12 次；现在持平 10 lb、目标 20 次。
        let history = [Session(date: "2026-10-06", exerciseId: "machine-lateral-raise",
                               sets: [(lb(10), 20, 2), (lb(10), 20, 2), (lb(10), 19, 0), (lb(10), 15, 0)])]
        let next = try prescription("machine-lateral-raise",
                                    try input(history, today: "2026-10-09", split: "ppl-ul", daysPerWeek: 5, unit: "lb"),
                                    day: "push-a")
        XCTAssertEqual(next.change, .hold)
        XCTAssertEqual(next.targetWeightKg * lbPerKg, 10, accuracy: 0.01)
        XCTAssertEqual(next.targetReps, 20)
    }

    func testMostSetsAtFailureStillEases() throws {
        // 平均 RIR ≤ 0.5（多数组都到力竭）照旧降一档。
        let history = [bench("2026-10-05", [(30, 8, 1), (30, 7, 0), (30, 6, 0)])]
        let next = try prescription("db-bench-press", try input(history, today: "2026-10-08"), day: "upper")
        XCTAssertEqual(next.change, .ease)
        XCTAssertEqual(next.targetWeightKg, 27.5, accuracy: 0.001)
    }

    func testFirstSetFailureThenInSessionDropHoldsAtTheTopWeight() throws {
        // 第一组 30 × 8 到力竭，组间降到 27.5 再做两组（RIR 1）：平均 0.67 > 0.5 → 不降，按拍板保持在 30，
        // 目标 = 最重那组的 8 次 +2 = 10（审查 2026-10-20 核实为预期：只有多数组到力竭才降）。
        let history = [bench("2026-10-05", [(30, 8, 0), (27.5, 8, 1), (27.5, 8, 1)])]
        let next = try prescription("db-bench-press", try input(history, today: "2026-10-08"), day: "upper")
        XCTAssertEqual(next.change, .hold)
        XCTAssertEqual(next.targetWeightKg, 30, accuracy: 0.001)
        XCTAssertEqual(next.targetReps, 10)
    }

    func testAnySetAtFailureStillBlocksTheIncrease() throws {
        // 加重仍取最差一组（显式拍板「任何一组打到力竭就不该加重」不变）：做满上限但最后一组 0 → 持平。
        let history = [bench("2026-10-05", [(30, 10, 2), (30, 10, 2), (30, 10, 0)])]
        let next = try prescription("db-bench-press", try input(history, today: "2026-10-08"), day: "upper")
        XCTAssertEqual(next.change, .hold)
        XCTAssertEqual(next.targetWeightKg, 30, accuracy: 0.001)
    }

    // MARK: ④ 保持时的目标次数

    func testHoldAsksForTwoMoreRepsNotTheTopOfTheRange() throws {
        // 哑铃卧推 6–10 次：上次 7 / 7 / 6 次 → 下次目标 9 次（以前直接 10）。
        let history = [bench("2026-10-05", [(30, 7, 2), (30, 7, 2), (30, 6, 2)])]
        let next = try prescription("db-bench-press", try input(history, today: "2026-10-08"), day: "upper")
        XCTAssertEqual(next.change, .hold)
        XCTAssertEqual(next.targetReps, 9)
        // 封顶区间上限：9 次 +2 → 10。
        let near = [bench("2026-10-05", [(30, 9, 2), (30, 9, 2), (30, 8, 2)])]
        XCTAssertEqual(try prescription("db-bench-press", try input(near, today: "2026-10-08"), day: "upper").targetReps, 10)
    }

    func testHoldTargetDoesNotOverflowOnExtremeReps() throws {
        // 干净数据只保证 reps ≥ 1；极端值走「保持」路径（平均 RIR > 0.5、最差一组 < 1）不能整数溢出崩溃。
        let history = [bench("2026-10-05", [(30, Int.max, 1), (30, Int.max, 0), (30, Int.max, 1)])]
        let next = try prescription("db-bench-press", try input(history, today: "2026-10-08"), day: "upper")
        XCTAssertEqual(next.change, .hold)
        XCTAssertEqual(next.targetReps, 10, "夹在区间上限")
    }

    // MARK: ⑤ 余力很大一次加两档

    func testBigReserveOnEverySetJumpsTwoRungs() throws {
        func next(_ sets: [(Double, Int, Int?)]) throws -> ExercisePrescriptionPlan {
            try prescription("db-bench-press", try input([bench("2026-10-05", sets)], today: "2026-10-08"), day: "upper")
        }
        let easy = try next([(40, 10, 4), (40, 10, 4), (40, 10, 5)])
        XCTAssertEqual(easy.change, .increase)
        XCTAssertEqual(easy.targetWeightKg, 45, accuracy: 0.001, "每组都剩 ≥4 次：40 → 45（两档，+12.5%）")
        // 正常余力仍只加一档。
        XCTAssertEqual(try next([(40, 10, 4), (40, 10, 3), (40, 10, 4)]).targetWeightKg, 42.5, accuracy: 0.001)
        // 两档超过 +15%（轻重量，审查 2026-10-20）：只加一档——30 → 35 是 +16.7%。
        XCTAssertEqual(try next([(30, 10, 4), (30, 10, 4), (30, 10, 5)]).targetWeightKg, 32.5, accuracy: 0.001)
        // 有一组没记 RIR：不认「每组都有余力」，只加一档。
        XCTAssertEqual(try next([(40, 10, 4), (40, 10, nil), (40, 10, 5)]).targetWeightKg, 42.5, accuracy: 0.001)
    }

    // MARK: ⑧ 过载周练到力竭 → 减载 → 下一块

    func testNextBlockStartsOneRungBelowTheOverreachStruggleNotAtTheDeloadWeight() throws {
        // 每周一 / 四练，4 周一块。第 3 周（09-21 起）过载周 09-24 那次练到力竭（平均 RIR 0.3）；
        // 第 4 周减载照做（RIR 4）。下一块（10-05）该从「力竭那次退一档」= 27.5 起，
        // 以前停在减载周的重量上（约 22.5），起点低了约 15%。
        var history = ["2026-09-07", "2026-09-10", "2026-09-14", "2026-09-17", "2026-09-21"]
            .map { bench($0, [(30, 8, 2), (30, 8, 2), (30, 8, 2)]) }
        history.append(bench("2026-09-24", [(30, 8, 1), (30, 7, 0), (30, 6, 0)]))
        let deload = try prescription("db-bench-press", try input(history, today: "2026-09-28", daysPerWeek: 3),
                                      day: "upper", mesocycle: true)
        XCTAssertLessThan(deload.targetWeightKg, 27.5, "前置：减载周确实减了")
        history.append(bench("2026-09-28", Array(repeating: (deload.targetWeightKg, 8, 4), count: 2)))
        history.append(bench("2026-10-01", Array(repeating: (deload.targetWeightKg, 8, 4), count: 2)))
        let nextBlock = try prescription("db-bench-press", try input(history, today: "2026-10-05", daysPerWeek: 3),
                                         day: "upper", mesocycle: true)
        XCTAssertEqual(nextBlock.targetWeightKg, 27.5, accuracy: 0.001)
        XCTAssertEqual(nextBlock.change, .ease)
    }

    func testASameLoadDeloadStruggleIsNotAdoptedOverTheLaterComfortableSession() throws {
        // 减载周两次同样重量：先吃力（平均 RIR 0.3）、后一次轻松（RIR 3）。下一块不能照吃力那次再往下退——
        // 后面那次才是更新的证据（审查 2026-10-20）。
        var history = ["2026-09-07", "2026-09-10", "2026-09-14", "2026-09-17", "2026-09-21", "2026-09-24"]
            .map { bench($0, [(30, 8, 2), (30, 8, 2), (30, 8, 2)]) }
        let deload = try prescription("db-bench-press", try input(history, today: "2026-09-28", daysPerWeek: 3),
                                      day: "upper", mesocycle: true)
        history.append(bench("2026-09-28", [(deload.targetWeightKg, 8, 1), (deload.targetWeightKg, 7, 0),
                                            (deload.targetWeightKg, 6, 0)]))
        history.append(bench("2026-10-01", Array(repeating: (deload.targetWeightKg, 8, 3), count: 3)))
        let nextBlock = try prescription("db-bench-press", try input(history, today: "2026-10-05", daysPerWeek: 3),
                                         day: "upper", mesocycle: true)
        XCTAssertNotEqual(nextBlock.change, .ease)
        XCTAssertGreaterThanOrEqual(nextBlock.targetWeightKg, deload.targetWeightKg)
    }

    func testPainBeforeALightDayKeepsTheBaselineOnTheLightDay() throws {
        // 每周 2 天的计划：周三练到一半因不适跳组；周五多练一天 → 轻练 27.5、练得轻松。下周一的基准
        // 停在轻练日（疼痛时留在更轻的重量上），不越过去照周三那次退。
        let history = [bench("2026-10-05", [(30, 8, 2), (30, 8, 2)]),
                       bench("2026-10-07", [(30, 8, 2)], painSkip: true),
                       bench("2026-10-09", [(27.5, 10, 3), (27.5, 10, 3)])]
        let monday = try prescription("db-bench-press", try input(history, today: "2026-10-12"), day: "upper")
        XCTAssertEqual(monday.previousWeightKg ?? 0, 27.5, accuracy: 0.001, "基准是轻练日那次")
    }

    // MARK: ② 选重机 lb 一格 5

    func testSelectorizedMachineGoesUpFivePoundsNotTen() throws {
        // owner 的器械都是 5 lb 一格：器械推胸 50 lb 做满 → 55，不再一下 60（+20%）。
        let history = [Session(date: "2026-10-06", exerciseId: "machine-chest-press",
                               sets: [(lb(50), 12, 2), (lb(50), 12, 2)])]
        let next = try prescription("machine-chest-press",
                                    try input(history, today: "2026-10-09", split: "ppl-ul", daysPerWeek: 5, unit: "lb"),
                                    day: "push-a")
        XCTAssertEqual(next.change, .increase)
        XCTAssertEqual(next.targetWeightKg * lbPerKg, 55, accuracy: 0.01)
    }

    // MARK: ⑥ 连续高频 → 减载，一周就结束

    private func verdicts(trainingOffsets: [Int], evaluate offsets: [Int], daysPerWeek: Int) throws -> [Int: TodayCall] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        let start = try XCTUnwrap(formatter.date(from: "2026-09-07"))
        func iso(_ offset: Int) -> String { formatter.string(from: start.addingTimeInterval(Double(offset) * 86_400)) }
        var result: [Int: TodayCall] = [:]
        for day in offsets {
            let history = trainingOffsets.filter { $0 < day }
                .map { Session(date: iso($0), exerciseId: "leg-press", sets: [(100, 12, 2)]) }
            result[day] = TodayVerdictEngine.evaluate(try input(history, today: iso(day), daysPerWeek: daysPerWeek)).call
        }
        return result
    }

    func testSustainedLoadDeloadWeekBoundariesAreExact() throws {
        // 计划每周 3 天、实际天天练：练满 9 天（第 9 天）触发，减载恰好第 9–15 天；之后从头数，第 25–31 天第二次。
        let calls = try verdicts(trainingOffsets: Array(0..<40), evaluate: Array(1..<40), daysPerWeek: 3)
        let deloadDays = calls.filter { $0.value == .deload }.map(\.key).sorted()
        XCTAssertEqual(deloadDays, Array(9...15) + Array(25...31))
    }

    func testRestingDuringTheDeloadWeekEndsItEarly() throws {
        // 第 9 天触发减载、照练了一天，然后连歇三天：第 11 天（歇了 2 天）仍是减载周，第 13 天（歇了 4 天）提前解除——
        // 与「窗口里有超过 2 天的间隔就不算高频」同一个口径（审查 2026-10-20）。
        let calls = try verdicts(trainingOffsets: Array(0...9), evaluate: [9, 11, 13], daysPerWeek: 3)
        XCTAssertEqual(calls[9], .deload)
        XCTAssertEqual(calls[11], .deload)
        XCTAssertNotEqual(calls[13], .deload)
    }

    func testSustainedLoadDeloadLastsOneWeekThenTheCountRestarts() throws {
        // 计划每周 3 天、实际隔一天练一次（比计划多、中间最多歇一天）：21 天里练满 9 次触发减载。以前减载
        // 那几天自己也算训练日，窗口一直是满的，之后每一场都是减载，直到连休两天；现在减载一周就结束，
        // 之后从头再数。（严格按计划天数练的人，21 天窗口在训练日凑不满，这条基本只在休息日亮。）
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        let start = try XCTUnwrap(formatter.date(from: "2026-09-07"))
        let days = stride(from: 0, to: 84, by: 2).map { formatter.string(from: start.addingTimeInterval(Double($0) * 86_400)) }
        var deloadOffsets: [Int] = []
        for index in days.indices.dropFirst() {
            let history = days[..<index].map { Session(date: $0, exerciseId: "leg-press", sets: [(100, 12, 2)]) }
            let verdict = TodayVerdictEngine.evaluate(try input(Array(history), today: days[index], daysPerWeek: 3))
            if verdict.call == .deload { deloadOffsets.append(index * 2) }
        }
        let first = try XCTUnwrap(deloadOffsets.first, "前置：隔天练满后触发减载")
        XCTAssertEqual(deloadOffsets.filter { $0 < first + 7 }, [first, first + 2, first + 4, first + 6],
                       "减载周里的训练日都是减载")
        // 减载周之后从头再数（要再练满「计划天数 × 3」次），这段时间照常练——以前之后每一场都是减载。
        XCTAssertTrue(deloadOffsets.allSatisfy { $0 < first + 7 || $0 >= first + 7 + first },
                      "减载周之后又要练满同样长的一段才再减载：\(deloadOffsets)")
        XCTAssertTrue(deloadOffsets.contains { $0 >= first + 7 + first }, "练满了会有下一次减载")
        XCTAssertLessThan(deloadOffsets.count, days.count / 3, "减载只占少数场次")
    }
}
