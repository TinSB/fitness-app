// HealthKitWorkoutMapper — HK-2 HealthKit Workout-History Import V1.
//
// PURE mapping: one `WorkoutReading` → one `IronPathDomain.ImportedWorkoutSample`.
// No HealthKit import, no IO, no clock (timestamps are injected), so `swift test`
// exercises every rule with sample readings. Mirrors the legacy web implementation importer at
// `retired web reference` (`buildWorkout`) + the display label map at
// `retired web reference` (`formatAppleWorkoutType`).
//
// DERIVED / NON-CANONICAL: the produced sample lands in
// `AppData.importedWorkoutSamples` (a bag SEPARATE from `history`) and is
// display-only. It is NEVER a native canonical `TrainingSession` and NEVER feeds
// the `IronPathTrainingDecision` engine (readiness / e1RM). `source` is fixed to
// "healthkit_import" — an unambiguous marker that the record is an external Apple
// Health import, not native training data.

import Foundation
import IronPathDomain

public enum HealthKitWorkoutMapper {
    /// Source marker for HealthKit-imported workouts. Deliberately distinct from
    /// HK-1's body-weight `apple_health_export` source: it unambiguously tags these
    /// rows as DERIVED Apple-Health workout imports, never canonical native sessions.
    public static let source = "healthkit_import"

    /// Shared ISO-8601 formatter — internet date-time with fractional seconds,
    /// matching every other timestamp in the codebase (e.g. "2026-05-27T06:30:00.000Z").
    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// ISO-8601 string for `date` in the canonical format.
    public static func isoString(_ date: Date) -> String { isoFormatter.string(from: date) }

    /// Map one workout reading into a canonical `ImportedWorkoutSample`.
    ///
    /// - `durationMin` is `durationSeconds / 60`, rounded to 1 decimal, clamped >= 0.
    /// - `activeEnergyKcal` / `distanceMeters` / `avgHeartRate` / `maxHeartRate` are
    ///   carried (kcal / meters / bpm, SI), rounded to 1 decimal and clamped >= 0,
    ///   only when the reading recorded them — a missing field degrades honestly to
    ///   nil (never a fabricated 0).
    /// - `id` is content-addressed (`workout-<hash>` over
    ///   source/workoutType/start/end/durationMin) so re-importing the same workout
    ///   dedups in `AppData.appendingImportedWorkoutSample` (mirrors the legacy web schema key).
    /// - `source`, `dataFlag` are fixed per the contract; provenance names are
    ///   preserved when the reading carries them.
    public static func sample(
        from reading: WorkoutReading,
        importedAt: Date,
        batchId: String? = nil
    ) -> ImportedWorkoutSample {
        let startIso = isoString(reading.startDate)
        let endIso = isoString(reading.endDate)
        let durationMin = round1(max(0, reading.durationSeconds / 60))
        let contentKey = "\(source):\(reading.workoutTypeName):\(startIso):\(endIso):\(durationMin)"
        return ImportedWorkoutSample(
            id: "workout-" + stableHash(contentKey),
            source: source,
            sourceName: reading.sourceName,
            deviceSourceName: reading.deviceSourceName,
            workoutType: reading.workoutTypeName,
            startDate: startIso,
            endDate: endIso,
            durationMin: .double(durationMin),
            activeEnergyKcal: reading.activeEnergyKcal.map { .double(round1(max(0, $0))) },
            avgHeartRate: reading.avgHeartRateBpm.map { .double(round1(max(0, $0))) },
            maxHeartRate: reading.maxHeartRateBpm.map { .double(round1(max(0, $0))) },
            distanceMeters: reading.distanceMeters.map { .double(round1(max(0, $0))) },
            importedAt: isoString(importedAt),
            batchId: batchId,
            dataFlag: "normal"
        )
    }

    /// Friendly display label for a workout-type identifier, mirroring the legacy web schema
    /// `formatAppleWorkoutType` (known type → Chinese label; otherwise the raw
    /// identifier; empty → "外部活动"). Pure presentation helper for the UI.
    public static func displayLabel(forWorkoutType identifier: String?) -> String {
        let raw = (identifier ?? "").trimmingCharacters(in: .whitespaces)
        if let label = labels[raw] { return label }
        return raw.isEmpty ? "外部活动" : raw
    }

    private static let labels: [String: String] = [
        "TraditionalStrengthTraining": "传统力量训练",
        "FunctionalStrengthTraining": "功能力量训练",
        "Running": "跑步",
        "Walking": "步行",
        "Cycling": "骑行",
        "Hiking": "徒步",
        "Swimming": "游泳",
        "Yoga": "瑜伽",
        "Badminton": "羽毛球",
        "Basketball": "篮球",
        "Tennis": "网球",
        "Soccer": "足球",
        "Other": "其他运动",
    ]

    /// Round to 1 decimal place, deterministically (storage + dedup-key stable).
    static func round1(_ value: Double) -> Double { (value * 10).rounded() / 10 }

    /// Deterministic content hash for the dedup id. Mirrors the legacy web schema importer's
    /// `hashText` (UTF-16 code unit, 31-multiplier rolling hash, uint32 wraparound,
    /// base-36) at `retired web reference`. Native AppData never leaves
    /// the device, so exact legacy web app byte-parity is not a contract requirement — the id's
    /// job is intra-device idempotency, and it is stable for a given workout.
    static func stableHash(_ text: String) -> String {
        var hash: UInt32 = 0
        for unit in text.utf16 {
            hash = hash &* 31 &+ UInt32(unit)
        }
        return String(hash, radix: 36)
    }
}
