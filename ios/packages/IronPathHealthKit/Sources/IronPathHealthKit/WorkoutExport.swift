// WorkoutExport — HK-3 HealthKit Workout WRITE-BACK (Export) V1.
//
// The injectable WRITE seam that keeps the export MAPPING logic a pure, testable
// function with no dependency on the HealthKit framework. It mirrors the read-only
// `WorkoutReading`/`WorkoutSampleSource` seam (HK-2), but for the opposite
// direction: a user-triggered, idempotent, native-only EXPORT of IronPath's own
// completed sessions to Apple Health as `HKWorkout`s. The real `HKWorkout`
// construction + `HKHealthStore.save` lives in `HealthKitWorkoutSource`
// (co-located in `HealthKitBodyMassSource.swift`, `#if os(iOS)`); everything that
// PRODUCES a `WorkoutExportRequest` is plain value logic that `swift test` exercises
// with no HealthKit.
//
// HARD BOUNDARIES (HK-3, master §6.2/§16/§17/§18 as amended in this PR):
//   • EXPORT direction only — IronPath native completed sessions → Apple Health.
//     The body-mass / heart-rate / workout READ adapters stay read-only.
//   • User-triggered ONLY (never automatic) and device-local (no network/cloud).
//   • Idempotent: each exported workout is tagged with the IronPath session id in
//     `HKWorkout` metadata; the adapter queries Apple Health for that tag and skips
//     anything already present — idempotency state lives in Health, NOT in app-side
//     storage (no extra disk state, no AppData schema bump).
//   • AppData stays the source of truth; Apple Health is a DERIVED export target.
//     Export never writes AppData and never re-exports Apple-Health-imported records
//     (structural no-loop-back: only `[TrainingSession]` from `AppData.history` can
//     be mapped — see `HealthKitWorkoutExporter`).

import Foundation

/// A pure, HealthKit-free description of ONE native completed session to export to
/// Apple Health as an `HKWorkout`. It carries only plain values (no `HKWorkout`, no
/// HealthKit types) so the mapping is host-testable; the adapter turns it into a real
/// `HKWorkout` (`activityTypeName` → `HKWorkoutActivityType`) and saves it.
public struct WorkoutExportRequest: Equatable, Sendable {
    /// The IronPath canonical session id. Written verbatim into the exported
    /// `HKWorkout`'s metadata (`HealthKitWorkoutExporter.metadataSessionIDKey`) so a
    /// re-export of the same session is an idempotent no-op (queried back from Health).
    public let sessionId: String
    /// A stable activity-type identifier (e.g. "TraditionalStrengthTraining"); the
    /// adapter maps it to a `HKWorkoutActivityType` via a compile-checked switch.
    public let activityTypeName: String
    /// Workout start instant.
    public let start: Date
    /// Workout end instant (always `>= start`).
    public let end: Date
    /// Elapsed duration in SECONDS (`end - start`).
    public let durationSeconds: Double

    public init(
        sessionId: String,
        activityTypeName: String,
        start: Date,
        end: Date,
        durationSeconds: Double
    ) {
        self.sessionId = sessionId
        self.activityTypeName = activityTypeName
        self.start = start
        self.end = end
        self.durationSeconds = durationSeconds
    }
}

/// An honest tally of one export run — no fake success (master §15.4). A pure value so
/// the app/UI can render counts without importing HealthKit.
public struct WorkoutExportSummary: Equatable, Sendable {
    /// Newly written `HKWorkout`s (sessions not previously present in Apple Health).
    public let exported: Int
    /// Sessions already present in Apple Health (matched by the session-id metadata
    /// tag) — an idempotent no-op, never a duplicate write.
    public let skippedDuplicate: Int
    /// Per-session save failures, surfaced honestly (never hidden as success). A single
    /// failure does not abort the rest of the run.
    public let failed: Int

    public init(exported: Int = 0, skippedDuplicate: Int = 0, failed: Int = 0) {
        self.exported = exported
        self.skippedDuplicate = skippedDuplicate
        self.failed = failed
    }

    /// Nothing exportable / nothing happened.
    public static let empty = WorkoutExportSummary()
}

/// The WRITE seam between the pure export logic and the real HealthKit store (HK-3).
///
/// Mirrors the read-only `WorkoutSampleSource` (HK-2) but for EXPORT. It is the ONLY
/// write capability in the HealthKit boundary: the app depends on this protocol, never
/// on HealthKit directly; the real implementation (`HealthKitWorkoutSource`) is the
/// single `#if os(iOS)` adapter. There is NO capability here to write any OTHER Apple
/// Health type (body mass / heart rate stay read-only).
public protocol WorkoutExportSink: Sendable {
    /// Request user authorization to WRITE (share) workouts to Apple Health. Throws if
    /// authorization could not even be requested (e.g. HealthKit unavailable). The user
    /// granting/denying is their choice; a denial surfaces as a later save failure /
    /// honest summary, not as a fabricated success.
    func requestExportAuthorization() async throws

    /// Export the given native session requests to Apple Health as `HKWorkout`s,
    /// idempotently: any request whose `sessionId` is already present in Health (matched
    /// by the metadata tag) is skipped. Returns an honest `WorkoutExportSummary`
    /// (exported / skippedDuplicate / failed). Device-local; nothing leaves the device.
    func export(_ requests: [WorkoutExportRequest]) async throws -> WorkoutExportSummary
}
