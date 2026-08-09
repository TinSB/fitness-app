// RedeStrings — clean rewrite 双语文案基底(M0-3)。
//
// 中英各为母语原生稿、共享意图、不互译(docs/REDE_PRODUCT_COPY_BASELINE.md §3)。
//
// 标点铁律(§3.4，2026-06-15 扩展到全语态；2026-08-08 清除全部例外)：
//   · 中文**一律不收句号**——不分 UI 短语/判断句/收据句/免责/隐私/通知/卡面标题。
//     原来用句号断开的两拍改用**全角空格**留白；问号感叹号不在此限。
//   · 禁 `——` 与 em-dash 挂解释性补语；英文行尾不收句点，句间可留单个句点。
//   · 禁用词：您 / 为您 / 即可 / 贴心 / 全方位 / 开启旅程 / 释放潜能 / 打造专属。
// 本文件头一度写着「判断句/收据句保留句号」——那是 2026-06-15 之前的旧规，
// 与文档铁律并存多时，是后续违规照抄的源头，已废止。
// 违规由 quality-gate.cmd 的 copy-voice 守卫拦下，不再靠人工翻。
//
// 英文以 rede-app.html 原型为基准。
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
    /// 累计事实的**列标签**（2026-08-06 排版基准 S5）。原 planTenureLine 保留给无障碍。
    public var planTenureColWeeks: String { locale == .zh ? "已练" : "weeks in" }
    public var planTenureColDays: String { locale == .zh ? "训练天数" : "days trained" }
    public var planTenureUnitWeek: String { locale == .zh ? "周" : "" }
    public var planTenureUnitDay: String { locale == .zh ? "天" : "" }

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
    /// 分组头（2026-08-09 IA 重排）：单位/语言只改数字与文字怎么写，不改任何行为，
    /// 所以从原来的第一位降到「显示」组。分组名与同层的 训练背景/训练周期/通知/数据/方案/关于
    /// 一样是朴素名词——不用「你的显示」这类第二人称，避免同层命名风格分叉。
    public var settingsDisplayOverline: String { t("显示", "Display") }
    public var settingsBackground: String { t("训练背景", "Training background") }
    public var settingsBodyConditionLabel: String { t("身体状况", "Body areas") }
    public var settingsBodyConditionNote: String {
        t(
            "选了的部位，相关动作不会自动加重",
            "Exercises related to selected areas won't increase automatically"
        )
    }
    public func settingsBodyPartName(_ code: String) -> String {
        switch code {
        case "knee": return t("膝盖", "Knee")
        case "shoulder": return t("肩膀", "Shoulder")
        case "lowerBack": return t("下背", "Lower back")
        case "elbow": return t("手肘", "Elbow")
        case "wrist": return t("手腕", "Wrist")
        case "ankle": return t("脚踝", "Ankle")
        case "neck": return t("颈部", "Neck")
        default: return code
        }
    }
    public func settingsBodyConditionValue(_ codes: [String]) -> String {
        codes.map(settingsBodyPartName).joined(separator: locale == .zh ? "、" : ", ")
    }
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
        t("开启后按 4 周块自动安排过载与减载　计划页显示当前周期　关闭则只按你的身体反应逐次调整　安全规则始终生效",
          "When on, training runs a 4-week block with built-in overload and deload weeks, and Plan shows your current cycle. When off, each session is tuned only to how you've been responding. The safety rule stays on either way")
    }
    public var settingsData: String { t("数据", "Data") }
    /// FR-SE6 导出行（K7）：canonical 原样 JSON → 系统分享面板。
    public var settingsExportAction: String { t("导出训练数据", "Export training data") }
    /// 导出读失败 alert（沿 dataUnreadable 文案家族：如实说读不出，绝不产出空文件假成功）。
    public var settingsExportFailedTitle: String { t("暂时读不出数据", "Can't read your data right now") }
    public var settingsExportFailedBody: String {
        t("训练数据文件此刻读取失败　稍后再试一次", "The training data file couldn't be read. Try again")
    }
    public var settingsExportFailedConfirm: String { t("好", "OK") }
    // FR-SE9 / FR-SUB2：订阅状态、恢复与管理。价格、试用和续订条款不在这里，
    // 只能由 StoreKit 本地化商品视图提供。
    public var settingsSubscriptionSection: String { t("方案", "Plan") }
    public var settingsSubscriptionFreeCore: String { "Free Core" }
    public var settingsSubscriptionPaidCoach: String { "Rede Coach" }
    public var settingsSubscriptionChecking: String { t("正在核对购买…", "Checking purchases…") }
    public var settingsSubscriptionUnknownTier: String {
        t("当前方案：暂时无法确认", "Current plan: unavailable")
    }
    public var settingsSubscriptionUnknown: String {
        t("暂时无法核对购买　Free Core 仍可正常使用",
          "Purchases can't be checked right now. Free Core still works")
    }
    public var settingsSubscriptionGrace: String {
        t("续费宽限期内　Rede Coach 保持可用",
          "Billing grace period. Rede Coach remains available")
    }
    public var settingsSubscriptionManage: String { t("管理订阅", "Manage subscriptions") }
    public var settingsSubscriptionRetry: String { t("重新核对", "Check again") }
    public var settingsSubscriptionOperationFailed: String {
        t("暂时无法完成　稍后再试　Free Core 不受影响",
          "Couldn't complete that right now. Try again later. Free Core is unaffected")
    }
    public var settingsSubscriptionOpenCoach: String { t("查看 Rede Coach", "View Rede Coach") }
    public var subscriptionPageCurrentPlan: String { t("当前方案", "Current plan") }
    public var subscriptionPagePreparingOverline: String { t("准备中", "In development") }
    public var subscriptionPagePreparingTitle: String {
        t("功能完成后再加入这里", "Features will be added here when they’re ready")
    }
    public var subscriptionPageNotOpen: String {
        t("订阅尚未开放", "Subscriptions aren’t open yet")
    }
    public var subscriptionPageUnavailableOverline: String {
        t("暂时不可用", "Temporarily unavailable")
    }
    public var subscriptionPageUnavailableTitle: String {
        t("订阅选项暂时不可用", "Subscription options are temporarily unavailable")
    }
    public var subscriptionPageFreeCoreAvailable: String {
        t("Free Core 仍可使用", "Free Core remains available")
    }
    /// 设置面板铭牌头型号行（工艺重做 2026-06-10，Overline 渲染为全大写）。
    public var settingsPanelOverline: String { t("Rede · 调校", "Rede · Tuning") }
    public var settingsPrivacy: String { t("隐私", "Privacy") }
    /// M6-2 隐私说明（FR-DT4 诚实表达 + 文案基线 §7.4）：只说代码可证的事实。
    /// StoreKit runtime 存在后不能继续声称 App 完全不联网；训练数据与 Apple 购买流分开说明。
    ///
    /// FR-ACC1 改写（2026-08-08）：加入云端同步后，「Rede 没有账号」这句话就是假的，
    /// 必须同批改掉——功能一旦进包，旧措辞即构成不实陈述。按文案基线 §7.4 的既定说法
    /// 写成条件式（「未开启时保存在本机」），而不是删掉隐私承诺。
    public var settingsPrivacyNote: String {
        t("训练记录默认保存在这台设备本机　开启云端同步后同时保留一份在云端　订阅购买由 Apple 处理　Rede 不含第三方统计组件　删除 App 会同时删除本机训练数据",
          "Training records live on this device by default. Turning on Cloud Sync also keeps a copy in the cloud. Apple handles subscription purchases. Rede has no third-party analytics. Deleting the app also deletes its local training data")
    }
    /// 2026-08-09 IA 重排后这个 key 升为「关于」**分组头**（原本是组内一行）。
    /// 组内展开免责正文的那一行改用 settingsDisclaimerTitle，避免组名与行名同字。
    public var settingsAbout: String { t("关于", "About") }
    /// 免责行标题（原来叫「关于」，与分组头同名）。
    public var settingsDisclaimerTitle: String { t("免责声明", "Disclaimer") }
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

    // MARK: - 云端同步（FR-ACC1）
    //
    // 文案纪律（§3.4/3.5）：中文不收句号，两拍之间用全角空格；失败态一律「发生了什么
    // + 你还能用什么」，与既有的「暂时无法核对购买　Free Core 仍可正常使用」同结构。

    public var syncPanelOverline: String { t("Rede · 同步", "Rede · Sync") }
    public var syncTitle: String { t("云端同步", "Cloud Sync") }
    public var syncStateOff: String { t("未开启", "Off") }
    public var syncStateOn: String { t("已开启", "On") }

    // 未开启
    public var syncIntroTitle: String { t("把记录留在云端", "Keep your records in the cloud") }
    public func syncAtRisk(count: Int) -> String {
        t("场训练只存在这一台设备", count == 1 ? "session exists only on this device"
                                              : "sessions exist only on this device")
    }
    public var syncMetaEarliest: String { t("最早一场", "Earliest") }
    public var syncMetaSpan: String { t("已累积", "Span") }
    public func syncSpanMonths(_ months: Int) -> String {
        t("\(months) 个月", months == 1 ? "1 month" : "\(months) months")
    }
    public var syncSignInWithApple: String { t("通过 Apple 登录", "Sign in with Apple") }

    // 双端对照
    public var syncSideLocal: String { t("这台设备", "This device") }
    public var syncSideCloud: String { t("云端", "Cloud") }
    public var syncUnitSessions: String { t("场训练", "sessions") }
    public var syncVerdictMatched: String { t("一致", "In sync") }
    public var syncVerdictFetching: String { t("正在取回", "Fetching") }
    public var syncNeverSynced: String { t("还没同步过", "Not synced yet") }
    public func syncShortBy(_ n: Int) -> String { t("少 \(n) 场", "\(n) behind") }
    public var syncReasonNewerVersion: String {
        t("来自更新版本的 Rede", "From a newer version of Rede")
    }
    public var syncReasonUnclean: String { t("云端有记录读不出", "Some cloud records can't be read") }
    public var syncReasonOffline: String { t("连不上云端", "Can't reach the cloud") }
    /// 服务端拒绝（4xx/5xx）。与「连不上」严格分开——真机实证把 HTTP 400 说成
    /// 网络问题会让用户去查 WiFi，而那边等多久也不会自己好。
    public var syncReasonRejected: String { t("云端拒绝了这次同步", "The cloud refused this sync") }
    /// owner mismatch（归档：必须 fail-closed）。
    public var syncReasonOwnerMismatch: String {
        t("这台设备的记录属于另一个账号", "These records belong to another account")
    }
    public var syncOwnerMismatchDetail: String {
        t("为避免把两个人的训练混在一起　同步已停下　换回原来的账号就能继续　或先导出这台设备上的记录",
          "Sync stopped so two people's training doesn't get mixed. Sign back in with the original account to continue, or export the records on this device first")
    }
    public var syncRejectedDetail: String {
        t("本机训练记录不受影响　这不是网络问题　重试仍失败请把这条错误发给我们",
          "Records on this device are unaffected. This isn't a network problem. If retrying keeps failing, send us this error")
    }

    // 状态解释（脚注位）
    public func syncBlockedDetail(_ n: Int) -> String {
        t("另一台设备用了更新版本　这 \(n) 场没有丢失　更新 App 后自动补齐",
          "Another device is on a newer version. These \(n) aren't lost. Updating Rede brings them in")
    }
    public var syncUncleanDetail: String {
        t("已被单独隔离　不会影响其他记录", "Quarantined on its own. Other records are unaffected")
    }
    public var syncOfflineDetail: String {
        t("本机训练记录不受影响　恢复网络后自动重试",
          "Records on this device are unaffected. It retries when the network is back")
    }
    public var syncFirstFetchNote: String {
        t("换设备后第一次取回可能需要一会儿", "The first fetch after switching devices can take a moment")
    }

    // 操作
    public var syncAccount: String { t("账号", "Account") }
    public var syncAccountApple: String { t("Apple ID", "Apple ID") }
    public var syncNow: String { t("立即同步", "Sync now") }
    public var syncAutoFootnote: String {
        t("练完自动上传　打开 App 时自动取回",
          "Uploads after each workout, fetches when you open Rede")
    }
    public var syncUpdateApp: String { t("前往 App Store 更新", "Update in the App Store") }
    public var syncRetry: String { t("重试", "Retry") }
    public var syncSignOut: String { t("退出登录", "Sign out") }
    public var syncSignOutFootnote: String {
        t("退出后这台设备上的记录保留", "Records on this device stay after signing out")
    }

    // 删号
    public var syncDeleteAccount: String { t("删除云端账号", "Delete cloud account") }
    public func syncDeleteBody(count: Int, word: String) -> String {
        t("云端的 \(count) 场训练将被永久删除　这台设备上的记录保留　输入 \(word) 以确认",
          "\(count) sessions in the cloud will be permanently deleted. Records on this device stay. Type \(word) to confirm")
    }
    /// 云端条数未知时的删号正文。**不许拿本地数顶替**——文案说的是「云端的 N 场」，
    /// 用本地数字填进去就是在删除确认这一步给用户看假数据。
    public func syncDeleteBodyUnknownCount(word: String) -> String {
        t("云端的训练记录将被永久删除　当前无法确认云端有多少场　这台设备上的记录保留　输入 \(word) 以确认",
          "Your cloud records will be permanently deleted. How many are up there can't be confirmed right now. Records on this device stay. Type \(word) to confirm")
    }

    /// 删号确认词。中英分开——中文输入法下让用户敲英文单词是刁难。
    public var syncDeleteConfirmWord: String { t("删除", "DELETE") }
    public var syncExportFirst: String { t("先导出一份训练数据", "Export your data first") }
    public var syncCancel: String { t("取消", "Cancel") }

    // MARK: - 展示数据(静态;M2-M4 由 catalog/engine localized 值接管)

    public var exerciseBenchPress: String { t("卧推", "Bench press") }
}
