// FR-PL6 编辑器「移除撤销 + 采纳收敛」纯模型（2026-07-20 owner 实机反馈批）。
// 只管 sheet 内工作副本的编辑语义，不碰落盘/引擎判定：
// ① 撤销栈：remove 压 (id, 原 index)；undo 逐条还原（已被重新加入的跳过继续 pop）；
// ② 采纳收敛：暂存列表==默认日序时不写「与默认等值的自定义」——已自定义走 clear、否则 no-op。

import Foundation

/// 移除撤销栈（LIFO）。视图在 remove 时 `recordRemoval`、点撤销时 `undo`、
/// 恢复默认/采纳/取消时 `clear`；swap（原位替换）不入栈。
public struct PlanDayEditUndoModel: Equatable, Sendable {
    /// 一次移除：动作 id + 移除前所在 index（还原目标位置）。
    public struct Removal: Equatable, Sendable {
        public let exerciseId: String
        public let index: Int
        public init(exerciseId: String, index: Int) {
            self.exerciseId = exerciseId
            self.index = index
        }
    }

    private var stack: [Removal] = []

    public init() {}

    /// 栈空 → 撤销条消失。
    public var isEmpty: Bool { stack.isEmpty }

    /// 撤销条正文用：最近一次移除的动作 id（栈顶）。
    public var lastRemovedId: String? { stack.last?.exerciseId }

    /// remove 时压栈（调用方在删除前取 firstIndex）。
    public mutating func recordRemoval(id: String, index: Int) {
        stack.append(Removal(exerciseId: id, index: index))
    }

    /// 撤销一次：pop 栈顶还原到 `min(原 index, 当前 count)`。防呆：id 已在当前列表
    /// （期间经添加器重新加入过）则跳过该条继续 pop。返回还原后的列表；无可还原 → nil。
    public mutating func undo(current: [String]) -> [String]? {
        while let top = stack.popLast() {
            guard !current.contains(top.exerciseId) else { continue }
            var next = current
            next.insert(top.exerciseId, at: min(top.index, next.count))
            return next
        }
        return nil
    }

    /// 清栈（恢复默认 / 采纳 / 取消后调用——旧还原点对新基线已无意义）。
    public mutating func clear() {
        stack = []
    }
}

/// 裁定 B：采纳时的落盘收敛（canonical 不留与默认等值的冗余自定义）。
public enum PlanDayApplyResolution: Equatable, Sendable {
    /// 列表 ≠ 默认 → 正常写自定义（applyCustomDayPlan）。
    case writeCustom
    /// 列表 == 默认 且已有自定义记录 → 落盘走 removeCustomDayPlan 清掉自定义。
    case clearCustom
    /// 列表 == 默认 且从未自定义 → 无操作（不写盘，直接关面板）。
    case noop
}

public enum PlanDayEditRules {
    /// 默认等值判断：逐项相等（含顺序——顺序即语义，乱序仍是自定义）。
    public static func isAtDefault(working: [String], defaults: [String]) -> Bool {
        working == defaults
    }

    /// 采纳收敛裁定（见 PlanDayApplyResolution 各 case 注释）。
    public static func applyResolution(working: [String], defaults: [String], wasCustomized: Bool) -> PlanDayApplyResolution {
        guard isAtDefault(working: working, defaults: defaults) else { return .writeCustom }
        return wasCustomized ? .clearCustom : .noop
    }
}
