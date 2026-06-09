import SwiftUI

enum RootTab: Hashable {
    case today
    case train
    case progress
    case plan
}

struct RootTabView: View {
    @State private var selection: RootTab

    // 截图/UI 验证钩子: simctl launch ... -initialTab train|progress|plan
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
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch selection {
                case .today:
                    TodayTabView(onStartTraining: { selection = .train })
                case .train:
                    TrainTabView()
                case .progress:
                    ProgressTabView()
                case .plan:
                    PlanTabView(onStartTraining: { selection = .train })
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            RedeTabBar(selection: $selection)
                .background(Color.redeTabBar.ignoresSafeArea(edges: .bottom))
        }
        .background(Color.redeBase.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

#Preview {
    RootTabView()
}
