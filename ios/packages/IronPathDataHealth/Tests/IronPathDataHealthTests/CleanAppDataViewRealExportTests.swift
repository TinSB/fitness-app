// CleanAppDataViewRealExportTests — iOS-3A Data Health Runtime Foundation V1.
//
// Loads the canonical redacted real export
// `ios/ParityFixtures/data-health/ironpath-2026-05-27-redacted.json`
// via `#filePath`-rooted resolution, builds a CleanAppDataView, and
// asserts:
//
//   * buildCleanAppDataView accepts the full real export.
//   * view.raw.canonicalJSONData() byte-equals the canonical re-emit
//     of the original raw JSON — raw AppData is NEVER mutated.
//   * view.cleanedHistory.count == view.raw.history.count (projection
//     is element-wise; no loss).
//   * view.diagnostics fields are reachable and do not panic on the
//     real export.

import XCTest
@testable import IronPathDataHealth
import IronPathDomain
import Foundation

final class CleanAppDataViewRealExportTests: XCTestCase {
    /// Walks the source-file path back to the repo root, then resolves
    /// the canonical redacted-export fixture. Deterministic at compile
    /// time because `#filePath` is baked in by swiftc.
    private func realExportURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathDataHealthTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathDataHealth/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
            .appendingPathComponent("ios/ParityFixtures/data-health/ironpath-2026-05-27-redacted.json")
    }

    func testRealExportFixtureExists() {
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: realExportURL().path),
            "redacted real export must exist at the canonical path"
        )
    }

    func testCleanAppDataViewBuildsFromRealExport() throws {
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        let view = buildCleanAppDataView(appData)
        XCTAssertEqual(view.raw, appData)
        XCTAssertGreaterThan(view.cleanedHistory.count, 0)
        // cleanedHistory is element-wise; never drops entries.
        XCTAssertEqual(view.cleanedHistory.count, appData.history.count)
    }

    func testCleanAppDataViewDoesNotMutateRawCanonicalBytes() throws {
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        let canonicalBefore = try appData.canonicalJSONData()
        _ = buildCleanAppDataView(appData)
        let canonicalAfter = try appData.canonicalJSONData()
        XCTAssertEqual(canonicalBefore, canonicalAfter, "raw AppData canonical bytes must not change after building the clean view")
    }

    func testCleanAppDataViewDiagnosticsAreReachable() throws {
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        let view = buildCleanAppDataView(
            appData,
            clock: FixedRuntimeGuardClock(Date(timeIntervalSince1970: 1_716_854_400))
        )
        // The redacted export may or may not have dirty data — we
        // assert the diagnostics struct is reachable, that its
        // optional fields are well-formed Swift values, and that the
        // `hasDirtyData` accessor returns a Bool consistent with the
        // diagnostics buckets.
        let d = view.diagnostics
        let expectedDirty = !d.lifecycleResidueSessionIds.isEmpty
            || !d.legacyAdviceSessionIds.isEmpty
            || !d.invalidDurationSessionIds.isEmpty
            || !d.cappedIssueScoreKeys.isEmpty
            || d.staleTodayStatus
            || d.staleHealthData
            || !d.filteredPerformanceDropIds.isEmpty
        XCTAssertEqual(view.hasDirtyData, expectedDirty)
    }

    func testCleanAppDataViewActiveSessionRoundTripsWhenPresent() throws {
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        let view = buildCleanAppDataView(appData)
        if appData.activeSession != nil {
            XCTAssertNotNil(view.cleanedActiveSession)
        } else {
            XCTAssertNil(view.cleanedActiveSession)
        }
    }
}
