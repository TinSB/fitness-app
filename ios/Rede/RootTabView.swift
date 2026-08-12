import SwiftUI
import RedeEntitlements
import RedeL10n
import RedeTrainingDecision
import RedeWatchLink

enum RootTab: Hashable {
    case today
    case train
    case progress
    case plan
}

struct RootTabView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var selection: RootTab
    @State private var localeStore: LocaleStore
    @State private var sessionStore = SessionStore()
    /// FR-ACC1 云同步。提到 app 级而非同步页局部：自动同步的两个时机（练完、进 App）
    /// 都在同步页之外，局部持有就只能靠用户手动点，界面上「练完自动上传」会变成假承诺。
    /// 全 app 唯一实例，经 environment 下传——同步页曾各建各的，状态永远对不上。
    @State private var syncService = SyncService()
    @State private var subscriptionModel: SubscriptionModel
    @State private var appUpdateModel: AppUpdateModel
    @State private var progressScrollTarget: ProgressScrollTarget?
    /// M5-1b 首启引导：nil = 未检查（避免首帧闪烁误判）。
    @State private var showOnboarding: Bool?
    /// 截图钩子 -autoOpenSharePreview：用样本数据弹分享卡预览（仅测试脚手架）。
    @State private var sharePreviewSample: SharePreviewItem?

    // 截图/UI 验证钩子: simctl launch ... -initialTab train|progress|plan [-locale zh|en]
    init() {
        let args = ProcessInfo.processInfo.arguments
        var initial: RootTab = .today
        if let idx = args.firstIndex(of: "-initialTab"), args.indices.contains(idx + 1) {
            switch args[idx + 1] {
            case "train": initial = .train
            case "progress": initial = .progress
            case "plan": initial = .plan
            default: break
            }
        }
        _selection = State(initialValue: initial)

        let store = LocaleStore()
        if let idx = args.firstIndex(of: "-locale"), args.indices.contains(idx + 1),
           let forced = RedeLocale(rawValue: args[idx + 1]) {
            store.locale = forced
        }
        _localeStore = State(initialValue: store)
        let subscriptionConfiguration = RedeSubscriptionRuntime.configuration(arguments: args)
        _subscriptionModel = State(initialValue: RedeSubscriptionRuntime.makeModel(
            configuration: subscriptionConfiguration,
            arguments: args
        ))
        _appUpdateModel = State(initialValue: RedeAppUpdateRuntime.makeModel(arguments: args))
    }

    var body: some View {
        // 动效方向样例（临时脚手架）：-motionSample 直接进对比页，不走正常 tab 结构。
        if ProcessInfo.processInfo.arguments.contains("-motionSample") {
            return AnyView(MotionSampleView().environment(localeStore))
        }
        return AnyView(mainBody)
    }

    private var mainBody: some View {
        ZStack(alignment: .bottom) {
            // 启动时序竞态修复（2026-06-10 模拟器实证）：持久化语言偏好异步应用，
            // 但 iOS 弹窗（如恢复训练 alert）一旦呈现就冻结文案——内容必须等
            // 偏好应用完成（showOnboarding 从 nil 落定）才渲染，期间纯 redeBase
            // 与启动屏无缝衔接。普通视图本可反应式刷新，但「首帧闪错语言」一并消除。
            if showOnboarding != nil {
            Group {
                switch selection {
                case .today:
                    TodayTabView(onStartTraining: {
                        Task {
                            // 已有会话（含刚恢复的 draft）直接进训练页，不重开
                            if sessionStore.flow == nil {
                                await sessionStore.startSessionLoadingIfNeeded()
                            }
                            selection = .train
                        }
                    }, onReviewData: {
                        progressScrollTarget = .dataQuality
                        selection = .progress
                    }, // FR-T5/FR-SUB3 修数据「去核对」→ 进展页数据质量区
                       onViewProgress: {
                           progressScrollTarget = nil
                           selection = .progress
                       },
                       onGoPlan: { selection = .plan })          // K3「下一场」行 → 计划页
                case .train:
                    TrainTabView(onGoToday: { selection = .today })
                case .progress:
                    // M2 空态承接：空态主按钮回今日（与 Train/Plan 空态同口径）
                    ProgressTabView(
                        onGoToday: { selection = .today },
                        scrollTarget: $progressScrollTarget
                    )
                case .plan:
                    // FR-PL1：占位页动作 = 回今日（每天的安排由今日页给出）
                    PlanTabView(onGoToday: { selection = .today })
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // 2026-08-07 tab bar 改悬浮后，这里原本垫的整条 redeTabBar 背板成了残留黑块——
            // 悬浮块自带锻面与圆角，底下不需要任何背板，内容就该从它两侧和下方透出来。
            RedeTabBar(selection: $selection)
            }

            // M5-1b 首启引导（FR-ON1）：合法空文档才出现；unreadable 绝不进引导。
            if showOnboarding == true {
                OnboardingView(onFinish: {
                    showOnboarding = false
                    selection = .today
                })
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.redeBase.ignoresSafeArea())
            }
        }
        // §12.2 整面板：base 自身的锻面颗粒（≈1%，hero 铭牌颗粒仍 1.5% 专属更密）
        .background {
            ZStack {
                Color.redeBase
                ForgedGrain(intensity: 0.33)
            }
            .ignoresSafeArea()
        }
        .task {
            // M5-2：启动读取持久化偏好（单位/语言）；-locale/-unit 启动参数优先（截图钩子）。
            // -locale 已在 init() 注入 store——此处传 nil 表示「不再用磁盘值覆盖」（顺序依赖，勿移）。
            // 偏好必须先于 showOnboarding 落定：内容（含可能立刻弹出的恢复训练 alert）
            // 以 showOnboarding != nil 为渲染闸，保证首个弹窗已是持久化语言。
            let args = ProcessInfo.processInfo.arguments
            let prefs = await Task.detached { SessionStore.loadPreferences() }.value
            let unitForced = args.firstIndex(of: "-unit").flatMap { idx -> String? in
                args.indices.contains(idx + 1) ? args[idx + 1] : nil
            }
            // 切片 2（2026-08-12）：手表通道在 App 启动即激活。
            // 手机侧不做界面——ping 自动回 pong，表上看到「← pong」就等于证明手机
            // 确实收到并回了；一个 pong 不可能凭空出现。
            WatchLink.shared.onReceive = { envelope, _ in
                guard envelope.kind == WatchLinkKind.ping else { return }   // 未知 kind 安静丢弃（向前兼容）
                WatchLink.shared.send(
                    WatchLinkEnvelope(kind: WatchLinkKind.pong,
                                      sentAtISO: ISO8601DateFormatter().string(from: Date()),
                                      body: ["from": "phone"]),
                    // 回 pong 走 userInfo 而不是 message：**它不要求对端可达**，
                    // 这正是选它的理由。而且这就是切片 4 记组要用的通道，先把它验通更有价值。
                    // （实测：模拟器里用 simctl 直装表 app，手机侧 WCSession 会报
                    //  counterpart app not installed / reachable: NO，message 通道被守卫正确跳过。）
                    via: .userInfo)
            }
            WatchLink.shared.activate()

            let localePreApplied = args.contains("-locale")
            localeStore.applyPersisted(
                unitRaw: unitForced ?? prefs.unit,
                localeRaw: localePreApplied ? nil : prefs.locale
            )
            // 截图钩子 -forceOnboarding；-skipOnboarding 供既有自动化钩子绕过
            if args.contains("-forceOnboarding") {
                showOnboarding = true
            } else if args.contains("-skipOnboarding") {
                showOnboarding = false
            } else {
                showOnboarding = await Task.detached { SessionStore.needsOnboarding() }.value
            }

            // FR-SE10：首次安装不把当前版本冒充“更新”；已有用户升级后只展示一次
            // 内置 What's New。公开版本检查失败不影响首启与训练，自动检查按 24h 节流。
            let isFirstInstall = showOnboarding == true
            appUpdateModel.prepareWhatsNew(isFirstInstall: isFirstInstall)
            if !isFirstInstall {
                await appUpdateModel.checkAutomatically()
            }
            // 截图钩子：用样本分享卡数据直接弹预览（验证卡片渲染，不必跑完整训练流）。
            if args.contains("-autoOpenSharePreview") {
                sharePreviewSample = SharePreviewItem(snapshots: ShareCardSample.snapshots)
            }
        }
        .sheet(item: $sharePreviewSample) { item in
            ShareCardPreviewView(snapshots: item.snapshots)
        }
        // 截图/UI 验证钩子（仅测试脚手架）:
        // -autoStartSession 直接载入今日并开训；
        // -autoCompleteSession 自动按建议打满全部组并落盘（验证杀进程重开记录还在）；
        // -autoPartialSession 开训并只打 1 组（draft 留存，验证恢复提示）；
        // -autoAdvanceExercises N 开训并打满前 N 个动作（落在第 N+1 个动作，验证今日页橙色条跟随进度）。
        .task {
            let args = ProcessInfo.processInfo.arguments
            let preparesSaveToPlan = args.contains("-autoPrepareSaveToPlan")
            let savesToPlan = args.contains("-autoSaveSessionToPlan")
            let advanceTarget = args.firstIndex(of: "-autoAdvanceExercises").flatMap { idx -> Int? in
                args.indices.contains(idx + 1) ? Int(args[idx + 1]) : nil
            }
            if args.contains("-autoStartSession")
                || args.contains("-autoCompleteSession")
                || args.contains("-autoPartialSession")
                || preparesSaveToPlan
                || savesToPlan
                || advanceTarget != nil {
                await sessionStore.loadToday()
                sessionStore.startSession()
            }
            // FR-TR14 Simulator 验证脚手架：经真实会话编辑 seam 加入一个该日默认未排动作、
            // 移除一个未来动作，覆盖最长「加+删」事实句；再由下方同一完成/落盘路径生成候选。
            // 只在显式 launch argument 下生效，不在 Train 增加任何入口。
            if preparesSaveToPlan || savesToPlan,
               let exerciseId = sessionStore.sessionEditCandidates.first?.id,
               let addition = sessionStore.makeSessionEditExercisePlan(exerciseId: exerciseId) {
                _ = sessionStore.applyDurably(.addExercise(addition))
            }
            if preparesSaveToPlan || savesToPlan,
               let flow = sessionStore.flow,
               let removal = flow.removal(at: flow.plan.exercises.count - 1) {
                _ = sessionStore.applyDurably(.removeExercise(removal))
            }
            if let target = advanceTarget {
                var guardCounter = 0 // 防御：异常状态下不空转
                while let flow = sessionStore.flow, flow.phase != .summary,
                      flow.exerciseIndex < target, guardCounter < 500 {
                    guardCounter += 1
                    switch flow.phase {
                    case .activeSet:
                        let rec = flow.currentRecommendation
                        sessionStore.apply(.logSet(CompletedSetObservation(
                            weightKg: rec?.targetWeightKg ?? 0,
                            reps: rec?.targetReps ?? 1,
                            rir: rec?.targetRir ?? 2,
                            painReported: false
                        )))
                    case .resting:
                        sessionStore.apply(.restFinished, restCompletedNaturally: true)
                    default:
                        break
                    }
                }
            }
            if args.contains("-autoPartialSession") {
                let rec = sessionStore.flow?.currentRecommendation
                sessionStore.apply(.logSet(CompletedSetObservation(
                    weightKg: rec?.targetWeightKg ?? 0,
                    reps: rec?.targetReps ?? 1,
                    rir: rec?.targetRir ?? 2,
                    painReported: false
                )))
            }
            if args.contains("-autoCompleteSession") || preparesSaveToPlan || savesToPlan {
                var guardCounter = 0 // 防御：异常状态下不空转（计划为空等）
                while let flow = sessionStore.flow, flow.phase != .summary, guardCounter < 500 {
                    guardCounter += 1
                    switch flow.phase {
                    case .activeSet:
                        let rec = flow.currentRecommendation
                        sessionStore.apply(.logSet(CompletedSetObservation(
                            weightKg: rec?.targetWeightKg ?? 0,
                            reps: rec?.targetReps ?? 1,
                            rir: rec?.targetRir ?? 2,
                            painReported: false
                        )))
                    case .resting:
                        sessionStore.apply(.restFinished, restCompletedNaturally: true)
                    default:
                        break
                    }
                }
                _ = await sessionStore.completeAndPersistSession()
                selection = .today
            }
        }
        .task {
            // FR-ACC1：同步服务随 app 起，未登录时它什么都不做（syncNow 自身 guard）。
            syncService.attach(sessionStore)
            await syncService.refreshSignedInState()
            await syncService.syncNow()
            // FR-SUB2：进程生命周期监听必须在任何购买展示前启动。StoreKit
            // 查询失败只影响订阅状态，绝不阻塞首启、训练或 canonical 数据。
            await subscriptionModel.start()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task {
                await subscriptionModel.refresh()
                if showOnboarding == false {
                    await appUpdateModel.checkAutomatically()
                }
                // ② 进 App 时自动取回。未登录时 syncNow 自身 guard 掉，不发任何请求。
                await syncService.syncNow()
            }
        }
        // ① 练完自动上传。以「已落盘的完成场次数」为触发信号——它只在
        // completeAndPersistSession 真正写盘成功后才变，失败不会误触发同步。
        .onChange(of: sessionStore.completedSessionCount) { _, _ in
            Task { await syncService.syncNow() }
        }
        .environment(localeStore)
        .environment(sessionStore)
        .environment(syncService)
        .environment(subscriptionModel)
        .environment(appUpdateModel)
        .preferredColorScheme(.dark)
    }
}

#Preview {
    RootTabView()
}
