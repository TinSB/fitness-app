// 自定义训练计划写入合同（FR-PL6/PL7，切片 S5）：apply/remove 当日动作清单 + 日序；
// 回滚 = remove；幂等；open-bag 保全其它键 + 其他 dayCode；结构守卫拒空；无 schema bump。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

private final class PlanCustomizationStoreSpy: AppDataStore {
    var current: AppData?
    private(set) var backupCount = 0
    private(set) var saveCount = 0

    init(current: AppData?) {
        self.current = current
    }

    func load() throws -> AppData? {
        current
    }

    func save(_ appData: AppData) throws {
        saveCount += 1
        current = appData
    }

    func backupExisting() throws -> URL? {
        backupCount += 1
        return nil
    }
}

final class PlanCustomizationWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-plcustom-write-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }

    private func seed() throws {
        let existing = #"""
        {"schemaVersion": 11, "futureKey": 9,
         "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 6},
         "history": [{"id": "a"}], "userProfile": {"name": "样例"}}
        """#
        try Data(existing.utf8).write(to: fileURL)
    }

    private func rawDayPlan(in appData: AppData, dayCode: String) -> JSONValue? {
        appData.storage["planCustomization"]?
            .asObject?["dayPlans"]?
            .asObject?[dayCode]
    }

    private func deterministicBytes(of value: JSONValue) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(value)
    }

    func testApplyCustomDayPlanWritesOrderedListAndPreservesEverything() throws {
        try seed()
        let result = try makeWriter().applyCustomDayPlan(dayCode: "push-a", exercises: [
            CustomExerciseItem(exerciseId: "incline-db-press", sets: 4, repMin: 6, repMax: 8),
            CustomExerciseItem(exerciseId: "cable-fly"),
        ])
        let custom = try XCTUnwrap(result.planCustomization)
        let day = try XCTUnwrap(custom.dayPlans["push-a"])
        XCTAssertEqual(day.exercises.map(\.exerciseId), ["incline-db-press", "cable-fly"], "有序=训练顺序")
        XCTAssertEqual(day.exercises.first?.sets, 4)
        XCTAssertEqual(day.exercises.first?.repMin, 6)
        XCTAssertNil(day.exercises.last?.sets, "缺省可选字段=引擎默认（不写）")
        // 全保全
        XCTAssertEqual(result.schemaVersion, SchemaVersion.current, "纯加性、不动 schema")
        XCTAssertEqual(result.programTemplate.splitType, "push-pull-legs")
        XCTAssertEqual(result.history.first?.id, "a", "历史保全")
        XCTAssertEqual(result.userProfile.name, "样例", "profile 保全")
        XCTAssertEqual(result.storage["futureKey"]?.asInt, 9, "open-bag 未知键保全")
    }

    func testApplySecondDayPreservesFirstDay() throws {
        try seed()
        let writer = makeWriter()
        _ = try writer.applyCustomDayPlan(dayCode: "push-a", exercises: [CustomExerciseItem(exerciseId: "db-bench-press")])
        let result = try writer.applyCustomDayPlan(dayCode: "pull-a", exercises: [CustomExerciseItem(exerciseId: "seated-row")])
        XCTAssertEqual(result.planCustomization?.dayPlans["push-a"]?.exercises.first?.exerciseId, "db-bench-press", "其他 dayCode 不丢")
        XCTAssertEqual(result.planCustomization?.dayPlans["pull-a"]?.exercises.first?.exerciseId, "seated-row")
    }

    func testRemoveCustomDayPlanRestoresDefaultAndIsIdempotent() throws {
        try seed()
        let writer = makeWriter()
        _ = try writer.applyCustomDayPlan(dayCode: "push-a", exercises: [CustomExerciseItem(exerciseId: "db-bench-press")])
        _ = try writer.applyCustomDayPlan(dayCode: "pull-a", exercises: [CustomExerciseItem(exerciseId: "seated-row")])
        let removed = try writer.removeCustomDayPlan(dayCode: "push-a")
        XCTAssertNil(removed.planCustomization?.dayPlans["push-a"], "push-a 恢复默认（删覆盖）")
        XCTAssertNotNil(removed.planCustomization?.dayPlans["pull-a"], "pull-a 覆盖保留")
        // 幂等：删不存在的 dayCode 不报错、不改
        let again = try writer.removeCustomDayPlan(dayCode: "legs-a")
        XCTAssertNil(again.planCustomization?.dayPlans["legs-a"])
    }

    func testApplyAndRemoveCustomDaySequencePreservesDayPlans() throws {
        try seed()
        let writer = makeWriter()
        _ = try writer.applyCustomDayPlan(dayCode: "push-a", exercises: [CustomExerciseItem(exerciseId: "db-bench-press")])
        let applied = try writer.applyCustomDaySequence(["legs-a", "push-a", "pull-a"])
        XCTAssertEqual(applied.planCustomization?.daySequence, ["legs-a", "push-a", "pull-a"])
        let removed = try writer.removeCustomDaySequence()
        XCTAssertNil(removed.planCustomization?.daySequence, "回退默认日序")
        XCTAssertEqual(removed.planCustomization?.dayPlans["push-a"]?.exercises.first?.exerciseId, "db-bench-press", "删日序不误伤 dayPlans")
    }

    func testRemoveAllYieldsNilCustomization() throws {
        try seed()
        let writer = makeWriter()
        _ = try writer.applyCustomDayPlan(dayCode: "push-a", exercises: [CustomExerciseItem(exerciseId: "db-bench-press")])
        let removed = try writer.removeCustomDayPlan(dayCode: "push-a")
        // 无任何 dayPlan、无 daySequence → getter 视为 nil（与无自定义同义）
        XCTAssertNil(removed.planCustomization, "全空覆盖→无自定义")
    }

    func testStructureGuardsRejectEmpty() throws {
        try seed()
        let writer = makeWriter()
        XCTAssertThrowsError(try writer.applyCustomDayPlan(dayCode: "", exercises: [CustomExerciseItem(exerciseId: "x")]))
        XCTAssertThrowsError(try writer.applyCustomDayPlan(dayCode: "push-a", exercises: []))
        XCTAssertThrowsError(try writer.applyCustomDayPlan(dayCode: "push-a", exercises: [CustomExerciseItem(exerciseId: "")]))
        XCTAssertThrowsError(try writer.applyCustomDaySequence([]))
        XCTAssertThrowsError(try writer.applyCustomDaySequence(["legs-a", ""]), "日序含空 dayCode 应拒")
    }

    func testRemoveAllDayPlansClearsContainer() throws {
        try seed()
        let writer = makeWriter()
        _ = try writer.applyCustomDayPlan(dayCode: "push-a", exercises: [CustomExerciseItem(exerciseId: "db-bench-press")])
        let removed = try writer.removeCustomDayPlan(dayCode: "push-a")
        // 全空后整个容器清掉（与 getter「全空≡缺容器」闭环），不残留空 planCustomization
        XCTAssertNil(removed.storage["planCustomization"], "全空覆盖→容器一并清除")
    }

    func testCompletedSessionPlanRawUndoRestoresUnknownAndDirtyDayPlanBytes() throws {
        try Data(#"""
        {
          "schemaVersion": 11,
          "planCustomization": {
            "futureCustomization": {"keep": true},
            "daySequence": ["push-a", "pull-a"],
            "dayPlans": {
              "push-a": {
                "futureDayPlan": {"version": 7},
                "exercises": [
                  {"exerciseId": "old-press", "futureItem": {"keep": "yes"}},
                  {"sets": 99, "dirtyItem": true},
                  "dirty-sibling"
                ]
              },
              "pull-a": {
                "exercises": [{"exerciseId": "old-row"}],
                "futureOtherDay": 1
              }
            }
          }
        }
        """#.utf8).write(to: fileURL)
        let writer = makeWriter()
        let before = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        let rawBefore = try XCTUnwrap(rawDayPlan(in: before, dayCode: "push-a"))
        let rawBeforeBytes = try deterministicBytes(of: rawBefore)
        XCTAssertEqual(
            before.planCustomization?.dayPlans["push-a"]?.exercises.map(\.exerciseId),
            ["old-press"],
            "typed getter 会跳过缺 exerciseId 的脏 object 与非 object item"
        )

        let write = try writer.compareAndApplyCompletedSessionPlan { latest in
            XCTAssertEqual(
                try self.deterministicBytes(
                    of: try XCTUnwrap(self.rawDayPlan(in: latest, dayCode: "push-a"))
                ),
                rawBeforeBytes,
                "resolver 必须看到同一事务内最新 raw 节点"
            )
            return .writeCustom(
                dayCode: "push-a",
                exerciseIds: ["new-press", "new-fly"]
            )
        }

        XCTAssertTrue(write.didWrite)
        XCTAssertEqual(write.dayCode, "push-a")
        XCTAssertEqual(
            try deterministicBytes(of: try XCTUnwrap(write.previousDayPlanRaw)),
            rawBeforeBytes,
            "撤销基线是实际写入瞬间的 raw 节点"
        )
        XCTAssertEqual(
            rawDayPlan(in: write.appData, dayCode: "push-a"),
            .object([
                "exercises": .array([
                    .object(["exerciseId": .string("new-press")]),
                    .object(["exerciseId": .string("new-fly")]),
                ]),
            ]),
            "存回整日覆盖且只写 exerciseId"
        )

        let restored = try writer.restoreCompletedSessionPlanDayRaw(
            dayCode: "push-a",
            snapshot: write.previousDayPlanRaw,
            didCreateDayPlansContainer: write.didCreateDayPlansContainer
        )
        let restoredRaw = try XCTUnwrap(rawDayPlan(in: restored, dayCode: "push-a"))
        XCTAssertEqual(
            try deterministicBytes(of: restoredRaw),
            rawBeforeBytes,
            "raw undo 后目标节点按确定性 JSON 编码逐字节一致，不能 typed decode→encode"
        )
        XCTAssertEqual(
            restored.storage["planCustomization"]?.asObject?["futureCustomization"],
            .object(["keep": .bool(true)]),
            "planCustomization 未知 sibling 保留"
        )
        XCTAssertEqual(
            rawDayPlan(in: restored, dayCode: "pull-a"),
            rawDayPlan(in: before, dayCode: "pull-a"),
            "其他 dayCode raw 节点不动"
        )
    }

    func testCompletedSessionPlanNoOpSkipsGateBackupAndSave() throws {
        let current = try AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "futureKey": .string("unchanged"),
            "planCustomization": .object([
                "dayPlans": .object([
                    "push-a": .object([
                        "exercises": .array([
                            .object(["exerciseId": .string("same")]),
                        ]),
                    ]),
                ]),
            ]),
        ]))
        let store = PlanCustomizationStoreSpy(current: current)
        let gate = CapturingPlanCustomizationGate()
        let writer = CanonicalSessionWriter(store: store, gate: gate)

        let result = try writer.compareAndApplyCompletedSessionPlan { latest in
            XCTAssertEqual(latest, current)
            return .noOp
        }

        XCTAssertFalse(result.didWrite)
        XCTAssertNil(result.dayCode)
        XCTAssertNil(result.previousDayPlanRaw)
        XCTAssertFalse(result.didCreateDayPlansContainer)
        XCTAssertEqual(result.appData, current)
        XCTAssertEqual(gate.validationCount, 0, "no-op 不进 gate")
        XCTAssertEqual(store.backupCount, 0, "no-op 不备份")
        XCTAssertEqual(store.saveCount, 0, "no-op 不落盘")
        XCTAssertEqual(store.current, current)

        let identicalWrite = try writer.compareAndApplyCompletedSessionPlan { _ in
            .writeCustom(dayCode: "push-a", exerciseIds: ["same"])
        }
        XCTAssertFalse(identicalWrite.didWrite, "resolver 即使误返同值 write，也不得报成功")
        XCTAssertNil(identicalWrite.dayCode)
        XCTAssertNil(identicalWrite.previousDayPlanRaw)
        XCTAssertFalse(identicalWrite.didCreateDayPlansContainer)
        XCTAssertEqual(gate.validationCount, 0)
        XCTAssertEqual(store.backupCount, 0)
        XCTAssertEqual(store.saveCount, 0)
    }

    func testCompletedSessionPlanWriteCapturesLatestRawValueSeenByResolver() throws {
        let staleDisplaySnapshot: JSONValue = .object([
            "exercises": .array([.object(["exerciseId": .string("stale")])]),
            "revision": .int(1),
        ])
        let latestRaw: JSONValue = .object([
            "exercises": .array([
                .object(["exerciseId": .string("external-edit")]),
                .object(["dirty": .bool(true)]),
            ]),
            "revision": .int(2),
            "externalUnknown": .string("keep"),
        ])
        let current = try AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "planCustomization": .object([
                "dayPlans": .object(["push-a": latestRaw]),
            ]),
        ]))
        let store = PlanCustomizationStoreSpy(current: current)
        let writer = CanonicalSessionWriter(store: store, gate: AcceptAllGate())

        let result = try writer.compareAndApplyCompletedSessionPlan { latest in
            XCTAssertNotEqual(self.rawDayPlan(in: latest, dayCode: "push-a"), staleDisplaySnapshot)
            XCTAssertEqual(self.rawDayPlan(in: latest, dayCode: "push-a"), latestRaw)
            return .writeCustom(dayCode: "push-a", exerciseIds: ["session-order"])
        }

        XCTAssertTrue(result.didWrite)
        XCTAssertEqual(result.previousDayPlanRaw, latestRaw)
        XCTAssertEqual(store.backupCount, 1)
        XCTAssertEqual(store.saveCount, 1)
        let restored = try writer.restoreCompletedSessionPlanDayRaw(
            dayCode: "push-a",
            snapshot: result.previousDayPlanRaw,
            didCreateDayPlansContainer: result.didCreateDayPlansContainer
        )
        XCTAssertEqual(rawDayPlan(in: restored, dayCode: "push-a"), latestRaw)
    }

    func testCompletedSessionPlanClearAndNilRawUndoPreserveSiblings() throws {
        let current = try AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "planCustomization": .object([
                "futureCustomization": .string("keep"),
                "daySequence": .array([.string("push-a"), .string("pull-a")]),
                "dayPlans": .object([
                    "push-a": .object([
                        "exercises": .array([.object(["exerciseId": .string("old")])]),
                        "futureDayPlan": .bool(true),
                    ]),
                    "pull-a": .object([
                        "exercises": .array([.object(["exerciseId": .string("row")])]),
                    ]),
                ]),
            ]),
        ]))
        let store = PlanCustomizationStoreSpy(current: current)
        let writer = CanonicalSessionWriter(store: store, gate: AcceptAllGate())

        let cleared = try writer.compareAndApplyCompletedSessionPlan { _ in
            .clearCustom(dayCode: "push-a")
        }

        XCTAssertTrue(cleared.didWrite)
        XCTAssertEqual(cleared.dayCode, "push-a")
        XCTAssertEqual(
            cleared.previousDayPlanRaw,
            rawDayPlan(in: current, dayCode: "push-a")
        )
        XCTAssertNil(rawDayPlan(in: cleared.appData, dayCode: "push-a"))
        XCTAssertEqual(
            rawDayPlan(in: cleared.appData, dayCode: "pull-a"),
            rawDayPlan(in: current, dayCode: "pull-a")
        )
        XCTAssertEqual(
            cleared.appData.storage["planCustomization"]?.asObject?["futureCustomization"],
            .string("keep")
        )
        XCTAssertEqual(cleared.appData.schemaVersion, SchemaVersion.current)

        let addedAbsentDay = try writer.compareAndApplyCompletedSessionPlan { _ in
            .writeCustom(dayCode: "legs-a", exerciseIds: ["squat"])
        }
        let removedAbsentSnapshot = try writer.restoreCompletedSessionPlanDayRaw(
            dayCode: "legs-a",
            snapshot: nil,
            didCreateDayPlansContainer: addedAbsentDay.didCreateDayPlansContainer
        )
        XCTAssertNil(rawDayPlan(in: removedAbsentSnapshot, dayCode: "legs-a"))
        XCTAssertEqual(
            rawDayPlan(in: removedAbsentSnapshot, dayCode: "pull-a"),
            rawDayPlan(in: current, dayCode: "pull-a"),
            "nil snapshot 只执行 remove 语义，不误伤其他日"
        )
        XCTAssertEqual(
            removedAbsentSnapshot.storage["planCustomization"]?.asObject?["futureCustomization"],
            .string("keep"),
            "nil snapshot 仍保留未知 sibling"
        )
    }

    func testClearCustomUndoRestoresPreexistingEmptyDaySequenceBytes() throws {
        let rawDayPlanBefore: JSONValue = .object([
            "exercises": .array([
                .object(["exerciseId": .string("bench-press")]),
            ]),
            "futureDayPlan": .string("keep"),
        ])
        let planCustomizationBefore: JSONValue = .object([
            "daySequence": .array([]),
            "dayPlans": .object(["push-a": rawDayPlanBefore]),
        ])
        let current = try AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "planCustomization": planCustomizationBefore,
        ]))
        let store = PlanCustomizationStoreSpy(current: current)
        let writer = CanonicalSessionWriter(store: store, gate: AcceptAllGate())
        let beforeBytes = try deterministicBytes(of: planCustomizationBefore)

        let cleared = try writer.compareAndApplyCompletedSessionPlan { _ in
            .clearCustom(dayCode: "push-a")
        }
        XCTAssertTrue(cleared.didWrite)
        XCTAssertEqual(cleared.previousDayPlanRaw, rawDayPlanBefore)
        XCTAssertFalse(cleared.didCreateDayPlansContainer)

        let restored = try writer.restoreCompletedSessionPlanDayRaw(
            dayCode: "push-a",
            snapshot: cleared.previousDayPlanRaw,
            didCreateDayPlansContainer: cleared.didCreateDayPlansContainer
        )
        let restoredCustomization = try XCTUnwrap(
            restored.storage["planCustomization"],
            "non-nil raw undo 后 planCustomization 必须存在"
        )
        XCTAssertEqual(
            try deterministicBytes(of: restoredCustomization),
            beforeBytes,
            "clearCustom 再 non-nil raw undo 必须逐字节恢复写前空 daySequence sibling"
        )
        XCTAssertEqual(
            cleared.appData.storage["planCustomization"],
            .object(["daySequence": .array([])]),
            "clearCustom 只移除目标日与空 dayPlans 容器，不得删除写前空 daySequence"
        )
    }

    func testNilRawUndoPreservesPreexistingEmptyDaySequenceBytes() throws {
        let planCustomizationBefore: JSONValue = .object([
            "daySequence": .array([]),
        ])
        let current = try AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "planCustomization": planCustomizationBefore,
        ]))
        let store = PlanCustomizationStoreSpy(current: current)
        let writer = CanonicalSessionWriter(store: store, gate: AcceptAllGate())
        let beforeBytes = try deterministicBytes(of: planCustomizationBefore)

        let write = try writer.compareAndApplyCompletedSessionPlan { _ in
            .writeCustom(dayCode: "push-a", exerciseIds: ["bench-press"])
        }
        XCTAssertTrue(write.didWrite)
        XCTAssertNil(write.previousDayPlanRaw)
        XCTAssertTrue(write.didCreateDayPlansContainer)

        let restored = try writer.restoreCompletedSessionPlanDayRaw(
            dayCode: "push-a",
            snapshot: write.previousDayPlanRaw,
            didCreateDayPlansContainer: write.didCreateDayPlansContainer
        )
        let restoredCustomization = try XCTUnwrap(
            restored.storage["planCustomization"],
            "写前已存在的空 daySequence sibling 不得被 nil raw undo 删除"
        )
        XCTAssertEqual(
            try deterministicBytes(of: restoredCustomization),
            beforeBytes,
            "保存新增唯一 dayPlan 再撤销后，planCustomization 应逐字节恢复"
        )
    }

    func testNilRawUndoPreservesPreexistingEmptyDayPlansContainerBytes() throws {
        let planCustomizationBefore: JSONValue = .object([
            "dayPlans": .object([:]),
        ])
        let current = try AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "planCustomization": planCustomizationBefore,
        ]))
        let store = PlanCustomizationStoreSpy(current: current)
        let writer = CanonicalSessionWriter(store: store, gate: AcceptAllGate())
        let beforeBytes = try deterministicBytes(of: planCustomizationBefore)

        let write = try writer.compareAndApplyCompletedSessionPlan { _ in
            .writeCustom(dayCode: "push-a", exerciseIds: ["bench-press"])
        }
        XCTAssertTrue(write.didWrite)
        XCTAssertNil(write.previousDayPlanRaw)
        XCTAssertFalse(write.didCreateDayPlansContainer)

        let restored = try writer.restoreCompletedSessionPlanDayRaw(
            dayCode: "push-a",
            snapshot: write.previousDayPlanRaw,
            didCreateDayPlansContainer: write.didCreateDayPlansContainer
        )
        let restoredCustomization = try XCTUnwrap(
            restored.storage["planCustomization"],
            "写前已存在的空 dayPlans 容器不得被 nil raw undo 清理"
        )
        XCTAssertEqual(
            try deterministicBytes(of: restoredCustomization),
            beforeBytes,
            "只有本次写入创建的空 dayPlans 容器才可在撤销时清理"
        )
    }
}

private final class CapturingPlanCustomizationGate: AppDataWriteGate {
    private(set) var validationCount = 0

    func validate(candidate: AppData, replacing current: AppData?) throws {
        validationCount += 1
    }
}
