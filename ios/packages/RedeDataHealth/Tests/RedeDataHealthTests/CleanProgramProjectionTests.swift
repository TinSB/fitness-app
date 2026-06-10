// CleanProgram 投影（M2-1 增补）：裁决引擎的「计划结构」输入面。
// 与 profile 同规则：合法通过、越界置 nil 留痕、缺失不是错误。

import Foundation
import XCTest
import RedeDomain
@testable import RedeDataHealth

final class CleanProgramProjectionTests: XCTestCase {
    private func makeView(programJSON: String) throws -> CleanAppDataView {
        let json = "{\"schemaVersion\": 8, \"programTemplate\": \(programJSON)}"
        let appData = try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
        return CleanAppDataViewBuilder.build(from: appData)
    }

    func testValidProgramPassesThrough() throws {
        let view = try makeView(programJSON: #"{"daysPerWeek": 4, "splitType": "upper-lower", "primaryGoal": "hypertrophy"}"#)
        XCTAssertEqual(view.program.daysPerWeek, 4)
        XCTAssertEqual(view.program.splitType, "upper-lower")
        XCTAssertEqual(view.program.primaryGoal, "hypertrophy")
        XCTAssertTrue(view.issues.isEmpty)
    }

    func testOutOfRangeDaysPerWeekProjectsAsNilWithIssue() throws {
        let zero = try makeView(programJSON: #"{"daysPerWeek": 0}"#)
        XCTAssertNil(zero.program.daysPerWeek)
        XCTAssertEqual(zero.issues, [.programFieldIgnored(field: "daysPerWeek")])

        let fifteen = try makeView(programJSON: #"{"daysPerWeek": 15}"#)
        XCTAssertNil(fifteen.program.daysPerWeek)
        XCTAssertEqual(fifteen.issues, [.programFieldIgnored(field: "daysPerWeek")])
    }

    func testDaysPerWeekEndpointsPass() throws {
        XCTAssertEqual(try makeView(programJSON: #"{"daysPerWeek": 1}"#).program.daysPerWeek, 1)
        XCTAssertEqual(try makeView(programJSON: #"{"daysPerWeek": 14}"#).program.daysPerWeek, 14)
    }

    func testMissingProgramYieldsEmptyCleanProgramWithoutIssues() throws {
        let appData = try JSONDecoder().decode(AppData.self, from: Data(#"{"schemaVersion": 8}"#.utf8))
        let view = CleanAppDataViewBuilder.build(from: appData)
        XCTAssertNil(view.program.daysPerWeek)
        XCTAssertNil(view.program.splitType)
        XCTAssertTrue(view.issues.isEmpty)
    }
}
