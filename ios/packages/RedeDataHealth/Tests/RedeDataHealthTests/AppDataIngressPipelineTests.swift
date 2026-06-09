// AppDataIngressPipelineTests — iOS-3C.
//
// Covers per-source defaults + forbidden-source guard + backup
// failure behavior + read-only sources never returning repaired data.

import XCTest
@testable import RedeDataHealth
import RedeDomain
import Foundation

final class AppDataIngressPipelineTests: XCTestCase {
    func testBootSourceBuildsCleanViewAndTriggersOrchestrator() throws {
        let appData = try makeEmptyAppData()
        let backup = InMemoryAutoRepairBackupAdapter()
        let result = try processIncomingAppData(
            appData: appData,
            source: .boot,
            clock: anchorClock,
            options: AppDataIngressOptions(backupAdapter: backup)
        )
        XCTAssertEqual(result.source, .boot)
        XCTAssertNotNil(result.cleanView)
        XCTAssertTrue(result.triggeredOrchestrator)
        XCTAssertEqual(result.appDataHashBefore, result.appDataHashAfter,
            "empty AppData → nothing to repair, hash unchanged")
        XCTAssertTrue(result.operationId.hasPrefix("ingress_boot_"))
    }

    func testImportRestoreAllowsAutoRepair() throws {
        let appData = try makeAppDataWithStaleTodayStatus()
        let backup = InMemoryAutoRepairBackupAdapter()
        let result = try processIncomingAppData(
            appData: appData,
            source: .importRestore,
            clock: anchorClock,
            options: AppDataIngressOptions(backupAdapter: backup)
        )
        XCTAssertTrue(result.triggeredOrchestrator)
        // Stale-today repair applies → repairedAppData is non-nil.
        XCTAssertNotNil(result.repairedAppData)
        XCTAssertTrue(result.shouldPersist)
    }

    func testPreTrainingDecisionNeverReturnsRepairedData() throws {
        let appData = try makeAppDataWithStaleTodayStatus()
        let result = try processIncomingAppData(
            appData: appData,
            source: .preTrainingDecision,
            clock: anchorClock,
            options: AppDataIngressOptions()
        )
        XCTAssertFalse(result.triggeredOrchestrator,
            "preTrainingDecision must NOT run the orchestrator")
        XCTAssertNil(result.repairedAppData)
        XCTAssertFalse(result.shouldPersist)
        // CleanAppDataView is still built — that's the entire point.
        XCTAssertNotNil(result.cleanView)
    }

    func testCloudPullIsReadOnly() throws {
        let appData = try makeAppDataWithStaleTodayStatus()
        let result = try processIncomingAppData(
            appData: appData,
            source: .cloudPull,
            clock: anchorClock,
            options: AppDataIngressOptions()
        )
        XCTAssertFalse(result.triggeredOrchestrator)
        XCTAssertNil(result.repairedAppData)
        XCTAssertFalse(result.shouldPersist)
    }

    func testForbiddenSourceRejectsAutoRepairOverride() throws {
        let appData = try makeAppDataWithStaleTodayStatus()
        XCTAssertThrowsError(try processIncomingAppData(
            appData: appData,
            source: .cloudPull,
            clock: anchorClock,
            options: AppDataIngressOptions(allowAutoRepair: true)
        )) { error in
            guard case AppDataIngressError.forbiddenAutoRepair(let src) = error else {
                XCTFail("expected forbiddenAutoRepair, got \(error)")
                return
            }
            XCTAssertEqual(src, .cloudPull)
        }
    }

    func testForbiddenSourceAcceptsAutoRepairWithExplicitMutation() throws {
        // The legacy web schema contract: allowAutoRepair=true on a forbidden source
        // is allowed ONLY when the caller also explicitly sets
        // allowMutation=true.
        let appData = try makeAppDataWithStaleTodayStatus()
        XCTAssertNoThrow(try processIncomingAppData(
            appData: appData,
            source: .cloudPull,
            clock: anchorClock,
            options: AppDataIngressOptions(allowMutation: true, allowAutoRepair: true)
        ))
    }

    func testBackupFailurePreventsMutation() throws {
        let appData = try makeAppDataWithStaleTodayStatus()
        let result = try processIncomingAppData(
            appData: appData,
            source: .boot,
            clock: anchorClock,
            options: AppDataIngressOptions(backupAdapter: ThrowingAutoRepairBackupAdapter())
        )
        // Orchestrator was called but backup_failed → no mutation.
        XCTAssertTrue(result.triggeredOrchestrator)
        XCTAssertNil(result.repairedAppData)
        XCTAssertFalse(result.shouldPersist)
        XCTAssertTrue(result.warnings.contains(where: { $0.contains("backup_failed") }))
        // Passive status tone reflects backup-failed.
        XCTAssertEqual(result.passiveStatus.tone, .backupFailed)
    }

    func testIngressSourceDefaultsAreCanonical() {
        // Spot-check the matrix matches the design doc.
        let bootDefaults = ingressSourceDefaults(.boot)
        XCTAssertTrue(bootDefaults.allowMutation)
        XCTAssertTrue(bootDefaults.allowAutoRepair)
        XCTAssertTrue(bootDefaults.requireBackup)
        XCTAssertEqual(bootDefaults.repairTrigger, .boot)

        let exportDefaults = ingressSourceDefaults(.export)
        XCTAssertFalse(exportDefaults.allowMutation)
        XCTAssertFalse(exportDefaults.allowAutoRepair)
        XCTAssertEqual(exportDefaults.repairTrigger, .manual)

        let cloudRestoreDefaults = ingressSourceDefaults(.cloudRestore)
        XCTAssertTrue(cloudRestoreDefaults.allowMutation)
        XCTAssertEqual(cloudRestoreDefaults.repairTrigger, .cloudRestore)
    }

    // MARK: - Helpers

    private var anchorClock: RuntimeGuardClock {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let date = iso.date(from: "2026-05-28T00:00:00Z") ?? Date()
        return FixedRuntimeGuardClock(date)
    }

    private func makeEmptyAppData() throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }

    private func makeAppDataWithStaleTodayStatus() throws -> AppData {
        // Today status 10+ days old → staleTodayStatusV1 will fire.
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
            .init(key: "todayStatus", value: .object(OrderedJSONObject(entries: [
                .init(key: "date", value: .string("2025-05-15")),
            ]))),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }
}
