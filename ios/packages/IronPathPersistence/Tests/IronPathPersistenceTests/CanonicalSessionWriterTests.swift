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

    // MARK: - HK-1: body-weight HealthMetricSample append (SAME gated path)

    private func makeBodyWeightSample(id: String, kg: Double = 70) -> HealthMetricSample {
        HealthMetricSample(
            id: id,
            source: "apple_health_export",
            metricType: "body_weight",
            startDate: "2026-05-27T06:30:00.000Z",
            value: .double(kg),
            unit: "kg",
            importedAt: "2026-05-27T07:00:00.000Z",
            dataFlag: "normal"
        )
    }

    func testHealthSampleFirstWriteSeedsBaseWithoutBackup() throws {
        let store = FakeAppDataStore()   // no existing file
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.appendHealthMetricSample(makeBodyWeightSample(id: "h1")) { _ in true }

        XCTAssertTrue(result.createdNewStore)
        XCTAssertNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 0, "first write must not attempt a backup")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.healthMetricSamples.count, 1)
        XCTAssertEqual(store.stored?.healthMetricSamples.first?.metricType, "body_weight")
        XCTAssertEqual(store.stored?.healthMetricSamples.first?.unit, "kg")
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    func testHealthSampleSecondWriteBacksUpBeforeSaving() throws {
        let seed = AppData.emptyCurrent().appendingHealthMetricSample(makeBodyWeightSample(id: "h1"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.appendHealthMetricSample(makeBodyWeightSample(id: "h2", kg: 71)) { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.healthMetricSamples.count, 2)
        XCTAssertEqual(store.stored?.healthMetricSamples.last?.id, "h2")
    }

    func testHealthSampleValidationRejectionWritesNothing() {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.appendHealthMetricSample(makeBodyWeightSample(id: "h1")) { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
    }

    func testHealthSampleGateReceivesCandidateWithSampleAppended() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        var seenIds: [String]?
        _ = try writer.appendHealthMetricSample(makeBodyWeightSample(id: "h1")) { candidate in
            seenIds = candidate.healthMetricSamples.compactMap { $0.id }
            return true
        }
        XCTAssertEqual(seenIds, ["h1"], "the gate must see the candidate with the sample already appended")
    }

    func testHealthSampleUnreadableExistingDocumentIsNeverOverwritten() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.loadError = AppDataStoreError.decodeFailed("corrupt")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.appendHealthMetricSample(makeBodyWeightSample(id: "h1")) { _ in true }) { error in
            guard case CanonicalSessionWriteError.existingDocumentUnreadable = error else {
                return XCTFail("expected .existingDocumentUnreadable, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "must not overwrite unparseable data")
    }

    func testHealthSampleReimportIsIdempotentAtDocumentLevel() throws {
        // First import of a reading lands one sample.
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        _ = try writer.appendHealthMetricSample(makeBodyWeightSample(id: "h1", kg: 70)) { _ in true }
        XCTAssertEqual(store.stored?.healthMetricSamples.count, 1)
        // Re-importing the SAME reading (same content id) dedups in the candidate
        // builder, so the document still holds exactly one sample (no duplicate).
        _ = try writer.appendHealthMetricSample(makeBodyWeightSample(id: "h1", kg: 70)) { _ in true }
        XCTAssertEqual(store.stored?.healthMetricSamples.count, 1, "same-reading re-import must not duplicate")
    }

    func testHealthSampleRoundTripThroughRealStore() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-hk1-writer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        _ = try writer.appendHealthMetricSample(makeBodyWeightSample(id: "h1", kg: 72.5)) { _ in true }
        let r2 = try writer.appendHealthMetricSample(makeBodyWeightSample(id: "h2", kg: 71)) { _ in true }
        XCTAssertNotNil(r2.backupURL)

        // Reload from disk: both samples present, kg survives the round trip.
        let loaded = try store.load()
        XCTAssertEqual(loaded.healthMetricSamples.count, 2)
        XCTAssertEqual(loaded.healthMetricSamples.first?.value?.doubleValue ?? -1, 72.5, accuracy: 1e-9)
        XCTAssertEqual(loaded.healthMetricSamples.first?.unit, "kg")
        XCTAssertEqual(loaded.healthMetricSamples.last?.id, "h2")
    }

    // MARK: - HK-2: imported-workout append (SAME gated path, derived/non-canonical)

    private func makeWorkoutSample(id: String, type: String = "TraditionalStrengthTraining") -> ImportedWorkoutSample {
        ImportedWorkoutSample(
            id: id,
            source: "healthkit_import",
            workoutType: type,
            startDate: "2026-05-27T06:30:00.000Z",
            endDate: "2026-05-27T07:15:00.000Z",
            durationMin: .double(45),
            activeEnergyKcal: .double(320),
            importedAt: "2026-05-27T08:00:00.000Z",
            dataFlag: "normal"
        )
    }

    func testWorkoutFirstWriteSeedsBaseWithoutBackup() throws {
        let store = FakeAppDataStore()   // no existing file
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.appendImportedWorkoutSample(makeWorkoutSample(id: "w1")) { _ in true }

        XCTAssertTrue(result.createdNewStore)
        XCTAssertNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 0, "first write must not attempt a backup")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.importedWorkoutSamples.count, 1)
        XCTAssertEqual(store.stored?.importedWorkoutSamples.first?.workoutType, "TraditionalStrengthTraining")
        XCTAssertEqual(store.stored?.importedWorkoutSamples.first?.source, "healthkit_import")
        // Red line: a workout import NEVER lands in canonical history.
        XCTAssertEqual(store.stored?.history.count, 0)
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    func testWorkoutSecondWriteBacksUpBeforeSaving() throws {
        let seed = AppData.emptyCurrent().appendingImportedWorkoutSample(makeWorkoutSample(id: "w1"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.appendImportedWorkoutSample(makeWorkoutSample(id: "w2", type: "Running")) { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.importedWorkoutSamples.count, 2)
        XCTAssertEqual(store.stored?.importedWorkoutSamples.last?.id, "w2")
    }

    func testWorkoutValidationRejectionWritesNothing() {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.appendImportedWorkoutSample(makeWorkoutSample(id: "w1")) { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
    }

    func testWorkoutGateReceivesCandidateWithSampleAppended() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        var seenIds: [String]?
        _ = try writer.appendImportedWorkoutSample(makeWorkoutSample(id: "w1")) { candidate in
            seenIds = candidate.importedWorkoutSamples.compactMap { $0.id }
            return true
        }
        XCTAssertEqual(seenIds, ["w1"], "the gate must see the candidate with the workout already appended")
    }

    func testWorkoutUnreadableExistingDocumentIsNeverOverwritten() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.loadError = AppDataStoreError.decodeFailed("corrupt")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.appendImportedWorkoutSample(makeWorkoutSample(id: "w1")) { _ in true }) { error in
            guard case CanonicalSessionWriteError.existingDocumentUnreadable = error else {
                return XCTFail("expected .existingDocumentUnreadable, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "must not overwrite unparseable data")
    }

    func testWorkoutReimportIsIdempotentAtDocumentLevel() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        _ = try writer.appendImportedWorkoutSample(makeWorkoutSample(id: "w1")) { _ in true }
        XCTAssertEqual(store.stored?.importedWorkoutSamples.count, 1)
        // Re-importing the SAME workout (same content id) dedups in the candidate
        // builder, so the document still holds exactly one workout (no duplicate).
        _ = try writer.appendImportedWorkoutSample(makeWorkoutSample(id: "w1")) { _ in true }
        XCTAssertEqual(store.stored?.importedWorkoutSamples.count, 1, "same-workout re-import must not duplicate")
    }

    func testWorkoutRoundTripThroughRealStore() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-hk2-writer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        _ = try writer.appendImportedWorkoutSample(makeWorkoutSample(id: "w1")) { _ in true }
        let r2 = try writer.appendImportedWorkoutSample(makeWorkoutSample(id: "w2", type: "Running")) { _ in true }
        XCTAssertNotNil(r2.backupURL)

        // Reload from disk: both workouts present, derived bag only (history empty).
        let loaded = try store.load()
        XCTAssertEqual(loaded.importedWorkoutSamples.count, 2)
        XCTAssertEqual(loaded.importedWorkoutSamples.first?.durationMin?.doubleValue ?? -1, 45, accuracy: 1e-9)
        XCTAssertEqual(loaded.importedWorkoutSamples.last?.id, "w2")
        XCTAssertEqual(loaded.history.count, 0, "imported workouts must never enter canonical history")
    }

    func testWorkoutBatchAppendIsOneGatedWriteAndDedups() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        // Three samples, two of which share an id (a duplicate within the batch).
        let batch = [
            makeWorkoutSample(id: "w1", type: "Running"),
            makeWorkoutSample(id: "w2", type: "Cycling"),
            makeWorkoutSample(id: "w1", type: "Running"),   // duplicate of w1
        ]
        let result = try writer.appendImportedWorkoutSamples(batch) { _ in true }
        XCTAssertTrue(result.createdNewStore)
        XCTAssertEqual(store.saveCount, 1, "the whole batch is ONE save, not one per workout")
        XCTAssertEqual(store.backupCount, 0, "first write needs no backup")
        XCTAssertEqual(store.stored?.importedWorkoutSamples.count, 2, "the in-batch duplicate dedups by id")
        XCTAssertEqual(store.stored?.history.count, 0)
    }

    func testWorkoutBatchSecondWriteBacksUpOnce() throws {
        let seed = AppData.emptyCurrent().appendingImportedWorkoutSample(makeWorkoutSample(id: "w0"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.appendImportedWorkoutSamples(
            [makeWorkoutSample(id: "w1"), makeWorkoutSample(id: "w0")]   // w0 already present
        ) { _ in true }
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "one backup for the whole batch")
        XCTAssertEqual(store.saveCount, 1)
        // w0 dedups against the existing doc; only w1 is new → 2 total.
        XCTAssertEqual(store.stored?.importedWorkoutSamples.count, 2)
    }

    // MARK: - EDIT-1: profile scalar edit (SAME gated path, sanctioned MUTATION)

    private func makeProfile(name: String, weightKg: Double? = nil) -> UserProfile {
        UserProfile(name: name, weightKg: weightKg.map { .double($0) })
    }

    func testUpdateProfileFirstWriteSeedsBaseWithoutBackup() throws {
        let store = FakeAppDataStore()   // no existing file
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.updateProfile(makeProfile(name: "老王", weightKg: 80)) { _ in true }

        XCTAssertTrue(result.createdNewStore)
        XCTAssertNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 0, "first write must not attempt a backup")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.userProfile.name, "老王")
        XCTAssertEqual(store.stored?.userProfile.weightKg, .double(80))
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    func testUpdateProfileSecondWriteBacksUpBeforeSaving() throws {
        let seed = AppData.emptyCurrent().withUpdatedProfile(makeProfile(name: "老王", weightKg: 80))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.updateProfile(makeProfile(name: "小李", weightKg: 58.5)) { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1)
        // The edit replaced the profile in place (still exactly one userProfile).
        XCTAssertEqual(store.stored?.userProfile.name, "小李")
        XCTAssertEqual(store.stored?.userProfile.weightKg, .double(58.5))
    }

    func testUpdateProfileValidationRejectionWritesNothing() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent().withUpdatedProfile(makeProfile(name: "老王")))
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateProfile(makeProfile(name: "小李")) { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
        // The prior profile is untouched — a rejected edit never lands.
        XCTAssertEqual(store.stored?.userProfile.name, "老王")
    }

    func testUpdateProfileGateReceivesCandidateWithEditApplied() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        var seenName: String?
        _ = try writer.updateProfile(makeProfile(name: "小李")) { candidate in
            seenName = candidate.userProfile.name
            return true
        }
        XCTAssertEqual(seenName, "小李", "the gate must see the candidate with the edit already applied")
    }

    func testUpdateProfileUnreadableExistingDocumentIsNeverOverwritten() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.loadError = AppDataStoreError.decodeFailed("corrupt")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateProfile(makeProfile(name: "小李")) { _ in true }) { error in
            guard case CanonicalSessionWriteError.existingDocumentUnreadable = error else {
                return XCTFail("expected .existingDocumentUnreadable, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "must not overwrite unparseable data")
        XCTAssertEqual(store.backupCount, 0)
    }

    func testUpdateProfileBackupFailureStopsBeforeSave() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent().withUpdatedProfile(makeProfile(name: "老王")))
        store.backupError = AppDataStoreError.backupFailed("disk full")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateProfile(makeProfile(name: "小李")) { _ in true }) { error in
            guard case CanonicalSessionWriteError.backupFailed = error else {
                return XCTFail("expected .backupFailed, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "a failed backup must abort before any overwrite")
    }

    func testUpdateProfileSaveFailurePropagatesHonestly() {
        let store = FakeAppDataStore()   // first write, no backup
        store.saveError = AppDataStoreError.writeFailed("io error")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateProfile(makeProfile(name: "小李")) { _ in true }) { error in
            guard case CanonicalSessionWriteError.saveFailed = error else {
                return XCTFail("expected .saveFailed, got \(error)")
            }
        }
    }

    func testUpdateProfilePreservesOpenBagAndOtherKeysThroughGatedWrite() throws {
        // Seed a document with a profile, history, settings, and a top-level unknown.
        let json = """
        {"schemaVersion":8,\
        "userProfile":{"id":"u1","name":"老王","customProfileKey":"keepme"},\
        "history":[{"id":"old","completed":true}],\
        "settings":{"weightUnit":"kg"},\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let seed = try AppData(decoding: Data(json.utf8))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        let edited = seed.userProfile.withScalarFields(
            name: "小李", sex: nil, age: .integer(28), heightCm: nil, weightKg: .double(58.5),
            trainingLevel: nil, primaryGoal: nil, weeklyTrainingDays: nil, sessionDurationMin: nil
        )
        _ = try writer.updateProfile(edited) { _ in true }

        let stored = try XCTUnwrap(store.stored)
        XCTAssertEqual(stored.userProfile.name, "小李")
        XCTAssertEqual(stored.userProfile.id, "u1", "profile id preserved across edit")
        // Open bag (profile-level + top-level) and other keys survive the gated write.
        let canonical = try stored.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"customProfileKey\":\"keepme\""), "profile open-bag lost: \(canonical)")
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown lost")
        XCTAssertEqual(stored.history.count, 1)
        XCTAssertEqual(stored.history.first?.id, "old")
        XCTAssertEqual(stored.schemaVersion, .current, "edit must not bump schema")
    }

    func testUpdateProfileRoundTripThroughRealStore() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-edit1-writer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        // First write seeds the profile (no backup).
        let r1 = try writer.updateProfile(makeProfile(name: "老王", weightKg: 80)) { _ in true }
        XCTAssertTrue(r1.createdNewStore)
        XCTAssertNil(r1.backupURL)

        // Second write edits the profile in place, backing up first.
        let r2 = try writer.updateProfile(makeProfile(name: "小李", weightKg: 58.5)) { _ in true }
        XCTAssertFalse(r2.createdNewStore)
        let backupURL = try XCTUnwrap(r2.backupURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path), "backup file must exist on disk")

        // Reload from disk: the edit survives, self-entered weightKg round-trips.
        let loaded = try store.load()
        XCTAssertEqual(loaded.userProfile.name, "小李")
        XCTAssertEqual(loaded.userProfile.weightKg?.doubleValue ?? -1, 58.5, accuracy: 1e-9)
        XCTAssertEqual(loaded.healthMetricSamples.count, 0, "a profile edit never creates health samples")
    }

    // MARK: - EDIT-2: display-unit preference edit (SAME gated path, sanctioned MUTATION)

    func testUpdateUnitSettingsFirstWriteSeedsBaseWithoutBackup() throws {
        let store = FakeAppDataStore()   // no existing file
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.updateUnitSettings(displayUnit: .lb) { _ in true }

        XCTAssertTrue(result.createdNewStore)
        XCTAssertNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 0, "first write must not attempt a backup")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.unitSettings.displayUnit, .lb)
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    func testUpdateUnitSettingsSecondWriteBacksUpBeforeSaving() throws {
        let seed = AppData.emptyCurrent().withUpdatedUnitSettings(UnitSettings(weightUnit: .kg, displayUnit: .kg))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.updateUnitSettings(displayUnit: .lb) { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1)
        // The edit replaced the display preference in place…
        XCTAssertEqual(store.stored?.unitSettings.displayUnit, .lb)
        // …and weightUnit (the non-edited typed field) survived.
        XCTAssertEqual(store.stored?.unitSettings.weightUnit, .kg)
    }

    func testUpdateUnitSettingsValidationRejectionWritesNothing() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent().withUpdatedUnitSettings(UnitSettings(displayUnit: .kg)))
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateUnitSettings(displayUnit: .lb) { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
        // The prior preference is untouched — a rejected edit never lands.
        XCTAssertEqual(store.stored?.unitSettings.displayUnit, .kg)
    }

    func testUpdateUnitSettingsGateReceivesCandidateWithEditApplied() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        var seenUnit: WeightUnit?
        _ = try writer.updateUnitSettings(displayUnit: .lb) { candidate in
            seenUnit = candidate.unitSettings.displayUnit
            return true
        }
        XCTAssertEqual(seenUnit, .lb, "the gate must see the candidate with the display unit already applied")
    }

    func testUpdateUnitSettingsUnreadableExistingDocumentIsNeverOverwritten() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.loadError = AppDataStoreError.decodeFailed("corrupt")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateUnitSettings(displayUnit: .lb) { _ in true }) { error in
            guard case CanonicalSessionWriteError.existingDocumentUnreadable = error else {
                return XCTFail("expected .existingDocumentUnreadable, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "must not overwrite unparseable data")
        XCTAssertEqual(store.backupCount, 0)
    }

    func testUpdateUnitSettingsBackupFailureStopsBeforeSave() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent().withUpdatedUnitSettings(UnitSettings(displayUnit: .kg)))
        store.backupError = AppDataStoreError.backupFailed("disk full")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateUnitSettings(displayUnit: .lb) { _ in true }) { error in
            guard case CanonicalSessionWriteError.backupFailed = error else {
                return XCTFail("expected .backupFailed, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "a failed backup must abort before any overwrite")
    }

    func testUpdateUnitSettingsSaveFailurePropagatesHonestly() {
        let store = FakeAppDataStore()   // first write, no backup
        store.saveError = AppDataStoreError.writeFailed("io error")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateUnitSettings(displayUnit: .lb) { _ in true }) { error in
            guard case CanonicalSessionWriteError.saveFailed = error else {
                return XCTFail("expected .saveFailed, got \(error)")
            }
        }
    }

    func testUpdateUnitSettingsPreservesWeightUnitOpenBagAndOtherKeysThroughGatedWrite() throws {
        // Seed a document whose unitSettings carry weightUnit + an unknown unit key,
        // plus a profile, history, and a top-level unknown.
        let json = """
        {"schemaVersion":8,\
        "unitSettings":{"displayUnit":"kg","weightUnit":"kg","lengthUnit":"cm"},\
        "userProfile":{"id":"u1","name":"老王","weightKg":80},\
        "history":[{"id":"old","completed":true}],\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let seed = try AppData(decoding: Data(json.utf8))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        _ = try writer.updateUnitSettings(displayUnit: .lb) { _ in true }

        let stored = try XCTUnwrap(store.stored)
        XCTAssertEqual(stored.unitSettings.displayUnit, .lb)
        // weightUnit + the unit-level open bag survive — proves the candidate builder
        // reads the on-disk unit settings (not a passed-in stripped value).
        XCTAssertEqual(stored.unitSettings.weightUnit, .kg, "weightUnit preserved across the unit edit")
        let canonical = try stored.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"lengthUnit\":\"cm\""), "unit open-bag lost: \(canonical)")
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown lost")
        // Stored weight (kg) numerically unchanged — a display edit never coerces.
        XCTAssertEqual(stored.userProfile.weightKg?.doubleValue ?? -1, 80, accuracy: 1e-9)
        XCTAssertEqual(stored.history.count, 1)
        XCTAssertEqual(stored.history.first?.id, "old")
        XCTAssertEqual(stored.schemaVersion, .current, "edit must not bump schema")
    }

    func testUpdateUnitSettingsRoundTripThroughRealStore() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-edit2-writer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        // First write seeds the display preference (no backup).
        let r1 = try writer.updateUnitSettings(displayUnit: .kg) { _ in true }
        XCTAssertTrue(r1.createdNewStore)
        XCTAssertNil(r1.backupURL)

        // Second write flips the preference in place, backing up first.
        let r2 = try writer.updateUnitSettings(displayUnit: .lb) { _ in true }
        XCTAssertFalse(r2.createdNewStore)
        let backupURL = try XCTUnwrap(r2.backupURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path), "backup file must exist on disk")

        // Reload from disk: the display preference persists across the round trip.
        let loaded = try store.load()
        XCTAssertEqual(loaded.unitSettings.displayUnit, .lb)
    }

    // MARK: - EDIT-3: screening list edit (SAME gated path, sanctioned MUTATION)

    private func makeScreening(painTriggers: [String]) -> ScreeningProfile {
        ScreeningProfile(painTriggers: painTriggers)
    }

    func testUpdateScreeningFirstWriteSeedsBaseWithoutBackup() throws {
        let store = FakeAppDataStore()   // no existing file
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.updateScreening(makeScreening(painTriggers: ["膝前侧"])) { _ in true }

        XCTAssertTrue(result.createdNewStore)
        XCTAssertNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 0, "first write must not attempt a backup")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.screeningProfile.painTriggers, ["膝前侧"])
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    func testUpdateScreeningSecondWriteBacksUpBeforeSaving() throws {
        let seed = AppData.emptyCurrent().withUpdatedScreening(makeScreening(painTriggers: ["膝前侧"]))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.updateScreening(makeScreening(painTriggers: ["右肩"])) { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1)
        // The edit replaced the screening lists in place (still exactly one screeningProfile).
        XCTAssertEqual(store.stored?.screeningProfile.painTriggers, ["右肩"])
    }

    func testUpdateScreeningValidationRejectionWritesNothing() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent().withUpdatedScreening(makeScreening(painTriggers: ["膝前侧"])))
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateScreening(makeScreening(painTriggers: ["右肩"])) { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
        // The prior screening is untouched — a rejected edit never lands.
        XCTAssertEqual(store.stored?.screeningProfile.painTriggers, ["膝前侧"])
    }

    func testUpdateScreeningGateReceivesCandidateWithEditApplied() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        var seenTriggers: [String]?
        _ = try writer.updateScreening(makeScreening(painTriggers: ["右肩"])) { candidate in
            seenTriggers = candidate.screeningProfile.painTriggers
            return true
        }
        XCTAssertEqual(seenTriggers, ["右肩"], "the gate must see the candidate with the edit already applied")
    }

    func testUpdateScreeningUnreadableExistingDocumentIsNeverOverwritten() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.loadError = AppDataStoreError.decodeFailed("corrupt")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateScreening(makeScreening(painTriggers: ["右肩"])) { _ in true }) { error in
            guard case CanonicalSessionWriteError.existingDocumentUnreadable = error else {
                return XCTFail("expected .existingDocumentUnreadable, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "must not overwrite unparseable data")
        XCTAssertEqual(store.backupCount, 0)
    }

    func testUpdateScreeningBackupFailureStopsBeforeSave() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent().withUpdatedScreening(makeScreening(painTriggers: ["膝前侧"])))
        store.backupError = AppDataStoreError.backupFailed("disk full")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateScreening(makeScreening(painTriggers: ["右肩"])) { _ in true }) { error in
            guard case CanonicalSessionWriteError.backupFailed = error else {
                return XCTFail("expected .backupFailed, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "a failed backup must abort before any overwrite")
    }

    func testUpdateScreeningSaveFailurePropagatesHonestly() {
        let store = FakeAppDataStore()   // first write, no backup
        store.saveError = AppDataStoreError.writeFailed("io error")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateScreening(makeScreening(painTriggers: ["右肩"])) { _ in true }) { error in
            guard case CanonicalSessionWriteError.saveFailed = error else {
                return XCTFail("expected .saveFailed, got \(error)")
            }
        }
    }

    func testUpdateScreeningPreservesAdaptiveStateOpenBagAndOtherKeysThroughGatedWrite() throws {
        // Seed a document whose screeningProfile carries an engine-managed adaptiveState
        // + an unknown screening key, plus a profile, history, and a top-level unknown.
        let json = """
        {"schemaVersion":8,\
        "screeningProfile":{"userId":"u1","painTriggers":["膝前侧"],"adaptiveState":{"issueScores":{"knee":3}},"customScreeningKey":"keepme"},\
        "userProfile":{"id":"u1","name":"老王"},\
        "history":[{"id":"old","completed":true}],\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let seed = try AppData(decoding: Data(json.utf8))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        let edited = seed.screeningProfile.withEditedLists(
            painTriggers: ["膝前侧", "右肩"], restrictedExercises: ["杠铃过顶推举"], correctionPriority: nil
        )
        _ = try writer.updateScreening(edited) { _ in true }

        let stored = try XCTUnwrap(store.stored)
        XCTAssertEqual(stored.screeningProfile.painTriggers, ["膝前侧", "右肩"])
        XCTAssertEqual(stored.screeningProfile.restrictedExercises, ["杠铃过顶推举"])
        XCTAssertEqual(stored.screeningProfile.userId, "u1", "userId preserved across edit")
        // Engine-managed adaptiveState + screening open bag + other keys survive.
        let canonical = try stored.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"issueScores\":{\"knee\":3}"), "engine adaptiveState lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"customScreeningKey\":\"keepme\""), "screening open-bag lost: \(canonical)")
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown lost")
        XCTAssertEqual(stored.userProfile.name, "老王")
        XCTAssertEqual(stored.history.count, 1)
        XCTAssertEqual(stored.history.first?.id, "old")
        XCTAssertEqual(stored.schemaVersion, .current, "edit must not bump schema")
    }

    func testUpdateScreeningRoundTripThroughRealStore() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-edit3-writer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        // First write seeds the screening lists (no backup).
        let r1 = try writer.updateScreening(makeScreening(painTriggers: ["膝前侧"])) { _ in true }
        XCTAssertTrue(r1.createdNewStore)
        XCTAssertNil(r1.backupURL)

        // Second write edits the lists in place, backing up first.
        let r2 = try writer.updateScreening(makeScreening(painTriggers: ["右肩"])) { _ in true }
        XCTAssertFalse(r2.createdNewStore)
        let backupURL = try XCTUnwrap(r2.backupURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path), "backup file must exist on disk")

        // Reload from disk: the edit survives across the round trip.
        let loaded = try store.load()
        XCTAssertEqual(loaded.screeningProfile.painTriggers, ["右肩"])
    }

    // MARK: - EDIT-4: program config scalar edit (SAME gated path, sanctioned MUTATION)

    func testUpdateProgramConfigFirstWriteSeedsBaseWithoutBackup() throws {
        let store = FakeAppDataStore()   // no existing file
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.updateProgramConfig(
            primaryGoal: "增肌", splitType: "全身", daysPerWeek: .integer(3)
        ) { _ in true }

        XCTAssertTrue(result.createdNewStore)
        XCTAssertNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 0, "first write must not attempt a backup")
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.stored?.programTemplate.primaryGoal, "增肌")
        XCTAssertEqual(store.stored?.programTemplate.daysPerWeek?.intValue, 3)
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    func testUpdateProgramConfigSecondWriteBacksUpBeforeSaving() throws {
        let seed = AppData.emptyCurrent().withUpdatedProgramConfig(
            primaryGoal: "增肌", splitType: "全身", daysPerWeek: .integer(3)
        )
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        let result = try writer.updateProgramConfig(
            primaryGoal: "力量", splitType: "推 / 拉 / 腿", daysPerWeek: .integer(4)
        ) { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1)
        // The edit replaced the scalars in place (still exactly one programTemplate).
        XCTAssertEqual(store.stored?.programTemplate.primaryGoal, "力量")
        XCTAssertEqual(store.stored?.programTemplate.splitType, "推 / 拉 / 腿")
        XCTAssertEqual(store.stored?.programTemplate.daysPerWeek?.intValue, 4)
    }

    func testUpdateProgramConfigValidationRejectionWritesNothing() {
        let seed = AppData.emptyCurrent().withUpdatedProgramConfig(
            primaryGoal: "增肌", splitType: "全身", daysPerWeek: .integer(3)
        )
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateProgramConfig(
            primaryGoal: "力量", splitType: nil, daysPerWeek: .integer(4)
        ) { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
        // The prior program config is untouched — a rejected edit never lands.
        XCTAssertEqual(store.stored?.programTemplate.primaryGoal, "增肌")
    }

    func testUpdateProgramConfigGateReceivesCandidateWithEditApplied() throws {
        let store = FakeAppDataStore()
        let writer = CanonicalSessionWriter(store: store)
        var seenGoal: String?
        var seenDays: Int?
        _ = try writer.updateProgramConfig(
            primaryGoal: "力量", splitType: "推 / 拉 / 腿", daysPerWeek: .integer(4)
        ) { candidate in
            seenGoal = candidate.programTemplate.primaryGoal
            seenDays = candidate.programTemplate.daysPerWeek?.intValue
            return true
        }
        XCTAssertEqual(seenGoal, "力量", "the gate must see the candidate with the edit already applied")
        XCTAssertEqual(seenDays, 4)
    }

    func testUpdateProgramConfigUnreadableExistingDocumentIsNeverOverwritten() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.loadError = AppDataStoreError.decodeFailed("corrupt")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateProgramConfig(
            primaryGoal: "力量", splitType: nil, daysPerWeek: .integer(4)
        ) { _ in true }) { error in
            guard case CanonicalSessionWriteError.existingDocumentUnreadable = error else {
                return XCTFail("expected .existingDocumentUnreadable, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "must not overwrite unparseable data")
        XCTAssertEqual(store.backupCount, 0)
    }

    func testUpdateProgramConfigBackupFailureStopsBeforeSave() {
        let seed = AppData.emptyCurrent().withUpdatedProgramConfig(
            primaryGoal: "增肌", splitType: nil, daysPerWeek: .integer(3)
        )
        let store = FakeAppDataStore(stored: seed)
        store.backupError = AppDataStoreError.backupFailed("disk full")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateProgramConfig(
            primaryGoal: "力量", splitType: nil, daysPerWeek: .integer(4)
        ) { _ in true }) { error in
            guard case CanonicalSessionWriteError.backupFailed = error else {
                return XCTFail("expected .backupFailed, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "a failed backup must abort before any overwrite")
    }

    func testUpdateProgramConfigSaveFailurePropagatesHonestly() {
        let store = FakeAppDataStore()   // first write, no backup
        store.saveError = AppDataStoreError.writeFailed("io error")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateProgramConfig(
            primaryGoal: "力量", splitType: nil, daysPerWeek: .integer(4)
        ) { _ in true }) { error in
            guard case CanonicalSessionWriteError.saveFailed = error else {
                return XCTFail("expected .saveFailed, got \(error)")
            }
        }
    }

    func testUpdateProgramConfigPreservesStrategiesOpenBagAndOtherKeysThroughGatedWrite() throws {
        // Seed a document whose programTemplate carries engine-managed strategy blobs +
        // an unknown program key, plus an engine-managed mesocycle (weeks), a profile,
        // history, and a top-level unknown.
        let json = """
        {"schemaVersion":8,\
        "programTemplate":{"id":"p1","userId":"u1","primaryGoal":"增肌","splitType":"全身","daysPerWeek":3,"correctionStrategy":{"hingePriority":true},"functionalStrategy":{"carry":["farmer"]},"customProgramKey":"keepme"},\
        "mesocyclePlan":{"id":"m1","phase":"积累期","weeks":[{"index":1},{"index":2}]},\
        "userProfile":{"id":"u1","name":"老王"},\
        "history":[{"id":"old","completed":true}],\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let seed = try AppData(decoding: Data(json.utf8))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        _ = try writer.updateProgramConfig(
            primaryGoal: "力量", splitType: "推 / 拉 / 腿", daysPerWeek: .integer(4)
        ) { _ in true }

        let stored = try XCTUnwrap(store.stored)
        // The three user scalars changed in place…
        XCTAssertEqual(stored.programTemplate.primaryGoal, "力量")
        XCTAssertEqual(stored.programTemplate.splitType, "推 / 拉 / 腿")
        XCTAssertEqual(stored.programTemplate.daysPerWeek?.intValue, 4)
        XCTAssertEqual(stored.programTemplate.id, "p1", "id preserved across edit")
        XCTAssertEqual(stored.programTemplate.userId, "u1", "userId preserved across edit")
        // …engine-managed strategy blobs + program open bag + the engine-managed
        // mesocycle weeks + other keys survive verbatim.
        let canonical = try stored.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"correctionStrategy\":{\"hingePriority\":true}"), "engine strategy lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"functionalStrategy\":{\"carry\":[\"farmer\"]}"), "engine strategy lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"customProgramKey\":\"keepme\""), "program open-bag lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"weeks\":[{\"index\":1},{\"index\":2}]"), "engine mesocycle weeks lost: \(canonical)")
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown lost")
        XCTAssertEqual(stored.userProfile.name, "老王")
        XCTAssertEqual(stored.history.count, 1)
        XCTAssertEqual(stored.history.first?.id, "old")
        XCTAssertEqual(stored.schemaVersion, .current, "edit must not bump schema")
    }

    func testUpdateProgramConfigRoundTripThroughRealStore() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-edit4-writer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        // First write seeds the program config (no backup).
        let r1 = try writer.updateProgramConfig(
            primaryGoal: "增肌", splitType: "全身", daysPerWeek: .integer(3)
        ) { _ in true }
        XCTAssertTrue(r1.createdNewStore)
        XCTAssertNil(r1.backupURL)

        // Second write edits the scalars in place, backing up first.
        let r2 = try writer.updateProgramConfig(
            primaryGoal: "力量", splitType: "推 / 拉 / 腿", daysPerWeek: .integer(4)
        ) { _ in true }
        XCTAssertFalse(r2.createdNewStore)
        let backupURL = try XCTUnwrap(r2.backupURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path), "backup file must exist on disk")

        // Reload from disk: the edit survives across the round trip.
        let loaded = try store.load()
        XCTAssertEqual(loaded.programTemplate.primaryGoal, "力量")
        XCTAssertEqual(loaded.programTemplate.splitType, "推 / 拉 / 腿")
        XCTAssertEqual(loaded.programTemplate.daysPerWeek?.intValue, 4)
    }

    // MARK: - DEEP-EDIT-1: logged-set correction (SAME gated path)

    func testUpdateHistorySetCorrectsTargetSetAndBacksUp() throws {
        // Seed with a completed session whose only set is 60kg × 5 @ RIR 2.
        let seed = AppData.emptyCurrent().appendingHistorySession(makeSession(id: "s1"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        let result = try writer.updateHistorySet(
            sessionId: "s1", exerciseId: "bench", setIndex: 0,
            weightKg: 65, reps: 7, rir: 1
        ) { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1)
        // The one set's three metrics are corrected in place.
        let set = store.stored?.history.first?.exercises?.first?.sets?.first
        XCTAssertEqual(set?.weight?.doubleValue ?? -1, 65, accuracy: 1e-9)
        XCTAssertEqual(set?.reps?.intValue, 7)
        XCTAssertEqual(set?.rir?.intValue, 1)
        // Identity + completion survive the edit; still exactly one session/set.
        XCTAssertEqual(store.stored?.history.count, 1)
        XCTAssertEqual(set?.setIndex?.intValue, 0)
        XCTAssertEqual(set?.done, true)
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    func testUpdateHistorySetValidationRejectionWritesNothing() throws {
        let seed = AppData.emptyCurrent().appendingHistorySession(makeSession(id: "s1"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateHistorySet(
            sessionId: "s1", exerciseId: "bench", setIndex: 0,
            weightKg: 65, reps: 7, rir: 1
        ) { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
        // The on-disk set is untouched (still 60kg × 5).
        XCTAssertEqual(store.stored?.history.first?.exercises?.first?.sets?.first?.weight?.doubleValue ?? -1, 60, accuracy: 1e-9)
    }

    func testUpdateHistorySetGateSeesCorrectedCandidate() throws {
        let seed = AppData.emptyCurrent().appendingHistorySession(makeSession(id: "s1"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        var seenWeight: Double?
        _ = try writer.updateHistorySet(
            sessionId: "s1", exerciseId: "bench", setIndex: 0,
            weightKg: 65, reps: 7, rir: 1
        ) { candidate in
            seenWeight = candidate.history.first?.exercises?.first?.sets?.first?.weight?.doubleValue
            return true
        }
        XCTAssertEqual(seenWeight ?? -1, 65, accuracy: 1e-9, "the gate must see the candidate with the set already corrected")
    }

    func testUpdateHistorySetRoundTripThroughRealStore() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-deepedit1-writer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        // Seed a completed session (60kg × 5), then correct it to 67.5kg × 6 @ RIR 0.
        _ = try writer.appendCompletedSession(makeSession(id: "s1", weightKg: 60, reps: 5)) { _ in true }
        let r2 = try writer.updateHistorySet(
            sessionId: "s1", exerciseId: "bench", setIndex: 0,
            weightKg: 67.5, reps: 6, rir: 0
        ) { _ in true }
        XCTAssertFalse(r2.createdNewStore)
        let backupURL = try XCTUnwrap(r2.backupURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path), "backup file must exist on disk")

        // Reload from disk: the correction survives the round trip; fractional kg
        // stays a double.
        let loaded = try store.load()
        XCTAssertEqual(loaded.history.count, 1)
        let set = loaded.history.first?.exercises?.first?.sets?.first
        XCTAssertEqual(set?.weight?.doubleValue ?? -1, 67.5, accuracy: 1e-9)
        XCTAssertEqual(set?.reps?.intValue, 6)
        XCTAssertEqual(set?.rir?.intValue, 0)
        XCTAssertEqual(set?.done, true)
    }

    // MARK: - SR-4: exercise replacement (换动作 / 复原, SAME gated path)

    func testUpdateExerciseReplacementAppliesIdentityAndBacksUp() throws {
        // Seed with a completed session whose only exercise is the native-logged "bench"
        // (no identity fields yet).
        let seed = AppData.emptyCurrent().appendingHistorySession(makeSession(id: "s1"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        let result = try writer.updateExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        ) { _ in true }

        XCTAssertFalse(result.createdNewStore)
        XCTAssertNotNil(result.backupURL)
        XCTAssertEqual(store.backupCount, 1, "an existing document must be backed up before overwrite")
        XCTAssertEqual(store.saveCount, 1, "the replacement is exactly one gated save (single write path)")
        // The three user-override identity fields are set on the matched exercise…
        let ex = store.stored?.history.first?.exercises?.first
        XCTAssertEqual(ex?.actualExerciseId, "db-bench-press")
        XCTAssertEqual(ex?.displayExerciseId, "db-bench-press")
        XCTAssertEqual(ex?.recordExerciseId, "db-bench-press")
        // …the engine-opened originalExerciseId is NEVER written (stays nil on a native
        // log), the planned id/name + the performed sets survive verbatim.
        XCTAssertNil(ex?.originalExerciseId, "apply must never open originalExerciseId")
        XCTAssertEqual(ex?.id, "bench")
        XCTAssertEqual(ex?.exerciseId, "bench")
        XCTAssertEqual(ex?.name, "平板卧推")
        XCTAssertEqual(ex?.sets?.count, 1)
        XCTAssertEqual(ex?.sets?.first?.weight?.doubleValue ?? -1, 60, accuracy: 1e-9)
        XCTAssertEqual(store.stored?.history.count, 1)
        XCTAssertEqual(store.stored?.schemaVersion, .current)
    }

    func testUpdateExerciseReplacementRestoreClearsIdentity() throws {
        // Seed with an ALREADY-replaced exercise (actual/display/record == db-bench-press).
        let seed = AppData.emptyCurrent()
            .appendingHistorySession(makeSession(id: "s1"))
            .withUpdatedExerciseReplacement(sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press")
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        let result = try writer.updateExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: nil   // RESTORE
        ) { _ in true }

        XCTAssertEqual(store.saveCount, 1, "restore is exactly one gated save")
        XCTAssertNotNil(result.backupURL)
        // The three identity fields are cleared → the record falls back to the original
        // planned id/exerciseId (still locatable, never touched).
        let ex = store.stored?.history.first?.exercises?.first
        XCTAssertNil(ex?.actualExerciseId)
        XCTAssertNil(ex?.displayExerciseId)
        XCTAssertNil(ex?.recordExerciseId)
        XCTAssertEqual(ex?.id, "bench")
        XCTAssertEqual(ex?.exerciseId, "bench")
        XCTAssertEqual(ex?.sets?.count, 1)
    }

    func testUpdateExerciseReplacementValidationRejectionWritesNothing() throws {
        let seed = AppData.emptyCurrent().appendingHistorySession(makeSession(id: "s1"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        ) { _ in false }) { error in
            guard case CanonicalSessionWriteError.validationRejected = error else {
                return XCTFail("expected .validationRejected, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.backupCount, 0)
        // The on-disk exercise is untouched (no identity leaked).
        XCTAssertNil(store.stored?.history.first?.exercises?.first?.actualExerciseId)
    }

    func testUpdateExerciseReplacementGateSeesReplacedCandidate() throws {
        let seed = AppData.emptyCurrent().appendingHistorySession(makeSession(id: "s1"))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)
        var seenActual: String?
        _ = try writer.updateExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        ) { candidate in
            seenActual = candidate.history.first?.exercises?.first?.actualExerciseId
            return true
        }
        XCTAssertEqual(seenActual, "db-bench-press", "the gate must see the candidate with the replacement already applied")
    }

    func testUpdateExerciseReplacementUnreadableExistingDocumentIsNeverOverwritten() {
        let store = FakeAppDataStore(stored: AppData.emptyCurrent())
        store.loadError = AppDataStoreError.decodeFailed("corrupt")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        ) { _ in true }) { error in
            guard case CanonicalSessionWriteError.existingDocumentUnreadable = error else {
                return XCTFail("expected .existingDocumentUnreadable, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "must not overwrite unparseable data")
        XCTAssertEqual(store.backupCount, 0)
    }

    func testUpdateExerciseReplacementBackupFailureStopsBeforeSave() {
        let seed = AppData.emptyCurrent().appendingHistorySession(makeSession(id: "s1"))
        let store = FakeAppDataStore(stored: seed)
        store.backupError = AppDataStoreError.backupFailed("disk full")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        ) { _ in true }) { error in
            guard case CanonicalSessionWriteError.backupFailed = error else {
                return XCTFail("expected .backupFailed, got \(error)")
            }
        }
        XCTAssertEqual(store.saveCount, 0, "a failed backup must abort before any overwrite")
    }

    func testUpdateExerciseReplacementSaveFailurePropagatesHonestly() {
        let seed = AppData.emptyCurrent().appendingHistorySession(makeSession(id: "s1"))
        let store = FakeAppDataStore(stored: seed)
        store.saveError = AppDataStoreError.writeFailed("io error")
        let writer = CanonicalSessionWriter(store: store)

        XCTAssertThrowsError(try writer.updateExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        ) { _ in true }) { error in
            guard case CanonicalSessionWriteError.saveFailed = error else {
                return XCTFail("expected .saveFailed, got \(error)")
            }
        }
    }

    func testUpdateExerciseReplacementPreservesOriginalIdBodyAndOpenBagThroughGatedWrite() throws {
        // Seed a richer history exercise: an engine-opened originalExerciseId, advice,
        // sets with a set-level open bag, plus exercise/session/top-level unknowns and an
        // engine-managed mesocycle (weeks) — the replacement must touch ONLY the three
        // identity fields.
        let json = """
        {"schemaVersion":8,\
        "history":[{"id":"s1","completed":true,"sessionNote":"keep-session",\
        "exercises":[{"id":"bench","exerciseId":"bench","name":"平板卧推","originalExerciseId":"bench-planned",\
        "prescription":{"target":"5x5"},"exerciseNote":"keep-ex",\
        "sets":[{"setIndex":0,"weight":60,"reps":8,"rir":2,"done":true,"setNote":"keep-set0"}]}]}],\
        "mesocyclePlan":{"id":"m1","weeks":[{"index":1},{"index":2}]},\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let seed = try AppData(decoding: Data(json.utf8))
        let store = FakeAppDataStore(stored: seed)
        let writer = CanonicalSessionWriter(store: store)

        _ = try writer.updateExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        ) { _ in true }

        let stored = try XCTUnwrap(store.stored)
        let ex = stored.history.first?.exercises?.first
        XCTAssertEqual(ex?.actualExerciseId, "db-bench-press")
        XCTAssertEqual(ex?.displayExerciseId, "db-bench-press")
        XCTAssertEqual(ex?.recordExerciseId, "db-bench-press")
        // The engine-opened originalExerciseId is carried through UNTOUCHED.
        XCTAssertEqual(ex?.originalExerciseId, "bench-planned", "originalExerciseId must never be written by a replacement")
        // The prescription body + sets survive; the set's metrics are unchanged.
        XCTAssertEqual(ex?.sets?.first?.weight?.doubleValue ?? -1, 60, accuracy: 1e-9)
        // Open bags at every level + the engine-managed mesocycle weeks survive verbatim.
        let canonical = try stored.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"sessionNote\":\"keep-session\""), "session open-bag lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"exerciseNote\":\"keep-ex\""), "exercise open-bag lost")
        XCTAssertTrue(canonical.contains("\"setNote\":\"keep-set0\""), "set open-bag lost")
        XCTAssertTrue(canonical.contains("\"prescription\":{\"target\":\"5x5\"}"), "engine advice lost")
        XCTAssertTrue(canonical.contains("\"weeks\":[{\"index\":1},{\"index\":2}]"), "engine mesocycle weeks lost")
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown lost")
        XCTAssertEqual(stored.schemaVersion, .current, "edit must not bump schema")
    }

    func testUpdateExerciseReplacementApplyPersistsThroughRealStore() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-sr4-writer-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = JSONFileAppDataStore(directory: dir, filename: "appdata.json")
        let writer = CanonicalSessionWriter(store: store)

        // Seed a completed session (no backup), then APPLY a replacement (backs up the
        // prior file, then atomically saves). One backup-producing write, mirroring the
        // DEEP-EDIT-1 real-store round trip (the store's backup name is second-granular,
        // so a test does at most one backup per second). Restore's disk behaviour is
        // covered by the fake-store + Domain byte-identical tests.
        let r1 = try writer.appendCompletedSession(makeSession(id: "s1", weightKg: 60, reps: 5)) { _ in true }
        XCTAssertTrue(r1.createdNewStore)
        let r2 = try writer.updateExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        ) { _ in true }
        XCTAssertFalse(r2.createdNewStore)
        let backupURL = try XCTUnwrap(r2.backupURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path), "backup file must exist on disk")

        // Reload from disk: the replacement identity persisted; the engine-opened
        // originalExerciseId stays nil and the performed set is unchanged.
        let loaded = try store.load()
        XCTAssertEqual(loaded.history.count, 1)
        let ex = loaded.history.first?.exercises?.first
        XCTAssertEqual(ex?.actualExerciseId, "db-bench-press")
        XCTAssertEqual(ex?.displayExerciseId, "db-bench-press")
        XCTAssertEqual(ex?.recordExerciseId, "db-bench-press")
        XCTAssertNil(ex?.originalExerciseId)
        XCTAssertEqual(ex?.id, "bench")
        XCTAssertEqual(ex?.sets?.first?.weight?.doubleValue ?? -1, 60, accuracy: 1e-9)
        XCTAssertEqual(ex?.sets?.first?.done, true)
    }
}
