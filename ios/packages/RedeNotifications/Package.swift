// swift-tools-version: 5.9
// RedeNotifications — FR-NT1/2 本地通知（owner 批准创建预留包，Master §5）。
//
// 已批准能力（Master §5/§9）：纯本地通知——FR-NT1 休息结束提醒、FR-NT2 每周训练提醒。
// **仅本地**：无远程/推送（§9 禁），无 aps-environment entitlement，无 Info.plist 特殊 key。
//
// 复刻 RedeWidgetShared 的边界范式（不引入新模式）：
//  - 纯策略层（默认编译、host `swift test` 全覆盖）：RestNotificationPolicy /
//    WeeklyTrainingReminderPolicy 纯函数 + typed 计划（ScheduledRestNotification /
//    WeeklyTrainingReminder）+ 偏好只读输入（NotificationPreferences）+ 协议 seam
//    （NotificationScheduling）。策略产 typed code、不产文案（渲染归 RedeL10n）。
//  - 平台适配层（切片2，`#if os(iOS)`、host test 排除）：唯一 import UserNotifications 的
//    UNUserNotificationCenterScheduler，把 typed 计划翻成 UNNotificationRequest。
//
// 红线（与 widget 同口径）：通知是 DERIVED 派生记录——绝不读/写 canonical AppData、绝不是
// 真相源、无 network/cloud。开关偏好属 canonical（RedePersistence 写闸管理），本包只当只读输入。
// Foundation-only、无跨 Rede 包依赖（typed 计划全用 plain String/Int）。

import PackageDescription

let package = Package(
    name: "RedeNotifications",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeNotifications", targets: ["RedeNotifications"]),
    ],
    targets: [
        .target(
            name: "RedeNotifications"
        ),
        .testTarget(
            name: "RedeNotificationsTests",
            dependencies: ["RedeNotifications"]
        ),
    ]
)
