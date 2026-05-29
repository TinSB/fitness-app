// FocusSessionCompletionView — iOS-8 Native Local Training MVP Mega Migration V1.
//
// The in-session "finish this workout" card. Shows the aggregate completed /
// target readout and a primary "完成本次训练" action that the caller forwards to
// FocusModeMvpState.completeSession, capturing an in-RAM snapshot. Pure
// presentation — no disk write, no AppData mutation, no network.

import SwiftUI

struct FocusSessionCompletionView: View {
    let totalCompleted: Int
    let totalTarget: Int
    let onCompleteSession: () -> Void

    private var allDone: Bool { totalTarget > 0 && totalCompleted >= totalTarget }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("结束本次训练")
                .font(.headline)

            Text(allDone
                 ? "全部目标组数已完成，可以保存本次训练。"
                 : "尚未完成全部目标组数，仍可随时结束并保存当前进度。")
                .font(.footnote)
                .foregroundStyle(.secondary)

            Button {
                onCompleteSession()
            } label: {
                Text("完成本次训练")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)

            Text("仅本机 · 重启清空 · 无云同步")
                .font(.caption2)
                .foregroundStyle(.tertiary)
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
    FocusSessionCompletionView(totalCompleted: 6, totalTarget: 12, onCompleteSession: {})
        .padding()
}
