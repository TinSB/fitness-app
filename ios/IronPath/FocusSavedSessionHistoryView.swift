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

struct FocusSavedSessionHistoryView: View {
    @ObservedObject var state: FocusModeMvpState

    /// Cap the preview list so this stays a small surface, not a full archive.
    private static let maxRows = 8

    @State private var showingClearConfirm = false
    @State private var scenarioFilter: String? = nil      // nil = all scenarios
    @State private var completedOnly = false
    @State private var selected: LocalCompletedSessionSnapshot? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header

            if let errorMessage = state.saveErrorMessage {
                errorBanner(errorMessage)
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
            FocusSavedSessionDetailView(snapshot: snapshot)
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
            Text("本机统计")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                statTile("已保存", "\(s.totalSessions)")
                statTile("完成组", "\(s.totalCompletedSets)")
                statTile("目标组", "\(s.totalTargetSets)")
                statTile("完成率", s.completionPercentText)
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
            scenarioFilterMenu
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

    // MARK: - Recent list (filtered, newest-first, tap → detail)

    @ViewBuilder
    private var recentList: some View {
        let rows = Array(filteredHistory.prefix(Self.maxRows))
        if rows.isEmpty {
            Text("没有符合筛选条件的记录")
                .font(.caption)
                .foregroundStyle(.secondary)
        } else {
            VStack(spacing: 6) {
                ForEach(rows) { snapshot in
                    Button { selected = snapshot } label: { historyRow(snapshot) }
                        .buttonStyle(.plain)
                }
            }
            if filteredHistory.count > rows.count {
                Text("仅显示最近 \(rows.count) 条")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private func historyRow(_ snapshot: LocalCompletedSessionSnapshot) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(snapshot.scenarioLabel).font(.footnote.weight(.medium))
                Text(snapshot.sessionIntent).font(.caption2).foregroundStyle(.tertiary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(snapshot.totalCompletedSets) / \(snapshot.totalTargetSets) 组")
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
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
        var rows = state.savedHistory   // newest-first as the store returns
        if let sc = scenarioFilter {
            rows = rows.filter { $0.scenarioId == sc }
        }
        if completedOnly {
            rows = rows.filter { $0.totalTargetSets > 0 && $0.totalCompletedSets >= $0.totalTargetSets }
        }
        return rows
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
