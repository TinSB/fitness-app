// JSONFileAutoRepairBackupAdapterTests — iOS-3C.
//
// Covers:
//   * snapshot writes a JSON file with the documented naming.
//   * list() round-trips the on-disk records.
//   * missing directory is auto-created.
//   * unwritable directory → adapter throws → orchestrator catches
//     and leaves AppData unchanged.

import XCTest
@testable import IronPathDataHealth
import IronPathDomain
import Foundation

final class JSONFileAutoRepairBackupAdapterTests: XCTestCase {
    private var tempDir: URL!

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-3c-backup-\(UUID().uuidString)", isDirectory: true)
        // NOT pre-created — adapter should create it on first snapshot.
    }

    override func tearDownWithError() throws {
        if let dir = tempDir, FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.removeItem(at: dir)
        }
    }

    func testSnapshotWritesFileAndCreatesDirectory() throws {
        let adapter = JSONFileAutoRepairBackupAdapter(directory: tempDir)
        let appData = try makeAppData()
        let request = AutoRepairBackupRequest(
            appData: appData,
            triggeredBy: .boot,
            appDataHashBefore: "appdata_test_abcd1234",
            repairIdScope: ["sessionLifecycleResidueV1"]
        )
        let record = try adapter.snapshot(request)
        XCTAssertEqual(record.storage, .jsonFile)
        XCTAssertTrue(record.id.hasPrefix("ironpath_auto_repair_backup_"))
        XCTAssertTrue(record.id.hasSuffix("abcd1234"))
        XCTAssertGreaterThan(record.payloadSize, 0)
        // File present on disk under the directory.
        let fileURL = tempDir.appendingPathComponent("\(record.id).json", isDirectory: false)
        XCTAssertTrue(FileManager.default.fileExists(atPath: fileURL.path))
    }

    func testListRoundTripsRecords() throws {
        let adapter = JSONFileAutoRepairBackupAdapter(directory: tempDir)
        let appData = try makeAppData()
        _ = try adapter.snapshot(AutoRepairBackupRequest(
            appData: appData,
            triggeredBy: .boot,
            appDataHashBefore: "appdata_hash_first",
            repairIdScope: []
        ))
        _ = try adapter.snapshot(AutoRepairBackupRequest(
            appData: appData,
            triggeredBy: .importing,
            appDataHashBefore: "appdata_hash_second",
            repairIdScope: []
        ))
        let records = adapter.list()
        XCTAssertEqual(records.count, 2)
        XCTAssertTrue(records.allSatisfy { $0.storage == .jsonFile })
    }

    func testAdapterFailureBlocksOrchestratorMutation() throws {
        // Adapter rooted at an existing FILE — createDirectory fails.
        let blockerURL = tempDir
            .deletingLastPathComponent()
            .appendingPathComponent("ironpath-3c-blocker-\(UUID().uuidString)")
        try Data("blocker".utf8).write(to: blockerURL)
        defer { try? FileManager.default.removeItem(at: blockerURL) }
        let adapter = JSONFileAutoRepairBackupAdapter(directory: blockerURL)
        // Use stale-today-status AppData so the orchestrator actually
        // detects something and reaches the backup-attempt branch.
        let appData = try makeStaleTodayAppData()
        // Adapter throws.
        XCTAssertThrowsError(try adapter.snapshot(AutoRepairBackupRequest(
            appData: appData,
            triggeredBy: .boot,
            appDataHashBefore: "appdata_unreachable",
            repairIdScope: []
        )))
        // When wired into the orchestrator, the throw maps to the
        // backup_failed branch — AppData remains byte-equal (locked
        // by iOS-3B safety §12.1(b)).
        let canonicalBefore = try appData.canonicalJSONData()
        let pipelineResult = try processIncomingAppData(
            appData: appData,
            source: .boot,
            clock: FixedRuntimeGuardClock(anchorDate()),
            options: AppDataIngressOptions(backupAdapter: adapter)
        )
        XCTAssertNil(pipelineResult.repairedAppData)
        XCTAssertTrue(pipelineResult.warnings.contains(where: { $0.contains("backup_failed") }))
        // (Orchestrator's appDataHashAfter == appDataHashBefore.)
        XCTAssertEqual(pipelineResult.appDataHashBefore, pipelineResult.appDataHashAfter)
        // Plus the canonical view: orchestrator returns AppData byte-equal.
        let canonicalAfter = try (pipelineResult.orchestratorResult?.appData ?? appData).canonicalJSONData()
        XCTAssertEqual(canonicalAfter, canonicalBefore)
    }

    private func makeAppData() throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }

    private func makeStaleTodayAppData() throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
            .init(key: "todayStatus", value: .object(OrderedJSONObject(entries: [
                .init(key: "date", value: .string("2025-05-15")),
            ]))),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }

    private func anchorDate() -> Date {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        return iso.date(from: "2026-05-28T00:00:00Z") ?? Date()
    }
}
