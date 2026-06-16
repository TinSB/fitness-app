// M3-4（FR-TR9）：进行中会话 draft = 处方 + 事件日志。
// 恢复 = 同处方重放事件——reducer 确定性保证「恢复态 ≡ 中断态」（Equatable 断言）。
// draft ≠ canonical：只用于本日恢复，跨天作废。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class TrainSessionDraftTests: XCTestCase {
    private func makeFlow() throws -> TrainFlowState {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-10"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        return TrainFlowState(prescription: prescription)
    }

    private func obs(_ w: Double, _ r: Int, rir: Double? = 2, pain: Bool = false) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: w, reps: r, rir: rir, painReported: pain)
    }

    // 每个被接受的事件都进日志；被 guard 拒绝的不进
    func testAcceptedEventsAreRecordedRejectedAreNot() throws {
        var flow = try makeFlow()
        flow.logSet(obs(60, 6))
        flow.restFinished()
        flow.toggleHold()
        flow.reportPain()
        flow.skipSet(reason: .fatigue)
        flow.restFinished() // 非 resting 态 → 拒绝，不记录
        XCTAssertEqual(flow.events.count, 5)

        var summaryFlow = flow
        summaryFlow.requestFinish()
        summaryFlow.confirmEnd(reason: .timeUp)
        summaryFlow.logSet(obs(60, 6)) // summary 态 → 拒绝
        XCTAssertEqual(summaryFlow.events.count, 7)
    }

    // 完整剧本重放：恢复态与中断态逐字段相等
    func testReplayReproducesInterruptedStateExactly() throws {
        var flow = try makeFlow()
        flow.logSet(obs(62.5, 6, rir: 1))
        flow.restFinished()
        flow.toggleHold()
        flow.logSet(obs(60, 6))
        flow.restFinished()
        flow.skipSet(reason: .equipmentBusy)        // 第 1 动作收尾（3 组：2 完成 + 1 跳过）
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press") // 候选含其一? push-a 第 2 动作 incline-db-press → 族候选
        flow.reportPain()
        flow.logSet(obs(22.5, 8, pain: true))

        let restored = try XCTUnwrap(TrainFlowState.restore(prescription: flow.prescription, events: flow.events))
        XCTAssertEqual(restored, flow)
    }

    // resting 态切 Hold 的重放等值（guard 允许 resting）
    func testToggleHoldDuringRestReplays() throws {
        var flow = try makeFlow()
        flow.logSet(obs(60, 6))
        flow.toggleHold() // resting 态
        flow.restFinished()
        let restored = try XCTUnwrap(TrainFlowState.restore(prescription: flow.prescription, events: flow.events))
        XCTAssertEqual(restored, flow)
        XCTAssertTrue(restored.isHolding)
    }

    // 卡在 confirmEnd 后的 draft（保存失败场景）：恢复直接落在小结态
    func testDraftWithConfirmEndRestoresToSummary() throws {
        var flow = try makeFlow()
        flow.logSet(obs(60, 6))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)
        let restored = try XCTUnwrap(TrainFlowState.restore(prescription: flow.prescription, events: flow.events))
        XCTAssertEqual(restored.phase, .summary)
        XCTAssertEqual(restored, flow)
    }

    // 防御：重放中事件被拒（处方不含可替换候选时的 replace 事件）→ 返回 nil
    func testRestoreReturnsNilWhenEventRejectedOnReplay() throws {
        let flow = try makeFlow()
        let bogusEvents: [TrainFlowEvent] = [.replaceExercise("no-such-exercise")]
        XCTAssertNil(TrainFlowState.restore(prescription: flow.prescription, events: bogusEvents))
    }

    // draft JSON 往返
    func testDraftCodableRoundTrip() throws {
        var flow = try makeFlow()
        flow.logSet(obs(60, 6))
        flow.requestFinish()
        flow.keepTraining()

        let draft = TrainSessionDraft(
            dateISO: "2026-06-10",
            startedAt: Date(timeIntervalSince1970: 1_780_000_000),
            prescription: flow.prescription,
            events: flow.events
        )
        let data = try JSONEncoder().encode(draft)
        let decoded = try JSONDecoder().decode(TrainSessionDraft.self, from: data)
        XCTAssertEqual(decoded.dateISO, "2026-06-10")
        XCTAssertEqual(decoded.events, flow.events)

        let restored = try XCTUnwrap(TrainFlowState.restore(prescription: decoded.prescription, events: decoded.events))
        XCTAssertEqual(restored, flow)
    }

    // 跨天作废
    func testDraftIsOnlyRestorableSameDay() throws {
        let draft = TrainSessionDraft(
            dateISO: "2026-06-10", startedAt: Date(timeIntervalSince1970: 0),
            prescription: try makeFlow().prescription, events: []
        )
        XCTAssertTrue(draft.isRestorable(todayISO: "2026-06-10"))
        XCTAssertFalse(draft.isRestorable(todayISO: "2026-06-11"))
    }

    // §6.2：draft 落盘附目录版本戳；旧 draft（无字段）解码为 nil 不作废
    func testDraftCarriesCatalogVersionAndOldDraftsDecode() throws {
        let draft = TrainSessionDraft(
            dateISO: "2026-06-11", startedAt: Date(timeIntervalSince1970: 0),
            prescription: TodayPrescription(dayCode: "push-a", exercises: [], dayReasons: []),
            events: [], catalogVersion: "wave-1.1"
        )
        let data = try JSONEncoder().encode(draft)
        let decoded = try JSONDecoder().decode(TrainSessionDraft.self, from: data)
        XCTAssertEqual(decoded.catalogVersion, "wave-1.1")
        // 旧格式（无 catalogVersion 键）仍可解码
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        json.removeValue(forKey: "catalogVersion")
        let oldData = try JSONSerialization.data(withJSONObject: json)
        let oldDecoded = try JSONDecoder().decode(TrainSessionDraft.self, from: oldData)
        XCTAssertNil(oldDecoded.catalogVersion)
        XCTAssertEqual(oldDecoded.prescription.dayCode, "push-a")
    }
}
