// 通知偏好写入合同（FR-NT1/2）：applyNotificationPreferences open-bag 加性合并 notifications 容器，
// 缺=关、不 seed、其余顶层键原样保留、落盘可回读。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

final class NotificationPreferenceWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-notif-write-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }

    func testDefaultsOffWhenAbsent() throws {
        try Data(#"{"schemaVersion": 11}"#.utf8).write(to: fileURL)
        let appData = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertFalse(appData.notificationRestEndEnabled, "缺=关")
        XCTAssertFalse(appData.notificationWeeklyEnabled, "缺=关")
    }

    func testEnableOnEmptyStorePersistsAndReadsBack() throws {
        let result = try makeWriter().applyNotificationPreferences(restEndEnabled: true, weeklyEnabled: false)
        XCTAssertTrue(result.notificationRestEndEnabled)
        XCTAssertFalse(result.notificationWeeklyEnabled)
        XCTAssertEqual(result.schemaVersion, SchemaVersion.current, "纯加性，不动 schema")
        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertTrue(onDisk.notificationRestEndEnabled, "落盘可回读")
    }

    func testTogglePreservesOtherDataAndKeys() throws {
        let existing = #"""
        {"schemaVersion": 11, "futureKey": 7,
         "notifications": {"restEndEnabled": true, "weeklyEnabled": false},
         "history": [{"id": "a"}], "userProfile": {"name": "样例"}}
        """#
        try Data(existing.utf8).write(to: fileURL)
        let result = try makeWriter().applyNotificationPreferences(restEndEnabled: true, weeklyEnabled: true)
        XCTAssertTrue(result.notificationRestEndEnabled)
        XCTAssertTrue(result.notificationWeeklyEnabled, "翻开每周")
        XCTAssertEqual(result.history.first?.id, "a", "历史保全")
        XCTAssertEqual(result.userProfile.name, "样例", "profile 保全")
        XCTAssertEqual(result.storage["futureKey"]?.asInt, 7, "open-bag 未知键保全")
    }

    func testDisableWritesFalse() throws {
        try Data(#"{"schemaVersion": 11, "notifications": {"restEndEnabled": true, "weeklyEnabled": true}}"#.utf8).write(to: fileURL)
        let result = try makeWriter().applyNotificationPreferences(restEndEnabled: false, weeklyEnabled: false)
        XCTAssertFalse(result.notificationRestEndEnabled, "可关回")
        XCTAssertFalse(result.notificationWeeklyEnabled)
    }
}
