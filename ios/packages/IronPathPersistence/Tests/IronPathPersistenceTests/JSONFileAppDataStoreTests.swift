// JSONFileAppDataStoreTests — iOS-3A Data Health Runtime Foundation V1.
//
// Locks the JSON-file persistence contract:
//   * save → load round trip preserves AppData canonical bytes
//   * load on a missing file throws AppDataStoreError.fileMissing
//   * load on schemaVersion-invalid payload throws .schemaInvalid
//   * backup creates a sibling file and returns its URL
//   * hasExistingFile reflects file existence
//
// Uses `FileManager.default.temporaryDirectory` per test. Cleanup
// runs in tearDown to keep the runner sandbox lean.

import XCTest
@testable import IronPathPersistence
import IronPathDomain
import Foundation

final class JSONFileAppDataStoreTests: XCTestCase {
    private var tempDir: URL!

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("ironpath-3a-store-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        if let dir = tempDir, FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.removeItem(at: dir)
        }
    }

    func testHasExistingFileFalseInitially() {
        let store = JSONFileAppDataStore(directory: tempDir)
        XCTAssertFalse(store.hasExistingFile)
    }

    func testSaveLoadRoundTripPreservesCanonicalBytes() throws {
        let store = JSONFileAppDataStore(directory: tempDir, filename: "test.json")
        let appData = try makeAppData()
        try store.save(appData)
        XCTAssertTrue(store.hasExistingFile)
        let loaded = try store.load()
        let before = try appData.canonicalJSONData()
        let after = try loaded.canonicalJSONData()
        XCTAssertEqual(before, after)
    }

    func testLoadOnMissingFileThrowsFileMissing() {
        let store = JSONFileAppDataStore(directory: tempDir, filename: "absent.json")
        XCTAssertThrowsError(try store.load()) { error in
            guard let storeError = error as? AppDataStoreError else {
                XCTFail("expected AppDataStoreError, got \(error)")
                return
            }
            guard case .fileMissing = storeError else {
                XCTFail("expected .fileMissing, got \(storeError)")
                return
            }
        }
    }

    func testLoadOnSchemaInvalidPayloadThrowsSchemaInvalid() throws {
        let store = JSONFileAppDataStore(directory: tempDir, filename: "bad-schema.json")
        let bad = """
        {"schemaVersion": 999}
        """.data(using: .utf8)!
        try bad.write(to: store.url)
        XCTAssertThrowsError(try store.load()) { error in
            guard let storeError = error as? AppDataStoreError else {
                XCTFail("expected AppDataStoreError, got \(error)")
                return
            }
            guard case .schemaInvalid = storeError else {
                XCTFail("expected .schemaInvalid, got \(storeError)")
                return
            }
        }
    }

    func testBackupCreatesSiblingFile() throws {
        let store = JSONFileAppDataStore(directory: tempDir, filename: "primary.json")
        try store.save(try makeAppData())
        let backupURL = try store.backup()
        XCTAssertTrue(FileManager.default.fileExists(atPath: backupURL.path))
        XCTAssertEqual(backupURL.deletingLastPathComponent(), store.url.deletingLastPathComponent())
        XCTAssertTrue(backupURL.lastPathComponent.contains("primary.json.backup-"))
    }

    func testBackupOnMissingPrimaryThrowsBackupFailed() {
        let store = JSONFileAppDataStore(directory: tempDir, filename: "ghost.json")
        XCTAssertThrowsError(try store.backup()) { error in
            guard let storeError = error as? AppDataStoreError else {
                XCTFail("expected AppDataStoreError, got \(error)")
                return
            }
            guard case .backupFailed = storeError else {
                XCTFail("expected .backupFailed, got \(storeError)")
                return
            }
        }
    }

    // MARK: - Helpers

    private func makeAppData() throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
            .init(key: "history", value: .array([])),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }
}
