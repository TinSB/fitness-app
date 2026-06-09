// M1-1 验收核心：编解码一份样例 AppData 不丢未知字段（系统逻辑 §3 open-bag preserving）。
// 合同是语义等值（键和值全保留），不是字节级 parity——后者已随 legacy 退役。

import Foundation
import XCTest
@testable import RedeDomain

final class OpenBagRoundTripTests: XCTestCase {
    private func roundTrip(_ appData: AppData) throws -> AppData {
        let encoded = try JSONEncoder().encode(appData)
        return try JSONDecoder().decode(AppData.self, from: encoded)
    }

    func testSampleRoundTripIsSemanticallyIdentical() throws {
        let original = try TestSupport.loadSampleAppData()
        let reborn = try roundTrip(original)
        XCTAssertEqual(reborn.storage, original.storage)
    }

    func testUnknownKeysSurviveAtEveryLevel() throws {
        let reborn = try roundTrip(try TestSupport.loadSampleAppData())

        // 顶层未知键（含嵌套结构与显式 null）
        XCTAssertEqual(
            reborn.storage["futureTopLevelKey"],
            .object(["nested": .array([.int(1), .double(2.5), .string("three"), .null, .bool(true)])])
        )
        XCTAssertEqual(reborn.storage["activeSession"], .null)
        XCTAssertEqual(
            reborn.storage["templates"],
            .array([.object(["id": .string("tpl-1"), "unpromotedTemplateKey": .string("kept")])])
        )

        // profile / program 层未知键
        XCTAssertEqual(reborn.userProfile.storage["futureProfileKey"], .string("kept-verbatim"))
        XCTAssertEqual(reborn.programTemplate.storage["futureProgramKey"], .int(42))
        XCTAssertEqual(reborn.programTemplate.storage["correctionStrategy"], .object(["opaque": .bool(true)]))

        // session / exercise / set 层未知键
        let session = try XCTUnwrap(reborn.history.first)
        XCTAssertEqual(session.storage["futureSessionKey"], .object(["deep": .string("kept")]))
        let exercise = try XCTUnwrap(session.exercises.first)
        XCTAssertEqual(exercise.storage["futureExerciseKey"], .array([.bool(true), .bool(false)]))
        let set = try XCTUnwrap(exercise.sets.first)
        XCTAssertEqual(set.storage["futureSetKey"], .string("kept-at-set-level"))
    }

    func testNonObjectHistoryElementIsPreservedVerbatim() throws {
        // 类型化视图跳过非对象元素，但 storage 必须原样保留它。
        let reborn = try roundTrip(try TestSupport.loadSampleAppData())
        let rawHistory = try XCTUnwrap(reborn.storage["history"]?.asArray)
        XCTAssertEqual(rawHistory.count, 2)
        XCTAssertEqual(rawHistory.last, .string("history-array-keeps-non-object-elements-verbatim"))
        XCTAssertEqual(reborn.history.count, 1)
    }

    func testPolymorphicRirIsPreservedEvenWhenNotPromotable() throws {
        // legacy 数据里 rir 可能是字符串：类型化视图给 nil，storage 原样保留。
        let reborn = try roundTrip(try TestSupport.loadSampleAppData())
        let sets = try XCTUnwrap(reborn.history.first?.exercises.first?.sets)
        XCTAssertEqual(sets[1].rir, nil)
        XCTAssertEqual(sets[1].storage["rir"], .string("legacy-string-rir"))
    }
}
