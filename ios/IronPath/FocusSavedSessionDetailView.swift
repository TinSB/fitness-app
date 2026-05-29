// FocusSavedSessionDetailView — iOS-10 Local Training Persistence Mega Bundle V1
// (Iteration 5: local saved-session detail).
//
// A local-only detail sheet for one saved snapshot: the engine context
// (sessionIntent / activePhase / deload), completed/target sets, the per-
// exercise rows, the local source note, and a small developer line with the
// schema version. This is NOT a full history app — no charts, no calendar, no
// cloud restore. Pure SwiftUI; never touches disk, network, cloud, or AppData.

import SwiftUI

struct FocusSavedSessionDetailView: View {
    let snapshot: LocalCompletedSessionSnapshot
    /// iOS-11: restore this saved session into an in-RAM training draft and
    /// continue it. Optional so previews can omit it.
    var onContinue: (() -> Void)? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard
                if onContinue != nil { continueCard }
                contextCard
                exerciseListCard
                footerNote
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
    }

    @ViewBuilder
    private var continueCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                onContinue?()
            } label: {
                Text("继续这次训练（本机草稿）")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            Text("在本机把这次训练恢复为草稿并继续 · 不写入云端 · 不改动其它数据")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("已保存训练详情（本机）")
                .font(.title2.weight(.semibold))
            Text(Self.displayTime(snapshot.createdAtIso))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
            Text("仅保存在本机 · 不同步云端")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var contextCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("训练决策上下文")
                .font(.headline)
            row("样例", snapshot.scenarioLabel)
            row("本次训练", snapshot.sessionIntent)
            row("训练阶段", snapshot.activePhase)
            row("减载档位", "\(snapshot.deloadLevel) · \(snapshot.deloadStrategy)")
            row("完成组数", "\(snapshot.totalCompletedSets) / \(snapshot.totalTargetSets)")
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private var exerciseListCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("完成动作")
                .font(.headline)
            if snapshot.exercises.isEmpty {
                Text("没有完成的动作")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 8) {
                    ForEach(snapshot.exercises) { ex in
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(ex.name).font(.subheadline.weight(.medium))
                                Text(ex.role).font(.caption2).foregroundStyle(.tertiary)
                            }
                            Spacer()
                            Text("\(ex.completedSets) / \(ex.targetSets) 组")
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

    private var footerNote: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("来源：\(snapshot.source)")
                .font(.caption2)
                .foregroundStyle(.tertiary)
            // Small developer-facing line; clearly local.
            Text("本机快照 schema v\(snapshot.schemaVersion) · id \(snapshot.snapshotId)")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func row(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).font(.subheadline).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.subheadline.monospacedDigit()).foregroundStyle(.primary)
        }
    }

    /// Render an ISO-8601 instant as a compact UTC `yyyy-MM-dd HH:mm` label.
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
        fmt.dateFormat = "yyyy-MM-dd HH:mm 'UTC'"
        return fmt.string(from: date)
    }
}

#Preview {
    FocusSavedSessionDetailView(
        snapshot: LocalCompletedSessionSnapshot(
            snapshotId: "focus-normal-2",
            createdAtIso: "2026-05-27T10:00:00.000Z",
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
                    exerciseId: "bench-press", name: "平板卧推", role: "secondary-compound",
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 3, targetSets: 3)
                ),
                LocalCompletedExerciseSnapshot(
                    exerciseId: "lateral-raise", name: "哑铃侧平举", role: "isolation",
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 2, targetSets: 3)
                ),
            ]
        )
    )
}
