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
    public var todayVerdict: String { t("今天可以练　推力 A 保留，推举量封顶", "Train today. Push A stays, pressing volume capped") }
    public var todayStartHere: String { t("从这里开始", "Start here") }
    public var todayLoadDetail: String { t("lb · ×5 · RIR 2", "lb · ×5 · RIR 2") }
    public var todayThenIncline: String { t("接 上斜哑铃推", "then Incline DB") }
    public var todayThenCable: String { t("接 绳索夹胸", "then Cable fly") }
    public var startTraining: String { t("开始训练", "Start training") }
    public var todayReceiptTitle: String { t("Rede 训练收据", "Rede training receipt") }
    public var todayReceiptTag: String { t("今天", "Today") }
    public var todayReceiptLine: String { t("本周推举量已封顶", "Pressing volume is capped this week") }
    public var todayWhyThisCall: String { t("查看依据", "Why this call") }
    public var todayHideReason: String { t("收起依据", "Hide reason") }
    public var receiptChange: String { t("调整", "Change") }
    public var todaySignalLine: String { t("上次肩推偏沉 · 睡眠 6.2h", "Last overhead felt heavy · sleep 6.2h") }
    public var todayChangeLine: String { t("肩推 95→85 lb · 卧推保持", "Overhead 95→85 lb · bench holds") }
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
    /// 辅助器械（wave-9）：组表「重量」列对辅助动作读「辅助」。
    public var trainColAssist: String { t("辅助", "Assist") }
    /// 负重自重（wave-11）：组表「重量」列对负重动作读「负重」（外挂负重）。
    public var trainColWeighted: String { t("负重", "Load") }
    public var trainColReps: String { t("次数", "Reps") }
    public var trainColRir: String { t("RIR", "RIR") }
    public var trainNextUp: String { t("下一个 · 上斜哑铃推 · 3 × 8", "Next · Incline DB press · 3 × 8") }

    // MARK: - Progress

    public var progressTitle: String { t("进展", "Progress") }
    public var scaleSession: String { t("单次", "Session") }
    public var scaleWeek: String { t("本周", "Week") }
    public var scaleCycle: String { t("周期", "Cycle") }

    public var sessionChartTitle: String { t("单次 · 按动作", "Session · by lift") }

    // MARK: - Plan（FR-PL1 MVP 诚实占位：无任何假数据；完整计划视图 FR-PL2~5 = FF）
    // M0-2 静态稿的假时间线/假开关文案已删（用户真机反馈 2026-06-10：假开关不持久化——
    // 正解是按 FR-PL1 不展示未实现的控件，而非给假开关做持久化）。

    public var planTitle: String { t("计划", "Plan") }
    /// 模板事实行（来自引导，真数据）："上下分化 · 每周 4 天"。
    public func planTemplateLine(splitName: String, days: Int) -> String {
        t("\(splitName) · 每周 \(days) 天", "\(splitName) · \(days) days a week")
    }
    // M2（2026-07-06）：腐烂承诺清除——FR-PL2/3/4 全部已上线，「还在路上/后续版本」
    // 对 1.0 用户是假话。本兜底态仅无模板（引导前/数据不可读）可达，措辞改为如实预告。
    public var planEmptyHeadline: String {
        t("还没有训练计划", "No plan yet")
    }
    public var planEmptyNote: String {
        t("排期与调整建议会出现在这里　先从今日页开始",
          "Your schedule and adjustments will land here. Start from Today")
    }

    // MARK: - Plan 周期条（FR-PL2 S5：仅周期化开启且有真历史时显示；按引擎相位 rawValue 取标签）
    public var planCycleOverline: String { t("当前周期", "Current cycle") }
    /// 周序 caption（无相位，相位已在节点下逐个标，摘要不重复）："第 3 / 4 周"。
    public func planCycleWeek(week: Int, total: Int) -> String {
        t("第 \(week) / \(total) 周", "Week \(week) of \(total)")
    }
    /// 周期相位短标签（节点下方；按 MesocyclePhase.rawValue 映射）。未知 → 原值兜底。
    public func mesoPhaseShort(_ raw: String) -> String {
        switch raw {
        case "calibrate": return t("校准", "Calibrate")
        case "build":     return t("构建", "Build")
        case "overreach": return t("过载", "Overload")
        case "deload":    return t("减载", "Deload")
        default:          return raw
        }
    }

    // MARK: - Plan 周排期（FR-PL2：训练日 + 模式构成，只读派生投影）
    // 标签语义（Task 4 2026-07-04）：PlanWeekProjection 从下一场起按每周场数分块，
    // 不是日历周——标签用顺序词，不用「本周/下周」字面（周中已练满会误读）。
    public var planScheduleThisWeek: String { t("接下来", "Coming up") }
    public var planScheduleNextWeek: String { t("再往后", "After that") }
    /// 排期折叠（T2 2026-07-05）：训练日类型区区头——每类构成只展开一次，先后顺序看序列行。
    public var planDayTypesHeader: String { t("训练日构成", "Day types") }
    /// 单训练日动作数："6 个动作" / "6 exercises"。
    public func planDayExercises(_ count: Int) -> String {
        t("\(count) 个动作", count == 1 ? "1 exercise" : "\(count) exercises")
    }
    /// K5 计划页「上次」列："上次 · 7月12日"（从未练过的日不显示——不编数据）。
    public func planDayLastTrained(dateText: String) -> String {
        t("上次 · \(dateText)", "Last · \(dateText)")
    }
    /// K5 计划页累计事实行："已练 5 周 · 14 天"（天=去重训练日，单位=天——裁定 3；
    /// 周=自首场日期起的 ISO 周跨度，含当前周）。
    public func planTenureLine(weeks: Int, days: Int) -> String {
        if locale == .zh { return "已练 \(weeks) 周 · \(days) 天" }
        let w = weeks == 1 ? "1 week" : "\(weeks) weeks"
        let d = days == 1 ? "1 day" : "\(days) days"
        return "\(w) in · \(d) trained"
    }
    /// 周排期下方尾注：排期已按训练进度滚动展示，仅剩调整/回滚待后续（FR-PL3/4）。
    public var planScheduleNote: String {
        // FR-PL3/4 调整建议/回滚已上线（#576–583）——去掉"将在后续版本加入"的腐烂承诺。
        t("未来安排按你的训练进度滚动",
          "The schedule rolls forward with your training")
    }
    /// 计划页「回今日」文字链（有真排期时；大主按钮只留空态承接）。
    public var planBackToToday: String { t("回今日", "Back to today") }

    // MARK: - 无障碍（VoiceOver hint/label）
    public var a11yExpand: String { t("展开", "Expand") }
    public var a11yCollapse: String { t("收起", "Collapse") }

    // MARK: - Settings(M5-2 完整接管：单位/语言/背景/数据/免责/反馈)

    public var settingsTitle: String { t("设置", "Settings") }
    public var settingsLanguage: String { t("语言", "Language") }
    public var settingsDone: String { t("完成", "Done") }
    public var settingsUnit: String { t("单位", "Units") }
    public var settingsBackground: String { t("训练背景", "Training background") }
    /// 每周天数行值："每周 4 天" / "4 days a week"。
    public func settingsDaysValue(_ days: Int) -> String {
        t("每周 \(days) 天", "\(days) days a week")
    }
    // 训练周期开关（FR-PL2 enablement）：诚实说明开/关各自行为，默认关 = opt-in。
    public var settingsPeriodizationOverline: String { t("训练周期", "Training cycle") }
    public var settingsPeriodizationLabel: String { t("计划周期化", "Planned periodization") }
    // 每周循环模式（2026-07-08）：两种真实心智——序列型（顺延，默认）vs 日历型（每周重开）。
    public var settingsWeeklyRestartLabel: String { t("每周重新开始循环", "Restart cycle each week") }
    public var settingsWeeklyRestartNote: String {
        t("开启后每到新的一周，训练循环从分化第一天重新开始　关闭则顺延，漏掉的训练日下次补上",
          "On: each new week starts the split from day one. Off: the cycle carries over and missed days come up next")
    }

    public var settingsPeriodizationNote: String {
        t("开启后按 4 周块自动安排过载与减载，计划页显示当前周期；关闭则只按你的身体反应逐次调整。安全规则（高量自动减载）始终生效。",
          "When on, training runs a 4-week block with built-in overload and deload weeks, and Plan shows your current cycle. When off, each session is tuned only to how you've been responding. The safety rule (auto-deload after heavy load) is always on.")
    }
    public var settingsData: String { t("数据", "Data") }
    /// FR-SE6 数据事实陈述（K7 2026-07-16 导出兑现后同步去掉「后续版本加入」的时间表措辞）。
    public var settingsExportNote: String {
        t("所有训练记录都保存在这台设备本地　可随时导出完整数据带走",
          "All training records live on this device. Export the full data file anytime")
    }
    /// FR-SE6 导出行（K7）：canonical 原样 JSON → 系统分享面板。
    public var settingsExportAction: String { t("导出训练数据", "Export training data") }
    /// 导出读失败 alert（沿 dataUnreadable 文案家族：如实说读不出，绝不产出空文件假成功）。
    public var settingsExportFailedTitle: String { t("暂时读不出数据", "Can't read your data right now") }
    public var settingsExportFailedBody: String {
        t("训练数据文件此刻读取失败　稍后再试一次", "The training data file couldn't be read. Try again in a bit")
    }
    public var settingsExportFailedConfirm: String { t("好", "OK") }
    /// 设置面板铭牌头型号行（工艺重做 2026-06-10，Overline 渲染为全大写）。
    public var settingsPanelOverline: String { t("Rede · 调校", "Rede · Tuning") }
    public var settingsPrivacy: String { t("隐私", "Privacy") }
    /// M6-2 隐私说明（FR-DT4 诚实表达 + 文案基线 §7.4）：只说代码可证的事实——
    /// 「默认保存在本机」；禁绝对化（永不/100%/anonymous）。Apple 健康未上线不提。
    public var settingsPrivacyNote: String {
        t("训练记录默认保存在这台设备本机　Rede 不连网、没有账号，也没有第三方统计组件　删除 App 会同时删除本机数据",
          "Training records live on this device by default. Rede has no network connection, no account, and no third-party analytics. Deleting the app also deletes its local data")
    }
    public var settingsAbout: String { t("关于", "About") }
    /// FR-SE4 健康免责（fitness 非 medical 口径，沿文案基线 §7.1）。
    public var settingsDisclaimer: String {
        t("Rede 提供健身训练参考，不构成医疗建议　如有伤病或健康疑虑，训练前请咨询专业人士",
          "Rede offers fitness guidance, not medical advice. If you have injuries or health concerns, talk to a professional before training")
    }
    public var settingsFeedback: String { t("发送反馈", "Send feedback") }
    /// M6-3 正式反馈渠道（owner 确认 2026-06-10）。邮件主题带版本号便于分流。
    public func feedbackSubject(version: String) -> String {
        t("Rede 反馈（v\(version)）", "Rede feedback (v\(version))")
    }
    /// 邮件正文引导句；上下文行（版本/系统/机型/语言/单位）由 app 层拼接，
    /// 用户发送前可见可删——透明，不偷带。
    public var feedbackBodyPrompt: String {
        t("（写下你的反馈　哪里不对、想要什么）", "(What's off, what you wish it did)")
    }
    /// mailto 打不开（设备没配邮件 app）时的兜底：如实给地址让用户自行发送。
    public func feedbackFallback(address: String) -> String {
        t("这台设备没有配置邮件 App　可手动发邮件到 \(address)", "No mail app is set up on this device. You can email \(address) directly")
    }

    // MARK: - 展示数据(静态;M2-M4 由 catalog/engine localized 值接管)

    public var exerciseBenchPress: String { t("卧推", "Bench press") }
}
