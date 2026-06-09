// HealthKitBodyMassImportTests — HK-1 HealthKit Body-Weight Import V1.
//
// REAL unit tests for the PURE import logic (mapper + importer), exercised with
// injected sample readings + a fake source — exactly the seam that lets us test
// the mapping without the HealthKit framework (`swift test` cannot run HealthKit).
// The real HKHealthStore source (`HealthKitBodyMassSource`, #if os(iOS)) is NOT
// part of the host test build by design.

import XCTest
@testable import RedeHealthKit
import RedeDomain

final class HealthKitBodyMassImportTests: XCTestCase {

    private let epoch0 = Date(timeIntervalSince1970: 0)        // 1970-01-01T00:00:00.000Z
    private let later = Date(timeIntervalSince1970: 1_000)     // 1970-01-01T00:16:40.000Z

    // MARK: - Mapper rules

    func testMapsBodyWeightToCanonicalKgSample() {
        let reading = BodyMassReading(startDate: epoch0, kilograms: 70.5)
        let sample = HealthKitBodyMassMapper.sample(from: reading, importedAt: epoch0)
        XCTAssertEqual(sample.metricType, "body_weight")
        XCTAssertEqual(sample.source, "apple_health_export")
        XCTAssertEqual(sample.unit, "kg")
        XCTAssertEqual(sample.value?.doubleValue ?? -1, 70.5, accuracy: 1e-9)
        XCTAssertEqual(sample.startDate, "1970-01-01T00:00:00.000Z")
        XCTAssertEqual(sample.importedAt, "1970-01-01T00:00:00.000Z")
        XCTAssertEqual(sample.dataFlag, "normal")
        XCTAssertEqual(sample.id?.hasPrefix("health-"), true)
    }

    func testClampsNegativeKilogramsToZero() {
        let sample = HealthKitBodyMassMapper.sample(
            from: BodyMassReading(startDate: epoch0, kilograms: -3),
            importedAt: epoch0
        )
        XCTAssertEqual(sample.value?.doubleValue ?? -1, 0, accuracy: 1e-9)
    }

    func testContentIdIsStableAndReadingSpecific() {
        let r1 = BodyMassReading(startDate: epoch0, kilograms: 70)
        let a = HealthKitBodyMassMapper.sample(from: r1, importedAt: epoch0)
        // Same reading → same id, even with a DIFFERENT importedAt (the dedup key
        // is the reading content, not the import time — matches the legacy web schema key).
        let b = HealthKitBodyMassMapper.sample(from: r1, importedAt: later)
        XCTAssertEqual(a.id, b.id, "same reading must hash to the same content id")
        // A genuinely different reading → different id.
        let c = HealthKitBodyMassMapper.sample(
            from: BodyMassReading(startDate: epoch0, kilograms: 71), importedAt: epoch0
        )
        XCTAssertNotEqual(a.id, c.id)
    }

    func testPreservesProvenanceNames() {
        let reading = BodyMassReading(
            startDate: epoch0, kilograms: 68,
            sourceName: "Health", deviceSourceName: "iPhone"
        )
        let sample = HealthKitBodyMassMapper.sample(from: reading, importedAt: epoch0)
        XCTAssertEqual(sample.sourceName, "Health")
        XCTAssertEqual(sample.deviceSourceName, "iPhone")
    }

    func testIsoFormatProducesFractionalZulu() {
        XCTAssertEqual(HealthKitBodyMassMapper.isoString(epoch0), "1970-01-01T00:00:00.000Z")
    }

    // MARK: - End-to-end with the Domain dedup transform

    func testMappedSampleDedupsInAppData() {
        let reading = BodyMassReading(startDate: epoch0, kilograms: 70)
        let sample = HealthKitBodyMassMapper.sample(from: reading, importedAt: epoch0)
        // Re-importing the same reading (same content id) must not duplicate.
        let once = AppData.emptyCurrent().appendingHealthMetricSample(sample)
        let twice = once.appendingHealthMetricSample(
            HealthKitBodyMassMapper.sample(from: reading, importedAt: later)  // different import time, same reading
        )
        XCTAssertEqual(twice.healthMetricSamples.count, 1, "same reading re-import must dedup in AppData")
        XCTAssertEqual(twice.healthMetricSamples.first?.value?.doubleValue ?? -1, 70, accuracy: 1e-9)
    }

    // MARK: - Importer (fake source seam)

    private enum FakeError: Error { case authorizationFailed }

    private final class FakeBodyMassSource: BodyMassSampleSource, @unchecked Sendable {
        var reading: BodyMassReading?
        var authError: Error?
        private(set) var events: [String] = []

        init(reading: BodyMassReading? = nil, authError: Error? = nil) {
            self.reading = reading
            self.authError = authError
        }

        func requestReadAuthorization() async throws {
            events.append("auth")
            if let authError { throw authError }
        }

        func latestBodyMass() async throws -> BodyMassReading? {
            events.append("read")
            return reading
        }
    }

    func testImporterReturnsMappedSampleFromLatestReading() async throws {
        let source = FakeBodyMassSource(reading: BodyMassReading(startDate: epoch0, kilograms: 73.2))
        let importer = HealthKitBodyMassImporter(source: source)
        let sample = try await importer.importLatestBodyMass(importedAt: epoch0)
        XCTAssertEqual(sample?.metricType, "body_weight")
        XCTAssertEqual(sample?.value?.doubleValue ?? -1, 73.2, accuracy: 1e-9)
        XCTAssertEqual(sample?.unit, "kg")
    }

    func testImporterReturnsNilWhenNoReading() async throws {
        let importer = HealthKitBodyMassImporter(source: FakeBodyMassSource(reading: nil))
        let sample = try await importer.importLatestBodyMass(importedAt: epoch0)
        XCTAssertNil(sample, "no reading → honest nil, never a fabricated sample")
    }

    func testImporterPropagatesAuthorizationError() async {
        let source = FakeBodyMassSource(authError: FakeError.authorizationFailed)
        let importer = HealthKitBodyMassImporter(source: source)
        do {
            _ = try await importer.importLatestBodyMass(importedAt: epoch0)
            XCTFail("expected the authorization error to propagate")
        } catch {
            XCTAssertEqual(error as? FakeError, .authorizationFailed)
        }
    }

    func testImporterAuthorizesBeforeReading() async throws {
        let source = FakeBodyMassSource(reading: BodyMassReading(startDate: epoch0, kilograms: 60))
        _ = try await HealthKitBodyMassImporter(source: source).importLatestBodyMass(importedAt: epoch0)
        XCTAssertEqual(source.events, ["auth", "read"], "must request authorization before reading")
    }
}
