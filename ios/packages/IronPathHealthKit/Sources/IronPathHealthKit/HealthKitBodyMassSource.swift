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
// READ + BOUNDED EXPORT (master §6.2/§16/§17/§18 as amended by HK-1/HK-2/HK-3): the
// READ adapters request READ authorization (`toShare: []` — share NOTHING) and read
// samples (body mass, workouts, workout-attached distance/heart rate). HK-3 adds the
// FIRST and ONLY write capability: `HealthKitWorkoutSource` ALSO conforms to
// `WorkoutExportSink`, sharing ONLY the workout type (`toShare: [workoutType]`) to
// EXPORT IronPath's own completed sessions as `HKWorkout`s via `HKWorkoutBuilder`
// (HK-3b) — user-triggered + idempotent + device-local. NO other Apple-Health type is ever
// written (body mass / heart rate stay read-only); no network/cloud. Importing
// Apple-Health data back out is structurally impossible — export maps only native
// `IronPathDomain.TrainingSession`s (see the pure `HealthKitWorkoutExporter`).
//
// The static guards (`tests/iosBootstrapForbiddenImports.test.ts` +
// `tests/iosHealthKitWorkoutExportStaticGuards.test.ts`) exempt THIS one file from the
// HealthKit-token bans (body-mass AND workout tokens), pin that the ONLY writable type
// is the workout type, and assert no other Apple-Health write; every other Swift file
// under ios/ stays HealthKit-free.

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

/// HK-2 (read) + HK-3 (export): the real, device-backed workout adapter. Co-located
/// with the body-mass adapter so all HealthKit calls stay in this one file. As a
/// `WorkoutSampleSource` it requests READ authorization (`toShare: []`) and reads
/// recent workout summaries. As a `WorkoutExportSink` (HK-3 — see the extension
/// below) it requests WRITE authorization for ONLY the workout type
/// (`toShare: [workoutType]`) and exports IronPath's own completed sessions as
/// `HKWorkout`s via `HKHealthStore.save` — the first and only write-back in the
/// HealthKit boundary: user-triggered, idempotent (session-id metadata tag), and
/// device-local. No other Apple-Health type is ever written.
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

// MARK: - HK-3 Workout EXPORT (write-back) — the first & only Apple-Health write.
//
// `HealthKitWorkoutSource` ALSO conforms to the `WorkoutExportSink` seam to EXPORT
// IronPath's own completed sessions to Apple Health as `HKWorkout`s. This is the only
// write capability in the whole HealthKit boundary; it shares ONLY the workout type
// (`toShare: [workoutType]`) and writes ONLY `HKWorkout`s (never body mass / heart
// rate / any other type). Idempotent: each exported workout is tagged with the
// IronPath session id in metadata and a pre-export query skips ids already present, so
// idempotency state lives in Apple Health, not in app-side storage. User-triggered +
// device-local (no network/cloud). The native-only / no-loop-back guarantee is upstream
// and structural: the pure `HealthKitWorkoutExporter` only ever produces
// `WorkoutExportRequest`s from native `TrainingSession`s.
extension HealthKitWorkoutSource: WorkoutExportSink {
    /// Request user authorization to WRITE (share) workouts to Apple Health. This is the
    /// FIRST non-empty `toShare` in the HealthKit boundary, and it shares ONLY the
    /// workout type — body mass / heart rate remain read-only. Read access to the
    /// workout type is also requested so the idempotency query can see previously
    /// exported workouts. A no-op (returns normally) when HealthKit is unavailable.
    public func requestExportAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        try await store.requestAuthorization(toShare: [workoutType], read: [workoutType])
    }

    /// Export the given native session requests to Apple Health as `HKWorkout`s,
    /// idempotently. Any request whose `sessionId` is already present in Health (matched
    /// by the metadata tag) is skipped; each remaining workout is built and saved via
    /// `HKWorkoutBuilder` (HK-3b — `finishWorkout()` persists it; the non-deprecated iOS
    /// 17+ replacement for the old `HKWorkout` initializer + `HKHealthStore.save`). A
    /// single build/save failure is counted honestly and does not abort the rest. Returns
    /// an honest `WorkoutExportSummary` (no fake success).
    public func export(_ requests: [WorkoutExportRequest]) async throws -> WorkoutExportSummary {
        guard HKHealthStore.isHealthDataAvailable(), !requests.isEmpty else { return .empty }
        let alreadyExported = try await exportedSessionIDs()
        var exported = 0
        var skipped = 0
        var failed = 0
        for request in requests {
            if alreadyExported.contains(request.sessionId) {
                skipped += 1
                continue
            }
            // HK-3b: build + save the workout via HKWorkoutBuilder (the non-deprecated
            // iOS 17+ path) instead of the deprecated
            // HKWorkout(activityType:start:end:duration:totalEnergyBurned:totalDistance:metadata:)
            // initializer. Equivalent write — the SAME activity type, the SAME start/end
            // window (so the builder-derived duration == request.durationSeconds == end −
            // start), and the SAME com.ironpath.sessionID metadata. No energy/distance
            // samples are added, so those totals stay unset — exactly the old
            // totalEnergyBurned: nil / totalDistance: nil. The builder is bound to `store`,
            // so finishWorkout() persists the workout to Apple Health (replacing the
            // explicit store.save). The whole build+save runs in the do/catch, so any
            // failed step is counted honestly as `failed` — never a fake success.
            let configuration = HKWorkoutConfiguration()
            configuration.activityType = Self.exportActivityType(request.activityTypeName)
            let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: nil)
            do {
                try await builder.beginCollection(at: request.start)
                try await builder.addMetadata([HealthKitWorkoutExporter.metadataSessionIDKey: request.sessionId])
                try await builder.endCollection(at: request.end)
                _ = try await builder.finishWorkout()
                exported += 1
            } catch {
                // No fake success — a failed build/save is surfaced, never hidden.
                failed += 1
            }
        }
        return WorkoutExportSummary(exported: exported, skippedDuplicate: skipped, failed: failed)
    }

    /// The set of IronPath session ids already exported to Apple Health — the workouts
    /// carrying our `metadataSessionIDKey`. This is the idempotency state, queried from
    /// Health (NOT stored app-side), so a re-export of the same session is a no-op.
    private func exportedSessionIDs() async throws -> Set<String> {
        let predicate = HKQuery.predicateForObjects(
            withMetadataKey: HealthKitWorkoutExporter.metadataSessionIDKey
        )
        let workouts: [HKWorkout] = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: workoutType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: nil
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: (samples as? [HKWorkout]) ?? [])
            }
            store.execute(query)
        }
        var ids: Set<String> = []
        for workout in workouts {
            if let id = workout.metadata?[HealthKitWorkoutExporter.metadataSessionIDKey] as? String {
                ids.insert(id)
            }
        }
        return ids
    }

    /// Map a stable activity-type identifier to a `HKWorkoutActivityType`. Native
    /// IronPath sessions export as traditional strength training; the switch is
    /// compile-checked against the SDK enum (a renamed/removed case fails the build).
    private static func exportActivityType(_ name: String) -> HKWorkoutActivityType {
        switch name {
        case "TraditionalStrengthTraining": return .traditionalStrengthTraining
        case "FunctionalStrengthTraining": return .functionalStrengthTraining
        default: return .traditionalStrengthTraining
        }
    }
}
#endif
