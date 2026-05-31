// HealthKitWorkoutImportTests — HK-2 HealthKit Workout-History Import V1.
//
// REAL unit tests for the PURE workout import logic (mapper + importer), exercised
// with injected sample readings + a fake source — exactly the seam that lets us
// test the mapping without the HealthKit framework (`swift test` cannot run
// HealthKit). The real HKHealthStore source (`HealthKitWorkoutSource`, #if os(iOS))
// is NOT part of the host test build by design.

import XCTest
@testable import IronPathHealthKit
import IronPathDomain

final class HealthKitWorkoutImportTests: XCTestCase {

    private let start = Date(timeIntervalSince1970: 1_000_000)   // 1970-01-12T13:46:40.000Z
    private let end = Date(timeIntervalSince1970: 1_002_700)     // +45 min
    private let importedAt = Date(timeIntervalSince1970: 1_003_000)
    private let laterImport = Date(timeIntervalSince1970: 9_999_999)

    private func reading(
        type: String = "TraditionalStrengthTraining",
        durationSeconds: Double = 2_700,
        kcal: Double? = 320
    ) -> WorkoutReading {
        WorkoutReading(
            startDate: start, endDate: end,
            durationSeconds: durationSeconds,
            workoutTypeName: type,
            activeEnergyKcal: kcal
        )
    }

    // MARK: - Mapper rules

    func testMapsWorkoutToDerivedSample() {
        let sample = HealthKitWorkoutMapper.sample(from: reading(), importedAt: importedAt)
        XCTAssertEqual(sample.source, "healthkit_import")
        XCTAssertEqual(sample.workoutType, "TraditionalStrengthTraining")
        XCTAssertEqual(sample.durationMin?.doubleValue ?? -1, 45, accuracy: 1e-9)
        XCTAssertEqual(sample.activeEnergyKcal?.doubleValue ?? -1, 320, accuracy: 1e-9)
        XCTAssertEqual(sample.startDate, "1970-01-12T13:46:40.000Z")
        XCTAssertEqual(sample.endDate, "1970-01-12T14:31:40.000Z")
        XCTAssertEqual(sample.importedAt, "1970-01-12T14:36:40.000Z")
        XCTAssertEqual(sample.dataFlag, "normal")
        XCTAssertEqual(sample.id?.hasPrefix("workout-"), true)
    }

    func testOmitsEnergyWhenNotRecorded() {
        let sample = HealthKitWorkoutMapper.sample(from: reading(kcal: nil), importedAt: importedAt)
        XCTAssertNil(sample.activeEnergyKcal, "no energy recorded → honest nil, not a fabricated 0")
        XCTAssertNil(sample.distanceMeters)
    }

    func testClampsAndRoundsDuration() {
        // 2_733 s = 45.55 min → rounded to 1 decimal = 45.6 (deterministic for the id).
        let sample = HealthKitWorkoutMapper.sample(from: reading(durationSeconds: 2_733), importedAt: importedAt)
        XCTAssertEqual(sample.durationMin?.doubleValue ?? -1, 45.6, accuracy: 1e-9)
        // A negative duration (never expected) clamps to 0, never negative.
        let neg = HealthKitWorkoutMapper.sample(from: reading(durationSeconds: -60), importedAt: importedAt)
        XCTAssertEqual(neg.durationMin?.doubleValue ?? -1, 0, accuracy: 1e-9)
    }

    func testContentIdIsStableAndWorkoutSpecific() {
        let r = reading()
        let a = HealthKitWorkoutMapper.sample(from: r, importedAt: importedAt)
        // Same workout → same id, even with a DIFFERENT importedAt (the dedup key is
        // the workout content, not the import time — matches the TS key).
        let b = HealthKitWorkoutMapper.sample(from: r, importedAt: laterImport)
        XCTAssertEqual(a.id, b.id, "same workout must hash to the same content id")
        // A genuinely different workout (different type) → different id.
        let c = HealthKitWorkoutMapper.sample(from: reading(type: "Running"), importedAt: importedAt)
        XCTAssertNotEqual(a.id, c.id)
    }

    func testPreservesProvenanceNames() {
        let r = WorkoutReading(
            startDate: start, endDate: end, durationSeconds: 2_700,
            workoutTypeName: "Running",
            activeEnergyKcal: 250,
            sourceName: "Apple Watch", deviceSourceName: "Watch"
        )
        let sample = HealthKitWorkoutMapper.sample(from: r, importedAt: importedAt)
        XCTAssertEqual(sample.sourceName, "Apple Watch")
        XCTAssertEqual(sample.deviceSourceName, "Watch")
    }

