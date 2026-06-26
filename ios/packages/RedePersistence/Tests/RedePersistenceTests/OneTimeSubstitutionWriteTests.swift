// FR-TR6「只换这次」临时换动作写入合同（date-scoped，open-bag oneTimeSubstitutions，schema 11，无 bump）。
// applyOneTimeSubstitution = 写 oneTimeSubstitutions[originalId]={actualId,dateISO} 并清非本次 dateISO 的陈旧项；
// removeOneTimeSubstitution = 单步撤销（删键、幂等）。结构守卫：id 非空、original≠actual、dateISO 非空。
// 与永久 exerciseSubstitutions 互不干扰。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

final class OneTimeSubstitutionWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-onetime-write-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }

    func testApplyWritesDatedSubstitutionAndPersists() throws {
        let result = try makeWriter().applyOneTimeSubstitution(originalId: "squat", actualId: "leg-press", dateISO: "2026-06-25")
        XCTAssertEqual(result.oneTimeSubstitutions["squat"], OneTimeSubstitution(actualId: "leg-press", dateISO: "2026-06-25"))
        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(onDisk.oneTimeSubstitutions["squat"]?.actualId, "leg-press", "落盘可回读")
        XCTAssertEqual(onDisk.oneTimeSubstitutions["squat"]?.dateISO, "2026-06-25")
    }

    func testApplyPrunesStaleOtherDayEntries() throws {
        let writer = makeWriter()
        _ = try writer.applyOneTimeSubstitution(originalId: "squat", actualId: "leg-press", dateISO: "2026-06-24") // 昨天
        let result = try writer.applyOneTimeSubstitution(originalId: "bench-press", actualId: "db-bench-press", dateISO: "2026-06-25") // 今天
        XCTAssertNil(result.oneTimeSubstitutions["squat"], "非本次日期的陈旧临时项被清掉（只今天有效）")
        XCTAssertEqual(result.oneTimeSubstitutions["bench-press"]?.actualId, "db-bench-press", "本次（今天）项保留")
        XCTAssertEqual(result.oneTimeSubstitutions.count, 1)
    }

    func testApplyKeepsSameDaySiblings() throws {
        let writer = makeWriter()
        _ = try writer.applyOneTimeSubstitution(originalId: "squat", actualId: "leg-press", dateISO: "2026-06-25")
        let result = try writer.applyOneTimeSubstitution(originalId: "bench-press", actualId: "db-bench-press", dateISO: "2026-06-25")
        XCTAssertEqual(result.oneTimeSubstitutions.count, 2, "同一天的多个临时换都保留")
    }

    func testApplyPreservesPermanentSubsAndOpenBag() throws {
        try Data(#"{"schemaVersion": 11, "futureKey": 7, "exerciseSubstitutions": {"deadlift": "trap-bar-deadlift"}}"#.utf8).write(to: fileURL)
        let result = try makeWriter().applyOneTimeSubstitution(originalId: "squat", actualId: "leg-press", dateISO: "2026-06-25")
        XCTAssertEqual(result.exerciseSubstitutions, ["deadlift": "trap-bar-deadlift"], "永久换动作不受影响")
        XCTAssertEqual(result.oneTimeSubstitutions["squat"]?.actualId, "leg-press")
        XCTAssertEqual(result.storage["futureKey"]?.asInt, 7, "open-bag 未知键保全")
    }

    func testRemoveDeletesKeyAndIsIdempotent() throws {
        let writer = makeWriter()
        _ = try writer.applyOneTimeSubstitution(originalId: "squat", actualId: "leg-press", dateISO: "2026-06-25")
        _ = try writer.applyOneTimeSubstitution(originalId: "bench-press", actualId: "db-bench-press", dateISO: "2026-06-25")
        let removed = try writer.removeOneTimeSubstitution(originalId: "squat")
        XCTAssertNil(removed.oneTimeSubstitutions["squat"], "撤销删指定项")
        XCTAssertEqual(removed.oneTimeSubstitutions["bench-press"]?.actualId, "db-bench-press", "另一项保留")
        let again = try writer.removeOneTimeSubstitution(originalId: "never-set")
        XCTAssertEqual(again.oneTimeSubstitutions.count, 1, "删不存在项 → 幂等无变化")
    }

    func testGuards() {
        XCTAssertThrowsError(try makeWriter().applyOneTimeSubstitution(originalId: "", actualId: "x", dateISO: "2026-06-25")) {
            XCTAssertEqual($0 as? CoachActionWriteError, .emptyExerciseId)
        }
        XCTAssertThrowsError(try makeWriter().applyOneTimeSubstitution(originalId: "squat", actualId: "squat", dateISO: "2026-06-25")) {
            XCTAssertEqual($0 as? CoachActionWriteError, .substitutionToSelf("squat"))
        }
        XCTAssertThrowsError(try makeWriter().applyOneTimeSubstitution(originalId: "squat", actualId: "leg-press", dateISO: "")) {
            XCTAssertEqual($0 as? CoachActionWriteError, .emptyKey)
        }
        XCTAssertThrowsError(try makeWriter().removeOneTimeSubstitution(originalId: "")) {
            XCTAssertEqual($0 as? CoachActionWriteError, .emptyExerciseId)
        }
    }

    // 防御读：缺字段/空串的脏临时项被 getter 跳过。
    func testGetterSkipsDirtyEntries() throws {
        try Data(#"{"schemaVersion": 11, "oneTimeSubstitutions": {"a": {"actualId": "x"}, "b": {"dateISO": "2026-06-25"}, "c": {"actualId": "", "dateISO": "2026-06-25"}, "good": {"actualId": "leg-press", "dateISO": "2026-06-25"}}}"#.utf8).write(to: fileURL)
        let loaded = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(loaded.oneTimeSubstitutions.count, 1, "缺 dateISO/缺 actualId/空串 的脏项全跳过")
        XCTAssertEqual(loaded.oneTimeSubstitutions["good"]?.actualId, "leg-press")
    }
}
