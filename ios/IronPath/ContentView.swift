// ContentView — iOS-17S Tab Shell Scaffold V1 root.
//
// The app root is a five-tab TabView shell: 今日 / 训练 / 记录 / 计划 / 我的.
// Each tab hosts exactly ONE *RootView — the single app-layer mount point for
// that tab. This shell only wires tabs to their RootViews and chooses the launch
// tab; it holds no business logic, owns no per-tab state, and touches no data.
//
// 训练 hosts the existing 专注训练 (Focus Mode) shell unchanged, so launch
// behavior matches the pre-iOS-17S app (default selection = .training).
//
// Parallel-line contract: a tab is filled by editing its own *RootView, never
// this shell. Do NOT add/reorder tabs, change SF Symbols/labels, or reach into a
// RootView's internals from here (master §5/§15/§19.3 — keep the app layer thin).

import SwiftUI

/// The five top-level navigation destinations. Declaration order = display order.
/// Presentation metadata only (label + SF Symbol); no business logic.
enum AppTab: String, CaseIterable, Identifiable {
    case today
    case training
    case history
    case plan
    case profile

    var id: String { rawValue }

    /// User-facing Chinese label (mobile-first, restrained — master §15.2).
    var title: String {
        switch self {
        case .today: return "今日"
        case .training: return "训练"
        case .history: return "记录"
        case .plan: return "计划"
        case .profile: return "我的"
        }
    }

    /// SF Symbol for the tab item (all available on the iOS 17 deployment target).
    var systemImage: String {
        switch self {
        case .today: return "sun.max"
        case .training: return "figure.strengthtraining.traditional"
        case .history: return "clock.arrow.circlepath"
        case .plan: return "calendar"
        case .profile: return "person.crop.circle"
        }
    }
}

struct ContentView: View {
    // Launch on 训练 so the app still opens into the Focus shell (behavior parity
    // with the pre-tab app). In-RAM UI state only.
    @State private var selection: AppTab = .training

    var body: some View {
        TabView(selection: $selection) {
            TodayRootView()
                .tabItem { Label(AppTab.today.title, systemImage: AppTab.today.systemImage) }
                .tag(AppTab.today)

            TrainingRootView()
                .tabItem { Label(AppTab.training.title, systemImage: AppTab.training.systemImage) }
                .tag(AppTab.training)

            HistoryRootView()
                .tabItem { Label(AppTab.history.title, systemImage: AppTab.history.systemImage) }
                .tag(AppTab.history)

            PlanRootView()
                .tabItem { Label(AppTab.plan.title, systemImage: AppTab.plan.systemImage) }
                .tag(AppTab.plan)

            ProfileRootView()
                .tabItem { Label(AppTab.profile.title, systemImage: AppTab.profile.systemImage) }
                .tag(AppTab.profile)
        }
    }
}

#Preview {
    ContentView()
}
