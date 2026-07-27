// FR-PL6/PL7 计划编辑器双语文案（切片 S8）。定位=「编辑教练给的计划」：用「调整/编辑」不用
// 「创建/生成」；护栏中性提示、不羞辱不施压（§5.4/§7.3）；预览→采纳→可恢复默认。

import Foundation

extension RedeStrings {
    /// 计划页训练日行的「编辑这天」入口提示（无障碍）。
    public var planEditDayHint: String { locale == .zh ? "编辑这个训练日" : "Edit this training day" }
    /// 编辑器标题。
    public var planEditTitle: String { locale == .zh ? "编辑训练日" : "Edit training day" }
    public var planEditSubtitle: String {
        locale == .zh ? "调整这天练哪些动作和顺序（长按一行拖动重排）；重量与进阶仍由系统判断"
                      : "Adjust what you train this day and the order (touch and hold a row, then drag); loads & progression stay coach-driven"
    }
    public var planEditAddExercise: String { locale == .zh ? "添加动作" : "Add exercise" }
    /// 添加选择器空态（该日同类动作都已加入）。
    public var planEditAddNoneLeft: String {
        locale == .zh ? "这天该练的同类动作都已加入" : "All matching exercises for this day are already added"
    }
    public var planEditSwap: String { locale == .zh ? "换动作" : "Swap" }
    public var planEditRemove: String { locale == .zh ? "移除" : "Remove" }
    public var planEditMoveUp: String { locale == .zh ? "上移" : "Move up" }
    public var planEditMoveDown: String { locale == .zh ? "下移" : "Move down" }
    public var planEditRestoreDefault: String { locale == .zh ? "恢复默认" : "Restore default" }
    /// 移除后撤销条正文（2026-07-20 owner 实机反馈：误删要能一键撤回）。name 为已本地化动作名；
    /// 撤销动作词复用 coachUndoLabel（与今日页撤销条同源）。
    public func planEditRemovedLine(_ name: String) -> String {
        locale == .zh ? "已移除「\(name)」" : "Removed \(name)"
    }
    /// 撤销条无障碍整读（不带书名号，VoiceOver 读得顺；动作词收尾）。
    public func planEditRemovedUndoA11y(_ name: String) -> String {
        locale == .zh ? "已移除 \(name)，撤销" : "Removed \(name), undo"
    }
    public var planEditCustomizedBadge: String { locale == .zh ? "已自定义" : "Customized" }
    public var planEditApply: String { locale == .zh ? "采纳修改" : "Apply changes" }
    public var planEditCancel: String { locale == .zh ? "取消" : "Cancel" }
    public var planEditImpactTitle: String { locale == .zh ? "改动影响" : "Impact" }
    /// 空清单诚实占位（用户把一天删空时）。
    public var planEditEmptyDay: String {
        locale == .zh ? "这天还没有动作——添加几个，或恢复默认" : "No exercises yet — add some, or restore default"
    }
    /// 跨族换确认（FR-PL6：跨族需用户确认一下）。
    public var planEditCrossFamilyConfirm: String {
        locale == .zh ? "这是跨肌群/模式的替换，会改变这天的训练侧重——确认替换？"
                      : "This swaps across muscle/movement groups and shifts this day's focus — confirm?"
    }
    /// 护栏：某肌群每周频率跌破 2×（中性提示、不阻止）。muscle 为已本地化肌群名。
    public func planEditMuscleFrequencyWarning(muscles: [String]) -> String {
        let list = muscles.joined(separator: locale == .zh ? "、" : ", ")
        return locale == .zh
            ? "提示：这么改后 \(list) 每周训练会少于 2 次（仍可采纳）"
            : "Heads up: after this, \(list) drops below 2×/week (you can still apply)"
    }
    /// 影响无虞时的中性确认。
    public var planEditImpactOk: String {
        locale == .zh ? "肌群每周频率没有明显下降" : "No notable drop in weekly muscle frequency"
    }

    // MARK: FR-PL7③ 训练日自由编排

    /// 计划页训练日编排入口。
    public var planSeqEditEntry: String { locale == .zh ? "编排训练日" : "Arrange training days" }
    /// 入口行无障碍提示（与 dayScheduleRow 的 planEditDayHint 对齐）。
    public var planSeqEditEntryHint: String {
        locale == .zh ? "更换、添加、移除或重排训练日"
                      : "Change, add, remove, or reorder training days"
    }
    /// 自由日序编辑器标题。
    public var planSeqEditTitle: String { locale == .zh ? "训练日编排" : "Training day sequence" }
    public var planSeqEditSubtitle: String {
        locale == .zh ? "换类型、添加或移除训练日；长按一行可拖动重排，轮转按已完成场次推进"
                      : "Change, add, or remove training days; touch and hold a row to reorder. Rotation advances by completed sessions"
    }
    public var planSeqChooseDay: String { locale == .zh ? "选择训练日" : "Choose a training day" }
    public var planSeqChangeDay: String { locale == .zh ? "更换训练日" : "Change training day" }
    public var planSeqAddDay: String { locale == .zh ? "添加训练日" : "Add training day" }
    public var planSeqGroupPush: String { locale == .zh ? "推" : "Push" }
    public var planSeqGroupPull: String { locale == .zh ? "拉" : "Pull" }
    public var planSeqGroupLegs: String { locale == .zh ? "腿" : "Legs" }
    public var planSeqGroupUpperLower: String { locale == .zh ? "上下肢" : "Upper / Lower" }
    public var planSeqGroupFullBody: String { locale == .zh ? "全身" : "Full body" }
    /// 护栏预览：重排后下一个训练日将变为 X（诚实告知，不阻止）。day 为已本地化训练日名。
    public func planSeqNextDay(_ day: String) -> String {
        locale == .zh ? "下一个训练日将变为：\(day)" : "Next training day will be: \(day)"
    }
}
