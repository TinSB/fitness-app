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

/// FR-PL7③ 日序编辑器的薄工作副本。重复 dayCode 合法，故每个位置必须有独立 occurrence id；
/// 撤销历史仍只由 `PlanDayEditUndoModel` 持有，本类型不另建 removal stack。
public struct PlanDaySequenceDraft: Equatable, Sendable {
    public struct Row: Identifiable, Equatable, Sendable {
        public let id: String
        public var dayCode: String

        fileprivate init(id: String = UUID().uuidString, dayCode: String) {
            self.id = id
            self.dayCode = dayCode
        }
    }

    public private(set) var rows: [Row]
    private var removedRowsByID: [String: Row] = [:]
    private var undoModel = PlanDayEditUndoModel()

    public init(codes: [String]) {
        rows = codes.map { Row(dayCode: $0) }
    }

    public var codes: [String] { rows.map(\.dayCode) }
    public var canAppend: Bool { rows.count < TodayPrescriptionEngine.maximumDaySequenceLength }
    public var canRemove: Bool { rows.count > 1 }
    public var canUndo: Bool { !undoModel.isEmpty }

    /// 撤销条显示最近一次被移除 occurrence 的本地化 dayCode。
    public var lastRemovedDayCode: String? {
        undoModel.lastRemovedId.flatMap { removedRowsByID[$0]?.dayCode }
    }

    @discardableResult
    public mutating func replace(rowID: String, with dayCode: String) -> Bool {
        guard TodayPrescriptionEngine.knownDayCodes.contains(dayCode),
              let index = rows.firstIndex(where: { $0.id == rowID })
        else { return false }
        rows[index].dayCode = dayCode
        return true
    }

    @discardableResult
    public mutating func add(dayCode: String) -> Bool {
        guard canAppend, TodayPrescriptionEngine.knownDayCodes.contains(dayCode) else { return false }
        rows.append(Row(dayCode: dayCode))
        return true
    }

    @discardableResult
    public mutating func remove(rowID: String) -> Bool {
        guard canRemove, let index = rows.firstIndex(where: { $0.id == rowID }) else { return false }
        let row = rows[index]
        undoModel.recordRemoval(id: row.id, index: index)
        removedRowsByID[row.id] = row
        rows.remove(at: index)
        return true
    }

    /// 让既有撤销模型只处理 occurrence id 数组，再用 payload 目录还原对应 dayCode 行。
    @discardableResult
    public mutating func undoRemoval() -> Bool {
        let currentIDs = rows.map(\.id)
        guard let restoredIDs = undoModel.undo(current: currentIDs) else { return false }

        var rowsByID = Dictionary(uniqueKeysWithValues: rows.map { ($0.id, $0) })
        for (id, row) in removedRowsByID { rowsByID[id] = row }
        let restoredRows = restoredIDs.compactMap { rowsByID[$0] }
        guard restoredRows.count == restoredIDs.count else { return false }

        rows = restoredRows
        for id in restoredIDs { removedRowsByID[id] = nil }
        return true
    }

    /// VoiceOver 单步移动或测试用多步移动；目标是最终下标，幸存行顺次让位。
    @discardableResult
    public mutating func move(rowID: String, by delta: Int) -> Bool {
        guard let source = rows.firstIndex(where: { $0.id == rowID }) else { return false }
        return move(from: source, to: source + delta)
    }

    /// 拖动落定：只改工作副本顺序，不进入撤销栈。
    @discardableResult
    public mutating func move(from source: Int, to target: Int) -> Bool {
        guard rows.indices.contains(source), rows.indices.contains(target), source != target else { return false }
        let row = rows.remove(at: source)
        rows.insert(row, at: target)
        return true
    }

    /// 恢复默认：新基线获得新 occurrence ids，并清掉旧撤销 payload/栈。
    public mutating func reset(codes: [String]) {
        self = PlanDaySequenceDraft(codes: codes)
    }

    /// 采纳 / 取消后旧还原点失效；工作副本本身保持不变。
    public mutating func clearUndo() {
        undoModel.clear()
        removedRowsByID = [:]
    }
}

/// 自由日序对 FR-TR12 的展示层兼容；不参与轮转、覆盖写入、offset 或撤销语义。
public enum DaySequencePresentationRules {
    /// 去重保序后排除当前处方日，避免重复同名候选。
    public static func daySwitchCandidates(
        sequence: [String],
        currentDayCode: String?
    ) -> [String] {
        var seen: Set<String> = []
        return sequence.filter { code in
            seen.insert(code).inserted && code != currentDayCode
        }
    }

    /// 至少有两个不同 dayCode 才有可换目标；全同序列不显示入口。
    public static func shouldShowDaySwitchEntry(sequence: [String]) -> Bool {
        Set(sequence).count > 1
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
    /// 2026-07-20 操作区批（裁定 C）：`PlanDaySequenceEditorView` 同构复用——working=日序
    /// 工作副本、defaults=defaultDaySequence、clearCustom → removeCustomDaySequence。
    public static func applyResolution(working: [String], defaults: [String], wasCustomized: Bool) -> PlanDayApplyResolution {
        guard isAtDefault(working: working, defaults: defaults) else { return .writeCustom }
        return wasCustomized ? .clearCustom : .noop
    }

    /// 无改动判定（2026-07-20 操作区批，裁定 A）：工作副本==打开时初始列表 → 「采纳修改」
    /// disabled（无改动没有「采纳」可言）。比较内容非操作历史——改了又改回去仍算无改动。
    /// 与 `isAtDefault` 基线不同：initial 是**打开面板时的有效列表**（可能已是自定义）。
    public static func hasChanges(working: [String], initial: [String]) -> Bool {
        working != initial
    }
}
