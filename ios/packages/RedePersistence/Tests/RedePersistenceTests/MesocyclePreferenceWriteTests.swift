// 周期化开关写入合同（FR-PL2 enablement）：applyMesocyclePreference 是写闸新增 bool 入口，
// open-bag 合并 mesocycle.enabled，缺 blockLengthWeeks 补默认 4、有则不覆盖，其余键原样保留。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

final class MesocyclePreferenceWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-meso-write-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }

    func testEnableOnEmptyStoreBootstrapsMesocycle() throws {
        let result = try makeWriter().applyMesocyclePreference(enabled: true)
        XCTAssertTrue(result.mesocycle.enabled)
        XCTAssertEqual(result.mesocycle.blockLengthWeeks, 4, "缺则补默认块长")
        XCTAssertEqual(result.schemaVersion, 9)
        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertTrue(onDisk.mesocycle.enabled, "落盘可回读")
    }

    func testTogglePreservesExistingDataAndBlockLength() throws {
        let existing = #"""
        {"schemaVersion": 9, "futureKey": 1,
         "mesocycle": {"enabled": false, "blockLengthWeeks": 6, "blockStartISO": "2026-05-01"},
         "history": [{"id": "a", "completed": true}], "userProfile": {"name": "样例"}}
        """#
        try Data(existing.utf8).write(to: fileURL)
        let result = try makeWriter().applyMesocyclePreference(enabled: true)
        XCTAssertTrue(result.mesocycle.enabled, "翻为开启")
        XCTAssertEqual(result.mesocycle.blockLengthWeeks, 6, "不覆盖既有块长")
        XCTAssertEqual(result.mesocycle.blockStartISO, "2026-05-01", "不丢既有锚点（审查 Mi-1）")
        XCTAssertEqual(result.history.first?.id, "a", "历史保全")
        XCTAssertEqual(result.userProfile.name, "样例", "profile 保全")
        XCTAssertEqual(result.storage["futureKey"]?.asInt, 1, "open-bag 未知键保全")
    }

    func testDisableWritesFalse() throws {
        try Data(#"{"schemaVersion": 9, "mesocycle": {"enabled": true, "blockLengthWeeks": 4}}"#.utf8).write(to: fileURL)
        let result = try makeWriter().applyMesocyclePreference(enabled: false)
        XCTAssertFalse(result.mesocycle.enabled, "可关回")
        XCTAssertEqual(result.mesocycle.blockLengthWeeks, 4)
    }
}
