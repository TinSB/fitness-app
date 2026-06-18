// WeeklyTrainingReminderPolicy — FR-NT2 每周训练提醒（纯策略）。
//
// 价值先行、中性、**禁羞辱/断签施压**（文案基线 §7.3）；提醒内容由 RedeL10n 按 messageCode 渲染。
// 每周固定提醒由 UNCalendarNotificationTrigger(repeats:true) 系统周期触发，app 仅在偏好/计划变更时
// replaceWeekly 重注册（幂等）。纯函数——产 typed 计划。绝不碰 canonical。
//
// MVP（保守起步值，待 owner 真机校准）：固定 2 条——周一早「新周起动」+ 周四晚「进度检查」，
// 少而中性、不连日轰炸。按 daysPerWeek 缩放条数 / 用户自选时间 = v1.1（明示后置，不预先加抽象）。

import Foundation

public enum WeeklyTrainingReminderPolicy {
    // 保守起步常量（待校准）：weekday 1=周日…7=周六。周一=2、周四=5。
    private static let mondayHour = 9     // 周一上午起动
    private static let thursdayHour = 18  // 周四傍晚进度检查

    /// 当前偏好下的每周提醒计划。返回 [] = 不提醒（总开关或每周项关）。
    public static func weeklyReminders(preferences: NotificationPreferences) -> [WeeklyTrainingReminder] {
        guard preferences.masterEnabled, preferences.weeklyEnabled else { return [] }
        return [
            WeeklyTrainingReminder(reminderId: "weekly-mon", weekday: 2, hour: mondayHour, minute: 0, messageCode: "weekly_new_week"),
            WeeklyTrainingReminder(reminderId: "weekly-thu", weekday: 5, hour: thursdayHour, minute: 0, messageCode: "weekly_keep_pace"),
        ]
    }
}
