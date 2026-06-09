// UserNotificationsRestReminderScheduler (+ UserNotificationsTrainingReminderScheduler)
// — N-1 Local Rest-Timer Notification V1 + N-2 Training Reminders V1.
//
// THE ONLY file in the iOS tree that imports UserNotifications and touches
// UNUserNotificationCenter. It hosts BOTH local schedulers by design — keeping
// every real `UNUserNotificationCenter` call confined to this single
// `#if os(iOS)` file (master §18 / `iosBootstrapForbiddenImports`):
//   • `UserNotificationsRestReminderScheduler` — N-1, the real
//     `RestReminderScheduling` (one-shot local `UNTimeIntervalNotificationTrigger`
//     fired after a completed set).
//   • `UserNotificationsTrainingReminderScheduler` — N-2, the real
//     `TrainingReminderScheduling` (REPEATING weekly local
//     `UNCalendarNotificationTrigger`s; iOS itself persists the repeating
//     notifications, so the app stores no schedule of its own).
//
// Compiled `#if os(iOS)` ONLY: the host `swift test` toolchain (macOS) never
// builds this file, which is exactly why the scheduling logic lives behind the
// `RestReminderScheduling` / `TrainingReminderScheduling` seams + the pure
// `RestReminderPolicy` / `TrainingReminderPolicy` (all unit-tested on the host
// with fake schedulers). The iOS app/device build is where this file compiles.
//
// LOCAL-ONLY (master §16/§17/§18 as amended by N-1 + N-2): time-interval (rest)
// and repeating calendar (training) triggers only. There is NO remote-push path —
// neither scheduler registers for remote (APNs) notifications, ships a
// notification service extension, or uses a push entitlement. Local scheduling
// needs no entitlement.
//
// `RedeNotificationsTests` lock the local-notification boundary; every other
// Swift package stays UserNotifications-free, and remote-push behavior is banned
// everywhere including here.

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

/// N-2: the real, device-backed `TrainingReminderScheduling`. Schedules REPEATING
/// weekly local reminders via `UNCalendarNotificationTrigger(repeats: true)` — iOS
/// fires AND persists them on-device, so the app stores no schedule itself and
/// reads the live state back from the notification center. LOCAL only; no remote
/// push. Lives in this single sanctioned UserNotifications file alongside N-1.
public struct UserNotificationsTrainingReminderScheduler: TrainingReminderScheduling {
    public init() {}

    /// Request authorization for LOCAL alerts + sound (shares nothing remote) —
    /// the same paradigm as N-1. A thrown error or a denial both surface honestly.
    public func requestAuthorization() async -> RestReminderAuthorization {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound])
            return granted ? .authorized : .denied
        } catch {
            return .denied
        }
    }

    /// Replace ALL of our training reminders with exactly `requests`. We first
    /// cancel every existing one of ours (so a de-selected weekday is dropped),
    /// then add one REPEATING weekly calendar trigger per request. Stable per-
    /// weekday identifiers mean a re-save never duplicates.
    public func replaceReminders(_ requests: [TrainingReminderRequest]) async throws {
        let center = UNUserNotificationCenter.current()
        await cancelAll()
        for request in requests {
            let content = UNMutableNotificationContent()
            content.title = request.title
            content.body = request.body
            content.sound = .default
            var components = DateComponents()
            components.weekday = request.weekday
            components.hour = request.hour
            components.minute = request.minute
            // LOCAL repeating weekly trigger — iOS fires + PERSISTS it on-device.
            // No remote push, no server involvement.
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            let notification = UNNotificationRequest(
                identifier: request.identifier,
                content: content,
                trigger: trigger
            )
            try await center.add(notification)
        }
    }

    /// Read the live pending schedule back from the notification center (the app
    /// persists none itself). Extracts each of our pending requests' weekday +
    /// time into primitives, then delegates the reconstruction to the pure policy.
    public func pendingSchedule() async -> TrainingReminderSchedule? {
        let pending = await UNUserNotificationCenter.current().pendingNotificationRequests()
        let ours: [PendingTrainingReminder] = pending.compactMap { request in
            guard
                let weekday = TrainingReminderPolicy.weekday(fromIdentifier: request.identifier),
                let trigger = request.trigger as? UNCalendarNotificationTrigger,
                let hour = trigger.dateComponents.hour,
                let minute = trigger.dateComponents.minute
            else { return nil }
            return PendingTrainingReminder(weekday: weekday, hour: hour, minute: minute)
        }
        return TrainingReminderPolicy.schedule(fromPending: ours)
    }

    /// Cancel ALL of our training reminders (idempotent). Only removes requests
    /// whose identifier is one of ours — never touches the N-1 rest reminder.
    public func cancelAll() async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let ids = pending
            .map(\.identifier)
            .filter { TrainingReminderPolicy.weekday(fromIdentifier: $0) != nil }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }
}
#endif
