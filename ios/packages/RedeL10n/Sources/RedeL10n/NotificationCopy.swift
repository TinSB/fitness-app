// NotificationCopy — FR-NT1/2 通知 + 设置文案（双语）。
//
// 引擎/适配器零文案：策略产 code，这里渲染成展示串，app 解析后传给平台调度器。
// 红线（文案基线 §7.3）：价值先行、中性、事实+引导；**禁**鸡汤（继续坚持/别停）、羞辱、
// 断签/streak 施压、绝对承诺。空杆/动作模式预热不冒充工作组（同热身口径）。

import Foundation

extension RedeStrings {
    // MARK: FR-NT1 休息结束提醒（锁屏召回，事实+引导）
    public var notificationRestEndTitle: String { t2n("休息结束", "Rest complete") }
    public var notificationRestEndBody: String { t2n("可以开始下一组了", "Ready for your next set") }

    // MARK: 设置页通知 section
    public var notificationsSectionTitle: String { t2n("通知", "Notifications") }
    public var notificationRestEndLabel: String { t2n("休息结束提醒", "Rest-timer alert") }
    public var notificationRestEndHint: String {
        t2n("组间休息结束时提醒你回来——锁屏也能收到。",
            "A heads-up when your rest timer ends — even on the lock screen.")
    }
    /// 系统层拒绝授权时的诚实引导（不能代开，指向 iOS 设置）。
    public var notificationPermissionDeniedHint: String {
        t2n("通知已在系统里关闭　到 iOS「设置」开启后再用。",
            "Notifications are off in iOS Settings — turn them on there to use this.")
    }

    // MARK: FR-NT2 每周训练提醒（中性、价值先行；§7.3 禁断签/羞辱/streak 施压）
    /// 按 messageCode 渲染每周提醒标题（weekly_new_week / weekly_keep_pace）。
    public func notificationWeeklyTitle(messageCode: String) -> String {
        switch messageCode {
        case "weekly_new_week": return t2n("新的一周", "New week")
        case "weekly_keep_pace": return t2n("保持训练节奏", "Keep your training going")
        default: return ""
        }
    }
    public func notificationWeeklyBody(messageCode: String) -> String {
        switch messageCode {
        case "weekly_new_week": return t2n("安排一下本周训练。", "A good time to plan this week's training.")
        case "weekly_keep_pace": return t2n("本周还有训练日，方便时练一次。", "Still time for a session this week.")
        default: return ""
        }
    }

    // MARK: 设置页每周开关
    public var notificationWeeklyLabel: String { t2n("每周训练提醒", "Weekly training reminder") }
    public var notificationWeeklyHint: String {
        t2n("每周两次轻提醒（周一上午、周四傍晚）——中性、不催促。",
            "A light nudge twice a week (Mon morning, Thu evening) — neutral, no pressure.")
    }

    private func t2n(_ zh: String, _ en: String) -> String { locale == .zh ? zh : en }
}
