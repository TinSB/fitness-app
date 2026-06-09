// schemaVersion 守卫合同（Master Architecture: No schema bump unless explicitly approved）。
// 守的不是数字本身，而是「不静默升级、不静默吞下未来版本」。

import Foundation
import XCTest
@testable import RedeDomain

final class SchemaVersionGuardTests: XCTestCase {
    private func decodeAppData(_ json: String) throws -> AppData {
        try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
    }

    func testCurrentSchemaVersionIsEight() {
        // 沿用 legacy 导出口径（开门设计）；bump 必须显式过架构批准并改这条测试。
        XCTAssertEqual(SchemaVersion.current, 8)
    }

    func testExactMatchDecodes() throws {
        let appData = try decodeAppData(#"{"schemaVersion": 8}"#)
        XCTAssertEqual(appData.schemaVersion, 8)
    }

    func testOlderVersionThrowsUpgradeRequired() {
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": 7}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .upgradeRequired(found: 7))
        }
    }

    func testNewerVersionThrowsFutureIncompatible() {
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": 9}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .futureIncompatible(found: 9))
        }
    }

    func testMissingVersionThrows() {
        XCTAssertThrowsError(try decodeAppData(#"{"history": []}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .missing)
        }
    }

    func testNonIntegerVersionThrows() {
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": "8"}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .notAnInteger)
        }
    }

    func testIntegralFloatLiteralDecodes() throws {
        // 老导出若写 8.0：Foundation 解码为 .int(8)，守卫必须放行。
        // 此行为依赖工具链——这条测试是它的回归保护。
        let appData = try decodeAppData(#"{"schemaVersion": 8.0}"#)
        XCTAssertEqual(appData.schemaVersion, 8)
    }

    func testFractionalVersionThrowsNotAnInteger() {
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": 8.5}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .notAnInteger)
        }
    }

    func testNegativeVersionThrowsUpgradeRequired() {
        XCTAssertThrowsError(try decodeAppData(#"{"schemaVersion": -1}"#)) { error in
            XCTAssertEqual(error as? SchemaVersion.ValidationError, .upgradeRequired(found: -1))
        }
    }
}
