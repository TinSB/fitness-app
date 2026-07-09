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

    // MARK: FR-TR6「只换这次」临时换动作

    /// 处方行「今天换」微标（该动作是今天的临时替代；次日自动恢复）。
    public var exerciseSwappedOnceBadge: String { t2c("今天换", "Today") }
    /// 点替代项后的二选一对话框标题。
    public var swapScopeTitle: String { t2c("换这个动作", "Swap this exercise") }
    /// 二选一对话框正文：换成 X，问范围。
    public func swapScopeMessage(exerciseName: String) -> String {
        t2c("换成 \(exerciseName)——只换今天这次，还是以后都换？",
            "Swap to \(exerciseName) — just for today, or always?")
    }
    /// 选项：只换这次（今天有效，明天自动恢复原动作）。
    public var swapScopeOnce: String { t2c("只换这次（今天）", "Just this time (today)") }
    /// 选项：以后都换（永久替代，直到手动换回）。
    public var swapScopeAlways: String { t2c("以后都换", "Swap from now on") }
    /// 「只换这次」采纳后撤销条正文（诚实标明次日自动恢复）。
    public func swapOnceAdoptedToast(exerciseName: String) -> String {
        t2c("今天临时换成 \(exerciseName)（明天自动恢复）", "Swapped to \(exerciseName) for today")
    }
    /// detail sheet 撤销入口：当前动作是今天临时替代了哪个原动作。
    public func swapOnceRevertHint(originalName: String) -> String {
        t2c("今天临时替代了 \(originalName)　可换回（明天也会自动恢复）",
            "Replaced \(originalName) for today · restore")
    }
    /// 通用「取消」按钮（对话框等共用）。
    public var commonCancel: String { t2c("取消", "Cancel") }

    // MARK: FR-TR7「今天换一天练」临时训练日覆盖

    /// 今日页入口：临时换今天练哪个训练日。
    public var swapDayEntry: String { t2c("今天换一天练", "Switch today's session") }
    /// 选训练日对话框标题。
    public var swapDayPickerTitle: String { t2c("今天换练哪天？", "Switch today's session?") }
    /// 选了某天后的二选一：只换今天（被跳过的 displaced 日顺延到下次）。day/displaced 为已本地化训练日名。
    public func swapDayScopeOnce(displaced: String) -> String {
        t2c("只换今天 · \(displaced)顺延到下次", "Just today · \(displaced) moves to next session")
    }
    /// weekly 模式版「只换今天」：不承诺顺延补回（该模式换天不产生补偿——审查 S1 诚实红线）。
    public var swapDayScopeOnceWeekly: String { t2c("只换今天", "Just today") }
    /// weekly 模式版撤销条：不承诺明天补回。
    public func swapDayAdoptedToastWeekly(chosen: String) -> String {
        t2c("已临时换为\(chosen)", "Switched to \(chosen) today")
    }

    /// 选了某天后的二选一：以后都按这个顺序（打开顺序编辑器永久重排）。
    public var swapDayScopeAlways: String { t2c("以后都按这个顺序", "Change my rotation order") }
    /// 临时换天后撤销条正文（明示明天补回被跳过的那天）。chosen/displaced 为已本地化训练日名。
    public func swapDayAdoptedToast(chosen: String, displaced: String) -> String {
        t2c("已临时换为\(chosen) · 明天补回\(displaced)", "Switched to \(chosen) today · \(displaced) next time")
    }
    /// 今日页头标：今天临时换成了某训练日（提示次日恢复）。day 为已本地化训练日名。
    public func dayOverrideHeader(day: String) -> String {
        t2c("今天临时换为：\(day)", "Today (swapped): \(day)")
    }

    /// 补量采纳后撤销条正文。**诚实红线**：只说"本周不再提醒"，不暗示已加训练/已补量。
    public var volumeAckToast: String { t2c("本周不再提醒补量", "No more nudges this week") }

    private func t2c(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
