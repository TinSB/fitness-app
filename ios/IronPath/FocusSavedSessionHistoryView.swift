// FocusSavedSessionHistoryView — iOS-9 Local JSON Persistence + Saved Session
// History V1; HARDENED in iOS-10 Local Training Persistence Mega Bundle V1.
//
// A small, local-only saved-session surface shown on the plan screen. iOS-10
// adds: a local invalid/skipped warning (+ quarantine action), a restore-status
// line, a derived local stats summary, newest-first sort with scenario /
// completed filters, a local-only debug-copy export, a local storage
// diagnostics section, and a tap-to-open detail sheet. It is still a small
// preview surface — NOT a full history app: no charts, no calendar, no cloud
// restore.
//
// Pure SwiftUI — never touches disk, network, cloud, or AppData. All data and
// actions come from FocusModeMvpState (which delegates disk IO to the store).

import SwiftUI
import IronPathLocalSnapshot

struct FocusSavedSessionHistoryView: View {
    @ObservedObject var state: FocusModeMvpState

    /// Cap the preview list so this stays a small surface, not a full archive.
    private static let maxRows = 8

    @State private var showingClearConfirm = false
    @State private var scenarioFilter: String? = nil      // nil = all scenarios
    @State private var completedOnly = false
    @State private var searchQuery = ""                   // iOS-14 local text search
    @State private var selected: LocalCompletedSessionSnapshot? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header

            if let errorMessage = state.saveErrorMessage {
                errorBanner(errorMessage)
            }
            if case .failed(let message) = state.restoreStatus {
                errorBanner("恢复失败：\(message)")
            }
            if state.hasInvalidSkipped {
                invalidWarning
            }

            if let latest = state.latestSaved {
                restoreStatusLine
                latestCard(latest)
                statsSection
                filterControls
                recentList
                exportSection
                diagnosticsSection
                clearButton
            } else {
                emptyState
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
        .sheet(item: $selected) { snapshot in
            // iOS-15: hand the detail sheet the CURRENT scenario's exercise ids
            // (pure read, no restore side effect) so it can project a read-only
            // per-exercise recovery insight. The continue action still reuses the
            // EXISTING in-memory draft restore (no new restore semantics).
            FocusSavedSessionDetailView(
                snapshot: snapshot,
                currentExerciseIds: state.currentExerciseIds(forSnapshot: snapshot),
                displayUnit: state.captureDisplayUnit,
                onSaveSet: { exerciseId, setIndex, weightInDisplayUnit, reps, rir in
                    // DEEP-EDIT-1: correct this logged set in the canonical session
                    // (id == snapshotId) through the SAME gated write path. Returns an
                    // honest outcome the detail sheet reflects (saved / failed).
                    state.updateLoggedSet(
                        sessionId: snapshot.snapshotId,
                        exerciseId: exerciseId,
                        setIndex: setIndex,
                        weightInDisplayUnit: weightInDisplayUnit,
                        reps: reps,
                        rir: rir
                    )
                },
                // DEEP-EDIT-1 display: per-set values read CANONICAL-first (the corrected
                // AppData.history metrics when present, else the LocalSnapshot copy), so a
                // correction shows persistently (cold start too). Read-only, §10 gated.
                loadCanonicalSetDisplay: { state.canonicalSetDisplay(for: snapshot) },
                // SR-4 (a): read-only smart-replacement recommendations for one exercise,
                // engine-produced and fed from the §10 clean view (never raw AppData).
                onLoadRecommendations: { exerciseId in
                    state.replacementRecommendations(forSnapshot: snapshot.snapshotId, exerciseId: exerciseId)
                },
                // SR-4 (b)+(c): 换动作 (apply) / 复原 (restore) for one exercise through the
                // SAME canonical gated write path. Honest outcome the detail sheet reflects.
                onSwapExercise: { exerciseId, replacementExerciseId in
                    state.swapExercise(
                        sessionId: snapshot.snapshotId,
                        exerciseId: exerciseId,
                        replacementExerciseId: replacementExerciseId
                    )
                },
                // SR-4 (d): canonical-first replacement display so a 换动作 shows the ACTUAL
                // exercise name + attributes its sets, persistently (read-only, §10 gated).
                loadCanonicalReplacementDisplay: { state.canonicalExerciseReplacementDisplay(for: snapshot) }
            ) {
                // Restore-to-local-draft + continue. Dismiss the sheet first,
                // then restore (which flips the shell to the in-session draft).
                selected = nil
                state.restoreDraft(from: snapshot)
            }
        }
    }

