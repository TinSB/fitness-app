// TrainingRootView — iOS-17S Tab Shell Scaffold V1.
//
// 训练 (Training) tab mount point. Hosts the existing 专注训练 (Focus Mode)
// shell UNCHANGED: the .plan/.inSession/.completed flow, FocusModeMvpState,
// the real-clock opt-in, loadSavedSessions, per-set capture (iOS-17b), and
// local-snapshot history are exactly as before iOS-17S. This slice only
// relocates that shell under a tab; it adds no behavior of its own.
//
// === iOS-17S Tab Shell Scaffold V1 · parallel-line integration contract ===
// Each *RootView is the SINGLE app-layer mount point for its tab in the
// ContentView TabView shell (今日 / 训练 / 记录 / 计划 / 我的). A parallel line
// fills a tab by replacing ONLY this RootView's body and the package logic it
// renders. Do NOT edit ContentView (the shell), another tab's RootView, or
// project.pbxproj from a tab-fill slice — the shell + pbxproj registration are
// owned by iOS-17S. Keep the app layer thin (master §5/§15/§19.3): no business
// logic, no persistence, no network/cloud/auth/HealthKit/WebView here.

import SwiftUI

struct TrainingRootView: View {
    var body: some View {
        FocusModeShellView()
    }
}

#Preview {
    TrainingRootView()
}
