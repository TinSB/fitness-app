// FocusModeExerciseCard — iOS-7 Native Focus MVP Bundle V1.
//
// One row per exercise: Chinese name + role + completed/target sets +
// role floor. Pure presentation — `completedSets` is supplied by the
// caller (FocusModeMvpState in the shell). No AppData mutation.

import SwiftUI
import IronPathTrainingDecision

struct FocusModeExerciseRow: Identifiable, Equatable {
    let id: String
    let name: String
    let muscle: String
    let kind: String
    let role: ExerciseRole
    let targetSets: Int
    let roleFloor: Int
}

struct FocusModeExerciseCard: View {
    let row: FocusModeExerciseRow
    var completedSets: Int = 0

    private var clampedCompleted: Int {
        max(0, min(row.targetSets, completedSets))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(row.name)
                    .font(.headline)
                Spacer()
                Text("\(clampedCompleted) / \(row.targetSets) 组")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.primary)
            }
            HStack(spacing: 8) {
                Text(row.muscle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(roleLabel(row.role))
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(RoundedRectangle(cornerRadius: 4).fill(Color.secondary.opacity(0.15)))
                Text(kindLabel(row.kind))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("下限 \(row.roleFloor)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private func roleLabel(_ role: ExerciseRole) -> String {
        switch role {
        case .mainCompound: return "main-compound"
        case .secondaryCompound: return "secondary-compound"
        case .accessory: return "accessory"
        case .isolation: return "isolation"
        }
    }

    private func kindLabel(_ kind: String) -> String {
        switch kind {
        case "compound": return "复合"
        case "machine": return "器械"
        case "isolation": return "孤立"
        default: return kind
        }
    }
}

#Preview {
    FocusModeExerciseCard(
        row: FocusModeExerciseRow(
            id: "bench-press",
            name: "平板卧推",
            muscle: "胸",
            kind: "compound",
            role: .secondaryCompound,
            targetSets: 3,
            roleFloor: 1
        ),
        completedSets: 1
    )
    .padding()
}
