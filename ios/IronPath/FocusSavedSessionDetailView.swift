// FocusSavedSessionDetailView — iOS-10 Local Training Persistence Mega Bundle V1
// (Iteration 5: local saved-session detail); iOS-15 adds PER-EXERCISE RECOVERY
// INSIGHT + an honest "resume where you left off" affordance.
//
// A local-only detail sheet for one saved snapshot: the engine context
// (sessionIntent / activePhase / deload), completed/target sets, the per-
// exercise rows, the local source note, and a small developer line with the
// schema version. iOS-15 layers in a READ-ONLY recovery view: each saved
// exercise is tagged 可恢复 / 已变更 (derived purely from the existing restore
// reconciliation), a short drift note, a list of new current exercises the
// snapshot has no progress for, and a resume affordance that reuses the EXISTING
// in-memory draft restore (no new restore semantics). This is NOT a full history
// app — no charts, no calendar, no cloud restore. Pure SwiftUI; never touches
// disk, network, cloud, or AppData.

import SwiftUI
import IronPathDomain
import IronPathLocalSnapshot

struct FocusSavedSessionDetailView: View {
    let snapshot: LocalCompletedSessionSnapshot
    /// iOS-15: the CURRENT scenario's exercise ids, supplied by the caller so the
    /// sheet can project a read-only recovery insight via the pure
    /// `LocalSnapshotRecovery.insight`. Defaults to empty for previews (which then
    /// shows an honest "nothing restorable" state).
    var currentExerciseIds: [String] = []
    /// iOS-17A: display unit for the per-set "上次成绩" weights. Storage is always
    /// kg (the v3 `setLogs` carry kg); this only formats the value at render time.
    /// Defaults to `.kg` for previews.
    var displayUnit: WeightUnit = .kg
    /// iOS-11: restore this saved session into an in-RAM training draft and
    /// continue it. Optional so previews can omit it.
    var onContinue: (() -> Void)? = nil

    /// Pure, read-only projection over the existing restore reconciliation. No
    /// progress is applied here; restore still happens only via `onContinue`.
    private var insight: LocalSnapshotRecoveryInsight {
        LocalSnapshotRecovery.insight(from: snapshot, currentExerciseIds: currentExerciseIds)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard
                if onContinue != nil { resumeCard }
                contextCard
                recoveryInsightCard
                exerciseListCard
                footerNote
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
    }

    // MARK: - iOS-15 resume affordance (thin UI over the EXISTING restore)

