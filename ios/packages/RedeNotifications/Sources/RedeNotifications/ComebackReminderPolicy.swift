// ComebackReminderPolicy — FR-NT3 召回提醒（纯策略，批次 F 2026-07-10）。
//
// 语义：用户停练后按 5/12/21 天三档各发一条，练一场即全部取消重排；三条发完
// 永久安静直到下次训练。21 天档与回归协议重启线同源（comebackRestartGapDays=21）——
// 通知承诺的「循环已重置、从轻起步」就是引擎真实行为。
// 发送时刻贴个人节奏：历史训练开始时刻的中位小时；无历史回退 19:00。
// 重排时已过期的档直接跳过（不迟发——8 天没练时 5 天档不补）。
// 文案 owner 三轮定稿（AI 味 → 教练直陈 → Apple 风格），由 RedeL10n 按 messageCode 渲染。
// 纯函数，绝不碰 canonical；禁羞辱/断签施压红线沿 §7.3。

import Foundation

public enum ComebackReminderPolicy {
    /// 三档天数（21 = 回归协议 comebackRestartGapDays 同源，勿单独改动）。
    static let tierDays = [5, 12, 21]
    static let fallbackHour = 19

    /// 本策略可能管理的全部 id（app/适配器清场用完整集合）。
    public static let managedComebackIds = ["comeback-5d", "comeback-12d", "comeback-21d"]

    /// 惯练小时：历史训练开始时刻（用户时区）的中位数；无有效历史回退 19:00。
    public static func typicalHour(sessionStartISOs: [String],
                                   timeZone: TimeZone = .current) -> Int {
        let parser = ISO8601DateFormatter()
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let hours = sessionStartISOs.compactMap { iso -> Int? in
            guard let date = parser.date(from: iso) else { return nil }
            return calendar.component(.hour, from: date)
        }.sorted()
        guard !hours.isEmpty else { return fallbackHour }
        return hours[hours.count / 2]
    }

    /// 三档召回计划。返回 [] = 不提醒（总开关/召回项关、无训练历史）。
    /// lastSessionISO 取日期部分（yyyy-MM-dd 前缀）；fire = 该日 + N 天 @typicalHour（用户时区）。
    public static func comebackReminders(
        preferences: NotificationPreferences,
        lastSessionISO: String?,
        sessionStartISOs: [String],
        nextDayName: String?,
        now: Date,
        timeZone: TimeZone = .current
    ) -> [ComebackReminder] {
        guard preferences.masterEnabled, preferences.comebackEnabled,
              let lastSessionISO, lastSessionISO.count >= 10 else { return [] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let dayFormatter = DateFormatter()
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")
        dayFormatter.timeZone = timeZone
        dayFormatter.dateFormat = "yyyy-MM-dd"
        guard let lastDay = dayFormatter.date(from: String(lastSessionISO.prefix(10))) else { return [] }
        let hour = typicalHour(sessionStartISOs: sessionStartISOs, timeZone: timeZone)

        var out: [ComebackReminder] = []
        for days in tierDays {
            guard let fireDay = calendar.date(byAdding: .day, value: days, to: lastDay),
                  let fireAt = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: fireDay)
            else { continue }
            guard fireAt > now else { continue }   // 过期档跳过，不迟发
            out.append(ComebackReminder(
                reminderId: "comeback-\(days)d",
                fireAt: fireAt,
                messageCode: "comeback_\(days)d",
                dayName: days == 5 ? nextDayName : nil))
        }
        return out
    }
}
