import XCTest
@testable import RedeWatchLink

// 表上「点完成即休息」（Master v3.9 §5 第 6 条修订，owner 2026-10-19）。
// 表侧唯一的状态机：什么时候起、手机推来新一份时留不留、休息屏看到的是什么。
final class ProvisionalRestTests: XCTestCase {

    private let loggedAt = Date(timeIntervalSince1970: 1_800_000_000)

    private func active(setNumber: Int = 2, isResting: Bool = false, isWarmup: Bool = false,
                        exerciseId: String = "bench", restAfter: Int? = 120,
                        preview: WatchPrescription.RestPreview? = .init(caption: "下一组 · 第 3 组"))
        -> WatchPrescription.Active {
        WatchPrescription.Active(
            exerciseId: exerciseId, exerciseName: "杠铃卧推", setNumber: setNumber, setTotal: 4,
            exerciseNumber: 1, exerciseTotal: 5, targetText: "60 kg × 8",
            targetWeightKg: 60, targetReps: 8, targetRir: 2, isResting: isResting, isWarmup: isWarmup,
            restAfterSetSeconds: restAfter, restAfterSetPreview: preview)
    }

    func testLoggingAWorkingSetStartsTheRestThePhoneWillStartWithoutWaitingForIt() throws {
        // owner 真机反馈：手机在口袋里时，表上点完成后倒计时不动，要掏出手机才开始。
        let rest = try XCTUnwrap(ProvisionalRest.begin(after: active(), loggedAt: loggedAt))
        XCTAssertEqual(rest.endsAt, loggedAt.addingTimeInterval(120), "从表上点下那一刻起算手机给的时长")
        XCTAssertEqual(rest.totalSeconds, 120)
        XCTAssertEqual(rest.preview?.caption, "下一组 · 第 3 组")
    }

    func testNoRestIsInventedWhereThePhoneWouldNotRest() {
        // 热身步、全场最后一组（手机给 nil）、旧手机（不带这一位）、已在休息：都不起，照旧等手机。
        XCTAssertNil(ProvisionalRest.begin(after: active(isWarmup: true), loggedAt: loggedAt))
        XCTAssertNil(ProvisionalRest.begin(after: active(restAfter: nil), loggedAt: loggedAt))
        XCTAssertNil(ProvisionalRest.begin(after: active(restAfter: 0), loggedAt: loggedAt))
        XCTAssertNil(ProvisionalRest.begin(after: active(isResting: true), loggedAt: loggedAt))
    }

    func testItSurvivesOnlyWhileThePhoneIsStillWaitingForThatSameSet() throws {
        let rest = try XCTUnwrap(ProvisionalRest.begin(after: active(), loggedAt: loggedAt))
        let during = loggedAt.addingTimeInterval(30)
        // 手机还没收到这一组（在口袋里睡着），因为别的原因推了一份：留着。
        XCTAssertTrue(rest.survives(active(), now: during))
        // 手机接手了：开始休息 / 已到下一组 / 换了动作 / 进了小结或训练结束——交还给手机那份。
        XCTAssertFalse(rest.survives(active(isResting: true), now: during))
        XCTAssertFalse(rest.survives(active(setNumber: 3), now: during))
        XCTAssertFalse(rest.survives(active(exerciseId: "row"), now: during))
        XCTAssertFalse(rest.survives(active(isWarmup: true), now: during))
        XCTAssertFalse(rest.survives(nil, now: during))
    }

    func testAfterTheRestHasRunOutAPhoneStillWaitingForTheSetGetsTheSetScreenBack() throws {
        // 手机没收下或撤销了这一组、又照常推「还在等第 2 组」：休息走完之后不能把表卡在 0:00——
        // 交还记组屏，用户能在表上重记（审查 2026-10-19）。没有新推送时休息屏照旧叠着。
        let rest = try XCTUnwrap(ProvisionalRest.begin(after: active(), loggedAt: loggedAt))
        XCTAssertFalse(rest.survives(active(), now: loggedAt.addingTimeInterval(121)))
        XCTAssertTrue(rest.isAwaited(by: active()), "没有新推送时休息屏照旧（灰色 0:00 等手机）")
    }

    func testRestScreenShowsTheProvisionalCountdownButKeepsTheSetIdentityForCommands() throws {
        let base = active()
        let rest = try XCTUnwrap(ProvisionalRest.begin(after: base, loggedAt: loggedAt))
        let shown = rest.overlay(on: base)
        XCTAssertTrue(shown.isResting)
        XCTAssertEqual(shown.restEndsAt, loggedAt.addingTimeInterval(120))
        XCTAssertEqual(shown.restTotalSeconds, 120)
        XCTAssertNil(shown.restPausedRemaining)
        XCTAssertEqual(shown.restPreview?.caption, "下一组 · 第 3 组")
        XCTAssertNil(shown.restPreview?.parts, "下一组练多少要等手机算，表不猜")
        // 命令按这一组的身份发给手机，由手机按自己的状态判。
        XCTAssertEqual(shown.exerciseId, base.exerciseId)
        XCTAssertEqual(shown.setNumber, base.setNumber)
        XCTAssertNil(shown.restAfterSetSeconds, "休息屏上不会再起第二段")
    }

    func testRestPreviewFieldsAreOptionalForOldPhonesAndSurviveRoundTrip() throws {
        let preview = WatchPrescription.RestPreview(
            caption: "下一组 · 第 3 组",
            parts: .init(prefix: nil, value: "60", unit: "kg", reps: "× 8"))
        let resting = WatchPrescription.Active(
            exerciseId: "bench", exerciseName: "杠铃卧推", setNumber: 3, setTotal: 4,
            exerciseNumber: 1, exerciseTotal: 5, targetText: "60 kg × 8",
            targetWeightKg: 60, targetReps: 8, targetRir: 2, isResting: true,
            restPreviewText: "下一组 · 第 3 组 · 60 kg × 8", restPreview: preview)
        let back = try JSONDecoder().decode(WatchPrescription.Active.self, from: JSONEncoder().encode(resting))
        XCTAssertEqual(back.restPreview, preview)
        XCTAssertEqual(back.restPreview?.spoken, "下一组 · 第 3 组 · 60 kg × 8")
        let set = try JSONDecoder().decode(WatchPrescription.Active.self, from: JSONEncoder().encode(active()))
        XCTAssertEqual(set.restAfterSetSeconds, 120)
        XCTAssertEqual(set.restAfterSetPreview?.caption, "下一组 · 第 3 组")
        // 旧手机的载荷三位都没有：照常解出，表照旧等手机推休息、退回整句预告。
        let legacy = #"{"exerciseId":"squat","exerciseName":"深蹲","setNumber":1,"setTotal":3,"exerciseNumber":1,"exerciseTotal":4,"targetText":"80 kg × 5","targetWeightKg":80,"targetReps":5,"targetRir":2,"isResting":false,"restTotalSeconds":0,"isWarmup":false}"#
        let old = try JSONDecoder().decode(WatchPrescription.Active.self, from: Data(legacy.utf8))
        XCTAssertNil(old.restPreview)
        XCTAssertNil(old.restAfterSetSeconds)
        XCTAssertNil(old.restAfterSetPreview)
        XCTAssertNil(ProvisionalRest.begin(after: old, loggedAt: loggedAt))
    }

    func testNextExercisePreviewReadsAsCaptionAndName() {
        let preview = WatchPrescription.RestPreview(caption: "接下来", title: "高位下拉")
        XCTAssertEqual(preview.spoken, "接下来 · 高位下拉")
    }
}
