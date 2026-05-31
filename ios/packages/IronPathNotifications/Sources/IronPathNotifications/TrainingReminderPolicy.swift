// TrainingReminderPolicy + value types — N-2 Training Reminders V1.
//
// The PURE scheduling policy for the LOCAL weekly training reminder. Given a set
// of selected weekdays (Calendar convention: 1 = Sunday … 7 = Saturday) plus a
// time-of-day (hour:minute), it produces the per-weekday REPEATING reminder
// requests the real `UNCalendarNotificationTrigger` adapter schedules, and — with
// an injected `now` + `Calendar` — the next fire instant for an honest status
// line. No UserNotifications import: everything here is plain value logic
// `swift test` exercises deterministically with an injected clock/calendar.
//
// The reminder repeats WEEKLY and iOS itself PERSISTS the repeating notifications.
// The app stores NO schedule of its own (respecting the ios/IronPath no-disk
// boundary); it reads the live schedule back from the notification center via
// `schedule(fromPending:)`. These types only DESCRIBE what to schedule and
// RECONSTRUCT the current schedule from what is pending — no scheduling side
// effects live here.
//
// Like N-1's `RestReminderPolicy`, this is decoupled from the TrainingDecision
// engine (the engine has no reminder concept and is not modified by N-2, so no
// goldens change). A reminder time is a small, local UX choice, hosted + tested
// here so the thin app layer carries no logic.

import Foundation

/// One scheduled repeating WEEKLY training reminder (a single weekday). Fully
/// resolved into primitives so the real `UNUserNotificationCenter` adapter needs
/// no policy logic of its own.
public struct TrainingReminderRequest: Equatable, Sendable {
    /// Stable per-weekday identifier (`identifierPrefix.<weekday>`) so a fresh
    /// schedule REPLACES the prior one weekday-by-weekday, and the pending set can
    /// be read back to exactly which weekdays are armed.
    public let identifier: String
    /// 1 = Sunday … 7 = Saturday (Calendar / `DateComponents.weekday` convention).
    public let weekday: Int
    public let hour: Int
    public let minute: Int
    public let title: String
    public let body: String

    public init(
        identifier: String,
        weekday: Int,
        hour: Int,
        minute: Int,
        title: String,
        body: String
    ) {
        self.identifier = identifier
        self.weekday = weekday
        self.hour = hour
        self.minute = minute
        self.title = title
        self.body = body
    }
}

/// The resolved current training-reminder schedule: which weekdays are armed and
/// at what time. Reconstructed from the pending notifications (the single source
/// of "what is set"); also drives the UI picker state.
public struct TrainingReminderSchedule: Equatable, Sendable {
    public let weekdays: Set<Int>
    public let hour: Int
    public let minute: Int

    public init(weekdays: Set<Int>, hour: Int, minute: Int) {
        self.weekdays = weekdays
        self.hour = hour
        self.minute = minute
    }

    public var isEmpty: Bool { weekdays.isEmpty }
}

/// One pending reminder's resolved components — the plain primitives the adapter
/// extracts from a `UNCalendarNotificationTrigger`'s `dateComponents`. Keeping
/// these as a value type lets the schedule-reconstruction logic stay pure +
/// testable (the adapter just maps and forwards).
public struct PendingTrainingReminder: Equatable, Sendable {
    public let weekday: Int
    public let hour: Int
    public let minute: Int

    public init(weekday: Int, hour: Int, minute: Int) {
        self.weekday = weekday
        self.hour = hour
        self.minute = minute
    }
}

/// Pure scheduling policy for the local weekly training reminder.
public enum TrainingReminderPolicy {
    /// Identifier namespace for our training reminders (one per weekday). Distinct
    /// from N-1's single rest-reminder identifier, so the two never collide and a
    /// `pendingNotificationRequests` read can tell ours apart.
    public static let identifierPrefix = "ironpath.local.training-reminder"

    /// The stable identifier for a given weekday's reminder.
    public static func identifier(forWeekday weekday: Int) -> String {
        "\(identifierPrefix).\(weekday)"
    }

    /// Parse the weekday out of one of our identifiers (nil if not ours / invalid).
    public static func weekday(fromIdentifier id: String) -> Int? {
        let dottedPrefix = "\(identifierPrefix)."
        guard id.hasPrefix(dottedPrefix) else { return nil }
        guard let weekday = Int(id.dropFirst(dottedPrefix.count)), (1...7).contains(weekday) else {
            return nil
        }
        return weekday
    }

    /// Whether a time-of-day is in range.
    static func isValidTime(hour: Int, minute: Int) -> Bool {
        (0...23).contains(hour) && (0...59).contains(minute)
    }

    /// Build the per-weekday repeating reminder requests for the selected weekdays
    /// at `hour:minute`. Returns an empty array (nothing to schedule) when no valid
    /// weekday is selected or the time is out of range — a fake reminder is never
    /// fabricated. Weekdays are de-duplicated (Set) and the output is sorted for
    /// determinism.
    public static func makeReminders(weekdays: Set<Int>, hour: Int, minute: Int) -> [TrainingReminderRequest] {
        guard isValidTime(hour: hour, minute: minute) else { return [] }
        return weekdays
            .filter { (1...7).contains($0) }
            .sorted()
            .map { weekday in
                TrainingReminderRequest(
                    identifier: identifier(forWeekday: weekday),
                    weekday: weekday,
                    hour: hour,
                    minute: minute,
                    title: "训练提醒",
                    body: "该训练了，开始今天的训练吧。"
                )
            }
    }

    /// Reconstruct the current schedule from the pending reminders read back from
    /// the notification center. Returns nil when none of ours are pending (the
    /// honest "not set" state). The time is taken deterministically (the earliest
    /// hour:minute), which equals the single time we always set them with.
    public static func schedule(fromPending pending: [PendingTrainingReminder]) -> TrainingReminderSchedule? {
        let valid = pending.filter { (1...7).contains($0.weekday) && isValidTime(hour: $0.hour, minute: $0.minute) }
        guard !valid.isEmpty else { return nil }
        let earliest = valid.min { ($0.hour, $0.minute, $0.weekday) < ($1.hour, $1.minute, $1.weekday) }!
        return TrainingReminderSchedule(
            weekdays: Set(valid.map(\.weekday)),
            hour: earliest.hour,
            minute: earliest.minute
        )
    }

    /// The next instant any selected weekly reminder fires, from `now` in the
    /// injected `calendar`. Pure + deterministic (no wall-clock): tests pin a fixed
    /// `now` and a fixed-timezone calendar. Returns nil when nothing is selected or
    /// the time is invalid.
    public static func nextFireDate(
        weekdays: Set<Int>,
        hour: Int,
        minute: Int,
        now: Date,
        calendar: Calendar
    ) -> Date? {
        guard isValidTime(hour: hour, minute: minute) else { return nil }
        let candidates: [Date] = weekdays
            .filter { (1...7).contains($0) }
            .compactMap { weekday in
                var components = DateComponents()
                components.weekday = weekday
                components.hour = hour
                components.minute = minute
                return calendar.nextDate(after: now, matching: components, matchingPolicy: .nextTime)
            }
        return candidates.min()
    }
}
