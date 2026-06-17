// RestNotificationPolicy — FR-NT1 休息结束提醒（纯策略）。
//
// 组间锁屏也想被叫回来：休息开始时安排一条在剩余秒数后触发的本地通知；返回/跳过/结束训练
// 时取消。纯函数——产 typed 计划，平台调度归适配器（切片2）。绝不碰 canonical。

import Foundation

public enum RestNotificationPolicy {
    /// 休息结束提醒的稳定 id（安排/取消同用，保证幂等）。
    public static let restNotificationId = "rest-end"

    /// 休息开始时算是否安排提醒。返回 nil = 不安排（总开关或分项关、或无有效休息时长）。
    public static func scheduleOnRestBegin(
        restSecondsPlanned: Int,
        preferences: NotificationPreferences,
        now: Date = Date()
    ) -> ScheduledRestNotification? {
        _ = now // 预留：未来若续算绝对触发点用；MVP 按相对秒数全程重排（FR-TR9 恢复同口径）。
        guard preferences.masterEnabled, preferences.restEndEnabled, restSecondsPlanned > 0 else { return nil }
        return ScheduledRestNotification(
            notificationId: restNotificationId,
            fireAfterSeconds: restSecondsPlanned,
            titleCode: "rest_end",      // RedeL10n 渲染：事实+引导，禁鸡汤（§7.3）
            bodyCode: "rest_end_body"
        )
    }

    /// 取消休息提醒时用的 id。
    public static func shouldCancelRestNotification() -> String { restNotificationId }
}
