// HealthMetricSampleImportTests — HK-1 HealthKit Body-Weight Import V1.
//
// REAL unit tests for the pure open-bag AppData.healthMetricSamples append used
// by the HK-1 gated import path. Run via `swift test`. Deterministic; never
// touches disk/network/HealthKit.

import XCTest
@testable import RedeDomain

final class HealthMetricSampleImportTests: XCTestCase {

    private func bodyWeight(
        id: String? = "health-abc",
        kg: Double = 70.5,
        startDate: String = "2026-05-27T06:30:00.000Z"
    ) -> HealthMetricSample {
        HealthMetricSample(
            id: id,
            source: "apple_health_export",
            metricType: "body_weight",
            startDate: startDate,
            value: .double(kg),
            unit: "kg",
            importedAt: "2026-05-27T07:00:00.000Z",
            dataFlag: "normal"
        )
    }

    // MARK: - Append to an empty base

    func testAppendingSampleToEmptyBase() throws {
        let appData = AppData.emptyCurrent().appendingHealthMetricSample(bodyWeight(kg: 72))
        XCTAssertEqual(appData.healthMetricSamples.count, 1)
        let s = try XCTUnwrap(appData.healthMetricSamples.first)
        XCTAssertEqual(s.metricType, "body_weight")
        XCTAssertEqual(s.unit, "kg")
        XCTAssertEqual(s.source, "apple_health_export")
        XCTAssertEqual(s.value?.doubleValue ?? -1, 72, accuracy: 1e-9)
        // Round-trips through canonical bytes (kg preserved).
        let reDecoded = try AppData(decoding: appData.canonicalJSONData())
        XCTAssertEqual(reDecoded.healthMetricSamples.count, 1)
        XCTAssertEqual(reDecoded.healthMetricSamples.first?.value?.doubleValue ?? -1, 72, accuracy: 1e-9)
        XCTAssertEqual(reDecoded.healthMetricSamples.first?.metricType, "body_weight")
    }

    // MARK: - Open-bag + existing samples preserved

    func testAppendingPreservesOpenBagAndExistingSamples() throws {
        // AppData with an EXISTING health sample, unknown top-level keys + settings.
        let json = """
        {"schemaVersion":8,\
        "healthMetricSamples":[{"id":"old-1","metricType":"body_weight","value":68,"unit":"kg"}],\
        "settings":{"weightUnit":"kg"},"futureUnknownKey":{"nested":[1,2,3]}}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        let next = appData.appendingHealthMetricSample(bodyWeight(id: "new-1", kg: 71))
        // Samples grew by exactly one; old retained, new appended last.
        XCTAssertEqual(next.healthMetricSamples.count, 2)
        XCTAssertEqual(next.healthMetricSamples.first?.id, "old-1")
        XCTAssertEqual(next.healthMetricSamples.last?.id, "new-1")
        // schemaVersion unchanged (append is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)
        // Open bag preserved: unknown key + settings survive verbatim.
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "unknown key dropped: \(canonical)")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"), "nested unknown lost")
        XCTAssertTrue(canonical.contains("\"settings\":{\"weightUnit\":\"kg\"}"), "settings lost: \(canonical)")
        // Re-decodes cleanly.
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(reDecoded.healthMetricSamples.count, 2)
    }

    // MARK: - Dedup by content id (idempotent re-import)

    func testDedupByIdIsIdempotent() {
        let base = AppData.emptyCurrent().appendingHealthMetricSample(bodyWeight(id: "health-x", kg: 70))
        // Re-importing the SAME id (same latest reading) is a no-op.
        let again = base.appendingHealthMetricSample(bodyWeight(id: "health-x", kg: 70))
        XCTAssertEqual(again.healthMetricSamples.count, 1, "same-id re-import must not duplicate")
        // A genuinely different reading (different id) DOES append.
        let twoReadings = base.appendingHealthMetricSample(bodyWeight(id: "health-y", kg: 71))
        XCTAssertEqual(twoReadings.healthMetricSamples.count, 2)
        XCTAssertEqual(twoReadings.healthMetricSamples.last?.id, "health-y")
    }

    func testNilIdAlwaysAppends() {
        // A nil-id sample has no dedup key, so each call appends (documents the
        // contract: dedup only fires for a non-nil, matching id).
        let once = AppData.emptyCurrent().appendingHealthMetricSample(bodyWeight(id: nil))
        let twice = once.appendingHealthMetricSample(bodyWeight(id: nil))
        XCTAssertEqual(twice.healthMetricSamples.count, 2)
    }

    // MARK: - Value semantics

    func testAppendingDoesNotMutateReceiver() {
        let base = AppData.emptyCurrent()
        _ = base.appendingHealthMetricSample(bodyWeight())
        XCTAssertTrue(base.healthMetricSamples.isEmpty, "receiver must be untouched (value semantics)")
    }
}
