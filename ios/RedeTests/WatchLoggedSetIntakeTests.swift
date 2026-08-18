import XCTest
import RedeL10n
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

    func testSetArrivingWhileRestorePromptIsShowingSurvivesTheActualRestore() {
        // 审查 M2 抓到的漏：手机重开 → loadToday 把磁盘 draft 读进 pendingDraft、弹「继续训练？」→
        // 排队的组这时送到 → 之前只写磁盘不更新 pendingDraft → 用户点「继续」重放的是旧 draft，
        // 那一组照样丢。这条测试走**真实恢复入口** restorePendingDraft()，不直接读 draftStore。
        let (store, draftStore) = makeStoreWithDraft()
        store.applyWatchLoggedSet(loggedSet(setNumber: 1, reps: 8))
        // 模拟「被划掉后重开」：flow 没了，磁盘 draft 已被读进 pendingDraft（loadToday 的效果）
        store.flow = nil
        store.pendingDraft = draftStore.stored

        store.applyWatchLoggedSet(loggedSet(setNumber: 2, reps: 7))   // 提示还挂着，组到了
        store.restorePendingDraft()                                     // 用户点「继续训练」

        let logged = store.flow?.observationsByExercise["bench-press"] ?? []
        XCTAssertEqual(logged.count, 2, "提示挂着时到的那一组必须跟着恢复进来")
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

    // MARK: - v2：表上改过的重量 / RIR 原样落库

    func testAdjustedWeightAndUnrecordedRirAreStoredAsSent() {
        // 表上现在三个量都能改。改过的重量必须原样落进去；「—」= 不记 RIR 必须落成 nil，
        // 不能被任何默认值（目标 RIR 2）顶掉——引擎对 nil 与 2 的处理不同。
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(WatchLoggedSet(exerciseId: "bench-press", setNumber: 1, weightKg: 62.5,
                                                 reps: 6, rir: nil, loggedAtISO: "t"))
        let obs = store.flow?.observationsByExercise["bench-press"]?.first
        XCTAssertEqual(obs?.weightKg, 62.5)
        XCTAssertEqual(obs?.reps, 6)
        XCTAssertNil(obs?.rir)
    }

    // MARK: - v2：遥控命令（休息 +30 / 跳过休息 / 跳过热身）

    private func command(_ action: WatchCommand.Action, exerciseId: String = "bench-press",
                         auto: Bool = false) -> WatchCommand {
        WatchCommand(action: action, exerciseId: exerciseId, auto: auto, sentAtISO: "t")
    }

    /// 记完一组、停在休息态的 store。
    private func makeRestingStore() -> SessionStore {
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        XCTAssertEqual(store.flow?.phase, .resting, "前置：记完一组应进入休息")
        return store
    }

    func testRestSkipEndsRestAndAdvancesToNextSet() {
        let store = makeRestingStore()
        store.applyWatchCommand(command(.restSkip))
        XCTAssertEqual(store.flow?.phase, .activeSet)
        XCTAssertEqual(store.flow?.progress.setNumber, 2)
    }

    func testRestSkipIsIgnoredWhenNotResting() {
        // 表侧 context 滞后：手机早已进下一组，迟到的「跳过休息」什么都不该动。
        let store = makeStore(); finishWarmup(store)
        let before = store.flow
        store.applyWatchCommand(command(.restSkip))
        XCTAssertEqual(store.flow, before)
    }

    func testAutoRestEndIsIgnoredWhilePhoneStillHasTimeLeft() {
        // 表说「倒计时走完了」，但手机刚按过 +30、自己的钟还没到——不能提前结束休息。
        let store = makeRestingStore()
        XCTAssertGreaterThan(store.restRemainingSeconds, 0)
        store.applyWatchCommand(command(.restSkip, auto: true))
        XCTAssertEqual(store.flow?.phase, .resting)
    }

    func testManualRestSkipWinsEvenWithTimeLeft() {
        // 用户在表上按了「下一组」= 明确意图，不受手机剩余时间限制。
        let store = makeRestingStore()
        XCTAssertGreaterThan(store.restRemainingSeconds, 0)
        store.applyWatchCommand(command(.restSkip, auto: false))
        XCTAssertEqual(store.flow?.phase, .activeSet)
    }

    func testRestAdd30ExtendsTheCountdown() {
        let store = makeRestingStore()
        let before = store.restRemainingSeconds
        store.applyWatchCommand(command(.restAdd30))
        XCTAssertGreaterThanOrEqual(store.restRemainingSeconds, before + 29)   // 允许 1 秒墙钟流逝
        XCTAssertEqual(store.flow?.phase, .resting)
    }

    func testCommandForAnotherExerciseIsDropped() {
        let store = makeRestingStore()
        store.applyWatchCommand(command(.restSkip, exerciseId: "squat"))
        XCTAssertEqual(store.flow?.phase, .resting)
    }

    func testRestPauseToggleFreezesAndResumesTheCountdown() {
        let store = makeRestingStore()
        XCTAssertFalse(store.restIsPaused)
        store.applyWatchCommand(command(.restPauseToggle))
        XCTAssertTrue(store.restIsPaused)
        store.applyWatchCommand(command(.restPauseToggle))
        XCTAssertFalse(store.restIsPaused)
        XCTAssertEqual(store.flow?.phase, .resting, "暂停 / 继续不改训练阶段")
    }

    func testRestPauseToggleIsIgnoredWhenNotResting() {
        let store = makeStore(); finishWarmup(store)
        store.applyWatchCommand(command(.restPauseToggle))
        XCTAssertFalse(store.restIsPaused)
    }

    func testSkipSetSkipsExactlyTheSetTheWatchWasLookingAt() {
        let store = makeStore(); finishWarmup(store)
        XCTAssertEqual(store.flow?.progress.setNumber, 1)
        store.applyWatchCommand(WatchCommand(action: .skipSet, exerciseId: "bench-press", sentAtISO: "t",
                                             reason: "equipmentBusy", setNumber: 1))
        XCTAssertEqual(store.flow?.skippedInCurrentExercise, 1)
        XCTAssertEqual(completedCount(store), 0, "跳过不落完成组")
    }

    func testSkipSetWithStaleSetNumberOrUnknownReasonIsDropped() {
        // 组号是幂等键：表侧滞后一拍的重复命令不能把下一组也跳掉；理由码解不出就丢，不猜。
        let store = makeStore(); finishWarmup(store)
        store.applyWatchCommand(WatchCommand(action: .skipSet, exerciseId: "bench-press", sentAtISO: "t",
                                             reason: "equipmentBusy", setNumber: 1))
        store.applyWatchCommand(WatchCommand(action: .skipSet, exerciseId: "bench-press", sentAtISO: "t",
                                             reason: "equipmentBusy", setNumber: 1))   // 重复：手机已在等第 2 组
        XCTAssertEqual(store.flow?.skippedInCurrentExercise, 1)
        store.applyWatchCommand(WatchCommand(action: .skipSet, exerciseId: "bench-press", sentAtISO: "t",
                                             reason: "teleported", setNumber: 2))      // 未知理由码
        XCTAssertEqual(store.flow?.skippedInCurrentExercise, 1)
        store.applyWatchCommand(WatchCommand(action: .skipSet, exerciseId: "bench-press", sentAtISO: "t",
                                             reason: "fatigue", setNumber: nil))       // 没带组号
        XCTAssertEqual(store.flow?.skippedInCurrentExercise, 1)
    }

    func testSkipSetIsIgnoredWhileWarmingUpOrResting() {
        let warm = makeStore()
        XCTAssertTrue(warm.flow?.isWarmingUp == true)
        warm.applyWatchCommand(WatchCommand(action: .skipSet, exerciseId: "bench-press", sentAtISO: "t",
                                            reason: "fatigue", setNumber: 1))
        XCTAssertEqual(warm.flow?.skippedInCurrentExercise, 0)
        let resting = makeRestingStore()
        resting.applyWatchCommand(WatchCommand(action: .skipSet, exerciseId: "bench-press", sentAtISO: "t",
                                               reason: "fatigue", setNumber: 2))
        XCTAssertEqual(resting.flow?.skippedInCurrentExercise, 0)
        XCTAssertEqual(resting.flow?.phase, .resting)
    }

    func testSkipWarmupJumpsToFirstWorkingSet() {
        let store = makeStore()
        XCTAssertTrue(store.flow?.isWarmingUp == true)
        store.applyWatchCommand(command(.skipWarmup))
        XCTAssertFalse(store.flow?.isWarmingUp == true)
        XCTAssertEqual(store.flow?.progress.setNumber, 1)
        XCTAssertEqual(completedCount(store), 0, "跳过热身不落库")
    }

    func testSkipWarmupIsIgnoredOnceWarmupIsOver() {
        let store = makeStore(); finishWarmup(store)
        let before = store.flow
        store.applyWatchCommand(command(.skipWarmup))
        XCTAssertEqual(store.flow, before)
    }

    // MARK: - v2：推给表的重量梯子（手机侧生成，表只在格子间选）

    func testKgBarbellLadderIsCenteredOnTargetAndStepsByGrid() {
        let ladder = SessionStore.watchWeightLadder(aroundKg: 60, equipment: "barbell", unit: .kg)
        XCTAssertEqual(ladder.count, 25)                       // 12 下 + 目标 + 12 上
        XCTAssertEqual(ladder[12], 60)
        XCTAssertEqual(ladder.first, 30)
        XCTAssertEqual(ladder.last, 90)
        XCTAssertEqual(ladder[11], 57.5); XCTAssertEqual(ladder[13], 62.5)
        XCTAssertEqual(ladder, ladder.sorted(), "必须升序，表冠向上 = 更重")
    }

    func testLadderStopsAtTheBottomRungInsteadOfGoingNegative() {
        // 目标离梯子底很近：下方格子不足 12 格就停，绝不出 0 或负重量。
        let ladder = SessionStore.watchWeightLadder(aroundKg: 5, equipment: "barbell", unit: .kg)
        XCTAssertEqual(ladder.first, 2.5)
        XCTAssertTrue(ladder.allSatisfy { $0 > 0 })
        XCTAssertTrue(ladder.contains(5))
    }

    func testLbDumbbellLadderFollowsTheSegmentedRungs() {
        // 磅哑铃轻段 2.5lb 一格、中段 5lb 一格——梯子必须走真实格子，不是等距算术。
        let ladder = SessionStore.watchWeightLadder(aroundKg: 25 / 2.204_622_621_8, equipment: "dumbbell", unit: .lb)
        let lb = ladder.map { ($0 * 2.204_622_621_8 * 2).rounded() / 2 }
        XCTAssertTrue(lb.contains(22.5) && lb.contains(25) && lb.contains(30), "\(lb)")
        XCTAssertFalse(lb.contains(27.5), "25 以上是 5lb 一格，不该出现 27.5：\(lb)")
    }

    // MARK: - v3：休息屏「等下做什么」（手机渲染，与手机休息屏同一分流）

    func testRestPreviewReportsNextSetOrNextExercise() {
        let zh = RedeStrings(locale: .zh, unit: .kg)
        // 本动作还有组：报下一组
        XCTAssertEqual(
            SessionStore.watchRestPreview(currentExerciseDone: false, nextExerciseId: "lat-pulldown", loadType: "external",
                                          setNumber: 3, snappedKg: 22.5, targetReps: 6, strings: zh),
            zh.restNextPreview(setNumber: 3, kg: "22.5", reps: 6))
        // 本动作做完了：报下一个动作，而不是「× 0」（那正是 v2 露出来的缺陷）
        let next = SessionStore.watchRestPreview(currentExerciseDone: true, nextExerciseId: "lat-pulldown", loadType: "external",
                                                 setNumber: 3, snappedKg: 22.5, targetReps: 0, strings: zh)
        XCTAssertEqual(next, zh.restNextExercise(ExerciseCatalog.minimal.displayName("lat-pulldown", localeCode: "zh")))
        XCTAssertFalse(next.contains("× 0"))
        // 自重走自重口径
        XCTAssertEqual(
            SessionStore.watchRestPreview(currentExerciseDone: false, nextExerciseId: nil, loadType: "bodyweight",
                                          setNumber: 2, snappedKg: 0, targetReps: 8, strings: zh),
            zh.restNextPreviewBodyweight(setNumber: 2, reps: 8))
    }

    func testRepBasedExercisesGetNoWeightAxis() {
        let strings = RedeStrings(locale: .zh, unit: .kg)
        let bw = SessionStore.watchAdjust(loadType: "bodyweight", targetWeightKg: 0,
                                          gridEquipment: "bodyweight", unit: .kg, strings: strings)
        XCTAssertTrue(bw.weightRungs.isEmpty)
        let assisted = SessionStore.watchAdjust(loadType: "assisted", targetWeightKg: 40,
                                                gridEquipment: "selectorized", unit: .kg, strings: strings)
        XCTAssertEqual(assisted.weightCaption, "辅助 kg")
        XCTAssertTrue(assisted.weightRungs.map(\.text).contains("40"))
        let external = SessionStore.watchAdjust(loadType: "external", targetWeightKg: 60,
                                                gridEquipment: "barbell", unit: .lb,
                                                strings: RedeStrings(locale: .en, unit: .lb))
        XCTAssertEqual(external.weightCaption, "lb")
        // 显示串按当前单位渲染（60 kg ≈ 132 lb 落在 5lb 格 → 130 或 135）
        XCTAssertTrue(external.weightRungs.map(\.text).contains(where: { $0 == "130" || $0 == "135" }),
                      "\(external.weightRungs.map(\.text))")
    }
}

private final class FakeDraftStore: TrainSessionDraftStoring {
    var stored: TrainSessionDraft?
    func load() -> TrainSessionDraft? { stored }
    func clear() { stored = nil }
    func enqueueSave(_ draft: TrainSessionDraft) { stored = draft }
    func saveDurably(_ draft: TrainSessionDraft) -> Bool { stored = draft; return true }
}
