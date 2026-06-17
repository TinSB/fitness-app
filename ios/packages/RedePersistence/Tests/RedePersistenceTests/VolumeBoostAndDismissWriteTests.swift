// FR-T5 切片5：补量意图 + dismiss 写入合同（schema 11 coachAdjustments / coachState）。
// applyVolumeBoost 按 ISO 周去重；applyCoachActionDismissal 按 actionKey 累加 count；均走唯一写闸、可逆。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

final class VolumeBoostAndDismissWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-boost-dismiss-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }

    // MARK: 补量

    func testApplyVolumeBoostPersistsAndDedupsByWeek() throws {
        let writer = makeWriter()
        _ = try writer.applyVolumeBoost(weekStartISO: "2026-06-15")
        let again = try writer.applyVolumeBoost(weekStartISO: "2026-06-15")  // 同周再采纳 = 幂等
        XCTAssertEqual(again.volumeBoostWeeks, ["2026-06-15"], "一周一条，不重复")
        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(onDisk.volumeBoostWeeks, ["2026-06-15"], "落盘可回读")
    }

    func testApplyTwoWeeksThenRemoveOne() throws {
        let writer = makeWriter()
        _ = try writer.applyVolumeBoost(weekStartISO: "2026-06-08")
        _ = try writer.applyVolumeBoost(weekStartISO: "2026-06-15")
        let removed = try writer.removeVolumeBoost(weekStartISO: "2026-06-08")
        XCTAssertEqual(removed.volumeBoostWeeks, ["2026-06-15"], "撤销只删指定周")
    }

    func testRemoveVolumeBoostAbsentIsIdempotent() throws {
        let result = try makeWriter().removeVolumeBoost(weekStartISO: "2026-01-01")
        XCTAssertEqual(result.volumeBoostWeeks, [], "删不存在 → 无变化、不报错")
    }

    // MARK: dismiss

    func testDismissalAccumulatesCount() throws {
        let writer = makeWriter()
        _ = try writer.applyCoachActionDismissal(actionKey: "volumeBoost:belowWeeklyPlan")
        let twice = try writer.applyCoachActionDismissal(actionKey: "volumeBoost:belowWeeklyPlan")
        XCTAssertEqual(twice.coachDismissals["volumeBoost:belowWeeklyPlan"], 2, "重复暂不处理 → count 累加（喂降频）")
    }

    func testDismissalTwoKeysThenUndoOne() throws {
        let writer = makeWriter()
        _ = try writer.applyCoachActionDismissal(actionKey: "a")
        _ = try writer.applyCoachActionDismissal(actionKey: "b")
        let undone = try writer.removeCoachActionDismissal(actionKey: "a")
        XCTAssertNil(undone.coachDismissals["a"], "撤销整条删")
        XCTAssertEqual(undone.coachDismissals["b"], 1, "另一条保留")
    }

    // MARK: 守卫 + open-bag

    // apply 与 remove 守卫对称（审查 M-1）：四个入口空键都抛 .emptyKey、不写盘。
    func testEmptyKeysThrow() {
        XCTAssertThrowsError(try makeWriter().applyVolumeBoost(weekStartISO: "")) { e in
            XCTAssertEqual(e as? CoachActionWriteError, .emptyKey)
        }
        XCTAssertThrowsError(try makeWriter().removeVolumeBoost(weekStartISO: "")) { e in
            XCTAssertEqual(e as? CoachActionWriteError, .emptyKey)
        }
        XCTAssertThrowsError(try makeWriter().applyCoachActionDismissal(actionKey: "")) { e in
            XCTAssertEqual(e as? CoachActionWriteError, .emptyKey)
        }
        XCTAssertThrowsError(try makeWriter().removeCoachActionDismissal(actionKey: "")) { e in
            XCTAssertEqual(e as? CoachActionWriteError, .emptyKey)
        }
    }

    func testWritesPreserveExistingData() throws {
        // 预置容器内已有兄弟子键（审查 N-1）：嵌套写不得覆盖 coachState/coachAdjustments 的其它子键。
        try Data(#"{"schemaVersion": 11, "futureKey": 9, "history": [{"id": "a", "completed": true}], "exerciseSubstitutions": {"x": "y"}, "coachState": {"dismissed": [], "extra": 1}, "coachAdjustments": {"volumeBoosts": [], "note": "keep"}}"#.utf8).write(to: fileURL)
        let writer = makeWriter()
        let boosted = try writer.applyVolumeBoost(weekStartISO: "2026-06-15")
        XCTAssertEqual(boosted.volumeBoostWeeks, ["2026-06-15"])
        XCTAssertEqual(boosted.storage["coachAdjustments"]?.asObject?["note"]?.asString, "keep", "coachAdjustments 兄弟子键保全")
        let dismissed = try writer.applyCoachActionDismissal(actionKey: "k")
        XCTAssertEqual(dismissed.coachDismissals["k"], 1)
        XCTAssertEqual(dismissed.storage["coachState"]?.asObject?["extra"]?.asInt, 1, "coachState 兄弟子键保全")
        XCTAssertEqual(dismissed.history.first?.id, "a", "历史保全")
        XCTAssertEqual(dismissed.exerciseSubstitutions, ["x": "y"], "换动作覆盖保全（不互相覆盖）")
        XCTAssertEqual(dismissed.storage["futureKey"]?.asInt, 9, "open-bag 未知键保全")
    }
}
