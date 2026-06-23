// FR-PL6/PL7 自定义训练计划域层只读视图（切片 S1）：结构防御读 + open-bag 往返无损。
// 合法性（catalog/范围/日序排列）不在本层——本层只保证「脏数据不崩、空→nil、未知键不丢」。

import Foundation
import XCTest
@testable import RedeDomain

final class PlanCustomizationDomainTests: XCTestCase {
    private func appData(_ json: String) throws -> AppData {
        try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
    }

    func testNoContainerYieldsNil() throws {
        let data = try appData(#"{"schemaVersion": 11}"#)
        XCTAssertNil(data.planCustomization, "无容器 → nil（零行为回归）")
    }

    func testReadsOrderedDayPlanAndSequence() throws {
        let data = try appData(#"""
        {"schemaVersion": 11,
         "planCustomization": {
           "dayPlans": {"push-a": {"exercises": [
             {"exerciseId": "incline-db-press", "sets": 4, "repMin": 6, "repMax": 8, "rest": 120, "crossFamily": true},
             {"exerciseId": "cable-fly"}
           ]}},
           "daySequence": ["legs-a", "push-a", "pull-a"]
         }}
        """#)
        let custom = try XCTUnwrap(data.planCustomization)
        let day = try XCTUnwrap(custom.dayPlans["push-a"])
        XCTAssertEqual(day.exercises.map(\.exerciseId), ["incline-db-press", "cable-fly"], "保序")
        XCTAssertEqual(day.exercises.first?.sets, 4)
        XCTAssertEqual(day.exercises.first?.repMin, 6)
        XCTAssertEqual(day.exercises.first?.rest, 120)
        XCTAssertEqual(day.exercises.first?.crossFamily, true)
        XCTAssertNil(day.exercises.last?.sets, "缺可选字段 → nil（用引擎默认）")
        XCTAssertEqual(day.exercises.last?.crossFamily, false, "缺 crossFamily → false")
        XCTAssertEqual(custom.daySequence, ["legs-a", "push-a", "pull-a"])
    }

    func testDefensiveReadSkipsDirtyItemsAndEmptyDays() throws {
        let data = try appData(#"""
        {"schemaVersion": 11,
         "planCustomization": {
           "dayPlans": {
             "push-a": {"exercises": [
               {"exerciseId": "db-bench-press"},
               {"sets": 3},
               {"exerciseId": ""}
             ]},
             "pull-a": {"exercises": []},
             "legs-a": {"junk": 1}
           }
         }}
        """#)
        let custom = try XCTUnwrap(data.planCustomization)
        XCTAssertEqual(custom.dayPlans["push-a"]?.exercises.map(\.exerciseId), ["db-bench-press"], "脏 item（缺/空 id）跳过")
        XCTAssertNil(custom.dayPlans["pull-a"], "空清单的日丢弃")
        XCTAssertNil(custom.dayPlans["legs-a"], "无 exercises 的日丢弃")
    }

    func testAllEmptyYieldsNil() throws {
        let data = try appData(#"{"schemaVersion": 11, "planCustomization": {"dayPlans": {}}}"#)
        XCTAssertNil(data.planCustomization, "无任何有效覆盖 → nil")
    }

    func testOpenBagRoundTripPreservesUnknownKeys() throws {
        let json = #"""
        {"schemaVersion": 11, "futureKey": 9,
         "planCustomization": {
           "dayPlans": {"push-a": {"exercises": [{"exerciseId": "x", "weirdFutureField": 7}]}},
           "extraCustomField": "keep-me"
         }}
        """#
        let data = try appData(json)
        let encoded = try JSONEncoder().encode(data)
        let reDecoded = try JSONDecoder().decode(AppData.self, from: encoded)
        XCTAssertEqual(reDecoded.storage["futureKey"]?.asInt, 9, "顶层未知键保全")
        XCTAssertEqual(reDecoded.storage["planCustomization"]?.asObject?["extraCustomField"]?.asString, "keep-me", "容器内未知键保全")
        // 容器内 item 的未知字段保全
        let item = reDecoded.storage["planCustomization"]?.asObject?["dayPlans"]?.asObject?["push-a"]?
            .asObject?["exercises"]?.asArray?.first?.asObject
        XCTAssertEqual(item?["weirdFutureField"]?.asInt, 7, "item 内未知字段保全")
    }
}
