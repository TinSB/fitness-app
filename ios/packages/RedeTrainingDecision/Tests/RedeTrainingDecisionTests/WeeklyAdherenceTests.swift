// WeeklyAdherence 派生合同：完整周计数、本周排除、空周计 0、开训前不计、maxWeeks 截断、健壮性。
// 固定 UTC + 已核对的 ISO 周一锚点（2026-06-15 是本周一；05-18/05-25/06-01/06-08 皆周一）。

import XCTest
@testable import RedeTrainingDecision

final class WeeklyAdherenceTests: XCTestCase {
    private let utc = TimeZone(identifier: "UTC")!
    private let today = "2026-06-20" // 周六；本周一 = 2026-06-15

    private func counts(_ dates: [String], maxWeeks: Int = 8) -> [Int] {
        WeeklyAdherence.recentWeeklySessionCounts(
            sessionDatesISO: dates, todayISO: today, timeZone: utc, maxWeeks: maxWeeks
        )
    }

    func testFourCompleteWeeksTwoEach() {
        let dates = ["2026-05-18", "2026-05-20", "2026-05-25", "2026-05-27",
                     "2026-06-01", "2026-06-03", "2026-06-08", "2026-06-10"]
        XCTAssertEqual(counts(dates), [2, 2, 2, 2], "四个完整周各 2 次")
    }

    func testCurrentPartialWeekExcluded() {
        // 本周（06-15..）的两次不得计入——半周低估会误判落后。
        let dates = ["2026-05-18", "2026-05-20", "2026-05-25", "2026-05-27",
                     "2026-06-01", "2026-06-03", "2026-06-08", "2026-06-10",
                     "2026-06-15", "2026-06-17"]
        XCTAssertEqual(counts(dates), [2, 2, 2, 2], "排除进行中的本周")
    }

    func testGapWeeksCountAsZero() {
        // 练过又停：首周 2 次、第 4 周 2 次，中间两周空 → 计 0（正是"持续落后"信号）。
        let dates = ["2026-05-18", "2026-05-20", "2026-06-08", "2026-06-10"]
        XCTAssertEqual(counts(dates), [2, 0, 0, 2], "中间空周计 0")
    }

    func testPreHistoryWeeksNotPadded() {
        // 首训在 06-08 那一周 → 只回 1 个完整周，前面的空周（还没开训）不计。
        let dates = ["2026-06-08", "2026-06-10"]
        XCTAssertEqual(counts(dates), [2], "起点 = 首训周，开训前不补 0")
    }

    func testMaxWeeksCapsToMostRecent() {
        // 10 个完整周各 1 次（04-06 … 06-08），maxWeeks 8 → 取最近 8 周。
        let mondays = ["2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27",
                       "2026-05-04", "2026-05-11", "2026-05-18", "2026-05-25",
                       "2026-06-01", "2026-06-08"]
        XCTAssertEqual(counts(mondays), [1, 1, 1, 1, 1, 1, 1, 1], "截断到最近 8 周")
    }

    func testOnlyCurrentWeekOrEmptyYieldsNothing() {
        XCTAssertEqual(counts([]), [], "无历史 → 空")
        XCTAssertEqual(counts(["2026-06-16", "2026-06-18"]), [], "只有本周 → 无完整周")
    }

    func testLongISOStringAndOrderIndependent() {
        let dates = ["2026-06-10T18:30:00Z", "2026-05-25", "2026-05-18T07:00:00+00:00",
                     "2026-06-08", "2026-06-01"]
        // 周计数：05-18(1) 05-25(1) 06-01(1) 06-08(2) → [1,1,1,2]
        XCTAssertEqual(counts(dates), [1, 1, 1, 2], "长 ISO 串取前 10；输入顺序无关")
    }
}
