// 基准完整性（2026-10-20 引擎审查第一批，owner 真实数据重放抓到）：
// ① 轻练 / 减载日减下来的重量不成为下次的起点；② 周期减载周不复利、下一块不从更低处起步；
// ③ 停练回归按每个动作自己多久没做判；④ 隔两周练一次不越练越轻；
// ⑤ 真能配出的离格重量（选重机 45 lb）保持就是它本身，加重只上紧邻一格。

import Foundation
import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class BaselineIntegrityTests: XCTestCase {
    private let lbPerKg = 2.204_622_621_8

    private struct Session {
        let date: String
        let exerciseId: String
        let sets: [(weightKg: Double, reps: Int, rir: Int)]
    }

    private func input(_ sessions: [Session], today: String, split: String = "upper-lower",
                       daysPerWeek: Int = 2, unit: String = "kg") throws -> CleanTrainingDecisionInput {
        let history = sessions.enumerated().map { index, session -> String in
            let sets = session.sets.enumerated().map { setIndex, set in
                #"{"setIndex":\#(setIndex + 1),"exerciseId":"\#(session.exerciseId)","reps":\#(set.reps),"rir":\#(set.rir),"weight":\#(set.weightKg),"done":true,"completionStatus":"completed"}"#
            }.joined(separator: ",")
            return #"{"id":"s\#(index)","date":"\#(session.date)","completed":true,"endReason":"completedAll","exercises":[{"id":"s\#(index)-e","exerciseId":"\#(session.exerciseId)","sets":[\#(sets)]}]}"#
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

    private func bench(_ date: String, _ kg: Double, reps: Int = 12, rir: Int = 2, sets: Int = 1) -> Session {
        Session(date: date, exerciseId: "db-bench-press", sets: Array(repeating: (kg, reps, rir), count: sets))
    }

    // MARK: ① 轻练日

    func testALightDaysReducedWeightIsNotTheNextBaseline() throws {
        // 每周 2 天的计划，周一、周三都练了 30 kg 打满；周五多练一天 → 引擎开轻练（本周已练满），
        // 用户照着做了 27.5。下周一照常练：该从 30 往上加（32.5），不是从 27.5 往上爬（30）。
        let history = [bench("2026-10-05", 30), bench("2026-10-07", 30), bench("2026-10-09", 27.5, rir: 3)]
        let monday = try prescription("db-bench-press", try input(history, today: "2026-10-12"), day: "upper")
        XCTAssertEqual(monday.targetWeightKg, 32.5, accuracy: 0.001)
        XCTAssertEqual(monday.change, .increase)
        XCTAssertEqual(monday.previousWeightKg ?? 0, 30, accuracy: 0.001, "「上次」显示判断所依据的那一次")
    }

    func testALightDayThatWasAStruggleStillDrivesTheEase() throws {
        // 轻练日也练到力竭：那是实打实的能力信号——照它回退，不越过它找更重的那次。
        let history = [bench("2026-10-05", 30), bench("2026-10-07", 30), bench("2026-10-09", 27.5, reps: 6, rir: 0)]
        let monday = try prescription("db-bench-press", try input(history, today: "2026-10-12"), day: "upper")
        XCTAssertEqual(monday.change, .ease)
        XCTAssertEqual(monday.targetWeightKg, 25, accuracy: 0.001)
    }

    // MARK: ② 周期减载周

    func testDeloadWeekDoesNotCompoundAndTheNextBlockResumesFromBeforeIt() throws {
        // 4 周一块、每周一 / 四练；前三周 30 kg 打满。第 4 周（09-28 起）是减载周。
        var history = ["2026-09-07", "2026-09-10", "2026-09-14", "2026-09-17", "2026-09-21", "2026-09-24"]
            .map { bench($0, 30) }
        let first = try prescription("db-bench-press", try input(history, today: "2026-09-28", daysPerWeek: 3),
                                     day: "upper", mesocycle: true)
        XCTAssertLessThan(first.targetWeightKg, 30, "前置：减载周确实减了")
        // 照着做了减载周第一次；第二次（10-01）必须与第一次一样——以前会在已减过的重量上再 ×0.85。
        history.append(bench("2026-09-28", first.targetWeightKg, rir: 4))
        let second = try prescription("db-bench-press", try input(history, today: "2026-10-01", daysPerWeek: 3),
                                      day: "upper", mesocycle: true)
        XCTAssertEqual(second.targetWeightKg, first.targetWeightKg, accuracy: 0.001, "减载只打一次")

        // 下一块第 1 周（10-05）：从减载前那次（30 打满）接着走，不从减载的重量起步。
        history.append(bench("2026-10-01", second.targetWeightKg, rir: 4))
        let nextBlock = try prescription("db-bench-press", try input(history, today: "2026-10-05", daysPerWeek: 3),
                                         day: "upper", mesocycle: true)
        XCTAssertGreaterThanOrEqual(nextBlock.targetWeightKg, 30, "新一块不能比减载前更轻")
    }

    // MARK: ③④ 停练回归

    func testComebackIsJudgedPerExerciseNotOnlyOnTheFirstDayBack() throws {
        // 卧推 08-03 之后就没做过，其它训练一直在练（整体不算停练）。08-20 轮到上肢：
        // 卧推自己已停 17 天 → 按回归走：不加重、×0.9（以前照旧在 17 天前的重量上加一档）。
        let others = ["2026-08-10", "2026-08-14", "2026-08-18"].map {
            Session(date: $0, exerciseId: "leg-press", sets: [(100, 12, 2)])
        }
        let upper = try prescription("db-bench-press", try input([bench("2026-08-03", 30)] + others,
                                                                 today: "2026-08-20", daysPerWeek: 4), day: "upper")
        XCTAssertNotEqual(upper.change, .increase)
        XCTAssertEqual(upper.targetWeightKg, 27.5, accuracy: 0.001)
    }

    func testTrainingEveryTwoWeeksDoesNotKeepCuttingTheWeight() throws {
        // owner 的真实节奏：隔两周多练一次。08-20 那次已经是回归后按 ×0.9 做的 27.5，而且练成了；
        // 09-05 又隔 16 天：保持 27.5，不再在已减过的重量上再减一成（以前 25 → 22.5 → … 越练越轻）。
        let history = [bench("2026-08-03", 30), bench("2026-08-20", 27.5)]
        let next = try prescription("db-bench-press", try input(history, today: "2026-09-05"), day: "upper")
        XCTAssertEqual(next.targetWeightKg, 27.5, accuracy: 0.001)
        XCTAssertNotEqual(next.change, .increase, "停练回来照旧不加重")
    }

    func testAThreeWeekGapAfterAComebackStillEasesBack() throws {
        // 停三周以上力量真会掉：即使上次是回归后练成的，照旧按档回落（21-41 天 ×0.85）。
        let history = [bench("2026-08-03", 30), bench("2026-08-20", 27.5)]
        let next = try prescription("db-bench-press", try input(history, today: "2026-09-14"), day: "upper")
        XCTAssertLessThan(next.targetWeightKg, 27.5)
    }

    // MARK: ⑤ 离格重量

    private func chestPress(_ lb: Double, reps: [Int], rir: Int) throws -> ExercisePrescriptionPlan {
        let kg = lb / lbPerKg
        let history = [Session(date: "2026-10-06", exerciseId: "machine-chest-press",
                               sets: reps.map { (kg, $0, rir) })]
        let input = try input(history, today: "2026-10-12", split: "ppl-ul", daysPerWeek: 5, unit: "lb")
        return try prescription("machine-chest-press", input, day: "push-a")
    }

    func testAnOffGridMachineWeightIsHeldAsIsAndProgressesOneRealPlate() throws {
        // owner 真实数据：器械推胸 45 lb（选重机按 10 lb 一格算，真机有 5 lb 微调片）。
        // 打满 → 上紧邻一格 50 lb（以前先吸到 50 再加一整档 = 60，一下 +33%）。
        let up = try chestPress(45, reps: [12, 12], rir: 2)
        XCTAssertEqual(up.change, .increase)
        XCTAssertEqual(up.targetWeightKg * lbPerKg, 50, accuracy: 0.01)
        // 区间内 → 保持就是 45 lb（以前悄悄吸到 50，「保持」却变重了）。
        let hold = try chestPress(45, reps: [10, 10], rir: 2)
        XCTAssertEqual(hold.change, .hold)
        XCTAssertEqual(hold.targetWeightKg * lbPerKg, 45, accuracy: 0.01)
        XCTAssertEqual(hold.nextProjectedWeightKg * lbPerKg, 50, accuracy: 0.01, "下一档也是紧邻那一格")
        // 力竭 → 退到紧邻下一格 40 lb。
        let ease = try chestPress(45, reps: [8, 6], rir: 0)
        XCTAssertEqual(ease.change, .ease)
        XCTAssertEqual(ease.targetWeightKg * lbPerKg, 40, accuracy: 0.01)
    }

    func testUnitConversionLeftoversStillSnapToARealWeight() {
        // 30 kg 换成磅是 66.1 lb，现实里没有这个哑铃：不算「真能配出的重量」，照旧吸附。
        XCTAssertFalse(LoadGrid.isEnterableLoad(30, unit: .lb))
        XCTAssertTrue(LoadGrid.isEnterableLoad(45 / lbPerKg, unit: .lb))
        XCTAssertTrue(LoadGrid.isEnterableLoad(61.25, unit: .kg))
        XCTAssertEqual(LoadGrid.holdKg(30, equipment: "dumbbell", unit: .lb) * lbPerKg, 65, accuracy: 0.01)
        // 61.25 kg 的杠铃（1.25 小片）加一档 = 62.5，不是先吸到 62.5 再加到 65。
        XCTAssertEqual(LoadGrid.progressionRungKg(61.25, equipment: "barbell", unit: .kg, up: true), 62.5, accuracy: 0.001)
        // 落在格上的重量与改动前完全一致。
        XCTAssertEqual(LoadGrid.progressionRungKg(60, equipment: "barbell", unit: .kg, up: true),
                       LoadGrid.nextRungKg(60, equipment: "barbell", unit: .kg, up: true))
    }
}
