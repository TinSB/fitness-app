// RestCountdown — 休息倒计时墙钟锚点。回归网覆盖 owner 2026-06-15 反馈的核心 bug：
// 倒计时必须从绝对结束时刻求剩余，使切页/视图重建后仍能复原（不再归 0 消失）。
// 时间全部注入，确定可测。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class RestCountdownTests: XCTestCase {
    private let t0 = Date(timeIntervalSinceReferenceDate: 1_000_000)

    func testInactiveByDefault() {
        let c = RestCountdown()
        XCTAssertFalse(c.isActive)
        XCTAssertFalse(c.isPaused)
        XCTAssertEqual(c.remaining(now: t0), 0)
    }

    func testBeginThenRemainingFromWallClock() {
        var c = RestCountdown()
        c.begin(seconds: 90, now: t0)
        XCTAssertTrue(c.isActive)
        XCTAssertFalse(c.isPaused)
        // 首帧显示满值（向上取整）。
        XCTAssertEqual(c.remaining(now: t0), 90)
        // 真实时间流逝 30s。
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(30)), 60)
    }

    /// 核心回归：begin 后即便「视图被销毁重建」，只要 RestCountdown 实例还在（会话层持有），
    /// 用当下时刻就能算出正确剩余——这正是切 tab 回来不归 0 的保证。
    func testRemainingSurvivesAcrossElapsedTime() {
        var c = RestCountdown()
        c.begin(seconds: 120, now: t0)
        // 切到别的 tab 待了 45s 再回来：剩余应为 75，而非 0。
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(45)), 75)
    }

    func testExpiryClampsToZeroNotNegative() {
        var c = RestCountdown()
        c.begin(seconds: 60, now: t0)
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(60)), 0)
        // 超时（离屏太久）仍为 0，不出现负数。
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(600)), 0)
    }

    func testPauseFreezesRemaining() {
        var c = RestCountdown()
        c.begin(seconds: 90, now: t0)
        c.togglePause(now: t0.addingTimeInterval(10)) // 暂停时剩 80
        XCTAssertTrue(c.isPaused)
        // 暂停期间无论过多久，剩余都冻结在 80。
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(10)), 80)
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(40)), 80)
    }

    func testResumeReanchorsFromFrozenRemaining() {
        var c = RestCountdown()
        c.begin(seconds: 90, now: t0)
        c.togglePause(now: t0.addingTimeInterval(10)) // 冻结 80
        c.togglePause(now: t0.addingTimeInterval(40)) // 暂停 30s 后继续
        XCTAssertFalse(c.isPaused)
        // 继续瞬间仍为 80；再过 20s 为 60（暂停的 30s 不计流逝）。
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(40)), 80)
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(60)), 60)
    }

    func testAddWhileRunningPushesEnd() {
        var c = RestCountdown()
        c.begin(seconds: 90, now: t0)
        c.add(seconds: 30)
        XCTAssertEqual(c.remaining(now: t0), 120)
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(30)), 90)
    }

    func testAddWhilePausedAddsToFrozen() {
        var c = RestCountdown()
        c.begin(seconds: 90, now: t0)
        c.togglePause(now: t0.addingTimeInterval(10)) // 冻结 80
        c.add(seconds: 30)
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(10)), 110)
    }

    func testAddOnInactiveIsNoOp() {
        var c = RestCountdown()
        c.add(seconds: 30)
        XCTAssertFalse(c.isActive)
        XCTAssertEqual(c.remaining(now: t0), 0)
    }

    func testTogglePauseOnInactiveIsNoOp() {
        var c = RestCountdown()
        c.togglePause(now: t0)
        XCTAssertFalse(c.isActive)
        XCTAssertFalse(c.isPaused)
    }

    // MARK: - 进度条比例（与倒计时同步）

    func testFractionTracksRemaining() {
        var c = RestCountdown()
        c.begin(seconds: 120, now: t0)
        XCTAssertEqual(c.fraction(now: t0), 1.0, accuracy: 0.001)            // 满格起步
        XCTAssertEqual(c.fraction(now: t0.addingTimeInterval(60)), 0.5, accuracy: 0.001) // 半程
        XCTAssertEqual(c.fraction(now: t0.addingTimeInterval(120)), 0.0, accuracy: 0.001) // 0:00 归零
    }

    func testFractionInactiveIsZero() {
        let c = RestCountdown()
        XCTAssertEqual(c.fraction(now: t0), 0.0, accuracy: 0.001)
    }

    /// 核心回归（owner 2026-06-15「进度条与休息时间同步」）：+30 后 total 同步增长，
    /// 进度条不卡满、继续平滑下降，并在新的 0:00 精确归零。
    func testFractionStaysSyncedAfterAddWhileRunning() {
        var c = RestCountdown()
        c.begin(seconds: 120, now: t0)
        // 走到剩 3 秒（旧实现此时 +30 会让 remaining=33 > planned=120? 否；构造接近满的反例）
        c.add(seconds: 30) // total 120→150，remaining 120→150
        XCTAssertEqual(c.totalSeconds, 150)
        // 旧实现 remaining(150)/planned(120) 会 clamp 到 1（卡满）；新实现 150/150=1 起步后正常下降
        XCTAssertEqual(c.fraction(now: t0), 1.0, accuracy: 0.001)
        XCTAssertEqual(c.fraction(now: t0.addingTimeInterval(30)), 120.0 / 150.0, accuracy: 0.001) // 0.8，不卡满
        XCTAssertEqual(c.fraction(now: t0.addingTimeInterval(150)), 0.0, accuracy: 0.001)           // 新 0:00 归零
    }

    func testFractionAfterAddWhilePaused() {
        var c = RestCountdown()
        c.begin(seconds: 120, now: t0)
        c.togglePause(now: t0.addingTimeInterval(60)) // 冻结剩 60，total 仍 120
        c.add(seconds: 30) // total 150，paused 90
        XCTAssertEqual(c.totalSeconds, 150)
        XCTAssertEqual(c.fraction(now: t0.addingTimeInterval(60)), 90.0 / 150.0, accuracy: 0.001) // 0.6 冻结
    }

    func testClearResets() {
        var c = RestCountdown()
        c.begin(seconds: 90, now: t0)
        c.clear()
        XCTAssertFalse(c.isActive)
        XCTAssertEqual(c.remaining(now: t0), 0)
    }

    func testBeginAfterPauseResetsPausedState() {
        var c = RestCountdown()
        c.begin(seconds: 90, now: t0)
        c.togglePause(now: t0.addingTimeInterval(10))
        XCTAssertTrue(c.isPaused)
        // 新一组休息开始：清掉暂停态，重新从满值运行。
        c.begin(seconds: 60, now: t0.addingTimeInterval(100))
        XCTAssertFalse(c.isPaused)
        XCTAssertEqual(c.remaining(now: t0.addingTimeInterval(100)), 60)
    }
}