    @ViewBuilder
    private var resumeCard: some View {
        let insight = self.insight
        VStack(alignment: .leading, spacing: 6) {
            if insight.isRestorable {
                if let index = insight.resumeExerciseIndex, let name = insight.resumeExerciseName {
                    Text("上次练到第 \(index + 1) / \(insight.currentExerciseCount) 个动作：\(name)")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                }
                Button {
                    onContinue?()
                } label: {
                    Text("从这里继续（本机草稿）")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                Text("在本机把这次训练恢复为草稿并继续 · 不写入云端 · 不改动其它数据")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            } else {
                // Honest disabled state: nothing in this saved session still maps
                // to the current scenario, so there is nothing to continue.
                Text("无法继续这次训练")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                Button {} label: {
                    Text("从这里继续（本机草稿）")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .disabled(true)
                Text("这次存档的动作已全部变更或无法恢复，本机无法继续。")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("已保存训练详情（本机）")
                .font(.title2.weight(.semibold))
            Text(Self.displayTime(snapshot.createdAtIso))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
            // iOS-12: schema badge + restore-eligibility (detail only opens for
            // already-validated saved snapshots, so they are restore-eligible).
            HStack(spacing: 6) {
                Text("schema v\(snapshot.schemaVersion)")
                    .font(.caption2.monospacedDigit())
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(RoundedRectangle(cornerRadius: 4).fill(Color(.tertiarySystemBackground)))
                Text("本机可恢复继续")
                    .font(.caption2)
                    .foregroundStyle(.green)
            }
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

    // MARK: - iOS-15 per-exercise recovery insight (read-only)

    @ViewBuilder
    private var recoveryInsightCard: some View {
        let insight = self.insight
        // Only meaningful once we know the current scenario (caller supplied ids).
        if !currentExerciseIds.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("恢复明细（本机）")
                    .font(.headline)
                if insight.hasDrift {
                    Text("这次存档与当前训练样例有差异：可恢复的动作会带回进度，已变更的不会。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("这次存档与当前训练样例一致，全部动作均可恢复进度。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                VStack(spacing: 8) {
                    ForEach(insight.rows, id: \.exerciseId) { row in
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.name).font(.subheadline.weight(.medium))
                                Text("\(row.completedSets) / \(row.targetSets) 组")
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(.tertiary)
                            }
                            Spacer()
                            recoveryBadge(row.status)
                        }
                        .padding(.vertical, 6)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemBackground)))
                    }
                }
                if !insight.newCurrentExerciseIds.isEmpty {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("新动作（本机无进度）")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(insight.newCurrentExerciseIds.joined(separator: " · "))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
        }
    }

    @ViewBuilder
    private func recoveryBadge(_ status: LocalRecoveryStatus) -> some View {
        switch status {
        case .restorable:
            Text("可恢复")
                .font(.caption2.weight(.medium))
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(Color.green.opacity(0.15)))
                .foregroundStyle(.green)
        case .changed:
            Text("已变更")
                .font(.caption2.weight(.medium))
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(Color.orange.opacity(0.15)))
                .foregroundStyle(.orange)
        }
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
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(ex.name).font(.subheadline.weight(.medium))
                                    Text(ex.role).font(.caption2).foregroundStyle(.tertiary)
                                }
                                Spacer()
                                Text("\(ex.completedSets) / \(ex.targetSets) 组")
                                    .font(.subheadline.monospacedDigit())
                            }
                            perSetSummary(for: ex)
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

    // MARK: - iOS-17A per-set "上次成绩" summary (DERIVED display copy)

    /// Render the v3 per-set detail (weight / reps / RIR) for one exercise. A
    /// legacy v1/v2 session (or a set logged with no metrics) carries no
    /// `setLogs`, so this honestly shows "无逐组明细" rather than fabricating data.
    /// Weight is stored in kg and converted to the caller's `displayUnit` here.
    @ViewBuilder
    private func perSetSummary(for exercise: LocalCompletedExerciseSnapshot) -> some View {
        if let logs = exercise.setLogs, !logs.isEmpty {
            VStack(alignment: .leading, spacing: 3) {
                ForEach(logs, id: \.setIndex) { entry in
                    HStack(spacing: 6) {
                        Text("第 \(entry.setIndex + 1) 组")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(Self.setLine(entry, displayUnit: displayUnit))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.primary)
                    }
                }
            }
            .padding(.top, 2)
        } else {
            Text("无逐组明细")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    /// One per-set line, e.g. "60kg · 8次 · RIR 2". Each metric is shown only when
    /// present (honest "not entered" → omitted, never a fabricated 0); a fully
    /// blank set degrades to "已完成".
    static func setLine(_ entry: LocalCompletedSetEntrySnapshot, displayUnit: WeightUnit) -> String {
        var parts: [String] = []
        if let kg = entry.weightKg, let shown = WeightConversion.fromKilograms(kg, to: displayUnit) {
            parts.append("\(formatWeight(shown))\(displayUnit.rawValue)")
        }
        if let reps = entry.reps { parts.append("\(reps)次") }
        if let rir = entry.rir { parts.append("RIR \(rir)") }
        return parts.isEmpty ? "已完成" : parts.joined(separator: " · ")
    }

    /// Format a display-unit weight: drop the trailing ".0" for whole values
    /// (60, not 60.0); keep one decimal otherwise (137.5).
    private static func formatWeight(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value.rounded()))
        }
        return String(format: "%.1f", value)
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
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 3, targetSets: 3),
                    setLogs: [
                        LocalCompletedSetEntrySnapshot(setIndex: 0, weightKg: 60, reps: 8, rir: 2),
                        LocalCompletedSetEntrySnapshot(setIndex: 1, weightKg: 62.5, reps: 6, rir: 1),
                        LocalCompletedSetEntrySnapshot(setIndex: 2, weightKg: 62.5, reps: 5, rir: 0),
                    ]
                ),
                // A legacy / no-detail exercise: no setLogs → honest "无逐组明细".
                LocalCompletedExerciseSnapshot(
                    exerciseId: "lateral-raise", name: "哑铃侧平举", role: "isolation",
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 2, targetSets: 3)
                ),
            ]
        ),
        // Preview the partial-drift path: bench-press still exists, lateral-raise
        // changed, and "cable-fly" is a new current exercise.
        currentExerciseIds: ["bench-press", "cable-fly"],
        onContinue: {}
    )
}
