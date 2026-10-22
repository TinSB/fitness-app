import XCTest
import RedeDataHealth
import RedeDomain
import RedeHealthKit
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

    /// 默认「刚在表上点的」：休息从表上那一下起算（v4），写死一个过去的时刻会让每段休息一到就已结束。
    private func loggedSet(exerciseId: String = "bench-press", setNumber: Int = 1,
                           reps: Int = 8, loggedAt: Date = Date()) -> WatchLoggedSet {
        WatchLoggedSet(exerciseId: exerciseId, setNumber: setNumber, weightKg: 60,
                       reps: reps, rir: 2, loggedAtISO: ISO8601DateFormatter().string(from: loggedAt))
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
        // 排队通道意味着消息可能在训练结束之后才送到：那时草稿已清，没有可接回的训练。
        let (store, draftStore) = makeStoreWithDraft()
        store.flow = nil
        draftStore.clear()
        store.applyWatchLoggedSet(loggedSet())
        XCTAssertNil(store.flow)
    }

    // MARK: - 热身分流（2026-08-15 owner 真机拍到：手机在空杆热身，表上却显示 65 lb 正式组）

    func testFirstWorkingSetFromTheWatchSkipsWhatIsLeftOfThePhonesWarmup() {
        // v3.11：表只会在自己做完或跳过热身之后才发这个动作的第 1 组（手机推来的正式组，或表按计划
        // 自己走过了热身）。手机还停在热身里，是因为热身步没送到、或草稿重放后热身指针从头开始——
        // 这时把手机剩下的热身跳过、收下这一组；不收的话之后的组号全对不上，整个动作丢光。
        let store = makeStore()
        XCTAssertTrue(store.flow?.isWarmingUp == true, "这个动作应当有热身步，否则本测试没测到东西")
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        XCTAssertEqual(completedCount(store), 1)
        XCTAssertEqual(store.flow?.isWarmingUp, false)
    }

    func testLaterWorkingSetIsStillRejectedWhileThePhoneIsWarmingUp() {
        // 只有第 1 组能让手机跳过热身：热身里来一条第 2 组，说明两边对不上，什么都不动。
        let store = makeStore()
        store.applyWatchLoggedSet(loggedSet(setNumber: 2))
        XCTAssertEqual(completedCount(store), 0)
        XCTAssertEqual(store.flow?.isWarmingUp, true)
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

    // MARK: - 手机 app 在训练中被划掉 / 被系统收走（owner 2026-08-15 提出；v3.11 起自动接回）

    func testSetLoggedAfterThePhoneWasKilledResumesTheTraining() {
        // 场景：训练中手机 app 被收走 → 表上照样记一组（排队通道保证送达，即时消息把手机叫醒）。
        // v3.11 以前：组只写进草稿，要等人点「继续训练」，下一组没人算，表卡在原地（owner 2026-10-21）。
        // 现在：直接把训练接回来，这一组走和手机上一样的那条路，不弹「继续训练？」。
        let (store, draftStore) = makeStoreWithDraft()
        // 先正常记第 1 组——draft 只在有事件时才产生（热身是纯内存的，不落 draft）
        store.applyWatchLoggedSet(loggedSet(setNumber: 1, reps: 8))
        XCTAssertNotNil(draftStore.stored, "前置条件：记完一组后应当已经存过 draft")
        // 模拟「被收走」：draft 在盘上，内存里的 flow 没了
        store.flow = nil

        store.applyWatchLoggedSet(loggedSet(setNumber: 2, reps: 7))

        XCTAssertNotNil(store.flow, "表上的组一到，训练就接回来了")
        XCTAssertNil(store.pendingDraft, "不再问「继续训练？」")
        let logged = store.flow?.observationsByExercise["bench-press"] ?? []
        XCTAssertEqual(logged.count, 2)
        XCTAssertEqual(logged.last?.reps, 7)
        XCTAssertEqual(draftStore.stored?.restoreFlow()?.observationsByExercise["bench-press"]?.count, 2,
                       "草稿也带上了这一组")
    }

    func testSetArrivingWhileRestorePromptIsShowingResumesTheTraining() {
        // 手机重开 → loadToday 把磁盘 draft 读进 pendingDraft、弹「继续训练？」→ 表上的组这时送到：
        // 人正在表上练，直接接回、收下这一组，提示随之消失（之后再点「继续」什么都不发生）。
        let (store, draftStore) = makeStoreWithDraft()
        store.applyWatchLoggedSet(loggedSet(setNumber: 1, reps: 8))
        store.flow = nil
        store.pendingDraft = draftStore.stored

        store.applyWatchLoggedSet(loggedSet(setNumber: 2, reps: 7))   // 提示还挂着，组到了
        XCTAssertNil(store.pendingDraft)
        store.restorePendingDraft()                                     // 迟一步点的「继续训练」

        let logged = store.flow?.observationsByExercise["bench-press"] ?? []
        XCTAssertEqual(logged.count, 2)
        XCTAssertEqual(logged.last?.reps, 7)
    }

    func testDraftPathCopyIsRememberedSoALateSecondCopyAfterUndoIsDropped() {
        // 两条通道：第一份在手机刚重开、还没恢复训练时到，走草稿那条路；用户点「继续」、在手机上撤销这一组，
        // 排队的第二份这时才到——不能把撤销掉的组记回来（审查 2026-10-19：草稿那条路原来没记住）。
        let (store, draftStore) = makeStoreWithDraft()
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        store.flow = nil
        store.pendingDraft = draftStore.stored
        let second = loggedSet(setNumber: 2, reps: 7)
        store.applyWatchLoggedSet(second)            // 即时消息那份：进草稿
        store.restorePendingDraft()
        XCTAssertEqual(completedCount(store), 2)
        XCTAssertTrue(store.undoLastSet())
        store.applyWatchLoggedSet(second)            // 排队那份迟到
        XCTAssertEqual(completedCount(store), 1, "撤销掉的那一组不能被迟到的副本记回来")
    }

    func testStaleSetIsDroppedEvenThoughTheTrainingResumes() {
        // 接回之后同样要判幂等——不能因为走了另一条路就放行。
        let (store, draftStore) = makeStoreWithDraft()
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        store.flow = nil
        let before = draftStore.stored?.events.count ?? 0

        store.applyWatchLoggedSet(loggedSet(setNumber: 3))   // 重放后手机等的是第 2 组

        XCTAssertEqual(draftStore.stored?.events.count, before, "组号对不上就不该写进 draft")
        XCTAssertEqual(completedCount(store), 1)
    }

    func testSetIsDroppedWhenThereIsNoDraftAtAll() {
        // 训练早就结束、draft 已清——排队通道可能在那之后才把消息送到。
        let draftStore = FakeDraftStore()
        let store = SessionStore(draftStore: draftStore)
        store.flow = nil
        store.applyWatchLoggedSet(loggedSet())
        XCTAssertNil(draftStore.stored)
    }

    // MARK: - 整场在表上练完、没回手机点保存（owner 2026-10-19：手机没在看时自动存）

    private func watchSet(_ n: Int, at iso: String) -> WatchLoggedSet {
        WatchLoggedSet(exerciseId: "bench-press", setNumber: n, weightKg: 60, reps: 8, rir: 2, loggedAtISO: iso)
    }

    /// 相对现在的时刻串（接回要求草稿在恢复窗口内，记组时刻也不早于开练）。
    private func isoMinutesAgo(_ minutes: Double) -> String {
        ISO8601DateFormatter().string(from: Date().addingTimeInterval(-minutes * 60))
    }

    private func freshDraft(startedAt: Date = Date(), events: [TrainFlowEvent] = []) -> TrainSessionDraft {
        TrainSessionDraft(dateISO: SessionStore.localDayISO(startedAt), startedAt: startedAt,
                          prescription: prescription(), events: events)
    }

    func testFirstSetOfAnExerciseIsAcceptedAfterAResumeDespiteItsWarmupLadder() {
        // 审查 2026-10-19：手机这边热身指针重放后从头开始，表上已经热完身发来的第 1 组曾被热身守卫拦掉，
        // 之后组号再也对不上，整段丢光。接回之后第 1 组让手机跳过剩下的热身，第 2 组让手机结束那段休息。
        let draftStore = FakeDraftStore()
        draftStore.stored = freshDraft(startedAt: Date().addingTimeInterval(-30 * 60))
        let store = SessionStore(draftStore: draftStore)
        XCTAssertFalse(TrainFlowState(prescription: prescription()).warmupStepsForCurrentExercise.isEmpty,
                       "前置条件：卧推 60 kg 有热身阶梯")
        let first = isoMinutesAgo(20), second = isoMinutesAgo(17)

        store.applyWatchLoggedSet(watchSet(1, at: first))
        store.applyWatchLoggedSet(watchSet(2, at: second))

        let logged = draftStore.stored?.restoreFlow()?.observationsByExercise["bench-press"] ?? []
        XCTAssertEqual(logged.count, 2)
        XCTAssertEqual(logged.map(\.completedAt), [first, second],
                       "记组时刻取表上那一下，不是很久之后收到的时刻")
    }

    func testLastSetAfterAResumeRecordsEndTimeAndSavesWhenNobodyIsLooking() async {
        // 整场后半段都在表上练、手机在口袋里：最后一组到了就存好，不问「继续训练？」。
        let draftStore = FakeDraftStore()
        draftStore.stored = freshDraft(startedAt: Date().addingTimeInterval(-30 * 60))
        let store = SessionStore(draftStore: draftStore)
        store.appInForeground = false
        let saved = expectation(description: "自动保存")
        store.persistFinishedSession = { saved.fulfill(); return true }
        let last = isoMinutesAgo(14)

        store.applyWatchLoggedSet(watchSet(1, at: isoMinutesAgo(20)))
        store.applyWatchLoggedSet(watchSet(2, at: isoMinutesAgo(17)))
        store.applyWatchLoggedSet(watchSet(3, at: last))

        await fulfillment(of: [saved], timeout: 2)
        XCTAssertNil(store.pendingDraft, "练完的一场不再问「继续训练？」")
        XCTAssertEqual(store.flow?.phase, .summary)
        let end = ISO8601DateFormatter().date(from: last)
        XCTAssertEqual(draftStore.stored?.endedAt, end, "结束时刻取表上最后一组，不是收到那一刻")
        XCTAssertEqual(store.sessionEndedAt, end)
    }

    func testLastWatchSetSavesAutomaticallyOnlyWhenNobodyIsLookingAtThePhone() async throws {
        // 手机锁着：表上记完最后一组 → 直接存。
        let pocket = makeStore(); finishWarmup(pocket)
        pocket.appInForeground = false
        let savedNow = expectation(description: "锁着的手机直接存")
        pocket.persistFinishedSession = { savedNow.fulfill(); return true }
        logThreeSetsFromTheWatch(pocket)
        await fulfillment(of: [savedNow], timeout: 2)

        // 手机放在凳子上、屏幕常亮（还算在前台）：先不存，小结等着；到小结后屏幕自动锁上 → 那一刻才存
        //（审查 2026-10-19：只在表上那一下判一次，会漏掉最常见的这种）。
        let bench = makeStore(); finishWarmup(bench)
        bench.appInForeground = true
        var calls = 0
        let savedOnLock = expectation(description: "锁屏后存")
        bench.persistFinishedSession = { calls += 1; savedOnLock.fulfill(); return true }
        logThreeSetsFromTheWatch(bench)
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(calls, 0, "手机开着：照旧弹小结由人点保存")
        bench.appInForeground = false
        await fulfillment(of: [savedOnLock], timeout: 2)
        bench.appInForeground = true
        bench.appInForeground = false
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(calls, 1, "一场只自动存一次")
    }

    func testSummaryFinishedOnThePhoneIsNotAutoSavedWhenThePhoneLocks() async throws {
        // 在手机上点完最后一组的人正看着小结：锁屏走开也由他自己决定。
        let store = makeStore(); finishWarmup(store)
        var calls = 0
        store.persistFinishedSession = { calls += 1; return true }
        for n in 1...3 {
            store.apply(.logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)))
            if n < 3 { store.apply(.restFinished) }
        }
        XCTAssertEqual(store.flow?.phase, .summary)
        store.appInForeground = false
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(calls, 0)
    }

    private func logThreeSetsFromTheWatch(_ store: SessionStore) {
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        store.apply(.restFinished)
        store.applyWatchLoggedSet(loggedSet(setNumber: 2))
        store.apply(.restFinished)
        store.applyWatchLoggedSet(loggedSet(setNumber: 3))
        XCTAssertEqual(store.flow?.phase, .summary)
    }

    // 数据体检 2026-10-19：手机进程还活着、但排队的组晚到时，记组时刻与结束时刻用表上那一下，
    // 不用手机收到的时刻（否则组刻线挤到后面、时长被拉长）。
    func testLiveWatchSetsKeepTheWatchTimeAndTheLastOneEndsTheSession() {
        let store = makeStore(); finishWarmup(store)
        store.sessionStartedAt = ISO8601DateFormatter().date(from: "2026-10-19T09:30:00Z")
        store.applyWatchLoggedSet(watchSet(1, at: "2026-10-19T10:00:00Z"))
        store.apply(.restFinished)
        store.applyWatchLoggedSet(watchSet(2, at: "2026-10-19T10:03:00Z"))
        store.apply(.restFinished)
        store.applyWatchLoggedSet(watchSet(3, at: "2026-10-19T10:06:00Z"))

        XCTAssertEqual(store.flow?.phase, .summary)
        XCTAssertEqual(store.flow?.observationsByExercise["bench-press"]?.map(\.completedAt),
                       ["2026-10-19T10:00:00Z", "2026-10-19T10:03:00Z", "2026-10-19T10:06:00Z"])
        XCTAssertEqual(store.sessionEndedAt, ISO8601DateFormatter().date(from: "2026-10-19T10:06:00Z"))
        let now = Date()
        XCTAssertEqual(SessionStore.watchLoggedAt("2099-01-01T00:00:00Z", startedAt: nil, now: now), now, "表钟偏快：按现在")
        XCTAssertNil(SessionStore.watchLoggedAt("t", startedAt: nil, now: now), "解析不了：交给手机盖章")
    }

    func testFinishedLegacyDraftWithoutAnyTimeIsAskedNotAutoSaved() async throws {
        // build 40 表上补组那条路没记结束时刻、组也没有记组时刻：不知道这场什么时候结束，
        // 按「重开那一刻」存会凭空多出几个小时、存了又删不掉——照旧问（数据体检 2026-10-19）。
        let events: [TrainFlowEvent] = [
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)), .restFinished,
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)), .restFinished,
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)),
        ]
        let draftStore = FakeDraftStore()
        draftStore.stored = freshDraft(events: events)
        let store = SessionStore(draftStore: draftStore)
        var calls = 0
        store.persistFinishedSession = { calls += 1; return true }

        store.checkForRestorableDraft()
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(calls, 0)
        XCTAssertNotNil(store.pendingDraft, "照旧弹「继续训练？」")

        // 组带记组时刻：取最后一组当结束时刻，照常自动存。
        let stamped: [TrainFlowEvent] = [
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2).stamped(at: "2026-10-19T10:00:00Z")), .restFinished,
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2).stamped(at: "2026-10-19T10:03:00Z")), .restFinished,
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2).stamped(at: "2026-10-19T10:06:00Z")),
        ]
        let draftStore2 = FakeDraftStore()
        draftStore2.stored = freshDraft(events: stamped)
        let store2 = SessionStore(draftStore: draftStore2)
        let saved = expectation(description: "自动保存")
        store2.persistFinishedSession = { saved.fulfill(); return true }
        store2.checkForRestorableDraft()
        await fulfillment(of: [saved], timeout: 2)
        XCTAssertEqual(store2.sessionEndedAt, ISO8601DateFormatter().date(from: "2026-10-19T10:06:00Z"))
    }

    func testFinishedDraftFoundAtLaunchIsSavedEvenAfter36Hours() async {
        // 小结里没点保存就离开、App 随后被系统收走：此前过了 36 小时会被静默删掉。
        let events: [TrainFlowEvent] = [
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)), .restFinished,
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)), .restFinished,
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)),
        ]
        let started = Date().addingTimeInterval(-40 * 3600)
        let draftStore = FakeDraftStore()
        draftStore.stored = freshDraft(startedAt: started, events: events).ending(at: started.addingTimeInterval(3600))
        let store = SessionStore(draftStore: draftStore)
        let saved = expectation(description: "自动保存")
        store.persistFinishedSession = { saved.fulfill(); return true }

        store.checkForRestorableDraft()

        await fulfillment(of: [saved], timeout: 2)
        XCTAssertNil(store.pendingDraft)
        XCTAssertEqual(store.flow?.phase, .summary)
        XCTAssertEqual(store.sessionEndedAt, started.addingTimeInterval(3600))
    }

    func testUnfinishedDraftPastTheWindowIsSavedAsAnEarlyEndNotDeleted() async {
        // owner 2026-10-20「数据怎么能删呢」：练到一半（两组）就没再打开，过了 36 小时。
        // 以前下次启动直接删文件；现在按「提前结束」存成一场，结束时刻取最后一组。
        let started = Date().addingTimeInterval(-40 * 3600)
        let lastSet = started.addingTimeInterval(120)
        let iso = ISO8601DateFormatter()
        let events: [TrainFlowEvent] = [
            .logSet(CompletedSetObservation(weightKg: 31.75, reps: 6, rir: 3,
                                            completedAt: iso.string(from: started.addingTimeInterval(10)))),
            .restFinished,
            .logSet(CompletedSetObservation(weightKg: 31.75, reps: 6, rir: 3, completedAt: iso.string(from: lastSet))),
            .restFinished,
        ]
        let draftStore = FakeDraftStore()
        draftStore.stored = freshDraft(startedAt: started, events: events)
        let store = SessionStore(draftStore: draftStore)
        let saved = expectation(description: "存成一场")
        store.persistFinishedSession = { saved.fulfill(); return true }

        store.checkForRestorableDraft()

        await fulfillment(of: [saved], timeout: 2)
        XCTAssertEqual(store.flow?.phase, .summary)
        XCTAssertEqual(store.flow?.endReason, .other)
        XCTAssertEqual(completedCount(store), 2, "两组都在")
        XCTAssertEqual(store.sessionEndedAt, iso.date(from: iso.string(from: lastSet)))
        XCTAssertNotNil(draftStore.stored, "存好之前草稿文件不动")
    }

    func testEmptyDraftPastTheWindowIsStillCleared() {
        // 一组没记的过期草稿只有计划、没有数据：照旧清掉，不弹也不存。
        let draftStore = FakeDraftStore()
        draftStore.stored = freshDraft(startedAt: Date().addingTimeInterval(-40 * 3600), events: [])
        let store = SessionStore(draftStore: draftStore)
        store.checkForRestorableDraft()
        XCTAssertNil(draftStore.stored)
        XCTAssertNil(store.flow)
    }

    func testYoungCrossDayDraftWithoutSetsWaitsForLateWatchSets() {
        // 整场在表上练、手机侧一组没记：第二天打开手机时草稿里还没有组。此前先被当空草稿删掉，
        // 随后送到的表上组无处可去。（过了 36 小时的空草稿照旧清掉，见上一条。）
        let started = Date().addingTimeInterval(-14 * 3600)
        let draftStore = FakeDraftStore()
        draftStore.stored = TrainSessionDraft(dateISO: "2000-01-01", startedAt: started,
                                              prescription: prescription(), events: [])
        let store = SessionStore(draftStore: draftStore)

        store.checkForRestorableDraft()
        XCTAssertNotNil(draftStore.stored, "窗口内的空草稿不删")
        XCTAssertNil(store.pendingDraft, "也不问：里面没有可继续的")

        // 表上的组到了：v3.11 起直接接回这场训练（不再先写草稿、再问「继续训练？」）。
        store.applyWatchLoggedSet(watchSet(1, at: isoMinutesAgo(13 * 60)))
        XCTAssertNil(store.pendingDraft)
        XCTAssertEqual(store.flow?.observationsByExercise["bench-press"]?.count, 1)
        XCTAssertEqual(draftStore.stored?.restoreFlow()?.observationsByExercise["bench-press"]?.count, 1)
    }

    func testWatchDoneCountIncludesTheUnsavedSessionInTheSummary() {
        var flow = TrainFlowState(prescription: prescription())
        flow.skipAllWarmup()
        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2))
        XCTAssertEqual(SessionStore.watchCompletedSetsToday(savedToday: 5, flow: flow, summaryStartedToday: true, awaitingReload: 0), 5,
                       "训练中：只算已存的")
        flow.restFinished()
        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2))
        flow.restFinished()
        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2))
        XCTAssertEqual(flow.phase, .summary)
        XCTAssertEqual(SessionStore.watchCompletedSetsToday(savedToday: 5, flow: flow, summaryStartedToday: true, awaitingReload: 0), 8,
                       "到了小结、还没点保存：表上也该说练完了")
        XCTAssertEqual(SessionStore.watchCompletedSetsToday(savedToday: 0, flow: flow, summaryStartedToday: false, awaitingReload: 0), 0,
                       "昨天开练、一直没存的那场不算今天")
        XCTAssertEqual(SessionStore.watchCompletedSetsToday(savedToday: 0, flow: nil, summaryStartedToday: false, awaitingReload: 3), 3,
                       "刚存好、今日还没重载：不闪回清单")
    }

    // MARK: - v2：表上改过的重量 / RIR 原样落库

    // MARK: - 点完成即休息（v4，Master v3.9 §5 第 4 / 6 条，owner 2026-10-19）

    func testRestStartsWhenTheSetWasTappedOnTheWatchNotWhenItReachedThePhone() {
        // 手机在口袋里睡着，组晚 40 秒才送到：手机的休息从表上点下那一刻起算，与表上已经在走的倒计时对齐。
        let store = makeStore(); finishWarmup(store)
        store.sessionStartedAt = Date().addingTimeInterval(-600)
        store.applyWatchLoggedSet(loggedSet(loggedAt: Date().addingTimeInterval(-40)))
        XCTAssertEqual(store.flow?.phase, .resting)
        XCTAssertEqual(Double(store.restRemainingSeconds), 80, accuracy: 2, "120 秒休息已经过去 40 秒")
    }

    func testSetThatArrivesAfterItsWholeRestEndsTheRestOnTheWatchesNextNudge() {
        // 整段休息都过去了才送到：手机的倒计时一开始就是 0。表收到这份「已过点的休息」推送后补发
        //「休息走完了」（RestCountdownView 的任务绑了每份推送），手机照它自己的钟收尾、进下一组。
        let store = makeStore(); finishWarmup(store)
        store.sessionStartedAt = Date().addingTimeInterval(-600)
        store.applyWatchLoggedSet(loggedSet(loggedAt: Date().addingTimeInterval(-200)))
        XCTAssertEqual(store.restRemainingSeconds, 0)
        store.applyWatchCommand(command(.restSkip, auto: true))
        XCTAssertEqual(store.flow?.phase, .activeSet)
        XCTAssertEqual(store.flow?.progress.setNumber, 2)
    }

    func testTheSameSetArrivingOnTheSecondChannelAfterAnUndoIsNotRecordedAgain() {
        // 同一组走两条通道各到一次。第一份到了、用户在手机上撤销，第二份才到——不能把撤销掉的组记回来。
        let store = makeStore(); finishWarmup(store)
        let set = loggedSet()
        store.applyWatchLoggedSet(set)
        XCTAssertTrue(store.undoLastSet())
        XCTAssertEqual(store.flow?.phase, .activeSet)
        store.applyWatchLoggedSet(set)
        XCTAssertEqual(completedCount(store), 0)
        // 用户之后真在表上重新做了这一组（新的一下 = 新的身份）：照收。
        store.applyWatchLoggedSet(loggedSet(loggedAt: Date().addingTimeInterval(1)))
        XCTAssertEqual(completedCount(store), 1)
    }

    func testWatchIsToldHowLongTheRestAfterThisSetWillBeAndWhatComesNext() {
        let store = makeStore()
        XCTAssertNil(store.restAfterCurrentSet(), "热身步之后不起表上预休息")
        finishWarmup(store)
        let first = store.restAfterCurrentSet()
        XCTAssertEqual(first?.seconds, 120)
        XCTAssertEqual(first?.nextSetNumber, 2)
        XCTAssertNil(first?.nextExerciseId)
        // 休息中不再给（表上已经在休息）。
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        XCTAssertNil(store.restAfterCurrentSet())
        // 本场对这个动作 +30：下一段休息按调整后的时长。
        store.addRestTime(30)
        store.apply(.restFinished)
        XCTAssertEqual(store.restAfterCurrentSet()?.seconds, 150)
        store.applyWatchLoggedSet(loggedSet(setNumber: 2))
        store.apply(.restFinished)
        // 全场最后一组：之后进小结，没有休息——表上不能多出一段。
        XCTAssertNil(store.restAfterCurrentSet())
    }

    func testLastSetOfANonFinalExercisePreviewsTheNextExercise() {
        let two = TodayPrescription(
            dayCode: "push-a",
            exercises: prescription().exercises + [
                ExercisePrescriptionPlan(
                    exerciseId: "overhead-press", sets: 2, restSeconds: 90,
                    repLowerBound: 6, repUpperBound: 10, targetReps: 8,
                    targetWeightKg: 40, targetRir: 2, previousWeightKg: nil,
                    previousTopReps: nil, nextProjectedWeightKg: 42.5,
                    progressionStepKg: 2.5, change: .start, reason: .firstExposure,
                    loadType: "external", equipment: "barbell", progressionPauseReason: nil)
            ],
            dayReasons: [])
        let store = SessionStore(draftStore: FakeDraftStore())
        store.flow = TrainFlowState(prescription: two)
        finishWarmup(store)
        for n in 1...2 {
            store.applyWatchLoggedSet(loggedSet(setNumber: n))
            store.apply(.restFinished)
        }
        let last = store.restAfterCurrentSet()
        XCTAssertEqual(last?.seconds, 120, "动作间休息仍按刚做完的这个动作")
        XCTAssertNil(last?.nextSetNumber)
        XCTAssertEqual(last?.nextExerciseId, "overhead-press")
    }

    func testRestPreviewLayersMatchTheOneLineVersion() {
        let strings = RedeStrings(locale: .zh)
        let same = SessionStore.watchRestPreviewLayers(currentExerciseDone: false, nextExerciseId: nil,
                                                       loadType: "external", setNumber: 3, weightKg: 60,
                                                       targetReps: 8, strings: strings)
        XCTAssertEqual(same?.caption, "下一组 · 第 3 组")
        XCTAssertEqual(same?.parts?.value, "60")
        XCTAssertEqual(same?.parts?.reps, "× 8")
        XCTAssertEqual(same?.spoken, SessionStore.watchRestPreview(
            currentExerciseDone: false, nextExerciseId: nil, loadType: "external", setNumber: 3,
            weightKg: 60, targetReps: 8, strings: strings), "分层版念出来与整句逐字一致")
        let next = SessionStore.watchRestPreviewLayers(currentExerciseDone: true, nextExerciseId: "lat-pulldown",
                                                       loadType: "external", setNumber: 4, weightKg: 60,
                                                       targetReps: 0, strings: strings)
        XCTAssertEqual(next?.caption, "接下来")
        XCTAssertNil(next?.parts)
        XCTAssertEqual(next?.spoken, SessionStore.watchRestPreview(
            currentExerciseDone: true, nextExerciseId: "lat-pulldown", loadType: "external", setNumber: 4,
            weightKg: 60, targetReps: 0, strings: strings))
        XCTAssertEqual(SessionStore.watchAfterSetPreview(nextSetNumber: 2, nextExerciseId: nil, strings: strings)?.caption,
                       "下一组 · 第 2 组")
        XCTAssertNil(SessionStore.watchAfterSetPreview(nextSetNumber: 2, nextExerciseId: nil, strings: strings)?.parts,
                     "预休息不带目标：下一组练多少要等手机算")
    }

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

    private func command(_ action: WatchCommand.Action, exerciseId: String = "bench-press", auto: Bool = false,
                         reason: String? = nil, setNumber: Int? = nil) -> WatchCommand {
        WatchCommand(action: action, exerciseId: exerciseId, auto: auto, sentAtISO: "t",
                     reason: reason, setNumber: setNumber)
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

    func testSkipSetForAStepTheWatchCouldNotBeOnIsIgnored() {
        // v3.11：表上跳过的是手机下一步要等的那一组时，手机先补上（跳过剩下的热身 / 结束这段休息）再跳，
        // 见 testWatchSkipOfTheNextSetCatchesUpLikeASet。组号对不上的照旧什么都不动：
        // 热身里来一条「跳过第 2 组」、第 1 组后的休息里来一条「跳过第 3 组」。
        let warm = makeStore()
        XCTAssertTrue(warm.flow?.isWarmingUp == true)
        warm.applyWatchCommand(WatchCommand(action: .skipSet, exerciseId: "bench-press", sentAtISO: "t",
                                            reason: "fatigue", setNumber: 2))
        XCTAssertEqual(warm.flow?.skippedInCurrentExercise, 0)
        XCTAssertEqual(warm.flow?.isWarmingUp, true)
        let resting = makeRestingStore()
        resting.applyWatchCommand(WatchCommand(action: .skipSet, exerciseId: "bench-press", sentAtISO: "t",
                                               reason: "fatigue", setNumber: 3))
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

    func testAnOffGridTargetSitsOnTheWatchLadderItself() {
        // 引擎保持真能配出的离格重量（5 lb 一格的选重机加 2.5 lb 小片的 47.5 lb；2026-10-20 第二批选重机改 5 lb
        // 一格之前例子是 10 lb 一格上的 45）：梯子里要有 47.5 本身，表上默认显示的就是它；不然表冠停在最近的
        // 一格，手腕显示 50、记下的却是 47.5（审查 2026-10-20）。
        let lbPerKg = 2.204_622_621_8
        let ladder = SessionStore.watchWeightLadder(aroundKg: 47.5 / lbPerKg, equipment: "selectorized", unit: .lb)
        let lbs = ladder.map { ($0 * lbPerKg * 1000).rounded() / 1000 }
        XCTAssertTrue(lbs.contains(47.5), "处方本身在梯子上")
        XCTAssertTrue(lbs.contains(45) && lbs.contains(50), "两边的真实格子照旧")
        XCTAssertEqual(lbs, lbs.sorted(), "仍是升序")
        // 换算残值（30 kg = 66.1 lb）不是真能配出的重量：不塞进梯子，照旧吸附。
        let converted = SessionStore.watchWeightLadder(aroundKg: 30, equipment: "dumbbell", unit: .lb)
        XCTAssertFalse(converted.contains { abs($0 - 30) < 1e-6 })
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
                                          setNumber: 3, weightKg: 22.5, targetReps: 6, strings: zh),
            zh.restNextPreview(setNumber: 3, kg: "22.5", reps: 6))
        // 本动作做完了：报下一个动作，而不是「× 0」（那正是 v2 露出来的缺陷）
        let next = SessionStore.watchRestPreview(currentExerciseDone: true, nextExerciseId: "lat-pulldown", loadType: "external",
                                                 setNumber: 3, weightKg: 22.5, targetReps: 0, strings: zh)
        XCTAssertEqual(next, zh.restNextExercise(ExerciseCatalog.minimal.displayName("lat-pulldown", localeCode: "zh")))
        XCTAssertFalse(next.contains("× 0"))
        // 自重走自重口径
        XCTAssertEqual(
            SessionStore.watchRestPreview(currentExerciseDone: false, nextExerciseId: nil, loadType: "bodyweight",
                                          setNumber: 2, weightKg: 0, targetReps: 8, strings: zh),
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

    // MARK: - v3.8：开训时拉起手表（startWatchApp 的手机那一半）
    //
    // 「表真的亮起来、真的开始采心率」只能真机验（模拟器不配对、也没有心率）。
    // 但手机这一半**什么时候该敲门、什么时候绝不能敲**是纯逻辑，钉死在这里：
    // 敲多了是每次开训都给没表的用户制造一条系统错误；敲漏了就是 owner 原来那个问题。

    /// 一个真正能开训的今日（有处方）。startSession 的 guard 认的就是 todayModel?.prescription。
    private func storeForStart(launcher: LaunchRecorder, watchPresent: Bool,
                               prescription rx: TodayPrescription?) throws -> SessionStore {
        let store = SessionStore(draftStore: FakeDraftStore(),
                                 watchWorkoutLauncher: launcher,
                                 watchCounterpartPresent: { watchPresent })
        store.todayOutcome = try readyOutcome(prescription: rx)
        return store
    }

    private func readyOutcome(prescription rx: TodayPrescription?) throws -> TodayModel.LoadOutcome {
        let raw = try JSONDecoder().decode(AppData.self, from: Data(#"{"schemaVersion":11}"#.utf8))
        return .ready(TodayModel(
            verdict: TodayVerdict(call: .train, reason: .normalProgression, signals: []),
            prescription: rx,
            cleanView: CleanAppDataView(raw: raw, sessions: [],
                                        profile: CleanProfile(equipmentScenario: nil, unitSystem: "kg"),
                                        program: CleanProgram(splitType: "push-pull-legs"), issues: []),
            now: Date(),
            coachActions: [], substitutions: [:], oneTimeSubstitutions: [:],
            equipmentScenario: nil, daySequence: ["push-a"], scheduledDayCode: "push-a",
            weeklyCycleRestart: false))
    }

    func testStartingTrainingAsksTheWatchToStartExactlyOnce() async throws {
        let asked = expectation(description: "手机请求拉起手表")
        asked.expectedFulfillmentCount = 1   // 默认 assertForOverFulfill：第二次敲门直接判失败
        let launcher = LaunchRecorder(onCall: asked)
        let store = try storeForStart(launcher: launcher, watchPresent: true, prescription: prescription())

        store.startSession()
        XCTAssertNotNil(store.flow, "前提：这一场真的开起来了")
        // 训练已在进行时再点一次开始：startSession 的 guard 挡住，不能再敲一次门。
        store.startSession()

        // 10 秒：整组一起跑时，前面几条测试排队的锁屏实时活动请求在模拟器上会把主线程占住约 2 秒
        //（2026-10-21 日志：本条 44.19 开始，那几条 request-failed 46.27 才返回），2 秒上限会偶发超时。
        await fulfillment(of: [asked], timeout: 10)
        // 给可能存在的第二次请求留出落地时间再读计数：请求发生在 SessionStore 起的 Task 里，
        // 紧接着 fulfillment 就读，第二次哪怕真的发生了也可能还没到 actor，读到 1 而误判通过。
        try await Task.sleep(for: .milliseconds(300))
        let calls = await launcher.calls
        XCTAssertEqual(calls, 1)
    }

    func testRestoringAnInterruptedSessionDoesNotAskTheWatchAgain() async throws {
        // 规格（Master 第 13 条）写明「只在新开一场时拉起，恢复草稿不拉起」：恢复不是用户
        // 点开始的那一刻，那时表上的会话多半还在跑。这里钉住它——以后谁把拉起挪进
        // flow 建立的公共路径，这条就会红。
        let asked = expectation(description: "恢复草稿不应请求拉起手表")
        asked.isInverted = true
        let launcher = LaunchRecorder(onCall: asked)
        let store = try storeForStart(launcher: launcher, watchPresent: true, prescription: prescription())
        store.pendingDraft = TrainSessionDraft(
            dateISO: "2026-10-17", startedAt: Date(), prescription: prescription(),
            events: [], catalogVersion: ExerciseCatalog.minimal.catalogVersion)

        store.restorePendingDraft()

        XCTAssertNotNil(store.flow, "前提：草稿真的恢复成了进行中的训练")
        await fulfillment(of: [asked], timeout: 0.5)
        let calls = await launcher.calls
        XCTAssertEqual(calls, 0)
    }

    func testNoPairedWatchMeansNoLaunchRequestAndTrainingStillStarts() async throws {
        let asked = expectation(description: "不应请求拉起手表")
        asked.isInverted = true
        let launcher = LaunchRecorder(onCall: asked)
        let store = try storeForStart(launcher: launcher, watchPresent: false, prescription: prescription())

        store.startSession()

        // 绝大多数用户没有手表：开训照常，只是不去敲一扇不存在的门。
        XCTAssertNotNil(store.flow)
        await fulfillment(of: [asked], timeout: 0.5)
        let calls = await launcher.calls
        XCTAssertEqual(calls, 0)
    }

    func testRestDayStartsNothingAndAsksNothing() async throws {
        let asked = expectation(description: "休息日不应请求拉起手表")
        asked.isInverted = true
        let launcher = LaunchRecorder(onCall: asked)
        let store = try storeForStart(launcher: launcher, watchPresent: true, prescription: nil)

        store.startSession()

        // 没有处方就没有这一场；手表上更不能凭空冒出一场训练写进健康。
        XCTAssertNil(store.flow)
        await fulfillment(of: [asked], timeout: 0.5)
        let calls = await launcher.calls
        XCTAssertEqual(calls, 0)
    }

    // MARK: - v3.11：手机被收走后，表上的「休息走完了」也能把训练接回；手机落后表一步时补上

    /// 手机被收走后的样子：草稿里已记第 1 组（minutesAgo 分钟前在表上记的），内存里没有训练。
    private func killedPhoneWithOneSet(minutesAgo: Double) -> (SessionStore, FakeDraftStore) {
        let draftStore = FakeDraftStore()
        draftStore.stored = freshDraft(
            startedAt: Date().addingTimeInterval(-(minutesAgo + 5) * 60),
            events: [.logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2).stamped(at: isoMinutesAgo(minutesAgo)))])
        return (SessionStore(draftStore: draftStore), draftStore)
    }

    private func twoExercisePrescription() -> TodayPrescription {
        TodayPrescription(
            dayCode: "pull-a",
            exercises: [
                prescription().exercises[0],
                ExercisePrescriptionPlan(
                    exerciseId: "barbell-row", sets: 3, restSeconds: 120,
                    repLowerBound: 8, repUpperBound: 12, targetReps: 10,
                    targetWeightKg: 50, targetRir: 2, previousWeightKg: nil,
                    previousTopReps: nil, nextProjectedWeightKg: 52.5,
                    progressionStepKg: 2.5, change: .start, reason: .firstExposure,
                    loadType: "external", equipment: "barbell", progressionPauseReason: nil),
            ],
            dayReasons: [])
    }

    func testWatchRestEndAfterAResumeMovesThePhoneToTheNextSet() {
        // 手机被收走时正在第 1 组后的休息里（120 秒）；表上那段休息走完了，发来「休息走完了」把手机叫醒。
        // 以前：手机重开后整段重新计时，这条被拒，表停在 0:00。现在：休息从第 1 组那一刻起算、已经走完——进第 2 组。
        let (store, _) = killedPhoneWithOneSet(minutesAgo: 3)
        store.applyWatchCommand(command(.restSkip, auto: true))
        XCTAssertEqual(store.flow?.phase, .activeSet)
        XCTAssertEqual(store.flow?.progress.setNumber, 2)
    }

    func testWatchRestEndIsIgnoredWhileTheResumedRestStillRuns() {
        // 第 1 组才过去 30 秒：接回后休息照常还剩约 90 秒，表上一条旧消息不能把它提前结束。
        let (store, _) = killedPhoneWithOneSet(minutesAgo: 0.5)
        store.applyWatchCommand(command(.restSkip, auto: true))
        XCTAssertEqual(store.flow?.phase, .resting)
        XCTAssertGreaterThan(store.restCountdown.remaining(), 60)
    }

    func testPhoneStillRestingAcceptsTheWatchsNextSet() {
        // 手机在口袋里，没收到「休息走完了」，还停在第 1 组后的休息里；表上已经记下第 2 组。
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        XCTAssertEqual(store.flow?.phase, .resting)
        store.applyWatchLoggedSet(loggedSet(setNumber: 2, reps: 6))
        XCTAssertEqual(completedCount(store), 2)
        XCTAssertEqual(store.flow?.observationsByExercise["bench-press"]?.last?.reps, 6)
    }

    func testNextExercisesFirstSetFinishesThePhonesRestAndSkipsItsWarmup() {
        // 卧推最后一组后手机停在动作间休息里；表上已经练到划船第 1 组（划船的热身在表上做过了）。
        let store = SessionStore(draftStore: FakeDraftStore())
        store.flow = TrainFlowState(prescription: twoExercisePrescription())
        finishWarmup(store)
        for n in 1...3 { store.applyWatchLoggedSet(loggedSet(setNumber: n)) }
        XCTAssertEqual(store.flow?.phase, .resting)
        store.applyWatchLoggedSet(loggedSet(exerciseId: "barbell-row", setNumber: 1, reps: 10))
        XCTAssertEqual(store.flow?.currentExercise?.exerciseId, "barbell-row")
        XCTAssertEqual(store.flow?.observationsByExercise["barbell-row"]?.count, 1)
    }

    func testStaleWarmupStepDoesNotEndARunningRest() {
        // 正在第 1 组后的休息里，来了一条这个动作的热身步（晚到的旧消息）：补「休息走完」也对不上它，
        // 休息必须原样继续——补错一步比晚收一条更糟。
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        store.applyWatchLoggedSet(warmupStep(index: 1))
        XCTAssertEqual(store.flow?.phase, .resting)
        XCTAssertEqual(completedCount(store), 1)
    }

    func testWatchSkipOfTheFirstSetSkipsThePhonesWarmupToo() {
        // 表上做完 / 跳过了热身，又跳过了第 1 组：手机还在热身里，先跳过剩下的热身再跳这一组。
        let store = makeStore()
        XCTAssertTrue(store.flow?.isWarmingUp == true)
        store.applyWatchCommand(command(.skipSet, reason: SetSkipReason.fatigue.rawValue, setNumber: 1))
        XCTAssertEqual(store.flow?.isWarmingUp, false)
        XCTAssertEqual(store.flow?.skippedInCurrentExercise, 1)
    }

    func testPushIsHeldOnlyWhileAnUnfinishedDraftWaits() {
        // 盘上的真相说了算：没有进行中的训练、盘上有一场没练完的草稿 → 压住；其余都照常推。
        let draftStore = FakeDraftStore()
        let store = SessionStore(draftStore: draftStore)
        XCTAssertFalse(store.watchPushHeldForUnfinishedDraft(), "没有草稿")
        draftStore.stored = freshDraft(events: [.logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2))])
        XCTAssertTrue(store.watchPushHeldForUnfinishedDraft(), "没练完的草稿等着接回")
        store.flow = TrainFlowState(prescription: prescription())
        XCTAssertFalse(store.watchPushHeldForUnfinishedDraft(), "训练在进行：照常推")
        store.flow = nil
        draftStore.stored = draftStore.stored?.ending(at: Date())
        XCTAssertFalse(store.watchPushHeldForUnfinishedDraft(), "练完的那场（有结束时刻）不压")
        draftStore.stored = freshDraft(startedAt: Date().addingTimeInterval(-40 * 3600))
        XCTAssertFalse(store.watchPushHeldForUnfinishedDraft(), "出了恢复窗口的不压")
    }

    func testEndingASessionTellsTheWatchInsteadOfHoldingThePush() throws {
        // 训练结束（放弃 / 存好）时先清草稿再清训练流：flow 置空那一下的「没在练」不能被守卫压住，
        // 否则表永远不知道这场放弃了，体能训练一直跑到 60 分钟止损（审查 2026-10-21）。
        let draftStore = FakeDraftStore()
        let store = SessionStore(draftStore: draftStore)
        store.todayOutcome = try readyOutcome(prescription: prescription())
        store.flow = TrainFlowState(prescription: prescription())
        finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        XCTAssertNotNil(draftStore.stored)
        let before = draftStore.loadsWithDraft

        store.abandonActiveSession()

        XCTAssertEqual(draftStore.loadsWithDraft, before, "推送守卫读盘时草稿必须已经清掉")
        XCTAssertNil(draftStore.stored)
        XCTAssertEqual(store.lastSessionOutcome, "abandoned")
    }

    func testDiscardingAWaitingDraftTellsTheWatchItWasAbandoned() {
        let draftStore = FakeDraftStore()
        draftStore.stored = freshDraft(events: [.logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2))])
        let store = SessionStore(draftStore: draftStore)
        store.pendingDraft = draftStore.stored

        store.discardPendingDraft()

        XCTAssertNil(draftStore.stored)
        XCTAssertEqual(store.lastSessionOutcome, "abandoned")
        XCTAssertFalse(store.watchPushHeldForUnfinishedDraft())
    }

    func testWatchInboxHandlesEnvelopesInArrivalOrderAndSavesDurably() throws {
        let draftStore = FakeDraftStore()
        let store = SessionStore(draftStore: draftStore)
        store.todayOutcome = try readyOutcome(prescription: prescription())
        store.flow = TrainFlowState(prescription: prescription())
        finishWarmup(store)
        func envelope(_ set: WatchLoggedSet) -> WatchLinkEnvelope {
            WatchLinkEnvelope(kind: WatchLinkKind.loggedSet, sentAtISO: set.loggedAtISO, payload: set.encoded)
        }

        store.receiveFromWatch(envelope(loggedSet(setNumber: 1, reps: 8)))
        store.receiveFromWatch(envelope(loggedSet(setNumber: 2, reps: 6)))

        XCTAssertEqual(store.flow?.observationsByExercise["bench-press"]?.map(\.reps), [8, 6])
        XCTAssertGreaterThanOrEqual(draftStore.durableSaves, 2, "每批处理完立刻同步落盘")
    }

    func testResumeLeavesADraftOutsideTheWindowAlone() {
        let draftStore = FakeDraftStore()
        let old = TrainSessionDraft(dateISO: "2000-01-01", startedAt: Date().addingTimeInterval(-40 * 3600),
                                    prescription: prescription(),
                                    events: [.logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2))])
        draftStore.stored = old
        let store = SessionStore(draftStore: draftStore)
        store.applyWatchLoggedSet(loggedSet(setNumber: 2))
        XCTAssertNil(store.flow)
        XCTAssertEqual(draftStore.stored, old, "不接回、也不碰")
    }

    func testResumeLeavesAFinishedDraftAlone() {
        // 练完的那场由 loadToday 自己存好；迟到的副本不能把它接回成「在练」。
        let draftStore = FakeDraftStore()
        draftStore.stored = freshDraft(events: [
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)), .restFinished,
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)), .restFinished,
            .logSet(CompletedSetObservation(weightKg: 60, reps: 8, rir: 2)),
        ])
        let store = SessionStore(draftStore: draftStore)
        store.applyWatchLoggedSet(loggedSet(setNumber: 3))
        XCTAssertNil(store.flow)
    }

    func testResumeIgnoresAMessageFromAnotherTraining() {
        // 别的训练迟到的旧消息：动作不在这场的计划里、或比这场开练还早——不接回。
        let (store, _) = killedPhoneWithOneSet(minutesAgo: 3)
        store.applyWatchLoggedSet(loggedSet(exerciseId: "squat", setNumber: 2))
        XCTAssertNil(store.flow)
        store.applyWatchLoggedSet(loggedSet(setNumber: 2, loggedAt: Date().addingTimeInterval(-2 * 3600)))
        XCTAssertNil(store.flow)
        store.applyWatchLoggedSet(loggedSet(setNumber: 2))
        XCTAssertNotNil(store.flow, "这场训练自己的消息照常接回")
    }

    func testWatchSkipOfTheNextSetCatchesUpLikeASet() {
        // 表上休息完跳过了第 2 组（器械被占）：手机还在休息里，先补「休息走完」再跳——理由码原样落下。
        let store = makeStore(); finishWarmup(store)
        store.applyWatchLoggedSet(loggedSet(setNumber: 1))
        store.applyWatchCommand(command(.skipSet, reason: SetSkipReason.equipmentBusy.rawValue, setNumber: 2))
        XCTAssertEqual(store.flow?.skippedSets.map(\.reason), [.equipmentBusy])
        XCTAssertEqual(store.flow?.progress.setNumber, 3)
    }
}

private final class FakeDraftStore: TrainSessionDraftStoring {
    var stored: TrainSessionDraft?
    /// 取出时盘上有草稿的次数（推送守卫读盘时看得到）。
    private(set) var loadsWithDraft = 0
    private(set) var durableSaves = 0
    func load() -> TrainSessionDraft? {
        if stored != nil { loadsWithDraft += 1 }
        return stored
    }
    func clear() { stored = nil }
    func enqueueSave(_ draft: TrainSessionDraft) { stored = draft }
    func saveDurably(_ draft: TrainSessionDraft) -> Bool { stored = draft; durableSaves += 1; return true }
}

/// 记录手机有没有请求拉起手表（v3.8）。用 actor：调用发生在 SessionStore 起的 Task 里，
/// 与测试本身并发，裸写计数就是数据竞态——RedeEntitlements 的测试替身就因此出过偶发段错误。
private actor LaunchRecorder: WatchWorkoutLaunching {
    private(set) var calls = 0
    private let onCall: XCTestExpectation
    init(onCall: XCTestExpectation) { self.onCall = onCall }
    func launchStrengthWorkout() async -> WatchWorkoutLaunchResult {
        calls += 1
        onCall.fulfill()
        return .requested
    }
}
