// FocusSetChecklistView — iOS-7 Native Focus MVP Bundle V1; iOS-17b adds
// per-set weight / reps / RIR capture.
//
// One card for the currently selected exercise. Shows a row of targetSets
// capsules (filled = completed, hollow = pending), the big "completed / target"
// readout, optional per-set weight/reps/RIR entry fields + a kg/lb display-unit
// toggle, plus the "完成本组" tap target. Pure UI: it parses its own text fields
// to optional numbers and forwards them; the view-model converts to kg, builds
// the ActualSetDraft, and owns the in-RAM state. No business logic, no IO, no
// AppData, no persistence here.

import SwiftUI
import RedeDomain

struct FocusSetChecklistView: View {
    let exerciseName: String
    let exerciseMuscle: String
    let roleLabel: String
    let targetSets: Int
    let completedSets: Int
    /// Display unit the weight field is entered in (storage is always kg; the
    /// view-model converts). Bound to in-RAM view-model state.
    @Binding var displayUnit: WeightUnit
    /// Forward the just-entered set. Weight is in the DISPLAY unit (or nil if
    /// blank); reps/rir are nil if blank. The view-model converts + records.
    let onCompleteSet: (_ weightInDisplayUnit: Double?, _ reps: Int?, _ rir: Int?) -> Void

    @State private var weightText = ""
    @State private var repsText = ""
    @State private var rirText = ""

    private var clampedCompleted: Int {
        max(0, min(targetSets, completedSets))
    }

    private var isComplete: Bool { clampedCompleted >= targetSets }

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

            if !isComplete {
                captureFields
            }

            Button {
                onCompleteSet(
                    Double(weightText.trimmingCharacters(in: .whitespaces)),
                    Int(repsText.trimmingCharacters(in: .whitespaces)),
                    Int(rirText.trimmingCharacters(in: .whitespaces))
                )
                weightText = ""
                repsText = ""
                rirText = ""
            } label: {
                Text(isComplete ? "本动作已完成" : "完成本组")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isComplete)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    // MARK: - iOS-17b per-set capture fields (render-only; all optional)

    private var captureFields: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker("单位", selection: $displayUnit) {
                Text("kg").tag(WeightUnit.kg)
                Text("lb").tag(WeightUnit.lb)
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 180)

            HStack(spacing: 8) {
                captureField(title: "重量(\(displayUnit.rawValue))", text: $weightText, keyboard: .decimalPad)
                captureField(title: "次数", text: $repsText, keyboard: .numberPad)
                captureField(title: "RIR", text: $rirText, keyboard: .numberPad)
            }

            Text("可留空 · 重量按所选单位录入、存储为千克 · 仅本机内存，未保存")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    private func captureField(title: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            TextField("", text: text)
                .keyboardType(keyboard)
                .textFieldStyle(.roundedBorder)
                .font(.subheadline.monospacedDigit())
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    FocusSetChecklistView(
        exerciseName: "平板卧推",
        exerciseMuscle: "胸",
        roleLabel: "secondary-compound",
        targetSets: 3,
        completedSets: 1,
        displayUnit: .constant(.kg),
        onCompleteSet: { _, _, _ in }
    )
    .padding()
}
