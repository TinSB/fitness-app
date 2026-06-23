// 自定义训练计划引擎消费合同（FR-PL6/PL7，切片 S2/S3）：
//  - 默认空覆盖 ≡ 不传参（golden 零变化的契约）；
//  - 当日覆盖：按用户清单 + 顺序产处方，重量仍引擎算；非法项丢弃、全空回退默认；
//  - 用户显式选择高于 sticky；自定义日序重排生效、非法回退默认；投影同源。

import XCTest
@testable import RedeTrainingDecision

final class PlanCustomizationEngineTests: XCTestCase {
    private let pplJSON = #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 6}}"#

    private func plan(_ json: String, todayISO: String = "2026-06-11",
                      customization: PlanCustomizationInput = .empty) throws -> TodayPrescription {
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: todayISO)
        let verdict = TodayVerdictEngine.evaluate(input)
        return try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict, customization: customization))
    }

    func testEmptyCustomizationEqualsNoParam() throws {
        let input = try TestSupport.makeInput(appDataJSON: pplJSON, todayISO: "2026-06-11")
        let verdict = TodayVerdictEngine.evaluate(input)
        let baseline = TodayPrescriptionEngine.plan(input: input, verdict: verdict)
        let withEmpty = TodayPrescriptionEngine.plan(input: input, verdict: verdict, customization: .empty)
        XCTAssertEqual(baseline?.dayCode, withEmpty?.dayCode)
        XCTAssertEqual(baseline?.exercises.map(\.exerciseId), withEmpty?.exercises.map(\.exerciseId), "空覆盖逐字段等价（零回归）")
    }

    func testCustomDayPlanUsesUserListInOrderWithEngineWeights() throws {
        let custom = PlanCustomizationInput(dayPlans: ["push-a": [
            .init(exerciseId: "db-bench-press"),
            .init(exerciseId: "incline-db-press"),
            .init(exerciseId: "cable-fly"),
        ]])
        let result = try plan(pplJSON, customization: custom)
        XCTAssertEqual(result.dayCode, "push-a")
        XCTAssertEqual(result.exercises.map(\.exerciseId), ["db-bench-press", "incline-db-press", "cable-fly"], "按用户清单+顺序")
        for ex in result.exercises {
            XCTAssertGreaterThan(ex.targetWeightKg, 0, "\(ex.exerciseId) 重量仍由引擎算（决策在前）")
            XCTAssertGreaterThan(ex.targetReps, 0)
        }
    }

    func testCustomSetsAndRepsOverrideEngineDefaults() throws {
        let custom = PlanCustomizationInput(dayPlans: ["push-a": [
            .init(exerciseId: "db-bench-press", sets: 5, repMin: 5, repMax: 5),
        ]])
        let result = try plan(pplJSON, customization: custom)
        let ex = try XCTUnwrap(result.exercises.first { $0.exerciseId == "db-bench-press" })
        XCTAssertEqual(ex.sets, 5, "用户覆盖组数生效")
    }

    func testInvalidExerciseDroppedGracefully() throws {
        let custom = PlanCustomizationInput(dayPlans: ["push-a": [
            .init(exerciseId: "no-such-exercise"),
            .init(exerciseId: "cable-fly"),
        ]])
        let result = try plan(pplJSON, customization: custom)
        XCTAssertEqual(result.exercises.map(\.exerciseId), ["cable-fly"], "非法项丢弃，不崩、不替换")
    }

    func testAllInvalidFallsBackToDefault() throws {
        let baseline = try plan(pplJSON)
        let custom = PlanCustomizationInput(dayPlans: ["push-a": [.init(exerciseId: "no-such-exercise")]])
        let result = try plan(pplJSON, customization: custom)
        XCTAssertEqual(result.exercises.map(\.exerciseId), baseline.exercises.map(\.exerciseId), "全非法 → 回退默认模板")
    }

    func testUserPinnedBeatsSticky() throws {
        // 1 场历史在 pull-a 的 vertical-pull 槽做了 pull-up → 默认路径 sticky 会粘住 pull-up。
        let hist = #"{"id":"s0","date":"2026-06-01","completed":true,"exercises":[{"exerciseId":"pull-up","sets":[{"weight":0,"reps":8,"rir":2}]}]}"#
        let json = #"{"schemaVersion": 8, "history": [\#(hist)], "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 6}}"#
        // 先证默认路径今日=pull-a 且 sticky 激活（拉槽粘住 pull-up）
        let baseline = try plan(json)
        XCTAssertEqual(baseline.dayCode, "pull-a")
        XCTAssertTrue(baseline.exercises.map(\.exerciseId).contains("pull-up"), "默认路径 sticky 粘住 pull-up")
        // 自定义 pull-a 明确选 lat-pulldown（另一 vertical-pull 动作）→ 必须用它、不被 sticky 拉回 pull-up
        let custom = PlanCustomizationInput(dayPlans: ["pull-a": [.init(exerciseId: "lat-pulldown")]])
        let result = try plan(json, customization: custom)
        XCTAssertEqual(result.exercises.map(\.exerciseId), ["lat-pulldown"], "用户显式选择高于 sticky")
        XCTAssertFalse(result.exercises.map(\.exerciseId).contains("pull-up"), "不被 sticky 拉回")
    }

    func testCustomDaySequenceReorders() throws {
        // 默认 ppl 日序首日 = push-a；自定义把 pull-a 提到首 → 0 历史时今日变 pull-a。
        let custom = PlanCustomizationInput(daySequence: ["pull-a", "push-a", "legs-a", "push-b", "pull-b", "legs-b"])
        let result = try plan(pplJSON, customization: custom)
        XCTAssertEqual(result.dayCode, "pull-a", "自定义日序重排生效")
    }

    func testInvalidDaySequenceFallsBackToDefault() throws {
        let custom = PlanCustomizationInput(daySequence: ["bogus-day", "push-a"]) // 非默认日序排列
        let result = try plan(pplJSON, customization: custom)
        XCTAssertEqual(result.dayCode, "push-a", "非法日序 → 回退默认轮转")
    }

    func testProjectionConsumesCustomization() throws {
        let custom = PlanCustomizationInput(
            dayPlans: ["push-a": [.init(exerciseId: "db-bench-press"), .init(exerciseId: "cable-fly")]],
            daySequence: ["pull-a", "push-a", "legs-a", "push-b", "pull-b", "legs-b"]
        )
        let weeks = PlanWeekProjection.weeks(
            splitType: "push-pull-legs", daysPerWeek: 6, completedSessionCount: 0, weeks: 1,
            customization: custom
        )
        let firstWeek = try XCTUnwrap(weeks.first)
        XCTAssertEqual(firstWeek.first?.dayCode, "pull-a", "投影日序与引擎同源")
        let pushDay = try XCTUnwrap(firstWeek.first { $0.dayCode == "push-a" })
        XCTAssertEqual(pushDay.exerciseCount, 2, "自定义日投影动作数=用户清单")
        XCTAssertEqual(pushDay.patternCodes, ["horizontal-press", "fly"], "投影 pattern 来自自定义动作")
    }

    func testProjectionDefaultUnchanged() throws {
        let custom = PlanWeekProjection.weeks(splitType: "push-pull-legs", daysPerWeek: 6, completedSessionCount: 0, weeks: 1, customization: .empty)
        let plain = PlanWeekProjection.weeks(splitType: "push-pull-legs", daysPerWeek: 6, completedSessionCount: 0, weeks: 1)
        XCTAssertEqual(custom.first?.map(\.dayCode), plain.first?.map(\.dayCode), "空覆盖投影=现状")
        XCTAssertEqual(custom.first?.map(\.exerciseCount), plain.first?.map(\.exerciseCount))
        XCTAssertEqual(custom.first?.map(\.patternCodes), plain.first?.map(\.patternCodes), "patternCodes 也零变化")
    }

    func testDuplicateExerciseInCustomDayKeepsFirstOnly() throws {
        // 同动作放两次 → 只保首次（不静默丢第二槽，审查 MAJOR-1）
        let custom = PlanCustomizationInput(dayPlans: ["push-a": [
            .init(exerciseId: "db-bench-press"),
            .init(exerciseId: "cable-fly"),
            .init(exerciseId: "db-bench-press"),
        ]])
        let result = try plan(pplJSON, customization: custom)
        XCTAssertEqual(result.exercises.map(\.exerciseId), ["db-bench-press", "cable-fly"], "重复动作只保首次")
    }
}
