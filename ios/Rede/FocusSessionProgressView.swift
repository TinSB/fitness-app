// FocusSessionProgressView — iOS-7 Native Focus MVP Bundle V1.
//
// Top of the in-session demo. Shows the aggregate completed / target
// set counters across the whole today exercise list, plus a linear
// progress bar. Pure presentation — driven by FocusModeMvpState
// values supplied by the caller.

import SwiftUI

struct FocusSessionProgressView: View {
    let totalCompleted: Int
    let totalTarget: Int

    private var percent: Double {
        guard totalTarget > 0 else { return 0 }
        return Double(totalCompleted) / Double(totalTarget)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("本次训练进度")
                    .font(.headline)
                Spacer()
                Text("\(totalCompleted) / \(totalTarget)")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.primary)
            }
            ProgressView(value: percent)
                .progressViewStyle(.linear)
                .tint(.accentColor)
            Text(String(format: "已完成 %.0f%%", percent * 100))
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

#Preview {
    FocusSessionProgressView(totalCompleted: 4, totalTarget: 12)
        .padding()
}
