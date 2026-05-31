// HealthKitBodyMassSource — HK-1 HealthKit Body-Weight Import V1
//                           + HK-2 HealthKit Workout-History Import V1
//                           + HK-2b Workout distance + avg/max heart rate V1.
//
// THE ONLY file in the iOS tree that imports HealthKit and touches HKHealthStore
// / HKQuantityType / HKWorkout. It hosts the real, device-backed read adapters:
//   • `HealthKitBodyMassSource` — `BodyMassSampleSource` (HK-1, latest body mass).
//   • `HealthKitWorkoutSource`  — `WorkoutSampleSource` (HK-2 recent workouts;
//     HK-2b adds distance + avg/max heart rate, still read-only, still derived).
// Both are co-located here ON PURPOSE so that EVERY HealthKit call in the whole
// iOS tree stays in this single `#if os(iOS)` file (the static-guard invariant).
//
// Compiled `#if os(iOS)` ONLY: the host `swift test` toolchain (macOS) never
// builds this file, which is exactly why the mapping logic lives behind the
// `BodyMassReading`/`BodyMassSampleSource` + `WorkoutReading`/`WorkoutSampleSource`
// seams and is unit-tested there with injected samples. The iOS app/device build
// is where this file compiles and runs.
//
// READ-ONLY (master §17/§18 as amended by HK-1/HK-2): each adapter requests READ
// authorization (`toShare: []` — shares NOTHING) and reads samples. There is NO
// write-back path — no `HKHealthStore.save`, no sample construction. Writing
// IronPath data into Apple Health is the deferred HK-3 slice.
//
// The static guard `tests/iosBootstrapForbiddenImports.test.ts` exempts THIS one
// file path from the HealthKit-token bans (body-mass AND workout tokens) and
// additionally asserts it stays read-only; every other Swift file under ios/ stays
// HealthKit-free.

#if os(iOS)
import Foundation
import HealthKit

public struct HealthKitBodyMassSource: BodyMassSampleSource {
    private let store = HKHealthStore()
    private let bodyMassType = HKQuantityType(.bodyMass)

    public init() {}

    /// Request READ authorization for body mass. Shares nothing (`toShare: []`).
    /// A no-op (returns normally) when HealthKit is unavailable on the device.
    public func requestReadAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        try await store.requestAuthorization(toShare: [], read: [bodyMassType])
    }

    /// Read the single most-recent body-mass sample and lift it into a plain
    /// `BodyMassReading` (kg). Returns nil when HealthKit is unavailable, access
    /// was not granted, or no sample exists.
    public func latestBodyMass() async throws -> BodyMassReading? {
        guard HKHealthStore.isHealthDataAvailable() else { return nil }
        let newestFirst = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let sample: HKQuantitySample? = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: bodyMassType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [newestFirst]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: samples?.first as? HKQuantitySample)
            }
            store.execute(query)
        }
        guard let sample else { return nil }
        // HealthKit unit conversion → always kilograms (UnitSettings contract).
        let kilograms = sample.quantity.doubleValue(for: HKUnit.gramUnit(with: .kilo))
        return BodyMassReading(
            startDate: sample.startDate,
            kilograms: kilograms,
            sourceName: sample.sourceRevision.source.name,
            deviceSourceName: sample.device?.name
        )
    }
}

/// HK-2: the real, device-backed `WorkoutSampleSource`. Co-located with the
/// body-mass adapter so all HealthKit calls stay in this one file. READ-ONLY:
/// requests read authorization for workouts (`toShare: []`) and reads recent
/// workout summaries. NO write-back (no `HKHealthStore.save`, no `HKWorkout(...)`
/// construction) — writing IronPath sessions into Apple Health is the deferred
/// HK-3 slice.
public struct HealthKitWorkoutSource: WorkoutSampleSource {
    private let store = HKHealthStore()
    private let workoutType = HKObjectType.workoutType()
    private let energyType = HKQuantityType(.activeEnergyBurned)
    private let heartRateType = HKQuantityType(.heartRate)

    public init() {}

