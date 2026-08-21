// PaidCoachCopy — Rede Coach 付费层文案（FR-SUB1 修订，2026-08-18）。
//
// 边界定稿：免费 = 今天该不该练、练什么、每一组多重 + 记录 + 数据 + 手表；
// 付费 = 跨会话的判断（计划调整、自动均衡、周期化、优化建议、深度分析、每周复盘）。
//
// 两条文案纪律：
// · **免费态不泄露付费结论**（沿用 FR-SUB3）：预告行只说「有一条建议」，绝不说改什么、改多少。
// · 能力清单只讲已交付事实，不写形容词、不承诺未来（文案基线 §3.4/§5.5）。
extension RedeStrings {

    // MARK: - 卖点与能力清单（只在购买面可呈现时渲染；gate 未开时 Coach 页仍是诚实空壳）

    /// Coach 页购买面主句：一句话说清付费买的是什么。
    public var paidCoachPitch: String {
        t2p("Rede Coach 随你每一周的表现改计划　该加就加、该减就减、哪块弱就补哪块",
            "Rede Coach rewrites your plan from how your weeks actually go: heavier when you earn it, lighter when you need it, more volume where you're behind")
    }

    public var paidCoachIncludedOverline: String { t2p("包含", "Included") }

    /// 能力清单一行的标题。code 与 app 层 PaidCoachCapability.rawValue 一一对应；
    /// 未知 code 回退空串（调用方跳过该行，不显示原始码）。
    public func paidCoachCapabilityTitle(_ code: String) -> String {
        switch code {
        case "planAdjustment":
            return t2p("计划调整建议", "Plan adjustments")
        case "autoBalance":
            return t2p("弱肌群自动补量", "Automatic balance work")
        case "periodization":
            return t2p("计划周期化", "Planned periodization")
        case "coachOptimization":
            return t2p("动作与训练量优化建议", "Exercise and volume suggestions")
        case "muscleDrilldown":
            return t2p("子肌群与相对力量", "Sub-muscle and relative strength")
        case "estimatedMilestone":
            return t2p("估算里程碑", "Estimated milestones")
        case "weeklyReview":
            return t2p("每周教练复盘", "Weekly coach review")
        default:
            return ""
        }
    }

    /// 能力清单一行的说明（一句事实，不夸张）。
    public func paidCoachCapabilityNote(_ code: String) -> String {
        switch code {
        case "planAdjustment":
            return t2p("实际训练频率和计划对不上时，提出改几天、影响哪几天，采纳后可撤",
                       "When your real frequency drifts from the plan, Rede proposes a new one, shows which days change, and lets you undo it")
        case "autoBalance":
            return t2p("落后的肌群每场自动多加一组，不打断训练日结构",
                       "Lagging muscles get an extra set per session without reshaping your training day")
        case "periodization":
            return t2p("按 4 周块自动安排过载周与减载周，计划页显示当前周期",
                       "Runs a four-week block with built-in overload and deload weeks, shown on Plan")
        case "coachOptimization":
            return t2p("某个动作练到顶时提出更难的变体；本周练得比计划少时提出补一次",
                       "Suggests a harder variation when a lift tops out, and a make-up session when the week runs short")
        case "muscleDrilldown":
            return t2p("每块肌群的子部位等级、依据与趋势，以及按体重性别的相对力量档位",
                       "Sub-muscle levels with their evidence and trend, plus relative-strength tiers for your bodyweight and sex")
        case "estimatedMilestone":
            return t2p("按 e1RM 估算即将到手的力量里程碑，实测里程碑始终免费",
                       "Milestones you're projected to hit by estimated 1RM. Measured milestones are always free")
        case "weeklyReview":
            return t2p("每个新训练周开始时，上一整周最值得关注的一件事和它的依据",
                       "At the start of each training week, the one thing that mattered most last week and the facts behind it")
        default:
            return ""
        }
    }

    /// 购买面页脚：说清什么永远免费。写在付费页上，是为了让人放心而不是催促。
    public var paidCoachAlwaysFree: String {
        t2p("训练、记录、今日判断、进展、导出与手表永远免费",
            "Training, logging, today's call, progress, export and the watch app are always free")
    }

    // MARK: - 免费态预告（只有两处常驻；不弹窗、不泄露结论）

    /// 计划页：有一条被门挡住的调整建议。**只说有，不说是什么**。
    public var paidCoachPlanTeaser: String {
        t2p("有一条计划调整建议", "A plan adjustment is waiting")
    }

    /// 进展页子肌群行与设置页周期化行共用的尾标。
    public var paidCoachTag: String { "Rede Coach" }

    private func t2p(_ zh: String, _ en: String) -> String { locale == .zh ? zh : en }
}