    func testDisplayLabelMirrorsAppleTypeMap() {
        XCTAssertEqual(HealthKitWorkoutMapper.displayLabel(forWorkoutType: "TraditionalStrengthTraining"), "传统力量训练")
        XCTAssertEqual(HealthKitWorkoutMapper.displayLabel(forWorkoutType: "Running"), "跑步")
        XCTAssertEqual(HealthKitWorkoutMapper.displayLabel(forWorkoutType: "Other"), "其他运动")
        // Unknown identifier → the raw identifier (TS `labels[raw] || raw`).
        XCTAssertEqual(HealthKitWorkoutMapper.displayLabel(forWorkoutType: "Rowing"), "Rowing")
        // Empty / nil → the generic fallback.
        XCTAssertEqual(HealthKitWorkoutMapper.displayLabel(forWorkoutType: ""), "外部活动")
        XCTAssertEqual(HealthKitWorkoutMapper.displayLabel(forWorkoutType: nil), "外部活动")
    }

    // MARK: - End-to-end with the Domain dedup transform (display-only, NOT history)

    func testMappedWorkoutDedupsInAppDataAndNeverEntersHistory() {
        let sample = HealthKitWorkoutMapper.sample(from: reading(), importedAt: importedAt)
        let once = AppData.emptyCurrent().appendingImportedWorkoutSample(sample)
        // Re-importing the same workout (same content id) must not duplicate.
        let twice = once.appendingImportedWorkoutSample(
            HealthKitWorkoutMapper.sample(from: reading(), importedAt: laterImport)
        )
        XCTAssertEqual(twice.importedWorkoutSamples.count, 1, "same workout re-import must dedup in AppData")
        // Red line: an imported workout is derived/external, NEVER canonical history.
        XCTAssertEqual(twice.history.count, 0, "imported workouts must never enter canonical history")
    }

    // MARK: - Importer (fake source seam)

    private enum FakeError: Error { case authorizationFailed }

    private final class FakeWorkoutSource: WorkoutSampleSource, @unchecked Sendable {
        var readings: [WorkoutReading]
        var authError: Error?
        private(set) var events: [String] = []
        private(set) var requestedLimit: Int?

        init(readings: [WorkoutReading] = [], authError: Error? = nil) {
            self.readings = readings
            self.authError = authError
        }

        func requestReadAuthorization() async throws {
            events.append("auth")
            if let authError { throw authError }
        }

        func recentWorkouts(limit: Int) async throws -> [WorkoutReading] {
            events.append("read")
            requestedLimit = limit
            return readings
        }
    }

    func testImporterReturnsMappedSamplesFromReadings() async throws {
        let source = FakeWorkoutSource(readings: [reading(), reading(type: "Running")])
        let samples = try await HealthKitWorkoutImporter(source: source).importRecentWorkouts(importedAt: importedAt)
        XCTAssertEqual(samples.count, 2)
        XCTAssertEqual(samples.first?.source, "healthkit_import")
        XCTAssertEqual(samples.first?.workoutType, "TraditionalStrengthTraining")
        XCTAssertEqual(samples.last?.workoutType, "Running")
    }

    func testImporterReturnsEmptyWhenNoWorkouts() async throws {
        let samples = try await HealthKitWorkoutImporter(source: FakeWorkoutSource(readings: []))
            .importRecentWorkouts(importedAt: importedAt)
        XCTAssertTrue(samples.isEmpty, "no workouts → honest empty, never a fabricated sample")
    }

    func testImporterPropagatesAuthorizationError() async {
        let source = FakeWorkoutSource(authError: FakeError.authorizationFailed)
        do {
            _ = try await HealthKitWorkoutImporter(source: source).importRecentWorkouts(importedAt: importedAt)
            XCTFail("expected the authorization error to propagate")
        } catch {
            XCTAssertEqual(error as? FakeError, .authorizationFailed)
        }
    }

    func testImporterAuthorizesBeforeReadingAndPassesLimit() async throws {
        let source = FakeWorkoutSource(readings: [reading()])
        _ = try await HealthKitWorkoutImporter(source: source).importRecentWorkouts(importedAt: importedAt, limit: 25)
        XCTAssertEqual(source.events, ["auth", "read"], "must request authorization before reading")
        XCTAssertEqual(source.requestedLimit, 25)
    }
}
