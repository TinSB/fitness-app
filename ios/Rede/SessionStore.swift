import Foundation
import RedeDataHealth
import RedeDomain
import RedeL10n
import RedeLocalSnapshot
import RedeNotifications
import RedePersistence
import RedeTrainingDecision
import RedeWatchLink
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

/// 进行中训练 draft 的可注入存取 seam。独立于 canonical，不经 AppData 写闸。
protocol TrainSessionDraftStoring {
    func load() -> TrainSessionDraft?
    func enqueueSave(_ draft: TrainSessionDraft)
    @discardableResult func saveDurably(_ draft: TrainSessionDraft) -> Bool
    func clear()
}

/// 生产默认文件实现：单一串行队列保证普通异步写、耐久同步写、读取与清除严格有序。
/// durable/clear 的同步块天然排在此前 enqueue 后，旧写不会越过 clear 倒灌。
final class FileTrainSessionDraftStore: TrainSessionDraftStoring, @unchecked Sendable {
    private let url: URL
    private let queue = DispatchQueue(label: "com.rede.train-session-draft")

    init(url: URL = TodayModel.canonicalFileURL().deletingLastPathComponent()
        .appendingPathComponent("active-session-draft.json", isDirectory: false)) {
        self.url = url
    }

    func load() -> TrainSessionDraft? {
        queue.sync {
            guard let data = try? Data(contentsOf: url) else { return nil }
            return try? JSONDecoder().decode(TrainSessionDraft.self, from: data)
        }
    }

    func enqueueSave(_ draft: TrainSessionDraft) {
        queue.async { [url] in
            _ = Self.write(draft, to: url)
        }
    }

    @discardableResult
    func saveDurably(_ draft: TrainSessionDraft) -> Bool {
        queue.sync { Self.write(draft, to: url) }
    }

    func clear() {
        queue.sync { try? FileManager.default.removeItem(at: url) }
    }

    private static func write(_ draft: TrainSessionDraft, to url: URL) -> Bool {
        do {
            let data = try JSONEncoder().encode(draft)
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(), withIntermediateDirectories: true
            )
            try data.write(to: url, options: [.atomic])
            return true
        } catch {
            return false
        }
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
    /// Rede Coach 付费边界快照（FR-SUB1 修订）。**由 RootTabView 从 SubscriptionModel 灌进来**——
    /// SessionStore 不认识 StoreKit，只拿一个已经解析好的答案；引擎更是完全不知情。
    /// 默认 `.inactive` = 购买闸未开 = 全部能力照旧（生产今日形态）。
    private(set) var paidCoach: PaidCoachAccess = .inactive

    /// 权益或购买闸变化时由 app 层调用：更新边界并按新边界重算今日（周期化 / 自动均衡 /
    /// 教练卡都吃这一位）。值没变就什么都不做——订阅模型每次前台复核都会调到这里。
    func applyPaidCoach(_ access: PaidCoachAccess) async {
        guard access != paidCoach else { return }
        paidCoach = access
        if todayOutcome != nil { await loadToday() }
    }
    /// 训练流。**每次变化都要重推给表**（切片 4）——开训、记组、恢复 draft、结束
    /// 都会改变表上该显示什么。写成 didSet 而不是在四个调用点各补一句：
    /// 漏一处的症状是表上停在某一组不动，而那是练到一半才会发现的。
    var flow: TrainFlowState? { didSet { pushWatchPrescription() } }
    var sessionStartedAt: Date?
    /// FR-NT1/2 本地通知调度 seam（切片2 链接证明 → 切片3 接休息生命周期）。
    let notificationScheduler: NotificationScheduling = UNUserNotificationCenterScheduler()
    /// 通知偏好/语言缓存（rest-begin 不每次读盘）：loadToday + saveNotificationPreferences 后刷新。
    private var notifRestEndEnabled = false
    private var notifWeeklyEnabled = false
    private var notifComebackEnabled = true   // FR-NT3 缺省开（opt-out 拍板）
    private var notifLocale: RedeLocale = .en
    /// 休息倒计时的墙钟锚点（owner 反馈 2026-06-15 修复）：剩余秒数曾放在 TrainTabView
    /// 的 @State，切 tab 时 RootTabView 用 switch 销毁视图树即归 0。移到会话层后跨切页
    /// 存活，且按绝对结束时刻求剩余 → 离屏期间真实时间照常流逝。详见 RestCountdown。
    /// 休息倒计时。**变化也要重推给表**（切片 5）——否则表上「在休息」但没有结束时刻。
    /// 与 flow 的 didSet 同理：写在这里而不是各调用点，漏一处就是表上倒计时不动。
    private(set) var restCountdown = RestCountdown() { didSet { pushWatchPrescription() } }
    /// K6 休息计时 Live Activity（视觉层——裁定 1：到点提醒仍归 G1 休息通知）。
    /// 只在 restCountdown.begin/clear 既有接线点挂钩，不改 RestCountdown 本体。
    private let restLiveActivity = RestLiveActivityController()
    /// 进行中训练 draft 存取；生产默认仍落原文件，测试注入 fake，禁止触碰真实 AppData。
    private let draftStore: any TrainSessionDraftStoring
    /// 计划写入文件。生产固定 canonical；app-hosted 测试注入临时文件以实走同一写闸，
    /// 不触碰测试宿主的真实 AppData。
    private let planWriteFileURL: URL

    /// K6 启动清理只跑一次（审查 MINOR：@State 初值表达式在 View 结构体每次构造时
    /// 求值——将来任何让 WindowGroup 重估的改动都会构造临时 SessionStore，若清理在
    /// init 无闸门，会误杀正在跑的休息 Live Activity；进程级 once 保住原语义）。
    private static var didRunLaunchCleanup = false

    init(
        draftStore: any TrainSessionDraftStoring = FileTrainSessionDraftStore(),
        planWriteFileURL: URL = TodayModel.canonicalFileURL()
    ) {
        self.draftStore = draftStore
        self.planWriteFileURL = planWriteFileURL
        // K6 启动清理：上个进程被杀（训练异常中断）可能留下孤儿 Live Activity——
        // 新进程首次构造时必无休息在跑，全部收掉（controller 串行链保证先于 begin）。
        if !Self.didRunLaunchCleanup {
            Self.didRunLaunchCleanup = true
            restLiveActivity.end(endpoint: "launch-cleanup")
        }
    }
    /// 启动时发现的可恢复 draft（FR-TR9 提示「继续进行中的训练」）。
    var pendingDraft: TrainSessionDraft?
    /// 刚结束那场是怎么结束的（watchOS v3.3）："completed" / "abandoned"。放弃路径在清 flow 之前置位，
    /// 随 flow didSet 那次推送带给表——表据此决定 HK 会话 finish 还是 discard（放弃的训练不进健康）。
    /// 开训时清空。
    private var lastSessionOutcome: String?
    /// 写入失败的如实呈现（FR-TR8：绝不假装成功）；nil = 无错误。训练落盘/偏好/引导共用。
    var saveErrorText: String?
    /// FR-T5 教练动作写入（采纳/撤销/暂不处理）失败的如实呈现，与全局 saveErrorText **隔离**——
    /// 今日页教练错误面只读它，杜绝训练/设置写失败错配到教练卡语境（审查 MAJOR：跨域错误污染）。
    var coachSaveErrorText: String?
    /// FR-PL3/4 计划调整写入（采纳/回滚）失败的如实呈现，同样与全局 saveErrorText 隔离——
    /// 计划页调整面只读它，不抢显训练/设置/教练写失败（复刻教练隔离修复，防跨面错误污染）。
    var planSaveErrorText: String?
    /// FR-TR14 练完存回/撤销失败的独立错误面。Today 只读它，PlanTab 仍只读
    /// planSaveErrorText，避免把计划写失败错报成训练记录未保存。
    var completedSessionPlanSaveErrorText: String?
    /// FR-TR14 练完存回成功/撤销成功后递增；PlanTab 以 task(id:) 显式重载 projection。
    /// 失败不递增，避免把未落盘状态投影成成功。
    private(set) var completedSessionPlanRevision = 0
    /// 设置类写入（通知偏好/单位语言/周期开关）失败的如实呈现，与训练 saveErrorText 隔离——
    /// 设置页只读它，杜绝设置写失败错配到训练小结/引导语境（审计 MAJOR：跨域错误污染）。
    var settingsSaveErrorText: String?
    /// FR-PL3：本次 app 会话内按 kind 记「暂不」（会话级、不落库——存活于切 tab，重启后清）。
    /// 不同方向互不压制：暂不降频不能吞掉后来成立的增频提案，反之亦然。
    private var snoozedPlanProposalKinds: Set<PlanAdjustmentProposal.Kind> = []

    func snoozePlanProposal(_ kind: PlanAdjustmentProposal.Kind) {
        snoozedPlanProposalKinds.insert(kind)
    }

    func isPlanProposalSnoozed(_ kind: PlanAdjustmentProposal.Kind) -> Bool {
        snoozedPlanProposalKinds.contains(kind)
    }
    /// 保存进行中（防双击双写；MainActor 上同步置位）。
    var isSaving = false
    /// 云同步落盘失败的如实呈现，与其余写入错误面隔离——同步页只读它，
    /// 不把后台同步失败错报成训练记录没保存（沿用教练/计划/设置的隔离纪律）。
    var syncSaveErrorText: String?
    /// 已成功落盘的完成场次计数。**只在 completeAndPersistSession 真正写盘成功后递增**——
    /// 失败不动，所以拿它当「练完自动上传」的触发信号不会在写失败时误触发同步。
    private(set) var completedSessionCount = 0
    var todayModel: TodayModel? {
        if case .ready(let model)? = todayOutcome { return model }
        return nil
    }

