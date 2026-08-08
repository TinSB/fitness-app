// PlanAdjustmentCopy — FR-PL3/4 计划调整文案（双语）。
//
// 引擎零文案（PlanAdjustmentEngine 只产 kind/reasonCode/数值）；这里渲染「建议 + 影响 + 可逆」。
// §7.3 红线：中性、不羞辱、不催促、不绝对承诺；落后不说「你练太少 / 偷懒」，只说「贴合你现在的节奏」，
// 并始终点明「随时可改回」（采纳无心理负担）。频率维度——不出现肌群名 / 组数。

import Foundation

extension RedeStrings {
    /// 提案区小标。
    public var planAdjustOverline: String { t2p("计划调整建议", "A suggested tweak") }

    /// 降频提案正文（信号 + 影响 + 可逆）。reasonCode = belowPlanSustained。
    /// 诚实红线：目标值 to 经过下限钳制（= max(下限,中位数)），不等于真实观测频率（被托高时会虚报），
    /// 故本句只说"持续低于计划"，不把 to 当观测数报；引擎另给的未钳制观测值只用于增频正文的事实陈述。
    public func planAdjustReduceBody(from: Int, to: Int) -> String {
        t2p("最近几周你的训练频率持续低于每周 \(from) 天的计划　把目标调到每周 \(to) 天会更贴合你现在的节奏　随时可以改回来",
            "Your recent training has stayed below your \(from)-day plan for a few weeks. Setting the target to \(to) days a week fits your current rhythm better. You can switch back anytime")
    }

    /// 增频提案正文（最近 4 个完整 ISO 周的训练天数中位数 + 当前计划 + 中性动作）。
    /// `observed` 是未钳制的真实中位数；`to` 可因 2...6 上限而与 observed 不同。
    public func planAdjustIncreaseBody(observed: Int, from: Int, to: Int) -> String {
        t2p("最近四周你每周练 \(observed) 天　计划是 \(from) 天　把计划调到 \(to) 天",
            "Over the last four weeks, you trained \(observed) days a week. Your plan is \(from) days. Adjust the plan to \(to) days")
    }

    /// 频率对比行（紧凑 before→after）。
    public func planAdjustFromTo(from: Int, to: Int) -> String {
        t2p("每周 \(from) 天 → 每周 \(to) 天", "\(from) days/wk → \(to) days/wk")
    }

    /// 调整后训练日小标（其后接训练日名列表，答「影响哪几天」）。
    /// 同 Task 4 口径：列表是调整后的下一块训练日预览（PlanWeekProjection 投影、
    /// 非日历周；频率不整除轮转序列时构成随游标滚动，故不说「每周」）。
    public var planAdjustAfterLabel: String { t2p("调整后", "After the change") }

    /// 采纳主 CTA（动词引导）。
    public var planAdjustAdopt: String { t2p("调整计划", "Adjust plan") }

    /// 暂不（中性，不催促、不羞辱）。
    public var planAdjustDismiss: String { t2p("暂不", "Not now") }

    // MARK: - 已采纳态（可撤）

    /// 已采纳区小标。
    public var planAdjustActiveOverline: String { t2p("已调整计划", "Plan adjusted") }

    /// 已采纳态正文（现状 + 可逆）。
    public func planAdjustActiveBody(to: Int) -> String {
        t2p("现在每周目标 \(to) 天", "Your target is now \(to) days a week")
    }

    /// 改回原计划 CTA（单步即时回滚）。
    public var planAdjustUndo: String { t2p("改回原计划", "Restore plan") }

    private func t2p(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
