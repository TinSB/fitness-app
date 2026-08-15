import XCTest
import RedeTrainingDecision
import RedeWatchLink
@testable import Rede

// 表回传的组落进手机 flow（watchOS 切片 4）。
//
// 为什么这一层必须有测试：**投递腿在模拟器上验不了**——transferUserInfo 在
// 配对模拟器上两个方向都不投递（2026-08-15 实测，见 WatchLinkEnvelope 通道纪律），
// 所以「表点完成 → 手机记上」这条链只能在真机跑通。
// 但真正会出错的不是通道，是**手机决定收不收**这一步：
// 两块屏同时开着时，一条迟到的表侧消息会让同一组落盘两次。
// 那部分是纯逻辑，可以在这里钉死，不必等真机。
@MainActor
final class WatchLoggedSetIntakeTests: XCTestCase {

    private func makeStore() -> SessionStore {
        let store = SessionStore(draftStore: FakeDraftStore())
        store.flow = TrainFlowState(prescription: TodayPrescription(
            dayCode: "push-a",
            exercises: [
                ExercisePrescriptionPlan(
                    exerciseId: "bench-press", sets: 3, restSeconds: 120,
                    repLowerBound: 6, repUpperBound: 10, targetReps: 8,
                    targetWeightKg: 60, targetRir: 2, previousWeightKg: nil,
                    previousTopReps: nil, nextProjectedWeightKg: 62.5,
                    progressionStepKg: 2.5, change: .start, reason: .firstExposure,
                    loadType: "external", equipment: "barbell", progressionPauseReason: nil)
            ],
            dayReasons: []))
        return store
    }

    private func loggedSet(exerciseId: String = "bench-press", setNumber: Int = 1,
                           reps: Int = 8) -> WatchLoggedSet {
        WatchLoggedSet(exerciseId: exerciseId, setNumber: setNumber, weightKg: 60,
                       reps: reps, rir: 2, loggedAtISO: "2026-08-15T10:00:00Z")
    }

    private func completedCount(_ store: SessionStore) -> Int {
        store.flow?.observationsByExercise.values.reduce(0) { $0 + $1.count } ?? 0
    }

    func testMatchingSetIsRecorded() {
        let store = makeStore()
        store.applyWatchLoggedSet(loggedSet(reps: 7))
        XCTAssertEqual(completedCount(store), 1)
        // 表改过的次数必须原样落进去——这就是表上唯一能改的那个量。
        XCTAssertEqual(store.flow?.observationsByExercise["bench-press"]?.first?.reps, 7)
        XCTAssertEqual(store.flow?.observationsByExercise["bench-press"]?.first?.weightKg, 60)
    }

    func testSameSetTwiceIsRecordedOnlyOnce() {
        // 真实场景：表上记了一组，用户又顺手在手机上点了打勾（或表侧重复投递）。
        // 第二条带的还是第 1 组，此时手机已经在等第 2 组——必须丢弃。
        let store = makeStore()
        store.applyWatchLoggedSet(loggedSet())
        store.applyWatchLoggedSet(loggedSet())
        XCTAssertEqual(completedCount(store), 1)
    }

    func testStaleSetNumberIsDropped() {
        let store = makeStore()
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        // 手机此刻等第 2 组，来了一条第 3 组（表侧状态超前）——不接受。
        store.applyWatchLoggedSet(loggedSet(setNumber: 3))
        XCTAssertEqual(completedCount(store), 1)
    }

    func testWrongExerciseIsDropped() {
        // 手机已经换过动作、表还停在旧的那份 context。
        let store = makeStore()
        store.applyWatchLoggedSet(loggedSet(exerciseId: "squat"))
        XCTAssertEqual(completedCount(store), 0)
    }

    func testSetWithNoActiveSessionIsDropped() {
        // 排队通道意味着消息可能在训练结束之后才送到。
        let store = makeStore()
        store.flow = nil
        store.applyWatchLoggedSet(loggedSet())
        XCTAssertNil(store.flow)
    }
}

private final class FakeDraftStore: TrainSessionDraftStoring {
    func load() -> TrainSessionDraft? { nil }
    func clear() {}
    func enqueueSave(_ draft: TrainSessionDraft) {}
    func saveDurably(_ draft: TrainSessionDraft) -> Bool { true }
}
