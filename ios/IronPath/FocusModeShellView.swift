// FocusModeShellView — iOS-8 Native Local Training MVP Mega Migration V1.
//
// Top-level SwiftUI shell for the native Focus demo. THREE stages, driven by
// FocusModeMvpState.stage:
//
//   .plan
//     Header, scenario picker (普通/回归保底/严重恢复/减载周), explanation,
//     FocusModeStatusSurfaceView (准备度/风险/训练调整/减载档位 — iOS-8 live deload),
//     today exercise list, "开始训练" / "重置样例", footer.
//
//   .inSession
//     Back link + scenario badge, FocusSessionProgressView (aggregate),
//     current-exercise FocusSetChecklistView ("完成本组" clamps in memory),
//     上一动作/下一动作, status surface, FocusSessionCompletionView
//     ("完成本次训练" -> in-RAM snapshot), "重置样例"/"结束训练", footer.
//
//   .completed
//     FocusSavedSessionPreviewView — the in-RAM saved-session preview
//     (completed exercises, sets, sessionIntent, activePhase, deload, timestamp),
//     "再来一次".
//
// 100% in-memory; never writes AppData, never persists to disk. The slice is
// recomputed via FocusModePreviewData on each scenario change — same scenario
// in, same slice out (deterministic). On-disk JSON save is a deferred follow-up.

import SwiftUI
import IronPathTrainingDecision

struct FocusModeShellView: View {
    @StateObject private var state = FocusModeMvpState()

    private var slice: TrainingDecisionCoreSlice {
        FocusModePreviewData.sampleCoreSlice(for: state.selectedScenario)
    }

    private var rows: [FocusModeExerciseRow] {
        Self.buildRows(
            slice: slice,
            templates: FocusModePreviewData.sampleTemplateExercises()
        )
    }

    private var totalTargetSets: Int {
        rows.reduce(0) { $0 + $1.targetSets }
    }

    private var totalCompletedSets: Int {
        state.totalCompletedSets(for: rows.map(\.id))
    }

    private var currentRow: FocusModeExerciseRow? {
        guard !rows.isEmpty else { return nil }
        let clamped = min(max(0, state.selectedExerciseIndex), rows.count - 1)
        return rows[clamped]
    }

