// RedeStrings — clean rewrite 双语文案基底(M0-3)。
//
// 中英各为母语原生稿、共享意图、不互译(docs/REDE_PRODUCT_COPY_BASELINE.md §3)。
// UI 短语不收句号;判断句/收据句保留句号。英文以 rede-app.html 原型为基准。
// 本文件只承载 app 壳的 UI 文案;动作名/数据值是静态展示数据,M2-M4 由
// catalog/engine 提供 localized 真值后逐步接管。
// Foundation-only:locale 状态由 app 层持有,这里是纯查表。

public enum RedeLocale: String, CaseIterable, Sendable {
    case zh
    case en

    /// 系统语言 → 支持的 locale;中文(简/繁/方言码)归 zh,其余默认 en。
    public static func resolve(fromLanguageCode code: String?) -> RedeLocale {
        guard let code = code?.lowercased() else { return .en }
        return code.hasPrefix("zh") ? .zh : .en
    }

    public var displayName: String {
        switch self {
        case .zh: return "中文"
        case .en: return "English"
        }
    }
}

/// 重量显示单位（M5-2 FR-SE1）。存储/引擎恒为 kg（canonical），lb 仅渲染层换算（系统逻辑 §149）。
public enum RedeUnit: String, CaseIterable, Sendable {
    case kg
    case lb

    /// 持久化值 → 单位；未知/缺失回退 kg（不猜）。
    public static func resolve(_ raw: String?) -> RedeUnit {
        raw.flatMap(RedeUnit.init(rawValue:)) ?? .kg
    }

    public var displayName: String { rawValue }
}

public struct RedeStrings: Sendable {
    public let locale: RedeLocale
    public let unit: RedeUnit

    public init(locale: RedeLocale, unit: RedeUnit = .kg) {
        self.locale = locale
        self.unit = unit
    }

    private func t(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }

    // MARK: - Tab bar

    public var tabToday: String { t("今日", "Today") }
    public var tabTrain: String { t("训练", "Train") }
    public var tabProgress: String { t("进展", "Progress") }
    public var tabPlan: String { t("计划", "Plan") }

    // MARK: - Today

    public var todayTitle: String { t("今日", "Today") }
    public var todayDateLine: String { t("周六 · 6月8日 · 第 3 周", "Sat · Jun 8 · Week 3") }
    public var todayReadyStatus: String { t("可以训练", "Ready to train") }
    public var todayVerdict: String { t("今天可以练。推力 A 保留，推举量封顶。", "Train today. Push A stays, pressing volume capped.") }
    public var todayStartHere: String { t("从这里开始", "Start here") }
    public var todayLoadDetail: String { t("lb · ×5 · RIR 2", "lb · ×5 · RIR 2") }
    public var todayThenIncline: String { t("接 上斜哑铃推", "then Incline DB") }
    public var todayThenCable: String { t("接 绳索夹胸", "then Cable fly") }
    public var startTraining: String { t("开始训练", "Start training") }
    public var todayReceiptTitle: String { t("Rede 训练收据", "Rede training receipt") }
    public var todayReceiptTag: String { t("今天", "Today") }
    public var todayReceiptLine: String { t("本周推举量已封顶。", "Pressing volume is capped this week.") }
    public var todayWhyThisCall: String { t("查看依据", "Why this call") }
    public var todayHideReason: String { t("收起依据", "Hide reason") }
    public var receiptSignal: String { t("信号", "Signal") }
    public var receiptChange: String { t("调整", "Change") }
    public var receiptControl: String { t("控制", "Control") }
    public var todaySignalLine: String { t("上次肩推偏沉 · 睡眠 6.2h", "Last overhead felt heavy · sleep 6.2h") }
    public var todayChangeLine: String { t("肩推 95→85 lb · 卧推保持", "Overhead 95→85 lb · bench holds") }
    public var controlApply: String { t("采纳", "Apply") }
    public var controlHold: String { t("保持", "Hold") }
    public var controlSwap: String { t("换动作", "Swap") }
    public var todayRailTitle: String { t("卧推 · 从上次到下次", "Bench · last to next") }
    public var railLastDate: String { t("6月5日", "Jun 5") }
    public var railToday: String { t("今天", "Today") }
    public var railNext: String { t("下次", "Next") }

    // MARK: - Train

