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
    // 开关说明副文已移除（owner 2026-06-20：开关标题自解释，副文太重）。
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
    /// FR-NT3 召回开关行（批次 F）。
    public var notificationComebackLabel: String { t2n("久未训练提醒", "Comeback reminders") }
    // 开关说明副文已移除（owner 2026-06-20：开关标题自解释，副文太重）。

    private func t2n(_ zh: String, _ en: String) -> String { locale == .zh ? zh : en }

    // MARK: - FR-NT3 召回提醒（批次 F 2026-07-10，owner 三轮定稿 Apple 风格：
    // 完整句/观察式/句号沿通知先例；零施压零羞辱红线 §7.3）

    /// 召回标题。档 1 带动态训练日名（无名时退化通用版）；档 2/3 固定。
    public func comebackTitle(code: String, dayName: String?) -> String {
        switch code {
        case "comeback_5d":
            if let dayName {
                return t2n("该练\(dayName) 了", "Time for \(dayName)")   // 日名尾拉丁字母，中西混排加空格
            }
            return t2n("该训练了", "Time to train")
        case "comeback_12d": return t2n("继续你的训练", "Ready when you are")
        default: return t2n("重新开始", "A fresh start")   // comeback_21d
        }
    }

    /// 召回正文（owner 定稿备选正文版）。
    public func comebackBody(code: String) -> String {
        switch code {
        case "comeback_5d":
            return t2n("距上次训练已有 5 天，重量沿用上次即可。",
                       "It's been 5 days since your last session. Pick up right where you left off.")
        case "comeback_12d":
            return t2n("距上次训练已有近两周。你的计划保持不变，随时可以继续。",
                       "It's been about two weeks. Your plan hasn't changed — continue anytime.")
        default:   // comeback_21d
            return t2n("训练循环已重置，首场训练将从较轻的重量开始。",
                       "Your cycle has been reset. Your first session back will start light.")
        }
    }
}
