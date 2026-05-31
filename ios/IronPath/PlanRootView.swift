// PlanRootView — 计划 (Plan) real-AppData read path V1.
//
// The 计划 tab renders a READ-ONLY, restrained view of the user's REAL plan, REUSING
// the Today (#437) / Profile (#438) / History (#439) canonical read path:
//   load → buildCleanAppDataView → resolve  (the §10 chokepoint)
// The thin `@MainActor PlanRealDataModel` opts the running app into the SAME sanctioned
// canonical store the write path uses (`JSONFileAppDataStore.applicationSupport()`, §8),
// loads it READ-ONLY, routes the document through DataHealth `buildCleanAppDataView`, and
// delegates the whole transform to the pure package resolver:
//   AppData → buildCleanAppDataView → resolvePlanDisplayState → PlanDisplayState
// — raw AppData NEVER reaches the surface (it always passes through the clean view first,
// §10). Honest states (§15.4): no canonical file yet / first launch / a loaded-but-plan-
// less document → an empty state; a present-but-unreadable document → a degrade state
// (the document is left untouched — this path NEVER writes). All field selection lives in
// `IronPathDomain.PlanDisplay` and all branch logic in
// `IronPathDataHealth.resolvePlanDisplayState` (both pure + unit-tested); this view only
// renders + formats rows. No engine touched, no golden touched, nothing persisted.
//
// === iOS-17S Tab Shell Scaffold V1 · parallel-line integration contract ===
// This slice fills ONLY this RootView's body + the package logic it renders. It does NOT
// edit ContentView (the shell — the zero-arg `init()` keeps its `PlanRootView()` call
// unchanged), another tab's RootView, FocusMode*, or project.pbxproj. Keep the app layer
// thin (master §5/§15/§19.3): rendering + wiring only, no business logic; the only IO is
// the sanctioned read-only canonical store load, delegated to the store.

import Foundation
import SwiftUI
import IronPathDomain
import IronPathDataHealth
import IronPathPersistence

/// Thin @MainActor view-model for the 计划 surface's REAL canonical-AppData read.
/// It owns ONLY the wiring + IO seam (master §5/§15): it opts the running app into the
/// sanctioned canonical store and delegates the AppData → clean view → display transform
/// to the pure `resolvePlanDisplayState`. It NEVER touches FileManager directly (the store
/// does all disk IO), NEVER writes, and surfaces an honest state for every failure — no
/// crash, no fabricated plan, no overwrite. Mirrors `ProfileRealDataModel`.
@MainActor
final class PlanRealDataModel: ObservableObject {
    @Published private(set) var state: PlanDisplayState

    /// The sanctioned canonical store (the §8 source of truth). Optional so previews/tests
    /// opt OUT of disk entirely; the running app injects the Application Support store on
    /// appear. All disk IO is delegated to the store.
    private var store: AppDataStore?
    /// Injectable clock; only invoked on the live read path (never an inline `Date()` in
    /// previews/tests).
    private let now: () -> Date
    /// True for the running app (live loading enabled); false for pinned previews.
    private let isLive: Bool

    /// Live initializer (the running app): honest `.empty` until `reload()` reads the
    /// canonical store, opted in on appear via `activateLiveSourceIfNeeded()`.
    init(now: @escaping () -> Date = { Date() }) {
        self.state = .empty
        self.store = nil
        self.now = now
        self.isLive = true
    }

    /// Preview/test initializer: pins a fixed state and disables live loading, so a preview
    /// renders a chosen state without ever reading the real on-disk document.
    init(previewState: PlanDisplayState) {
        self.state = previewState
        self.store = nil
        self.now = { Date() }
        self.isLive = false
    }

    /// True for the running app; false for pinned previews.
    var isLiveLoadEnabled: Bool { isLive }

    /// Opt the RUNNING app into the SAME sanctioned canonical store the write path uses
    /// (Application Support / `IronPathAppData`), pointing the read path at the real source
    /// of truth. Idempotent; `#if os(iOS)` + the live guard keep previews/tests off disk.
    func activateLiveSourceIfNeeded() {
        guard isLive else { return }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
    }

    /// Read-only refresh: canonical AppData → DataHealth clean view → display state (in
    /// `resolvePlanDisplayState`). NEVER writes, NEVER overwrites an unreadable document,
    /// NEVER crashes — every failure becomes an honest state.
    func reload() {
        guard isLive else { return }
        state = resolvePlanDisplayState(readOutcome(now: now()))
    }

    /// The ONLY IO + the DataHealth clean-view construction (the §10 chokepoint the app
    /// layer performs, mirroring `ProfileRealDataModel`). No write: a missing file (or no
    /// live source) → `.missing`; a present-but-unreadable document → `.unreadable` (left
    /// untouched on disk, never overwritten — raw AppData never reaches the surface).
    private func readOutcome(now: Date) -> PlanAppDataLoadOutcome {
        guard let store, store.hasExistingFile else { return .missing }
        let appData: AppData
        do {
            appData = try store.load()
        } catch {
            return .unreadable
        }
        return .loaded(buildCleanAppDataView(appData, clock: FixedRuntimeGuardClock(now)))
    }
}

