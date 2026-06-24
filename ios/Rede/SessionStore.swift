import Foundation
import RedeDataHealth
import RedeDomain
import RedeL10n
import RedeNotifications
import RedePersistence
import RedeTrainingDecision
import RedeWidgetShared

/// 真 DataHealth gate 适配器（组合层接线，验证逻辑在包内；
/// EndToEndWriteTests 内有同构副本，两处必须保持一致）。
private struct DataHealthGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {
        try CanonicalWriteValidation.validate(candidate: candidate, replacing: current)
    }
}

// SessionStore — 会话级状态容器（M3-2）：今日模型 + 进行中训练流。
// app 层不做业务判断：流转移全在 TrainFlowState（包内有测试），
// 这里只是 @Observable 包装 + 时钟注入点。进行中会话仅存内存
//（FR-TR9 跨进程恢复未排片，已在 MVP 计划留痕）；完成落盘归 M3-3。

/// draft 文件存取（独立于 canonical，不经写闸；best-effort——draft 丢失不阻塞训练）。
private enum DraftFile {
    static var url: URL {
        TodayModel.canonicalFileURL().deletingLastPathComponent()
            .appendingPathComponent("active-session-draft.json", isDirectory: false)
    }

    static func load() -> TrainSessionDraft? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(TrainSessionDraft.self, from: data)
    }

    static func save(_ draft: TrainSessionDraft) {
        guard let data = try? JSONEncoder().encode(draft) else { return }
        try? FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        try? data.write(to: url, options: [.atomic])
    }

    static func clear() {
        try? FileManager.default.removeItem(at: url)
    }
}

/// @MainActor：所有写路径（performGatedMutation/performCoachWrite/performPlanWrite/
/// completeAndPersistSession 等）的 `isSaving` 互斥锁 guard-then-set 由主 actor 保证原子，
/// 杜绝连点并发 load-modify-write 丢更新（审计 MAJOR）。纯只读静态 loader 标 nonisolated，
/// 仍可在 Task.detached 里 off-main 跑（磁盘读不阻塞主线程）。
@MainActor
@Observable
final class SessionStore {
    var todayOutcome: TodayModel.LoadOutcome?
    var flow: TrainFlowState?
    var sessionStartedAt: Date?
    /// FR-NT1/2 本地通知调度 seam（切片2 链接证明 → 切片3 接休息生命周期）。
    let notificationScheduler: NotificationScheduling = UNUserNotificationCenterScheduler()
    /// 通知偏好/语言缓存（rest-begin 不每次读盘）：loadToday + saveNotificationPreferences 后刷新。
    private var notifRestEndEnabled = false
    private var notifWeeklyEnabled = false
    private var notifLocale: RedeLocale = .en
    /// 休息倒计时的墙钟锚点（owner 反馈 2026-06-15 修复）：剩余秒数曾放在 TrainTabView
    /// 的 @State，切 tab 时 RootTabView 用 switch 销毁视图树即归 0。移到会话层后跨切页
    /// 存活，且按绝对结束时刻求剩余 → 离屏期间真实时间照常流逝。详见 RestCountdown。
    private(set) var restCountdown = RestCountdown()
    /// 启动时发现的可恢复 draft（FR-TR9 提示「继续进行中的训练」）。
    var pendingDraft: TrainSessionDraft?
    /// 写入失败的如实呈现（FR-TR8：绝不假装成功）；nil = 无错误。训练落盘/偏好/引导共用。
    var saveErrorText: String?
    /// FR-T5 教练动作写入（采纳/撤销/暂不处理）失败的如实呈现，与全局 saveErrorText **隔离**——
    /// 今日页教练错误面只读它，杜绝训练/设置写失败错配到教练卡语境（审查 MAJOR：跨域错误污染）。
    var coachSaveErrorText: String?
    /// FR-PL3/4 计划调整写入（采纳/回滚）失败的如实呈现，同样与全局 saveErrorText 隔离——
    /// 计划页调整面只读它，不抢显训练/设置/教练写失败（复刻教练隔离修复，防跨面错误污染）。
    var planSaveErrorText: String?
    /// 设置类写入（通知偏好/单位语言/周期开关）失败的如实呈现，与训练 saveErrorText 隔离——
    /// 设置页只读它，杜绝设置写失败错配到训练小结/引导语境（审计 MAJOR：跨域错误污染）。
    var settingsSaveErrorText: String?
    /// FR-PL3：本次 app 会话内「暂不」了频率提案（会话级、不落库——存活于切 tab，重启后清。
    /// 建议仍有效故重启可再提，但同一会话内不再反复弹，避免每次进计划页都催）。
    var planProposalSnoozed = false
    /// 保存进行中（防双击双写；MainActor 上同步置位）。
    var isSaving = false
    /// 草稿写任务句柄：每次 persistDraft 取消上一次未完成的写，防乱序覆盖（审计 MAJOR）。
    private var draftTask: Task<Void, Never>?

    var todayModel: TodayModel? {
        if case .ready(let model)? = todayOutcome { return model }
        return nil
    }

    func loadToday() async {
        todayOutcome = await TodayModel.loadOutcomeAsync()
        checkForRestorableDraft()
        refreshWidgetSnapshot()
        refreshNotificationCache() // FR-NT1：缓存偏好/语言供 rest-begin 调度
    }

    // MARK: - W-1 Readiness Widget 接线（slice 1）：今日裁决落定 → 写 App Group 派生只读快照 → 触发刷新

