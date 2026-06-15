// schemaVersion 守卫合同（Master Architecture: No schema bump unless explicitly approved）。
// 守的不是数字本身，而是「旧版本经已知迁移升级、无迁移路径的旧版本不静默升级、未来版本不静默吞下」。
// current = 9（周期化引擎落库）。迁移在 decode 边界先于 validate 编排（见 SchemaMigrator）。

import Foundation
import XCTest
@testable import RedeDomain

final class SchemaVersionGuardTests: XCTestCase {
    private func decodeAppData(_ json: String) throws -> AppData {
        try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
    }

    func testCurrentSchemaVersionIsNine() {
        // bump 必须显式过架构批准并改这条测试（8→9：Mesocycle FR-PL2 落库，owner 拍板）。
        XCTAssertEqual(SchemaVersion.current, 9)
    }

    func testExactMatchDecodes() throws {
        let appData = try decodeAppData(#"{"schemaVersion": 9}"#)
        XCTAssertEqual(appData.schemaVersion, 9)
    }

    func testMigratableOlderVersionUpgradesOnDecode() throws {
        // schema-8 有迁移路径 → decode 边界升级到 9 并播种 mesocycle（不再 unreadable）。
        let appData = try decodeAppData(#"{"schemaVersion": 8, "history": []}"#)
        XCTAssertEqual(appData.schemaVersion, 9, "8 经迁移升 9")
        XCTAssertEqual(appData.mesocycle.enabled, false, "迁移播种默认关闭")
        XCTAssertEqual(appData.mesocycle.blockLengthWeeks, 4)
        XCTAssertEqual(appData.history.count, 0, "既有数据保留")
    }

    func testUnmigratableOlderVersionThrowsUpgradeRequired() {
        // schema-7 无迁移路径 → 仍如实报 upgradeRequired，不凭空升级。
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": 7}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .upgradeRequired(found: 7))
        }
    }

    func testNewerVersionThrowsFutureIncompatible() {
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": 10}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .futureIncompatible(found: 10))
        }
    }

    func testMissingVersionThrows() {
        XCTAssertThrowsError(try decodeAppData(#"{"history": []}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .missing)
        }
    }

    func testNonIntegerVersionThrows() {
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": "9"}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .notAnInteger)
        }
    }

    func testIntegralFloatLiteralMigratesAndDecodes() throws {
        // 老导出若写 8.0：Foundation 解码为 .int(8)，经迁移升 9。
        // 此行为依赖工具链——这条测试是它的回归保护。
        let appData = try decodeAppData(#"{"schemaVersion": 8.0}"#)
        XCTAssertEqual(appData.schemaVersion, 9)
    }

    func testFractionalVersionThrowsNotAnInteger() {
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": 9.5}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .notAnInteger)
        }
    }

    func testNegativeVersionThrowsUpgradeRequired() {
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": -1}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .upgradeRequired(found: -1))
        }
    }
}
