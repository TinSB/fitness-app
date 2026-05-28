// RepairLedgerTests — iOS-3A Data Health Runtime Foundation V1.
//
// Locks the ledger append/idempotency/cap/summary contract:
//   * buildLedgerEntry — ledgerId composition rule
//   * appendLedgerEntry → readLedger round trip
//   * writeLedger truncates to ledgerMaxEntries FIFO
//   * isIdempotentMatch returns true within window, false outside
//   * summarizeLedger counts by status within window
//   * DataHealthRepairLedgerEntry.encoded() → decoded round trip
//     preserves all fields

import XCTest
@testable import IronPathDataHealth
import IronPathDomain
import Foundation

final class RepairLedgerTests: XCTestCase {
    // MARK: - buildLedgerEntry

    func testBuildLedgerEntryComposesLedgerIdCorrectly() {
        let params = BuildLedgerEntryParams(
            repairId: "fix-stale-today",
            idempotencyKey: "abcdef1234567890",
            appliedAt: "2026-05-27T12:00:00Z",
            triggeredBy: .boot,
            status: .applied,
            occurrences: 1,
            affectedIds: ["s1"]
        )
        let entry = buildLedgerEntry(params)
        XCTAssertEqual(entry.ledgerId, "fix-stale-today-2026-05-27T12:00:00Z-abcdef12")
        XCTAssertEqual(entry.repairId, "fix-stale-today")
        XCTAssertEqual(entry.idempotencyKey, "abcdef1234567890")
    }

    // MARK: - Encode / decode round trip

    func testLedgerEntryEncodeDecodeRoundTrip() {
        let original = DataHealthRepairLedgerEntry(
            ledgerId: "rid-2026-05-27T12:00:00Z-abcdef12",
            repairId: "rid",
            idempotencyKey: "abcdef1234567890",
            appliedAt: "2026-05-27T12:00:00Z",
            triggeredBy: .postSession,
            status: .applied,
            occurrences: 3,
            affectedIds: ["s1", "s2", "s3"],
            appDataHashBefore: "fnv1a-before",
            appDataHashAfter: "fnv1a-after",
            backupId: "backup-001",
            receiptId: "receipt-1",
            warnings: ["legacy advice cleared"]
        )
        let encoded = original.encoded()
        guard let decoded = DataHealthRepairLedgerEntry(decoding: encoded) else {
            XCTFail("decode failed")
            return
        }
        XCTAssertEqual(decoded, original)
    }

