// TrainingDecisionSummaryView — iOS-5 Native Focus Mode Shell V1.
//
// Status card rendering the core-slice top-level fields the task requires:
//   activePhase / sessionIntent / volumeMode / intensityMode / progressionMode
//   / finalVolumeMultiplier.
//
// Pure presentation. The slice is computed once upstream — this view never
// triggers an engine call.

import SwiftUI
import IronPathTrainingDecision

struct TrainingDecisionSummaryView: View {
    let slice: TrainingDecisionCoreSlice

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("训练决策概览")
                .font(.headline)

            VStack(spacing: 6) {
                row("训练阶段", value: slice.activePhase.rawValue, sub: "activePhase")
                row("本次训练", value: slice.sessionIntent.rawValue, sub: "sessionIntent")
                row("容量", value: slice.volumeMode.rawValue, sub: "volumeMode")
                row("强度", value: slice.intensityMode.rawValue, sub: "intensityMode")
                row("进度", value: slice.progressionMode.rawValue, sub: "progressionMode")
                row(
                    "负荷系数",
                    value: String(format: "%.2f", slice.finalVolumeMultiplier),
                    sub: "finalVolumeMultiplier"
                )
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    @ViewBuilder
    private func row(_ label: String, value: String, sub: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.subheadline)
                Text(sub)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            Text(value)
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.primary)
        }
    }
}

#Preview {
    TrainingDecisionSummaryView(slice: FocusModePreviewData.sampleCoreSlice())
        .padding()
}