    /// Request READ authorization for workouts AND heart rate (HK-2b). Shares nothing
    /// (`toShare: []`). Distance needs no separate type — it is read from the workout's
    /// own bundled statistics (it rides along with workout access, like energy); heart
    /// rate is a distinct quantity type read over the workout's time window, so it is
    /// added to the read set. A no-op (returns normally) when HealthKit is unavailable.
    public func requestReadAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        try await store.requestAuthorization(toShare: [], read: [workoutType, heartRateType])
    }

    /// Read the most recent workouts (newest first, at most `limit`) and lift each
    /// into a plain `WorkoutReading`. Returns an empty array when HealthKit is
    /// unavailable, access was not granted, or no workout exists.
    public func recentWorkouts(limit: Int) async throws -> [WorkoutReading] {
        guard HKHealthStore.isHealthDataAvailable() else { return [] }
        let newestFirst = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let workouts: [HKWorkout] = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: workoutType,
                predicate: nil,
                limit: limit,
                sortDescriptors: [newestFirst]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: (samples as? [HKWorkout]) ?? [])
            }
            store.execute(query)
        }
        var readings: [WorkoutReading] = []
        readings.reserveCapacity(workouts.count)
        for workout in workouts {
            readings.append(await reading(from: workout))
        }
        return readings
    }

    /// Lift one `HKWorkout` into the plain, testable `WorkoutReading` primitives.
    /// Active energy and total distance are read from the workout's own bundled
    /// `statistics(for:)` (kcal / meters); average + maximum heart rate (bpm) are read
    /// READ-ONLY from the `heartRate` samples within the workout's start–end window
    /// (HK-2b). Every supplementary field is honestly nil when the workout recorded
    /// nothing / read access was not granted — never a fabricated value.
    private func reading(from workout: HKWorkout) async -> WorkoutReading {
        let kcal = workout.statistics(for: energyType)?
            .sumQuantity()?
            .doubleValue(for: HKUnit.kilocalorie())
        let meters = distanceMeters(of: workout)
        let heart = await heartRateStatistics(in: workout)
        return WorkoutReading(
            startDate: workout.startDate,
            endDate: workout.endDate,
            durationSeconds: workout.duration,
            workoutTypeName: Self.activityName(workout.workoutActivityType),
            activeEnergyKcal: kcal,
            distanceMeters: meters,
            avgHeartRateBpm: heart.average,
            maxHeartRateBpm: heart.maximum,
            sourceName: workout.sourceRevision.source.name,
            deviceSourceName: workout.device?.name
        )
    }

    /// Total distance in meters from the workout's own bundled statistics, using the
    /// activity-appropriate distance quantity type. Non-distance activities (e.g.
    /// strength training, yoga) honestly return nil. Read from the already-fetched
    /// workout — no extra query, no separate authorization (it rides along with
    /// workout access, mirroring the energy read).
    private func distanceMeters(of workout: HKWorkout) -> Double? {
        guard let distanceType = Self.distanceType(for: workout.workoutActivityType) else {
            return nil
        }
        return workout.statistics(for: distanceType)?
            .sumQuantity()?
            .doubleValue(for: HKUnit.meter())
    }

    /// Average + maximum heart rate (bpm) over the workout's start–end window, read
    /// READ-ONLY from the `heartRate` samples via a discrete-statistics query. Returns
    /// (nil, nil) honestly when there are no heart-rate samples, read access was not
    /// granted, or the query fails — a supplementary, display-only field never aborts
    /// the import (no fake success either way).
    private func heartRateStatistics(in workout: HKWorkout) async -> (average: Double?, maximum: Double?) {
        let bpm = HKUnit.count().unitDivided(by: .minute())
        let predicate = HKQuery.predicateForSamples(withStart: workout.startDate, end: workout.endDate)
        let stats: HKStatistics? = try? await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: heartRateType,
                quantitySamplePredicate: predicate,
                options: [.discreteAverage, .discreteMax]
            ) { _, statistics, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: statistics)
            }
            store.execute(query)
        }
        return (
            stats?.averageQuantity()?.doubleValue(for: bpm),
            stats?.maximumQuantity()?.doubleValue(for: bpm)
        )
    }

    /// The distance quantity type that matches a workout's activity, or nil for
    /// activities that record no distance. Compile-checked against the SDK enum, so a
    /// renamed/removed case fails the build rather than silently producing nil.
    private static func distanceType(for activity: HKWorkoutActivityType) -> HKQuantityType? {
        switch activity {
        case .running, .walking, .hiking: return HKQuantityType(.distanceWalkingRunning)
        case .cycling: return HKQuantityType(.distanceCycling)
        case .swimming: return HKQuantityType(.distanceSwimming)
        default: return nil
        }
    }

    /// Stable identifier for the labeled activity types (mirrors the TS keys used by
    /// `formatAppleWorkoutType`); every other type maps to "Other". Compile-checked
    /// against the SDK enum, so a renamed/removed case fails the build rather than
    /// silently producing a wrong label. The pure `HealthKitWorkoutMapper` turns
    /// this identifier into the Chinese display label.
    private static func activityName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .traditionalStrengthTraining: return "TraditionalStrengthTraining"
        case .functionalStrengthTraining: return "FunctionalStrengthTraining"
        case .running: return "Running"
        case .walking: return "Walking"
        case .cycling: return "Cycling"
        case .hiking: return "Hiking"
        case .swimming: return "Swimming"
        case .yoga: return "Yoga"
        case .badminton: return "Badminton"
        case .basketball: return "Basketball"
        case .tennis: return "Tennis"
        case .soccer: return "Soccer"
        default: return "Other"
        }
    }
}
#endif
