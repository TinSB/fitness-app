// P0 不丢数据（owner 2026-10-18「数据可信、不丢」）：
// ① 换动作用新动作自己的起始负重（杠铃卧推 80 换哑铃卧推不再默认 80），新事件随草稿重放；
// ② 0 组的一场不能保存——引擎给出 hasCompletedSets 供写入守卫；
// ③ 草稿跨零点：记过组的跨天草稿仍可恢复，没记过组的作废；小结时刻随草稿保存。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class SessionDurabilityTests: XCTestCase {
    private func makeState() throws -> TrainFlowState {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        return TrainFlowState(prescription: prescription)
    }

    private func obs(_ w: Double, _ r: Int, rir: Double? = 2) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: w, reps: r, rir: rir)
    }

    // MARK: - 换动作负重

    func testSwapWithResolvedLoadUsesNewExercisesOwnLoadForEverySet() throws {
        var state = try makeState()
        XCTAssertEqual(state.currentExercise?.sets.first?.targetWeightKg, 60)

        state.replaceCurrentExercise(with: "db-bench-press", resolvedLoadKg: 22.5)

        XCTAssertEqual(state.currentExercise?.exerciseId, "db-bench-press")
        XCTAssertEqual(state.currentExercise?.sets.map(\.targetWeightKg), [22.5, 22.5, 22.5])
        XCTAssertEqual(state.currentTargetWeightKg, 22.5)
        XCTAssertEqual(state.events, [.replaceExerciseWithLoad("db-bench-press", 22.5)])
    }

    // 已做过组再换：只承接剩余组，同样用新动作的负重。
    func testMidExerciseSwapCarriesResolvedLoadIntoRemainingSets() throws {
        var state = try makeState()
        state.logSet(obs(60, 6))
        state.restFinished()

        state.replaceCurrentExercise(with: "db-bench-press", resolvedLoadKg: 22.5)

        XCTAssertEqual(state.currentExercise?.sets.map(\.targetWeightKg), [22.5, 22.5])
        XCTAssertEqual(state.currentExercise?.sets.map(\.index), [1, 2])
    }

    // 换到纯自重：无论解析出什么负重都归 0（自重无重量轴，脏历史教训）。
    func testSwapToBodyweightIgnoresResolvedLoad() throws {
        var state = try makeState()
        XCTAssertTrue(state.replacementCandidates.contains("push-up"))
        state.replaceCurrentExercise(with: "push-up", resolvedLoadKg: 40)
        XCTAssertEqual(state.currentExercise?.sets.map(\.targetWeightKg), [0, 0, 0])
    }

    // 旧草稿里的旧事件照旧重放：external→external 仍沿用原负重（行为不变）。
    func testLegacyReplaceEventKeepsPreviousBehaviourOnReplay() throws {
        let state = try makeState()
        let restored = try XCTUnwrap(TrainFlowState.restore(
            prescription: state.prescription, events: [.replaceExercise("db-bench-press")]
        ))
        XCTAssertEqual(restored.currentExercise?.sets.map(\.targetWeightKg), [60, 60, 60])
    }

    func testResolvedSwapReplaysAndRoundTripsThroughDraftJSON() throws {
        var state = try makeState()
        state.replaceCurrentExercise(with: "db-bench-press", resolvedLoadKg: 22.5)
        state.logSet(obs(22.5, 8))

        let draft = TrainSessionDraft(
            dateISO: "2026-06-09", startedAt: Date(timeIntervalSince1970: 0),
            prescription: state.prescription, events: state.events
        )
        let decoded = try JSONDecoder().decode(TrainSessionDraft.self, from: JSONEncoder().encode(draft))
        XCTAssertEqual(decoded.events, state.events)
        XCTAssertEqual(decoded.restoreFlow(), state)
    }

    // 来自草稿的坏值（NaN / 负数）不得进入下一组建议的算术：拒绝且零副作用；重放 fail-closed。
    func testSwapRejectsNonFiniteOrNegativeResolvedLoad() throws {
        var state = try makeState()
        let before = state
        state.replaceCurrentExercise(with: "db-bench-press", resolvedLoadKg: .nan)
        state.replaceCurrentExercise(with: "db-bench-press", resolvedLoadKg: -5)
        XCTAssertEqual(state, before)
        XCTAssertNil(TrainFlowState.restore(
            prescription: state.prescription, events: [.replaceExerciseWithLoad("db-bench-press", -5)]
        ))
    }

    // MARK: - 0 组不能保存

    func testHasCompletedSetsTracksLoggedSetsOnly() throws {
        var state = try makeState()
        XCTAssertFalse(state.hasCompletedSets)
        state.skipSet(reason: .fatigue)
        XCTAssertFalse(state.hasCompletedSets, "只跳过不算记过组")
        state.logSet(obs(60, 6))
        XCTAssertTrue(state.hasCompletedSets)
        XCTAssertTrue(state.undoLastSet())
        XCTAssertFalse(state.hasCompletedSets, "撤销唯一一组后回到 0 组")
    }

    // MARK: - 草稿跨零点 / 小结时刻

    func testCrossDayDraftIsRestorableOnlyWhenItHasLoggedSets() throws {
        let prescription = try makeState().prescription
        let empty = TrainSessionDraft(
            dateISO: "2026-06-09", startedAt: Date(timeIntervalSince1970: 0),
            prescription: prescription, events: [.toggleHold]
        )
        XCTAssertTrue(empty.isRestorable(todayISO: "2026-06-09"))
        XCTAssertFalse(empty.isRestorable(todayISO: "2026-06-10"), "跨天且一组没记：没有可丢的东西")

        let logged = TrainSessionDraft(
            dateISO: "2026-06-09", startedAt: Date(timeIntervalSince1970: 0),
            prescription: prescription, events: [.logSet(obs(60, 6))]
        )
        XCTAssertTrue(logged.isRestorable(todayISO: "2026-06-10"), "过了零点也不能把已记的组静默清掉")
        XCTAssertTrue(logged.appending(.restFinished).isRestorable(todayISO: "2026-06-12"))
    }

    func testDraftCarriesEndedAtAndOldDraftsDecodeWithoutIt() throws {
        let endedAt = Date(timeIntervalSince1970: 1_790_000_000)
        let draft = TrainSessionDraft(
            dateISO: "2026-06-09", startedAt: Date(timeIntervalSince1970: 1_789_997_000),
            prescription: try makeState().prescription, events: [], endedAt: endedAt
        )
        let data = try JSONEncoder().encode(draft)
        XCTAssertEqual(try JSONDecoder().decode(TrainSessionDraft.self, from: data).endedAt, endedAt)
        XCTAssertEqual(draft.appending(.restFinished).endedAt, endedAt)

        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        json.removeValue(forKey: "endedAt")
        let old = try JSONDecoder().decode(TrainSessionDraft.self, from: JSONSerialization.data(withJSONObject: json))
        XCTAssertNil(old.endedAt)
    }
}
