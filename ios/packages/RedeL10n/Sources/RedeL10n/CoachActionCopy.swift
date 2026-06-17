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
            return t2c("\(exerciseName) 已经练满当前变体　换个更难的版本继续往上走",
                       "\(exerciseName) has maxed this variation — a harder version keeps you moving up")
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

    private func t2c(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
