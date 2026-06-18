// NotificationTypes — FR-NT1/2 通知策略的 typed 计划 + 偏好输入 + 平台 seam。
//
// 全部 Foundation-only、plain String/Int（跨包零依赖）、Sendable。策略产这些 typed 计划，
// 平台适配器（切片2，#if os(iOS)）把它们翻成 UNNotificationRequest；文案由 RedeL10n 按 code 渲染。

import Foundation

/// 休息结束提醒计划（FR-NT1）。fireAfterSeconds = 相对触发秒数（UNTimeIntervalNotificationTrigger 用）。
public struct ScheduledRestNotification: Equatable, Sendable {
    public let notificationId: String   // 稳定 id（取消用），固定 "rest-end"
    public let fireAfterSeconds: Int    // > 0
    public let titleCode: String        // 渲染交 RedeL10n（零文案）
    public let bodyCode: String
    public init(notificationId: String, fireAfterSeconds: Int, titleCode: String, bodyCode: String) {
        self.notificationId = notificationId
        self.fireAfterSeconds = fireAfterSeconds
        self.titleCode = titleCode
        self.bodyCode = bodyCode
    }
}

/// 每周训练提醒计划（FR-NT2）。weekday 1=周日…7=周六（对齐 Calendar.gregorian / DateComponents）。
public struct WeeklyTrainingReminder: Equatable, Sendable {
    public let reminderId: String       // 稳定 id（重注册去重用），如 "weekly-mon"
    public let weekday: Int             // 1–7
    public let hour: Int                // 0–23
    public let minute: Int              // 0–59
    public let messageCode: String      // 渲染交 RedeL10n
    public init(reminderId: String, weekday: Int, hour: Int, minute: Int, messageCode: String) {
        self.reminderId = reminderId
        self.weekday = weekday
        self.hour = hour
        self.minute = minute
        self.messageCode = messageCode
    }
}

/// 通知偏好（只读输入）。真相在 canonical AppData（RedePersistence 写闸管理），本包不持久化。
/// masterEnabled = 系统授权态镜像 + 用户总意愿；分项各自可关。
public struct NotificationPreferences: Equatable, Sendable {
    public let masterEnabled: Bool
    public let restEndEnabled: Bool   // FR-NT1
    public let weeklyEnabled: Bool    // FR-NT2
    public init(masterEnabled: Bool, restEndEnabled: Bool, weeklyEnabled: Bool) {
        self.masterEnabled = masterEnabled
        self.restEndEnabled = restEndEnabled
        self.weeklyEnabled = weeklyEnabled
    }
}

/// 已渲染的每周提醒（平台调度入参）：策略产 messageCode，app 用 RedeL10n 解析成 title/body 后传入。
public struct ResolvedWeeklyReminder: Equatable, Sendable {
    public let id: String
    public let weekday: Int   // 1=周日…7=周六
    public let hour: Int
    public let minute: Int
    public let title: String
    public let body: String
    public init(id: String, weekday: Int, hour: Int, minute: Int, title: String, body: String) {
        self.id = id
        self.weekday = weekday
        self.hour = hour
        self.minute = minute
        self.title = title
        self.body = body
    }
}

/// 平台调度 seam（UNUserNotificationCenter 适配器实现；app 只见此协议）。
/// 通知绝不碰 canonical——本协议只做平台侧调度/取消，幂等。**取已渲染文案**（title/body）：
/// code→文案由 app 层用 RedeL10n 解析后传入，本包/适配器零文案、零 RedeL10n 依赖（边界干净 + Sendable）。
public protocol NotificationScheduling: Sendable {
    /// 请求授权（价值先行：在用户首次开开关时调，非首屏）。返回是否获授权。
    func requestAuthorization() async -> Bool
    /// 安排休息结束提醒（FR-NT1）。fireAfterSeconds > 0。
    func scheduleRest(id: String, fireAfterSeconds: Int, title: String, body: String)
    /// 取消休息结束提醒（返回/跳过/结束训练时）。
    func cancelRest(id: String)
    /// 重注册每周提醒（FR-NT2，先清旧 weekly ids 再注册，幂等）。
    func replaceWeekly(_ reminders: [ResolvedWeeklyReminder])
    /// 清除全部待发通知（总开关关闭/登出场景）。
    func cancelAll()
}
