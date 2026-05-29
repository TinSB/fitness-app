// FocusSavedSessionHistoryView — iOS-9 Local JSON Persistence + Saved Session
// History V1.
//
// A small, local-only saved-session surface shown on the plan screen. It is a
// preview list, NOT a full history app: a local-only disclaimer, the latest
// saved session card, a short list of recent saved snapshots, and a clear
// action. No charts, no calendar, no cloud restore.
//
// All data comes from FocusModeMvpState (loaded from the sanctioned app-local
// JSON store on launch). This view is pure SwiftUI — it never touches disk,
// the network, the cloud, or AppData.

import SwiftUI

struct FocusSavedSessionHistoryView: View {
    let latest: LocalCompletedSessionSnapshot?
    let history: [LocalCompletedSessionSnapshot]
    let errorMessage: String?
    let onClear: () -> Void

    /// Cap the preview list so this stays a small surface, not a full archive.
    private static let maxRows = 5

    @State private var showingClearConfirm = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header

            if let errorMessage {
                errorBanner(errorMessage)
            }

            if let latest {
                latestCard(latest)
                recentList
                clearButton
            } else {
                emptyState
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
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

    private var emptyState: some View {
        Text("还没有在本机保存的训练。完成一次训练后会自动保存在本机。")
            .font(.subheadline)
            .foregroundStyle(.secondary)
    }

    // MARK: - Latest card

    private func latestCard(_ snapshot: LocalCompletedSessionSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("最近一次")
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

    // MARK: - Recent list

    @ViewBuilder
    private var recentList: some View {
        let rows = Array(history.prefix(Self.maxRows))
        if rows.count > 1 {
            VStack(alignment: .leading, spacing: 6) {
                Text("近期记录")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                VStack(spacing: 6) {
                    ForEach(rows) { snapshot in
                        historyRow(snapshot)
                    }
                }
                if history.count > rows.count {
                    Text("仅显示最近 \(rows.count) 条")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
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
            Button("清除（仅本机）", role: .destructive, action: onClear)
            Button("取消", role: .cancel) {}
        } message: {
            Text("仅删除本机保存的训练快照，不影响云端（本应用没有云端）。")
        }
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

#Preview("已保存") {
    let sample = LocalCompletedSessionSnapshot(
        snapshotId: "focus-normal-2",
        createdAtIso: "2026-05-27T10:00:00.000Z",
        scenarioId: "normal",
        scenarioLabel: "普通",
        sessionIntent: "normal-session",
        activePhase: "base",
        deloadLevel: "none",
        deloadStrategy: "maintain",
        totalCompletedSets: 8,
        totalTargetSets: 10,
        exercises: []
    )
    return FocusSavedSessionHistoryView(
        latest: sample,
        history: [sample, sample],
        errorMessage: nil,
        onClear: {}
    )
    .padding()
}

#Preview("空") {
    FocusSavedSessionHistoryView(latest: nil, history: [], errorMessage: nil, onClear: {})
        .padding()
}
