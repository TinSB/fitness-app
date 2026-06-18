// UNUserNotificationCenterScheduler — FR-NT1/2 平台适配器（切片2）。
//
// 唯一 import UserNotifications 的文件，#if os(iOS) 包裹 → host `swift test` 自动排除（同
// RedeWidgetShared 的 AppGroup/WidgetKit 适配器范式）。把 typed 计划翻成 UNNotificationRequest。
// 取已渲染 title/body（code→文案由 app 用 RedeL10n 解析后传入）→ 本适配器零文案、零 RedeL10n 依赖。
//
// 纯本地通知：UNTimeIntervalNotificationTrigger（休息结束，一次性）+ UNCalendarNotificationTrigger
//（每周，repeats）。无远程/推送（§9）。无存储属性 → 天然 Sendable（center 每次取 .current() 单例）。

#if os(iOS)
import Foundation
import UserNotifications

public struct UNUserNotificationCenterScheduler: NotificationScheduling {
    public init() {}
    private var center: UNUserNotificationCenter { .current() }

    public func requestAuthorization() async -> Bool {
        // 仅 alert + sound（不含 badge：角标有施压感，与 §7.3 反羞辱姿态略冲突）。
        (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
    }

    public func scheduleRest(id: String, fireAfterSeconds: Int, title: String, body: String) {
        guard fireAfterSeconds > 0 else { return }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(fireAfterSeconds), repeats: false)
        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    public func cancelRest(id: String) {
        center.removePendingNotificationRequests(withIdentifiers: [id])
        center.removeDeliveredNotifications(withIdentifiers: [id])
    }

    public func replaceWeekly(_ reminders: [ResolvedWeeklyReminder]) {
        // 幂等：先清旧 weekly（按本批 id），再注册——避免重复堆叠。
        center.removePendingNotificationRequests(withIdentifiers: reminders.map(\.id))
        for reminder in reminders {
            let content = UNMutableNotificationContent()
            content.title = reminder.title
            content.body = reminder.body
            content.sound = .default
            var components = DateComponents()
            components.weekday = reminder.weekday
            components.hour = reminder.hour
            components.minute = reminder.minute
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            center.add(UNNotificationRequest(identifier: reminder.id, content: content, trigger: trigger))
        }
    }

    public func cancelAll() {
        center.removeAllPendingNotificationRequests()
    }
}
#endif
