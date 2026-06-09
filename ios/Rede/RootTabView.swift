import SwiftUI

enum RootTab: Hashable {
    case today
    case train
    case progress
    case plan
}

struct RootTabView: View {
    @State private var selection: RootTab = .today

    var body: some View {
        TabView(selection: $selection) {
            TodayTabView()
                .tabItem { Label("今日", systemImage: "sun.max.fill") }
                .tag(RootTab.today)
            TrainTabView()
                .tabItem { Label("训练", systemImage: "figure.strengthtraining.traditional") }
                .tag(RootTab.train)
            ProgressTabView()
                .tabItem { Label("进展", systemImage: "chart.line.uptrend.xyaxis") }
                .tag(RootTab.progress)
            PlanTabView(onGoToToday: { selection = .today })
                .tabItem { Label("计划", systemImage: "calendar") }
                .tag(RootTab.plan)
        }
    }
}

#Preview {
    RootTabView()
}