    /// 今日加载成功后刷新 widget 快照。仅 .ready 写——unreadable 不覆盖上次好快照（诚实降级：
    /// 宁可显示旧/占位也不写假数据）。文案与今日页同源（RedeL10n 组装器）；文件 IO + reload 全在
    /// 后台；失败静默：widget 是增强、不阻塞主流程，也不假装成功。
    private func refreshWidgetSnapshot(now: Date = Date()) {
        guard case .ready(let model)? = todayOutcome else { return }
        // 在主调用侧把裁决投影成 Sendable primitives，避免把 TodayModel 整体跨 actor 边界
        //（审查 M-1）；文案解析含一次文件读，连同写入/刷新一并留后台、不占主线程。
        let call = model.verdict.call.rawValue
        let reason = model.verdict.reason.code
        let dayCode = model.prescription?.dayCode
        let hasPlan = !(model.prescription?.exercises.isEmpty ?? true)
        var gapDays: Int?
        var consecutiveDays: Int?
        for signal in model.verdict.signals {
            if case .daysSinceLastSession(let days) = signal { gapDays = days }
            if case .consecutiveTrainingDays(let days) = signal { consecutiveDays = days }
        }
        Task.detached(priority: .utility) {
            let strings = SessionStore.resolveWidgetStrings()
            let dayName = dayCode.map(strings.trainingDayName) ?? ""
            // FR-WD1：只回答「该不该练」+ 训练日名 + 短理由；rows 留空（V1 小尺寸够用）。
            let snapshot = ReadinessWidgetSnapshot(
                generatedAtIso: ISO8601DateFormatter().string(from: now),
                headline: strings.widgetHeadline(call: call, dayName: dayName, hasPlan: hasPlan),
                advice: strings.widgetAdvice(call: call, reasonCode: reason, dayName: dayName,
                                             gapDays: gapDays, consecutiveDays: consecutiveDays, hasPlan: hasPlan),
                rows: []
            )
            do {
                try AppGroupWidgetSnapshotStore().write(snapshot)
                WidgetTimelineReloader().reloadWidgets()
            } catch {
                // App Group 不可用 / 写失败：不 reload、不报错——保留上次好快照或诚实占位。
            }
        }
    }

    /// widget 文案语言/单位解析：取持久化偏好，缺失回退系统语言 / kg（同 LocaleStore 启动口径）。
    /// 取舍（审查 M-2）：widget 跟「已落盘」的语言，不跟内存 LocaleStore 里未保存的临时切换——
    /// 设置里改语言会经写闸落盘，下次今日加载即同步 widget，无长期分叉。
    nonisolated private static func resolveWidgetStrings() -> RedeStrings {
        let prefs = loadPreferences()
        var locale = RedeLocale.resolve(fromLanguageCode: Locale.current.language.languageCode?.identifier)
        if let raw = prefs.locale, let persisted = RedeLocale(rawValue: raw) { locale = persisted }
        return RedeStrings(locale: locale, unit: RedeUnit.resolve(prefs.unit))
    }

    // MARK: - M5-2 偏好与档案（FR-SE1/SE2/SE3）

