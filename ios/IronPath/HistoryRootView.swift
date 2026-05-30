// HistoryRootView — 记录 (History) read-only surface V1.
//
// The 记录 tab now renders the REAL on-device training history instead of the
// iOS-17S placeholder. It reads the locally-saved Focus snapshots through the
// sanctioned IronPathLocalSnapshot store (read-only: `scanSnapshots()` only),
// groups / filters / searches them with the package's pure, unit-tested helpers
// (LocalSnapshotHistory + LocalSnapshotStats), and opens a per-session detail
// by REUSING FocusSavedSessionDetailView in its read-only mode (no `onContinue`,
// no current-scenario ids → no restore affordance, no recovery projection).
//
// Strictly READ-ONLY (master §5/§15, source-of-truth impact: none):
//   • No write surface at all — no clear / export / quarantine / restore here.
//     Those mutating affordances live on the 训练 tab's FocusSavedSessionHistory
//     surface, driven by FocusModeMvpState; this tab never mutates state/disk.
//   • This view never touches FileManager/disk directly; all IO is delegated to
//     the one sanctioned store file. It writes nothing, persists nothing, and
//     never reads/mutates AppData or the engine.
//   • The history store stays decoupled from AppData (LocalCompletedSessionSnapshot
//     is a small presentation record, not the canonical domain model).
//
// === iOS-17S Tab Shell Scaffold V1 · parallel-line integration contract ===
// This slice fills ONLY this RootView's body + the package logic it renders. It
// does NOT edit ContentView (the shell), another tab's RootView, FocusMode*, or
// project.pbxproj. The four-default-arg init keeps ContentView's `HistoryRootView()`
// call unchanged. Keep the app layer thin (master §5/§15/§19.3): no business
// logic, no persistence, no network/cloud/auth here.

import SwiftUI
import IronPathLocalSnapshot

struct HistoryRootView: View {
    /// Injected snapshots for previews/tests (deterministic, no disk). When nil
    /// (the running app) the surface loads read-only from the local store.
    private let injectedSnapshots: [LocalCompletedSessionSnapshot]?
    /// The reference "now" used for Today/Earlier/Older grouping + the coarse
    /// date-range filter. Defaults to the real clock for the running app; a fixed
    /// value is injected by previews/tests so they stay deterministic.
    private let referenceNow: Date

    /// Read outcome — honest loading / failed / loaded states (no fake success).
    private enum LoadState: Equatable {
        case loading
        case loaded([LocalCompletedSessionSnapshot])
        case failed(String)
    }

    @State private var loadState: LoadState
    @State private var searchQuery = ""
    @State private var scenarioFilter: String? = nil      // nil = all scenarios
    @State private var completedOnly = false
    @State private var dateRange: LocalHistoryDateRange = .all
    @State private var selected: LocalCompletedSessionSnapshot? = nil

