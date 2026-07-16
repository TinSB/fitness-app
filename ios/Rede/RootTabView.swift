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
    }

    var body: some View {
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
                    }, onReviewData: { selection = .progress }, // FR-T5 修数据卡「去核对」→ 进展页
                       onGoPlan: { selection = .plan })          // K3「下一场」行 → 计划页
                case .train:
                    TrainTabView(onGoToday: { selection = .today })
                case .progress:
                    // M2 空态承接：空态主按钮回今日（与 Train/Plan 空态同口径）
                    ProgressTabView(onGoToday: { selection = .today })
                case .plan:
                    // FR-PL1：占位页动作 = 回今日（每天的安排由今日页给出）
                    PlanTabView(onGoToday: { selection = .today })
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            RedeTabBar(selection: $selection)
                .background(Color.redeTabBar.ignoresSafeArea(edges: .bottom))
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
            let advanceTarget = args.firstIndex(of: "-autoAdvanceExercises").flatMap { idx -> Int? in
                args.indices.contains(idx + 1) ? Int(args[idx + 1]) : nil
            }
            if args.contains("-autoStartSession") || args.contains("-autoCompleteSession") || args.contains("-autoPartialSession") || advanceTarget != nil {
                await sessionStore.loadToday()
                sessionStore.startSession()
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
                        sessionStore.apply(.restFinished, restCompletedNaturally: true)
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
