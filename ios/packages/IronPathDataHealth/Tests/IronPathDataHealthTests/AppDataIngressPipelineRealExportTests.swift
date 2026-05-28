// AppDataIngressPipelineRealExportTests — iOS-3C real-export integration.
//
// Loads the redacted real export via #filePath walk-up, runs the
// full ingress pipeline at .boot source under a fixed anchor clock,
// and asserts:
//   * Pipeline returns successfully.
//   * Detected repair IDs ⊆ {9 V1 IDs} (5 iOS-3B + 4 iOS-3C).
//   * Second pipeline run on the previous result is idempotent.
//   * No cloud-eligibility surface — iOS-3C never exposes it.

import XCTest
@testable import IronPathDataHealth
import IronPathDomain
import Foundation

final class AppDataIngressPipelineRealExportTests: XCTestCase {
    private func realExportURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathDataHealthTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathDataHealth/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
            .appendingPathComponent("tests/fixtures/data-health/ironpath-2026-05-27-redacted.json")
    }

    private func loadRealExport() throws -> AppData {
        let data = try Data(contentsOf: realExportURL())
        return try AppData(decoding: data)
    }

    private var anchorClock: RuntimeGuardClock {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let date = iso.date(from: "2026-05-28T00:00:00Z") ?? Date()
        return FixedRuntimeGuardClock(date)
    }

    func testRealExportFlowsThroughBootIngressWithoutThrowing() throws {
        let appData = try loadRealExport()
        let backup = InMemoryAutoRepairBackupAdapter()
        let result = try processIncomingAppData(
            appData: appData,
            source: .boot,
            clock: anchorClock,
            options: AppDataIngressOptions(backupAdapter: backup)
        )
        XCTAssertNotNil(result.cleanView)
        XCTAssertEqual(result.cleanView.raw, appData)
        XCTAssertTrue(result.triggeredOrchestrator)
    }

    func testDetectedRepairIdsAreSubsetOfAllNineV1Ids() throws {
        let appData = try loadRealExport()
        let backup = InMemoryAutoRepairBackupAdapter()
        let result = try processIncomingAppData(
            appData: appData,
            source: .boot,
            clock: anchorClock,
            options: AppDataIngressOptions(backupAdapter: backup)
        )
        let allowed: Set<String> = [
            // iOS-3B safe IDs:
            "sessionLifecycleResidueV1",
            "impossibleDurationV1",
            "staleTodayStatusV1",
            "staleHealthReadinessGuardV1",
            "legacyFinalAdviceIsolationGuardV1",
            // iOS-3C added IDs:
            "screeningIssueScoreRuntimeGuardV1",
            "screeningIssueScoreRepairV1",
            "setIndexRenumberV1",
            "replacementEquivalenceAuditV1",
        ]
        let actualIds = Set((result.orchestratorResult?.results ?? []).map { $0.repairId })
            .union(Set((result.orchestratorResult?.auditFindings ?? []).map { $0.repairId }))
        XCTAssertTrue(actualIds.isSubset(of: allowed),
            "unexpected repair IDs surfaced: \(actualIds.subtracting(allowed))")
    }

    func testSecondPipelineRunIsIdempotent() throws {
        let appData = try loadRealExport()
        let backup = InMemoryAutoRepairBackupAdapter()
        let first = try processIncomingAppData(
            appData: appData,
            source: .boot,
            clock: anchorClock,
            options: AppDataIngressOptions(backupAdapter: backup)
        )
        let workingAppData = first.repairedAppData ?? appData
        let second = try processIncomingAppData(
            appData: workingAppData,
            source: .boot,
            clock: anchorClock,
            options: AppDataIngressOptions(backupAdapter: backup)
        )
        let secondApplied = (second.orchestratorResult?.results ?? [])
            .filter { $0.status == .applied }
            .count
        XCTAssertEqual(secondApplied, 0,
            "second pipeline run must produce no new applied repairs")
    }

    func testReadOnlySourceProducesNoMutationOnRealExport() throws {
        let appData = try loadRealExport()
        let result = try processIncomingAppData(
            appData: appData,
            source: .preTrainingDecision,
            clock: anchorClock,
            options: AppDataIngressOptions()
        )
        XCTAssertNil(result.repairedAppData)
        XCTAssertFalse(result.triggeredOrchestrator)
        // raw appData reachable through cleanView.
        XCTAssertEqual(result.cleanView.raw, appData)
    }
}
