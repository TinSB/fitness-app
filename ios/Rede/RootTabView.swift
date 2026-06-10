import SwiftUI
import RedeL10n
import RedeTrainingDecision

enum RootTab: Hashable {
    case today
    case train
    case progress
    case plan
}

struct RootTabView: View {
    @State private var selection: RootTab
    @State private var localeStore: LocaleStore
    @State private var sessionStore = SessionStore()
    /// M5-1b 首启引导：nil = 未检查（避免首帧闪烁误判）。
    @State private var showOnboarding: Bool?

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
    }

    var body: some View {
        ZStack(alignment: .bottom) {
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
                    })
                case .train:
                    TrainTabView(onGoToday: { selection = .today })
                case .progress:
                    ProgressTabView()
                case .plan:
                    // FR-PL1：占位页动作 = 回今日（每天的安排由今日页给出）
                    PlanTabView(onGoToday: { selection = .today })
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            RedeTabBar(selection: $selection)
                .background(Color.redeTabBar.ignoresSafeArea(edges: .bottom))

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
        .background(Color.redeBase.ignoresSafeArea())
        .task {
            // 截图钩子 -forceOnboarding；-skipOnboarding 供既有自动化钩子绕过
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-forceOnboarding") {
                showOnboarding = true
            } else if args.contains("-skipOnboarding") {
                showOnboarding = false
            } else {
                showOnboarding = await Task.detached { SessionStore.needsOnboarding() }.value
            }
            // M5-2：启动读取持久化偏好（单位/语言）；-locale/-unit 启动参数优先（截图钩子）。
            // -locale 已在 init() 注入 store——此处传 nil 表示「不再用磁盘值覆盖」（顺序依赖，勿移）。
            let prefs = await Task.detached { SessionStore.loadPreferences() }.value
            let unitForced = args.firstIndex(of: "-unit").flatMap { idx -> String? in
                args.indices.contains(idx + 1) ? args[idx + 1] : nil
            }
            let localePreApplied = args.contains("-locale")
            localeStore.applyPersisted(
                unitRaw: unitForced ?? prefs.unit,
                localeRaw: localePreApplied ? nil : prefs.locale
            )
        }
        // 截图/UI 验证钩子（仅测试脚手架）:
        // -autoStartSession 直接载入今日并开训；
        // -autoCompleteSession 自动按建议打满全部组并落盘（验证杀进程重开记录还在）；
        // -autoPartialSession 开训并只打 1 组（draft 留存，验证恢复提示）。
        .task {
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-autoStartSession") || args.contains("-autoCompleteSession") || args.contains("-autoPartialSession") {
                await sessionStore.loadToday()
                sessionStore.startSession()
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
            if args.contains("-autoCompleteSession") {
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
                        sessionStore.apply(.restFinished)
                    default:
                        break
                    }
                }
                _ = await sessionStore.completeAndPersistSession()
                selection = .today
            }
        }
        .environment(localeStore)
        .environment(sessionStore)
        .preferredColorScheme(.dark)
    }
}

#Preview {
    RootTabView()
}
