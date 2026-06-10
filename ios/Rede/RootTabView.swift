import SwiftUI
import RedeL10n

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
                            await sessionStore.startSessionLoadingIfNeeded()
                            selection = .train
                        }
                    })
                case .train:
                    TrainTabView(onGoToday: { selection = .today })
                case .progress:
                    ProgressTabView()
                case .plan:
                    PlanTabView(onStartTraining: {
                        Task {
                            await sessionStore.startSessionLoadingIfNeeded()
                            selection = .train
                        }
                    })
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            RedeTabBar(selection: $selection)
                .background(Color.redeTabBar.ignoresSafeArea(edges: .bottom))
        }
        .background(Color.redeBase.ignoresSafeArea())
        // 截图/UI 验证钩子: -autoStartSession 直接载入今日并开训（仅测试脚手架）
        .task {
            if ProcessInfo.processInfo.arguments.contains("-autoStartSession") {
                await sessionStore.loadToday()
                sessionStore.startSession()
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
