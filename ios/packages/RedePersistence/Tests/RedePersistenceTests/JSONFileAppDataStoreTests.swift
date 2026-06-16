// JSONFileAppDataStore 合同：load 缺文件给 nil、坏文件如实抛错；
// save 原子写入；backupExisting 在覆盖前留下旧版本副本。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

final class JSONFileAppDataStoreTests: XCTestCase {
    private var directory: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-store-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeStore() -> JSONFileAppDataStore {
        JSONFileAppDataStore(fileURL: directory.appendingPathComponent("app-data.json"))
    }

    func testLoadReturnsNilWhenFileMissing() throws {
        XCTAssertNil(try makeStore().load())
    }

    func testSaveThenLoadRoundTrips() throws {
        let store = makeStore()
        let appData = try JSONDecoder().decode(
            AppData.self,
            from: Data(#"{"schemaVersion": 8, "unknownKey": "kept"}"#.utf8)
        )
        try store.save(appData)
        let loaded = try XCTUnwrap(try store.load())
        XCTAssertEqual(loaded.storage, appData.storage)
    }

    func testLoadThrowsUnreadableOnCorruptFile() throws {
        let store = makeStore()
        try Data("not-json{{{".utf8).write(to: directory.appendingPathComponent("app-data.json"))
        XCTAssertThrowsError(try store.load()) { error in
            guard case AppDataStoreError.unreadable = error else {
                return XCTFail("expected .unreadable, got \(error)")
            }
        }
    }

    func testBackupExistingReturnsNilWhenNothingToBackUp() throws {
        XCTAssertNil(try makeStore().backupExisting())
    }

    func testBackupExistingCopiesPreviousBytesBeforeOverwrite() throws {
        let store = makeStore()
        let fileURL = directory.appendingPathComponent("app-data.json")
        let originalBytes = Data(#"{"schemaVersion": 8, "marker": "v1"}"#.utf8)
        try originalBytes.write(to: fileURL)

        let backupURL = try XCTUnwrap(try store.backupExisting())
        XCTAssertTrue(backupURL.lastPathComponent.hasPrefix("app-data.json.backup-"))
        XCTAssertEqual(try Data(contentsOf: backupURL), originalBytes)

        // 备份后覆盖主文件，备份内容必须仍是旧版本。
        let next = try JSONDecoder().decode(
            AppData.self,
            from: Data(#"{"schemaVersion": 8, "marker": "v2"}"#.utf8)
        )
        try store.save(next)
        XCTAssertEqual(try Data(contentsOf: backupURL), originalBytes)
    }

    // MARK: schema 迁移（系统逻辑 §6.5）——读路径迁移先于 validate、纯内存不碰盘

    func testLoadMigratesLegacyV8FileToCurrent() throws {
        let store = makeStore()
        let fileURL = directory.appendingPathComponent("app-data.json")
        let legacy = #"{"schemaVersion": 8, "history": [{"id": "s1", "completed": true, "date": "2026-06-01"}], "userProfile": {"trainingLevel": "advanced"}}"#
        try Data(legacy.utf8).write(to: fileURL)

        let loaded = try XCTUnwrap(try store.load())
        XCTAssertEqual(loaded.schemaVersion, 10, "磁盘 v8 经 load 升 10")
        XCTAssertEqual(loaded.mesocycle.enabled, false, "迁移播种默认关闭 = 零回归")
        XCTAssertEqual(loaded.mesocycle.blockLengthWeeks, 4)
        XCTAssertEqual(loaded.history.first?.id, "s1", "既有历史无损")
        XCTAssertEqual(loaded.userProfile.trainingLevel, "advanced", "既有 profile 无损")
    }

    func testLoadDoesNotRewriteFileOnDisk() throws {
        // 数据安全红线：读永不改盘——迁移只在内存里，磁盘 v8 原文保留（可从备份/原文恢复）。
        let store = makeStore()
        let fileURL = directory.appendingPathComponent("app-data.json")
        let legacyBytes = Data(#"{"schemaVersion": 8, "history": []}"#.utf8)
        try legacyBytes.write(to: fileURL)

        _ = try store.load()
        XCTAssertEqual(try Data(contentsOf: fileURL), legacyBytes, "load 不得改写磁盘文件")
    }

    func testSaveToUnwritableLocationThrowsHonestly() throws {
        let store = JSONFileAppDataStore(
            fileURL: URL(fileURLWithPath: "/nonexistent-root/sub/app-data.json")
        )
        let appData = try JSONDecoder().decode(AppData.self, from: Data(#"{"schemaVersion": 8}"#.utf8))
        XCTAssertThrowsError(try store.save(appData)) { error in
            guard case AppDataStoreError.writeFailed = error else {
                return XCTFail("expected .writeFailed, got \(error)")
            }
        }
    }
}
