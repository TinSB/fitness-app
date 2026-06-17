// WeekAnchor — FR-T5 教练动作按周锚点（本地 ISO 周一）。
//
// 补量卡的「本周」抑制/采纳/dismiss key 都锚在这个字符串上（`volumeBoost:<weekStartISO>`）。
// 抽到包内纯函数：① 跨链关键锚点获得 SPM 单测覆盖（年末第 53 周 / 闰年 / 周日归属等边界）；
// ② 显式注入 timeZone（默认 .current）——把时区依赖摆到台面上，便于测试用固定时区、确定性断言。
//
// 显示侧（TodayModel.loadOutcome 算抑制查询）与写入侧（采纳补量写 key）必须用同一函数 → key 同源。

import Foundation

public enum WeekAnchor {
    /// 本地 ISO 周一（`yyyy-MM-dd`）。
    ///
    /// 绝不静默回退到入参当天：按日变化的非周一字符串会让「已采纳/已 dismiss」按周查错位、降频哑火，
    /// 且采纳写入会把错锚点污染进落库（审查 MAJOR-1）。`date(from:)` 对合法日期不会失败；万一失败，
    /// 断言暴露 + 返回空串（引擎按周抑制退化为「不抑制」= 安全：宁可多弹一次，绝不查错周）。
    public static func isoWeekStart(_ date: Date, timeZone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = timeZone
        guard let monday = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)) else {
            assertionFailure("ISO 周一锚点计算失败，输入日期异常: \(date)")
            return ""
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: monday)
    }
}
