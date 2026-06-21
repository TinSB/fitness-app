// CoachActionCopy — FR-T5 教练动作文案（切片6b，系统逻辑 §6.4/§6.5.10）。
//
// 引擎零文案（§6.0/§6.0.1）：CoachActionEngine 只产 kind + reasonCode + 数值，这里按
// reasonCode 渲染成「信号 + 影响 + 决策」双语句（文案基线 §4.2）。与裁决文案同口径——
// 调用方传已解析的动作名/数值，本包不查目录、不算阈值。
//
// 红线（系统逻辑 §6.5.2 / §4.2）：
//  - 不羞辱：补量只说「还差几次 / 有空补一次」，绝不「你落后了 / 练太少」。
//  - 禁词：算法名 / 「AI 判断」/ 「系统认为」/ 「最佳」一律不出现。
//  - 补量是频率维度——禁出现具体肌群名或组数，count 只表「本周还差几次训练」。

import Foundation

extension RedeStrings {
    /// 教练卡标题（reasonCode → 一句短结论）。reasonCode 由 CoachActionEngine 产出：
    /// dataHasFindings / ceilingReached / belowWeeklyPlan。
    public func coachCardTitle(reasonCode: String, exerciseName: String = "") -> String {
        switch reasonCode {
        case "dataHasFindings":
            return t2c("有记录待核对", "Entries to review")
        case "ceilingReached":
            return t2c("\(exerciseName) 到顶了", "\(exerciseName) hit its ceiling")
        case "belowWeeklyPlan":
            return t2c("本周还能再练", "Room for more this week")
        default:
            return ""
        }
    }

    /// 教练卡正文（信号 + 影响 + 决策）。count 语义随 reasonCode：dataHasFindings = 可疑条数；
    /// belowWeeklyPlan = 本周还差几次；ceilingReached 不用 count（看动作名）。
    public func coachCardBody(reasonCode: String, exerciseName: String = "", count: Int? = nil) -> String {
        switch reasonCode {
        case "dataHasFindings":
            let n = count ?? 0
            return t2c("近期有 \(n) 条记录看起来不对劲　去进展页核对一下",
                       "\(n) recent entries look off — review them on Progress")
        case "ceilingReached":
            // 标题已点名该动作（「{name} 到顶了」），正文不再重复主语，避免卡上下相邻读两遍（审查 NIT）。
            return t2c("当前变体已经练满　换个更难的版本继续往上走",
                       "This variation is maxed out — a harder version keeps you moving up")
        case "belowWeeklyPlan":
            let n = count ?? 0
            return t2c("本周还差 \(n) 次就到计划　有空补一次就好",
                       "\(n) short of your weekly plan — fit one in if you can")
        default:
            return ""
        }
    }

    /// 「暂不处理」按钮文案（降频入口；中性，不催促、不羞辱）。
    public var coachDismissLabel: String { t2c("暂不处理", "Not now") }

    // MARK: - 采纳 / 撤销（切片6c）

    /// 换动作采纳主 CTA（动词引导：打开替代列表让用户选）。
    public var coachAdoptSwapLabel: String { t2c("换个动作", "Swap exercise") }

    /// 补量采纳主 CTA。**诚实红线**：只表"收到、本周别再催"，绝不含"加训练/已安排/补一次"——
    /// applyVolumeBoost 真实语义仅记录本周已承认、让引擎抑制补量卡，不加训练、不改处方。
    public var coachAdoptVolumeLabel: String { t2c("知道了", "Got it") }

    /// 修数据采纳主 CTA（动词引导：跳进展页数据质量区核对，非状态变更）。
    public var coachAdoptReviewLabel: String { t2c("去核对", "Review") }

    /// 换动作选择器顶部提示（detail sheet 进入换动作意图时）。
    public var swapPickerHint: String { t2c("选一个替代当前动作", "Pick a replacement") }

    /// 处方行「已换」微标（该动作是某到顶动作的替代）。
    public var exerciseSwappedBadge: String { t2c("已换", "Swapped") }

    /// 通用「撤销」按钮（换动作微标 / 撤销条共用）。
    public var coachUndoLabel: String { t2c("撤销", "Undo") }

    /// detail sheet 撤销入口：当前动作替代了哪个原动作。
    public func swapRevertHint(originalName: String) -> String {
        t2c("替代了 \(originalName)　可换回", "Replaced \(originalName) · restore")
    }

    /// 换动作采纳后撤销条正文。
    public func swapAdoptedToast(exerciseName: String) -> String {
        t2c("已换成 \(exerciseName)", "Swapped to \(exerciseName)")
    }

    /// 补量采纳后撤销条正文。**诚实红线**：只说"本周不再提醒"，不暗示已加训练/已补量。
    public var volumeAckToast: String { t2c("本周不再提醒补量", "No more nudges this week") }

    private func t2c(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
