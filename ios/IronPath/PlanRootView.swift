// PlanRootView — iOS-17C Plan + Today Read-only Surface V1.
//
// 计划 (Plan) tab mount point. Renders a READ-ONLY, restrained view of a
// MesocyclePlan + ProgramTemplate (Domain value types): cycle phase / week count
// / date range, and template goal / split / days-per-week, with the strategy
// detail collapsed (master §15.2 — restrained, collapse metadata).
//
// Data source: the app has no canonical-AppData read path yet, so the plan shown
// is a deterministic in-file sample, honestly labelled. All organization/
// formatting lives in IronPathTrainingDecision.PlanSurfaceSummary (pure +
// unit-tested); this view only renders rows. No engine output is read or changed.
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

struct PlanRootView: View {
    private let summary = PlanSurfaceSummary(
        mesocycle: PlanRootView.sampleMesocycle(),
        program: PlanRootView.sampleProgram()
    )

    @State private var showEmptyInfo = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                sampleNote
                if summary.isEmpty {
                    emptyState
                } else {
                    if !summary.cycleRows.isEmpty {
                        card(title: "周期 Mesocycle", rows: summary.cycleRows)
                    }
                    if !summary.programRows.isEmpty {
                        card(title: "模板 Program", rows: summary.programRows)
                    }
                    strategyDisclosure
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        .alert("计划 · 暂无数据", isPresented: $showEmptyInfo) {
            Button("好", role: .cancel) {}
        } message: {
            Text("接入真实计划数据后，这里会展示你的训练周期与模板。计划页为只读概览，不读写任何数据。")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("计划")
                .font(.largeTitle.weight(.semibold))
            Text("训练周期与模板概览")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var sampleNote: some View {
        Text("示例计划：用于演示只读渲染。接入真实数据后将显示你的周期与模板。")
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("还没有训练计划")
                .font(.headline)
            Text("接入真实计划数据后，这里会展示训练周期、阶段与模板安排。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("了解计划页") { showEmptyInfo = true }
                .buttonStyle(.bordered)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private var strategyDisclosure: some View {
        DisclosureGroup("策略详情") {
            VStack(alignment: .leading, spacing: 6) {
                strategyRow("矫正策略", present: summary.hasCorrectionStrategy)
                strategyRow("功能策略", present: summary.hasFunctionalStrategy)
            }
            .padding(.top, 6)
        }
        .font(.headline)
        .tint(.primary)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private func strategyRow(_ label: String, present: Bool) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(present ? "已配置" : "未配置")
                .font(.subheadline)
                .foregroundStyle(present ? .primary : .secondary)
        }
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
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    // MARK: - Deterministic in-file sample (no canonical-AppData read path yet)

    private static func sampleMesocycle() -> MesocyclePlan {
        func week(_ phase: String) -> JSONValue {
            .object(OrderedJSONObject(entries: [.init(key: "phase", value: .string(phase))]))
        }
        return MesocyclePlan(
            id: "sample-meso",
            startDate: "2026-05-04",
            endDate: "2026-05-31",
            phase: "积累期",
            weeks: .array([week("base"), week("build"), week("overload"), week("deload")])
        )
    }

    private static func sampleProgram() -> ProgramTemplate {
        ProgramTemplate(
            id: "sample-program",
            primaryGoal: "增肌",
            splitType: "推 / 拉 / 腿",
            daysPerWeek: .integer(4),
            correctionStrategy: .object(OrderedJSONObject(entries: [
                .init(key: "note", value: .string("肩前引矫正")),
            ]))
        )
    }
}

#Preview {
    PlanRootView()
}
