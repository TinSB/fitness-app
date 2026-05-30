// CanonicalSessionWriterTests — iOS-17A Native Per-Set Logging Mega V1 (iOS-17c).
//
// Locks the FIRST native canonical-AppData write path:
//   * first write seeds from base, no backup, atomic save
//   * a second write backs up BEFORE saving (rollback story)
//   * a present-but-unreadable document is NEVER overwritten (honest failure)
//   * the DataHealth gate can reject a candidate -> nothing written
//   * backup / save failures propagate honestly and do not fake success
//   * end-to-end round trip through a REAL JSONFileAppDataStore
//
// Uses an in-memory fake store for the control-flow cases and a temp-dir real
// store for the round trip. Deterministic; never touches the network.

import XCTest
@testable import IronPathPersistence
import IronPathDomain
import Foundation

final class CanonicalSessionWriterTests: XCTestCase {

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

    private func makeSession(id: String, weightKg: Double = 60, reps: Int = 5) -> TrainingSession {
        NativeCompletedSessionBuilder.completedSession(
            id: id,
            dateIso: "2026-05-27",
            finishedAtIso: "2026-05-27T10:00:00.000Z",
            performed: [NativePerformedExercise(
                exerciseId: "bench",
                name: "平板卧推",
                drafts: [ActualSetDraftFactory.capturedDraft(
                    priorCompletedCount: 0, weightKg: weightKg, reps: reps, rir: 2,
                    exerciseId: "bench", source: "local-ios-focus-capture",
                    completedAtIso: "2026-05-27T10:00:00.000Z"
                )]
            )]
        )
    }

    // MARK: - First write

    func testFirstWriteSeedsBaseWithoutBackup() throws {
        let store = FakeAppDataStore()   // no existing file
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.appendCompletedSession(makeSession(id: "s1")) { _ in true }

        XCTAssertTrue(result.createdNewStore)
        XCTAssertNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 0, "first write must not attempt a backup")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.history.count, 1)
        XCTAssertEqual(store.stored?.history.first?.id, "s1")
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    // MARK: - Second write backs up first

    func testSecondWriteBacksUpBeforeSaving() throws {
        let seed = AppData.emptyCurrent().appendingHistorySession(makeSession(id: "s1"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.appendCompletedSession(makeSession(id: "s2")) { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.history.count, 2)
        XCTAssertEqual(store.stored?.history.last?.id, "s2")
    }

    // MARK: - Refuse to overwrite an unreadable document

    func testUnreadableExistingDocumentIsNeverOverwritten() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.loadError = AppDataStoreError.decodeFailed("corrupt")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.appendCompletedSession(makeSession(id: "s1")) { _ in true }) { error in
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

        XCTAssertThrowsError(try writer.appendCompletedSession(makeSession(id: "s1")) { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
    }

    func testGateReceivesCandidateWithSessionAppended() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        var seenIds: [String]?
        _ = try writer.appendCompletedSession(makeSession(id: "s1")) { candidate in
            seenIds = candidate.history.compactMap { $0.id }
            return true
        }
        XCTAssertEqual(seenIds, ["s1"], "the gate must see the candidate with the session already appended")
    }

    // MARK: - Failure honesty

    func testBackupFailureStopsBeforeSave() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.backupError = AppDataStoreError.backupFailed("disk full")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.appendCompletedSession(makeSession(id: "s1")) { _ in true }) { error in
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

        XCTAssertThrowsError(try writer.appendCompletedSession(makeSession(id: "s1")) { _ in true }) { error in
            guard case CanonicalSessionWriteError.saveFailed = error else {
                return XCTFail("expected .saveFailed, got \(error)")
            }
        }
    }

    // MARK: - End-to-end through the REAL store

    func testRoundTripThroughRealStore() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-17a-writer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        // First write: creates the file, no backup.
        let r1 = try writer.appendCompletedSession(makeSession(id: "s1", weightKg: 62.5, reps: 8)) { _ in true }
        XCTAssertTrue(r1.createdNewStore)
        XCTAssertNil(r1.backupURL)

        // Second write: backs up the prior file, then appends.
        let r2 = try writer.appendCompletedSession(makeSession(id: "s2", weightKg: 70, reps: 6)) { _ in true }
        XCTAssertFalse(r2.createdNewStore)
        let backupURL = try XCTUnwrap(r2.backupURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path), "backup file must exist on disk")

        // Reload from disk: both sessions present, per-set kg/reps survive the round trip.
        let loaded = try store.load()
        XCTAssertEqual(loaded.history.count, 2)
        XCTAssertEqual(loaded.history.first?.id, "s1")
        XCTAssertEqual(loaded.history.last?.id, "s2")
        let firstSet = loaded.history.first?.exercises?.first?.sets?.first
        XCTAssertEqual(firstSet?.weight?.doubleValue ?? -1, 62.5, accuracy: 1e-9)
        XCTAssertEqual(firstSet?.reps?.intValue, 8)
        XCTAssertEqual(firstSet?.done, true)
    }
}