    /// 启动时读取持久化偏好（只读，不经写闸）；unreadable/缺失 → nil（渲染层默认兜底）。
    nonisolated static func loadPreferences() -> (unit: String?, locale: String?) {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return (nil, nil) }
        return (appData.userProfile.unitSystem, appData.userProfile.locale)
    }

    /// 设置页展示用的档案快照（引导四答）。
    struct ProfileSnapshot {
        let primaryGoal: String?
        let weeklyTrainingDays: Int?
        let equipmentScenario: String?
        let trainingLevel: String?
    }

    nonisolated static func loadProfileSnapshot() -> ProfileSnapshot? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let profile = appData.userProfile
        return ProfileSnapshot(
            primaryGoal: profile.primaryGoal,
            weeklyTrainingDays: profile.weeklyTrainingDays,
            equipmentScenario: profile.equipmentScenario,
            trainingLevel: profile.trainingLevel
        )
    }

    /// 计划页模板事实（FR-PL1：只展示真数据——来自引导的分化与天数）。
    struct TemplateFacts {
        let splitType: String?
        let daysPerWeek: Int?
        let goal: String?
        let level: String?
        let equipment: String?
    }

    nonisolated static func loadTemplateFacts() -> TemplateFacts? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let template = appData.programTemplate
        let profile = appData.userProfile
        // 真数据：分化/天数来自模板；目标/背景/器械统一从档案取（审查 P2：与设置页 ProfileSnapshot
        // 同源 profile.primaryGoal，避免日后改目标时模板/档案两份漂移）。FR-PL1：只展示真值，不编排期/周期。
        return TemplateFacts(
            splitType: template.splitType,
            daysPerWeek: template.daysPerWeek,
            goal: profile.primaryGoal,
            level: profile.trainingLevel,
            equipment: profile.equipmentScenario
        )
    }

    /// 计划页周期条状态（FR-PL2 S5）：仅周期化开启且有真历史锚点时返回，否则 nil（退诚实占位）。
    /// 走与今日页处方同一 clean pipeline + 同一锚点 → 周期条与处方相位永远一致。
    nonisolated static func loadCycleState(now: Date = Date()) -> MesocycleCycleState? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load(), appData.mesocycle.enabled else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        let todayISO = formatter.string(from: now)
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: todayISO) else { return nil }
        return Mesocycle.cycleState(
            sessionDatesISO: input.sessions.map(\.date),
            todayISO: todayISO,
            enabled: true,
            blockLengthWeeks: appData.mesocycle.blockLengthWeeks
        )
    }

    /// 计划页周排期投影（FR-PL2）：本周/下周训练日 + 模式构成，只读派生。与今日页处方走同一
    /// clean pipeline + 同一轮转口径（input.program/sessions）→ 第一天 == 今日页此刻训练日，永不分叉。
    /// unreadable/缺失 → 空（计划页退回诚实占位）。
    nonisolated static func loadPlanProjection(now: Date = Date()) -> [[PlanDayProjection]] {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return [] }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: formatter.string(from: now)),
              let daysPerWeek = input.program.daysPerWeek else { return [] }
        return PlanWeekProjection.weeks(
            splitType: input.program.splitType,
            daysPerWeek: daysPerWeek,
            completedSessionCount: input.sessions.count,
            customization: PlanCustomizationBridge.input(from: appData.planCustomization) // FR-PL6/PL7
        )
    }

    // MARK: - FR-PL3/4 计划调整提案 / 已采纳态（计划页只读派生）

    /// 计划页调整卡所需状态：要么有一条**待采纳提案**（含 before/after 本周训练日预览），
    /// 要么有一条**已采纳记录**（可撤）；二者互斥——已采纳时抑制新提案（单记录无栈，避免有损覆盖，
    /// owner 拍板）。无提案且无记录 → `.none`，计划页不显示调整区。
    struct PlanAdjustmentState: Equatable {
        var proposal: PlanAdjustmentProposal?     // 待采纳（nil = 无）
        var activeTo: Int?                          // 已采纳记录的现频率（非 nil = 可撤）
        var proposedWeekDays: [PlanDayProjection]   // 提案后本周训练日（预览，答「影响哪几天」）

        static let none = PlanAdjustmentState(proposal: nil, activeTo: nil, proposedWeekDays: [])
    }

    /// 计划页调整状态（FR-PL3 提案 + FR-PL4 可撤）。走与处方同一 clean pipeline。
    /// unreadable/缺 daysPerWeek → 仍如实报已采纳记录（理论必有 daysPerWeek，防御保留撤销入口）。
    nonisolated static func loadPlanAdjustmentState(now: Date = Date()) -> PlanAdjustmentState {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return .none }
        let activeTo = appData.planAdjustment?.toDaysPerWeek
        // 已有采纳记录 → 只给撤销，抑制新提案（单记录无栈，二次采纳会有损覆盖原值）。
        if activeTo != nil {
            return PlanAdjustmentState(proposal: nil, activeTo: activeTo, proposedWeekDays: [])
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        let todayISO = formatter.string(from: now)
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: todayISO),
              let planned = input.program.daysPerWeek else { return .none }
        let counts = WeeklyAdherence.recentWeeklySessionCounts(
            sessionDatesISO: input.sessions.map(\.date), todayISO: todayISO
        )
        guard let proposal = PlanAdjustmentEngine.frequencyProposal(
            plannedDaysPerWeek: planned, recentWeeklySessionCounts: counts
        ) else { return .none }
        // 提案后本周训练日（同投影口径，weeks:1 取本周；与今日页处方/计划排期同源、不分叉）——
        // 答「影响哪几天」。提案前的完整排期就在调整区下方，故不再重复列 before。
        let proposed = PlanWeekProjection.weeks(
            splitType: input.program.splitType, daysPerWeek: proposal.toDaysPerWeek,
            completedSessionCount: input.sessions.count, weeks: 1
        ).first ?? []
        return PlanAdjustmentState(proposal: proposal, activeTo: nil, proposedWeekDays: proposed)
    }

    /// 周期化开关当前持久态（设置页开关初值）；unreadable/缺失 → false（默认关）。
    nonisolated static func loadMesocycleEnabled() -> Bool {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return false }
        return appData.mesocycle.enabled
    }

    // MARK: - FR-PL6 计划编辑器上下文 / 影响（计划编辑器只读派生）

    /// 编辑器起点：某训练日当前的动作清单（自定义优先，否则默认模板）+ 是否已自定义 + 器械场景。
    struct DayEditorContext: Equatable {
        let dayCode: String
        let currentExerciseIds: [String]
        let isCustomized: Bool
        let equipmentScenario: String?
    }

    nonisolated static func loadDayEditorContext(dayCode: String, now: Date = Date()) -> DayEditorContext? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX"); fmt.timeZone = .current; fmt.dateFormat = "yyyy-MM-dd"
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: fmt.string(from: now)) else { return nil }
        let scenario = input.profile.equipmentScenario
        if let day = appData.planCustomization?.dayPlans[dayCode], !day.exercises.isEmpty {
            return DayEditorContext(dayCode: dayCode, currentExerciseIds: day.exercises.map(\.exerciseId),
                                    isCustomized: true, equipmentScenario: scenario)
        }
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(dayCode: dayCode, equipmentScenario: scenario)
        return DayEditorContext(dayCode: dayCode, currentExerciseIds: defaults, isCustomized: false, equipmentScenario: scenario)
    }

    /// FR-PL6.1 改动影响：把本 dayCode 换成 proposedIds 后，算这一周肌群频率前后 delta（护栏数据）。
    /// 用 PlanWeekProjection 取本周日序（public；resolvedDaySequence 为包内 internal），逐日解析 ids
    ///（自定义优先、否则 defaultDayExerciseIds）喂 PlanCustomizationImpact。unreadable/缺天数 → nil。
    nonisolated static func computeDayEditImpact(dayCode: String, proposedIds: [String], now: Date = Date()) -> PlanCustomizationImpact.Summary? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX"); fmt.timeZone = .current; fmt.dateFormat = "yyyy-MM-dd"
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: fmt.string(from: now)),
              let daysPerWeek = input.program.daysPerWeek else { return nil }
        let scenario = input.profile.equipmentScenario
        let custom = appData.planCustomization
        var beforePlans: [String: [String]] = [:]
        for (dc, dp) in (custom?.dayPlans ?? [:]) { beforePlans[dc] = dp.exercises.map(\.exerciseId) }
        var afterPlans = beforePlans
        afterPlans[dayCode] = proposedIds
        func resolve(_ dc: String, _ plans: [String: [String]]) -> [String] {
            if let ids = plans[dc], !ids.isEmpty { return ids }
            return TodayPrescriptionEngine.defaultDayExerciseIds(dayCode: dc, equipmentScenario: scenario)
        }
        // 本周日序（与今日页/计划页同源），customization 走 bridge 以应用自定义日序。
        let weekDays = PlanWeekProjection.weeks(
            splitType: input.program.splitType, daysPerWeek: daysPerWeek,
            completedSessionCount: input.sessions.count, weeks: 1,
            customization: PlanCustomizationBridge.input(from: custom)
        ).first ?? []
        guard !weekDays.isEmpty else { return nil }
        let weekBefore = weekDays.map { resolve($0.dayCode, beforePlans) }
        let weekAfter = weekDays.map { resolve($0.dayCode, afterPlans) }
        return PlanCustomizationImpact.compute(weekBefore: weekBefore, weekAfter: weekAfter)
    }

    // MARK: - FR-PL7② 训练日顺序编辑器上下文（切片 S10）

    /// 顺序编辑器起点：当前有效训练日序（自定义优先、否则默认）+ 是否已自定义日序 + 分化 + 已完成场次。
    /// completedSessionCount 供编辑器实时算「下一个训练日将变为 X」（轮转锚定完成场次）。
    struct DaySequenceContext: Equatable {
        let dayCodes: [String]          // 当前顺序（编辑器 seed）
        let isCustomized: Bool          // 是否已存在自定义日序（控制「恢复默认」是否显示）
        let splitType: String?          // 预览 nextDayCode 用
        let completedSessionCount: Int  // 预览 nextDayCode 用（轮转锚点）
    }

    nonisolated static func loadDaySequenceContext(now: Date = Date()) -> DaySequenceContext? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX"); fmt.timeZone = .current; fmt.dateFormat = "yyyy-MM-dd"
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: fmt.string(from: now)) else { return nil }
        let split = input.program.splitType
        let override = appData.planCustomization?.daySequence
        // 当前有效序与引擎同口径（resolvedDaySequence：合法排列用 override，否则默认）→ 编辑器永不与排期分叉。
        let current = TodayPrescriptionEngine.resolvedDaySequence(splitType: split, override: override)
        guard !current.isEmpty else { return nil }
        // isCustomized：存了合法排列 override（== 当前有效序）且**顺序确实异于默认**才算已自定义。
        // 脏 override 当未自定义；override 恰等于默认序也当未自定义（否则「恢复默认」会在已是默认时误显示=no-op 入口，审查 MAJOR）。
        let isCustomized = override != nil && current == override
            && current != TodayPrescriptionEngine.defaultDaySequence(splitType: split)
        return DaySequenceContext(dayCodes: current, isCustomized: isCustomized,
                                  splitType: split, completedSessionCount: input.sessions.count)
    }

    // MARK: - FR-NT1/2 通知偏好 + 授权

    /// 读当前通知偏好（设置开关初值；缺=关）。
    nonisolated static func loadNotificationPreferences() -> (restEnd: Bool, weekly: Bool) {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return (false, false) }
        return (appData.notificationRestEndEnabled, appData.notificationWeeklyEnabled)
    }

    /// 刷新通知缓存（rest-begin 调度用，避免每组读盘）：loadToday + 保存偏好后调用。
    /// 顺带按当前偏好重注册每周提醒（幂等；偏好/语言变更后保持系统侧一致）。
    private func refreshNotificationCache() {
        let prefs = SessionStore.loadNotificationPreferences()
        notifRestEndEnabled = prefs.restEnd
        notifWeeklyEnabled = prefs.weekly
        var locale = RedeLocale.resolve(fromLanguageCode: Locale.current.language.languageCode?.identifier)
        if let raw = SessionStore.loadPreferences().locale, let persisted = RedeLocale(rawValue: raw) { locale = persisted }
        notifLocale = locale
        syncWeeklyReminders()
    }

    /// FR-NT2：按偏好重注册每周提醒。先清掉"策略管理但当前不激活"的每周 id（含全关时清全部），
    /// 再注册激活的（文案经 RedeL10n 按 messageCode 解析）。幂等。
    private func syncWeeklyReminders() {
        let prefs = NotificationPreferences(masterEnabled: true, restEndEnabled: notifRestEndEnabled, weeklyEnabled: notifWeeklyEnabled)
        let reminders = WeeklyTrainingReminderPolicy.weeklyReminders(preferences: prefs)
        let activeIds = Set(reminders.map(\.reminderId))
        for id in WeeklyTrainingReminderPolicy.managedWeeklyIds where !activeIds.contains(id) {
            notificationScheduler.cancelRest(id: id) // 通用按 id 移除待发——清掉已不激活的每周项
        }
        guard !reminders.isEmpty else { return }
        let strings = RedeStrings(locale: notifLocale)
        let resolved = reminders.map { reminder in
            ResolvedWeeklyReminder(
                id: reminder.reminderId, weekday: reminder.weekday, hour: reminder.hour, minute: reminder.minute,
                title: strings.notificationWeeklyTitle(messageCode: reminder.messageCode),
                body: strings.notificationWeeklyBody(messageCode: reminder.messageCode)
            )
        }
        notificationScheduler.replaceWeekly(resolved)
    }

    /// 请求系统通知授权（价值先行：在用户首次开开关时调）。返回是否获授权。
    func requestNotificationAuthorization() async -> Bool {
        await notificationScheduler.requestAuthorization()
    }

    /// 通知偏好写入：经唯一写闸 open-bag scalar edit；成功后刷新缓存。失败如实置 saveErrorText。
    @discardableResult
    func saveNotificationPreferences(restEndEnabled: Bool, weeklyEnabled: Bool) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL), gate: DataHealthGate()
                )
                try writer.applyNotificationPreferences(restEndEnabled: restEndEnabled, weeklyEnabled: weeklyEnabled)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success:
            refreshNotificationCache()
            return true
        case .failure(let error):
            settingsSaveErrorText = String(describing: error)
            return false
        }
    }

    /// 偏好写入（FR-SE1/SE3 持久化）：经写闸 scalar edit；失败如实置 settingsSaveErrorText。
    /// isSaving 互斥沿写闸单调用方合同（审查 MAJOR-1：防快速连点并发 load-modify-write 丢更新）。
    @discardableResult
    func savePreferences(unitSystem: String?, locale: String?) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                try writer.applyPreferences(unitSystem: unitSystem, locale: locale)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success:
            refreshNotificationCache() // 改语言后同步通知文案语言缓存（审查 MINOR-1）
            return true
        case .failure(let error):
            settingsSaveErrorText = String(describing: error)
            return false
        }
    }

    /// 周期化开关写入（FR-PL2 enablement）：经写闸 scalar edit；失败如实置 settingsSaveErrorText。
    /// isSaving 互斥沿写闸单调用方合同（防快速连点并发 load-modify-write 丢更新，同 savePreferences）。
    @discardableResult
    func saveMesocycleEnabled(_ enabled: Bool) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                try writer.applyMesocyclePreference(enabled: enabled)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success:
            return true
        case .failure(let error):
            settingsSaveErrorText = String(describing: error)
            return false
        }
    }

    // MARK: - FR-PL3/4 计划频率调整 采纳 / 回滚

    /// 采纳频率调整（FR-PL3）：经写闸改 daysPerWeek + 落回滚记录 → 重载今日（plan 投影/处方吃新值）。
    /// 失败如实置 planSaveErrorText 返 false（计划页专属错误面，隔离于全局）。isSaving 互斥（同写闸单调用方合同）。
    @discardableResult
    func applyFrequencyAdjustment(fromDaysPerWeek: Int, toDaysPerWeek: Int) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        planSaveErrorText = nil // 开写即清旧错（每次尝试干净起步，成功后不残留）
        defer { isSaving = false }
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL), gate: DataHealthGate()
                )
                try writer.applyFrequencyAdjustment(fromDaysPerWeek: fromDaysPerWeek, toDaysPerWeek: toDaysPerWeek)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success:
            await loadToday()
            return true
        case .failure(let error):
            planSaveErrorText = String(describing: error)
            return false
        }
    }

    /// 回滚最近一次计划调整（FR-PL4，单步即时）：经写闸恢复原 daysPerWeek + 删记录 → 重载今日。无记录幂等。
    @discardableResult
    func rollbackPlanAdjustment() async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        planSaveErrorText = nil // 开写即清旧错（同采纳，干净起步）
        defer { isSaving = false }
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL), gate: DataHealthGate()
                )
                try writer.rollbackPlanAdjustment()
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success:
            await loadToday()
            return true
        case .failure(let error):
            planSaveErrorText = String(describing: error)
            return false
        }
    }

    /// FR-T5 教练卡「暂不处理」（切片6b）：经写闸累加 dismiss 计数 → 重载今日 →
    /// 引擎据降频政策决定本卡是否再出（温和：换动作/修数据连续 2 次后、补量本周 1 次后不再出）。
    /// actionKey 必须用引擎产出的 action.actionKey（闭环一致，UI 不手搓 key）。
    @discardableResult
    func dismissCoachAction(actionKey: String) async -> Bool {
        await performCoachWrite { _ = try $0.applyCoachActionDismissal(actionKey: actionKey) }
    }

    // MARK: - FR-T5 教练动作 采纳 / 撤销（切片6c）

    /// 教练动作采纳/撤销/暂不处理的统一 gated 写包装：isSaving 互斥（防快速连点并发 load-modify-write 丢更新）
    /// + 后台唯一写闸（读→改→安检→写前备份→原子保存）+ 成功后重载今日。失败如实置 coachSaveErrorText 返 false。
    /// 开写即清 coachSaveErrorText（每次尝试干净起步，成功后旧错不残留）；用教练专属错误字段（非全局 saveErrorText）
    /// 隔离今日页错误面，杜绝跨域污染（审查 MAJOR）。mutate 在后台线程执行、只调写闸方法（不捕获 @MainActor 状态）；
    /// 撤销=单步反向写（owner 拍板，不另起 undo 栈）。
    @discardableResult
    private func performCoachWrite(_ mutate: @escaping @Sendable (CanonicalSessionWriter) throws -> Void) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        coachSaveErrorText = nil
        defer { isSaving = false }
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                try mutate(writer)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success:
            await loadToday() // 重载 → plan() 消费换动作覆盖 / 引擎按补量态抑制卡
            return true
        case .failure(let error):
            coachSaveErrorText = String(describing: error)
            return false
        }
    }

    /// 换动作采纳：把到顶动作 originalId 覆盖成用户所选替代 actualId；plan() 下次消费覆盖真正替换处方该槽。
    @discardableResult
    func applyExerciseSubstitution(originalId: String, actualId: String) async -> Bool {
        await performCoachWrite { _ = try $0.applyExerciseSubstitution(originalId: originalId, actualId: actualId) }
    }

    /// 换动作撤销（单步即时）：移除该动作的覆盖，回到引擎默认选材。
    @discardableResult
    func removeExerciseSubstitution(originalId: String) async -> Bool {
        await performCoachWrite { _ = try $0.removeExerciseSubstitution(originalId: originalId) }
    }

    // MARK: - FR-PL6/PL7 自定义训练计划写入（计划编辑器；错误进 planSaveErrorText 隔离于计划页）

    /// 计划编辑写入的统一 gated 包装（同 performCoachWrite，但用 planSaveErrorText = 计划页错误面）：
    /// isSaving 互斥 + 后台唯一写闸（读→改→安检→备份→原子写）+ 成功后重载今日/计划派生；失败如实报。
    @discardableResult
    private func performPlanWrite(_ mutate: @escaping @Sendable (CanonicalSessionWriter) throws -> Void) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        planSaveErrorText = nil
        defer { isSaving = false }
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL), gate: DataHealthGate()
                )
                try mutate(writer)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success:
            await loadToday() // 仅刷新今日页（todayOutcome）；**计划页 projection 需调用方在成功后
                              // 显式 PlanTabView.reload()**（同 applyFrequencyAdjustment 调用方合同，审查 MAJOR-1）。
            return true
        case .failure(let error):
            planSaveErrorText = String(describing: error)
            return false
        }
    }

    /// FR-PL6 采纳/更新某训练日自定义动作清单。
    @discardableResult
    func applyCustomDayPlan(dayCode: String, exercises: [CustomExerciseItem]) async -> Bool {
        await performPlanWrite { _ = try $0.applyCustomDayPlan(dayCode: dayCode, exercises: exercises) }
    }

    /// FR-PL6「恢复默认」：移除某训练日自定义 → 引擎重算默认。
    @discardableResult
    func removeCustomDayPlan(dayCode: String) async -> Bool {
        await performPlanWrite { _ = try $0.removeCustomDayPlan(dayCode: dayCode) }
    }

    /// FR-PL7② 采纳自定义日序。
    @discardableResult
    func applyCustomDaySequence(_ sequence: [String]) async -> Bool {
        await performPlanWrite { _ = try $0.applyCustomDaySequence(sequence) }
    }

    /// FR-PL7② 恢复默认日序。
    @discardableResult
    func removeCustomDaySequence() async -> Bool {
        await performPlanWrite { _ = try $0.removeCustomDaySequence() }
    }

    /// 补量采纳：记录本周已承认补量（**不改处方、不加训练**）→ 引擎本周抑制补量卡（诚实语义）。
    @discardableResult
    func applyVolumeBoost(weekStartISO: String) async -> Bool {
        await performCoachWrite { _ = try $0.applyVolumeBoost(weekStartISO: weekStartISO) }
    }

    /// 补量撤销（单步即时）：撤掉本周补量承认 → 若仍落后，补量卡可再出。
    @discardableResult
    func removeVolumeBoost(weekStartISO: String) async -> Bool {
        await performCoachWrite { _ = try $0.removeVolumeBoost(weekStartISO: weekStartISO) }
    }

    // MARK: - M5-1b 引导（FR-ON1/3）

    /// 是否需要首启引导。铁律：unreadable ≠ 新用户——文件在但读不懂时绝不进引导
    /// （引导完成会写盘，可能覆盖既有记录）。仅当合法空文档（文件缺失或
    /// 无模板、无历史、无背景）时为 true。
    nonisolated static func needsOnboarding() -> Bool {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        do {
            guard let existing = try store.load() else { return true } // 文件缺失 = 合法首启
            return existing.history.isEmpty
                && existing.programTemplate.splitType == nil
                && existing.userProfile.trainingLevel == nil
        } catch {
            return false // unreadable：如实降级到 Today 的 unreadable 态
        }
    }

    /// 引导完成：4 问 → 模板映射（包内纯函数）→ 写闸落盘 → 重载今日。
    /// 返回 false 时 saveErrorText 已置（如实呈现，可重试）。
    @discardableResult
    func completeOnboarding(_ answers: OnboardingAnswers) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }

        let template = OnboardingPlanInit.template(for: answers)
        let write = OnboardingWrite(
            trainingLevel: answers.trainingLevel,
            primaryGoal: answers.primaryGoal,
            weeklyTrainingDays: template.daysPerWeek, // 调用约定：取钳制后的值
            equipmentScenario: answers.equipmentScenario,
            splitType: template.splitType
        )
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                try writer.applyOnboarding(write)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value

        switch result {
        case .success:
            saveErrorText = nil
            await loadToday() // 结果卡直接读真实首练处方（FR-ON3）
            return true
        case .failure(let error):
            saveErrorText = String(describing: error)
            return false
        }
    }

    /// 当日 draft → 恢复提示；跨天/无效 → 静默清除。
    private func checkForRestorableDraft() {
        guard flow == nil, pendingDraft == nil, let draft = DraftFile.load() else { return }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        if draft.isRestorable(todayISO: formatter.string(from: Date())) {
            pendingDraft = draft
        } else {
            DraftFile.clear()
        }
    }

    func restorePendingDraft() {
        guard let draft = pendingDraft else { return }
        pendingDraft = nil
        guard let restored = draft.restoreFlow(allowedEquipment: allowedEquipment, loadUnit: loadUnit) else {
            // 重放失败（如 catalog 漂移）：宁可不恢复，清掉过期 draft
            DraftFile.clear()
            return
        }
        flow = restored
        sessionStartedAt = draft.startedAt
        // 跨进程恢复不留旧 deadline（FR-TR9 最小恢复）：若恢复到休息态，按计划秒数
        // 重新计时；否则清空。
        if restored.phase == .resting {
            restCountdown.begin(seconds: restored.restSecondsPlanned)
        } else {
            restCountdown.clear()
        }
    }

    func discardPendingDraft() {
        pendingDraft = nil
        DraftFile.clear()
    }

    /// 事件包装：转移 + 即时 draft 留存（每个动作后都可恢复）。
    /// restCompletedNaturally=true：休息倒计时自然归零（前台 runRestTimer 推进）——**不取消**已排程的
    /// 休息提醒，让它此刻送达（前台经 delegate 呈现 / 后台系统送达）。手动「下一组」提前结束或收尾才取消。
    func apply(_ event: TrainFlowEvent, restCompletedNaturally: Bool = false) {
        guard flow != nil else { return }
        switch event {
        case .logSet(let obs): flow?.logSet(obs)
        case .restFinished: flow?.restFinished()
        case .skipSet(let reason): flow?.skipSet(reason: reason)
        case .skipExercise(let reason): flow?.skipExercise(reason: reason)
        case .replaceExercise(let id): flow?.replaceCurrentExercise(with: id)
        case .reportPain: flow?.reportPain()
        case .toggleHold: flow?.toggleHold()
        case .requestFinish: flow?.requestFinish()
        case .keepTraining: flow?.keepTraining()
        case .confirmEnd(let reason): flow?.confirmEnd(reason: reason)
        }
        syncRestCountdown(after: event, restCompletedNaturally: restCompletedNaturally)
        persistDraft()
    }

    // MARK: - FR-TR10 热身（流内临时引导，不进 events/不落库）

    /// 热身打勾：推进到下一热身步。纯内存态——不进事件日志、不落 draft（热身瞬态、按工作组指针重生）。
    func advanceWarmupStep() { flow?.advanceWarmupStep() }

    /// 跳过全部热身：直接进首个工作组。同样不进事件日志、不落 draft。
    func skipAllWarmup() { flow?.skipAllWarmup() }

    // MARK: - 休息倒计时（会话层接管，详见 SessionStore.restCountdown / RestCountdown）

    /// 当前剩余秒数（按墙钟实时求出；视图每秒重读）。
    var restRemainingSeconds: Int { restCountdown.remaining() }
    /// 进度条比例（剩余/总时长，与倒计时数字同源同步；+30 后仍平滑、0:00 精确归零）。
    var restFraction: Double { restCountdown.fraction() }
    /// 是否暂停（绑定暂停/继续按钮文案与态）。
    var restIsPaused: Bool { restCountdown.isPaused }

    /// +30 加时。同步按新剩余重排休息提醒——否则通知仍按原时点弹、早于实际结束（审查 MAJOR-1）。
    func addRestTime(_ seconds: Int) {
        restCountdown.add(seconds: seconds)
        if !restCountdown.isPaused { scheduleRestNotification(restSecondsPlanned: restCountdown.remaining()) }
    }
    /// 暂停 / 继续切换。暂停撤回待发提醒（别在暂停期间弹）；继续按剩余重排（审查 MAJOR-1）。
    func toggleRestPause() {
        restCountdown.togglePause()
        if restCountdown.isPaused {
            cancelRestNotification()
        } else {
            scheduleRestNotification(restSecondsPlanned: restCountdown.remaining())
        }
    }

    /// 事件落定后同步倒计时锚点。进入 resting（仅 logSet 一条路）= 开新休息；
    /// restFinished 或落到 summary = 结束清空；confirmEnd↔resting 折返（结束确认弹层
    /// 取消后继续训练）期间不动锚点，故剩余随墙钟延续、不会重置。
    private func syncRestCountdown(after event: TrainFlowEvent, restCompletedNaturally: Bool = false) {
        guard let flow else { restCountdown.clear(); cancelRestNotification(); return }
        switch event {
        case .logSet where flow.phase == .resting:
            restCountdown.begin(seconds: flow.restSecondsPlanned)
            scheduleRestNotification(restSecondsPlanned: flow.restSecondsPlanned)
        case .restFinished:
            restCountdown.clear()
            // 自然到点：不取消——通知正该此刻送达。仅手动提前结束才取消待发提醒（避免训练已推进还弹）。
            if !restCompletedNaturally { cancelRestNotification() }
        default:
            if flow.phase == .summary { restCountdown.clear(); cancelRestNotification() }
        }
    }

    /// FR-NT1：休息开始时按偏好安排锁屏提醒（偏好关→策略返回 nil→不安排）。文案经 RedeL10n 解析后传适配器。
    private func scheduleRestNotification(restSecondsPlanned: Int) {
        // MVP：masterEnabled 假设与 notifRestEndEnabled 对齐（开关开启已过授权流）。用户事后在 iOS
        // 系统设置关掉通知时，这里仍会 scheduleRest，但系统端静默不送达（不崩、无害）——审查 MINOR-2。
        let prefs = NotificationPreferences(masterEnabled: true, restEndEnabled: notifRestEndEnabled, weeklyEnabled: false)
        guard let plan = RestNotificationPolicy.scheduleOnRestBegin(restSecondsPlanned: restSecondsPlanned, preferences: prefs) else { return }
        let strings = RedeStrings(locale: notifLocale)
        notificationScheduler.scheduleRest(
            id: plan.notificationId,
            fireAfterSeconds: plan.fireAfterSeconds,
            title: strings.notificationRestEndTitle,
            body: strings.notificationRestEndBody
        )
    }

    private func cancelRestNotification() {
        notificationScheduler.cancelRest(id: RestNotificationPolicy.shouldCancelRestNotification())
    }

    private func persistDraft() {
        guard let flow, flow.phase != .summary else { return }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        let draft = TrainSessionDraft(
            dateISO: formatter.string(from: sessionStartedAt ?? Date()),
            startedAt: sessionStartedAt ?? Date(),
            prescription: flow.prescription,
            events: flow.events,
            catalogVersion: ExerciseCatalog.minimal.catalogVersion
        )
        // 取消上一次未完成的草稿写再派新写：快速连续打组会派多个并发写，乱序完成会把旧草稿盖回去
        //（杀进程重开恢复到错误中点，审计 MAJOR）。cancel 是协作式——故在写前查 isCancelled 跳过被取代的写
        //（已开始的 .atomic 写不会半截，最坏只是少写一帧旧草稿）。同 PlanDayEditorView impactTask 模式。
        draftTask?.cancel()
        draftTask = Task.detached(priority: .utility) {
            guard !Task.isCancelled else { return }
            DraftFile.save(draft)
        }
    }

    /// FR-EQ1：当前档案的器械白名单（nil = 不过滤）。
    private var allowedEquipment: Set<String>? {
        EquipmentAccess.allowed(for: todayModel?.cleanView.profile.equipmentScenario)
    }

    /// 档位系统（2026-06-13）：当前档案的重量单位 → 引擎真实档位。
    private var loadUnit: LoadUnit {
        LoadUnit(unitSystem: todayModel?.cleanView.profile.unitSystem)
    }

    /// 从今日处方开启训练（无处方/休息日则不开）。
    func startSession(now: Date = Date()) {
        guard flow == nil, let prescription = todayModel?.prescription else { return }
        pendingDraft = nil // 显式清提示（不依赖 alert binding 的隐式 dismiss）
        // FR-EQ1：换动作候选同守器械白名单
        flow = TrainFlowState(prescription: prescription, allowedEquipment: allowedEquipment, loadUnit: loadUnit)
        sessionStartedAt = now
        restCountdown.clear() // 新会话从 activeSet 起步，旧倒计时不得滞留
        persistDraft()
    }

    /// 今日尚未加载时先加载再开训（Plan tab 直接开训路径）。
    func startSessionLoadingIfNeeded() async {
        if todayOutcome == nil { await loadToday() }
        startSession()
    }

    func endSession() {
        flow = nil
        sessionStartedAt = nil
        saveErrorText = nil
        restCountdown.clear()
        cancelRestNotification() // FR-NT1：放弃/收尾时清掉待发的休息提醒，避免训练已结束还弹（审查 MAJOR-1）
        // 先取消未完成的草稿写再删文件：否则排队中的 save 可能在 clear 之后落地，留孤儿草稿
        // → 下次启动误弹「恢复训练」（审查 M-1）。
        draftTask?.cancel()
        draftTask = nil
        DraftFile.clear()
    }

    /// 放弃进行中训练（owner 反馈 2026-06-13）：清空流与 draft、不写 canonical——
    /// 与「结束训练→保存并完成」相对，给用户一个「取消、什么都不存」的出口。
    func abandonActiveSession() {
        endSession()
    }

    /// 完成写入（M3-3）：构建 canonical session → 真 DataHealth gate → 唯一写闸。
    /// 成功 → 清会话并重载今日（裁决翻转）；失败 → 如实报错、会话保留可重试。
    func completeAndPersistSession(now: Date = Date()) async -> Bool {
        guard let flow, flow.phase == .summary, !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        let startedAt = sessionStartedAt ?? now
        // 注意口径：date 为用户本地日（与引擎天序号一致）；startedAt/finishedAt 为
        // UTC ISO 时间戳——跨时区时两者日期字面可不一致，展示层取日期一律用 date 字段。
        let isoFormatter = ISO8601DateFormatter()
        let dayFormatter = DateFormatter()
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")
        dayFormatter.timeZone = .current
        dayFormatter.dateFormat = "yyyy-MM-dd"

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "session-\(UUID().uuidString)",
            dateISO: dayFormatter.string(from: startedAt),
            startedAtISO: isoFormatter.string(from: startedAt),
            finishedAtISO: isoFormatter.string(from: now),
            durationMinutes: max(0, Int(now.timeIntervalSince(startedAt)) / 60)
        )

        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                try writer.appendCompletedSession(session)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value

        switch result {
        case .success:
            endSession()
            await loadToday() // 裁决/进展立即反映新记录
            return true
        case .failure(let error):
            // MVP 临时方案：直出技术错误串（如实优先）；友好映射随 M4 文案层补。
            saveErrorText = String(describing: error)
            return false
        }
    }

    var sessionSummary: SessionSummary? {
        guard let flow, flow.phase == .summary else { return nil }
        let duration = sessionStartedAt.map { Int(Date().timeIntervalSince($0)) } ?? 0
        // §6.2：换入动作的 PR 参考 = 它自己的历史（处方只携带原动作的）——
        // 无历史则不发奖（与首练同口径）。契约假设（审查 N2）：cleanView.sessions
        // 只含已落盘历史、不含进行中 session——若改动该边界须同步本处口径
        var overrides: [String: Double] = [:]
        if let sessions = todayModel?.cleanView.sessions {
            for id in Set(flow.replacements.map(\.actualExerciseId)) {
                if let last = TodayPrescriptionEngine.lastTopWeightKg(exerciseId: id, sessions: sessions) {
                    overrides[id] = last
                }
            }
        }
        return SessionSummaryBuilder.build(
            prescription: flow.prescription,
            observations: flow.observationsByExercise,
            durationSeconds: max(0, duration),
            previousWeightOverrides: overrides
        )
    }
}
