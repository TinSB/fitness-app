// M3-3：真 DataHealth 写入 gate（M1-2 写闸的注入 seam 终于接上真实现）。
// 合同：写入不得让 clean 视图丢 session；新增的 raw session 必须能通过净化
//（不许把 DataHealth 会丢弃的垃圾写进 canonical）。

import Foundation
import XCTest
import RedeDomain
@testable import RedeDataHealth

final class CanonicalWriteValidationTests: XCTestCase {
    private func appData(_ json: String) throws -> AppData {
        try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
    }

    func testValidAppendPasses() throws {
        let current = try appData(#"{"schemaVersion": 8, "history": [{"id": "a", "date": "2026-06-07", "completed": true}]}"#)
        let candidate = try appData(#"{"schemaVersion": 8, "history": [{"id": "a", "date": "2026-06-07", "completed": true}, {"id": "b", "date": "2026-06-09", "completed": true, "exercises": []}]}"#)
        XCTAssertNoThrow(try CanonicalWriteValidation.validate(candidate: candidate, replacing: current))
    }

    func testFirstWritePassesWithNilCurrent() throws {
        let candidate = try appData(#"{"schemaVersion": 8, "history": [{"id": "a", "date": "2026-06-09", "completed": true}]}"#)
        XCTAssertNoThrow(try CanonicalWriteValidation.validate(candidate: candidate, replacing: nil))
    }

    func testLosingCleanSessionIsRejected() throws {
        let current = try appData(#"{"schemaVersion": 8, "history": [{"id": "a", "date": "2026-06-07", "completed": true}]}"#)
        let candidate = try appData(#"{"schemaVersion": 8, "history": []}"#)
        XCTAssertThrowsError(try CanonicalWriteValidation.validate(candidate: candidate, replacing: current)) { error in
            XCTAssertEqual(error as? CanonicalWriteValidation.ValidationError, .cleanSessionLost(id: "a"))
        }
    }

    func testAppendingUncleanSessionIsRejected() throws {
        let current = try appData(#"{"schemaVersion": 8, "history": []}"#)
        // 新 session 缺 date → DataHealth 会丢弃 → 不许写入
        let candidate = try appData(#"{"schemaVersion": 8, "history": [{"id": "b", "completed": true}]}"#)
        XCTAssertThrowsError(try CanonicalWriteValidation.validate(candidate: candidate, replacing: current)) { error in
            XCTAssertEqual(error as? CanonicalWriteValidation.ValidationError, .newSessionWouldBeDropped(id: "b"))
        }
    }

    func testNewNilIdGarbageEntryIsRejected() throws {
        let current = try appData(#"{"schemaVersion": 8, "history": []}"#)
        let candidate = try appData(#"{"schemaVersion": 8, "history": [{"completed": true, "date": "2026-06-09"}]}"#)
        XCTAssertThrowsError(try CanonicalWriteValidation.validate(candidate: candidate, replacing: current)) { error in
            XCTAssertEqual(error as? CanonicalWriteValidation.ValidationError, .newSessionWouldBeDropped(id: nil))
        }
    }

    func testUnknownFieldsDoNotBlockValidation() throws {
        let current = try appData(#"{"schemaVersion": 8, "futureKey": 1, "history": [{"id": "a", "date": "2026-06-07", "completed": true}]}"#)
        let candidate = try appData(#"{"schemaVersion": 8, "futureKey": 1, "history": [{"id": "a", "date": "2026-06-07", "completed": true}, {"id": "b", "date": "2026-06-09", "completed": true, "skippedSets": [{"setIndex": 1}]}]}"#)
        XCTAssertNoThrow(try CanonicalWriteValidation.validate(candidate: candidate, replacing: current))
    }
}
