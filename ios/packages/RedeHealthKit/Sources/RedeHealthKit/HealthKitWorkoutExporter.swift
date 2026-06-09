// HealthKitWorkoutExporter — HK-3 HealthKit Workout WRITE-BACK (Export) V1.
//
// PURE mapping: native canonical `RedeDomain.TrainingSession`s (from
// `AppData.history`) → `WorkoutExportRequest`s. No HealthKit import, no IO, no clock
// (`Date()` is never called — instants come from the sessions' own ISO strings), so
// `swift test` exercises every rule with sample sessions. The real `HKWorkout`
// construction + `HKHealthStore.save` lives in the `#if os(iOS)` adapter
// (`HealthKitWorkoutSource`), behind the `WorkoutExportSink` seam.
//
// THE HARD RED LINES (master §6.2/§8/§16/§17/§18 as amended in this PR):
//   • NATIVE-ONLY / structural no-loop-back. The mapping accepts ONLY
//     `[TrainingSession]` — the canonical native record (`AppData.history`). An
//     `ImportedWorkoutSample` (the DERIVED Apple-Health import bag) can NEVER be
//     passed here (a compile-time guarantee), so an Apple-Health-imported workout is
//     never written back to Apple Health. A defensive `source == "healthkit_import"`
//     check rejects any history entry that ever carried that tag (belt-and-suspenders).
//   • AppData stays the SOURCE OF TRUTH; Apple Health is a DERIVED export target. This
//     mapper reads sessions only; it never writes AppData and never bumps the schema.
//   • IDEMPOTENT. Each request carries the session id, written into the exported
//     `HKWorkout`'s metadata under `metadataSessionIDKey`; the adapter queries Apple
//     Health for that tag and skips sessions already present — idempotency state lives
//     in Health, not in app-side storage.

import Foundation
import RedeDomain

public enum HealthKitWorkoutExporter {
    /// The `HKWorkout` metadata key holding the Rede canonical session id — the
    /// idempotency anchor. Before exporting, the adapter queries Apple Health for
    /// workouts already tagged with this key and skips any session whose id is present,
    /// so re-export is a no-op WITHOUT any app-side dedup storage. App-namespaced to
    /// avoid colliding with Apple's reserved `HKMetadataKey*` constants.
    public static let metadataSessionIDKey = "com.ironpath.sessionID"

    /// Rede native sessions are strength training; every exported workout uses this
    /// stable activity-type identifier. The adapter maps it to
    /// `HKWorkoutActivityType.traditionalStrengthTraining` via a compile-checked switch.
    public static let exportActivityTypeName = "TraditionalStrengthTraining"

    /// The HK-2 import source tag. A native `history` session must never carry it; this
    /// constant powers the defensive no-loop-back filter below.
    static let healthKitImportSource = "healthkit_import"

    /// Map ONLY native completed sessions into export requests, in input order.
    ///
    /// Structural no-loop-back: the signature accepts ONLY `[TrainingSession]` (the
    /// canonical native record). Each session is included only if it is exportable
    /// (`exportRequest(from:)` returns non-nil): completed, has an id, is NOT tagged as
    /// a HealthKit import, and yields a valid `start <= end` window. Non-exportable
    /// sessions are honestly dropped (never a fabricated workout).
    public static func exportRequests(forNativeHistory sessions: [TrainingSession]) -> [WorkoutExportRequest] {
        sessions.compactMap(exportRequest(from:))
    }

    /// Map ONE native session into a `WorkoutExportRequest`, or `nil` when it is not
    /// exportable. Filters, in order:
    ///   1. `completed == true` — only finished training is a workout.
    ///   2. non-empty `id` — required as the idempotency metadata value.
    ///   3. defensive no-loop-back — reject any session tagged `source: "healthkit_import"`.
    ///   4. a usable time window — `start` from `startedAt` (else `date`); `end` from
    ///      `finishedAt` (else `start + durationMin`); both must parse and `end >= start`.
    public static func exportRequest(from session: TrainingSession) -> WorkoutExportRequest? {
        guard session.completed == true else { return nil }
        guard let id = session.id?.trimmingCharacters(in: .whitespaces), !id.isEmpty else { return nil }
        // Defensive no-loop-back: never write an Apple-Health-imported record back to
        // Apple Health (history is native by construction; this guards a future tag).
        if session._unknown["source"]?.stringValue == healthKitImportSource { return nil }

        guard let start = parseDate(session.startedAt ?? session.date) else { return nil }
        let end: Date
        if let finishedAt = session.finishedAt, let parsed = parseDate(finishedAt) {
            end = parsed
        } else if let minutes = session.durationMin?.doubleValue, minutes > 0 {
            end = start.addingTimeInterval(minutes * 60)
        } else {
            return nil
        }
        guard end >= start else { return nil }

        return WorkoutExportRequest(
            sessionId: id,
            activityTypeName: exportActivityTypeName,
            start: start,
            end: end,
            durationSeconds: end.timeIntervalSince(start)
        )
    }

    /// Parse an ISO-8601 instant, tolerating the canonical fractional-seconds form
    /// ("2026-05-27T06:30:00.000Z") and the plain internet-date-time form. Pure — no
    /// wall clock. Returns nil for an absent/unparseable string (the session is then
    /// honestly skipped rather than exported with a fabricated time).
    static func parseDate(_ string: String?) -> Date? {
        guard let string, !string.isEmpty else { return nil }
        if let date = isoFractional.date(from: string) { return date }
        return isoPlain.date(from: string)
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
