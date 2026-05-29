// FocusSetChecklistView — iOS-7 Native Focus MVP Bundle V1.
//
// One card for the currently selected exercise. Shows a row of
// targetSets capsules (filled = completed, hollow = pending),
// the big "completed / target" readout, plus the "完成本组" tap
// target. Pure UI; the action is forwarded to FocusModeMvpState
// by the caller.

import SwiftUI

struct FocusSetChecklistView: View {
    let exerciseName: String
    let exerciseMuscle: String
    let roleLabel: String
    let targetSets: Int
    let completedSets: Int
    let onCompleteOneSet: () -> Void

    private var clampedCompleted: Int {
        max(0, min(targetSets, completedSets))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(exerciseName)
                        .font(.title3.weight(.semibold))
                    HStack(spacing: 6) {
                        Text(exerciseMuscle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(roleLabel)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Color.secondary.opacity(0.15))
                            )
                    }
                }
                Spacer()
                Text("\(clampedCompleted) / \(targetSets)")
                    .font(.system(size: 36, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(.primary)
            }

            if targetSets > 0 {
                HStack(spacing: 8) {
                    ForEach(0..<targetSets, id: \.self) { index in
                        Capsule()
                            .fill(index < clampedCompleted ? Color.accentColor : Color.secondary.opacity(0.2))
                            .frame(height: 10)
                    }
                }
            }

            Button {
                onCompleteOneSet()
            } label: {
                Text(clampedCompleted >= targetSets ? "本动作已完成" : "完成本组")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .disabled(clampedCompleted >= targetSets)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

#Preview {
    FocusSetChecklistView(
        exerciseName: "平板卧推",
        exerciseMuscle: "胸",
        roleLabel: "secondary-compound",
        targetSets: 3,
        completedSets: 1,
        onCompleteOneSet: {}
    )
    .padding()
}
