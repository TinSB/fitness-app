// CanonicalSessionWriter 合同（系统逻辑 §5 / Master §7）：
// load → 候选 → 注入的 DataHealth gate → backup → atomic save → honest failure。
// 验收：写前备份、原子保存、坏数据不覆盖、失败如实报告、不 fake success。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

private struct RejectingGate: AppDataWriteGate {
    struct Rejection: Error, Equatable {}
    func validate(candidate: AppData, replacing current: AppData?) throws { throw Rejection() }
}

/// 记录 gate 实际收到的参数——replacing 的 nil/非 nil 语义是 M1-3 DataHealth gate 的依赖。
private final class CapturingGate: AppDataWriteGate {
    private(set) var captured: [(candidate: AppData, replacing: AppData?)] = []
    func validate(candidate: AppData, replacing current: AppData?) throws {
        captured.append((candidate, current))
    }
}

/// 内存 store spy：可注入 backup 失败，记录 save 是否被调用。
private final class StoreSpy: AppDataStore {
    var current: AppData?
    var backupError: Error?
    private(set) var saveCount = 0

    func load() throws -> AppData? { current }
    func save(_ appData: AppData) throws {
        saveCount += 1
        current = appData
    }
    func backupExisting() throws -> URL? {
        if let backupError { throw backupError }
        return nil
    }
}

