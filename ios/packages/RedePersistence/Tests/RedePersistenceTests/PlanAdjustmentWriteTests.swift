// 计划调整写入合同（FR-PL3/4）：采纳写 daysPerWeek + 回滚记录；回滚恢复 from 并删记录；
// 无记录回滚幂等；open-bag 保全其它键、无 schema bump。

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

    func testApplyWritesNewDaysAndRollbackRecord() throws {
        let existing = #"""
        {"schemaVersion": 11, "futureKey": 9,
         "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 4},
         "history": [{"id": "a"}], "userProfile": {"name": "样例"}}
        """#
        try Data(existing.utf8).write(to: fileURL)
        let result = try makeWriter().applyFrequencyAdjustment(fromDaysPerWeek: 4, toDaysPerWeek: 2)
        XCTAssertEqual(result.programTemplate.daysPerWeek, 2, "周计划改到 2")
        XCTAssertEqual(result.programTemplate.splitType, "push-pull-legs", "不丢 splitType")
        XCTAssertEqual(result.planAdjustment?.kind, "reduceFrequency")
        XCTAssertEqual(result.planAdjustment?.fromDaysPerWeek, 4, "记原值供回滚")
        XCTAssertEqual(result.planAdjustment?.toDaysPerWeek, 2)
        XCTAssertEqual(result.schemaVersion, SchemaVersion.current, "纯加性、不动 schema")
        XCTAssertEqual(result.history.first?.id, "a", "历史保全")
        XCTAssertEqual(result.userProfile.name, "样例", "profile 保全")
        XCTAssertEqual(result.storage["futureKey"]?.asInt, 9, "open-bag 未知键保全")
    }

    func testRollbackRestoresFromAndClearsRecord() throws {
        try Data(#"{"schemaVersion": 11, "programTemplate": {"daysPerWeek": 4}}"#.utf8).write(to: fileURL)
        let writer = makeWriter()
        _ = try writer.applyFrequencyAdjustment(fromDaysPerWeek: 4, toDaysPerWeek: 2)
        let rolled = try writer.rollbackPlanAdjustment()
        XCTAssertEqual(rolled.programTemplate.daysPerWeek, 4, "恢复原周计划")
        XCTAssertNil(rolled.planAdjustment, "回滚后记录清空")
    }

    func testRollbackWithoutRecordIsIdempotent() throws {
        try Data(#"{"schemaVersion": 11, "programTemplate": {"daysPerWeek": 3}}"#.utf8).write(to: fileURL)
        let result = try makeWriter().rollbackPlanAdjustment()
        XCTAssertEqual(result.programTemplate.daysPerWeek, 3, "无记录 → 不动")
        XCTAssertNil(result.planAdjustment)
    }
}
