// HistoryRootView — 记录 (History) real-AppData read path V1.
//
// The 记录 tab renders the user's REAL completed training as ONE unified,
// most-recent-first timeline, REUSING the Today (#437) / Profile (#438) canonical
// read path: load → buildCleanAppDataView → resolve (the §10 chokepoint). Two
// honest, source-tagged origins are merged:
//   • 原生 — native completed sessions from canonical `AppData.history`, read as
//     the DataHealth-CLEANED `cleanedHistory` (the §8 source of truth).
//   • 来自 Apple 健康 — the DERIVED, display-only `importedWorkoutSamples` (HK-2);
//     listed + tagged, NEVER treated as a native session, NEVER engine input (§8.2).
//
// No-loss merge (§12): a native session completed WITHOUT per-set detail is saved
// only to the local Focus snapshot store, never to canonical `history`
// (`FocusModeMvpState.persistCanonicalSession` → `.skipped`). To lose nothing, the
// thin model ALSO reads that store READ-ONLY and feeds those as neutral
// `SupplementalNativeCompletion` values; the pure timeline merges them in and
// DEDUPES BY ID against canonical (canonical, the source of truth, wins → no
// duplicate rows). The merge keeps the packages decoupled: `IronPathDomain` /
// `IronPathDataHealth` never import `IronPathLocalSnapshot`; only this app-layer
// model reads both stores.
//
// Strictly READ-ONLY (master §5/§15, source-of-truth impact: none): no write
// surface, no `save`, no AppData mutation, no engine call, no golden touched. The
// LocalSnapshot draft-recovery / restore / per-session detail (§12/§13) live on the
// 训练 tab (FocusSavedSessionHistoryView) and are NOT touched here. A present-but-
// unreadable canonical document maps to an honest degrade and is left untouched on
// disk (never overwritten — raw AppData never reaches the surface).
//
// === iOS-17S Tab Shell Scaffold V1 · parallel-line integration contract ===
// This slice fills ONLY this RootView's body + the pure package logic it renders.
// It does NOT edit ContentView (the shell — the zero-arg `init()` keeps its
// `HistoryRootView()` call unchanged), another tab's RootView, FocusMode*, or
// project.pbxproj. Keep the app layer thin (master §5/§15/§19.3): rendering +
// wiring only; the only IO is the two sanctioned read-only store loads, delegated
// to the stores; all branch / merge logic is in the unit-tested packages.

import Foundation
import SwiftUI
import IronPathDomain
import IronPathDataHealth
import IronPathPersistence
import IronPathLocalSnapshot
import IronPathHealthKit

/// Thin @MainActor view-model for the 记录 surface's REAL canonical-AppData read.
/// It owns ONLY wiring + the IO seams (master §5/§15): it opts the running app into
/// the sanctioned canonical store AND the local Focus snapshot store, loads both
/// READ-ONLY, and delegates the AppData → clean view → unified-timeline transform to
/// the pure `resolveHistoryDisplayState`. It NEVER touches FileManager directly (the
/// stores do all disk IO), NEVER writes, and surfaces an honest state for every
/// failure — no crash, no fabricated rows, no overwrite. Mirrors the 今日 / 我的
/// surfaces' `TodayRealDataModel` / `ProfileRealDataModel`.
@MainActor
final class HistoryRealDataModel: ObservableObject {
    @Published private(set) var state: HistoryDisplayState

    /// The sanctioned canonical store (the §8 source of truth). Optional so
    /// previews/tests opt OUT of disk entirely; the running app injects the
    /// Application Support store on appear. All disk IO is delegated to the store.
    private var store: AppDataStore?
    /// The local Focus snapshot store — READ-ONLY here, the supplemental native
    /// source so the unified timeline loses no snapshot-only completion. Optional;
    /// nil for previews/tests (no disk).
    private var snapshotStore: LocalSessionSnapshotStore?
    /// Injectable clock; only invoked on the live read path (never an inline `Date()`
    /// in previews/tests).
    private let now: () -> Date
    /// True for the running app (live loading enabled); false for pinned previews.
    private let isLive: Bool

    /// Live initializer (the running app): honest `.empty` until `reload()` reads the
    /// stores, opted in on appear via `activateLiveSourceIfNeeded()`.
    init(now: @escaping () -> Date = { Date() }) {
        self.state = .empty
        self.store = nil
        self.snapshotStore = nil
        self.now = now
        self.isLive = true
    }

