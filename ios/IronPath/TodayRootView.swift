// TodayRootView — iOS-17C Plan + Today Read-only Surface V1.
//
// 今日 (Today) tab mount point. Renders a READ-ONLY readiness summary derived
// from the real TrainingDecision engine output, plus an honest entry into 训练.
//
// Data source: the app has no canonical-AppData read path yet (the first native
// write path is the gated iOS-17c slice), so the readiness is computed from the
// SAME deterministic clean-input pipeline the Focus tab already demonstrates —
//   AppData → buildCleanAppDataView → createCleanTrainingDecisionInput
//          → buildTrainingDecisionFromCleanInput → TrainingDecisionCoreSlice
// — never from fabricated engine output. All organization/formatting lives in
// IronPathTrainingDecision.TodayReadinessSummary (pure + unit-tested); this view
// only renders rows. The engine is read, never changed (no golden touched).
//
// W-1: this surface also PUBLISHES a small DERIVED read-only readiness snapshot to
// the App Group for the home-screen widget (a derived share file via the
// IronPathWidgetShared seam — never canonical AppData, never a source of truth,
// §8/§12). See WidgetSnapshotWriterModel.
//
// Training entry: the five-tab shell's selected tab is ContentView-private state,
// and the iOS-17S parallel-line contract forbids editing the shell from a tab
// fill, so this slice does NOT switch tabs programmatically. The CTA honestly
// directs the user to the 训练 tab instead of faking navigation. A real
// cross-tab jump is a follow-up that must be made in the shell-owning slice.
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
import IronPathDomain
import IronPathTrainingDecision

struct TodayRootView: View {
    private let summary = TodayReadinessSummary(
        slice: FocusModePreviewData.sampleCoreSlice(for: .normal),
        todayStatus: TodayStatus(
            date: FocusModePreviewData.referenceDateOnly,
            sleep: "一般",
            energy: "中",
            time: "60",
            soreness: ["无"]
        )
    )

    @State private var showTrainingEntry = false

    // W-1: publishes a small DERIVED read-only readiness snapshot to the App Group
    // for the home-screen widget. It just packs the already-computed `summary`
    // strings — no engine call, and it NEVER writes canonical AppData.
    @StateObject private var widgetWriter = WidgetSnapshotWriterModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                sampleNote
                readinessCard
                statusCard
                startTrainingButton
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        // Honest, self-contained disclosure — no fake tab switch, no data write.
        .alert("前往「训练」", isPresented: $showTrainingEntry) {
            Button("好", role: .cancel) {}
        } message: {
            Text("在底部导航栏点按「训练」即可进入专注训练。今日页为只读概览，不读写训练记录。")
        }
        // W-1: publish a DERIVED read-only readiness snapshot for the home-screen
        // widget (App Group). This writes a small derived share file ONLY — never
        // canonical AppData, never a source of truth (§8/§12). Previews/tests do not
        // opt into a live store, so this is a no-op there.
        .task {
            widgetWriter.activateLiveSinksIfNeeded()
            widgetWriter.publish(
                headline: summary.headline,
                advice: summary.advice,
                rows: summary.decisionRows.map { ($0.label, $0.value) }
            )
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("今日")
                .font(.largeTitle.weight(.semibold))
            Text(summary.headline)
                .font(.title3.weight(.medium))
                .foregroundStyle(.primary)
            Text(summary.advice)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var sampleNote: some View {
        Text("示例准备度：基于确定性样例经训练决策引擎计算。接入真实数据后将显示你的当日概览。")
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var readinessCard: some View {
        card(title: "准备度概览", rows: summary.decisionRows)
    }

    private var statusCard: some View {
        card(title: "今日状态", rows: summary.statusRows)
    }

    private var startTrainingButton: some View {
        Button {
            showTrainingEntry = true
        } label: {
            Text("开始今天的训练")
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .buttonStyle(.borderedProminent)
        .padding(.top, 4)
    }

    private func card(title: String, rows: [SurfaceRow]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            VStack(spacing: 6) {
                ForEach(rows) { row in
                    HStack(alignment: .firstTextBaseline) {
                        Text(row.label)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(row.value)
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

#Preview {
    TodayRootView()
}