    func testLedgerEntryDecodeRejectsMissingRequiredFields() {
        let bad = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "ledgerId", value: .string("x")),
        ]))
        XCTAssertNil(DataHealthRepairLedgerEntry(decoding: bad))
    }

    // MARK: - Append / read round trip

    func testAppendLedgerEntryRoundTripsThroughReadLedger() throws {
        let appData = try makeEmptyAppData()
        let entry = buildLedgerEntry(BuildLedgerEntryParams(
            repairId: "rid",
            idempotencyKey: "k1",
            appliedAt: "2026-05-27T12:00:00Z",
            triggeredBy: .boot,
            status: .applied,
            occurrences: 1,
            affectedIds: ["s1"]
        ))
        let appended = appendLedgerEntry(appData, entry)
        let read = readLedger(appended)
        XCTAssertEqual(read.count, 1)
        XCTAssertEqual(read.first, entry)
    }

    func testWriteLedgerTruncatesFifoAtLedgerMaxEntries() throws {
        let appData = try makeEmptyAppData()
        var entries: [DataHealthRepairLedgerEntry] = []
        for i in 0..<(DataHealthConstants.ledgerMaxEntries + 50) {
            entries.append(DataHealthRepairLedgerEntry(
                ledgerId: "rid-\(i)",
                repairId: "rid",
                idempotencyKey: "k-\(i)",
                appliedAt: "2026-05-27T12:00:00Z",
                triggeredBy: .boot,
                status: .applied,
                occurrences: 1,
                affectedIds: []
            ))
        }
        let written = writeLedger(appData, entries)
        let read = readLedger(written)
        XCTAssertEqual(read.count, DataHealthConstants.ledgerMaxEntries)
        // FIFO: oldest 50 dropped. First in `read` is entries[50].
        XCTAssertEqual(read.first?.ledgerId, "rid-50")
        XCTAssertEqual(read.last?.ledgerId, "rid-\(DataHealthConstants.ledgerMaxEntries + 49)")
    }

    // MARK: - Idempotency

    func testIsIdempotentMatchTrueWithinWindow() {
        let now = Date(timeIntervalSince1970: 1_716_854_400)  // ~2024-05-27
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let twoHoursAgo = iso.string(from: now.addingTimeInterval(-2 * 3600))
        let ledger: [DataHealthRepairLedgerEntry] = [
            DataHealthRepairLedgerEntry(
                ledgerId: "rid-a", repairId: "rid", idempotencyKey: "k-1",
                appliedAt: twoHoursAgo, triggeredBy: .boot, status: .applied,
                occurrences: 1, affectedIds: []
            ),
        ]
        XCTAssertTrue(
            isIdempotentMatch(ledger, repairId: "rid", idempotencyKey: "k-1", windowHours: 24, now: now)
        )
    }

    func testIsIdempotentMatchFalseOutsideWindow() {
        let now = Date(timeIntervalSince1970: 1_716_854_400)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let twoDaysAgo = iso.string(from: now.addingTimeInterval(-2 * 24 * 3600))
        let ledger: [DataHealthRepairLedgerEntry] = [
            DataHealthRepairLedgerEntry(
                ledgerId: "rid-a", repairId: "rid", idempotencyKey: "k-1",
                appliedAt: twoDaysAgo, triggeredBy: .boot, status: .applied,
                occurrences: 1, affectedIds: []
            ),
        ]
        XCTAssertFalse(
            isIdempotentMatch(ledger, repairId: "rid", idempotencyKey: "k-1", windowHours: 24, now: now)
        )
    }

    func testIsIdempotentMatchFalseForFailedStatus() {
        let now = Date(timeIntervalSince1970: 1_716_854_400)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let recent = iso.string(from: now.addingTimeInterval(-2 * 3600))
        let ledger: [DataHealthRepairLedgerEntry] = [
            DataHealthRepairLedgerEntry(
                ledgerId: "rid-a", repairId: "rid", idempotencyKey: "k-1",
                appliedAt: recent, triggeredBy: .boot, status: .failed,
                occurrences: 1, affectedIds: []
            ),
        ]
        XCTAssertFalse(
            isIdempotentMatch(ledger, repairId: "rid", idempotencyKey: "k-1", now: now)
        )
    }

    // MARK: - Summary

    func testSummarizeLedgerCountsByStatusWithinWindow() {
        let now = Date(timeIntervalSince1970: 1_716_854_400)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let recent = iso.string(from: now.addingTimeInterval(-2 * 3600))
        let stale = iso.string(from: now.addingTimeInterval(-2 * 24 * 3600))
        let ledger: [DataHealthRepairLedgerEntry] = [
            entry(at: recent, status: .applied),
            entry(at: recent, status: .noOp),
            entry(at: recent, status: .failed),
            entry(at: recent, status: .backupFailed),
            entry(at: recent, status: .skipped),
            entry(at: stale, status: .applied),  // outside window — excluded
        ]
        let summary = summarizeLedger(ledger, withinHours: 24, now: now)
        XCTAssertEqual(summary.applied, 1)
        XCTAssertEqual(summary.noOp, 1)
        XCTAssertEqual(summary.failed, 2)  // failed + backupFailed
        XCTAssertEqual(summary.auditOnly, 1)
        XCTAssertEqual(summary.lastRunAt, recent)
    }

    // MARK: - Helpers

    private func entry(at appliedAt: String, status: RepairApplyStatus) -> DataHealthRepairLedgerEntry {
        DataHealthRepairLedgerEntry(
            ledgerId: "rid-\(appliedAt)-\(status.rawValue)",
            repairId: "rid",
            idempotencyKey: "k-\(status.rawValue)",
            appliedAt: appliedAt,
            triggeredBy: .boot,
            status: status,
            occurrences: 1,
            affectedIds: []
        )
    }

    private func makeEmptyAppData() throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }
}
