// FocusModeShellView — iOS-7 Native Focus MVP Bundle V1.
//
// Top-level SwiftUI shell for the native Focus demo. Two modes,
// driven by FocusModeMvpState:
//
//   Plan mode (isInSession == false):
//     1. Header
//     2. Scenario picker (普通 / 回归保底 / 严重恢复 / 减载周)
//     3. Scenario explanation line
//     4. FocusModeStatusSurfaceView (准备度/风险/训练调整)
//     5. Today exercise list (FocusModeExerciseCard per item)
//     6. "开始训练" CTA + "重置样例" secondary action
//     7. Footer
//
//   In-session mode (isInSession == true):
//     1. Back link + scenario badge
//     2. FocusSessionProgressView (aggregate completed/target)
//     3. Current exercise checklist (FocusSetChecklistView)
//        — "完成本组" clamps to targetSets in memory
//     4. 上一动作 / 下一动作 navigation
//     5. FocusModeStatusSurfaceView (always-visible context)
//     6. "重置样例" / "结束训练" + footer
//
// 100% in-memory; never writes AppData, never persists. The slice is
// recomputed via FocusModePreviewData on each scenario change — same
// scenario in, same slice out (deterministic).

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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if state.isInSession {
                    inSessionBody
                } else {
                    planBody
                }
                footer
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
    }

    // MARK: - Plan mode

    private var planBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            header

            scenarioSelector

            FocusModeStatusSurfaceView(slice: slice)

            exerciseListSection

            actionStack
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

            FocusSessionProgressView(
                totalCompleted: totalCompletedSets,
                totalTarget: totalTargetSets
            )

            currentExerciseSection

            navigationStack

            FocusModeStatusSurfaceView(slice: slice)

            sessionActionStack
        }
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