    /// Engine-derived completed lines for the in-RAM completion snapshot.
    private var completedLines: [FocusCompletedExerciseLine] {
        rows.map { row in
            FocusCompletedExerciseLine(
                id: row.id,
                name: row.name,
                role: roleLabel(row.role),
                completedSets: state.completedSets(for: row.id),
                targetSets: row.targetSets
            )
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch state.stage {
                case .plan:
                    planBody
                case .inSession:
                    inSessionBody
                case .completed:
                    completedBody
                }
                footer
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        // iOS-9: load the latest saved session + history from the app-local
        // JSON store on launch.
        .task { state.loadSavedSessions() }
    }

    // MARK: - Completed preview

    @ViewBuilder
    private var completedBody: some View {
        if let summary = state.completedSummary {
            VStack(alignment: .leading, spacing: 12) {
                saveStatusBanner
                FocusSavedSessionPreviewView(
                    summary: summary,
                    saved: state.saveStatus == .saved,
                    onStartNew: { state.startNewSession() }
                )
            }
        } else {
            planBody
        }
    }

    /// Honest save feedback on the completed screen. `.failed` never reads as
    /// success — it shows the error and notes the in-RAM preview still works.
    @ViewBuilder
    private var saveStatusBanner: some View {
        switch state.saveStatus {
        case .saved:
            Text("已保存到本机 · 可在计划页查看历史")
                .font(.footnote)
                .foregroundStyle(.green)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.green.opacity(0.12)))
        case .failed(let message):
            Text("本地保存失败：\(message) · 本次预览仍可用")
                .font(.footnote)
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.red.opacity(0.12)))
        case .idle:
            EmptyView()
        }
    }

    // MARK: - Plan mode

    private var planBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            header

            scenarioSelector

            FocusModeStatusSurfaceView(slice: slice)

            exerciseListSection

            actionStack

            FocusSavedSessionHistoryView(state: state)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("IronPath Native Focus")
                .font(.largeTitle.weight(.semibold))
            Text("Native SwiftUI · TrainingDecision V1")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var scenarioSelector: some View {
        VStack(alignment: .leading, spacing: 6) {
            Picker("样例", selection: scenarioBinding) {
                ForEach(FocusModeSampleScenario.allCases) { item in
                    Text(item.shortLabel).tag(item)
                }
            }
            .pickerStyle(.segmented)

            Text(state.selectedScenario.explanation)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var scenarioBinding: Binding<FocusModeSampleScenario> {
        Binding(
            get: { state.selectedScenario },
            set: { state.setScenario($0) }
        )
    }

    private var exerciseListSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("今日动作")
                    .font(.headline)
                Spacer()
                if let minSets = slice.minTargetSets {
                    Text("最少 \(minSets) 组")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            if rows.isEmpty {
                Text("没有可显示的动作")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 8) {
                    ForEach(rows) { row in
                        FocusModeExerciseCard(
                            row: row,
                            completedSets: state.completedSets(for: row.id)
                        )
                    }
                }
            }
        }
    }

    private var actionStack: some View {
        VStack(spacing: 8) {
            Button {
                state.startSession()
            } label: {
                Text("开始训练")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .disabled(rows.isEmpty)

            Button {
                state.resetProgress()
            } label: {
                Text("重置样例")
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.bordered)
        }
    }

    // MARK: - In-session mode

    private var inSessionBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            inSessionHeader

            if state.isRestoredDraft {
                restoredDraftBanner
            }

            FocusSessionProgressView(
                totalCompleted: totalCompletedSets,
                totalTarget: totalTargetSets
            )

            currentExerciseSection

            navigationStack

            FocusModeStatusSurfaceView(slice: slice)

            FocusSessionCompletionView(
                totalCompleted: totalCompletedSets,
                totalTarget: totalTargetSets,
                onCompleteSession: {
                    state.completeSession(slice: slice, lines: completedLines)
                }
            )

            sessionActionStack
        }
    }

    /// iOS-11: shown when the in-session draft was restored from a saved local
    /// snapshot (continue-a-saved-session). iOS-13: also surfaces reconciliation
    /// drift (saved exercises skipped / new exercises added). Local-only draft.
    @ViewBuilder
    private var restoredDraftBanner: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("已恢复本机草稿 · 继续训练（仅本机 · 未写入云端）")
                .font(.footnote)
            if let r = state.restoreReconciliation, r.hasDrift {
                Text("注意：\(r.unmatchedSnapshotIds.count) 个旧动作已跳过（已不在该样例中），\(r.missingCurrentIds.count) 个新动作从 0 组开始")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(.blue)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.blue.opacity(0.12)))
    }

    private var inSessionHeader: some View {
        HStack(alignment: .firstTextBaseline) {
            Button {
                state.endSession()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                    Text("返回")
                }
                .font(.subheadline)
            }
            Spacer()
            Text(state.selectedScenario.shortLabel)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.secondary.opacity(0.15))
                )
        }
    }

    @ViewBuilder
    private var currentExerciseSection: some View {
        if let row = currentRow {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text("当前动作")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("第 \(state.selectedExerciseIndex + 1) / \(rows.count) 个")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                FocusSetChecklistView(
                    exerciseName: row.name,
                    exerciseMuscle: row.muscle,
                    roleLabel: roleLabel(row.role),
                    targetSets: row.targetSets,
                    completedSets: state.completedSets(for: row.id),
                    onCompleteOneSet: {
                        state.completeOneSet(for: row.id, target: row.targetSets)
                    }
                )
            }
        } else {
            Text("没有可显示的动作")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var navigationStack: some View {
        if rows.count > 1 {
            VStack(alignment: .leading, spacing: 6) {
                if let nextRow = nextRow() {
                    Text("下一动作：\(nextRow.name)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 8) {
                    Button {
                        state.moveToPreviousExercise()
                    } label: {
                        Text("上一动作")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    }
                    .buttonStyle(.bordered)
                    .disabled(state.selectedExerciseIndex <= 0)

                    Button {
                        state.moveToNextExercise(totalCount: rows.count)
                    } label: {
                        Text("下一动作")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(state.selectedExerciseIndex >= rows.count - 1)
                }
            }
        }
    }

    private var sessionActionStack: some View {
        VStack(spacing: 8) {
            Button {
                state.resetProgress()
            } label: {
                Text("重置样例")
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.bordered)

            Button {
                state.endSession()
            } label: {
                Text("结束训练（回到计划）")
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.bordered)
        }
    }

    private func nextRow() -> FocusModeExerciseRow? {
        let nextIndex = state.selectedExerciseIndex + 1
        guard nextIndex < rows.count else { return nil }
        return rows[nextIndex]
    }

    private func roleLabel(_ role: ExerciseRole) -> String {
        switch role {
        case .mainCompound: return "main-compound"
        case .secondaryCompound: return "secondary-compound"
        case .accessory: return "accessory"
        case .isolation: return "isolation"
        }
    }

    // MARK: - Footer

    private var footer: some View {
        Text("本地 Swift TrainingDecision · 无云同步 · 无 HealthKit")
            .font(.footnote)
            .foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, 8)
    }

    // MARK: - Build rows

    private static func buildRows(
        slice: TrainingDecisionCoreSlice,
        templates: [TrainingDecisionTemplateExercise]
    ) -> [FocusModeExerciseRow] {
        let templateById = Dictionary(uniqueKeysWithValues: templates.map { ($0.id, $0) })
        return slice.perExercise.compactMap { target in
            guard let template = templateById[target.exerciseId] else { return nil }
            let floor = slice.exerciseRoleFloors[target.role] ?? 1
            return FocusModeExerciseRow(
                id: target.exerciseId,
                name: template.name,
                muscle: template.muscle,
                kind: template.kind,
                role: target.role,
                targetSets: target.targetSets,
                roleFloor: floor
            )
        }
    }
}

#Preview {
    FocusModeShellView()
}