    /// Preview/test initializer: pins a fixed state and disables live loading, so a
    /// preview renders a chosen state without ever reading the real on-disk stores.
    init(previewState: HistoryDisplayState) {
        self.state = previewState
        self.store = nil
        self.snapshotStore = nil
        self.now = { Date() }
        self.isLive = false
    }

    /// True for the running app; false for pinned previews.
    var isLiveLoadEnabled: Bool { isLive }

    /// Opt the RUNNING app into the SAME sanctioned canonical store the write path
    /// uses (Application Support / `IronPathAppData`) AND the local Focus snapshot
    /// store. Idempotent; `#if os(iOS)` + the live guard keep previews/tests off disk.
    func activateLiveSourceIfNeeded() {
        guard isLive else { return }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        if snapshotStore == nil { snapshotStore = LocalSessionSnapshotStore() }
        #endif
    }

    /// Read-only refresh: canonical AppData → DataHealth clean view + the local
    /// snapshot store → unified display state (in `resolveHistoryDisplayState`).
    /// NEVER writes, NEVER overwrites an unreadable document, NEVER crashes — every
    /// failure becomes an honest state.
    func reload() {
        guard isLive else { return }
        state = resolveHistoryDisplayState(
            readOutcome(now: now()),
            supplementalNatives: readSupplementalNatives()
        )
    }

    /// The canonical IO + the DataHealth clean-view construction (the §10 chokepoint
    /// the app layer performs, mirroring `TodayRealDataModel` / `ProfileRealDataModel`).
    /// No write: a missing file (or no live source) → `.missing`; a present-but-
    /// unreadable document → `.unreadable` (left untouched on disk, never overwritten).
    private func readOutcome(now: Date) -> HistoryAppDataLoadOutcome {
        guard let store, store.hasExistingFile else { return .missing }
        let appData: AppData
        do {
            appData = try store.load()
        } catch {
            return .unreadable
        }
        return .loaded(buildCleanAppDataView(appData, clock: FixedRuntimeGuardClock(now)))
    }

    /// Read the local Focus snapshot store READ-ONLY and reduce each valid snapshot
    /// to a NEUTRAL `SupplementalNativeCompletion` (no `IronPathLocalSnapshot` type
    /// crosses into the packages). Best-effort: a read failure (or no live store)
    /// yields none — the canonical timeline still renders. NEVER writes, NEVER clears.
    private func readSupplementalNatives() -> [SupplementalNativeCompletion] {
        guard let snapshotStore, let scan = try? snapshotStore.scanSnapshots() else { return [] }
        return scan.valid.map { snapshot in
            SupplementalNativeCompletion(
                id: snapshot.snapshotId,
                occurredAtIso: snapshot.createdAtIso,
                exerciseCount: snapshot.exercises.count,
                performedSetCount: snapshot.totalCompletedSets,
                exerciseNames: snapshot.exercises.map(\.name)
            )
        }
    }
}

struct HistoryRootView: View {
    @StateObject private var model: HistoryRealDataModel

    /// 记录 filter UI state (presentation-only; never written to disk). Each defaults
    /// to a no-op, so the unified timeline renders unchanged until the user filters.
    @State private var query: String = ""
    @State private var sourceFilter: CompletedTrainingSourceFilter = .all

    /// The running app constructs the default live model. `@MainActor` so it can build
    /// the main-actor-isolated model (SwiftUI always builds views on the main actor).
    /// Zero-arg so ContentView's `HistoryRootView()` call stays unchanged (iOS-17S).
    @MainActor init() {
        _model = StateObject(wrappedValue: HistoryRealDataModel())
    }