struct PlanRootView: View {
    @StateObject private var model: PlanRealDataModel
    @State private var showEmptyInfo = false

    /// The running app constructs the default live model. `@MainActor` so it can build the
    /// main-actor-isolated model (SwiftUI always builds views on the main actor). Zero-arg
    /// so ContentView's `PlanRootView()` call stays unchanged (iOS-17S).
    @MainActor init() {
        _model = StateObject(wrappedValue: PlanRealDataModel())
    }

    /// Previews/tests inject a pinned model (e.g. `PlanRealDataModel(previewState:)`).
    @MainActor init(model: PlanRealDataModel) {
        _model = StateObject(wrappedValue: model)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                content
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        .task {
            // Opt the running app into the real canonical store and read it (read-only).
            model.activateLiveSourceIfNeeded()
            model.reload()
        }
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

    // MARK: - State-driven content

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .ready(let plan):
            planContent(plan)
        case .empty:
            emptyState
        case .unavailable:
            unavailableState
        }
    }

    @ViewBuilder
    private func planContent(_ plan: PlanDisplay) -> some View {
        let cycle = Self.cycleRows(plan)
        let program = Self.programRows(plan)
        if !cycle.isEmpty {
            card(title: "周期 Mesocycle", rows: cycle)
        }
        if !program.isEmpty {
            card(title: "模板 Program", rows: program)
        }
        if plan.hasCorrectionStrategy || plan.hasFunctionalStrategy {
            strategyDisclosure(plan)
        }
    }

    // MARK: - Honest empty / degrade states (§15.4)

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("还没有训练计划")
                .font(.headline)
            Text("本机还没有可显示的训练周期或模板。配置计划后会显示在这里。计划页只读展示、不联网、不修改任何已保存的数据。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                Button("刷新") { reloadFromTap() }
                    .buttonStyle(.borderedProminent)
                Button("了解计划页") { showEmptyInfo = true }
                    .buttonStyle(.bordered)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private var unavailableState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("暂时无法读取计划")
                .font(.headline)
            Text("本机计划暂时无法读取。已保留原始数据未作任何改动，可稍后重试。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("重试") { reloadFromTap() }
                .buttonStyle(.borderedProminent)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    // MARK: - Cards

    private func strategyDisclosure(_ plan: PlanDisplay) -> some View {
        DisclosureGroup("策略详情") {
            VStack(alignment: .leading, spacing: 6) {
                strategyRow("矫正策略", present: plan.hasCorrectionStrategy)
                strategyRow("功能策略", present: plan.hasFunctionalStrategy)
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

    private func card(title: String, rows: [PlanRow]) -> some View {
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

    // MARK: - Helpers

    /// Re-run the read-only load on an explicit retry/refresh tap (picks up a plan
    /// configured since first appear).
    private func reloadFromTap() {
        model.activateLiveSourceIfNeeded()
        model.reload()
    }

    /// Cycle rows from the real `PlanDisplay` — each shown only when present, so the
    /// surface stays calm (presentation only; selection lives in `PlanDisplay`).
    private static func cycleRows(_ plan: PlanDisplay) -> [PlanRow] {
        var rows: [PlanRow] = []
        if let phase = plan.phase { rows.append(PlanRow(id: "phase", label: "阶段", value: phase)) }
        if let weeks = plan.weekCount { rows.append(PlanRow(id: "weeks", label: "周数", value: "\(weeks) 周")) }
        if let range = dateRange(plan.startDate, plan.endDate) {
            rows.append(PlanRow(id: "dates", label: "日期", value: range))
        }
        return rows
    }

    private static func programRows(_ plan: PlanDisplay) -> [PlanRow] {
        var rows: [PlanRow] = []
        if let goal = plan.primaryGoal { rows.append(PlanRow(id: "goal", label: "目标", value: goal)) }
        if let split = plan.splitType { rows.append(PlanRow(id: "split", label: "分项", value: split)) }
        if let days = plan.daysPerWeek { rows.append(PlanRow(id: "days", label: "每周", value: "\(days) 天")) }
        return rows
    }

    /// Join the cleaned start/end dates into an honest range; nil when neither exists.
    private static func dateRange(_ start: String?, _ end: String?) -> String? {
        switch (start, end) {
        case let (s?, e?): return "\(s) – \(e)"
        case let (s?, nil): return s
        case let (nil, e?): return e
        case (nil, nil): return nil
        }
    }
}

/// One label/value row in a Plan card (presentation only).
private struct PlanRow: Identifiable, Equatable {
    let id: String
    let label: String
    let value: String
}

#Preview("有计划") {
    PlanRootView(model: PlanRealDataModel(previewState: .ready(
        PlanDisplay(
            phase: "积累期",
            weekCount: 4,
            startDate: "2026-05-04",
            endDate: "2026-05-31",
            primaryGoal: "增肌",
            splitType: "推 / 拉 / 腿",
            daysPerWeek: 4,
            hasCorrectionStrategy: true,
            hasFunctionalStrategy: false
        )
    )))
}

#Preview("空态") {
    PlanRootView(model: PlanRealDataModel(previewState: .empty))
}

#Preview("不可读") {
    PlanRootView(model: PlanRealDataModel(previewState: .unavailable))
}
