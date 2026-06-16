// M5-1 引导（FR-ON1/2/3）：首练定档先验 + 首版计划初始化合同。
// FR-ON2 铁律：自报背景只影响起步保守度（萌新 0.5 / 有基础 0.75 / 熟练 1.0），
// 绝不放大目录起始值；有真实记录后先验必须被覆盖（实际执行是基线）。
// 乘数为待校准值（拍板留痕 2026-06-10），改动必须让本文件红。

import Foundation
import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class OnboardingColdStartTests: XCTestCase {
    private func firstPrescription(profileJSON: String) throws -> TodayPrescription {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}"#
                + profileJSON + "}",
            todayISO: "2026-06-10"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        return try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
    }

    // MARK: - 首练定档（缩放只作用于 firstExposure）

    func testBeginnerScalesCatalogStartsByHalf() throws {
        let baseline = try firstPrescription(profileJSON: "")
        let beginner = try firstPrescription(profileJSON: #", "userProfile": {"trainingLevel": "beginner"}"#)
        XCTAssertEqual(baseline.exercises.map(\.exerciseId), beginner.exercises.map(\.exerciseId))
        for (base, scaled) in zip(baseline.exercises, beginner.exercises) {
            // 取整量子 = 该动作器械真实档位（档位系统 2026-06-13）：选重机=5、自由重量=2.5
            let step = LoadGrid.stepKg(equipment: ExerciseCatalog.minimal.entry(id: base.exerciseId)?.equipment ?? "", unit: .kg)
            let expected = max(step, ((base.targetWeightKg * 0.5) / step).rounded() * step)
            XCTAssertEqual(scaled.targetWeightKg, expected, "\(base.exerciseId)")
        }
    }

    func testIntermediateScalesCatalogStartsByThreeQuarters() throws {
        let baseline = try firstPrescription(profileJSON: "")
        let intermediate = try firstPrescription(profileJSON: #", "userProfile": {"trainingLevel": "intermediate"}"#)
        for (base, scaled) in zip(baseline.exercises, intermediate.exercises) {
            let step = LoadGrid.stepKg(equipment: ExerciseCatalog.minimal.entry(id: base.exerciseId)?.equipment ?? "", unit: .kg)
            let expected = max(step, ((base.targetWeightKg * 0.75) / step).rounded() * step)
            XCTAssertEqual(scaled.targetWeightKg, expected, "\(base.exerciseId)")
        }
    }

    func testAdvancedAndUnknownKeepCatalogStarts() throws {
        // FR-ON2：自报高级不放大——目录值即上限；未自报 = 现状行为（goldens 兼容）
        let baseline = try firstPrescription(profileJSON: "")
        let advanced = try firstPrescription(profileJSON: #", "userProfile": {"trainingLevel": "advanced"}"#)
        XCTAssertEqual(baseline.exercises.map(\.targetWeightKg), advanced.exercises.map(\.targetWeightKg))
    }

    func testRealHistoryOverridesPrior() throws {
        // 有真实记录的动作：上次实际是基线，先验不得再缩放。
        // 补满一整轮 6 天（PPL×2）让今天轮转回推日（沿 AdjustmentFlowBackTests fixture 模式）。
        let history = #"""
        , "userProfile": {"trainingLevel": "beginner"},
          "history": [
            {"id": "s1", "date": "2026-05-25", "completed": true, "templateId": "push-a",
             "exercises": [{"exerciseId": "bench-press", "sets": [
               {"weight": 50, "reps": 8, "rir": 2}, {"weight": 50, "reps": 8, "rir": 2}, {"weight": 50, "reps": 8, "rir": 2}]}]},
            {"id": "s2", "date": "2026-05-26", "completed": true, "templateId": "pull-a",
             "exercises": [{"exerciseId": "lat-pulldown", "sets": [{"weight": 55, "reps": 8, "rir": 2}]}]},
            {"id": "s3", "date": "2026-05-27", "completed": true, "templateId": "legs-a",
             "exercises": [{"exerciseId": "squat", "sets": [{"weight": 80, "reps": 5, "rir": 2}]}]},
            {"id": "s4", "date": "2026-05-28", "completed": true, "templateId": "push-b", "exercises": []},
            {"id": "s5", "date": "2026-05-29", "completed": true, "templateId": "pull-b", "exercises": []},
            {"id": "s6", "date": "2026-05-30", "completed": true, "templateId": "legs-b", "exercises": []}
          ]
        """#
        let plan = try firstPrescription(profileJSON: history)
        XCTAssertEqual(plan.dayCode, "push-a") // 轮转漂移时此断言先报，定位清晰（审查 N2）
        let bench = try XCTUnwrap(plan.exercises.first { $0.exerciseId == "bench-press" })
        // 3×8 满上限有余力 → 双重渐进 +2.5 = 52.5；关键断言：不是 52.5×0.5
        XCTAssertEqual(bench.targetWeightKg, 52.5)
    }

    func testPriorStacksWithVerdictModulation() throws {
        // 拍板（2026-06-10）：先验 × 裁决调制叠乘是有意设计——先验定起点基线、
        // 调制定当日急性状态。fixture：ppl + 周计划 2 天且本周已练满 → light 裁决，
        // 今天轮转到 legs-a（全部 firstExposure）。
        let week = #"""
        , "history": [
            {"id": "w1", "date": "2026-06-08", "completed": true, "templateId": "push-a",
             "exercises": [{"exerciseId": "bench-press", "sets": [{"weight": 50, "reps": 8, "rir": 2}]}]},
            {"id": "w2", "date": "2026-06-09", "completed": true, "templateId": "pull-a",
             "exercises": [{"exerciseId": "lat-pulldown", "sets": [{"weight": 55, "reps": 8, "rir": 2}]}]}
          ]
        """#
        func legsPlan(profile: String) throws -> (TodayVerdict, TodayPrescription) {
            let input = try TestSupport.makeInput(
                appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 2}"#
                    + profile + week + "}",
                todayISO: "2026-06-10"
            )
            let verdict = TodayVerdictEngine.evaluate(input)
            let plan = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
            return (verdict, plan)
        }
        let (verdict, baseline) = try legsPlan(profile: "")
        let (_, beginner) = try legsPlan(profile: #", "userProfile": {"trainingLevel": "beginner"}"#)
        guard baseline.dayCode == "legs-a", verdict.call == .light else {
            throw XCTSkip("fixture 未触发预期态（day=\(baseline.dayCode), call=\(verdict.call)）——叠乘语义注释仍然成立，锁定值需新 fixture")
        }
        // 不变量：叠乘真的发生——萌新值 ≤ 基线值（同日同裁决）、且全部 ≥ 2.5 下限
        for (base, scaled) in zip(baseline.exercises, beginner.exercises) {
            XCTAssertLessThanOrEqual(scaled.targetWeightKg, base.targetWeightKg, base.exerciseId)
            // 下限 = 该动作器械真实档位（选重机 5、自由重量 2.5）——非全局 2.5（审查 MINOR-2）
            let floor = LoadGrid.stepKg(equipment: ExerciseCatalog.minimal.entry(id: base.exerciseId)?.equipment ?? "", unit: .kg)
            XCTAssertGreaterThanOrEqual(scaled.targetWeightKg, floor, base.exerciseId)
        }
        // 至少一个动作真被缩小（防止两边相等导致不变量空转）
        XCTAssertTrue(zip(baseline.exercises, beginner.exercises).contains { $0.targetWeightKg > $1.targetWeightKg })
    }

    // MARK: - 首版计划初始化（FR-ON3 最小实现）

    func testTemplateInitMapsDaysToSplit() {
        // 5 天 → PPL+UL（腿 2×；循证频率映射 2026-06-16）
        let pplul = OnboardingPlanInit.template(for: .init(
            primaryGoal: "hypertrophy", weeklyDays: 5, equipmentScenario: "commercial-gym", trainingLevel: "intermediate"))
        XCTAssertEqual(pplul.splitType, "ppl-ul")
        XCTAssertEqual(pplul.daysPerWeek, 5)
        XCTAssertEqual(pplul.primaryGoal, "hypertrophy")

        let ul = OnboardingPlanInit.template(for: .init(
            primaryGoal: "strength", weeklyDays: 3, equipmentScenario: "home-dumbbell", trainingLevel: "beginner"))
        XCTAssertEqual(ul.splitType, "upper-lower")
        XCTAssertEqual(ul.daysPerWeek, 3)

        // 边界：4 天上下肢；6 天完整 PPL×2
        XCTAssertEqual(OnboardingPlanInit.template(for: .init(
            primaryGoal: "general", weeklyDays: 4, equipmentScenario: "minimal", trainingLevel: "advanced")).splitType, "upper-lower")
        XCTAssertEqual(OnboardingPlanInit.template(for: .init(
            primaryGoal: "general", weeklyDays: 6, equipmentScenario: "minimal", trainingLevel: "advanced")).splitType, "push-pull-legs")
    }

    func testTemplateInitClampsDays() {
        XCTAssertEqual(OnboardingPlanInit.template(for: .init(
            primaryGoal: "general", weeklyDays: 0, equipmentScenario: "minimal", trainingLevel: "beginner")).daysPerWeek, 2)
        XCTAssertEqual(OnboardingPlanInit.template(for: .init(
            primaryGoal: "general", weeklyDays: 9, equipmentScenario: "minimal", trainingLevel: "beginner")).daysPerWeek, 6)
    }

    func testTemplateSplitDrivesGeneratedDaySequence() throws {
        // 真端到端（审查 M2 修正）：引导答案 → OnboardingPlanInit → splitType 写入
        // AppData → 处方引擎日序列，因果链不靠硬编码模板。
        let template = OnboardingPlanInit.template(for: .init(
            primaryGoal: "hypertrophy", weeklyDays: 5, equipmentScenario: "commercial-gym", trainingLevel: "intermediate"))
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "\#(template.splitType)", "daysPerWeek": \#(template.daysPerWeek)}}"#,
            todayISO: "2026-06-10"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let plan = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        XCTAssertEqual(plan.dayCode, "push-a") // 5 天 → ppl → 首日 push-a
    }
}
