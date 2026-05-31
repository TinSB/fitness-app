// WorkoutReading + WorkoutSampleSource — HK-2 HealthKit Workout-History Import V1.
//
// The injectable seam that keeps the workout import MAPPING logic a pure, testable
// function with no dependency on the HealthKit framework. The HealthKit-specific
// extraction (HKWorkout → these primitives) lives in `HealthKitWorkoutSource`
// (co-located in `HealthKitBodyMassSource.swift`, `#if os(iOS)`); everything that
// consumes a `WorkoutReading` is plain value logic that `swift test` can exercise
// with a fake source.
//
// READ-ONLY by design (master §17/§18 as amended by HK-2): the source can request
// READ authorization and read recent workout summaries. It exposes NO write
// capability — writing IronPath sessions back to Apple Health is the deferred HK-3
// slice, not part of this contract.

import Foundation

/// One Apple-Health workout summary lifted out of HealthKit into a plain, testable
/// value. It carries already-extracted primitives so the mapper needs no HealthKit:
/// the source records the start/end instants, a duration, the activity-type name,
/// and optional energy / distance / provenance. Energy is kcal, distance is meters
/// (SI), duration is seconds — the mapper normalizes to the stored shape.
public struct WorkoutReading: Equatable, Sendable {
    /// Workout start instant (HealthKit `startDate`).
    public let startDate: Date
    /// Workout end instant (HealthKit `endDate`).
    public let endDate: Date
    /// Elapsed workout duration in SECONDS (HealthKit `HKWorkout.duration`).
    public let durationSeconds: Double
    /// A stable identifier for the activity type (e.g. "TraditionalStrengthTraining",
    /// "Running"), computed by the source via a compile-checked switch over the
    /// `HKWorkoutActivityType` cases. Unknown/rare types fall back to "Other".
    /// The display label (Chinese) is derived from this by `HealthKitWorkoutMapper`.
    public let workoutTypeName: String
    /// Active energy burned in kilocalories, when recorded.
    public let activeEnergyKcal: Double?
    /// Total distance in meters, when recorded.
    public let distanceMeters: Double?
    /// Optional Apple-Health provenance (source app / device names), preserved
    /// verbatim into the sample when present.
    public let sourceName: String?
    public let deviceSourceName: String?

    public init(
        startDate: Date,
        endDate: Date,
        durationSeconds: Double,
        workoutTypeName: String,
        activeEnergyKcal: Double? = nil,
        distanceMeters: Double? = nil,
        sourceName: String? = nil,
        deviceSourceName: String? = nil
    ) {
        self.startDate = startDate
        self.endDate = endDate
        self.durationSeconds = durationSeconds
        self.workoutTypeName = workoutTypeName
        self.activeEnergyKcal = activeEnergyKcal
        self.distanceMeters = distanceMeters
        self.sourceName = sourceName
        self.deviceSourceName = deviceSourceName
    }
}

/// The protocol seam between the pure import logic and the real HealthKit store.
///
/// READ-ONLY by design: it can request READ authorization and read recent workout
/// readings. It exposes NO write capability — writing IronPath sessions back to
/// Apple Health is the deferred HK-3 slice, not part of this contract.
public protocol WorkoutSampleSource: Sendable {
    /// Request user authorization to READ workouts from Apple Health. Throws if
    /// authorization could not even be requested (e.g. HealthKit unavailable on the
    /// device). The user granting/denying is their choice; a denial surfaces as
    /// `recentWorkouts(limit:)` returning an empty array, not as a thrown error.
    func requestReadAuthorization() async throws

    /// The most recent workout readings (newest first), at most `limit`. Returns an
    /// empty array when none exist or read access was not granted.
    func recentWorkouts(limit: Int) async throws -> [WorkoutReading]
}
