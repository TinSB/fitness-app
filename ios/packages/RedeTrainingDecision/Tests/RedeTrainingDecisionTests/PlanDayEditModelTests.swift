// FR-PL6 编辑器「移除撤销 + 采纳收敛」纯模型（2026-07-20 owner 实机反馈批）：
// 撤栈还原顺序 / 重复 id 跳过 / index 夹取 / 清栈时机 / 默认等值判断。
// 纯逻辑（无 UI、无落盘），供 PlanDayEditorView 消费。

import XCTest
@testable import RedeTrainingDecision

final class PlanDayEditModelTests: XCTestCase {

    // MARK: - 撤销栈：还原到原位置

    func testUndoRestoresRemovedIdAtOriginalIndex() throws {
        // 从 [a,b,c] 移除 b（index 1）→ 撤销 → 回到 [a,b,c]。
        var undo = PlanDayEditUndoModel()
        undo.recordRemoval(id: "b", index: 1)
        XCTAssertEqual(undo.lastRemovedId, "b", "撤销条正文显示最近一次移除")
        let restored = undo.undo(current: ["a", "c"])
        XCTAssertEqual(restored, ["a", "b", "c"], "还原到原 index")
        XCTAssertTrue(undo.isEmpty, "栈空 → 撤销条消失")
    }

    func testThreeRemovalsUndoInReverseOrderEachAtItsIndex() throws {
        // 连删 a(0)、c(1)、d(1)（每次从当前列表删）→ 连撤三次逐个还原，最终回到起点。
        var undo = PlanDayEditUndoModel()
        var list = ["a", "b", "c", "d"]
        for id in ["a", "c", "d"] {
            let idx = list.firstIndex(of: id)!
            undo.recordRemoval(id: id, index: idx)
            list.removeAll { $0 == id }
        }
        XCTAssertEqual(list, ["b"])
        XCTAssertEqual(undo.lastRemovedId, "d")
        list = undo.undo(current: list)!   // 撤 d
        XCTAssertEqual(list, ["b", "d"])
        XCTAssertEqual(undo.lastRemovedId, "c", "逐次撤销后条正文跟随新栈顶")
        list = undo.undo(current: list)!   // 撤 c
        XCTAssertEqual(list, ["b", "c", "d"], "c 回原 index 1")
        list = undo.undo(current: list)!   // 撤 a
        XCTAssertEqual(list, ["a", "b", "c", "d"], "三连撤回到起点")
        XCTAssertTrue(undo.isEmpty)
    }

    func testUndoClampsIndexWhenListShrank() throws {
        // 原 index 超出当前 count（期间又删了别的）→ 夹到末尾，不崩。
        var undo = PlanDayEditUndoModel()
        undo.recordRemoval(id: "x", index: 5)
        XCTAssertEqual(undo.undo(current: ["a"]), ["a", "x"], "min(原 index, count) 落到末尾")
    }

    func testUndoAfterReorderRestoresByIndexNotAdjacency() throws {
        // 语义锁（验收 NIT，PRD FR-PL6「交错重排后按下标还原」）：移除后用户拖动重排
        // 幸存者，撤销仍插回原下标位——不是原相邻关系。防未来被「顺手修正」成邻接还原。
        var undo = PlanDayEditUndoModel()
        undo.recordRemoval(id: "b", index: 1)              // [a,b,c,d] 移除 b
        let reordered = ["d", "a", "c"]                    // 期间用户把 d 拖到最前
        XCTAssertEqual(undo.undo(current: reordered), ["d", "b", "a", "c"], "b 回下标 1，非跟随 a")
    }

    // MARK: - 防呆：已重新加入的 id 跳过继续 pop

    func testUndoSkipsIdReAddedViaPicker() throws {
        // 删 b 后经添加器把 b 加回 → 撤销跳过 b 那条，继续还原更早的 a。
        var undo = PlanDayEditUndoModel()
        undo.recordRemoval(id: "a", index: 0)
        undo.recordRemoval(id: "b", index: 1)
        let restored = undo.undo(current: ["c", "b"])   // b 已在列表
        XCTAssertEqual(restored, ["a", "c", "b"], "跳过 b，还原 a 到 index 0")
        XCTAssertTrue(undo.isEmpty, "被跳过的条目已出栈不残留")
    }

    func testUndoReturnsNilWhenAllEntriesAlreadyPresent() throws {
        // 栈里唯一条目已被重新加入 → 无可还原：返回 nil、栈清空。
        var undo = PlanDayEditUndoModel()
        undo.recordRemoval(id: "b", index: 0)
        XCTAssertNil(undo.undo(current: ["b", "c"]))
        XCTAssertTrue(undo.isEmpty)
    }

    func testUndoOnEmptyStackReturnsNil() throws {
        var undo = PlanDayEditUndoModel()
        XCTAssertNil(undo.undo(current: ["a"]))
    }

    // MARK: - 清栈时机（恢复默认 / 采纳 / 取消后由视图调用）

    func testClearEmptiesStack() throws {
        var undo = PlanDayEditUndoModel()
        undo.recordRemoval(id: "a", index: 0)
        undo.recordRemoval(id: "b", index: 1)
        undo.clear()
        XCTAssertTrue(undo.isEmpty)
        XCTAssertNil(undo.lastRemovedId)
        XCTAssertNil(undo.undo(current: []))
    }

    // MARK: - 采纳收敛裁定（裁定 B：列表==默认时不写冗余自定义）

    func testApplyResolutionWritesCustomWhenDifferentFromDefault() throws {
        XCTAssertEqual(
            PlanDayEditRules.applyResolution(working: ["a", "c"], defaults: ["a", "b", "c"], wasCustomized: false),
            .writeCustom
        )
        // 同集合但顺序不同 = 仍是自定义（顺序即语义）。
        XCTAssertEqual(
            PlanDayEditRules.applyResolution(working: ["b", "a"], defaults: ["a", "b"], wasCustomized: true),
            .writeCustom
        )
    }

    func testApplyResolutionClearsCustomWhenBackToDefault() throws {
        // 已自定义 + 暂存列表==默认 → 落盘走 removeCustomDayPlan（canonical 不留冗余覆盖）。
        XCTAssertEqual(
            PlanDayEditRules.applyResolution(working: ["a", "b"], defaults: ["a", "b"], wasCustomized: true),
            .clearCustom
        )
    }

    func testApplyResolutionNoopWhenDefaultAndNeverCustomized() throws {
        // 未自定义 + 列表==默认 → 采纳等价于无操作（不写盘直接关面板）。
        XCTAssertEqual(
            PlanDayEditRules.applyResolution(working: ["a", "b"], defaults: ["a", "b"], wasCustomized: false),
            .noop
        )
    }

    func testIsAtDefaultDrivesRestoreButtonDisabledState() throws {
        // 「恢复默认」置灰条件 = 列表逐项等于默认（含顺序）。
        XCTAssertTrue(PlanDayEditRules.isAtDefault(working: ["a", "b"], defaults: ["a", "b"]))
        XCTAssertFalse(PlanDayEditRules.isAtDefault(working: ["b", "a"], defaults: ["a", "b"]))
        XCTAssertFalse(PlanDayEditRules.isAtDefault(working: [], defaults: ["a", "b"]))
    }
}
