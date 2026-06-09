// RestReminderSection — N-1 Local Rest-Timer Notification V1.
//
// Thin presentation for the user-gated LOCAL rest-timer reminder, mounted as one
// card in the in-session Focus surface. The button is the authorization gate:
// tapping it requests LOCAL notification permission via the `RestReminderModel`
// and turns reminders on. Status is rendered honestly — no fake success (master
// §15.4). Pure rendering + a Task hand-off to the view-model; no logic.
//
// LOCAL-ONLY: the footer states that reminders are scheduled on-device, never
// sent over the network and never via remote push.

import SwiftUI

struct RestReminderSection: View {
    @ObservedObject var model: RestReminderModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Label("组间休息提醒", systemImage: "bell.badge")
                    .font(.headline)
                Spacer()
                if case .requesting = model.status { ProgressView() }
            }

            if showsEnableButton {
                Button {
                    Task { await model.enableReminders() }
                } label: {
                    Text("开启组间休息提醒")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.bordered)
            }

            Text(statusLine)
                .font(.footnote)
                .foregroundStyle(statusIsError ? .red : .secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("提醒只在本机按推荐休息时长本地触发 · 不联网 · 无远程推送")
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

    /// Offer the enable button only before reminders are on (idle/denied/failed/
    /// unavailable). Once enabled/scheduled/requesting, hide it.
    private var showsEnableButton: Bool {
        switch model.status {
        case .idle, .denied, .failed, .unavailable: return true
        case .requesting, .enabled, .scheduled: return false
        }
    }

    private var statusIsError: Bool {
        if case .failed = model.status { return true }
        return false
    }

    private var statusLine: String {
        switch model.status {
        case .idle:
            return "完成每组后，按推荐休息时长在本机提醒你开始下一组。"
        case .unavailable:
            return "当前环境不安排通知。"
        case .requesting:
            return "正在请求通知授权…"
        case .enabled:
            return "已开启 · 完成一组后会安排本机提醒。"
        case .scheduled(let secondsFromNow, let exerciseName):
            return "已安排：约 \(restLabel(secondsFromNow)) 后提醒（\(exerciseName)）。"
        case .denied:
            return "通知未授权 · 可在系统设置中开启后再试。"
        case .failed(let message):
            return "安排提醒失败：\(message)"
        }
    }

    private func restLabel(_ seconds: Int) -> String {
        let mins = seconds / 60
        let secs = seconds % 60
        if mins > 0 && secs > 0 { return "\(mins) 分 \(secs) 秒" }
        if mins > 0 { return "\(mins) 分钟" }
        return "\(secs) 秒"
    }
}

#Preview {
    RestReminderSection(model: RestReminderModel())
        .padding()
}
