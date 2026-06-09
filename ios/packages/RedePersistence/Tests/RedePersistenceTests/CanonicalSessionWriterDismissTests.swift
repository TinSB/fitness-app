// CanonicalSessionWriterDismissTests — CC-5 coach-action dismiss WRITE (Persistence gated half).
//
// Locks the coach-action capstone's ONLY source-truth write through the SAME single gated path
// (`performGatedMutation`) every append/edit uses (§8 rule 4: NOT a second write path):
//   * SINGLE SAVE — exactly one `store.save` per dismiss (never a second open for the second key).
//   * first write seeds from base, no backup; a second write backs up BEFORE saving (rollback).
//   * a present-but-UNREADABLE document is NEVER overwritten (honest failure).
//   * the injected DataHealth gate can reject a candidate → nothing written.
//   * backup / save failures propagate honestly and never fake success.
//   * TODAY INJECTION — the persisted `dismissedAt` is the `today` ARGUMENT (no clock).
//   * the gate sees the candidate with the dismiss landed in BOTH root + settings.
//   * end-to-end round trip through a REAL JSONFileAppDataStore (incl. idempotent same-day re-dismiss).
//
// Uses an in-memory fake store for the control-flow cases and a temp-dir real store for the round
// trip. Deterministic; never touches the network/clock.

import XCTest
@testable import RedePersistence
import RedeDomain
import Foundation

final class CanonicalSessionWriterDismissTests: XCTestCase {

    // MARK: - In-memory fake store

    private final class FakeAppDataStore: AppDataStore, @unchecked Sendable {
        var stored: AppData?
        private(set) var saveCount = 0
        private(set) var backupCount = 0
        var loadError: Error?
        var saveError: Error?
        var backupError: Error?

        init(stored: AppData? = nil) { self.stored = stored }

        var hasExistingFile: Bool { stored != nil }

        func load() throws -> AppData {
            if let loadError { throw loadError }
            guard let stored else { throw AppDataStoreError.fileMissing("none") }
            return stored
        }

        func save(_ appData: AppData) throws {
            if let saveError { throw saveError }
            stored = appData
            saveCount += 1
        }

        func backup() throws -> URL {
            if let backupError { throw backupError }
            backupCount += 1
            return URL(fileURLWithPath: "/tmp/ironpath-fake.backup")
        }
    }

    // MARK: - Helpers

    private func rootDismissed(_ appData: AppData?) -> [JSONValue] {
        appData?.root["dismissedCoachActions"]?.arrayValue ?? []
    }

    private func settingsDismissed(_ appData: AppData?) -> [JSONValue] {
        appData?.settings.dismissedCoachActions?.arrayValue ?? []
    }

    private func actionId(_ value: JSONValue) -> String? { value.objectValue?["actionId"]?.stringValue }
    private func dismissedAt(_ value: JSONValue) -> String? { value.objectValue?["dismissedAt"]?.stringValue }

    // MARK: - SINGLE SAVE + first write

    func testFirstDismissSeedsBaseSingleSaveNoBackup() throws {
        let store = FakeAppDataStore()   // no existing file
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.dismissCoachAction(actionId: "a1", today: "2026-06-04") { _ in true }

        XCTAssertTrue(result.createdNewStore)
        XCTAssertNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 0, "first write must not attempt a backup")
        // SINGLE SAVE red-line: the double-write (root + settings) is ONE gated save, never two.
        XCTAssertEqual(store.saveCount, 1, "a dismiss must persist with EXACTLY one store.save")
        // The intent landed in BOTH halves.
        XCTAssertEqual(rootDismissed(store.stored).count, 1)
        XCTAssertEqual(actionId(try XCTUnwrap(rootDismissed(store.stored).first)), "a1")
        XCTAssertEqual(settingsDismissed(store.stored).count, 1)
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    // MARK: - TODAY INJECTION (persisted dismissedAt is the argument, not a clock)

