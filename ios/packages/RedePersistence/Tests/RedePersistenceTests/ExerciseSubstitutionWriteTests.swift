// FR-T5 切片3：换动作前瞻覆盖写入合同（saved-session exercise replacement，schema 11）。
// applyExerciseSubstitution = open-bag 合并写 exerciseSubstitutions[originalId]=actualId，走全套 gate；
// removeExerciseSubstitution = 单步撤销（反向 gated 写，删键、幂等）。结构守卫：id 非空、original≠actual。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

final class ExerciseSubstitutionWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-sub-write-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }

    func testApplyWritesSubstitutionAndPersists() throws {
        let result = try makeWriter().applyExerciseSubstitution(originalId: "bench-press", actualId: "db-bench-press")
        XCTAssertEqual(result.exerciseSubstitutions, ["bench-press": "db-bench-press"])
        XCTAssertEqual(result.schemaVersion, SchemaVersion.current)
        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(onDisk.exerciseSubstitutions, ["bench-press": "db-bench-press"], "落盘可回读")
    }

    func testApplyMergesPreservingExistingData() throws {
        try Data(#"{"schemaVersion": 11, "futureKey": 7, "history": [{"id": "a", "completed": true}], "userProfile": {"name": "样例"}}"#.utf8).write(to: fileURL)
        let result = try makeWriter().applyExerciseSubstitution(originalId: "squat", actualId: "front-squat")
        XCTAssertEqual(result.exerciseSubstitutions, ["squat": "front-squat"])
        XCTAssertEqual(result.history.first?.id, "a", "历史保全")
        XCTAssertEqual(result.userProfile.name, "样例", "profile 保全")
        XCTAssertEqual(result.storage["futureKey"]?.asInt, 7, "open-bag 未知键保全")
    }

    func testApplyTwoThenRemoveOne() throws {
        let writer = makeWriter()
        _ = try writer.applyExerciseSubstitution(originalId: "bench-press", actualId: "db-bench-press")
        _ = try writer.applyExerciseSubstitution(originalId: "squat", actualId: "front-squat")
        let removed = try writer.removeExerciseSubstitution(originalId: "bench-press")
        XCTAssertEqual(removed.exerciseSubstitutions, ["squat": "front-squat"], "撤销只删指定项，另一项保留")
        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(onDisk.exerciseSubstitutions, ["squat": "front-squat"], "撤销已落盘")
    }

    func testRemoveAbsentIsIdempotent() throws {
        let result = try makeWriter().removeExerciseSubstitution(originalId: "never-set")
        XCTAssertEqual(result.exerciseSubstitutions, [:], "删不存在项 → 无变化、不报错")
    }

    func testEmptyIdThrows() {
        XCTAssertThrowsError(try makeWriter().applyExerciseSubstitution(originalId: "", actualId: "x")) { error in
            XCTAssertEqual(error as? CoachActionWriteError, .emptyExerciseId)
        }
    }

    func testSelfSubstitutionThrows() {
        XCTAssertThrowsError(try makeWriter().applyExerciseSubstitution(originalId: "bench-press", actualId: "bench-press")) { error in
            XCTAssertEqual(error as? CoachActionWriteError, .substitutionToSelf("bench-press"))
        }
    }

    // 撤销与采纳守卫对称（审查 M-1）：空 id 在进写闸前抛、不写盘。
    func testRemoveEmptyIdThrows() {
        XCTAssertThrowsError(try makeWriter().removeExerciseSubstitution(originalId: "")) { error in
            XCTAssertEqual(error as? CoachActionWriteError, .emptyExerciseId)
        }
    }
}
