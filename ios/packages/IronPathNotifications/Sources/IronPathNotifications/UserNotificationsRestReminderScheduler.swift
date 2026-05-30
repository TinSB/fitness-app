// UserNotificationsRestReminderScheduler — N-1 Local Rest-Timer Notification V1.
//
// THE ONLY file in the iOS tree that imports UserNotifications and touches
// UNUserNotificationCenter. It is the real, device-backed `RestReminderScheduling`.
//
// Compiled `#if os(iOS)` ONLY: the host `swift test` toolchain (macOS) never
// builds this file, which is exactly why the scheduling logic lives behind the
// `RestReminderScheduling` seam + the pure `RestReminderPolicy` (both unit-tested
// on the host with a fake scheduler). The iOS app/device build is where this
// file compiles and runs.
//
// LOCAL-ONLY (master §16/§17/§18 as amended by N-1): it schedules a one-shot
// local `UNTimeIntervalNotificationTrigger`. There is NO remote-push path — it
// never registers for remote (APNs) notifications, ships no notification service
// extension, and uses no push entitlement. Local scheduling needs no entitlement.
//
// The static guard `tests/iosBootstrapForbiddenImports.test.ts` exempts THIS one
// file path from the local UserNotifications-token bans and additionally asserts
// it stays local-only (a time-interval trigger, no remote registration); every
// other Swift file under ios/ stays UserNotifications-free, and the remote-push
// tokens are banned everywhere including here.

#if os(iOS)
import Foundation
import UserNotifications

public struct UserNotificationsRestReminderScheduler: RestReminderScheduling {
    public init() {}

    /// Request authorization for LOCAL alerts + sound. Shares nothing remote.
    /// A thrown error or a denial both surface as `.denied` (honest).
    public func requestAuthorization() async -> RestReminderAuthorization {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound])
            return granted ? .authorized : .denied
        } catch {
            return .denied
        }
    }

    /// Schedule the one-shot LOCAL reminder. Same identifier ⇒ the system
    /// replaces any pending request, so there is only ever one rest reminder.
    public func schedule(_ request: RestReminderRequest) async throws {
        let content = UNMutableNotificationContent()
        content.title = request.title
        content.body = request.body
        content.sound = .default
        // LOCAL time-interval trigger — fires on-device after the rest interval.
        // One-shot (repeats: false). No remote push, no server involvement.
        let interval = TimeInterval(max(1, request.secondsFromNow))
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let notification = UNNotificationRequest(
            identifier: request.identifier,
            content: content,
            trigger: trigger
        )
        try await UNUserNotificationCenter.current().add(notification)
    }

    /// Cancel the pending reminder (idempotent).
    public func cancel(identifier: String) async {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }
}
#endif
