// 计划调整写入合同（FR-PL3/4）：采纳在同一写闸同步 program/profile 天数并 append history；
// history 最多 20 条；回滚 LIFO 同步恢复两处 before；旧单字段只兼容读、任何新写都停写旧字段。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

final class PlanAdjustmentWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-pladj-write-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }

    private func writeJSONObject(_ object: [String: Any]) throws {
        try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]).write(to: fileURL)
    }

    func testApplySynchronizesProgramAndProfileAndAppendsHistory() throws {
        let existing = #"""
        {"schemaVersion": 11, "futureKey": 9,
         "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 4},
         "history": [{"id": "a"}], "userProfile": {"name": "样例", "weeklyTrainingDays": 4}}
        """#
        try Data(existing.utf8).write(to: fileURL)
        let result = try makeWriter().applyFrequencyAdjustment(
            kind: "reduceFrequency", fromDaysPerWeek: 4, toDaysPerWeek: 2
        )
        XCTAssertEqual(result.programTemplate.daysPerWeek, 2, "周计划改到 2")
        XCTAssertEqual(result.userProfile.weeklyTrainingDays, 2, "档案频率与 program 同事务同步")
        XCTAssertEqual(result.programTemplate.splitType, "push-pull-legs", "不丢 splitType")
        XCTAssertEqual(result.planAdjustmentHistory, [
            PlanAdjustmentRecord(
                kind: "reduceFrequency", fromDaysPerWeek: 4, toDaysPerWeek: 2,
                fromProfileWeeklyTrainingDays: 4, toProfileWeeklyTrainingDays: 2
            ),
        ])
        XCTAssertNil(result.storage["planAdjustment"], "写侧必须停写并清除旧单字段")
        XCTAssertEqual(result.schemaVersion, SchemaVersion.current, "纯加性、不动 schema")
        XCTAssertEqual(result.history.first?.id, "a", "历史保全")
        XCTAssertEqual(result.userProfile.name, "样例", "profile 保全")
        XCTAssertEqual(result.storage["futureKey"]?.asInt, 9, "open-bag 未知键保全")
    }

    func testReduceThenIncreaseAndTwoRollbacksRestoreEachLayerLIFO() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"splitType":"full-body","daysPerWeek":5},
          "userProfile": {"weeklyTrainingDays":5}
        }
        """#.utf8).write(to: fileURL)
        let writer = makeWriter()
        let reduced = try writer.applyFrequencyAdjustment(
            kind: "reduceFrequency", fromDaysPerWeek: 5, toDaysPerWeek: 3
        )
        XCTAssertEqual(reduced.planAdjustmentHistory, [
            PlanAdjustmentRecord(
                kind: "reduceFrequency", fromDaysPerWeek: 5, toDaysPerWeek: 3,
                fromProfileWeeklyTrainingDays: 5, toProfileWeeklyTrainingDays: 3
            ),
        ])

        let adopted = try writer.applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 5
        )
        XCTAssertEqual(adopted.planAdjustmentHistory, [
            PlanAdjustmentRecord(
                kind: "reduceFrequency", fromDaysPerWeek: 5, toDaysPerWeek: 3,
                fromProfileWeeklyTrainingDays: 5, toProfileWeeklyTrainingDays: 3
            ),
            PlanAdjustmentRecord(
                kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 5,
                fromProfileWeeklyTrainingDays: 3, toProfileWeeklyTrainingDays: 5
            ),
        ], "先降频、再增频，两次真实采纳都必须逐层入栈")
        XCTAssertNil(adopted.storage["planAdjustment"])
        XCTAssertEqual(adopted.programTemplate.splitType, "full-body",
                       "计划调整本身只改天数，不重算分化")

        let firstUndo = try writer.rollbackPlanAdjustment()
        XCTAssertEqual(firstUndo.programTemplate.daysPerWeek, 3)
        XCTAssertEqual(firstUndo.userProfile.weeklyTrainingDays, 3)
        XCTAssertEqual(firstUndo.planAdjustmentHistory, [
            PlanAdjustmentRecord(
                kind: "reduceFrequency", fromDaysPerWeek: 5, toDaysPerWeek: 3,
                fromProfileWeeklyTrainingDays: 5, toProfileWeeklyTrainingDays: 3
            ),
        ])

        let secondUndo = try writer.rollbackPlanAdjustment()
        XCTAssertEqual(secondUndo.programTemplate.daysPerWeek, 5)
        XCTAssertEqual(secondUndo.userProfile.weeklyTrainingDays, 5)
        XCTAssertEqual(secondUndo.planAdjustmentHistory, [], "逐层 pop 后栈归空")
    }

    func testLegacyRecordBecomesFirstHistoryLayerOnNextAdoption() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":3},
          "planAdjustment": {
            "kind":"reduceFrequency","fromDaysPerWeek":5,"toDaysPerWeek":3
          }
        }
        """#.utf8).write(to: fileURL)

        let result = try makeWriter().applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 5
        )

        XCTAssertEqual(result.planAdjustmentHistory, [
            PlanAdjustmentRecord(kind: "reduceFrequency", fromDaysPerWeek: 5, toDaysPerWeek: 3),
            PlanAdjustmentRecord(
                kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 5,
                fromProfileWeeklyTrainingDays: 3, toProfileWeeklyTrainingDays: 5
            ),
        ], "legacy 单记录只在本次真实采纳时成为新栈的第一层")
        XCTAssertNil(result.storage["planAdjustment"])
    }

    func testHistoryKeepsOnlyNewestTwentyRecords() throws {
        let oldRecords: [[String: Any]] = (0..<20).map { index in
            index.isMultiple(of: 2)
                ? ["kind": "reduceFrequency", "fromDaysPerWeek": 5, "toDaysPerWeek": 3]
                : ["kind": "increaseFrequency", "fromDaysPerWeek": 3, "toDaysPerWeek": 5]
        }
        try writeJSONObject([
            "schemaVersion": 11,
            "programTemplate": ["daysPerWeek": 2],
            "userProfile": ["weeklyTrainingDays": 2],
            "planAdjustmentHistory": oldRecords,
        ])

        let result = try makeWriter().applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 2, toDaysPerWeek: 3
        )

        XCTAssertEqual(result.planAdjustmentHistory.count, 20)
        XCTAssertEqual(result.planAdjustmentHistory.first?.fromDaysPerWeek, 3,
                       "第 21 条进入后丢最旧的 reduce，原 index 1 成为栈底")
        XCTAssertEqual(result.planAdjustmentHistory.last,
                       PlanAdjustmentRecord(
                           kind: "increaseFrequency", fromDaysPerWeek: 2, toDaysPerWeek: 3,
                           fromProfileWeeklyTrainingDays: 2, toProfileWeeklyTrainingDays: 3
                       ))
    }

    func testRollbackRestoresRecordedBeforeEvenAfterAnotherPathChangedBothDays() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":4},
          "userProfile": {"weeklyTrainingDays":4}
        }
        """#.utf8).write(to: fileURL)
        let writer = makeWriter()
        _ = try writer.applyFrequencyAdjustment(
            kind: "reduceFrequency", fromDaysPerWeek: 4, toDaysPerWeek: 2
        )

        var object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(contentsOf: fileURL)) as? [String: Any]
        )
        var program = try XCTUnwrap(object["programTemplate"] as? [String: Any])
        var profile = try XCTUnwrap(object["userProfile"] as? [String: Any])
        program["daysPerWeek"] = 6
        profile["weeklyTrainingDays"] = 6
        object["programTemplate"] = program
        object["userProfile"] = profile
        try writeJSONObject(object)

        let rolled = try writer.rollbackPlanAdjustment()
        XCTAssertEqual(rolled.programTemplate.daysPerWeek, 4,
                       "不做三方合并，严格恢复该层记录的 before")
        XCTAssertEqual(rolled.userProfile.weeklyTrainingDays, 4)
        XCTAssertEqual(rolled.planAdjustmentHistory, [])
    }

    func testRollbackRestoresProgramAndProfileFromTheirOwnRecordedBeforeValues() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":5}
        }
        """#.utf8).write(to: fileURL)
        let writer = makeWriter()

        let adopted = try writer.applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 4
        )
        let record = try XCTUnwrap(adopted.planAdjustmentHistory.last)
        XCTAssertEqual(record.fromDaysPerWeek, 3)
        XCTAssertEqual(record.toDaysPerWeek, 4)
        XCTAssertEqual(record.fromProfileWeeklyTrainingDays, 5,
                       "新记录必须独立保存 profile 的真实 before")
        XCTAssertEqual(record.toProfileWeeklyTrainingDays, 4)

        let rolled = try writer.rollbackPlanAdjustment()
        XCTAssertEqual(rolled.programTemplate.daysPerWeek, 3)
        XCTAssertEqual(rolled.userProfile.weeklyTrainingDays, 5,
                       "撤销必须逐字段恢复，不能把 program before 同时写给 profile")
    }

    func testRollbackRestoresMissingProfileDayKeyFromExplicitNullSnapshot() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"name":"样例"}
        }
        """#.utf8).write(to: fileURL)
        let writer = makeWriter()

        let adopted = try writer.applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 4
        )
        let record = try XCTUnwrap(adopted.planAdjustmentHistory.last)
        XCTAssertTrue(record.hasExplicitProfileDaysSnapshot)
        XCTAssertNil(record.fromProfileWeeklyTrainingDays)

        let rolled = try writer.rollbackPlanAdjustment()
        XCTAssertNil(rolled.userProfile.weeklyTrainingDays,
                     "新记录的 explicit null before 必须恢复为缺键，不能按 program 值猜")
        XCTAssertEqual(rolled.userProfile.name, "样例")
    }

    func testApplyAndRollbackPreserveProfileBeforeAtCleanRangeUpperBound() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":14}
        }
        """#.utf8).write(to: fileURL)
        let writer = makeWriter()

        let adopted = try writer.applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 5
        )
        XCTAssertEqual(adopted.planAdjustmentHistory.count, 1,
                       "writer 自己写出的 profile before=14 必须可重载为有效撤销层")
        XCTAssertEqual(
            adopted.planAdjustmentHistory.last?.fromProfileWeeklyTrainingDays,
            14
        )

        let rolled = try writer.rollbackPlanAdjustment()
        XCTAssertEqual(rolled.programTemplate.daysPerWeek, 3)
        XCTAssertEqual(rolled.userProfile.weeklyTrainingDays, 14)
    }

    func testApplyCanMoveCleanCurrentProgramOutsideTargetRangeBackIntoTwoThroughSix() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":7},
          "userProfile": {"weeklyTrainingDays":7}
        }
        """#.utf8).write(to: fileURL)

        let adopted = try makeWriter().applyFrequencyAdjustment(
            kind: "reduceFrequency", fromDaysPerWeek: 7, toDaysPerWeek: 6
        )

        XCTAssertEqual(adopted.programTemplate.daysPerWeek, 6)
        XCTAssertEqual(adopted.planAdjustmentHistory.last?.fromDaysPerWeek, 7)
        XCTAssertEqual(try makeWriter().rollbackPlanAdjustment().programTemplate.daysPerWeek, 7)
    }

    func testApplyRejectsNonObjectProgramOrProfileWithoutTouchingCanonicalBytes() throws {
        let profileBroken = Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": "broken"
        }
        """#.utf8)
        try profileBroken.write(to: fileURL)
        XCTAssertThrowsError(try makeWriter().applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 4
        )) {
            XCTAssertEqual($0 as? PlanAdjustmentWriteError, .userProfileNotObject)
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), profileBroken)

        let programBroken = Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": 3,
          "userProfile": {"weeklyTrainingDays":3}
        }
        """#.utf8)
        try programBroken.write(to: fileURL)
        XCTAssertThrowsError(try makeWriter().applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 4
        )) {
            XCTAssertEqual($0 as? PlanAdjustmentWriteError, .programTemplateNotObject)
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), programBroken)
    }

    func testApplyRejectsDirtyExistingProfileDayWithoutTouchingCanonicalBytes() throws {
        for dirtyProfileDay in ["\"3\"", "99", "null"] {
            let original = Data("""
            {
              "schemaVersion": 11,
              "programTemplate": {"daysPerWeek":3},
              "userProfile": {"weeklyTrainingDays":\(dirtyProfileDay)}
            }
            """.utf8)
            try original.write(to: fileURL)

            XCTAssertThrowsError(try makeWriter().applyFrequencyAdjustment(
                kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 4
            )) {
                XCTAssertEqual($0 as? PlanAdjustmentWriteError, .invalidProfileDays)
            }
            XCTAssertEqual(try Data(contentsOf: fileURL), original)
        }
    }

    func testApplyRejectsNonArrayHistoryWithoutTouchingCanonicalBytes() throws {
        let original = Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":3},
          "planAdjustmentHistory": {"not":"an array"}
        }
        """#.utf8)
        try original.write(to: fileURL)

        XCTAssertThrowsError(try makeWriter().applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 4
        )) {
            XCTAssertEqual($0 as? PlanAdjustmentWriteError, .historyNotArray)
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), original)
    }

    func testApplyRejectsInvalidOrStaleAdjustmentWithoutTouchingCanonicalBytes() throws {
        let original = Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":3}
        }
        """#.utf8)
        try original.write(to: fileURL)
        let writer = makeWriter()

        XCTAssertThrowsError(try writer.applyFrequencyAdjustment(
            kind: "unknown", fromDaysPerWeek: 3, toDaysPerWeek: 4
        )) {
            XCTAssertEqual($0 as? PlanAdjustmentWriteError, .unknownKind("unknown"))
        }
        XCTAssertThrowsError(try writer.applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 14
        )) {
            XCTAssertEqual($0 as? PlanAdjustmentWriteError, .invalidDays(14))
        }
        XCTAssertThrowsError(try writer.applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 4, toDaysPerWeek: 5
        )) {
            XCTAssertEqual(
                $0 as? PlanAdjustmentWriteError,
                .staleFromDays(expected: 4, actual: 3)
            )
        }
        XCTAssertThrowsError(try writer.applyFrequencyAdjustment(
            kind: "reduceFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 4
        )) {
            XCTAssertEqual(
                $0 as? PlanAdjustmentWriteError,
                .invalidDirection(kind: "reduceFrequency", from: 3, to: 4)
            )
        }
        XCTAssertThrowsError(try writer.applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 3
        )) {
            XCTAssertEqual(
                $0 as? PlanAdjustmentWriteError,
                .invalidDirection(kind: "increaseFrequency", from: 3, to: 3)
            )
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), original,
                       "所有非法请求都必须在 backup/save 前 fail closed")
    }

    func testApplyAndRollbackPreserveRawHistoryUnknownFieldsAndDirtySiblings() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":3},
          "planAdjustmentHistory": [
            {
              "kind":"reduceFrequency",
              "fromDaysPerWeek":5,
              "toDaysPerWeek":3,
              "futureKey":{"keep":true}
            },
            "dirty-sibling"
          ]
        }
        """#.utf8).write(to: fileURL)
        let writer = makeWriter()

        _ = try writer.applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 5
        )
        var raw = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(contentsOf: fileURL)) as? [String: Any]
        )
        var history = try XCTUnwrap(raw["planAdjustmentHistory"] as? [Any])
        XCTAssertEqual(history.count, 3)
        XCTAssertEqual(
            ((history[0] as? [String: Any])?["futureKey"] as? [String: Bool])?["keep"],
            true,
            "append 不得重编码旧层并丢 futureKey"
        )
        XCTAssertEqual(history[1] as? String, "dirty-sibling",
                       "append 不得顺手清掉未触碰的脏 sibling")

        _ = try writer.rollbackPlanAdjustment()
        raw = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(contentsOf: fileURL)) as? [String: Any]
        )
        history = try XCTUnwrap(raw["planAdjustmentHistory"] as? [Any])
        XCTAssertEqual(history.count, 2, "rollback 只移除最后一个有效层")
        XCTAssertEqual(
            ((history[0] as? [String: Any])?["futureKey"] as? [String: Bool])?["keep"],
            true
        )
        XCTAssertEqual(history[1] as? String, "dirty-sibling")

        _ = try writer.rollbackPlanAdjustment()
        raw = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(contentsOf: fileURL)) as? [String: Any]
        )
        history = try XCTUnwrap(raw["planAdjustmentHistory"] as? [Any])
        XCTAssertEqual(history.count, 1,
                       "栈尾是脏 sibling 时，仍只移除其前方最后一个有效层")
        XCTAssertEqual(history[0] as? String, "dirty-sibling")
    }

    func testRollbackReadsLegacySingleRecordAndContractsItIntoEmptyHistory() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":3},
          "planAdjustment": {
            "kind":"reduceFrequency","fromDaysPerWeek":5,"toDaysPerWeek":3
          }
        }
        """#.utf8).write(to: fileURL)

        let rolled = try makeWriter().rollbackPlanAdjustment()

        XCTAssertEqual(rolled.programTemplate.daysPerWeek, 5)
        XCTAssertEqual(rolled.userProfile.weeklyTrainingDays, 5)
        XCTAssertEqual(rolled.planAdjustmentHistory, [])
        XCTAssertNil(rolled.storage["planAdjustment"], "真实撤销写入后停写旧字段")
    }

    func testRollbackReadsLegacyRecordFromFormerCleanRange() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":10},
          "userProfile": {"weeklyTrainingDays":10},
          "planAdjustment": {
            "kind":"reduceFrequency","fromDaysPerWeek":14,"toDaysPerWeek":10
          }
        }
        """#.utf8).write(to: fileURL)

        let rolled = try makeWriter().rollbackPlanAdjustment()

        XCTAssertEqual(rolled.programTemplate.daysPerWeek, 14)
        XCTAssertEqual(rolled.userProfile.weeklyTrainingDays, 14)
        XCTAssertEqual(rolled.planAdjustmentHistory, [])
        XCTAssertNil(rolled.storage["planAdjustment"])
    }

    func testRollbackTreatsPresentNonArrayHistoryAsTruthAndNoOp() throws {
        let original = Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":3},
          "planAdjustmentHistory": "dirty",
          "planAdjustment": {
            "kind":"reduceFrequency","fromDaysPerWeek":5,"toDaysPerWeek":3
          }
        }
        """#.utf8)
        try original.write(to: fileURL)

        let rolled = try makeWriter().rollbackPlanAdjustment()

        XCTAssertEqual(rolled.programTemplate.daysPerWeek, 3)
        XCTAssertEqual(try Data(contentsOf: fileURL), original,
                       "history 键存在就是读侧真源；类型脏时不唤醒 legacy、不触发保存")
    }

    func testRollbackRejectsNonObjectProgramOrProfileWithoutTouchingCanonicalBytes() throws {
        let history = #"""
          "planAdjustmentHistory": [
            {"kind":"increaseFrequency","fromDaysPerWeek":3,"toDaysPerWeek":5}
          ]
        """#
        let programBroken = Data("""
        {
          "schemaVersion": 11,
          "programTemplate": "broken",
          "userProfile": {"weeklyTrainingDays":5},
          \(history)
        }
        """.utf8)
        try programBroken.write(to: fileURL)
        XCTAssertThrowsError(try makeWriter().rollbackPlanAdjustment()) {
            XCTAssertEqual($0 as? PlanAdjustmentWriteError, .programTemplateNotObject)
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), programBroken)

        let profileBroken = Data("""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":5},
          "userProfile": "broken",
          \(history)
        }
        """.utf8)
        try profileBroken.write(to: fileURL)
        XCTAssertThrowsError(try makeWriter().rollbackPlanAdjustment()) {
            XCTAssertEqual($0 as? PlanAdjustmentWriteError, .userProfileNotObject)
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), profileBroken)
    }

    func testRollbackSkipsCorruptHistoryAndLeavesCanonicalBytesUntouched() throws {
        let original = Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":3},
          "planAdjustmentHistory": [
            {
              "kind":"unknown",
              "fromDaysPerWeek":4,
              "toDaysPerWeek":3
            },
            {
              "kind":"reduceFrequency",
              "fromDaysPerWeek":99,
              "toDaysPerWeek":3,
              "fromProfileWeeklyTrainingDays":99,
              "toProfileWeeklyTrainingDays":3
            }
          ]
        }
        """#.utf8)
        try original.write(to: fileURL)

        let rolled = try makeWriter().rollbackPlanAdjustment()

        XCTAssertEqual(rolled.programTemplate.daysPerWeek, 3)
        XCTAssertEqual(rolled.userProfile.weeklyTrainingDays, 3)
        XCTAssertEqual(rolled.planAdjustmentHistory, [],
                       "未知 kind / 越界 before 都不是可撤销层")
        XCTAssertEqual(try Data(contentsOf: fileURL), original,
                       "脏 history 无有效层时必须幂等，不把 99 写进 canonical")
    }

    func testRollbackWithoutHistoryIsIdempotent() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "programTemplate": {"daysPerWeek":3},
          "userProfile": {"weeklyTrainingDays":3}
        }
        """#.utf8).write(to: fileURL)
        let result = try makeWriter().rollbackPlanAdjustment()
        XCTAssertEqual(result.programTemplate.daysPerWeek, 3, "无记录 → 不动")
        XCTAssertEqual(result.userProfile.weeklyTrainingDays, 3)
        XCTAssertEqual(result.planAdjustmentHistory, [])
        XCTAssertNil(result.storage["planAdjustmentHistory"], "幂等 no-op 不制造空字段")
    }
}
