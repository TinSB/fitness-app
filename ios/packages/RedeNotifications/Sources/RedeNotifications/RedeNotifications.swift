// RedeNotifications — N-1 Local Rest-Timer Notification V1.
//
// Created as an APPROVED, BOUNDED, LOCAL-ONLY notification adapter package
// (master §16/§17/§18, amended by N-1). The package owns:
//   • `RestReminderRequest` + `RestReminderPolicy` — pure value type + pure
//     scheduling policy (exercise-role rawValue → recommended rest seconds;
//     injected `now` → fire instant). No dependency on UserNotifications, so the
//     scheduling logic is a pure function `swift test` exercises directly.
//   • `RestReminderScheduling` + `RestReminderAuthorization` — the injectable
//     protocol seam. LOCAL-ONLY: schedule one local time-interval reminder +
//     cancel it. It exposes NO remote / push capability.
//   • `UserNotificationsRestReminderScheduler` — the ONLY file that `import`s
//     UserNotifications / uses `UNUserNotificationCenter`, compiled `#if os(iOS)`
//     (device/simulator only; host `swift test` never builds it). It schedules a
//     local `UNTimeIntervalNotificationTrigger` and NEVER registers for remote
//     push (no APNs, no notification-service-extension).
//
// HARD BOUNDARIES (still enforced): no network/cloud/account; REMOTE / push
// notifications remain forbidden (they need a server → §17); nothing leaves the
// device. `RedeNotificationsTests` confine the local UserNotifications behavior
// to the adapter surface and keep remote-push behavior out of the package boundary.

/// Retained for the iOS-1 bootstrap parity-probe convention every package
/// follows (`Sources/<Pkg>/<Pkg>.swift` exports only this version constant). The
/// real N-1 surface lives in the sibling source files in this package.
public enum RedeNotificationsVersion {
    public static let value = "0.0.1-bootstrap"
}