    init(snapshots: [LocalCompletedSessionSnapshot]? = nil, now: Date = Date()) {
        self.injectedSnapshots = snapshots
        self.referenceNow = now
        _loadState = State(initialValue: snapshots.map(LoadState.loaded) ?? .loading)
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("记录")
        }
        // Read-only detail: omit `onContinue` (no restore/continue write action)
        // and `currentExerciseIds` (no per-exercise recovery projection) — the
        // sheet then renders as a pure saved-session viewer.
        .sheet(item: $selected) { snapshot in
            FocusSavedSessionDetailView(snapshot: snapshot)
        }
        // Refresh on appear so returning to the tab reflects newly-saved sessions.
        // Injected (preview/test) data never reads disk.
        .onAppear(perform: loadIfNeeded)
    }

    // MARK: - Top-level content states

    @ViewBuilder
    private var content: some View {
        switch loadState {
        case .loading:
            loadingState
        case .failed(let message):
            failureState(message)
        case .loaded(let all):
            if all.isEmpty {
                emptyState
            } else {
                historyList(all)
            }
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("正在读取本机训练记录…")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func failureState(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("暂时无法读取记录")
                    .font(.title2.weight(.semibold))
                Text("读取本机训练记录时出错：\(message)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Button(action: reload) {
                Text("重试")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("还没有训练记录")
                    .font(.title2.weight(.semibold))
                Text("在「训练」页完成一次训练后，本机会自动保存这次训练，并显示在这里。记录仅保存在本机，不联网、不同步云端。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Button(action: reload) {
                Text("刷新")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    // MARK: - Loaded history list

    private func historyList(_ all: [LocalCompletedSessionSnapshot]) -> some View {
        let filtered = filteredSnapshots(all)
        let sections = LocalSnapshotHistory.grouped(filtered, now: referenceNow)
        return List {
            statsSection(all)
            filterSection(all)
            if sections.isEmpty {
                Section {
                    Text("没有符合筛选条件的记录")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } else {
                ForEach(sections, id: \.group.rawValue) { section in
                    Section(section.group.title) {
                        ForEach(section.snapshots) { snapshot in
                            Button { selected = snapshot } label: { historyRow(snapshot) }
                                .buttonStyle(.plain)
                        }
                    }
                }
            }
            disclaimerSection
        }
        .listStyle(.insetGrouped)
        .searchable(text: $searchQuery, prompt: "搜索样例 / 动作")
        .autocorrectionDisabled()
    }

    // MARK: - Stats (derived, read-only)

    private func statsSection(_ all: [LocalCompletedSessionSnapshot]) -> some View {
        let stats = LocalSnapshotStats.derive(from: all)
        return Section("本机训练小结") {
            HStack(spacing: 8) {
                statTile("已保存", "\(stats.totalSessions)")
                statTile("完成组", "\(stats.totalCompletedSets)")
                statTile("目标组", "\(stats.totalTargetSets)")
                statTile("完成率", stats.completionPercentText)
            }
            if let common = stats.mostCommonScenarioLabel {
                Text("最常练：\(common) · 最近一次：\(stats.lastSavedIso.map(Self.displayTime) ?? "—")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func statTile(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.subheadline.monospacedDigit().weight(.semibold))
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemBackground)))
    }

    // MARK: - Filters (coarse date range + completed-only + scenario)

    private func filterSection(_ all: [LocalCompletedSessionSnapshot]) -> some View {
        Section("筛选") {
            Picker("时间范围", selection: $dateRange) {
                ForEach(LocalHistoryDateRange.allCases, id: \.self) { range in
                    Text(range.title).tag(range)
                }
            }
            .pickerStyle(.segmented)

            Toggle("仅显示已完成", isOn: $completedOnly)

            let scenarios = distinctScenarios(all)
            if !scenarios.isEmpty {
                Picker("训练样例", selection: $scenarioFilter) {
                    Text("全部样例").tag(String?.none)
                    ForEach(scenarios, id: \.id) { item in
                        Text(item.label).tag(String?.some(item.id))
                    }
                }
            }
        }
    }

    // MARK: - History row

    private func historyRow(_ snapshot: LocalCompletedSessionSnapshot) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(snapshot.scenarioLabel).font(.subheadline.weight(.medium))
                Text("\(snapshot.sessionIntent) · \(snapshot.activePhase)")
                    .font(.caption2).foregroundStyle(.tertiary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(snapshot.totalCompletedSets) / \(snapshot.totalTargetSets) 组 · \(Self.completionPercent(snapshot))")
                    .font(.footnote.monospacedDigit())
                Text(Self.displayTime(snapshot.createdAtIso))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .contentShape(Rectangle())
        .padding(.vertical, 2)
    }

    private var disclaimerSection: some View {
        Section {
            // Honest disclosure — read-only, no data access beyond the local read.
            Text("本页只读展示本机已保存的训练，点按可查看详情。不联网、不同步云端、不修改任何已保存的数据。清除 / 导出 / 继续训练等操作仍在「训练」页内。")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Loading (read-only, delegated to the sanctioned store)

    private func loadIfNeeded() {
        // Injected snapshots (preview/test) are authoritative — never read disk.
        guard injectedSnapshots == nil else { return }
        loadFromStore()
    }

    private func reload() {
        guard injectedSnapshots == nil else { return }
        loadFromStore()
    }

    private func loadFromStore() {
        // Read-only scan: the store performs no write and clears nothing here.
        // A read failure is surfaced honestly (never a fabricated empty success).
        let store = LocalSessionSnapshotStore()
        do {
            loadState = .loaded(try store.scanSnapshots().valid)
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }

    // MARK: - Pure UI helpers

    private func filteredSnapshots(_ all: [LocalCompletedSessionSnapshot]) -> [LocalCompletedSessionSnapshot] {
        // Delegate to the pure, unit-tested filter (search + scenario +
        // completed-only + coarse date range), measured against the injected clock.
        LocalSnapshotHistory.filtered(
            all,
            query: searchQuery,
            scenarioId: scenarioFilter,
            completedOnly: completedOnly,
            dateRange: dateRange,
            now: referenceNow
        )
    }

    private func distinctScenarios(_ all: [LocalCompletedSessionSnapshot]) -> [ScenarioOption] {
        var seen = Set<String>()
        var out: [ScenarioOption] = []
        for snap in all where !seen.contains(snap.scenarioId) {
            seen.insert(snap.scenarioId)
            out.append(ScenarioOption(id: snap.scenarioId, label: snap.scenarioLabel))
        }
        return out
    }

    private struct ScenarioOption: Identifiable { let id: String; let label: String }

    /// Whole-percent completion for one snapshot (e.g. "80%").
    private static func completionPercent(_ s: LocalCompletedSessionSnapshot) -> String {
        guard s.totalTargetSets > 0 else { return "0%" }
        let pct = Int((Double(s.totalCompletedSets) / Double(s.totalTargetSets) * 100).rounded())
        return "\(min(100, max(0, pct)))%"
    }

    /// Render an ISO-8601 instant as a compact UTC `yyyy-MM-dd HH:mm` label.
    /// Falls back to the raw string if it can't be parsed.
    private static func displayTime(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? {
            let alt = ISO8601DateFormatter()
            alt.formatOptions = [.withInternetDateTime]
            return alt.date(from: iso)
        }()
        guard let date else { return iso }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "UTC")
        fmt.dateFormat = "yyyy-MM-dd HH:mm"
        return fmt.string(from: date)
    }
}

// MARK: - Previews (deterministic — injected snapshots + fixed clock, no disk)

#Preview("有记录") {
    HistoryRootView(snapshots: HistoryRootViewPreviewData.snapshots, now: HistoryRootViewPreviewData.now)
}

#Preview("空态") {
    HistoryRootView(snapshots: [])
}

/// Deterministic preview-only sample. NOT canonical AppData and never written to
/// disk — it only feeds the SwiftUI preview so it renders without a device store.
private enum HistoryRootViewPreviewData {
    static let now: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: "2026-05-27T12:00:00.000Z") ?? Date(timeIntervalSince1970: 0)
    }()

    static let snapshots: [LocalCompletedSessionSnapshot] = [
        LocalCompletedSessionSnapshot(
            snapshotId: "focus-normal-3",
            createdAtIso: "2026-05-27T10:00:00.000Z",
            scenarioId: "normal",
            scenarioLabel: "普通",
            sessionIntent: "normal-session",
            activePhase: "base",
            deloadLevel: "none",
            deloadStrategy: "maintain",
            totalCompletedSets: 6,
            totalTargetSets: 6,
            exercises: [
                LocalCompletedExerciseSnapshot(
                    exerciseId: "bench-press", name: "平板卧推", role: "secondary-compound",
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 3, targetSets: 3)
                ),
                LocalCompletedExerciseSnapshot(
                    exerciseId: "lateral-raise", name: "哑铃侧平举", role: "isolation",
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 3, targetSets: 3)
                ),
            ]
        ),
        LocalCompletedSessionSnapshot(
            snapshotId: "focus-deloadWeek-2",
            createdAtIso: "2026-05-22T09:30:00.000Z",
            scenarioId: "deloadWeek",
            scenarioLabel: "减载周",
            sessionIntent: "deload-session",
            activePhase: "peak",
            deloadLevel: "moderate",
            deloadStrategy: "reduce-volume",
            totalCompletedSets: 4,
            totalTargetSets: 6,
            exercises: [
                LocalCompletedExerciseSnapshot(
                    exerciseId: "squat", name: "深蹲", role: "primary-compound",
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 2, targetSets: 3)
                ),
            ]
        ),
        LocalCompletedSessionSnapshot(
            snapshotId: "focus-normal-1",
            createdAtIso: "2026-05-10T18:15:00.000Z",
            scenarioId: "normal",
            scenarioLabel: "普通",
            sessionIntent: "normal-session",
            activePhase: "base",
            deloadLevel: "none",
            deloadStrategy: "maintain",
            totalCompletedSets: 5,
            totalTargetSets: 6,
            exercises: [
                LocalCompletedExerciseSnapshot(
                    exerciseId: "deadlift", name: "硬拉", role: "primary-compound",
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 2, targetSets: 3)
                ),
            ]
        ),
    ]
}