    func loadToday() async {
        todayOutcome = await TodayModel.loadOutcomeAsync(paidCoach: paidCoach)
        checkForRestorableDraft()
        refreshWidgetSnapshot()
        pushWatchPrescription()   // watchOS 切片 3：处方推到表上
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
            let rows = SessionStore.widgetMuscleLevelRows(
                memoryURL: ProgressModel.muscleLevelMemoryFileURL(),
                strings: strings
            )
            let snapshot = ReadinessWidgetSnapshot(
                generatedAtIso: ISO8601DateFormatter().string(from: now),
                headline: strings.widgetHeadline(call: call, dayName: dayName, hasPlan: hasPlan),
                advice: strings.widgetAdvice(call: call, reasonCode: reason, dayName: dayName,
                                             gapDays: gapDays, consecutiveDays: consecutiveDays, hasPlan: hasPlan),
                rows: rows,
                locale: strings.locale.rawValue // widget 端给空态/脚注选语言（FR-WD1 中英混杂修复）
            )
            do {
                try AppGroupWidgetSnapshotStore().write(snapshot)
                WidgetTimelineReloader().reloadWidgets()
            } catch {
                // App Group 不可用 / 写失败：不 reload、不报错——保留上次好快照或诚实占位。
            }
        }
    }

    // MARK: - watchOS 切片 3：今日处方推到表

    /// 今日加载成功后把处方推给表。形状与 refreshWidgetSnapshot 一致——
    /// 主线程只做投影，渲染与发送留后台，失败静默（表是增强，不阻塞今日页）。
    ///
    /// 通道选 applicationContext：只保留最新一份、**不要求对端可达**、表下次醒来自动拿到。
    /// 「一份会被反复覆盖的当前状态」正是它的用途。这里绝不能用 sendMessage——
    /// 用户口袋里的手机大部分时间对表不可达，处方就永远推不过去。
    ///
    /// 显示串在手机侧渲染完再传（见 WatchPrescription 的理由）：重量必须先过
    /// 「器械 × 显示单位」的梯子吸附，那套逻辑在 app 层，表上重写一遍迟早两块屏对不上。
    ///
    /// ⚠️ unreadable 不推：与 widget 同一条诚实降级纪律——宁可让表显示上一份，
    /// 也不推一份基于读不懂的数据编出来的处方。
    /// 推送代次。**防旧盖新**：渲染在后台做，两次推送的任务谁先落地不确定——
    /// 没有它，`apply` 里 flow 与 restCountdown 各触发一次推送时，
    /// 先发起的那次（还没有休息结束时刻）可能后落地，把正确的那份盖掉。
    private var watchPushGeneration = 0

    private func pushWatchPrescription(now: Date = Date()) {
        guard case .ready(let model)? = todayOutcome else { return }
        watchPushGeneration &+= 1
        let generation = watchPushGeneration
        // ExercisePrescriptionPlan 是 Sendable，可以整体交给后台；dayCode 可能为 nil（休息日）。
        let plans = model.prescription?.exercises ?? []
        let dayCode = model.prescription?.dayCode
        // 训练进行时的当前一组（切片 4）。在 MainActor 上取完，后台只做渲染。
        let live = liveSetProjection()
        // 训练是否进行中（v3.3）：flow 在且没到小结。**表上的 HK 会话跟它走**，不跟 active 走——
        // 弹「结束训练？」确认层（.confirmEnd）时 active 是 nil，但训练没结束（审查 M1）。
        let trainingInProgress = flow != nil && flow?.phase != .summary
        let outcome: String? = trainingInProgress ? nil : (flow?.phase == .summary ? "completed" : lastSessionOutcome)
        // 今天已经练完的组数（v3.2）：canonical 记录里今天日期的场次总组数。
        // 没在训练且 > 0 → 表上清单头显示「今天练完了 · N 组」。
        let todayISO = Self.localDayISO(now)
        // 日期口径与 TodayModel 同：session.date 前 10 位就是本地日。
        let completedSetsToday = model.cleanView.sessions
            .filter { String($0.date.prefix(10)) == todayISO }
            .reduce(0) { $0 + $1.exercises.reduce(0) { $0 + $1.sets.count } }

        Task.detached(priority: .utility) {
            let strings = SessionStore.resolveWidgetStrings()
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = .current // 与引擎同口径：用户本地日历日
            formatter.dateFormat = "yyyy-MM-dd"

            let items = plans.map { ex in
                WatchPrescription.Item(
                    exerciseId: ex.exerciseId,
                    name: ExerciseCatalog.minimal.displayName(ex.exerciseId, localeCode: strings.locale.rawValue),
                    setsText: strings.exerciseMetaLine(sets: ex.sets, restSeconds: ex.restSeconds, rir: ex.targetRir),
                    // 目标重量如实推给表：落格是处方生成时的事（引擎侧 LoadGrid），
                    // 显示层再吸一次会把用户手输的离格重量改写成别的数（2026-08-19）。
                    targetText: strings.targetLine(
                        loadType: ex.loadType,
                        weightKg: ex.targetWeightKg,
                        reps: ex.targetReps)
                )
            }
            let active = live.map { l in
                let gridEquipment = LoadGrid.gridEquipment(loadType: l.loadType, equipment: l.equipment)
                let unit = LoadUnit(unitSystem: strings.unit.rawValue)
                return WatchPrescription.Active(
                    exerciseId: l.exerciseId,
                    exerciseName: ExerciseCatalog.minimal.displayName(l.exerciseId, localeCode: strings.locale.rawValue),
                    setNumber: l.setNumber, setTotal: l.setTotal,
                    exerciseNumber: l.exerciseNumber, exerciseTotal: l.exerciseTotal,
                    // 热身与正式组的文案完全不同源：热身走 warmupEmptyBar /
                    // warmupMovementPrep / warmupWeight（与手机 warmupMainLine 逐字同源），
                    // 正式组才走 targetLine。混用会把「空杆」显示成一个重量。
                    targetText: {
                        switch l.warmupKind {
                        case .emptyBar:
                            return "\(strings.warmupEmptyBar) \(strings.warmupReps(l.targetReps))"
                        case .movementPrep:
                            return "\(strings.warmupMovementPrep) \(strings.warmupReps(l.targetReps))"
                        case .percent:
                            return "\(strings.warmupWeight(l.targetWeightKg)) \(strings.warmupReps(l.targetReps))"
                        case nil:
                            return strings.targetLine(loadType: l.loadType, weightKg: l.targetWeightKg, reps: l.targetReps)
                        }
                    }(),
                    targetWeightKg: l.targetWeightKg, targetReps: l.targetReps,
                    targetRir: l.targetRir, isResting: l.isResting,
                    isWarmup: l.warmupKind != nil,
                    restEndsAt: l.restEndsAt,
                    restTotalSeconds: l.restTotalSeconds,
                    restPausedRemaining: l.restPausedRemaining,
                    // 表上快改素材（v2）。热身不给：热身步不落库、也不该改重量。
                    adjust: l.warmupKind == nil
                        ? SessionStore.watchAdjust(loadType: l.loadType, targetWeightKg: l.targetWeightKg,
                                                   gridEquipment: gridEquipment, unit: unit, strings: strings)
                        : nil,
                    // 休息屏「等下做什么」（v3）：与手机休息屏 restPreviewText 逐字同源。
                    restPreviewText: l.isResting
                        ? SessionStore.watchRestPreview(
                            currentExerciseDone: l.currentExerciseDone, nextExerciseId: l.nextExerciseId,
                            loadType: l.loadType, setNumber: l.setNumber,
                            weightKg: l.targetWeightKg,
                            targetReps: l.targetReps, strings: strings)
                        : nil)
            }
            let rx = WatchPrescription(
                dateISO: formatter.string(from: now),
                // 休息日 dayCode 为 nil → 空标题 + 空清单，表上显示「今天休息」。
                // **必须照推**：不推的话表上会继续显示昨天的动作，比空白更糟。
                dayTitle: dayCode.map(strings.trainingDayName) ?? "",
                exercises: items,
                active: active,
                localeCode: strings.locale.rawValue,
                completedSetsToday: completedSetsToday,
                trainingInProgress: trainingInProgress,
                sessionOutcome: outcome)
            guard let payload = rx.encoded else { return }

            await MainActor.run {
                // 已经有更新的一次在路上 → 这次作废，不发。
                guard self.watchPushGeneration == generation else { return }
                WatchLink.shared.send(
                    WatchLinkEnvelope(kind: WatchLinkKind.prescription,
                                      sentAtISO: ISO8601DateFormatter().string(from: now),
                                      payload: payload),
                    via: .applicationContext)
            }
        }
    }

    /// 训练进行时的当前一组，投影成 Sendable primitives（渲染留后台）。
    /// 没在训练 / 已进小结 → nil，表上退回只读清单。
    private struct LiveSet: Sendable {
        let exerciseId: String, loadType: String, equipment: String
        let setNumber: Int, setTotal: Int, exerciseNumber: Int, exerciseTotal: Int
        let targetWeightKg: Double, targetReps: Int, targetRir: Double
        let isResting: Bool
        /// 休息倒计时快照（绝对结束时刻 + 总时长 + 暂停冻结值）。切片 5。
        let restEndsAt: Date?, restTotalSeconds: Int, restPausedRemaining: Int?
        /// 热身步时非 nil，值是热身种类（空杆 / 百分比 / 动作模式）——文案分流用。
        let warmupKind: WarmupStep.Kind?
        /// 休息屏「等下做什么」的素材（v3）：本动作是否已做完（休息完就换动作）+ 下一个动作。
        /// 与 TrainTabView.restPreviewText 同一判据（完成 + 跳过 ≥ 组数）。
        let currentExerciseDone: Bool
        let nextExerciseId: String?
    }

    private func liveSetProjection() -> LiveSet? {
        guard let flow, let current = flow.currentExercise else { return nil }
        // confirmEnd / summary 都不该在表上给「完成这一组」——那时已经没有下一组了。
        guard flow.phase == .activeSet || flow.phase == .resting else { return nil }
        let p = flow.progress
        let entry = ExerciseCatalog.minimal.entry(id: current.exerciseId)
        // 休息完是否换动作（与 TrainTabView.restPreviewText 同判据），以及换到谁。
        let currentDone = flow.completedInCurrentExercise.count + flow.skippedInCurrentExercise >= current.sets.count
        let nextExerciseId = flow.plan.exercises.indices.contains(flow.exerciseIndex + 1)
            ? flow.plan.exercises[flow.exerciseIndex + 1].exerciseId : nil

        // **热身必须先判**。手机在热身（空杆）时若把正式组重量推给表，
        // 用户照着表练就会直接上重量——那是会受伤的（2026-08-15 owner 真机拍到）。
        // 热身的进度口径也不同：走热身步序号，不是工作组序号。
        if flow.isWarmingUp, let step = flow.currentWarmupStep {
            return LiveSet(
                exerciseId: current.exerciseId,
                loadType: current.loadType,
                equipment: entry?.equipment ?? "dumbbell",
                setNumber: step.index,
                setTotal: flow.warmupStepsForCurrentExercise.count,
                exerciseNumber: p.exerciseNumber, exerciseTotal: p.exerciseTotal,
                targetWeightKg: step.targetWeightKg,
                targetReps: step.targetReps,
                targetRir: 0,                      // 热身不记 RIR
                isResting: flow.phase == .resting,
                restEndsAt: restCountdown.endDate,
                restTotalSeconds: restCountdown.totalSeconds,
                restPausedRemaining: restCountdown.pausedRemaining,
                warmupKind: step.kind,
                currentExerciseDone: false, nextExerciseId: nextExerciseId)
        }

        let rec = flow.currentRecommendation
        return LiveSet(
            exerciseId: current.exerciseId,
            loadType: current.loadType,
            equipment: entry?.equipment ?? "dumbbell",
            setNumber: p.setNumber, setTotal: p.setTotal,
            exerciseNumber: p.exerciseNumber, exerciseTotal: p.exerciseTotal,
            // 与手机 logCurrentSet 同源：目标重量走 currentTargetWeightKg（含 Hold 分支），
            // 次数与 RIR 走引擎建议。两边取值必须一模一样，否则同一组在两块屏上目标不同。
            targetWeightKg: flow.currentTargetWeightKg ?? 0,
            targetReps: rec?.targetReps ?? 0,
            targetRir: Double(Int(rec?.targetRir ?? 2)),
            isResting: flow.phase == .resting,
            restEndsAt: restCountdown.endDate,
            restTotalSeconds: restCountdown.totalSeconds,
            restPausedRemaining: restCountdown.pausedRemaining,
            warmupKind: nil,
            currentExerciseDone: currentDone, nextExerciseId: nextExerciseId)
    }

    /// 表上记的一组。**走手机自己那条 apply(.logSet)**——不另开落盘路径，
    /// 于是休息计时、draft 留存、末组进小结全部自动一致。
    ///
    /// 只在「正是此刻等的那一组」时接受。丢弃的真实场景不是网络重传，
    /// 是**两块屏同时开着**：表上记了一组，又顺手在手机上点了打勾。
    /// 不判就是同一组落盘两次。
    func applyWatchLoggedSet(_ set: WatchLoggedSet) {
        // **手机 app 在训练中被划掉的那条路**（owner 2026-08-15 提出）。
        //
        // 划掉之后表上仍显示当前组，用户照样能记——排队通道会保证送达。
        // 但重开手机 app 时 flow 还是 nil：draft 要等用户点「继续训练」才重放，
        // 而排队的那条组正好在这个窗口送到，撞上下面的 guard 被静默丢弃。
        // 表上已经显示「已记录」了，组却没了——这正是选排队通道要避免的事。
        //
        // 修法：写进 draft 而不是内存里的 flow。draft 是这场训练的持久真源，
        // 用户点「继续训练」重放时自然带上。判断依据用 draft 重放出来的状态，
        // 幂等规则与在线路径完全一致。
        guard flow != nil else { appendWatchSetToDraft(set); return }
        guard let flow, flow.phase == .activeSet else { return }
        guard flow.currentExercise?.exerciseId == set.exerciseId else { return }

        if set.isWarmup {
            // 热身**不落库**：只推进热身步。幂等键同样是 exerciseId + 步序号。
            guard flow.isWarmingUp, flow.currentWarmupStep?.index == set.setNumber else { return }
            advanceWarmupStep()
            return
        }
        // **热身期间绝不接受正式组**。表侧状态滞后一拍就会撞上这里——
        // 不判的话，用户还在空杆热身，一组 65kg 就已经落库了。
        guard !flow.isWarmingUp, flow.progress.setNumber == set.setNumber else { return }
        apply(.logSet(CompletedSetObservation(
            weightKg: set.weightKg,
            reps: set.reps,
            rir: set.rir,
            // 疼痛只在手机上报——表上没有这个入口，照读当前状态，不臆造。
            painReported: flow.painReportedForCurrentSet)))
    }

    /// flow 尚未恢复时，把表侧记的组直接写进 draft。
    ///
    /// 只接受「重放后正好在等的那一组」——幂等规则与在线路径同一套，
    /// 不因为走了另一条路就放宽。热身在这条路上不处理：热身指针是纯内存的
    ///（引擎明确不落 draft、不进事件日志），重放后本来就会从头热身。
    private func appendWatchSetToDraft(_ set: WatchLoggedSet) {
        guard !set.isWarmup else { return }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        guard let draft = draftStore.load(),
              draft.isRestorable(todayISO: formatter.string(from: Date())),
              var replayed = draft.restoreFlow(allowedEquipment: allowedEquipment, loadUnit: loadUnit)
        else { return }

        // 重放后多半停在 .resting——记完一组就进休息，而 draft 里没有「休息已走完」这件事。
        // **必须先补一条 restFinished 再补 logSet**：reducer 在 .resting 下直接忽略 logSet
        //（TrainFlowState.logSet 第一行的 guard），硬追加的话重放时那条组会被静默吃掉，
        // 比现在丢得还隐蔽。补 restFinished 也符合事实：表上那段休息按墙钟确实走完了，
        // 线上路径此刻发的正是这条事件。
        var extraEvents: [TrainFlowEvent] = []
        if replayed.phase == .resting {
            extraEvents.append(.restFinished)
            replayed.restFinished()   // 值类型就地推进，不必整份重放第二次
        }
        // 校验放在补 restFinished **之后**：restFinished 可能推进到下一个动作，
        // 那时该等的组号与动作都变了。
        guard replayed.phase == .activeSet,
              replayed.currentExercise?.exerciseId == set.exerciseId,
              !replayed.isWarmingUp,
              replayed.progress.setNumber == set.setNumber
        else { return }

        let observation = CompletedSetObservation(
            weightKg: set.weightKg, reps: set.reps, rir: set.rir,
            painReported: replayed.painReportedForCurrentSet)
        var updated = draft
        for event in extraEvents { updated = updated.appending(event) }
        updated = updated.appending(.logSet(observation))
        // 同步落盘，不用 enqueue：这条路上没有界面、也没有下一次机会——
        // app 可能马上又被系统收走，异步写就赌上了这一组。
        guard draftStore.saveDurably(updated) else { return }
        // **内存里那份待恢复 draft 也要跟上**（审查 M2）：手机重开时 loadToday 已把磁盘 draft
        // 读进 pendingDraft、弹着「继续训练？」，排队的组正好在这个窗口送到——
        // 只写磁盘不更新 pendingDraft，用户点「继续」重放的是旧的那份，这一组照样丢，
        // 下一次 enqueueDraftSave 还会用不含它的事件把磁盘那份盖掉。
        if pendingDraft != nil { pendingDraft = updated }
    }

    // MARK: - watchOS v2：表上可调三个量 + 遥控命令

    /// 表上快改的素材：重量梯子 + 瓦片小字。
    ///
    /// 梯子从**手机这边**生成，理由与 targetText 相同：格子必须落在「器械 × 显示单位」
    /// 的真实梯子上（LoadGrid），而那套梯子的显示吸附在手机侧有 33 处调用点已对齐——
    /// 表上重算一遍迟早两块屏对同一组显示不同重量。表只在格子间选，不算数。
    ///
    /// 自重 / 弹力带没有重量轴（与手机快改面「自重无重量轴：隐藏重量刻度轨」同口径）：
    /// 给空梯子，表上不显示重量瓦片。
    nonisolated static func watchAdjust(loadType: String, targetWeightKg: Double, gridEquipment: String,
                                        unit: LoadUnit, strings: RedeStrings) -> WatchPrescription.Adjust {
        if loadType == "bodyweight" || loadType == "band" {
            return .init(weightRungs: [], weightCaption: "")
        }
        let caption: String
        switch loadType {
        case "assisted": caption = "\(strings.trainColAssist) \(strings.unitLabel)"
        case "bodyweight-plus": caption = "\(strings.trainColWeighted) \(strings.unitLabel)"
        default: caption = strings.unitLabel
        }
        return .init(
            weightRungs: watchWeightLadder(aroundKg: targetWeightKg, equipment: gridEquipment, unit: unit)
                .map { .init(kg: $0, text: strings.formatKg($0)) },
            weightCaption: caption)
    }

    /// 休息屏「等下做什么」那一行，与 TrainTabView.restPreviewText 同一分流：本动作做完了就报下一个
    /// 动作（「接下来 · 高位下拉」），否则按负荷类型报下一组（「下一组 · 第 3 组 · 60 kg × 6」）。
    /// 做完且没有下一个动作（这是最后一个动作的最后一段休息，不会发生——末组直接进小结）→ 空串。
    nonisolated static func watchRestPreview(currentExerciseDone: Bool, nextExerciseId: String?, loadType: String,
                                             setNumber: Int, weightKg: Double, targetReps: Int,
                                             strings: RedeStrings) -> String {
        if currentExerciseDone {
            return nextExerciseId.map {
                strings.restNextExercise(ExerciseCatalog.minimal.displayName($0, localeCode: strings.locale.rawValue))
            } ?? ""
        }
        let kg = strings.formatKg(weightKg)
        switch loadType {
        case "bodyweight", "band": return strings.restNextPreviewBodyweight(setNumber: setNumber, reps: targetReps)
        case "assisted": return strings.restNextPreviewAssisted(setNumber: setNumber, kg: kg, reps: targetReps)
        case "bodyweight-plus": return strings.restNextPreviewBodyweightPlus(setNumber: setNumber, kg: kg, reps: targetReps)
        default: return strings.restNextPreview(setNumber: setNumber, kg: kg, reps: targetReps)
        }
    }

    /// 用户本地日历日 yyyy-MM-dd（en_US_POSIX + 当前时区，与引擎、表侧 todayISO 同口径）。
    nonisolated static func localDayISO(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    /// 目标前后各 `span` 格的真实梯子（升序、含目标那一格；到梯子底就停，不出负数不出 0）。
    /// 12 格：kg 杠铃 = ±30 kg、选重机 = ±60 kg、lb 哑铃轻段 = ±30 lb——
    /// 练到一半临时改重量用不到更远，更远的该回手机改计划。
    nonisolated static func watchWeightLadder(aroundKg target: Double, equipment: String,
                                              unit: LoadUnit, span: Int = 12) -> [Double] {
        let center = LoadGrid.snapKg(target, equipment: equipment, unit: unit)
        var below: [Double] = []
        var cursor = center
        for _ in 0..<span {
            let next = LoadGrid.nextRungKg(cursor, equipment: equipment, unit: unit, up: false)
            guard next < cursor - 1e-9 else { break }   // 已是最低一格
            below.insert(next, at: 0)
            cursor = next
        }
        var above: [Double] = []
        cursor = center
        for _ in 0..<span {
            let next = LoadGrid.nextRungKg(cursor, equipment: equipment, unit: unit, up: true)
            guard next > cursor + 1e-9 else { break }   // 已是最高一格（lb 哑铃梯子有顶）
            above.append(next)
            cursor = next
        }
        return below + [center] + above
    }

    /// 表上的遥控命令（v2）。与 applyWatchLoggedSet 同一条纪律：**只在命令对着的正是当前状态时执行**。
    /// 表侧 context 滞后一拍是常态——「跳过热身」不能落到下一个动作头上，
    /// 「跳过休息」不能在已经开始下一组之后再把什么东西推进一步。
    ///
    /// 命令都走手机自己那条路（addRestTime / apply(.restFinished) / skipAllWarmup），
    /// 于是通知重排、Live Activity、draft 留存、表上的回推全部自动一致。
    func applyWatchCommand(_ command: WatchCommand) {
        guard let flow, flow.currentExercise?.exerciseId == command.exerciseId else { return }
        switch command.action {
        case .restAdd30:
            guard flow.phase == .resting else { return }
            addRestTime(30)
        case .restSkip:
            guard flow.phase == .resting else { return }
            // 表说「倒计时自然走完了」时，要手机自己的钟也同意才算数：
            // 手机上刚按过 +30 / 暂停、表侧那条在路上的旧消息不能把休息提前结束。
            // 用户手动按「下一组」不受此限——那是明确的意图。
            // 容忍 1 秒：表钟比手机快几百毫秒时 remaining() 会向上取整成 1，表侧那条 .task 已经
            // 发过不会再发，手机在口袋里又没有前台计时器——零容忍会让表停在 0:00（审查 m4）。
            // 陈旧的 +30 前旧消息剩余是 ~30，不会被误放行。
            if command.auto, restCountdown.remaining() > 1 || restCountdown.isPaused { return }
            apply(.restFinished, restCompletedNaturally: command.auto)
        case .restPauseToggle:
            guard flow.phase == .resting else { return }
            toggleRestPause()
        case .skipWarmup:
            guard flow.phase == .activeSet, flow.isWarmingUp else { return }
            skipAllWarmup()
        case .skipSet:
            // 跳过是会改落盘事实的动作：动作、组号、理由码三样都要对得上才执行。
            // 组号是幂等键——表侧滞后一拍的重复命令不能把下一组也跳掉；
            // 理由码解不出就丢弃（不猜、不落「其他」）。
            guard flow.phase == .activeSet, !flow.isWarmingUp,
                  flow.progress.setNumber == command.setNumber,
                  let reason = command.reason.flatMap(SetSkipReason.init(rawValue:))
            else { return }
            apply(.skipSet(reason))
        }
    }

    /// 裁定 D：只读 derived muscle-level-memory，将已解锁等级投影进现成 rows 通道。
    /// 任一门槛/读盘失败都回空；不写 memory、不改 widget schema。nonisolated 允许沿用
    /// refreshWidgetSnapshot 的 detached IO 边界，不把文件读取带回 MainActor。
    nonisolated static func widgetMuscleLevelRows(
        memoryURL: URL,
        strings: RedeStrings
    ) -> [ReadinessWidgetRow] {
        guard let memory = MuscleLevelMemoryStore(fileURL: memoryURL).load(),
              let tierRaw = memory.tierRaw,
              let tier = TrainingTier(rawValue: tierRaw),
              tier != .calibrating,
              !memory.levels.isEmpty
        else {
            return []
        }

        var candidates: [(raw: String, level: Int, label: MuscleGroupLabel)] = []
        for (raw, level) in memory.levels {
            guard let label = MuscleGroupLabel(rawValue: raw) else { continue }
            candidates.append((raw: raw, level: level, label: label))
        }
        candidates.sort { lhs, rhs in
            lhs.level == rhs.level ? lhs.raw < rhs.raw : lhs.level > rhs.level
        }
        return candidates.prefix(2).map { candidate in
            ReadinessWidgetRow(
                label: strings.muscleGroupName(candidate.label),
                value: strings.developmentLevel(candidate.level)
            )
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

    /// 设置页展示用的档案快照（引导四答 + 可选性别）。
    struct ProfileSnapshot {
        let primaryGoal: String?
        let weeklyTrainingDays: Int?
        let equipmentScenario: String?
        let trainingLevel: String?
        let sex: String?          // 批次 D：可选，仅相对力量标准用
        let injuryFlags: [String]
    }

    nonisolated static func loadProfileSnapshot() -> ProfileSnapshot? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        return profileSnapshot(from: appData)
    }

    nonisolated static func profileSnapshot(from appData: AppData) -> ProfileSnapshot {
        let profile = appData.userProfile
        let cleanProfile = CleanAppDataViewBuilder.build(from: appData).profile
        return ProfileSnapshot(
            primaryGoal: profile.primaryGoal,
            weeklyTrainingDays: profile.weeklyTrainingDays,
            equipmentScenario: profile.equipmentScenario,
            trainingLevel: profile.trainingLevel,
            sex: profile.sex,
            injuryFlags: cleanProfile.injuryFlags
        )
    }

    /// 计划页模板事实（FR-PL1：只展示真数据——来自引导的分化与天数）。
    struct TemplateFacts {
        let splitType: String?
        let daysPerWeek: Int?
        let goal: String?
        let level: String?
        let equipment: String?
        let isCustomizedDaySequence: Bool
    }

    nonisolated static func loadTemplateFacts() -> TemplateFacts? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let template = appData.programTemplate
        let profile = appData.userProfile
        let customization = PlanCustomizationBridge.input(from: appData.planCustomization)
        // 真数据：分化/天数来自模板；目标/背景/器械统一从档案取（审查 P2：与设置页 ProfileSnapshot
        // 同源 profile.primaryGoal，避免日后改目标时模板/档案两份漂移）。FR-PL1：只展示真值，不编排期/周期。
        return TemplateFacts(
            splitType: template.splitType,
            daysPerWeek: template.daysPerWeek,
            goal: profile.primaryGoal,
            level: profile.trainingLevel,
            equipment: profile.equipmentScenario,
            isCustomizedDaySequence: TodayPrescriptionEngine.isCustomizedDaySequence(
                splitType: template.splitType,
                override: customization.daySequence
            )
        )
    }

    /// FR-TR14 练完存回候选。目标是该场最终有序唯一动作；sessionEdits 只喂文案，
    /// 入口资格只看 target 与该 dayCode 当前有效构成是否不同。
    struct CompletedSessionPlanCandidate: Equatable, Sendable {
        let sessionId: String
        let dayCode: String
        let targetExerciseIds: [String]
        let addedExerciseIds: [String]
        let removedExerciseIds: [String]
        /// 审计素材对账后为空时，区分纯次序与其它构成差异，避免把换动作误报成重排。
        let isOrderOnlyDifference: Bool
    }

    /// FR-TR14 撤销令牌：raw dayPlan 来自实际写入瞬间的同一 gated mutation，
    /// 不经过 typed getter，故未知 sibling / 脏 item 都能原样恢复。
    struct CompletedSessionPlanUndoToken: Equatable, Sendable {
        let sessionId: String
        let dayCode: String
        let rawDayPlan: JSONValue?
        let didCreateDayPlansContainer: Bool
    }

    enum CompletedSessionPlanSaveOutcome: Equatable, Sendable {
        case saved(CompletedSessionPlanUndoToken)
        case noOp
        case failed
    }

    private struct CompletedSessionPlanEvaluation: Sendable {
        let candidate: CompletedSessionPlanCandidate
        let resolution: PlanDayApplyResolution
    }

    /// 已完成场次的 canonical 补充事实（T1 练完态 / K1 待机「上次」行 / K3「上一场」）：
    /// 训练日码、时长与 FR-TR14 open-bag 事实不在 clean snapshot 内，按 sessionId 从同一次
    /// canonical 读取补齐（快照链 HistoryEntry.sessionId 同源；只读不经写闸）。
    /// 缺失/不可读 → nil（对应字段不显示——不编数据）。
    struct TodayCompletedFacts {
        let dayCode: String?
        let durationMinutes: Int?
        let planCandidate: CompletedSessionPlanCandidate?
    }

    nonisolated static func loadCompletedFacts(
        sessionId: String,
        includesPlanCandidate: Bool = false
    ) -> TodayCompletedFacts? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        return completedFacts(
            from: appData,
            sessionId: sessionId,
            includesPlanCandidate: includesPlanCandidate
        )
    }

    /// 可测试的同读派生。默认调用面（Train 待机、非今日总结）只补 metadata；
    /// 只有 Today 的「今天这场」显式传 true，才运行 FR-TR14 候选所需的引擎投影。
    nonisolated static func completedFacts(
        from appData: AppData,
        sessionId: String,
        includesPlanCandidate: Bool = false,
        now: Date = Date()
    ) -> TodayCompletedFacts? {
        guard let session = appData.history.last(where: {
            $0.id == sessionId && $0.completed == true
        }) else { return nil }
        // templateId 是 legacy key 词汇表字段、类型层未提升（storage 开门设计）——此处按 key 直读。
        return TodayCompletedFacts(
            dayCode: session.storage["templateId"]?.asString,
            durationMinutes: session.durationMin.map { Int($0.rounded()) },
            planCandidate: includesPlanCandidate
                ? completedSessionPlanCandidate(from: appData, sessionId: sessionId, now: now)
                : nil
        )
    }

    /// FR-TR14 候选纯派生：dayCode 只认完成场 storage["templateId"]，绝不读已经被消费清空的
    /// oneTimeDayOverride；finalExerciseOrder 是构成真源，sessionEdits 仅为 add/remove 文案素材。
    nonisolated static func completedSessionPlanCandidate(
        from appData: AppData,
        sessionId: String,
        now: Date = Date()
    ) -> CompletedSessionPlanCandidate? {
        completedSessionPlanEvaluation(
            from: appData,
            sessionId: sessionId,
            now: now
        )?.candidate
    }

    /// 候选与落盘决议共用同一纯派生；展示时喂入口/文案，点击时由 Persistence resolver
    /// 在最新 canonical 已加载且 mutation 尚未提交的同一事务内重新调用。
    nonisolated private static func completedSessionPlanEvaluation(
        from appData: AppData,
        sessionId: String,
        now: Date
    ) -> CompletedSessionPlanEvaluation? {
        guard let session = appData.history.last(where: {
            $0.id == sessionId && $0.completed == true
        }),
        let dayCode = session.storage["templateId"]?.asString,
        !dayCode.isEmpty,
        let rawFinalOrder = session.storage["finalExerciseOrder"]?.asStringArray,
        !rawFinalOrder.isEmpty
        else { return nil }

        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        guard let input = try? CleanTrainingDecisionInput.make(
            from: cleanView,
            todayISO: formatter.string(from: now)
        ) else { return nil }

        // builder 已保证有序唯一；读取端再按同口径保留首次，旧/手工 open-bag 数据也不产生歧义。
        let target = stableUnique(rawFinalOrder)
        guard !target.isEmpty else { return nil }

        let scenario = input.profile.equipmentScenario
        let previousDayPlan = appData.planCustomization?.dayPlans[dayCode]
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(
            dayCode: dayCode,
            equipmentScenario: scenario
        )
        guard !defaults.isEmpty else { return nil }
        let customization = PlanCustomizationBridge.input(from: appData.planCustomization)
        let targetProjection = PlanCustomizationInput(
            dayPlans: [
                dayCode: target.map {
                    PlanCustomizationInput.ExerciseSpec(exerciseId: $0)
                },
            ]
        )
        // 目标也必须由现役处方完整接受；不在 app 层复制 catalog / 器械 / customSlots 规则。
        guard completedSessionEffectiveExerciseIds(
            input: input,
            appData: appData,
            dayCode: dayCode,
            customization: targetProjection
        ) == target,
        let current = completedSessionEffectiveExerciseIds(
            input: input,
            appData: appData,
            dayCode: dayCode,
            customization: customization
        )
        else { return nil }
        guard target != current else { return nil }

        let resolution: PlanDayApplyResolution
        if target == defaults {
            var clearedDayPlans = customization.dayPlans
            clearedDayPlans.removeValue(forKey: dayCode)
            let clearedEffective = completedSessionEffectiveExerciseIds(
                input: input,
                appData: appData,
                dayCode: dayCode,
                customization: PlanCustomizationInput(dayPlans: clearedDayPlans)
            )
            if clearedEffective == target {
                // 没有 overlay 把默认拉走：沿用编辑器收敛，已有 custom → clear，无 custom → noop。
                resolution = PlanDayEditRules.applyResolution(
                    working: target,
                    defaults: defaults,
                    wasCustomized: previousDayPlan != nil
                )
            } else {
                // sticky / 永久 substitution 会让清空后真实构成偏离 target；
                // 默认 IDs 此时是必要的 userPinned 覆盖，不是冗余 custom。
                resolution = .writeCustom
            }
        } else {
            resolution = PlanDayEditRules.applyResolution(
                working: target,
                defaults: defaults,
                wasCustomized: previousDayPlan != nil
            )
        }
        guard resolution != .noop else { return nil }

        let edits = session.storage["sessionEdits"]?.asObject
        let rawAdded = sessionEditExerciseIds(edits?["added"])
        let rawRemoved = sessionEditExerciseIds(edits?["removed"])
        // sessionEdits 是动作发生时审计，不是终态：先与最终 target 对账。若同一 id
        // 本场先加后删（或反向抵消），两侧一起消去，不能向用户报自相矛盾的事实。
        let cancelled = Set(rawAdded).intersection(rawRemoved)
        let targetSet = Set(target)
        let auditedAdded = rawAdded.filter {
            targetSet.contains($0) && !cancelled.contains($0)
        }
        let auditedRemoved = rawRemoved.filter {
            !targetSet.contains($0) && !cancelled.contains($0)
        }
        return CompletedSessionPlanEvaluation(
            candidate: CompletedSessionPlanCandidate(
                sessionId: sessionId,
                dayCode: dayCode,
                targetExerciseIds: target,
                addedExerciseIds: auditedAdded,
                removedExerciseIds: auditedRemoved,
                isOrderOnlyDifference: targetSet == Set(current)
            ),
            resolution: resolution
        )
    }

    /// FR-TR14 只读投影：复用现役 Today clean-input→prescription API 取得指定 dayCode
    /// 下场真实动作构成。合成 train verdict 只为绕开“今天已练完=rest”的展示裁决；
    /// sticky、永久 substitution、自定义优先级、器械过滤与默认回退全部仍由引擎决定。
    /// daySequence 仅在这份内存输入中固定为已完成场的 templateId，canonical 不变。
    nonisolated private static func completedSessionEffectiveExerciseIds(
        input: CleanTrainingDecisionInput,
        appData: AppData,
        dayCode: String,
        customization: PlanCustomizationInput
    ) -> [String]? {
        let forcedDayCustomization = PlanCustomizationInput(
            dayPlans: customization.dayPlans,
            daySequence: [dayCode]
        )
        let projectionVerdict = TodayVerdict(
            call: .train,
            reason: .normalProgression,
            signals: []
        )
        guard let prescription = TodayPrescriptionEngine.plan(
            input: input,
            verdict: projectionVerdict,
            mesocycleEnabled: appData.mesocycle.enabled,
            blockLengthWeeks: appData.mesocycle.blockLengthWeeks,
            substitutions: appData.exerciseSubstitutions,
            customization: forcedDayCustomization,
            dayCodeOverride: dayCode,
            rotationOffset: appData.rotationOffset,
            weeklyCycleRestart: appData.weeklyCycleRestart
        ),
        prescription.dayCode == dayCode
        else { return nil }
        return prescription.exercises.map(\.exerciseId)
    }

    /// Persistence resolver 专用：只能从同一事务刚 load 的 AppData 得到三种窄决定，
    /// 不携带 Today 展示时的 target / snapshot，杜绝 stale compare 与 stale undo。
    nonisolated private static func completedSessionPlanWriteDecision(
        from appData: AppData,
        sessionId: String,
        now: Date
    ) -> CompletedSessionPlanWriteDecision {
        guard let evaluation = completedSessionPlanEvaluation(
            from: appData,
            sessionId: sessionId,
            now: now
        ) else {
            return .noOp
        }
        switch evaluation.resolution {
        case .writeCustom:
            return .writeCustom(
                dayCode: evaluation.candidate.dayCode,
                exerciseIds: evaluation.candidate.targetExerciseIds
            )
        case .clearCustom:
            return .clearCustom(dayCode: evaluation.candidate.dayCode)
        case .noop:
            return .noOp
        }
    }

    nonisolated private static func stableUnique(_ values: [String]) -> [String] {
        var seen: Set<String> = []
        return values.filter { !$0.isEmpty && seen.insert($0).inserted }
    }

    nonisolated private static func sessionEditExerciseIds(_ value: JSONValue?) -> [String] {
        stableUnique((value?.asArray ?? []).compactMap {
            $0.asObject?["exerciseId"]?.asString
        })
    }

    /// K5 计划页「上次」列：各训练日码最近一次完成日期（canonical storage["templateId"] 直读，
    /// prefix(10) 日期归一——裁定 3）。从未练过的日码无键 → 该列不显示（不编数据）。只读不经写闸。
    nonisolated static func loadDayLastTrainedDates() -> [String: String] {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return [:] }
        var result: [String: String] = [:]
        for session in appData.history where session.completed == true {
            guard let day = session.storage["templateId"]?.asString,
                  let date = session.date.map({ String($0.prefix(10)) }),
                  // 严格日期校验（审查 MINOR：raw canonical 可含垃圾串，字典序比较会让
                  // "corrupted-x" 压过一切合法日期直出 UI——非法串跳过，同 clean 层口径）
                  Self.isStrictDayISO(date) else { continue }
            if let existing = result[day], existing >= date { continue }
            result[day] = date
        }
        return result
    }

    /// 严格 yyyy-MM-dd 校验（K5 审查 MINOR；与 clean 层 isValidTrainingDate 同口径）。
    nonisolated private static func isStrictDayISO(_ value: String) -> Bool {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "UTC")
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.isLenient = false
        return value.count == 10 && fmt.date(from: value) != nil
    }

    /// K5 计划页累计事实行：去重训练天数（cleanView.sessions，prefix(10) 归一）+
    /// 自首场日期起的 ISO 周跨度（含当前周；WeekAnchor 同锚点——裁定 3）。无历史 → nil。
    nonisolated static func loadTrainingTenure(now: Date = Date()) -> (weeks: Int, days: Int)? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        let dates = Set(cleanView.sessions.map { String($0.date.prefix(10)) })
        guard let firstISO = dates.min() else { return nil }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = .current
        fmt.dateFormat = "yyyy-MM-dd"
        guard let firstDate = fmt.date(from: firstISO),
              let firstMonday = fmt.date(from: WeekAnchor.isoWeekStart(firstDate)),
              let nowMonday = fmt.date(from: WeekAnchor.isoWeekStart(now)) else {
            return (1, dates.count) // 日期解析异常兜底：集合非空至少 1 周（不编更多）
        }
        // 周差用四舍五入吸收 DST ±1h 漂移（两端都是本地周一零点）。
        let weeks = max(1, Int((nowMonday.timeIntervalSince(firstMonday) / 604_800).rounded()) + 1)
        return (weeks, dates.count)
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
            completedSessionCount: projectionRotationBase(input: input, appData: appData),
            customization: PlanCustomizationBridge.input(from: appData.planCustomization) // FR-PL6/PL7
        )
    }

    /// 循环死区（2026-08-12）：当前配置下**轮不到**的训练日码，空 = 无死区或数据不足。
    /// 判断全在包内纯函数（PlanReachability，含单测）；这里只负责把三样真数据喂进去。
    nonisolated static func loadDeadZone(now: Date = Date()) -> PlanReachability.Report? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        guard let input = try? CleanTrainingDecisionInput.make(
            from: cleanView, todayISO: formatter.string(from: now)) else { return nil }
        let sequence = TodayPrescriptionEngine.resolvedDaySequence(
            splitType: input.program.splitType,
            override: PlanCustomizationBridge.input(from: appData.planCustomization).daySequence)
        return PlanReachability.evaluate(
            sequence: sequence,
            weeklyCycleRestart: appData.weeklyCycleRestart,
            sessionDates: input.sessions.map(\.date),
            todayISO: formatter.string(from: now))
    }

    // MARK: - FR-PL3/4 计划调整提案 / 已采纳态（计划页只读派生）

    /// 计划页调整卡所需状态：待采纳提案（含 after 训练日预览）与栈顶已采纳记录（可撤）可共存。
    /// 同 kind 沿用已采纳抑制；不同 kind 不抑制，支持「先降频→后增频」继续入栈。
    struct PlanAdjustmentState: Equatable {
        var proposal: PlanAdjustmentProposal?     // 待采纳（nil = 无）
        var activeKind: PlanAdjustmentProposal.Kind? // 栈顶已采纳方向（旧/未知 kind 防御为 nil）
        var activeTo: Int?                          // 已采纳记录的现频率（非 nil = 可撤）
        var proposedWeekDays: [PlanDayProjection]   // 提案后下一块训练日（预览，答「影响哪几天」；投影非日历周）
        /// 有一条提案，但被付费门挡住了（FR-SUB1 修订）。计划页据此显示预告行，
        /// **只说有、不说是什么**——泄露方向或天数就等于把付费结论白送。
        var hasHiddenProposal: Bool = false

        static let none = PlanAdjustmentState(
            proposal: nil, activeKind: nil, activeTo: nil, proposedWeekDays: []
        )
    }

    /// 计划调整提案的「暂不」政策（2026-08-16，owner：点了暂不、杀后台重开又跳出来）。
    ///
    /// 之前「暂不」只记在内存里，重启就没了——同一条建议一天能弹好几次。现在落库，规则学自
    /// Apple Watch「更改活动目标」提示 / Fitness 趋势卡这类做法：**同一条建议每周最多出现一次，
    /// 拒绝两次就闭嘴，除非证据变了**。
    ///
    /// · 提案身份 = 方向 + 从几天到几天（`reduceFrequency:5>3`）。证据（最近 4 个完整 ISO 周的中位数）
    ///   最快也要一周才会变，所以「本周」是自然的重提周期。
    /// · 「暂不」→ 写 `planAdjust:<身份>:<本周一>`：**本周不再出现**；下周窗口滚过一周，若仍成立再出一次。
    /// · 同一身份被「暂不」了 **两个不同的周** → 不再出现，直到身份变了（目标天数变了 / 方向反了 /
    ///   用户在设置里改了每周天数让 from 变了）。不设更长的重问周期：状态行每天都在说本周练了几天。
    /// · 「改回原计划」= 明确否决 → 写 `planAdjust:<身份>:veto`，同样直到身份变了才再提。
    /// · 「采纳」走既有的栈顶同 kind 抑制，不在这里。
    ///
    /// 复用教练卡的 dismiss 账本（`coachState.dismissed`，`applyCoachActionDismissal`）：同一个写闸、
    /// 同一个读取器（`AppData.coachDismissals`），键用 `planAdjust:` 前缀隔开，不新开 schema。
    enum PlanProposalDismissalPolicy {
        static let prefix = "planAdjust:"

        static func identity(_ proposal: PlanAdjustmentProposal) -> String {
            "\(proposal.kind.rawValue):\(proposal.fromDaysPerWeek)>\(proposal.toDaysPerWeek)"
        }
        /// 本周「暂不」键。
        static func weekKey(_ proposal: PlanAdjustmentProposal, weekStartISO: String) -> String {
            "\(prefix)\(identity(proposal)):\(weekStartISO)"
        }
        /// 「改回原计划」否决键。
        static func vetoKey(_ proposal: PlanAdjustmentProposal) -> String {
            "\(prefix)\(identity(proposal)):veto"
        }
        /// 本周暂不过 / 否决过 / 两个不同周都暂不过 → 不出。
        static func isSuppressed(_ proposal: PlanAdjustmentProposal, dismissals: [String: Int], weekStartISO: String) -> Bool {
            let idPrefix = "\(prefix)\(identity(proposal)):"
            if (dismissals[weekKey(proposal, weekStartISO: weekStartISO)] ?? 0) > 0 { return true }
            if (dismissals[vetoKey(proposal)] ?? 0) > 0 { return true }
            let dismissedWeeks = dismissals.filter { $0.key.hasPrefix(idPrefix) && !$0.key.hasSuffix(":veto") && $0.value > 0 }
            return dismissedWeeks.count >= 2
        }
    }

    /// 引擎此刻会提的原始候选（不过任何抑制）。回滚时用它写否决键——回滚后引擎多半立刻又提同一条。
    nonisolated static func planAdjustmentCandidate(from appData: AppData, now: Date, timeZone: TimeZone) -> PlanAdjustmentProposal? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        let todayISO = formatter.string(from: now)
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: todayISO),
              let planned = input.program.daysPerWeek else { return nil }
        let counts = WeeklyAdherence.recentWeeklySessionCounts(
            sessionDatesISO: input.sessions.map(\.date), todayISO: todayISO, timeZone: timeZone)
        return PlanAdjustmentEngine.frequencyProposal(plannedDaysPerWeek: planned, recentWeeklySessionCounts: counts)
    }

    /// 计划页调整状态（FR-PL3 提案 + FR-PL4 可撤）。走与处方同一 clean pipeline。
    /// unreadable/缺 daysPerWeek → 仍如实报已采纳记录（理论必有 daysPerWeek，防御保留撤销入口）。
    nonisolated static func loadPlanAdjustmentState(
        now: Date = Date(),
        paidCoach: PaidCoachAccess = .inactive
    ) -> PlanAdjustmentState {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return .none }
        return planAdjustmentState(from: appData, now: now, timeZone: .current, paidCoach: paidCoach)
    }

    /// 可测纯派生 seam：显式注入 canonical 快照 / 时钟 / 时区，不做 IO。
    nonisolated static func planAdjustmentState(
        from appData: AppData,
        now: Date,
        timeZone: TimeZone,
        paidCoach: PaidCoachAccess = .inactive
    ) -> PlanAdjustmentState {
        let activeRecord = appData.planAdjustmentHistory.last
        let activeKind = activeRecord.flatMap { PlanAdjustmentProposal.Kind(rawValue: $0.kind) }
        let recordedActiveTo = activeRecord?.toDaysPerWeek
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        let todayISO = formatter.string(from: now)
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: todayISO),
              let planned = input.program.daysPerWeek else {
            return PlanAdjustmentState(
                proposal: nil,
                activeKind: activeKind,
                activeTo: recordedActiveTo,
                proposedWeekDays: []
            )
        }
        // 收据正文说的是“现在”的目标；设置页后来改过天数时必须跟当前 clean program，
        // 历史 record.to 只保留作撤销审计，不能制造 hero/收据双真相。
        let activeTo = activeRecord == nil ? nil : planned
        let counts = WeeklyAdherence.recentWeeklySessionCounts(
            sessionDatesISO: input.sessions.map(\.date),
            todayISO: todayISO,
            timeZone: timeZone
        )
        let candidate = PlanAdjustmentEngine.frequencyProposal(
            plannedDaysPerWeek: planned, recentWeeklySessionCounts: counts
        )
        // 栈顶同 kind 沿用既有抑制；相反方向可以与撤销收据同屏并继续 append。
        // 再过「暂不」政策：本周暂不过 / 否决过 / 两个不同周都暂不过的身份不出（PlanProposalDismissalPolicy）。
        let weekStartISO = WeekAnchor.isoWeekStart(now, timeZone: timeZone)
        let proposal: PlanAdjustmentProposal? = {
            guard let candidate, candidate.kind != activeKind else { return nil }
            return PlanProposalDismissalPolicy.isSuppressed(candidate, dismissals: appData.coachDismissals,
                                                            weekStartISO: weekStartISO) ? nil : candidate
        }()
        guard let proposal else {
            return PlanAdjustmentState(
                proposal: nil, activeKind: activeKind, activeTo: activeTo, proposedWeekDays: []
            )
        }
        // 计划调整是付费能力（FR-SUB1 修订）：免费态把提案与预览一起藏起来，只留一个「有一条建议」的
        // 预告位。**已采纳记录的撤销入口照常留着**——用户对已经生效在自己计划上的改动必须始终能撤回
        //（§1.4 用户保留控制权），那不是付费能力，是控制权。
        guard paidCoach.allows(.planAdjustment) else {
            return PlanAdjustmentState(
                proposal: nil, activeKind: activeKind, activeTo: activeTo,
                proposedWeekDays: [], hasHiddenProposal: true
            )
        }
        // 提案后本周训练日（同投影口径，weeks:1 取本周；与今日页处方/计划排期同源、不分叉）——
        // 答「影响哪几天」。提案前的完整排期就在调整区下方，故不再重复列 before。
        let proposed = PlanWeekProjection.weeks(
            splitType: input.program.splitType, daysPerWeek: proposal.toDaysPerWeek,
            completedSessionCount: projectionRotationBase(input: input, appData: appData), weeks: 1
        ).first ?? []
        return PlanAdjustmentState(
            proposal: proposal,
            activeKind: activeKind,
            activeTo: activeTo,
            proposedWeekDays: proposed
        )
    }

    /// 周期化开关当前持久态（设置页开关初值）；unreadable/缺失 → false（默认关）。
    nonisolated static func loadMesocycleEnabled() -> Bool {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return false }
        return appData.mesocycle.enabled
    }

    /// 每周循环模式当前持久态（设置页开关初值）；unreadable/缺失 → false（顺延默认）。
    nonisolated static func loadWeeklyCycleRestart() -> Bool {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return false }
        return appData.weeklyCycleRestart
    }

    // MARK: - FR-PL6 计划编辑器上下文 / 影响（计划编辑器只读派生）

    /// 编辑器起点：某训练日当前的动作清单（自定义优先，否则默认模板）+ 是否已自定义 + 器械场景
    /// + 教练默认日序（「恢复默认」的暂存目标与置灰判断基线，2026-07-20 撤销/恢复批）。
    struct DayEditorContext: Equatable {
        let dayCode: String
        let currentExerciseIds: [String]
        let isCustomized: Bool
        let equipmentScenario: String?
        let defaultExerciseIds: [String]
    }

    nonisolated static func loadDayEditorContext(dayCode: String, now: Date = Date()) -> DayEditorContext? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX"); fmt.timeZone = .current; fmt.dateFormat = "yyyy-MM-dd"
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: fmt.string(from: now)) else { return nil }
        let scenario = input.profile.equipmentScenario
        // 纯模板默认（不含自定义）——编辑起点兜底 + 恢复默认的暂存目标（TodayPrescriptionEngine 注释明示）。
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(dayCode: dayCode, equipmentScenario: scenario)
        if let day = appData.planCustomization?.dayPlans[dayCode], !day.exercises.isEmpty {
            return DayEditorContext(dayCode: dayCode, currentExerciseIds: day.exercises.map(\.exerciseId),
                                    isCustomized: true, equipmentScenario: scenario, defaultExerciseIds: defaults)
        }
        return DayEditorContext(dayCode: dayCode, currentExerciseIds: defaults, isCustomized: false,
                                equipmentScenario: scenario, defaultExerciseIds: defaults)
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
            completedSessionCount: projectionRotationBase(input: input, appData: appData), weeks: 1,
            customization: PlanCustomizationBridge.input(from: custom)
        ).first ?? []
        guard !weekDays.isEmpty else { return nil }
        let weekBefore = weekDays.map { resolve($0.dayCode, beforePlans) }
        let weekAfter = weekDays.map { resolve($0.dayCode, afterPlans) }
        return PlanCustomizationImpact.compute(weekBefore: weekBefore, weekAfter: weekAfter)
    }

    // MARK: - FR-PL7②/③ 训练日编排编辑器上下文

    /// 顺序编辑器起点：当前有效训练日序（自定义优先、否则默认）+ 是否已自定义日序 + 分化 + 已完成场次。
    /// completedSessionCount 供编辑器实时算「下一个训练日将变为 X」（轮转锚定完成场次）。
    struct DaySequenceContext: Equatable {
        let dayCodes: [String]          // 当前顺序（编辑器 seed）
        let defaultDayCodes: [String]   // 教练默认日序（2026-07-20 操作区批：恢复默认的暂存目标 + 置灰基线）
        let isCustomized: Bool          // 是否已存在自定义日序（采纳收敛 applyResolution 输入）
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
        // 当前有效序与引擎同口径（resolvedDaySequence：合法自由日序用 override，否则默认）
        // → 编辑器永不与排期分叉。
        let current = TodayPrescriptionEngine.resolvedDaySequence(splitType: split, override: override)
        guard !current.isEmpty else { return nil }
        // isCustomized：合法 override 且**内容确实异于默认**才算已自定义。脏 override 与
        // 等于默认的冗余值都不算（同引擎 public seam，测试锁边界）。
        let defaults = TodayPrescriptionEngine.defaultDaySequence(splitType: split)
        let isCustomized = TodayPrescriptionEngine.isCustomizedDaySequence(
            splitType: split,
            override: override
        )
        return DaySequenceContext(dayCodes: current, defaultDayCodes: defaults, isCustomized: isCustomized,
                                  splitType: split, completedSessionCount: projectionRotationBase(input: input, appData: appData))
    }


    /// 投影轮换基数（审查 S2 单一真源）：与今日页 dayCode 同源——含回归重启/weekly 模式。
    nonisolated private static func projectionRotationBase(
        input: CleanTrainingDecisionInput, appData: AppData
    ) -> Int {
        TodayPrescriptionEngine.rotationBase(
            input: input, verdict: TodayVerdictEngine.evaluate(input),
            rotationOffset: appData.rotationOffset,
            weeklyCycleRestart: appData.weeklyCycleRestart)
    }

    // MARK: - FR-NT1/2 通知偏好 + 授权

    /// 读当前通知偏好（设置开关初值；缺=关）。
    nonisolated static func loadNotificationPreferences() -> (restEnd: Bool, weekly: Bool, comeback: Bool) {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return (false, false, true) }
        return (appData.notificationRestEndEnabled, appData.notificationWeeklyEnabled,
                appData.notificationComebackEnabled)
    }

    /// FR-NT3 召回输入（批次 F，审查 M-1 瘦身）：只做一次轻量读盘取上次训练日 +
    /// 全历史开始时刻（typicalHour 用）。下一训练日名不在此复算——今日引擎刚在
    /// loadToday 里算过，直接读 todayOutcome.scheduledDayCode（单一真源 + 不进主线程重跑）。
    nonisolated static func loadComebackInputs() -> (lastISO: String?, startISOs: [String]) {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return (nil, []) }
        let sessions = appData.history.filter { $0.completed == true }
        return (sessions.compactMap(\.date).max(), sessions.compactMap(\.startedAt))
    }

    /// 刷新通知缓存（rest-begin 调度用，避免每组读盘）：loadToday + 保存偏好后调用。
    /// 顺带按当前偏好重注册每周提醒（幂等；偏好/语言变更后保持系统侧一致）。
    private func refreshNotificationCache() {
        let prefs = SessionStore.loadNotificationPreferences()
        notifRestEndEnabled = prefs.restEnd
        notifWeeklyEnabled = prefs.weekly
        notifComebackEnabled = prefs.comeback
        var locale = RedeLocale.resolve(fromLanguageCode: Locale.current.language.languageCode?.identifier)
        if let raw = SessionStore.loadPreferences().locale, let persisted = RedeLocale(rawValue: raw) { locale = persisted }
        notifLocale = locale
        syncWeeklyReminders()
        syncComebackReminders()
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

    /// FR-NT3 召回提醒重排（批次 F）：练完/启动/偏好变更都经 refreshNotificationCache 到这。
    /// 空计划（关/无历史/全过期）也调 replaceComeback([])——把旧 pending 清干净（幂等）。
    private func syncComebackReminders() {
        let prefs = NotificationPreferences(
            masterEnabled: true, restEndEnabled: notifRestEndEnabled,
            weeklyEnabled: notifWeeklyEnabled, comebackEnabled: notifComebackEnabled)
        let inputs = SessionStore.loadComebackInputs()
        // 日名取今日引擎现成结果（审查 M-1：不在主线程重跑整套裁决/处方）；
        // 仅顺延模式给（weekly 模式 5 天后可能跨周重置、投影会过期——退化通用标题）；
        // todayOutcome 未就绪（偏好保存早于进今日页）同样退化，安全。
        var dayName: String? = nil
        if case .ready(let model)? = todayOutcome, !model.weeklyCycleRestart,
           let code = model.scheduledDayCode {
            dayName = RedeStrings(locale: notifLocale).trainingDayName(code)
        }
        let reminders = ComebackReminderPolicy.comebackReminders(
            preferences: prefs, lastSessionISO: inputs.lastISO,
            sessionStartISOs: inputs.startISOs, nextDayName: dayName, now: Date())
        let strings = RedeStrings(locale: notifLocale)
        notificationScheduler.replaceComeback(reminders.map { reminder in
            ResolvedComebackReminder(
                id: reminder.reminderId, fireAt: reminder.fireAt,
                title: strings.comebackTitle(code: reminder.messageCode, dayName: reminder.dayName),
                body: strings.comebackBody(code: reminder.messageCode))
        })
    }

    /// 请求系统通知授权（价值先行：在用户首次开开关时调）。返回是否获授权。
    func requestNotificationAuthorization() async -> Bool {
        await notificationScheduler.requestAuthorization()
    }

    /// 通知偏好写入：经唯一写闸 open-bag scalar edit；成功后刷新缓存。失败如实置 saveErrorText。
    @discardableResult
    func saveNotificationPreferences(restEndEnabled: Bool, weeklyEnabled: Bool,
                                     comebackEnabled: Bool) async -> Bool {
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
                try writer.applyNotificationPreferences(
                    restEndEnabled: restEndEnabled, weeklyEnabled: weeklyEnabled,
                    comebackEnabled: comebackEnabled)
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

    func saveWeeklyCycleRestart(_ enabled: Bool) async -> Bool {
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
                try writer.applyWeeklyCycleRestartPreference(enabled: enabled)
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

    /// 性别写入（批次 D 2026-07-09）：经写闸 scalar edit；nil = 显式清除（「暂不设置」）。
    /// 只进相对力量标准，失败如实置 settingsSaveErrorText（同 saveWeeklyCycleRestart 模式）。
    func saveSex(_ sex: String?) async -> Bool {
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
                try writer.applySexPreference(sex: sex)
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

    /// FR-SE7 身体部位筛查：复用 canonical 写闸；成功后重载 Today，让同一设置会话
    /// 关闭后立刻看到处方的暂停进阶结果。
    func saveInjuryFlags(_ flags: [String]) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        settingsSaveErrorText = nil
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
                try writer.applyInjuryFlags(flags)
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
            settingsSaveErrorText = String(describing: error)
            return false
        }
    }

    // MARK: - FR-PL3/4 计划频率调整 采纳 / 回滚

    /// 采纳频率调整（FR-PL3）：经写闸同步 program/profile 天数 + append history → 重载今日。
    /// 失败如实置 planSaveErrorText 返 false（计划页专属错误面，隔离于全局）。isSaving 互斥（同写闸单调用方合同）。
    @discardableResult
    func applyFrequencyAdjustment(
        kind: PlanAdjustmentProposal.Kind,
        fromDaysPerWeek: Int,
        toDaysPerWeek: Int
    ) async -> Bool {
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
                try writer.applyFrequencyAdjustment(
                    kind: kind.rawValue,
                    fromDaysPerWeek: fromDaysPerWeek,
                    toDaysPerWeek: toDaysPerWeek
                )
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

    /// 计划调整提案「暂不」（FR-PL3；2026-08-16 落库）。内存里先藏（本会话立刻消失），
    /// 再把本周键写进 dismiss 账本——重启后由 PlanProposalDismissalPolicy 决定还出不出。
    @discardableResult
    func dismissPlanProposal(_ proposal: PlanAdjustmentProposal, now: Date = Date()) async -> Bool {
        snoozePlanProposal(proposal.kind)
        let key = PlanProposalDismissalPolicy.weekKey(proposal, weekStartISO: WeekAnchor.isoWeekStart(now))
        return await performPlanWrite { _ = try $0.applyCoachActionDismissal(actionKey: key) }
    }

    /// 回滚最近一层计划调整（FR-PL4）：经写闸同步恢复该层 before + pop history → 重载今日。
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
                // 改回原计划 = 明确否决该方向（2026-08-16 落库）：回滚后引擎多半立刻又会提同一条，
                // 在同一次写闸里把否决键写进去，直到证据变了才再提。读的是回滚后的最新 canonical。
                if let rolledBack = try JSONFileAppDataStore(fileURL: fileURL).load(),
                   let candidate = SessionStore.planAdjustmentCandidate(from: rolledBack, now: Date(), timeZone: .current) {
                    _ = try writer.applyCoachActionDismissal(actionKey: PlanProposalDismissalPolicy.vetoKey(candidate))
                }
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

    /// FR-TR6「只换这次」：把 originalId 只在**今天**临时换成 actualId（带今日日期落库；次日自动失效）。
    /// 写时顺手清掉非今天的陈旧临时项（写闸内）。catalog/同族合法性由调用方（换动作 UI）已校验。
    @discardableResult
    func applyOneTimeSubstitution(originalId: String, actualId: String) async -> Bool {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX"); fmt.timeZone = .current; fmt.dateFormat = "yyyy-MM-dd"
        let todayISO = fmt.string(from: Date())
        return await performCoachWrite {
            _ = try $0.applyOneTimeSubstitution(originalId: originalId, actualId: actualId, dateISO: todayISO)
        }
    }

    /// 「只换这次」撤销（单步即时）：移除该动作的临时覆盖，回到引擎默认/永久覆盖。
    @discardableResult
    func removeOneTimeSubstitution(originalId: String) async -> Bool {
        await performCoachWrite { _ = try $0.removeOneTimeSubstitution(originalId: originalId) }
    }

    /// FR-TR12「今天换一天练」：把今天的训练日临时改为 dayCode（带今日日期）。轮转偏移的 −1 抵消在这场训练
    /// **完成时**由写闸消费（appendCompletedSession）——所以没练就不会动轮转，撤销也只需清覆盖。
    @discardableResult
    func applyOneTimeDayOverride(dayCode: String) async -> Bool {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX"); fmt.timeZone = .current; fmt.dateFormat = "yyyy-MM-dd"
        let todayISO = fmt.string(from: Date())
        return await performCoachWrite { _ = try $0.applyOneTimeDayOverride(dayCode: dayCode, dateISO: todayISO) }
    }

    /// 「今天换一天练」撤销（单步即时，仅在该场训练完成前有意义）：清掉今天的临时训练日覆盖，回到轮转默认。
    @discardableResult
    func removeOneTimeDayOverride() async -> Bool {
        await performCoachWrite { _ = try $0.removeOneTimeDayOverride() }
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
        let fileURL = planWriteFileURL
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

    /// FR-TR14「练完存回计划」：显示候选只传 sessionId。真正点击时 writer 在同一个
    /// gated mutation 内 load 最新 canonical，resolver 重算 target / 当前有效构成；
    /// 等价即 no-op，不写、不备份、不报成功。确有差异才整日写 exerciseId，并把实际
    /// 写入瞬间的 raw dayPlan 带回作为撤销令牌。
    func saveCompletedSessionPlan(
        sessionId: String,
        now: Date = Date()
    ) async -> CompletedSessionPlanSaveOutcome {
        guard !isSaving else { return .failed }
        isSaving = true
        completedSessionPlanSaveErrorText = nil
        defer { isSaving = false }

        let fileURL = planWriteFileURL
        let result: Result<CompletedSessionPlanWriteResult, Error> = await Task.detached(
            priority: .userInitiated
        ) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                return .success(try writer.compareAndApplyCompletedSessionPlan { latest in
                    Self.completedSessionPlanWriteDecision(
                        from: latest,
                        sessionId: sessionId,
                        now: now
                    )
                })
            } catch {
                return .failure(error)
            }
        }.value

        switch result {
        case .success(let write):
            await loadToday()
            guard write.didWrite else { return .noOp }
            guard let dayCode = write.dayCode else {
                completedSessionPlanSaveErrorText = "completedSessionPlanWriteMissingDayCode"
                return .failed
            }
            completedSessionPlanRevision += 1
            return .saved(CompletedSessionPlanUndoToken(
                sessionId: sessionId,
                dayCode: dayCode,
                rawDayPlan: write.previousDayPlanRaw,
                didCreateDayPlansContainer: write.didCreateDayPlansContainer
            ))
        case .failure(let error):
            completedSessionPlanSaveErrorText = String(describing: error)
            return .failed
        }
    }

    /// FR-TR14 5 秒撤销：raw 节点由写入瞬间捕获，原样写回；nil 表示当时该 dayCode
    /// 键不存在，故只执行 removeCustomDayPlan 同义语义。绝不 typed decode→encode。
    @discardableResult
    func restoreCompletedSessionPlan(_ undo: CompletedSessionPlanUndoToken) async -> Bool {
        let succeeded = await performCompletedSessionPlanWrite {
            _ = try $0.restoreCompletedSessionPlanDayRaw(
                dayCode: undo.dayCode,
                snapshot: undo.rawDayPlan,
                didCreateDayPlansContainer: undo.didCreateDayPlansContainer
            )
        }
        if succeeded { completedSessionPlanRevision += 1 }
        return succeeded
    }

    /// FR-TR14 撤销的窄 gated 包装；事务语义与计划编辑器相同，但错误状态严格归 Today。
    @discardableResult
    private func performCompletedSessionPlanWrite(
        _ mutate: @escaping @Sendable (CanonicalSessionWriter) throws -> Void
    ) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        completedSessionPlanSaveErrorText = nil
        defer { isSaving = false }
        let fileURL = planWriteFileURL
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(),
                    withIntermediateDirectories: true
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
            await loadToday()
            return true
        case .failure(let error):
            completedSessionPlanSaveErrorText = String(describing: error)
            return false
        }
    }

    // MARK: - 云同步落盘（FR-ACC1）

    /// 抢占写入槽位。**检查与置位必须在同一个同步片段内完成。**
    ///
    /// 曾写成「先 await 一个等待函数、返回后再 isSaving = true」——那中间隔着一个
    /// suspension point，MainActor 可以在此调度别的任务进来；后到者看见 isSaving
    /// 仍是 false，于是两个写入者同时进场，而这段代码存在的意义正是不让那发生。
    /// 触发路径不假想：用户占着锁保存时后台同步在等，锁释放的那一刻同步与用户的
    /// 下一次点击会一起冲进来。
    ///
    /// 本方法不含 await，MainActor 保证它整段不可被打断。
    private func tryAcquireWriteSlot() -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        return true
    }

    /// 等到槽位并占住它。返回 false = 超时放弃（此时未占用）。
    ///
    /// 轮询而非 continuation 队列：写入是毫秒级的，撞车窗口极窄，20ms 的粒度足够；
    /// 而 continuation 队列要维护等待者数组，多一份能在 MainActor 上出错的状态。
    private func acquireWriteSlot(maxAttempts: Int) async -> Bool {
        var attempts = 0
        while !tryAcquireWriteSlot() {
            if attempts >= maxAttempts { return false }
            attempts += 1
            try? await Task.sleep(nanoseconds: 20_000_000)
        }
        return true
    }

    /// 云同步合并落盘。**忙时等待，不放弃。**
    ///
    /// 为什么不能沿用其余写路径的 `guard !isSaving else { return false }`：用户点击时
    /// 忙就放弃是对的——用户看到没反应会再点一次。但后台同步背后没有那个人，放弃就是
    /// 静默丢掉一次同步结果，而且界面上完全看不出来。所以这里排队等，等不到才如实失败。
    ///
    /// - Parameter maxWaitAttempts: 等待轮次上限（每轮 20ms）。默认 150 ≈ 3 秒；
    ///   超时按失败处理并写入错误面，绝不假装成功。
    @discardableResult
    func applySyncMerge(mergedStorage: [String: JSONValue], maxWaitAttempts: Int = 150) async -> Bool {
        // 抢占即置位，中间没有 await —— 见 tryAcquireWriteSlot。
        guard await acquireWriteSlot(maxAttempts: maxWaitAttempts) else {
            syncSaveErrorText = "写入繁忙，本次同步未落盘"
            return false
        }
        syncSaveErrorText = nil
        defer { isSaving = false }
        let fileURL = planWriteFileURL
        let result: Result<Void, Error> = await Task.detached(priority: .utility) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                try writer.applySyncMerge(mergedStorage: mergedStorage)
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
            syncSaveErrorText = String(describing: error)
            return false
        }
    }

    /// FR-PL7②/③ 采纳自定义日序。
    @discardableResult
    func applyCustomDaySequence(_ sequence: [String]) async -> Bool {
        await performPlanWrite { _ = try $0.applyCustomDaySequence(sequence) }
    }

    /// FR-PL7②/③ 恢复默认日序。
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
        guard flow == nil, pendingDraft == nil, let draft = draftStore.load() else { return }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        if draft.isRestorable(todayISO: formatter.string(from: Date())) {
            pendingDraft = draft
        } else {
            draftStore.clear()
        }
    }

    func restorePendingDraft() {
        guard let draft = pendingDraft else { return }
        pendingDraft = nil
        guard let restored = draft.restoreFlow(allowedEquipment: allowedEquipment, loadUnit: loadUnit) else {
            // 重放失败（如 catalog 漂移）：宁可不恢复，清掉过期 draft
            draftStore.clear()
            return
        }
        flow = restored
        sessionStartedAt = draft.startedAt
        // 跨进程恢复不留旧 deadline（FR-TR9 最小恢复）：若恢复到休息态，按计划秒数
        // 重新计时；否则清空。重排休息提醒与 apply(.logSet) 路径对齐（批次 Task 6
        // 2026-07-04：此前恢复后锁屏收不到休息结束提醒）；偏好关闭时策略层返回 nil 不排。
        if restored.phase == .resting {
            restCountdown.begin(seconds: restored.restSecondsPlanned)
            scheduleRestNotification(restSecondsPlanned: restored.restSecondsPlanned)
            beginRestActivity(endpoint: "draft-restore")   // K6：恢复到休息态重挂视觉层
        } else {
            restCountdown.clear()
            restLiveActivity.end(endpoint: "draft-restore-nonresting")
        }
    }

    func discardPendingDraft() {
        pendingDraft = nil
        draftStore.clear()
        // 放弃 = 训练废弃，旧进程在休息开始时排的 rest-end 提醒必然过期——撤掉，
        // 防「已放弃还弹休息结束」（Task 6 审查捞出的姊妹缺口）。「暂不」分支有意
        // 不撤：draft 仍在、用户可能随即恢复，语义归 owner 后续拍板。
        cancelRestNotification()
        restLiveActivity.end(endpoint: "draft-discard")   // K6：孤儿视觉层同撤（launch-cleanup 之外的兜底）
    }

    /// 事件包装：转移 + 即时 draft 留存（每个动作后都可恢复）。
    /// restCompletedNaturally=true：休息倒计时自然归零（前台 runRestTimer 推进）——**不取消**已排程的
    /// 休息提醒，让它此刻送达（前台经 delegate 呈现 / 后台系统送达）。手动「下一组」提前结束或收尾才取消。
    func apply(_ event: TrainFlowEvent, restCompletedNaturally: Bool = false) {
        guard flow != nil else { return }
        _ = reduce(event)
        syncRestCountdown(after: event, restCompletedNaturally: restCompletedNaturally)
        enqueueDraftSave()
        // 重推由 flow 的 didSet 负责——reduce 改了 flow，推送自然跟上。
        // 于是「表记一组 → 手机推下一组 → 表显示下一组」自动闭环。
    }

    /// FR-TR14 的持久化提交：仅允许本次顺序 / 动作 / 组数编辑。
    /// reducer 接受且同步 draft 保存成功才提交；任何失败都恢复逐字段完全相同的 flow。
    @discardableResult
    func applyDurably(_ event: TrainFlowEvent) -> Bool {
        switch event {
        case .moveExerciseToCurrent, .addExercise, .removeExercise, .adjustRemainingSets:
            break
        default:
            return false
        }
        guard let before = flow else { return false }
        guard reduce(event) else {
            flow = before
            return false
        }
        guard saveDraftDurably() else {
            flow = before
            return false
        }
        return true
    }

    /// FR-TR14 S2 任务型 picker：只暴露当前器械白名单内、且本场尚未排入的目录动作。
    var sessionEditCandidates: [ExerciseCatalogEntry] {
        guard let flow, todayModel != nil else { return [] }
        return SessionExerciseEditPlanner.availableExercises(
            sessionPlan: flow.plan,
            allowedEquipment: flow.sessionAllowedEquipment
        )
    }

    /// 事件创建时一次性解析完整会话计划 payload；draft replay 只重放 payload，
    /// 不再查询可能变化的 canonical 历史。
    func makeSessionEditExercisePlan(exerciseId: String) -> ExerciseSetPlan? {
        guard let flow, let sessions = todayModel?.cleanView.sessions else { return nil }
        return SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: exerciseId,
            sessionPlan: flow.plan,
            currentExerciseIndex: flow.exerciseIndex,
            sessions: sessions,
            allowedEquipment: flow.sessionAllowedEquipment,
            loadUnit: flow.sessionLoadUnit
        )
    }

    /// TrainFlowEvent → reducer 的唯一 app 层接线。返回值只表示 typed event 是否被接受。
    @discardableResult
    private func reduce(_ event: TrainFlowEvent) -> Bool {
        guard flow != nil else { return false }
        let eventCountBefore = flow?.events.count ?? 0
        switch event {
        case .logSet(let obs): flow?.logSet(obs)
        case .restFinished: flow?.restFinished()
        case .skipSet(let reason): flow?.skipSet(reason: reason)
        case .skipExercise(let reason): flow?.skipExercise(reason: reason)
        case .replaceExercise(let id): flow?.replaceCurrentExercise(with: id)
        case .moveExerciseToCurrent(let id): flow?.moveExerciseToCurrent(id)
        case .addExercise(let plan): flow?.addExercise(plan)
        case .removeExercise(let removal): flow?.removeExercise(removal)
        case .adjustRemainingSets(let delta): flow?.adjustRemainingSets(delta)
        case .reportPain: flow?.reportPain()
        case .toggleHold: flow?.toggleHold()
        case .requestFinish: flow?.requestFinish()
        case .keepTraining: flow?.keepTraining()
        case .confirmEnd(let reason): flow?.confirmEnd(reason: reason)
        }
        return flow?.events.count == eventCountBefore + 1 && flow?.events.last == event
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
        if !restCountdown.isPaused {
            scheduleRestNotification(restSecondsPlanned: restCountdown.remaining())
            // K6：视觉层结束点同步推后（与通知同一新锚点）；暂停中无活动、恢复时重挂
            if let end = restCountdown.endDate { restLiveActivity.updateEnd(endsAt: end, endpoint: "add-time") }
        }
    }
    /// 暂停 / 继续切换。暂停撤回待发提醒（别在暂停期间弹）；继续按剩余重排（审查 MAJOR-1）。
    func toggleRestPause() {
        restCountdown.togglePause()
        if restCountdown.isPaused {
            cancelRestNotification()
            // K6：Live Activity 原生倒计时不支持「冻结」语义——暂停期先收掉（诚实，
            // 不显示一个还在走的假倒计时），继续时按新锚点重挂。
            restLiveActivity.end(endpoint: "pause")
        } else {
            scheduleRestNotification(restSecondsPlanned: restCountdown.remaining())
            beginRestActivity(endpoint: "resume")
        }
    }

    /// 事件落定后同步倒计时锚点。进入 resting（仅 logSet 一条路）= 开新休息；
    /// restFinished 或落到 summary = 结束清空；confirmEnd↔resting 折返（结束确认弹层
    /// 取消后继续训练）期间不动锚点，故剩余随墙钟延续、不会重置。
    private func syncRestCountdown(after event: TrainFlowEvent, restCompletedNaturally: Bool = false) {
        guard let flow else {
            restCountdown.clear()
            cancelRestNotification()
            restLiveActivity.end(endpoint: "flow-missing")   // K6：无流必无休息视觉层
            return
        }
        switch event {
        case .logSet where flow.phase == .resting:
            restCountdown.begin(seconds: flow.restSecondsPlanned)
            scheduleRestNotification(restSecondsPlanned: flow.restSecondsPlanned)
            beginRestActivity(endpoint: "rest-begin")   // K6：休息开始挂视觉层（begin 挂点）
        case .restFinished:
            restCountdown.clear()
            // 自然到点：不取消——通知正该此刻送达。仅手动提前结束才取消待发提醒（避免训练已推进还弹）。
            if !restCompletedNaturally { cancelRestNotification() }
            restLiveActivity.end(endpoint: "rest-finished")   // K6：记组/下一组推进即收（clear 挂点）
        default:
            if flow.phase == .summary {
                restCountdown.clear()
                cancelRestNotification()
                restLiveActivity.end(endpoint: "session-summary")   // K6：落到收尾页即收
            }
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

    // MARK: - K6 休息计时 Live Activity（视觉层；到点提醒仍归上面的 G1 通知）

    /// 从当前倒计时锚点 + 流构建并挂起/更新 Live Activity。锚点缺失（异常）不起——诚实。
    private func beginRestActivity(endpoint: String) {
        guard let end = restCountdown.endDate, let attributes = restActivityAttributes() else { return }
        restLiveActivity.begin(attributes: attributes, endsAt: end, endpoint: endpoint)
    }

    /// Live Activity 静态属性（动作名 + 下一组目标串）。取数与训练页休息态 restPreviewText
    /// 同源：当前动作还有组 → 下一组推荐目标；组满 → 下一动作首组计划目标；无下一动作 →
    /// 只显动作名（不编数据）。格式化（目录名/档位吸附/单位）全在 app 侧完成——
    /// extension 零业务计算（红线）。语言沿通知同一缓存（notifLocale）。
    private func restActivityAttributes() -> RestActivityAttributes? {
        guard let flow, let current = flow.currentExercise else { return nil }
        let strings = RedeStrings(
            locale: notifLocale,
            unit: RedeUnit.resolve(todayModel?.cleanView.profile.unitSystem))
        let catalog = ExerciseCatalog.minimal
        let exerciseDone = flow.completedInCurrentExercise.count + flow.skippedInCurrentExercise >= current.sets.count
        if !exerciseDone, let rec = flow.currentRecommendation {
            return RestActivityAttributes(
                exerciseName: catalog.displayName(current.exerciseId, localeCode: notifLocale.rawValue),
                targetLine: strings.targetLine(
                    loadType: current.loadType,
                    weightKg: rec.targetWeightKg,
                    reps: rec.targetReps))
        }
        // 组满休息 → 预告下一动作（同 restPreviewText 分支）；目标取其首组计划值
        if flow.plan.exercises.indices.contains(flow.exerciseIndex + 1) {
            let next = flow.plan.exercises[flow.exerciseIndex + 1]
            let target = next.sets.first.map { first in
                strings.targetLine(
                    loadType: next.loadType,
                    weightKg: first.targetWeightKg,
                    reps: first.targetReps)
            } ?? ""
            return RestActivityAttributes(
                exerciseName: catalog.displayName(next.exerciseId, localeCode: notifLocale.rawValue),
                targetLine: target)
        }
        return RestActivityAttributes(
            exerciseName: catalog.displayName(current.exerciseId, localeCode: notifLocale.rawValue),
            targetLine: "")
    }

    private func currentDraft() -> TrainSessionDraft? {
        guard let flow, flow.phase != .summary else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return TrainSessionDraft(
            dateISO: formatter.string(from: sessionStartedAt ?? Date()),
            startedAt: sessionStartedAt ?? Date(),
            prescription: flow.prescription,
            events: flow.events,
            catalogVersion: ExerciseCatalog.minimal.catalogVersion,
            sessionAllowedEquipment: flow.sessionAllowedEquipment,
            sessionLoadUnit: flow.sessionLoadUnit
        )
    }

    /// 普通训练事件只排队，UI 不等待文件 IO；失败保持 best-effort 语义。
    private func enqueueDraftSave() {
        guard let draft = currentDraft() else { return }
        draftStore.enqueueSave(draft)
    }

    /// 本次训练关键编辑使用：在同一队列等待此前普通写完成，再同步确认最终快照落盘。
    private func saveDraftDurably() -> Bool {
        guard let draft = currentDraft() else { return false }
        return draftStore.saveDurably(draft)
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
        lastSessionOutcome = nil
        // FR-EQ1：换动作候选同守器械白名单
        flow = TrainFlowState(prescription: prescription, allowedEquipment: allowedEquipment, loadUnit: loadUnit)
        sessionStartedAt = now
        restCountdown.clear() // 新会话从 activeSet 起步，旧倒计时不得滞留
        restLiveActivity.end(endpoint: "session-start")   // K6：旧视觉层同不得滞留
        enqueueDraftSave()
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
        restLiveActivity.end(endpoint: "session-end")   // K6：训练结束/放弃即收视觉层（含 abandonActiveSession 路径）
        // draft 写已严格同步有序；清除后不会再有旧异步任务倒灌孤儿草稿。
        draftStore.clear()
    }

    /// 放弃进行中训练（owner 反馈 2026-06-13）：清空流与 draft、不写 canonical——
    /// 与「结束训练→保存并完成」相对，给用户一个「取消、什么都不存」的出口。
    func abandonActiveSession() {
        lastSessionOutcome = "abandoned"   // 先置位再清 flow：flow didSet 那次推送要带给表（HK 会话 discard）
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
            lastSessionOutcome = "completed"   // 表侧 HK 会话在到小结时已按 completed 收；这里只是保持一致
            endSession()
            await loadToday() // 裁决/进展立即反映新记录
            completedSessionCount += 1 // FR-ACC1：练完自动上传的触发信号（只在写盘成功后递增）
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
