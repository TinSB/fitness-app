// FocusSavedSessionPreviewView — iOS-8 Native Local Training MVP Mega Migration V1.
//
// The local saved-session preview shown after the user completes a workout. It
// renders the in-RAM FocusCompletedSessionSummary: the engine context
// (sessionIntent / activePhase / deload level), each completed exercise with
// completed/target sets, the aggregate, and a deterministic timestamp string.
//
// 100% in-RAM. This is NOT a disk save — the summary lives only in
// FocusModeMvpState and is cleared on scenario change / app restart. On-disk
// JSON persistence is a documented deferred follow-up.

import SwiftUI

struct FocusSavedSessionPreviewView: View {
    let summary: FocusCompletedSessionSummary
    /// iOS-10: whether the local JSON save actually succeeded. The header must
    /// reflect reality — when the save FAILED, the dominant title must NOT claim
    /// "已保存（本机）" (that would contradict the failure banner = fake success).
    let saved: Bool
    let onStartNew: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(saved ? "已保存（本机）" : "未保存到本机")
                    .font(.largeTitle.weight(.semibold))
                    .foregroundStyle(saved ? Color.primary : Color.red)
                Text(saved
                     ? "本次训练已保存到本机（仅本机 · 不同步云端）"
                     : "本次训练未写入本机 · 仅本次预览可用")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            engineContextCard

            completedListCard

            Button {
                onStartNew()
            } label: {
                Text("再来一次（清空本机快照）")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var engineContextCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("训练决策上下文")
                .font(.headline)
            row("样例", summary.scenarioLabel)
            row("本次训练", summary.sessionIntent)
            row("训练阶段", summary.activePhase)
            row("减载档位", "\(summary.deloadLevel) · \(summary.deloadStrategy)")
            row("完成组数", "\(summary.totalCompletedSets) / \(summary.totalTargetSets)")
            row("时间", summary.timestampLabel)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private var completedListCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("完成动作")
                .font(.headline)
            if summary.lines.isEmpty {
                Text("没有完成的动作")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 8) {
                    ForEach(summary.lines) { line in
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(line.name).font(.subheadline.weight(.medium))
                                Text(line.role).font(.caption2).foregroundStyle(.tertiary)
                            }
                            Spacer()
                            Text("\(line.completedSets) / \(line.targetSets) 组")
                                .font(.subheadline.monospacedDigit())
                        }
                        .padding(.vertical, 6)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemBackground)))
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    @ViewBuilder
    private func row(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).font(.subheadline).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.subheadline.monospacedDigit()).foregroundStyle(.primary)
        }
    }
}

#Preview {
    FocusSavedSessionPreviewView(
        summary: FocusCompletedSessionSummary(
            scenarioLabel: "减载周",
            sessionIntent: "deload-week",
            activePhase: "base",
            deloadLevel: "none",
            deloadStrategy: "maintain",
            lines: [
                FocusCompletedExerciseLine(id: "bench-press", name: "平板卧推", role: "secondary-compound", completedSets: 2, targetSets: 2),
            ],
            totalCompletedSets: 2,
            totalTargetSets: 2,
            timestampLabel: "2026-05-27 10:00 UTC"
        ),
        saved: true,
        onStartNew: {}
    )
    .padding()
}
