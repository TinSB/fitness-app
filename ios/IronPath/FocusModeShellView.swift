// FocusModeShellView — iOS-6 Focus Mode Sample Selector V1.
//
// Top-level SwiftUI shell that proves the iOS app can consume Swift
// TrainingDecision output end-to-end:
//   1. Header: IronPath Native Focus
//   2. Segmented sample-scenario Picker (普通 / 回归保底 / 严重恢复)
//   3. Scenario explanation line
//   4. TrainingDecisionSummaryView (status card)
//   5. Today exercise list (FocusModeExerciseCard per item)
//   6. Footer: "本地 Swift TrainingDecision · 无云同步 · 无 HealthKit"
//
// Pure presentation. The TrainingDecision slice is recomputed via
// FocusModePreviewData each time the scenario changes — same scenario in,
// same slice out (deterministic).

import SwiftUI
import IronPathTrainingDecision

struct FocusModeShellView: View {
    @State private var scenario: FocusModeSampleScenario = .normal

    private var slice: TrainingDecisionCoreSlice {
        FocusModePreviewData.sampleCoreSlice(for: scenario)
    }

    private var rows: [FocusModeExerciseRow] {
        Self.buildRows(
            slice: slice,
            templates: FocusModePreviewData.sampleTemplateExercises()
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                scenarioSelector

                TrainingDecisionSummaryView(slice: slice)

                exerciseListSection

                footer
            }
            .padding(16)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
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
            Picker("样例", selection: $scenario) {
                ForEach(FocusModeSampleScenario.allCases) { item in
                    Text(item.shortLabel).tag(item)
                }
            }
            .pickerStyle(.segmented)

            Text(scenario.explanation)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
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
                        FocusModeExerciseCard(row: row)
                    }
                }
            }
        }
    }

    private var footer: some View {
        Text("本地 Swift TrainingDecision · 无云同步 · 无 HealthKit")
            .font(.footnote)
            .foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, 8)
    }

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
