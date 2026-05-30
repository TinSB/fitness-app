// RestReminderPolicy + RestReminderRequest — N-1 Local Rest-Timer Notification V1.
//
// The PURE scheduling policy. Given the injected "now" + a rest duration (or an
// exercise-role rawValue it maps to a recommended duration), it computes the
// fire instant and the local notification's content. No HealthKit, no network,
// no UserNotifications import — everything here is plain value logic `swift test`
// can exercise deterministically with an injected clock.
//
// Rest duration is NOT an engine output (the TrainingDecision engine has no rest
// concept and is not modified by N-1, so no goldens change). It is a small,
// local UX default keyed by exercise role, hosted + tested here so the thin app
// layer carries no logic — it just forwards `row.role.rawValue`.

import Foundation

/// One scheduled local rest reminder, fully resolved into primitives so the
/// real `UNUserNotificationCenter` adapter needs no policy logic of its own.
public struct RestReminderRequest: Equatable, Sendable {
    /// Stable identifier — re-scheduling with the same id REPLACES the pending
    /// reminder (so a fresh completed set supersedes the prior one); cancel
    /// removes it. There is only ever one pending rest reminder.
    public let identifier: String
    /// The instant the reminder should fire (now + restSeconds). Carried for
    /// display/tests; the adapter fires by interval, not by absolute date.
    public let fireDate: Date
    /// Seconds from "now" until the reminder fires (the recommended rest).
    public let secondsFromNow: Int
    public let title: String
    public let body: String

    public init(
        identifier: String,
        fireDate: Date,
        secondsFromNow: Int,
        title: String,
        body: String
    ) {
        self.identifier = identifier
        self.fireDate = fireDate
        self.secondsFromNow = secondsFromNow
        self.title = title
        self.body = body
    }
}

/// Coarse rest-duration class derived from an exercise role. Decoupled from the
/// engine's `ExerciseRole` (which lives in IronPathTrainingDecision) so this
/// package stays Foundation-only; the app forwards `role.rawValue`.
public enum RestReminderExerciseClass: Equatable, Sendable {
    case compound
    case accessory
    case isolation

    /// Map an `ExerciseRole` rawValue ("main-compound"/"secondary-compound"/
    /// "accessory"/"isolation") to a rest class. Unknown → `.compound` (the
    /// longer, safer rest — never a too-short reminder).
    public init(exerciseRoleRawValue raw: String) {
        switch raw {
        case "main-compound", "secondary-compound":
            self = .compound
        case "isolation":
            self = .isolation
        case "accessory":
            self = .accessory
        default:
            self = .compound
        }
    }
}

/// Pure scheduling policy for the local rest-timer reminder.
public enum RestReminderPolicy {
    /// The single stable identifier for the one-at-a-time rest reminder.
    public static let reminderIdentifier = "ironpath.local.rest-reminder"

    /// Recommended rest, in seconds, for a rest class. Compound movements rest
    /// longer than isolation work — a small, local UX default (not an engine
    /// value).
    public static func recommendedRestSeconds(for klass: RestReminderExerciseClass) -> Int {
        switch klass {
        case .compound: return 180
        case .accessory: return 90
        case .isolation: return 60
        }
    }

    /// Recommended rest for an `ExerciseRole` rawValue (the app forwards
    /// `row.role.rawValue`).
    public static func recommendedRestSeconds(exerciseRoleRawValue raw: String) -> Int {
        recommendedRestSeconds(for: RestReminderExerciseClass(exerciseRoleRawValue: raw))
    }

    /// Build a local rest reminder that fires `restSeconds` after `now`. Returns
    /// nil when `restSeconds <= 0` — there is nothing sensible to schedule, and a
    /// non-positive interval is never fabricated into a fake reminder.
    public static func makeReminder(
        now: Date,
        restSeconds: Int,
        exerciseName: String,
        nextSetNumber: Int
    ) -> RestReminderRequest? {
        guard restSeconds > 0 else { return nil }
        let fireDate = now.addingTimeInterval(TimeInterval(restSeconds))
        return RestReminderRequest(
            identifier: reminderIdentifier,
            fireDate: fireDate,
            secondsFromNow: restSeconds,
            title: "休息结束 · 开始下一组",
            body: "\(exerciseName) · 第 \(nextSetNumber) 组 · 已休息约 \(durationText(restSeconds))"
        )
    }

    /// Convenience: recommended rest from an exercise-role rawValue.
    public static func makeReminder(
        now: Date,
        exerciseRoleRawValue raw: String,
        exerciseName: String,
        nextSetNumber: Int
    ) -> RestReminderRequest? {
        makeReminder(
            now: now,
            restSeconds: recommendedRestSeconds(exerciseRoleRawValue: raw),
            exerciseName: exerciseName,
            nextSetNumber: nextSetNumber
        )
    }

    /// Human rest-duration label (e.g. "3 分钟", "1 分 30 秒", "45 秒").
    static func durationText(_ seconds: Int) -> String {
        let mins = seconds / 60
        let secs = seconds % 60
        if mins > 0 && secs > 0 { return "\(mins) 分 \(secs) 秒" }
        if mins > 0 { return "\(mins) 分钟" }
        return "\(secs) 秒"
    }
}
