// swift-tools-version: 5.9
// RedeNotifications — N-1 Local Rest-Timer Notification V1.
//
// Approved capability ungating (master §16/§17/§18, amended by N-1): LOCAL
// notifications only — a rest-timer reminder scheduled on-device when the user
// completes a set. NO remote / push notifications (those need a server → still
// gated). NO network. The pure scheduling policy (`RestReminderPolicy`) + the
// protocol seam (`RestReminderScheduling`) carry the unit tests; the real
// `UNUserNotificationCenter` adapter (`UserNotificationsRestReminderScheduler`)
// is the ONLY file that imports UserNotifications and is compiled `#if os(iOS)`
// (host `swift test` excludes it), mirroring the HK-1 paradigm.
//
// Foundation-only, standalone (no other package dependency, no remote SwiftPM):
// the policy maps a plain exercise-role rawValue String → recommended rest
// seconds, so the package stays decoupled from RedeDomain / TrainingDecision
// and the import graph (master §6.3) gains no edge. See
// docs/ios-native-migration/IOS_N1_LOCAL_REST_TIMER_NOTIFICATION_V1.md.

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
