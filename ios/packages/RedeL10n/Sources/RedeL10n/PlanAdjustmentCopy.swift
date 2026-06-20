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
    /// 诚实红线：不写"你每周练了几次"这类观测断言——引擎只给目标值 to（= max(下限,中位数)），
    /// to 不等于真实观测频率（被下限托高时会虚报），故只说"持续低于计划"，不报具体观测数。
    public func planAdjustReduceBody(from: Int, to: Int) -> String {
        t2p("最近几周你的训练频率持续低于每周 \(from) 次的计划。把目标调到每周 \(to) 次会更贴合你现在的节奏——随时可以改回来。",
            "Your recent training has stayed below your \(from)-day plan for a few weeks. Setting the target to \(to) days a week fits your current rhythm better — you can switch back anytime.")
    }

    /// 频率对比行（紧凑 before→after）。
    public func planAdjustFromTo(from: Int, to: Int) -> String {
        t2p("每周 \(from) 次 → 每周 \(to) 次", "\(from) days/wk → \(to) days/wk")
    }

    /// 调整后本周训练日小标（其后接训练日名列表，答「影响哪几天」）。
    public var planAdjustAfterLabel: String { t2p("调整后本周", "After · this week") }

    /// 采纳主 CTA（动词引导）。
    public var planAdjustAdopt: String { t2p("调整计划", "Adjust plan") }

    /// 暂不（中性，不催促、不羞辱）。
    public var planAdjustDismiss: String { t2p("暂不", "Not now") }

    // MARK: - 已采纳态（可撤）

    /// 已采纳区小标。
    public var planAdjustActiveOverline: String { t2p("已调整计划", "Plan adjusted") }

    /// 已采纳态正文（现状 + 可逆）。
    public func planAdjustActiveBody(to: Int) -> String {
        t2p("现在每周目标 \(to) 次。", "Your target is now \(to) days a week.")
    }

    /// 改回原计划 CTA（单步即时回滚）。
    public var planAdjustUndo: String { t2p("改回原计划", "Restore plan") }

    private func t2p(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