    func testPersistedDismissedAtIsInjectedTodayVerbatim() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        _ = try writer.dismissCoachAction(actionId: "a1", today: "1999-12-31") { _ in true }
        XCTAssertEqual(dismissedAt(try XCTUnwrap(rootDismissed(store.stored).first)), "1999-12-31")
    }

    // MARK: - Second write backs up before saving

    func testSecondDismissBacksUpBeforeSaving() throws {
        let seed = AppData.emptyCurrent().withDismissedCoachAction(actionId: "a0", today: "2026-06-04")
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.dismissCoachAction(actionId: "a1", today: "2026-06-04") { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1)
        // a0 (different action) preserved + a1 appended.
        XCTAssertEqual(rootDismissed(store.stored).count, 2)
    }

    // MARK: - Refuse to overwrite an unreadable document

    func testUnreadableExistingDocumentIsNeverOverwritten() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.loadError = AppDataStoreError.decodeFailed("corrupt")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.dismissCoachAction(actionId: "a1", today: "2026-06-04") { _ in true }) { error in
            guard case CanonicalSessionWriteError.existingDocumentUnreadable = error else {
                return XCTFail("expected .existingDocumentUnreadable, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "must not overwrite unparseable data")
        XCTAssertEqual(store.backupCount, 0)
    }

    // MARK: - Gate rejection writes nothing

    func testValidationRejectionWritesNothing() {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.dismissCoachAction(actionId: "a1", today: "2026-06-04") { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
    }

    // MARK: - The gate sees the candidate with the dismiss landed in BOTH halves

    func testGateReceivesCandidateWithDismissInRootAndSettings() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        var seenRoot: [String]?
        var seenSettings: [String]?
        _ = try writer.dismissCoachAction(actionId: "a1", today: "2026-06-04") { candidate in
            seenRoot = self.rootDismissed(candidate).compactMap { self.actionId($0) }
            seenSettings = self.settingsDismissed(candidate).compactMap { self.actionId($0) }
            return true
        }
        XCTAssertEqual(seenRoot, ["a1"], "the gate must see the candidate with the dismiss in root")
        XCTAssertEqual(seenSettings, ["a1"], "the gate must see the same dismiss mirrored into settings")
    }

    // MARK: - Failure honesty

    func testBackupFailureStopsBeforeSave() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.backupError = AppDataStoreError.backupFailed("disk full")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.dismissCoachAction(actionId: "a1", today: "2026-06-04") { _ in true }) { error in
            guard case CanonicalSessionWriteError.backupFailed = error else {
                return XCTFail("expected .backupFailed, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "a failed backup must abort before any overwrite")
    }

    func testSaveFailurePropagatesHonestly() {
        let store = FakeAppDataStore()   // first write, no backup
        store.saveError = AppDataStoreError.writeFailed("io error")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.dismissCoachAction(actionId: "a1", today: "2026-06-04") { _ in true }) { error in
            guard case CanonicalSessionWriteError.saveFailed = error else {
                return XCTFail("expected .saveFailed, got \(error)")
            }
        }
    }

    // MARK: - End-to-end through the REAL store (incl. idempotent same-day re-dismiss)

    func testRoundTripThroughRealStoreAndIdempotentSameDayReDismiss() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-cc5-dismiss-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        // First dismiss: creates the file, no backup; persists to root + settings.
        let r1 = try writer.dismissCoachAction(actionId: "a1", today: "2026-06-04") { _ in true }
        XCTAssertTrue(r1.createdNewStore)
        XCTAssertNil(r1.backupURL)

        let afterFirst = try store.load()
        XCTAssertEqual(rootDismissed(afterFirst).count, 1)
        XCTAssertEqual(settingsDismissed(afterFirst).count, 1)

        // Second dismiss of the SAME action on the SAME day: dedups (replace, not append) — still
        // exactly one entry — and backs up before overwrite.
        let r2 = try writer.dismissCoachAction(actionId: "a1", today: "2026-06-04") { _ in true }
        XCTAssertFalse(r2.createdNewStore)
        let backupURL = try XCTUnwrap(r2.backupURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path), "backup must exist on disk")

        let afterSecond = try store.load()
        XCTAssertEqual(rootDismissed(afterSecond).count, 1, "same-day re-dismiss is idempotent (dedup)")
        XCTAssertEqual(settingsDismissed(afterSecond).count, 1)
        XCTAssertEqual(actionId(try XCTUnwrap(rootDismissed(afterSecond).first)), "a1")

        // A DIFFERENT action on the same day appends → two entries.
        _ = try writer.dismissCoachAction(actionId: "a2", today: "2026-06-04") { _ in true }
        let afterThird = try store.load()
        XCTAssertEqual(rootDismissed(afterThird).count, 2)
        XCTAssertEqual(settingsDismissed(afterThird).count, 2)
    }
}
