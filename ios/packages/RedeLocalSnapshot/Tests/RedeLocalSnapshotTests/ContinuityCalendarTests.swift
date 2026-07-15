// FR-PR5 训练连续性月历：纯 civil-days 网格，固定输入固定输出（无 Calendar/时区）。
// 锚定事实：2026-06-01 是周一（既有 TodayEngineCopy 测试已确认 2026-06-09 = 周二）。

import XCTest
@testable import RedeLocalSnapshot

final class ContinuityCalendarTests: XCTestCase {
    func testJuneMonthGridMonStartNoLeadingPad() {
        let month = ContinuityCalendar.month(
            containing: "2026-06-15", todayISO: "2026-06-15", trainedDatesISO: ["2026-06-09"]
        )
        let m = try! XCTUnwrap(month)
        XCTAssertEqual(m.year, 2026)
        XCTAssertEqual(m.month, 6)
        // 6 月 1 号是周一 → 无前导空格；30 天 + 5 个尾部补齐 = 35 格 = 5 周。
        XCTAssertEqual(m.weeks.count, 5)
        XCTAssertEqual(m.weeks[0][0].dateISO, "2026-06-01")
        XCTAssertEqual(m.weeks[0][0].isTrained, false)
        // 6 月 9 号 = 第 2 周周二（week idx1, day idx1）。
        XCTAssertEqual(m.weeks[1][1].dateISO, "2026-06-09")
        XCTAssertTrue(m.weeks[1][1].isTrained)
        XCTAssertEqual(m.trainedCount, 1)
    }

    func testTodayMarkedOnlyOnTodayCell() {
        let m = try! XCTUnwrap(ContinuityCalendar.month(
            containing: "2026-06-15", todayISO: "2026-06-15", trainedDatesISO: []
        ))
        // 6 月 15 号 = 第 3 周周一（week idx2, day idx0）。
        XCTAssertEqual(m.weeks[2][0].dateISO, "2026-06-15")
        XCTAssertTrue(m.weeks[2][0].isToday)
        XCTAssertFalse(m.weeks[0][0].isToday)
    }

    func testTodayAndTrainedSameCellBothFlagged() {
        // 同一天既是今天又练了：引擎两 flag 都置真（视图 dayCell 再决定训练优先、今天圈不叠，
        // 见 ProgressTabView.dayCell 注释）。守住这两 flag 不被改坏。
        let m = try! XCTUnwrap(ContinuityCalendar.month(
            containing: "2026-06-09", todayISO: "2026-06-09", trainedDatesISO: ["2026-06-09"]
        ))
        let cell = m.weeks[1][1]  // 6 月 9 号
        XCTAssertEqual(cell.dateISO, "2026-06-09")
        XCTAssertTrue(cell.isTrained)
        XCTAssertTrue(cell.isToday)
    }

    func testJulyLeadingPad() {
        // 7 月 1 号 = 周三 → 周一、周二两格空（前导补 2）。
        let m = try! XCTUnwrap(ContinuityCalendar.month(
            containing: "2026-07-10", todayISO: "2026-07-10", trainedDatesISO: []
        ))
        XCTAssertNil(m.weeks[0][0].dateISO)
        XCTAssertNil(m.weeks[0][1].dateISO)
        XCTAssertEqual(m.weeks[0][2].dateISO, "2026-07-01")
    }

    func testTrainedDatesOutsideMonthIgnored() {
        let m = try! XCTUnwrap(ContinuityCalendar.month(
            containing: "2026-06-01", todayISO: "2026-06-01",
            trainedDatesISO: ["2026-06-09", "2026-06-10", "2026-05-31"]
        ))
        // 5-31 不属 6 月，不计入。
        XCTAssertEqual(m.trainedCount, 2)
    }

    func testInvalidAnchorReturnsNil() {
        XCTAssertNil(ContinuityCalendar.month(containing: "not-a-date", todayISO: "2026-06-01", trainedDatesISO: []))
        XCTAssertNil(ContinuityCalendar.month(containing: "2026-13-01", todayISO: "2026-06-01", trainedDatesISO: []))
    }

    // MARK: - weekStatus（N3a 今日页状态行周分段条，2026-07-14）
    // 锚定事实：2026-07-13 = 周一、2026-07-15 = 周三、2026-07-12 = 周日。

    func testWeekStatusEmptyHistoryMidweek() {
        // 空历史，今天=周三：周一周二 past、周三 today、其余 future。
        let statuses = try! XCTUnwrap(ContinuityCalendar.weekStatus(todayISO: "2026-07-15", trainedDatesISO: []))
        XCTAssertEqual(statuses, [.past, .past, .today, .future, .future, .future, .future])
    }

    func testWeekStatusTodayIsMonday() {
        // 今天=周一（本周第一天）：首格 today、其余全 future。
        let statuses = try! XCTUnwrap(ContinuityCalendar.weekStatus(todayISO: "2026-07-13", trainedDatesISO: []))
        XCTAssertEqual(statuses, [.today, .future, .future, .future, .future, .future, .future])
    }

    func testWeekStatusTodayTrainedWinsOverToday() {
        // 今天已练：today 格显 trained（训练优先，同 dayCell 语义）；周一也练过。
        let statuses = try! XCTUnwrap(ContinuityCalendar.weekStatus(
            todayISO: "2026-07-15", trainedDatesISO: ["2026-07-13", "2026-07-15"]
        ))
        XCTAssertEqual(statuses, [.trained, .past, .trained, .future, .future, .future, .future])
    }

    func testWeekStatusCrossWeekBoundaryIgnoresLastWeek() {
        // 跨周边界：今天=周日（本周最后一天）；上周日（7-12）的训练不得混入本周条。
        let statuses = try! XCTUnwrap(ContinuityCalendar.weekStatus(
            todayISO: "2026-07-19", trainedDatesISO: ["2026-07-12", "2026-07-13"]
        ))
        XCTAssertEqual(statuses, [.trained, .past, .past, .past, .past, .past, .today])
    }

    func testWeekStatusInvalidTodayReturnsNil() {
        XCTAssertNil(ContinuityCalendar.weekStatus(todayISO: "not-a-date", trainedDatesISO: []))
        XCTAssertNil(ContinuityCalendar.weekStatus(todayISO: "2026-02-30", trainedDatesISO: []))
    }
}
