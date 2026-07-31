// FR-PL6 移除撤销条文案精确断言（2026-07-20 owner 实机反馈批）。
// 条上唯一 ember 是「撤销」动作词（复用 coachUndoLabel）；正文 t3；a11y 整读不带书名号。

import XCTest
@testable import RedeL10n

final class PlanCustomizationCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testPlanEditRemovedLineExact() {
        XCTAssertEqual(zh.planEditRemovedLine("哑铃卧推"), "已移除「哑铃卧推」")
        XCTAssertEqual(en.planEditRemovedLine("Dumbbell Bench Press"), "Removed Dumbbell Bench Press")
    }

    func testPlanEditRemovedUndoA11yExact() {
        // VoiceOver 整读：不带书名号，动作词收尾（「已移除 哑铃卧推，撤销」）。
        XCTAssertEqual(zh.planEditRemovedUndoA11y("哑铃卧推"), "已移除 哑铃卧推，撤销")
        XCTAssertEqual(en.planEditRemovedUndoA11y("Dumbbell Bench Press"), "Removed Dumbbell Bench Press, undo")
    }

    func testUndoActionWordReusesCoachUndoLabel() {
        // 撤销动作词与今日页撤销条同源（coachUndoLabel），不另造串。
        XCTAssertEqual(zh.coachUndoLabel, "撤销")
        XCTAssertEqual(en.coachUndoLabel, "Undo")
    }

    func testFreeDaySequenceEditorCopyExact() {
        XCTAssertEqual(zh.planSeqEditEntry, "编排训练日")
        XCTAssertEqual(en.planSeqEditEntry, "Arrange training days")
        XCTAssertEqual(zh.planSeqEditEntryHint, "更换、添加、移除或重排训练日")
        XCTAssertEqual(en.planSeqEditEntryHint, "Change, add, remove, or reorder training days")
        XCTAssertEqual(zh.planSeqEditTitle, "训练日编排")
        XCTAssertEqual(en.planSeqEditTitle, "Training day sequence")
        XCTAssertEqual(
            zh.planSeqEditSubtitle,
            "换类型、添加或移除训练日；长按一行可拖动重排，轮转按已完成场次推进"
        )
        XCTAssertEqual(
            en.planSeqEditSubtitle,
            "Change, add, or remove training days; touch and hold a row to reorder. Rotation advances by completed sessions"
        )
        XCTAssertEqual(zh.planSeqChooseDay, "选择训练日")
        XCTAssertEqual(en.planSeqChooseDay, "Choose a training day")
        XCTAssertEqual(zh.planSeqChangeDay, "更换训练日")
        XCTAssertEqual(en.planSeqChangeDay, "Change training day")
        XCTAssertEqual(zh.planSeqAddDay, "添加训练日")
        XCTAssertEqual(en.planSeqAddDay, "Add training day")
    }

    func testDaySequencePickerGroupCopyExact() {
        XCTAssertEqual(
            [
                zh.planSeqGroupPush,
                zh.planSeqGroupPull,
                zh.planSeqGroupLegs,
                zh.planSeqGroupUpperLower,
                zh.planSeqGroupFullBody,
            ],
            ["推", "拉", "腿", "上下肢", "全身"]
        )
        XCTAssertEqual(
            [
                en.planSeqGroupPush,
                en.planSeqGroupPull,
                en.planSeqGroupLegs,
                en.planSeqGroupUpperLower,
                en.planSeqGroupFullBody,
            ],
            ["Push", "Pull", "Legs", "Upper / Lower", "Full body"]
        )
    }

    func testPlanHeroUsesNeutralCycleFactForCustomizedDaySequence() {
        XCTAssertEqual(
            zh.planHeroHeadline(isCustomizedDaySequence: true, splitCode: "ppl-ul", days: 5, goalCode: "hypertrophy"),
            "自定义 · 5 天循环"
        )
        XCTAssertEqual(
            en.planHeroHeadline(isCustomizedDaySequence: true, splitCode: "ppl-ul", days: 5, goalCode: "hypertrophy"),
            "Custom · 5-day cycle"
        )
        XCTAssertEqual(
            en.planHeroHeadline(isCustomizedDaySequence: false, splitCode: "push-pull-legs", days: 5, goalCode: "strength"),
            "Push / Pull / Legs, 5 days a week — built for strength",
            "未自定义时保持原模板 hero"
        )
    }

    func testDaySequenceEditorReusesNeutralRemovalUndoCopy() {
        XCTAssertEqual(zh.planEditRemovedLine(zh.trainingDayName("push-b")), "已移除「推 B」")
        XCTAssertEqual(en.planEditRemovedLine(en.trainingDayName("push-b")), "Removed Push B")
        XCTAssertEqual(zh.planEditRemovedUndoA11y(zh.trainingDayName("push-b")), "已移除 推 B，撤销")
        XCTAssertEqual(en.planEditRemovedUndoA11y(en.trainingDayName("push-b")), "Removed Push B, undo")
    }

    func testSaveToPlanRowCopyExact() {
        XCTAssertEqual(zh.saveToPlanAction, "存进计划")
        XCTAssertEqual(en.saveToPlanAction, "Save to plan")
        XCTAssertEqual(zh.saveToPlanSuccess, "已存进计划")
        XCTAssertEqual(en.saveToPlanSuccess, "Saved to plan")
        XCTAssertEqual(zh.saveToPlanHint, "将今天的动作和顺序存进计划")
        XCTAssertEqual(en.saveToPlanHint, "Save today's exercises and order to your plan")
        XCTAssertEqual(zh.saveToPlanFailure, "暂时无法存进计划　请再试一次")
        XCTAssertEqual(en.saveToPlanFailure, "Couldn't save to plan · Try again")
    }

    func testSaveToPlanFactNamesAndNeutralOrderExact() {
        XCTAssertEqual(
            zh.saveToPlanFact(addedExerciseNames: ["哑铃弯举"], removedExerciseNames: []),
            "今天加了哑铃弯举"
        )
        XCTAssertEqual(
            en.saveToPlanFact(addedExerciseNames: ["Dumbbell curl"], removedExerciseNames: []),
            "You added Dumbbell curl today"
        )
        XCTAssertEqual(
            zh.saveToPlanFact(addedExerciseNames: [], removedExerciseNames: ["面拉"]),
            "今天去掉了面拉"
        )
        XCTAssertEqual(
            en.saveToPlanFact(addedExerciseNames: [], removedExerciseNames: ["Face pull"]),
            "You removed Face pull today"
        )
        XCTAssertEqual(
            zh.saveToPlanFact(addedExerciseNames: [], removedExerciseNames: []),
            "今天调整了动作顺序"
        )
        XCTAssertEqual(
            en.saveToPlanFact(addedExerciseNames: [], removedExerciseNames: []),
            "You adjusted today's exercise order"
        )
    }

    func testSaveToPlanFactCombinesChangesAndSummarizesMultipleNames() {
        XCTAssertEqual(
            zh.saveToPlanFact(addedExerciseNames: ["哑铃弯举"], removedExerciseNames: ["面拉"]),
            "今天加了哑铃弯举，去掉了面拉"
        )
        XCTAssertEqual(
            en.saveToPlanFact(addedExerciseNames: ["Dumbbell curl"], removedExerciseNames: ["Face pull"]),
            "You added Dumbbell curl and removed Face pull today"
        )
        XCTAssertEqual(
            zh.saveToPlanFact(addedExerciseNames: ["哑铃弯举", "绳索弯举"], removedExerciseNames: []),
            "今天加了 2 个动作"
        )
        XCTAssertEqual(
            en.saveToPlanFact(addedExerciseNames: ["Dumbbell curl", "Cable curl"], removedExerciseNames: []),
            "You added 2 exercises today"
        )
        XCTAssertEqual(
            zh.saveToPlanFact(addedExerciseNames: [], removedExerciseNames: ["面拉", "反向飞鸟"]),
            "今天去掉了 2 个动作"
        )
        XCTAssertEqual(
            en.saveToPlanFact(addedExerciseNames: [], removedExerciseNames: ["Face pull", "Reverse fly"]),
            "You removed 2 exercises today"
        )
        XCTAssertEqual(
            zh.saveToPlanFact(addedExerciseNames: ["哑铃弯举", "绳索弯举"], removedExerciseNames: ["面拉", "反向飞鸟"]),
            "今天加了 2 个动作，去掉了 2 个动作"
        )
        XCTAssertEqual(
            en.saveToPlanFact(addedExerciseNames: ["Dumbbell curl", "Cable curl"], removedExerciseNames: ["Face pull", "Reverse fly"]),
            "You added 2 exercises and removed 2 exercises today"
        )
    }
}