    // MARK: - Header + disclaimer

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("本机已保存训练")
                .font(.headline)
            // Local-only disclaimer (no cloud sync, clearable).
            Text("仅保存在本机 · 不同步云端 · 可清除")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func errorBanner(_ message: String) -> some View {
        Text("⚠️ \(message)")
            .font(.caption)
            .foregroundStyle(.red)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(8)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color.red.opacity(0.10)))
    }

    // MARK: - Invalid / skipped warning + quarantine (Iter 3/4)

    private var invalidWarning: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("检测到 \(state.invalidSkippedCount) 个无法识别的本机存档，已跳过显示")
                .font(.caption)
                .foregroundStyle(.orange)
            Text("这些文件不会影响其它训练记录，仅保存在本机。")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Button {
                state.quarantineInvalidSnapshots()
            } label: {
                Text("隔离无效存档（仅本机）")
                    .font(.caption.weight(.medium))
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.orange.opacity(0.10)))
    }

    private var restoreStatusLine: some View {
        Text("已从本机恢复最近一次训练")
            .font(.caption2)
            .foregroundStyle(.green)
    }

    private var emptyState: some View {
        Text("还没有在本机保存的训练。完成一次训练后会自动保存在本机。")
            .font(.subheadline)
            .foregroundStyle(.secondary)
    }

    // MARK: - Latest card

    private func latestCard(_ snapshot: LocalCompletedSessionSnapshot) -> some View {
        Button {
            selected = snapshot
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text("最近一次 · 点按查看详情")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(snapshot.scenarioLabel).font(.subheadline.weight(.medium))
                        Text(snapshot.sessionIntent).font(.caption2).foregroundStyle(.tertiary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(snapshot.totalCompletedSets) / \(snapshot.totalTargetSets) 组")
                            .font(.subheadline.monospacedDigit())
                        Text(Self.displayTime(snapshot.createdAtIso))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color(.tertiarySystemBackground)))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Local stats summary (Iter 7)

    private var statsSection: some View {
        let s = state.stats
        return VStack(alignment: .leading, spacing: 6) {
            Text("本机训练小结")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                statTile("已保存", "\(s.totalSessions)")
                statTile("完成组", "\(s.totalCompletedSets)")
                statTile("目标组", "\(s.totalTargetSets)")
                statTile("完成率", s.completionPercentText)
            }
            // iOS-14: most-common scenario + last session date (derived, local).
            if let common = s.mostCommonScenarioLabel {
                Text("最常练：\(common) · 最近一次：\(s.lastSavedIso.map(Self.displayTime) ?? "—")")
                    .font(.caption2)
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

    // MARK: - Sort / filter (Iter 6)

    private var filterControls: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("近期记录（最新在前）")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Toggle("仅完成", isOn: $completedOnly)
                    .font(.caption)
                    .toggleStyle(.button)
                    .controlSize(.small)
            }
            // iOS-14: lightweight local search by scenario / intent / exercise name.
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass").font(.caption).foregroundStyle(.secondary)
                TextField("搜索样例 / 动作（仅本机）", text: $searchQuery)
                    .font(.caption)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if !searchQuery.isEmpty {
                    Button { searchQuery = "" } label: { Image(systemName: "xmark.circle.fill") }
                        .font(.caption).foregroundStyle(.tertiary).buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemBackground)))
            scenarioFilterMenu
            dateRangeControl
            customDateRangeControl
        }
    }

    // iOS-15: coarse, local-only date-range control (全部 / 最近 7 天 / 最近 30 天)
    // bound to the in-RAM UI state; the pure filter applies it against the same
    // injectable clock the rest of the history surface uses. iOS-16: disabled
    // while the custom from/to range is active (custom takes over).
    private var dateRangeControl: some View {
        Picker("时间范围", selection: $state.historyDateRange) {
            ForEach(LocalHistoryDateRange.allCases, id: \.self) { range in
                Text(range.title).tag(range)
            }
        }
        .pickerStyle(.segmented)
        .controlSize(.small)
        .disabled(state.historyCustomRangeEnabled)
    }

    // iOS-16: optional custom from/to date range (day granularity), local-only,
    // bound to in-RAM UI state and fed to the pure LocalSnapshotHistory filter.
    // When on, it takes over from the coarse range; two DatePickers pick the
    // inclusive interval. No business logic, no IO here.
    private var customDateRangeControl: some View {
        let enabledBinding = Binding(
            get: { state.historyCustomRangeEnabled },
            set: { state.setHistoryCustomRangeEnabled($0) }
        )
        return VStack(alignment: .leading, spacing: 6) {
            Toggle("按自定义日期筛选", isOn: enabledBinding)
                .font(.caption)
                .toggleStyle(.button)
                .controlSize(.small)
            if state.historyCustomRangeEnabled {
                DatePicker("从", selection: $state.historyCustomFrom, displayedComponents: .date)
                    .font(.caption)
                    .environment(\.timeZone, TimeZone(identifier: "UTC")!)
                DatePicker("到", selection: $state.historyCustomTo, displayedComponents: .date)
                    .font(.caption)
                    .environment(\.timeZone, TimeZone(identifier: "UTC")!)
                Text("按所选日期区间（含两端）筛选 · 仅本机 · 与搜索/场景/已完成同时生效")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private var scenarioFilterMenu: some View {
        let scenarios = distinctScenarios()
        return Menu {
            Button("全部样例") { scenarioFilter = nil }
            ForEach(scenarios, id: \.id) { item in
                Button(item.label) { scenarioFilter = item.id }
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "line.3.horizontal.decrease.circle")
                Text(scenarioFilterLabel(scenarios))
            }
            .font(.caption)
        }
    }

    // MARK: - Recent list (iOS-13: grouped Today/Earlier/Older, newest-first, tap → detail)

    @ViewBuilder
    private var recentList: some View {
        let filtered = filteredHistory
        if filtered.isEmpty {
            Text("没有符合筛选条件的记录")
                .font(.caption)
                .foregroundStyle(.secondary)
        } else {
            let sections = LocalSnapshotHistory.grouped(filtered, now: state.historyNow)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(sections, id: \.group.rawValue) { section in
                    let rows = Array(section.snapshots.prefix(Self.maxRows))
                    Text(section.group.title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    VStack(spacing: 6) {
                        ForEach(rows) { snapshot in
                            Button { selected = snapshot } label: { historyRow(snapshot) }
                                .buttonStyle(.plain)
                        }
                    }
                    if section.snapshots.count > rows.count {
                        Text("仅显示最近 \(rows.count) 条")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
    }

    private func historyRow(_ snapshot: LocalCompletedSessionSnapshot) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(snapshot.scenarioLabel).font(.footnote.weight(.medium))
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
        .padding(.vertical, 4)
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemBackground)))
    }

    /// Whole-percent completion for one snapshot (e.g. "80%").
    private static func completionPercent(_ s: LocalCompletedSessionSnapshot) -> String {
        guard s.totalTargetSets > 0 else { return "0%" }
        let pct = Int((Double(s.totalCompletedSets) / Double(s.totalTargetSets) * 100).rounded())
        return "\(min(100, max(0, pct)))%"
    }

    // MARK: - Export (Iter 9) — local-only debug copy

    private var exportSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                state.exportLatestDebugCopy()
            } label: {
                Text("生成本机 JSON 副本")
                    .font(.caption.weight(.medium))
            }
            .buttonStyle(.bordered)
            exportStatusText
            Text("仅在本机生成副本 · 不分享 · 不上传云端")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    @ViewBuilder
    private var exportStatusText: some View {
        switch state.exportStatus {
        case .idle:
            EmptyView()
        case .exported:
            Text("已生成本机 JSON 副本").font(.caption2).foregroundStyle(.green)
        case .nothingToExport:
            Text("暂无可导出的快照").font(.caption2).foregroundStyle(.secondary)
        case .failed(let message):
            Text("生成失败：\(message)").font(.caption2).foregroundStyle(.red)
        }
    }

    // MARK: - Storage diagnostics (Iter 11)

    private var diagnosticsSection: some View {
        let d = state.storageDiagnostics
        return VStack(alignment: .leading, spacing: 4) {
            Text("本机存储状态")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text("已保存 \(d.validCount) · 跳过无效 \(d.invalidCount) · 已隔离 \(d.quarantinedCount)")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.secondary)
            Text("备份 \(d.hasBackup ? "有" : "无") · 本机副本 \(d.hasExport ? "有" : "无")")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.secondary)
            // iOS-11: schema version breakdown + migration count.
            Text("schema v1 \(d.schemaV1Count) · v2 \(d.schemaV2Count) · 已迁移 \(d.migratedCount)")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.secondary)
            // iOS-12: latest restore status (honest, local).
            Text("最近恢复：\(restoreStatusText)")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var restoreStatusText: String {
        switch state.restoreStatus {
        case .idle:
            return "无"
        case .restored(let label):
            // iOS-13: surface reconciliation drift (skipped/new exercises) honestly.
            if let r = state.restoreReconciliation, r.hasDrift {
                return "已恢复「\(label)」· 跳过旧动作 \(r.unmatchedSnapshotIds.count) · 新动作 \(r.missingCurrentIds.count)"
            }
            return "已恢复「\(label)」"
        case .failed:
            return "上次失败"
        }
    }

    // MARK: - Clear

    private var clearButton: some View {
        Button(role: .destructive) {
            showingClearConfirm = true
        } label: {
            Text("清除本机已保存训练")
                .font(.subheadline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
        .buttonStyle(.bordered)
        .confirmationDialog(
            "清除本机已保存训练？",
            isPresented: $showingClearConfirm,
            titleVisibility: .visible
        ) {
            Button("清除（仅本机）", role: .destructive) { state.clearSavedSessions() }
            Button("取消", role: .cancel) {}
        } message: {
            Text("仅删除本机保存的训练快照，不影响云端（本应用没有云端）。")
        }
    }

    // MARK: - Filtering helpers

    private var filteredHistory: [LocalCompletedSessionSnapshot] {
        // iOS-14/15/16: delegate to the pure, unit-tested filter (search + scenario
        // + completed-only + coarse date range + custom from/to range); the store
        // already returns newest-first. The coarse range is measured against the
        // same injectable clock used for grouping (deterministic by default). When
        // the custom range is active it TAKES OVER — pass `.all` for the coarse one
        // so they don't double-filter (the pure function would otherwise AND them).
        LocalSnapshotHistory.filtered(
            state.savedHistory,
            query: searchQuery,
            scenarioId: scenarioFilter,
            completedOnly: completedOnly,
            dateRange: state.historyCustomRangeEnabled ? .all : state.historyDateRange,
            customRange: state.historyCustomRange,
            now: state.historyNow
        )
    }

    private struct ScenarioOption: Identifiable { let id: String; let label: String }

    private func distinctScenarios() -> [ScenarioOption] {
        var seen = Set<String>()
        var out: [ScenarioOption] = []
        for snap in state.savedHistory where !seen.contains(snap.scenarioId) {
            seen.insert(snap.scenarioId)
            out.append(ScenarioOption(id: snap.scenarioId, label: snap.scenarioLabel))
        }
        return out
    }

    private func scenarioFilterLabel(_ scenarios: [ScenarioOption]) -> String {
        guard let sc = scenarioFilter else { return "全部样例" }
        return scenarios.first(where: { $0.id == sc })?.label ?? sc
    }

    // MARK: - Time formatting

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

#Preview {
    FocusSavedSessionHistoryView(state: FocusModeMvpState())
        .padding()
}
