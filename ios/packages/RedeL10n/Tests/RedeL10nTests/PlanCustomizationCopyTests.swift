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

    func testDaySequenceEditorReusesNeutralRemovalUndoCopy() {
        XCTAssertEqual(zh.planEditRemovedLine(zh.trainingDayName("push-b")), "已移除「推 B」")
        XCTAssertEqual(en.planEditRemovedLine(en.trainingDayName("push-b")), "Removed Push B")
        XCTAssertEqual(zh.planEditRemovedUndoA11y(zh.trainingDayName("push-b")), "已移除 推 B，撤销")
        XCTAssertEqual(en.planEditRemovedUndoA11y(en.trainingDayName("push-b")), "Removed Push B, undo")
    }
}
