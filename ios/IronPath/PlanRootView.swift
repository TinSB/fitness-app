// PlanRootView — iOS-17S Tab Shell Scaffold V1.
//
// 计划 (Plan) tab mount point. Placeholder empty state only — this slice ships
// no business surface here. A future parallel line will replace the body with
// the real plan surface (mesocycle / phase / per-day schedule).
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

struct PlanRootView: View {
    @State private var showRoadmap = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("计划")
                    .font(.largeTitle.weight(.semibold))
                Text("这里将展示你的训练计划与周期安排。功能开发中。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Button {
                showRoadmap = true
            } label: {
                Text("了解即将上线的内容")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)

            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(.systemBackground).ignoresSafeArea())
        // Honest, self-contained disclosure — no fake success, no data access.
        .alert("计划 · 开发中", isPresented: $showRoadmap) {
            Button("好", role: .cancel) {}
        } message: {
            Text("计划页将展示训练计划、周期与每日安排。当前为占位空态，不读写任何数据。")
        }
    }
}

#Preview {
    PlanRootView()
}