    /// Previews/tests inject a pinned model (e.g. `HistoryRealDataModel(previewState:)`).
    @MainActor init(model: HistoryRealDataModel) {
        _model = StateObject(wrappedValue: model)
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("记录")
        }
        .task {
            // Opt the running app into the real stores and read them (read-only).
            model.activateLiveSourceIfNeeded()
            model.reload()
        }
    }

    // MARK: - Top-level content states

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .ready(let timeline):
            timelineList(timeline)
        case .empty:
            emptyState
        case .unavailable:
            unavailableState
        }
    }

    // MARK: - Unified timeline (native + Apple-Health imports)

    /// The unified timeline + the pure search / source filter (read-only). The search
    /// field and source segment feed `CompletedTrainingTimeline.filtered`; the rows are
    /// whatever it returns, in order. When the filter matches nothing (but records
    /// exist) we show an HONEST "没有匹配的记录" row — distinct from the
    /// no-records-at-all empty state — keeping the controls on screen so the user can
    /// adjust. Nothing here writes, edits, or reorders.
    private func timelineList(_ timeline: CompletedTrainingTimeline) -> some View {
        let filtered = timeline.filtered(
            query: query,
            source: sourceFilter
        )
        return List {
            filterControlsSection
            if filtered.isEmpty {
                noMatchSection
            } else {
                Section {
                    ForEach(Array(filtered.entries.enumerated()), id: \.offset) { _, entry in
                        entryRow(entry)
                    }
                } header: {
                    Text("完成训练 · 共 \(filtered.entries.count) 条")
                }
            }
            disclaimerSection
        }
        .listStyle(.insetGrouped)
        .searchable(text: $query, prompt: "搜索动作 / 来源")
    }

    /// Read-only filter controls: a source segment (全部 / 原生 / 来自 Apple 健康).
    /// Presentation state only — selecting one re-runs the pure filter; nothing is
    /// persisted.
    private var filterControlsSection: some View {
        Section {
            Picker("来源", selection: $sourceFilter) {
                ForEach(CompletedTrainingSourceFilter.allCases, id: \.self) { filter in
                    Text(filter.title).tag(filter)
                }
            }
            .pickerStyle(.segmented)
        } header: {
            Text("筛选")
        }
    }

    /// Honest "no matching records" state — shown when records exist but the active
    /// search / filters exclude them all (NOT the no-data-at-all empty state). The
    /// page stays read-only; the controls above remain visible for adjustment.
    private var noMatchSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 4) {
                Text("没有匹配的记录").font(.subheadline.weight(.medium))
                Text("试试调整搜索词或筛选条件。本页只读展示，不修改任何已保存的数据。")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding(.vertical, 2)
        }
    }

    @ViewBuilder
    private func entryRow(_ entry: CompletedTrainingEntry) -> some View {
        switch entry {
        case .native(let native):
            nativeRow(native)
        case .imported(let workout):
            importedRow(workout)
        }
    }

    private func nativeRow(_ native: NativeCompletedTraining) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("完成训练").font(.subheadline.weight(.medium))
                Text("\(native.exerciseCount) 个动作 · \(native.performedSetCount) 组")
                    .font(.caption2).foregroundStyle(.tertiary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                sourceTag("原生")
                Text(Self.displayTime(native.occurredAtIso))
                    .font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private func importedRow(_ workout: ImportedWorkoutSample) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(HealthKitWorkoutMapper.displayLabel(forWorkoutType: workout.workoutType))
                    .font(.subheadline.weight(.medium))
                Text(Self.importedSubtitle(workout))
                    .font(.caption2).foregroundStyle(.tertiary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                sourceTag("来自 Apple 健康")
                Text(Self.displayTime(workout.startDate ?? workout.endDate ?? workout.importedAt))
                    .font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    /// Small, calm origin chip — "原生" vs "来自 Apple 健康".
    private func sourceTag(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(.secondary)
    }

    private var disclaimerSection: some View {
        Section {
            // Honest disclosure — read-only, no data access beyond the local reads.
            Text("本页只读展示本机的完成训练：「原生」是你在本机完成的训练（来自本机训练记录），「来自 Apple 健康」是从 Apple 健康导入的训练摘要（仅供查看，不计入训练计划与准备度）。不联网、不同步云端、不修改任何已保存的数据。继续训练与逐组详情在「训练」页内。")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Honest empty / degrade states (§15.4)

    private var emptyState: some View {
        infoState(
            title: "还没有完成的训练记录",
            message: "在「训练」页完成一次训练后，会显示在这里；你也可以在「我的」页从 Apple 健康导入过往训练。记录只读展示、不联网、不同步云端。",
            actionTitle: "刷新"
        )
    }

    private var unavailableState: some View {
        infoState(
            title: "暂时无法读取记录",
            message: "本机记录暂时无法读取。已保留原始数据未作任何改动，可稍后重试。",
            actionTitle: "重试"
        )
    }

    /// Honest empty/degrade card (title + explanation + one retry action).
    private func infoState(title: String, message: String, actionTitle: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.title2.weight(.semibold))
                Text(message).font(.subheadline).foregroundStyle(.secondary)
            }
            Button(action: reloadFromTap) {
                Text(actionTitle)
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

    /// Re-run the read-only load on an explicit retry/refresh tap (picks up data
    /// saved/imported since first appear).
    private func reloadFromTap() {
        model.activateLiveSourceIfNeeded()
        model.reload()
    }

    // MARK: - Pure formatting (presentation only)

    /// Apple-Health imported-workout subtitle (时长 / 距离(km) / 心率 / 能量), built
    /// from the pure, unit-tested `ImportedWorkoutDisplayFields` projection (Domain).
    /// Each part is shown ONLY when the import recorded it — an absent field is
    /// honestly omitted, never a fabricated 0. Distance comes through as KILOMETRES
    /// (the projection's pure m→km conversion); this surface only FORMATS (单位 / 取整).
    private static func importedSubtitle(_ workout: ImportedWorkoutSample) -> String {
        let fields = ImportedWorkoutDisplayFields(workout)
        var parts: [String] = []
        if let minutes = fields.durationMin {
            parts.append("\(Int(minutes.rounded())) 分钟")
        }
        if let km = fields.distanceKm {
            parts.append(String(format: "%.1f 公里", km))
        }
        if let hr = heartRateText(avg: fields.avgHeartRate, max: fields.maxHeartRate) {
            parts.append(hr)
        }
        if let kcal = fields.activeEnergyKcal {
            parts.append("\(Int(kcal.rounded())) 千卡")
        }
        return parts.isEmpty ? "来自 Apple 健康的训练" : parts.joined(separator: " · ")
    }

    /// Heart rate for display: "心率 平均/最高 bpm" when both are present, otherwise
    /// whichever was recorded; nil when neither (the row simply omits it).
    private static func heartRateText(avg: Double?, max: Double?) -> String? {
        switch (avg, max) {
        case let (avg?, max?):
            return "心率 \(Int(avg.rounded()))/\(Int(max.rounded())) bpm"
        case let (avg?, nil):
            return "平均心率 \(Int(avg.rounded())) bpm"
        case let (nil, max?):
            return "最高心率 \(Int(max.rounded())) bpm"
        case (nil, nil):
            return nil
        }
    }

    /// Render an ISO-8601 instant as a compact UTC `yyyy-MM-dd HH:mm` label, or "—"
    /// when absent. Falls back to the raw string if it can't be parsed.
    private static func displayTime(_ iso: String?) -> String {
        guard let iso, !iso.isEmpty else { return "—" }
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

// MARK: - Previews (deterministic — pinned state, no disk)

#Preview("有记录") {
    HistoryRootView(model: HistoryRealDataModel(previewState: .ready(HistoryRootViewPreviewData.timeline)))
}

#Preview("空态") {
    HistoryRootView(model: HistoryRealDataModel(previewState: .empty))
}

#Preview("不可读") {
    HistoryRootView(model: HistoryRealDataModel(previewState: .unavailable))
}

/// Deterministic preview-only sample. NOT canonical AppData and never written to
/// disk — it only feeds the SwiftUI preview so it renders without a device store.
/// Built through the GENUINE pure builder so the preview reflects real merge/order.
private enum HistoryRootViewPreviewData {
    static let timeline = CompletedTrainingTimeline.make(
        canonicalHistory: [
            TrainingSession(
                id: "focus-3-normal",
                finishedAt: "2026-05-27T10:00:00.000Z",
                completed: true,
                focusSessionComplete: true,
                exercises: [
                    ExercisePrescription(id: "bench-press", exerciseId: "bench-press", name: "平板卧推", sets: [
                        TrainingSetLog(setIndex: .integer(0), done: true),
                        TrainingSetLog(setIndex: .integer(1), done: true),
                        TrainingSetLog(setIndex: .integer(2), done: true),
                    ]),
                    ExercisePrescription(id: "lateral-raise", exerciseId: "lateral-raise", name: "哑铃侧平举", sets: [
                        TrainingSetLog(setIndex: .integer(0), done: true),
                        TrainingSetLog(setIndex: .integer(1), done: true),
                    ]),
                ]
            ),
        ],
        supplementalNatives: [
            // A snapshot-only completion (no per-set detail → never written canonical).
            SupplementalNativeCompletion(
                id: "focus-1-normal",
                occurredAtIso: "2026-05-20T09:30:00.000Z",
                exerciseCount: 2,
                performedSetCount: 4
            ),
        ],
        importedWorkouts: [
            ImportedWorkoutSample(
                source: "healthkit_import",
                workoutType: "running",
                startDate: "2026-05-25T07:00:00.000Z",
                durationMin: .decimal(Decimal(32)),
                activeEnergyKcal: .decimal(Decimal(280)),
                distanceMeters: .decimal(Decimal(5200))
            ),
        ]
    )
}
