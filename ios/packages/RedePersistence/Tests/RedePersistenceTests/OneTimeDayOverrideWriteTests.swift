// FR-TR7「今天换一天练」临时训练日覆盖写入合同（open-bag，无 schema bump）：
//  - applyOneTimeDayOverride 写 {dayCode,dateISO}；removeOneTimeDayOverride 清。
//  - **完成消费（关键）**：appendCompletedSession 时，若覆盖 dateISO == 该场 date → rotationOffset −1 + 清覆盖
//    （抵消本场对轮转的推进、使被跳过的日下一场补回）；日期不符则不动。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

final class OneTimeDayOverrideWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-dayoverride-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }
    override func tearDownWithError() throws { try? FileManager.default.removeItem(at: directory) }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }
    private func session(id: String, date: String) -> TrainingSession {
        TrainingSession(storage: ["id": .string(id), "date": .string(date), "exercises": .array([]), "completed": .bool(true)])
    }

    func testApplyAndRemove() throws {
        let writer = makeWriter()
        let applied = try writer.applyOneTimeDayOverride(dayCode: "upper", dateISO: "2026-06-26")
        XCTAssertEqual(applied.oneTimeDayOverride, OneTimeDayOverride(dayCode: "upper", dateISO: "2026-06-26"))
        XCTAssertEqual(applied.rotationOffset, 0, "仅设覆盖、不动偏移（偏移在完成时才消费）")
        let removed = try writer.removeOneTimeDayOverride()
        XCTAssertNil(removed.oneTimeDayOverride, "撤销清掉覆盖")
        XCTAssertEqual(removed.rotationOffset, 0)
    }

    func testCompletionOnOverrideDayConsumesIt() throws {
        let writer = makeWriter()
        _ = try writer.applyOneTimeDayOverride(dayCode: "upper", dateISO: "2026-06-26")
        let after = try writer.appendCompletedSession(session(id: "s1", date: "2026-06-26"))
        XCTAssertEqual(after.rotationOffset, -1, "在覆盖日完成 → 偏移 −1（抵消本场推进，明天补回被跳过的日）")
        XCTAssertNil(after.oneTimeDayOverride, "消费后清掉覆盖")
        XCTAssertEqual(after.history.count, 1, "session 照常落盘")
    }

    func testDoubleCompletionSameDayDoesNotDoubleOffset() throws {
        let writer = makeWriter()
        _ = try writer.applyOneTimeDayOverride(dayCode: "upper", dateISO: "2026-06-26")
        _ = try writer.appendCompletedSession(session(id: "s1", date: "2026-06-26"))   // 消费：offset −1、清覆盖
        let after2 = try writer.appendCompletedSession(session(id: "s2", date: "2026-06-26")) // 同日二次：覆盖已 nil → 不再消费
        XCTAssertEqual(after2.rotationOffset, -1, "覆盖已消费清空 → 同日二次完成不再二次递减偏移")
        XCTAssertNil(after2.oneTimeDayOverride)
        XCTAssertEqual(after2.history.count, 2)
    }

    func testCompletionOnDifferentDayDoesNotConsume() throws {
        let writer = makeWriter()
        _ = try writer.applyOneTimeDayOverride(dayCode: "upper", dateISO: "2026-06-26")
        let after = try writer.appendCompletedSession(session(id: "s1", date: "2026-06-27")) // 非覆盖日
        XCTAssertEqual(after.rotationOffset, 0, "非覆盖日完成 → 偏移不动")
        XCTAssertEqual(after.oneTimeDayOverride, OneTimeDayOverride(dayCode: "upper", dateISO: "2026-06-26"), "覆盖保留")
    }

    func testNoOverrideCompletionLeavesRotationUntouched() throws {
        let after = try makeWriter().appendCompletedSession(session(id: "s1", date: "2026-06-26"))
        XCTAssertEqual(after.rotationOffset, 0, "无覆盖 → 偏移恒 0（零回归前提）")
        XCTAssertNil(after.oneTimeDayOverride)
    }

    func testGuards() {
        XCTAssertThrowsError(try makeWriter().applyOneTimeDayOverride(dayCode: "", dateISO: "2026-06-26")) {
            XCTAssertEqual($0 as? CoachActionWriteError, .emptyKey)
        }
        XCTAssertThrowsError(try makeWriter().applyOneTimeDayOverride(dayCode: "upper", dateISO: "")) {
            XCTAssertEqual($0 as? CoachActionWriteError, .emptyKey)
        }
    }
}
