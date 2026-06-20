// WeeklyAdherence — FR-PL3 依从信号派生：把 clean 历史的训练日期摊平成
// 「最近若干完整周·每周完成场次」，喂 PlanAdjustmentEngine.frequencyProposal。
//
// 纯函数（无 clock、显式注入 todayISO/timeZone），故获 SPM 单测覆盖：跨周边界、空周（gap）、
// 进行中的本周（半周）排除、开训前空周不计。锚点复用 WeekAnchor.isoWeekStart → 与 FR-T5
// 按周抑制同源，绝不分叉。
//
// 三条语义红线（决定提案是否公平）：
//  ① 排除「今日所在的进行中本周」——半周完成数会低估，凭它判「落后」不公平。
//  ② 起点不早于「首次训练所在周」——开训前的空周是「还没开始」，不是「落后」，不计 0。
//  ③ 中间的空周（练过又停）计 0——这正是「持续落后」要捕捉的信号，必须计入。

import Foundation

public enum WeeklyAdherence {
    /// 最近 `maxWeeks` 个**完整周**每周完成场次，按时间正序（旧→新）。
    /// 入参日期任意顺序、可为更长 ISO 串（取前 10 位）；非法日期跳过。
    /// 返回空 = 无可用完整周（数据不足，engine 自会判 < minWeeksOfData 不提案）。
    public static func recentWeeklySessionCounts(
        sessionDatesISO: [String],
        todayISO: String,
        timeZone: TimeZone = .current,
        maxWeeks: Int = 8
    ) -> [Int] {
        guard maxWeeks > 0 else { return [] }
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = timeZone
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"

        func parse(_ iso: String) -> Date? { formatter.date(from: String(iso.prefix(10))) }
        func weekStartDate(_ date: Date) -> Date? {
            calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date))
        }

        guard let today = parse(todayISO), let currentWeekStart = weekStartDate(today) else { return [] }

        // 按周锚点分桶，并记最早的完整周（排除本周/未来脏数据）。
        var countsByWeek: [String: Int] = [:]
        var earliestStart: Date?
        for iso in sessionDatesISO {
            guard let date = parse(iso), let ws = weekStartDate(date), ws < currentWeekStart else { continue }
            let key = WeekAnchor.isoWeekStart(date, timeZone: timeZone)
            countsByWeek[key, default: 0] += 1
            if earliestStart == nil || ws < earliestStart! { earliestStart = ws }
        }

        // 完整周序列 = 首训周 … 本周前一周（含中间空周记 0）。
        guard let firstStart = earliestStart,
              let lastCompleteStart = calendar.date(byAdding: .weekOfYear, value: -1, to: currentWeekStart),
              firstStart <= lastCompleteStart else { return [] }

        var weekly: [Int] = []
        var cursor = firstStart
        while cursor <= lastCompleteStart {
            let key = WeekAnchor.isoWeekStart(cursor, timeZone: timeZone)
            weekly.append(countsByWeek[key] ?? 0)
            guard let next = calendar.date(byAdding: .weekOfYear, value: 1, to: cursor) else { break }
            cursor = next
        }
        return Array(weekly.suffix(maxWeeks))
    }
}
