// FocusModeStatusSurfaceView — iOS-8 Native Local Training MVP Mega Migration V1.
//
// Part-2 status surface. Renders the readiness / risk / deload fields the
// TrainingDecisionCoreSlice exposes. Each row shows a Chinese label, the value
// (the engine enum's rawValue) and a small engine field-name sub-label so the
// demo is auditable.
//
// iOS-8: deload is now a real field on TrainingDecisionCoreSlice
// (slice.deload.level / .strategy), so the 减载档位 row shows the live engine
// value instead of the iOS-7 deferred "—".

import SwiftUI
import IronPathTrainingDecision

struct FocusModeStatusSurfaceView: View {
    let slice: TrainingDecisionCoreSlice

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("准备度 · 风险 · 训练调整")
                .font(.headline)

            VStack(spacing: 6) {
                row("训练阶段", value: slice.activePhase.rawValue, sub: "activePhase")
                row("本次训练", value: slice.sessionIntent.rawValue, sub: "sessionIntent")
                row("准备度", value: slice.readinessLevel.rawValue, sub: "readinessLevel")
                row("风险等级", value: slice.riskLevel.rawValue, sub: "riskLevel")
                row("训练调整", value: slice.trainingAdjustment.rawValue, sub: "trainingAdjustment")
                row("容量", value: slice.volumeMode.rawValue, sub: "volumeMode")
                row("强度", value: slice.intensityMode.rawValue, sub: "intensityMode")
                row("进度", value: slice.progressionMode.rawValue, sub: "progressionMode")
                row(
                    "负荷系数",
                    value: String(format: "%.2f", slice.finalVolumeMultiplier),
                    sub: "finalVolumeMultiplier"
                )
                // iOS-8: live engine deload — level as the value, strategy in the sub-label.
                row(
                    "减载档位",
                    value: slice.deload.level.rawValue,
                    sub: "deload · \(slice.deload.strategy.rawValue)"
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
    FocusModeStatusSurfaceView(slice: FocusModePreviewData.sampleCoreSlice(for: .severeRest))
        .padding()
}
