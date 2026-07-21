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
}
