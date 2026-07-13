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
        // 排程前清掉上一轮同 id 的**已送达**历史（此刻离触发还有 N 秒，绝不会误删刚弹出的新通知）——
        // 避免通知中心堆多条 rest-end；同 id 重排只替换 pending、不会自动清旧 delivered。
        center.removeDeliveredNotifications(withIdentifiers: [id])
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        // 休息结束 = 时效性提醒：用 .timeSensitive 让它在用户忙于别的 App / 开了专注模式时也强弹横幅
        //（默认 .active 会被降级成静悄悄进通知中心、不弹）。需 time-sensitive entitlement（见 Rede.entitlements）。
        content.interruptionLevel = .timeSensitive
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(fireAfterSeconds), repeats: false)
        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    public func cancelRest(id: String) {
        // 只清**待发**（取消尚未触发的提醒）；不动**已送达**——否则用户锁屏期间通知已弹出、
        // 解锁回到 App 时这里会把那条已送达通知也抹掉，造成"明明响过却看不到"（真机 bug 根因之一）。
        center.removePendingNotificationRequests(withIdentifiers: [id])
    }

    public func replaceWeekly(_ reminders: [ResolvedWeeklyReminder]) {
        // 幂等：先清旧 weekly（按本批 id），再注册——避免重复堆叠。
        center.removePendingNotificationRequests(withIdentifiers: reminders.map(\.id))
        for reminder in reminders {
            let content = UNMutableNotificationContent()
            content.title = reminder.title
            content.body = reminder.body
            content.sound = .default
            // 每周提醒也用 .timeSensitive（owner 拍板"也弹"）：在别的 App 前台 / 专注模式时也强弹横幅。
            // 文案仍中性（§7.3 管语气、这管送达）；如日后觉太扰可单独降回 .active。
            content.interruptionLevel = .timeSensitive
            var components = DateComponents()
            components.weekday = reminder.weekday
            components.hour = reminder.hour
            components.minute = reminder.minute
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            center.add(UNNotificationRequest(identifier: reminder.id, content: content, trigger: trigger))
        }
    }

    public func replaceComeback(_ reminders: [ResolvedComebackReminder]) {
        // 幂等 + 清场：先清全部 comeback ids（不止本批）——练后重排/关闭开关都干净，
        // 不残留旧档（weekly 的"只清本批"教训在此升级为全集清理）。
        center.removePendingNotificationRequests(withIdentifiers: ComebackReminderPolicy.managedComebackIds)
        for reminder in reminders {
            let content = UNMutableNotificationContent()
            content.title = reminder.title
            content.body = reminder.body
            content.sound = .default
            // 召回场景用户可能多日未开 App，.timeSensitive 沿每周提醒拍板（文案管语气、这管送达）。
            content.interruptionLevel = .timeSensitive
            let components = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute], from: reminder.fireAt)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            center.add(UNNotificationRequest(identifier: reminder.id, content: content, trigger: trigger))
        }
    }

    public func cancelAll() {
        center.removeAllPendingNotificationRequests()
    }
}
#endif
