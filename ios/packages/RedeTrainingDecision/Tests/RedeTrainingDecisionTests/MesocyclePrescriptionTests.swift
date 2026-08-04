// 周期化引擎 S2/S2b/S3：相位调制接进处方 golden。
// 默认关闭=零行为变化（由现有处方 golden 全绿证明）；这里锁开启态 + 合并规则。
// 块锚 2026-05-04（3 场周历史，相邻 7 天成连续序列、稀疏故 verdict 仍 train）；
// 今日 05-20 = 块+16天 = 第 2 周过载；05-27 = 块+23天 = 第 3 周减载。
// 历史只做 db-bench-press（上肢）；今日轮到下肢日（sessions.count=3 → daySequence[1]=lower），
// 下肢动作均首练 → 两次（开/关）同一首练动作，差异纯由 phase 产生。

import Foundation
import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class MesocyclePrescriptionTests: XCTestCase {
    private func sessionJSON(_ id: String, _ date: String) -> String {
        """
        {"id":"\(id)","templateId":"upper","date":"\(date)","completed":true,"endReason":"completedAll",
         "exercises":[{"id":"\(id)-e","exerciseId":"db-bench-press","sets":[
           {"id":"\(id)-e-1","setIndex":1,"exerciseId":"db-bench-press","reps":6,"rir":2,"weight":30,"done":true,"completionStatus":"completed"}]}]}
        """
    }

    private func input(sessionDates: [String], today: String) throws -> CleanTrainingDecisionInput {
        let sessions = sessionDates.enumerated().map { sessionJSON("s\($0.offset)", $0.element) }.joined(separator: ",")
        let json = """
        {"schemaVersion":8,
         "programTemplate":{"splitType":"upper-lower","daysPerWeek":4,"primaryGoal":"hypertrophy"},
         "userProfile":{"trainingLevel":"intermediate","equipmentScenario":"commercial-gym","unitSystem":"kg","weeklyTrainingDays":4,"primaryGoal":"hypertrophy"},
         "history":[\(sessions)]}
        """
        let value = try JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))
        let appData = try AppData(decoding: value)
        return try CleanTrainingDecisionInput.make(from: CleanAppDataViewBuilder.build(from: appData), todayISO: today)
    }

    private func prescription(sessionDates: [String], today: String, meso: Bool,
                              blockLengthWeeks: Int = Mesocycle.defaultBlockLengthWeeks) throws -> TodayPrescription {
        let input = try input(sessionDates: sessionDates, today: today)
        let verdict = TodayVerdictEngine.evaluate(input)
        return try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict,
                                                          mesocycleEnabled: meso, blockLengthWeeks: blockLengthWeeks))
    }

    private let block = ["2026-05-04", "2026-05-11", "2026-05-18"]

    private func first(today: String, meso: Bool) throws -> ExercisePrescriptionPlan {
        try XCTUnwrap(try prescription(sessionDates: block, today: today, meso: meso).exercises.first)
    }

    func testDefaultParamIsOff() throws {
        XCTAssertEqual(try first(today: "2026-05-20", meso: false).targetRir, 2.0)
    }

    func testOverreachWeekActive() throws {
        let off = try first(today: "2026-05-20", meso: false)
        let on = try first(today: "2026-05-20", meso: true)
        XCTAssertEqual(on.sets, off.sets + 1, "过载周 +1 组")
        XCTAssertEqual(on.targetRir, 1.0, "过载周 RIR 1.0")
        XCTAssertEqual(on.targetWeightKg, off.targetWeightKg, "过载周重量不动（mult 1.0）")
        // S2b：全天每个动作（不止首动作、含任意 loadType）都吃到相位 RIR——证明各路径都接了相位
        let onAll = try prescription(sessionDates: block, today: "2026-05-20", meso: true)
        XCTAssertTrue(onAll.exercises.allSatisfy { $0.targetRir == 1.0 }, "全天所有动作都应吃到过载 RIR 1.0")
    }

    func testDeloadWeekActive() throws {
        let off = try first(today: "2026-05-27", meso: false)
        let on = try first(today: "2026-05-27", meso: true)
        XCTAssertEqual(on.sets, max(2, off.sets - 1), "减载周 −1 组（下限 2）")
        XCTAssertEqual(on.targetRir, 4.0, "减载周 RIR 4（整数化 2026-06-16，旧 3.5）")
        XCTAssertLessThan(on.targetWeightKg, off.targetWeightKg, "减载周重量真减（×0.85）")
    }

    func testTrainPhaseReasonsDescribeOnlyPlannedVolumeChanges() throws {
        func phaseReasons(in prescription: TodayPrescription) -> [DayPrescriptionReason] {
            prescription.dayReasons.filter {
                switch $0 {
                case .phaseOverreachAdded, .phaseDeloadReduced:
                    return true
                default:
                    return false
                }
            }
        }

        let calibrate = try prescription(sessionDates: ["2026-05-04"], today: "2026-05-07", meso: true)
        let build = try prescription(sessionDates: ["2026-05-04", "2026-05-11"], today: "2026-05-13", meso: true)
        let overreach = try prescription(sessionDates: block, today: "2026-05-20", meso: true)
        let deload = try prescription(sessionDates: block, today: "2026-05-27", meso: true)

        XCTAssertEqual(phaseReasons(in: calibrate), [], "校准周没有量变说明")
        XCTAssertEqual(phaseReasons(in: build), [], "构建周没有量变说明")
        XCTAssertEqual(phaseReasons(in: overreach), [.phaseOverreachAdded])
        XCTAssertEqual(phaseReasons(in: deload), [.phaseDeloadReduced])
    }

    func testPhaseReasonsYieldToReactiveSafetyVerdicts() throws {
        // 同一真实块锚强制分别走 light/deload：即使相位本应是 overreach，也只能保留
        // 反应式安全网的依据，绝不同时给出两条量变说明。
        let input = try input(sessionDates: block, today: "2026-05-20")
        for (call, expectedSafetyReason) in [
            (TodayCall.light, DayPrescriptionReason.verdictLightReduced),
            (TodayCall.deload, DayPrescriptionReason.verdictDeloadReduced),
        ] {
            let verdict = TodayVerdict(call: call, reason: .sustainedLoadDeload(days: 14), signals: [])
            let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
                input: input, verdict: verdict, mesocycleEnabled: true))
            XCTAssertTrue(prescription.dayReasons.contains(expectedSafetyReason))
            XCTAssertFalse(prescription.dayReasons.contains(where: { reason in
                switch reason {
                case .phaseOverreachAdded, .phaseDeloadReduced:
                    return true
                default:
                    return false
                }
            }), "\(call) 安全网优先，不能叠加计划性依据")
        }
    }

    func testPlanHonorsBlockLengthWeeks() throws {
        // 审查 MAJOR-1：plan() 必须真用传入的 blockLengthWeeks（与计划页周期条读同一配置），
        // 不能内部写死 4。今日 05-20 = 块+16 天：4 周块 → 第 2 周过载（RIR 1.0）；
        // 2 周块 → 16/7=2 周 % 2 = 第 0 周校准（RIR 3）。同日不同块长 → 不同相位，证明值真透传。
        let four = try XCTUnwrap(try prescription(sessionDates: block, today: "2026-05-20", meso: true, blockLengthWeeks: 4).exercises.first)
        let two  = try XCTUnwrap(try prescription(sessionDates: block, today: "2026-05-20", meso: true, blockLengthWeeks: 2).exercises.first)
        XCTAssertEqual(four.targetRir, 1.0, "4 周块第 2 周 = 过载")
        XCTAssertEqual(two.targetRir, 3.0, "2 周块同日回绕到第 0 周 = 校准（整数化 2026-06-16，旧 2.5）")
    }

    func testPhaseYieldsToSafetyNetWhenNotTrain() throws {
        // S3 合并：长间隔(16天)→ verdict=light（≥14 longGapReentry）+ 软重置块到今日（≥10）。
        // phase 仅 train 态生效 → light 时让位给安全网，开/关处方逐字段一致（绝不双重调制）。
        let off = try XCTUnwrap(try prescription(sessionDates: ["2026-05-04"], today: "2026-05-20", meso: false).exercises.first)
        let on = try XCTUnwrap(try prescription(sessionDates: ["2026-05-04"], today: "2026-05-20", meso: true).exercises.first)
        XCTAssertEqual(on.sets, off.sets, "非 train 态 phase 让位：组数不变")
        XCTAssertEqual(on.targetRir, off.targetRir, "非 train 态 phase 让位：RIR 不变")
        XCTAssertEqual(on.targetWeightKg, off.targetWeightKg, "非 train 态 phase 让位：重量不变")
    }

    /// 覆盖度锁（2026-08-04 验收补）：本批的目的是拔掉「组数悄悄变、抽屉一句不说」。
    /// 但依据分支 switch 的是 modulation 数值元组 + `default: break`，Swift 不会
    /// 对 MesocyclePhase 新增相位报错——新相位若改了组数/重量却落进 default，
    /// 静默就原样回来了。本测试对 allCases 穷举，把「每个相位的调制必须有明确归属」锁死。
    func testEveryMesocyclePhaseModulationHasAnExplicitReasonMapping() {
        for phase in MesocyclePhase.allCases {
            let m = phase.modulation
            let changesVolume = m.setDelta != 0
            let changesLoad = m.weightMultiplier < 1.0
            switch phase {
            case .calibrate, .build:
                XCTAssertFalse(
                    changesVolume || changesLoad,
                    "\(phase) 若开始改组数或重量，必须同批给它一条抽屉依据，不能落进 default 静默"
                )
            case .overreach:
                XCTAssertEqual(m.setDelta, 1, "过载周依据分支按 setDelta == 1 匹配")
                XCTAssertEqual(m.weightMultiplier, 1.0, "过载周若改成同时减重，文案只说「多一组」就不完整了")
            case .deload:
                XCTAssertEqual(m.setDelta, -1, "减载周依据分支按 setDelta == -1 匹配")
                XCTAssertLessThan(
                    m.weightMultiplier, 1.0,
                    "减载依据的 where weightMultiplier < 1.0 子句依赖此前提；若改成不减重，文案「重量也轻一些」就是假话"
                )
            }
        }
    }
}
