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
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        XCTAssertEqual(
            try encoder.encode(baseline),
            try encoder.encode(withEmpty),
            "override=nil 的完整处方编码须逐字节等价既有默认路径"
        )
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
        let custom = PlanCustomizationInput(daySequence: ["bogus-day", "push-a"]) // 含未知 dayCode
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

    func testDefaultDayExerciseIdsMatchesEnginePlan() throws {
        // 编辑器起点：0 历史 ppl → 今日 push-a；helper 应与 plan() 默认选材同一批 id（同 slotCandidates 口径）。
        let baseline = try plan(pplJSON)
        XCTAssertEqual(baseline.dayCode, "push-a")
        let helperIds = TodayPrescriptionEngine.defaultDayExerciseIds(dayCode: "push-a", equipmentScenario: nil)
        XCTAssertEqual(helperIds, baseline.exercises.map(\.exerciseId), "defaultDayExerciseIds 与 plan() 默认选材一致（共享 slotCandidates）")
    }

    func testDefaultDayExerciseIdsMatchesPlanWithScenario() throws {
        // 有器械白名单时（home-dumbbell）触发 slotCandidates 的器械/kind 软化路径——helper 与 plan() 仍同口径。
        let json = #"{"schemaVersion": 8, "userProfile": {"equipmentScenario": "home-dumbbell"}, "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 6}}"#
        let baseline = try plan(json)
        XCTAssertEqual(baseline.dayCode, "push-a")
        let helperIds = TodayPrescriptionEngine.defaultDayExerciseIds(dayCode: "push-a", equipmentScenario: "home-dumbbell")
        XCTAssertEqual(helperIds, baseline.exercises.map(\.exerciseId), "有场景白名单时 helper 与 plan() 仍一致（锁器械软化路径）")
    }

    func testProjectionDefaultUnchanged() throws {
        let custom = PlanWeekProjection.weeks(splitType: "push-pull-legs", daysPerWeek: 6, completedSessionCount: 0, weeks: 1, customization: .empty)
        let plain = PlanWeekProjection.weeks(splitType: "push-pull-legs", daysPerWeek: 6, completedSessionCount: 0, weeks: 1)
        XCTAssertEqual(custom.first?.map(\.dayCode), plain.first?.map(\.dayCode), "空覆盖投影=现状")
        XCTAssertEqual(custom.first?.map(\.exerciseCount), plain.first?.map(\.exerciseCount))
        XCTAssertEqual(custom.first?.map(\.patternCodes), plain.first?.map(\.patternCodes), "patternCodes 也零变化")
    }

    // MARK: S10 日序编辑器 public seam（默认序 / 下一个训练日预览）

    func testDefaultDaySequenceMatchesEngineRotation() {
        XCTAssertEqual(TodayPrescriptionEngine.defaultDaySequence(splitType: "push-pull-legs"),
                       ["push-a", "pull-a", "legs-a", "push-b", "pull-b", "legs-b"], "默认日序=引擎轮转序")
        XCTAssertEqual(TodayPrescriptionEngine.defaultDaySequence(splitType: "full-body"),
                       ["full-a", "full-b", "full-c"])
        // 其余两个分化分支（不同序列长度=独立轮转边界，审查 MINOR）：ppl-ul(5) / upper-lower·nil(2)。
        XCTAssertEqual(TodayPrescriptionEngine.defaultDaySequence(splitType: "ppl-ul"),
                       ["push-a", "pull-a", "legs-a", "upper", "lower"])
        XCTAssertEqual(TodayPrescriptionEngine.defaultDaySequence(splitType: nil), ["upper", "lower"])
    }

    func testNextDayCodeAcrossSplitLengths() {
        // ppl-ul 长度 5：完成 5 场 → 轮转回头到首日 push-a。
        XCTAssertEqual(TodayPrescriptionEngine.nextDayCode(splitType: "ppl-ul", daySequenceOverride: nil, completedSessionCount: 5), "push-a")
        // nil(上下肢)长度 2：完成 2 场 → 回 upper。
        XCTAssertEqual(TodayPrescriptionEngine.nextDayCode(splitType: nil, daySequenceOverride: nil, completedSessionCount: 2), "upper")
        // 防御：负 completedSessionCount 不崩、按 0 处理（取首日）。
        XCTAssertEqual(TodayPrescriptionEngine.nextDayCode(splitType: "push-pull-legs", daySequenceOverride: nil, completedSessionCount: -3), "push-a")
    }

    func testNextDayCodeAnchorsToCompletedSessions() {
        // 0 历史 → 下一个=首日 push-a；完成 1 场 → pull-a；完成 6 场 → 回 push-a（轮转）。
        XCTAssertEqual(TodayPrescriptionEngine.nextDayCode(splitType: "push-pull-legs", daySequenceOverride: nil, completedSessionCount: 0), "push-a")
        XCTAssertEqual(TodayPrescriptionEngine.nextDayCode(splitType: "push-pull-legs", daySequenceOverride: nil, completedSessionCount: 1), "pull-a")
        XCTAssertEqual(TodayPrescriptionEngine.nextDayCode(splitType: "push-pull-legs", daySequenceOverride: nil, completedSessionCount: 6), "push-a")
    }

    func testNextDayCodeReflectsProposedReorder() {
        // 把 pull-a 提到首 → 0 历史时下一个训练日预览=pull-a（编辑器护栏「下一个训练日将变为 X」）。
        let proposed = ["pull-a", "push-a", "legs-a", "push-b", "pull-b", "legs-b"]
        XCTAssertEqual(TodayPrescriptionEngine.nextDayCode(splitType: "push-pull-legs", daySequenceOverride: proposed, completedSessionCount: 0), "pull-a")
    }

    func testNextDayCodeInvalidOverrideFallsBackToDefault() {
        // 含未知 code → 整体回退默认轮转，预览仍诚实（不崩、不用半截 override）。
        XCTAssertEqual(
            TodayPrescriptionEngine.nextDayCode(
                splitType: "push-pull-legs",
                daySequenceOverride: ["pull-a", "bogus-day"],
                completedSessionCount: 0
            ),
            "push-a"
        )
    }

    func testResolvedDaySequencePublicSeedCurrentOrder() {
        // 编辑器 seed：合法白名单/长度 override → 返回它（用户当前自定义构成）；非法 → 默认。
        let valid = ["legs-a", "push-a", "pull-a", "push-b", "pull-b", "legs-b"]
        XCTAssertEqual(TodayPrescriptionEngine.resolvedDaySequence(splitType: "push-pull-legs", override: valid), valid)
        XCTAssertEqual(TodayPrescriptionEngine.resolvedDaySequence(splitType: "push-pull-legs", override: ["bogus"]),
                       TodayPrescriptionEngine.defaultDaySequence(splitType: "push-pull-legs"))
        // override 恰等于默认序：守卫放行、原样返回（== 默认）。SessionStore.isCustomized 据此再比 ≠默认 判非自定义（审查 MAJOR 触发路径）。
        let def = TodayPrescriptionEngine.defaultDaySequence(splitType: "push-pull-legs")
        XCTAssertEqual(TodayPrescriptionEngine.resolvedDaySequence(splitType: "push-pull-legs", override: def), def,
                       "override==默认序 → 返回默认（current==override 但 ==默认，故应判未自定义）")
    }

    // MARK: FR-PL7③ 自由日序构成

    func testKnownDayCodesExactlyMatchExhaustiveSlotCases() {
        let expected: Set<String> = [
            "push-a", "push-b",
            "pull-a", "pull-b",
            "legs-a", "legs-b",
            "upper", "lower",
            "full-a", "full-b", "full-c",
        ]
        XCTAssertEqual(TodayPrescriptionEngine.knownDayCodes, expected, "合法白名单须显式且恰为 11 项")
        XCTAssertEqual(
            TodayPrescriptionEngine.slotCaseDayCodes,
            expected,
            "白名单与 slots() 的 exhaustive enum case 集必须同步"
        )
        XCTAssertEqual(TodayPrescriptionEngine.maximumDaySequenceLength, 14)
    }

    func testUnknownSlotCodeStillFallsBackToUpperWithoutJoiningWhitelist() {
        XCTAssertFalse(TodayPrescriptionEngine.knownDayCodes.contains("bogus-day"))
        XCTAssertEqual(
            TodayPrescriptionEngine.defaultDayExerciseIds(dayCode: "bogus-day", equipmentScenario: nil),
            TodayPrescriptionEngine.defaultDayExerciseIds(dayCode: "upper", equipmentScenario: nil),
            "本批不改变 slots() 未知 code → upper 的既有兜底"
        )
    }

    func testResolvedDaySequenceAcceptsDifferentMembersForFiveDayUser() {
        let pushPullLegsPushPull = ["push-a", "pull-a", "legs-a", "push-b", "pull-b"]
        XCTAssertEqual(
            TodayPrescriptionEngine.resolvedDaySequence(
                splitType: "ppl-ul",
                override: pushPullLegsPushPull
            ),
            pushPullLegsPushPull,
            "5 天用户可把默认上下肢两天换成推 B / 拉 B"
        )
    }

    func testResolvedDaySequenceAcceptsRepeatedMembers() {
        let repeated = ["push-a", "pull-a", "legs-a", "push-a", "pull-a"]
        XCTAssertEqual(
            TodayPrescriptionEngine.resolvedDaySequence(splitType: "ppl-ul", override: repeated),
            repeated,
            "重复日型是合法用户编排，不得被排列守卫回退"
        )
    }

    func testResolvedDaySequenceLengthIsIndependentFromDaysPerWeek() {
        let sixStepRotation = ["push-a", "pull-a", "legs-a", "push-b", "pull-b", "legs-b"]
        XCTAssertEqual(
            TodayPrescriptionEngine.resolvedDaySequence(
                splitType: "ppl-ul",
                override: sixStepRotation
            ),
            sixStepRotation,
            "5 天/周可采用 6 元素场次轮转"
        )
        XCTAssertEqual(
            TodayPrescriptionEngine.nextDayCode(
                splitType: "ppl-ul",
                daySequenceOverride: sixStepRotation,
                completedSessionCount: 5
            ),
            "legs-b",
            "轮转继续按已完成场次取模，不按周截断"
        )
    }

    func testResolvedDaySequenceAcceptsOneThroughFourteenKnownDays() {
        XCTAssertEqual(
            TodayPrescriptionEngine.resolvedDaySequence(splitType: "ppl-ul", override: ["full-c"]),
            ["full-c"],
            "至少 1 天即可形成合法轮转"
        )
        let fourteenDays = Array(repeating: ["push-a", "pull-a", "legs-a", "full-a"], count: 4)
            .flatMap { $0 }
            .prefix(14)
        XCTAssertEqual(
            TodayPrescriptionEngine.resolvedDaySequence(
                splitType: "ppl-ul",
                override: Array(fourteenDays)
            ),
            Array(fourteenDays),
            "14 天是自由编排上限，仍须完整采用"
        )
    }

    func testResolvedDaySequenceRejectsEmptyUnknownAndOverFourteenAsAWhole() {
        let defaults = TodayPrescriptionEngine.defaultDaySequence(splitType: "ppl-ul")
        XCTAssertEqual(
            TodayPrescriptionEngine.resolvedDaySequence(splitType: "ppl-ul", override: []),
            defaults,
            "空日序整体回退默认"
        )
        XCTAssertEqual(
            TodayPrescriptionEngine.resolvedDaySequence(
                splitType: "ppl-ul",
                override: ["push-a", "bogus-day", "pull-a"]
            ),
            defaults,
            "含一个未知 code 就整体回退，不部分采纳"
        )
        XCTAssertEqual(
            TodayPrescriptionEngine.resolvedDaySequence(
                splitType: "ppl-ul",
                override: Array(repeating: "push-a", count: 15)
            ),
            defaults,
            "超过 14 天整体回退默认"
        )
    }

    func testFreeFiveDayCompositionFlowsIntoWeeklyProjection() throws {
        let custom = PlanCustomizationInput(
            daySequence: ["push-a", "pull-a", "legs-a", "push-b", "pull-b"]
        )
        let firstWeek = try XCTUnwrap(
            PlanWeekProjection.weeks(
                splitType: "ppl-ul",
                daysPerWeek: 5,
                completedSessionCount: 0,
                weeks: 1,
                customization: custom
            ).first
        )
        XCTAssertEqual(
            firstWeek.map(\.dayCode),
            ["push-a", "pull-a", "legs-a", "push-b", "pull-b"],
            "计划页周投影与今日引擎同源采用自由日序"
        )
    }

    func testCustomizedDaySequenceRequiresValidOverrideDifferentFromDefault() {
        let defaults = TodayPrescriptionEngine.defaultDaySequence(splitType: "ppl-ul")
        XCTAssertFalse(
            TodayPrescriptionEngine.isCustomizedDaySequence(splitType: "ppl-ul", override: nil),
            "nil 从未自定义"
        )
        XCTAssertFalse(
            TodayPrescriptionEngine.isCustomizedDaySequence(splitType: "ppl-ul", override: defaults),
            "合法但等于默认不算自定义"
        )
        XCTAssertFalse(
            TodayPrescriptionEngine.isCustomizedDaySequence(
                splitType: "ppl-ul",
                override: ["push-a", "bogus-day"]
            ),
            "非法 override 回退默认且不算自定义"
        )
        XCTAssertTrue(
            TodayPrescriptionEngine.isCustomizedDaySequence(
                splitType: "ppl-ul",
                override: ["push-a", "pull-a", "legs-a", "push-b", "pull-b"]
            ),
            "合法且异于默认才算自定义"
        )
    }

    // MARK: S9b 添加动作候选（同 pattern 族、守器械白名单、排除已用）

    func testAddCandidatesAreInDayPatternFamiliesAndExcludeUsed() {
        // push-a 默认含 cable-fly（fly 族）。把它放进 currentIds → 候选里不再出现它，但仍出现同族其它（如 db-fly）。
        let cands = TodayPrescriptionEngine.addCandidates(dayCode: "push-a", currentIds: ["cable-fly"], equipmentScenario: nil)
        XCTAssertFalse(cands.contains("cable-fly"), "已在清单的动作不再作为候选")
        XCTAssertFalse(cands.isEmpty, "push-a 已有 pattern 族应有可加候选")
        // 候选的 movementPattern 必须都属于 push-a 的默认 pattern 集（不跨族、不造新 pattern 槽）。
        // 动态取 slots（@testable）而非硬编码——slots 定义改了测试联动保护（审查 MINOR）。
        let dayPatterns = Set(TodayPrescriptionEngine.slots(dayCode: "push-a").map(\.pattern))
        for id in cands {
            if let p = ExerciseCatalog.minimal.entry(id: id)?.movementPattern {
                XCTAssertTrue(dayPatterns.contains(p), "\(id) 的 pattern \(p) 应属 push-a 族")
            }
        }
    }

    func testAddCandidatesRespectEquipmentWhitelist() {
        // 家用哑铃场景：候选不得含需要器械（machine/cable）的动作（FR-EQ1）。
        let cands = TodayPrescriptionEngine.addCandidates(dayCode: "push-a", currentIds: [], equipmentScenario: "home-dumbbell")
        for id in cands {
            if let e = ExerciseCatalog.minimal.entry(id: id) {
                XCTAssertNotEqual(e.equipment, "cable", "\(id) 器械 cable 不应进家用哑铃候选")
                XCTAssertNotEqual(e.equipment, "machine", "\(id) 器械 machine 不应进家用哑铃候选")
            }
        }
    }

    func testAddCandidatesEmptyDayStillOffersDayFamilies() {
        // 删空的日仍能按该 dayCode 的默认 pattern 集拿到候选（让用户重新加）。
        let cands = TodayPrescriptionEngine.addCandidates(dayCode: "push-a", currentIds: [], equipmentScenario: nil)
        XCTAssertFalse(cands.isEmpty, "空清单仍按默认 pattern 族给候选")
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
