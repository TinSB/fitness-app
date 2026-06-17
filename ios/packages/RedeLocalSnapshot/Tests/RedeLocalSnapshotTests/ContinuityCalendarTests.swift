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
}
