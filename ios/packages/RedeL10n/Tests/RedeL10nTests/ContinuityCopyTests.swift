// FR-PR5 连续性月历文案：中性、无禁词、双语。

import Foundation
import XCTest
@testable import RedeL10n

final class ContinuityCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testTitleAndWeekdayHeader() {
        XCTAssertEqual(zh.continuityTitle, "训练连续性")
        XCTAssertEqual(en.continuityTitle, "Consistency")
        XCTAssertEqual(zh.weekdayInitialsMonFirst.count, 7)
        XCTAssertEqual(zh.weekdayInitialsMonFirst.first, "一")  // 周一起始
        XCTAssertEqual(en.weekdayInitialsMonFirst.first, "M")
    }

    func testMonthLabel() {
        let zhLabel = zh.calendarMonthLabel(year: 2026, month: 6)
        XCTAssertTrue(zhLabel.contains("2026") && zhLabel.contains("6月"), zhLabel)
        let enLabel = en.calendarMonthLabel(year: 2026, month: 6)
        XCTAssertTrue(enLabel.contains("2026") && enLabel.contains("June"), enLabel)
    }

    func testCountIsNeutralAndPluralized() {
        XCTAssertEqual(en.continuityCount(1), "1 session this month")
        XCTAssertEqual(en.continuityCount(5), "5 sessions this month")
        XCTAssertEqual(zh.continuityCount(5), "本月 5 次训练")
        // 中性，不羞辱：不出现「错过/missed/连续/streak」等施压词。
        for text in [zh.continuityCount(0), en.continuityCount(0)] {
            for banned in ["错过", "missed", "streak", "连续", "断"] {
                XCTAssertFalse(text.contains(banned), "施压词「\(banned)」出现在: \(text)")
            }
        }
    }

    func testDayA11y() {
        XCTAssertEqual(zh.continuityDayA11y(dateISO: "2026-06-09", trained: true), "6月9日，已训练")
        XCTAssertEqual(en.continuityDayA11y(dateISO: "2026-06-09", trained: false), "Jun 9")
    }
}
