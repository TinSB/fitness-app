// FR-T5 按周锚点合同：本地 ISO 周一计算（含年末第 53 周 / 跨年 / 闰年 / 周日归属边界）。
// 用固定时区构造输入与断言，确定性、与运行机器时区无关（CI 稳定）。

import XCTest
@testable import RedeTrainingDecision

final class WeekAnchorTests: XCTestCase {
    private let tz = TimeZone(identifier: "UTC")!

    /// 在固定时区把 "yyyy-MM-dd HH:mm" 解析成 Date（避免依赖机器时区）。
    private func date(_ s: String) -> Date {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = tz
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f.date(from: s)!
    }

    private func anchor(_ s: String) -> String {
        WeekAnchor.isoWeekStart(date(s), timeZone: tz)
    }

    func testMidWeekResolvesToMonday() {
        XCTAssertEqual(anchor("2026-06-17 12:00"), "2026-06-15", "周三 → 同周周一")
    }

    func testMondayResolvesToItself() {
        XCTAssertEqual(anchor("2026-06-15 00:00"), "2026-06-15")
        XCTAssertEqual(anchor("2026-06-15 23:59"), "2026-06-15", "周一全天同一锚点（不随时刻变）")
    }

    func testSundayBelongsToSameIsoWeekMonday() {
        // ISO 周一起始：周日是该周第 7 天，归属本周周一（非下周）。
        XCTAssertEqual(anchor("2026-06-21 23:59"), "2026-06-15", "周日 → 本周周一")
    }

    func testYearEndWeek53Boundary() {
        // 2024-12-31 周二属于 ISO 2025 第 1 周，其周一是 2024-12-30（跨年边界）。
        XCTAssertEqual(anchor("2024-12-31 12:00"), "2024-12-30")
        XCTAssertEqual(anchor("2025-01-01 12:00"), "2024-12-30", "跨年同 ISO 周 → 同周一")
    }

    func testLeapDay() {
        // 2024-02-29 周四（闰日）→ 同周周一 2024-02-26。
        XCTAssertEqual(anchor("2024-02-29 12:00"), "2024-02-26")
    }

    func testSameWeekAllDaysShareAnchor() {
        // 周一到周日同一锚点——按周抑制/采纳 key 在一周内恒定（降频不因日期变动失效）。
        let monday = "2026-06-15"
        for day in ["2026-06-15 06:00", "2026-06-16 06:00", "2026-06-18 06:00", "2026-06-21 06:00"] {
            XCTAssertEqual(anchor(day), monday, "\(day) 应锚到 \(monday)")
        }
    }
}
