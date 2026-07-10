// M5-2 偏好写入合同（FR-SE1 单位 / M0-3 遗留语言持久化）：
// applyPreferences 是写闸新增 scalar 入口，open-bag 合并 userProfile，
// 乱值拒收（单位 ∈ kg/lb，语言 ∈ zh/en），nil = 不改动该项。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

final class PreferencesWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-prefs-write-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }

    func testWritesUnitAndLocaleWithTypedReadback() throws {
        let result = try makeWriter().applyPreferences(unitSystem: "lb", locale: "zh")
        XCTAssertEqual(result.userProfile.unitSystem, "lb")
        XCTAssertEqual(result.userProfile.locale, "zh")
        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(onDisk.userProfile.unitSystem, "lb")
    }

    func testNilLeavesFieldUntouchedAndMergePreservesUnknown() throws {
        let existing = #"""
        {"schemaVersion": 8, "futureKey": 1,
         "userProfile": {"name": "样例", "unitSystem": "lb", "trainingLevel": "beginner"}}
        """#
        try Data(existing.utf8).write(to: fileURL)
        let result = try makeWriter().applyPreferences(unitSystem: nil, locale: "en")
        XCTAssertEqual(result.userProfile.unitSystem, "lb")     // nil = 不动
        XCTAssertEqual(result.userProfile.locale, "en")
        XCTAssertEqual(result.userProfile.name, "样例")          // open-bag 保全
        XCTAssertEqual(result.userProfile.trainingLevel, "beginner")
        XCTAssertEqual(result.storage["futureKey"]?.asInt, 1)
    }

    func testRejectsUnknownValues() {
        XCTAssertThrowsError(try makeWriter().applyPreferences(unitSystem: "stone", locale: nil)) { error in
            XCTAssertEqual(error as? PreferencesWriteError, .unknownUnit("stone"))
        }
        XCTAssertThrowsError(try makeWriter().applyPreferences(unitSystem: nil, locale: "fr")) { error in
            XCTAssertEqual(error as? PreferencesWriteError, .unknownLocale("fr"))
        }
    }

    // MARK: - applySexPreference（批次 D 2026-07-09：激活 UserProfile 休眠字段）

    func testSexWriteReadbackAndExplicitClear() throws {
        let existing = #"""
        {"schemaVersion": 8, "futureKey": 1,
         "userProfile": {"name": "样例", "unitSystem": "lb"}}
        """#
        try Data(existing.utf8).write(to: fileURL)
        let written = try makeWriter().applySexPreference(sex: "female")
        XCTAssertEqual(written.userProfile.sex, "female")
        XCTAssertEqual(written.userProfile.unitSystem, "lb")     // open-bag 保全
        XCTAssertEqual(written.storage["futureKey"]?.asInt, 1)
        // nil = 显式清除（「暂不设置」——键移除，不留空串）
        let cleared = try makeWriter().applySexPreference(sex: nil)
        XCTAssertNil(cleared.userProfile.sex)
        XCTAssertNil(cleared.storage["userProfile"]?.asObject?["sex"])
        XCTAssertEqual(cleared.userProfile.name, "样例")
    }

    func testSexRejectsUnknownValue() {
        XCTAssertThrowsError(try makeWriter().applySexPreference(sex: "other")) { error in
            XCTAssertEqual(error as? PreferencesWriteError, .unknownSex("other"))
        }
    }
}