final class CanonicalSessionWriterTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-writer-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter(gate: AppDataWriteGate = AcceptAllGate()) -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: gate)
    }

    private func makeSession(id: String = "session-1", completed: Bool? = true) -> TrainingSession {
        var storage: [String: JSONValue] = [
            "id": .string(id),
            "date": .string("2026-06-09"),
            "exercises": .array([]),
        ]
        if let completed { storage["completed"] = .bool(completed) }
        return TrainingSession(storage: storage)
    }

    // MARK: 首写引导

    func testAppendToEmptyStoreBootstrapsCanonicalDocument() throws {
        let result = try makeWriter().appendCompletedSession(makeSession())
        XCTAssertEqual(result.schemaVersion, 10)  // 首写引导用 SchemaVersion.current（= 10）
        XCTAssertEqual(result.history.count, 1)
        XCTAssertEqual(result.history.first?.id, "session-1")

        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(onDisk.storage, result.storage)
    }

    // MARK: open-bag 与既有数据保全

    func testAppendPreservesUnknownFieldsAndExistingHistory() throws {
        let existing = #"{"schemaVersion": 8, "futureKey": {"deep": true}, "history": [{"id": "old", "completed": true}], "userProfile": {"name": "样例"}}"#
        try Data(existing.utf8).write(to: fileURL)

        let result = try makeWriter().appendCompletedSession(makeSession(id: "new"))
        XCTAssertEqual(result.history.map(\.id), ["old", "new"])
        XCTAssertEqual(result.storage["futureKey"], .object(["deep": .bool(true)]))
        XCTAssertEqual(result.userProfile.name, "样例")
    }

    // MARK: gate 注入与诚实失败

    func testGateRejectionLeavesFileUntouchedAndPropagates() throws {
        let existingBytes = Data(#"{"schemaVersion": 8, "history": []}"#.utf8)
        try existingBytes.write(to: fileURL)

        XCTAssertThrowsError(try makeWriter(gate: RejectingGate()).appendCompletedSession(makeSession())) { error in
            XCTAssertTrue(error is RejectingGate.Rejection)
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), existingBytes)
    }

    // MARK: 不覆盖 unreadable user data

    func testUnreadableExistingFileIsNeverOverwritten() throws {
        let corruptBytes = Data("user-data-corrupt-but-precious".utf8)
        try corruptBytes.write(to: fileURL)

        XCTAssertThrowsError(try makeWriter().appendCompletedSession(makeSession())) { error in
            guard case AppDataStoreError.unreadable = error else {
                return XCTFail("expected .unreadable, got \(error)")
            }
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), corruptBytes)
    }

    // MARK: backup 失败必须阻止 save

    func testBackupFailureBlocksSaveAndPropagates() throws {
        let spy = StoreSpy()
        spy.current = try JSONDecoder().decode(AppData.self, from: Data(#"{"schemaVersion": 8, "history": []}"#.utf8))
        spy.backupError = AppDataStoreError.backupFailed(underlying: CocoaError(.fileWriteNoPermission))
        let writer = CanonicalSessionWriter(store: spy, gate: AcceptAllGate())

        XCTAssertThrowsError(try writer.appendCompletedSession(makeSession())) { error in
            guard case AppDataStoreError.backupFailed = error else {
                return XCTFail("expected .backupFailed, got \(error)")
            }
        }
        XCTAssertEqual(spy.saveCount, 0)
    }

    // MARK: gate 收到的 replacing 语义（首写 nil / 覆写非 nil）

    func testGateReceivesNilReplacingOnFirstWrite() throws {
        let gate = CapturingGate()
        try makeWriter(gate: gate).appendCompletedSession(makeSession())
        XCTAssertEqual(gate.captured.count, 1)
        XCTAssertNil(gate.captured.first?.replacing)
    }

    func testGateReceivesCurrentDocumentWhenOverwriting() throws {
        let existing = #"{"schemaVersion": 8, "history": [], "marker": "before"}"#
        try Data(existing.utf8).write(to: fileURL)

        let gate = CapturingGate()
        try makeWriter(gate: gate).appendCompletedSession(makeSession())
        let replacing = try XCTUnwrap(gate.captured.first?.replacing)
        XCTAssertEqual(replacing.storage["marker"], .string("before"))
    }

    // MARK: 入口约束（完成训练 append 这一类）

    func testRejectsSessionNotMarkedCompleted() throws {
        XCTAssertThrowsError(try makeWriter().appendCompletedSession(makeSession(completed: nil))) { error in
            XCTAssertEqual(error as? CanonicalWriteError, .notACompletedSession)
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: fileURL.path))
    }

    func testRejectsSessionExplicitlyMarkedNotCompleted() throws {
        XCTAssertThrowsError(try makeWriter().appendCompletedSession(makeSession(completed: false))) { error in
            XCTAssertEqual(error as? CanonicalWriteError, .notACompletedSession)
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: fileURL.path))
    }

    func testRejectsSessionWithoutId() throws {
        let session = TrainingSession(storage: ["completed": .bool(true)])
        XCTAssertThrowsError(try makeWriter().appendCompletedSession(session)) { error in
            XCTAssertEqual(error as? CanonicalWriteError, .missingSessionId)
        }
    }

    func testRejectsDuplicateSessionId() throws {
        let writer = makeWriter()
        try writer.appendCompletedSession(makeSession(id: "dup"))
        XCTAssertThrowsError(try writer.appendCompletedSession(makeSession(id: "dup"))) { error in
            XCTAssertEqual(error as? CanonicalWriteError, .duplicateSessionId("dup"))
        }
        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(onDisk.history.count, 1)
    }

    // MARK: 写前备份

    func testSecondWriteBacksUpPreviousVersion() throws {
        let writer = makeWriter()
        try writer.appendCompletedSession(makeSession(id: "first"))
        let bytesAfterFirst = try Data(contentsOf: fileURL)

        try writer.appendCompletedSession(makeSession(id: "second"))

        let backups = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            .filter { $0.lastPathComponent.hasPrefix("app-data.json.backup-") }
        XCTAssertEqual(backups.count, 1)
        XCTAssertEqual(try Data(contentsOf: try XCTUnwrap(backups.first)), bytesAfterFirst)
    }

    // MARK: no fake success

    func testSaveFailurePropagatesHonestly() {
        let writer = CanonicalSessionWriter(
            store: JSONFileAppDataStore(fileURL: URL(fileURLWithPath: "/nonexistent-root/sub/app-data.json")),
            gate: AcceptAllGate()
        )
        XCTAssertThrowsError(try writer.appendCompletedSession(makeSession())) { error in
            guard case AppDataStoreError.writeFailed = error else {
                return XCTFail("expected .writeFailed, got \(error)")
            }
        }
    }
}
