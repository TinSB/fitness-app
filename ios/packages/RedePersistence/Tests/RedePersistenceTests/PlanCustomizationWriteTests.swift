// 自定义训练计划写入合同（FR-PL6/PL7，切片 S5）：apply/remove 当日动作清单 + 日序；
// 回滚 = remove；幂等；open-bag 保全其它键 + 其他 dayCode；结构守卫拒空；无 schema bump。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
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
}
