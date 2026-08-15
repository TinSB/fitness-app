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

    private func prescription() -> TodayPrescription {
        TodayPrescription(
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
            dayReasons: [])
    }

    private func makeStore() -> SessionStore {
        let store = SessionStore(draftStore: FakeDraftStore())
        store.flow = TrainFlowState(prescription: prescription())
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
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet(reps: 7))
        XCTAssertEqual(completedCount(store), 1)
        // 表改过的次数必须原样落进去——这就是表上唯一能改的那个量。
        XCTAssertEqual(store.flow?.observationsByExercise["bench-press"]?.first?.reps, 7)
        XCTAssertEqual(store.flow?.observationsByExercise["bench-press"]?.first?.weightKg, 60)
    }

    func testSameSetTwiceIsRecordedOnlyOnce() {
        // 真实场景：表上记了一组，用户又顺手在手机上点了打勾（或表侧重复投递）。
        // 第二条带的还是第 1 组，此时手机已经在等第 2 组——必须丢弃。
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet())
        store.applyWatchLoggedSet(loggedSet())
        XCTAssertEqual(completedCount(store), 1)
    }

    func testStaleSetNumberIsDropped() {
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        // 手机此刻等第 2 组，来了一条第 3 组（表侧状态超前）——不接受。
        store.applyWatchLoggedSet(loggedSet(setNumber: 3))
        XCTAssertEqual(completedCount(store), 1)
    }

    func testWrongExerciseIsDropped() {
        // 手机已经换过动作、表还停在旧的那份 context。
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet(exerciseId: "squat"))
        XCTAssertEqual(completedCount(store), 0)
    }

    func testSetWithNoActiveSessionIsDropped() {
        // 排队通道意味着消息可能在训练结束之后才送到。
        let store = makeStore(); finishWarmup(store)
        store.flow = nil
        store.applyWatchLoggedSet(loggedSet())
        XCTAssertNil(store.flow)
    }

    // MARK: - 热身分流（2026-08-15 owner 真机拍到：手机在空杆热身，表上却显示 65 lb 正式组）

    func testWorkingSetIsRejectedWhileWarmingUp() {
        // **最要紧的一条**。热身期间收到正式组消息必须丢弃——
        // 不判的话用户还在空杆，一组工作重量就已经落库了。
        let store = makeStore()
        XCTAssertTrue(store.flow?.isWarmingUp == true, "这个动作应当有热身步，否则本测试没测到东西")
        store.applyWatchLoggedSet(loggedSet())          // isWarmup: false
        XCTAssertEqual(completedCount(store), 0)
    }

    func testWarmupAdvancesPointerWithoutRecordingASet() {
        // 热身**不落库**：只推进热身步，工作组事实必须一条不多。
        let store = makeStore()
        let before = store.flow?.currentWarmupStep?.index
        store.applyWatchLoggedSet(warmupStep(index: before ?? 1))
        XCTAssertEqual(completedCount(store), 0)
        XCTAssertNotEqual(store.flow?.currentWarmupStep?.index, before)
    }

    func testStaleWarmupIndexIsDropped() {
        let store = makeStore()
        store.applyWatchLoggedSet(warmupStep(index: 99))
        XCTAssertEqual(store.flow?.currentWarmupStep?.index, 1)
    }

    func testWorkingSetIsAcceptedOnceWarmupIsDone() {
        // 热身走完之后正式组才收——证明上面那道 guard 不是把正式组永久挡死了。
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet(reps: 7))
        XCTAssertEqual(completedCount(store), 1)
        XCTAssertEqual(store.flow?.observationsByExercise["bench-press"]?.first?.reps, 7)
    }

    /// 走完热身。夹具是杠铃动作、必有热身步——正式组的测试都得先过这一段，
    /// 否则测到的是「热身期间被正确拒绝」而不是它们各自想测的东西。
    private func finishWarmup(_ store: SessionStore) {
        var guardCount = 0
        while store.flow?.isWarmingUp == true, guardCount < 20 {
            store.applyWatchLoggedSet(warmupStep(index: store.flow?.currentWarmupStep?.index ?? 1))
            guardCount += 1
        }
    }

    /// 带真 draft 存储的 store，且已走完热身（正式组测试的共同起点）。
    private func makeStoreWithDraft() -> (SessionStore, FakeDraftStore) {
        let draftStore = FakeDraftStore()
        let store = SessionStore(draftStore: draftStore)
        store.flow = TrainFlowState(prescription: prescription())
        finishWarmup(store)
        return (store, draftStore)
    }

    private func warmupStep(index: Int) -> WatchLoggedSet {
        WatchLoggedSet(exerciseId: "bench-press", setNumber: index, weightKg: 0,
                       reps: 8, rir: 0, loggedAtISO: "t", isWarmup: true)
    }

    // MARK: - 手机 app 在训练中被划掉（owner 2026-08-15 提出）

    func testSetLoggedWhileFlowIsNotYetRestoredSurvivesIntoTheDraft() {
        // 场景：训练中把手机 app 划掉 → 表上仍显示当前组、记一组（排队通道会保证送达）
        // → 重开手机 app。**此刻 flow 还是 nil**——draft 要等用户点「继续训练」才重放，
        // 而排队的那条组正好在这个窗口送达。
        //
        // 修之前：撞上 guard let flow 被静默丢弃。表上已经显示「已记录」，组却没了。
        let (store, draftStore) = makeStoreWithDraft()
        // 先在手机上正常记第 1 组——draft 只在有事件时才产生（热身是纯内存的，不落 draft）
        store.applyWatchLoggedSet(loggedSet(setNumber: 1, reps: 8))
        XCTAssertNotNil(draftStore.stored, "前置条件：记完一组后应当已经存过 draft")
        // 模拟「被划掉」：draft 在盘上，内存里的 flow 没了
        store.flow = nil

        store.applyWatchLoggedSet(loggedSet(setNumber: 2, reps: 7))

        // 重开后用户点「继续训练」→ 重放必须带上表侧那一组
        let restored = draftStore.stored?.restoreFlow()
        let logged = restored?.observationsByExercise["bench-press"] ?? []
        XCTAssertEqual(logged.count, 2, "表上记的那一组必须落进 draft，否则重放后就没了")
        XCTAssertEqual(logged.last?.reps, 7)
    }

    func testStaleSetIsStillDroppedWhenFlowIsNotRestored() {
        // 补进 draft 这条路同样要判幂等——不能因为走了另一条路就放行。
        let (store, draftStore) = makeStoreWithDraft()
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        store.flow = nil
        let before = draftStore.stored?.events.count ?? 0

        store.applyWatchLoggedSet(loggedSet(setNumber: 3))   // 重放后手机等的是第 2 组

        XCTAssertEqual(draftStore.stored?.events.count, before, "组号对不上就不该写进 draft")
    }

    func testSetIsDroppedWhenThereIsNoDraftAtAll() {
        // 训练早就结束、draft 已清——排队通道可能在那之后才把消息送到。
        let draftStore = FakeDraftStore()
        let store = SessionStore(draftStore: draftStore)
        store.flow = nil
        store.applyWatchLoggedSet(loggedSet())
        XCTAssertNil(draftStore.stored)
    }
}

private final class FakeDraftStore: TrainSessionDraftStoring {
    var stored: TrainSessionDraft?
    func load() -> TrainSessionDraft? { stored }
    func clear() { stored = nil }
    func enqueueSave(_ draft: TrainSessionDraft) { stored = draft }
    func saveDurably(_ draft: TrainSessionDraft) -> Bool { stored = draft; return true }
}
