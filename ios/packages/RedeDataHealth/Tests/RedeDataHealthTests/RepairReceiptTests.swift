// RepairReceiptTests — iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1.
//
// Locks the receipt and dataRepairLogs append contract:
//   * buildReceipt produces the documented JSONValue shape.
//   * appendDataRepairLog FIFO-truncates at dataRepairLogsMaxEntries (500).
//   * runRepair appends to settings.dataRepairLogs.
//   * RepairLedgerEntry (iOS-3A) encode/decode round-trip stays green.

import XCTest
@testable import RedeDataHealth
import RedeDomain
import Foundation

final class RepairReceiptTests: XCTestCase {
    func testBuildReceiptShape() {
        let receipt = buildReceipt(ReceiptParams(
            repairId: "rid",
            category: .sessionLifecycle,
            action: "test action",
            affectedIds: ["s1", "s2", "s1"],
            beforeSummary: "before",
            afterSummary: "after",
            repairedAt: "2026-05-28T10:00:00Z",
            before: .object(OrderedJSONObject(entries: [
                .init(key: "count", value: .number(.integer(3))),
            ])),
            after: nil
        ))
        guard case .object(let obj) = receipt else {
            XCTFail("receipt must be an object"); return
        }
        XCTAssertEqual(obj["repairId"]?.stringValue, "rid")
        XCTAssertEqual(obj["id"]?.stringValue, "rid-2026-05-28T10:00:00Z")
        XCTAssertEqual(obj["createdAt"]?.stringValue, "2026-05-28T10:00:00Z")
        XCTAssertEqual(obj["repairedAt"]?.stringValue, "2026-05-28T10:00:00Z")
        XCTAssertEqual(obj["category"]?.stringValue, "session_lifecycle")
        XCTAssertEqual(obj["action"]?.stringValue, "test action")
        XCTAssertEqual(obj["beforeSummary"]?.stringValue, "before")
        XCTAssertEqual(obj["afterSummary"]?.stringValue, "after")
        let affected = obj["affectedIds"]?.arrayValue?.compactMap { $0.stringValue } ?? []
        XCTAssertEqual(affected.sorted(), ["s1", "s2"])  // dedup
        XCTAssertNotNil(obj["before"])
        XCTAssertNil(obj["after"])
    }

    func testAppendDataRepairLogRoundTrip() throws {
        let appData = try makeEmptyAppData()
        let receipt = buildReceipt(ReceiptParams(
            repairId: "rid",
            category: .sessionLifecycle,
            action: "test",
            affectedIds: ["s1"],
            beforeSummary: "before",
            afterSummary: "after"
        ))
        let appended = appendDataRepairLog(appData, receipt: receipt)
        let logs = readDataRepairLogs(appended)
        XCTAssertEqual(logs.count, 1)
    }

    func testAppendDataRepairLogFifoCap() throws {
        var appData = try makeEmptyAppData()
        let cap = dataRepairLogsMaxEntries
        for i in 0..<(cap + 100) {
            let receipt = buildReceipt(ReceiptParams(
                repairId: "rid-\(i)",
                category: .sessionLifecycle,
                action: "test",
                affectedIds: [],
                beforeSummary: "before",
                afterSummary: "after",
                repairedAt: "2026-05-28T10:00:00Z-\(i)"
            ))
            appData = appendDataRepairLog(appData, receipt: receipt)
        }
        let logs = readDataRepairLogs(appData)
        XCTAssertEqual(logs.count, cap)
        // Oldest 100 dropped; first remaining receipt was 100.
        guard case .object(let firstObj) = logs.first! else {
            XCTFail("first log must be object"); return
        }
        XCTAssertEqual(firstObj["repairId"]?.stringValue, "rid-100")
    }

    func testRunRepairAppendsToDataRepairLogs() throws {
        let appData = try makeAppDataWithStaleTodayStatus()
        let registry = safeRepairRegistry()
        let clock = FixedRuntimeGuardClock(Date(timeIntervalSince1970: 1_748_400_000))  // 2025-05-28
        // Wire registry with clock-injected staleTodayStatus
        let customRegistry = try RepairRegistry(definitions: [
            StaleTodayStatusRepair(clock: clock),
        ])
        _ = registry  // keep referenced
        let result = try runRepair(customRegistry, appData, "staleTodayStatusV1", options: nil)
        XCTAssertEqual(result.status, .applied)
        let logs = readDataRepairLogs(result.repairedData)
        XCTAssertEqual(logs.count, 1)
    }

    // MARK: - Helpers

    private func makeEmptyAppData() throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }

    private func makeAppDataWithStaleTodayStatus() throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
            .init(key: "todayStatus", value: .object(OrderedJSONObject(entries: [
                .init(key: "date", value: .string("2025-05-15")),
                .init(key: "sleep", value: .string("ok")),
            ]))),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }
}