    public var trainDayTitle: String { t("推力 A", "Push A") }
    public var trainProgressLine: String { t("动作 1/6 · 第 3/4 组", "Exercise 1 of 6 · Set 3 of 4") }
    public var trainFinish: String { t("完成", "Finish") }
    public var trainWhyLine: String { t("第 2 组偏慢，从 185 回调", "Eased from 185 after a slow set 2") }
    public var trainHold185: String { t("保持 185", "Hold 185") }
    public var trainLogSet: String { t("完成本组", "Log set") }
    public var trainColSet: String { t("组", "Set") }
    public var trainColWeight: String { t("重量", "Weight") }
    public var trainColReps: String { t("次数", "Reps") }
    public var trainColRir: String { t("RIR", "RIR") }
    public var trainNextUp: String { t("下一个 · 上斜哑铃推 · 3 × 8", "Next · Incline DB press · 3 × 8") }

    // MARK: - Progress

    public var progressTitle: String { t("进展", "Progress") }
    public var scaleSession: String { t("单次", "Session") }
    public var scaleWeek: String { t("本周", "Week") }
    public var scaleCycle: String { t("周期", "Cycle") }

    public var sessionChartTitle: String { t("单次 · 按动作", "Session · by lift") }

    // MARK: - Plan

    public var planTitle: String { t("计划", "Plan") }
    public var planPhaseLine: String { t("增肌期 · 第 3/5 周", "Hypertrophy · Week 3 of 5") }
    public var planMonDone: String { t("周一 · 已完成", "Mon · done") }
    public var planWedDone: String { t("周三 · 已完成", "Wed · done") }
    public var planFriToday: String { t("周五 · 今天", "Fri · today") }
    public var planSunNext: String { t("周日 · 下次", "Sun · next") }
    public var planPushA: String { t("推力 A", "Push A") }
    public var planPullA: String { t("拉力 A", "Pull A") }
    public var planPushB: String { t("推力 B", "Push B") }
    public var planLegs: String { t("腿", "Legs") }
    public var planPushAMeta: String { t("14.2k lb · 1 个 PR", "14.2k lb · 1 PR") }
    public var planPullAMeta: String { t("11.8k lb", "11.8k lb") }
    public var planTodayMeta: String { t("肩推回调 · 6 个动作 · 下个卧推 185", "Overhead eased · 6 lifts · Bench 185 next") }
    public var planLegsMeta: String { t("深蹲 · 罗马尼亚硬拉 · 提踵 · 5 个动作", "Squat · RDL · Calf · 5 lifts") }
    public var planControlsTitle: String { t("你的控制", "Your controls") }
    public var planHoldTitle: String { t("锁住计划", "Hold the plan") }
    public var planHoldSub: String { t("本周停止自动调整", "Stop auto-adjusting this week") }
    public var planLockTitle: String { t("锁定卧推每周 +5", "Lock bench +5/week") }
    public var planLockSub: String { t("让一个动作按固定爬坡走", "Drive one lift on a fixed climb") }

    // MARK: - Settings(M5-2 完整接管：单位/语言/背景/数据/免责/反馈)

    public var settingsTitle: String { t("设置", "Settings") }
    public var settingsLanguage: String { t("语言", "Language") }
    public var settingsDone: String { t("完成", "Done") }
    public var settingsUnit: String { t("单位", "Units") }
    public var settingsBackground: String { t("训练背景", "Training background") }
    public var settingsEditAnswers: String { t("修改回答", "Edit answers") }
    /// 每周天数行值："每周 4 天" / "4 days a week"。
    public func settingsDaysValue(_ days: Int) -> String {
        t("每周 \(days) 天", "\(days) days a week")
    }
    public var settingsData: String { t("数据", "Data") }
    /// FR-SE6 导出占位：数据在本机的事实陈述，不许诺时间表措辞外的能力。
    public var settingsExportNote: String {
        t("所有训练记录都保存在这台设备本地。一键导出在后续版本提供。",
          "All training records live on this device. One-tap export ships in a later version.")
    }
    public var settingsAbout: String { t("关于", "About") }
    /// FR-SE4 健康免责（fitness 非 medical 口径，沿文案基线 §7.1）。
    public var settingsDisclaimer: String {
        t("Rede 提供健身训练参考，不构成医疗建议。如有伤病或健康疑虑，训练前请咨询专业人士。",
          "Rede offers fitness guidance, not medical advice. If you have injuries or health concerns, talk to a professional before training.")
    }
    public var settingsFeedback: String { t("发送反馈", "Send feedback") }

    // MARK: - 展示数据(静态;M2-M4 由 catalog/engine localized 值接管)

    public var exerciseBenchPress: String { t("卧推", "Bench press") }
}
