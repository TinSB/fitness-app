// ContinuityCalendar — FR-PR5 训练连续性月历（纯派生，中性呈现）。
//
// 复用同模块 SnapshotDayMath 的 civil-days 算法（无 Calendar/时区/Locale）：固定输入
// 固定输出，host 可单测。只回答「这天有没有训练」——不算 streak、不做断签羞辱
//（文案基线 §7.3 / 产品原则 6）。训练日匹配用 yyyy-MM-dd 本地日字符串（与写入口径一致）。

public enum ContinuityCalendar {
    /// 月历一格。`dateISO == nil` = 补齐整周的空格（月初前 / 月末后）。
    public struct Day: Equatable, Sendable {
        public let dateISO: String?
        public let isTrained: Bool
        public let isToday: Bool
    }

    /// 单月网格（周一起始，ISO）。`weeks` 每行 7 天。
    public struct Month: Equatable, Sendable {
        public let year: Int
        public let month: Int        // 1...12
        public let weeks: [[Day]]
        public let trainedCount: Int // 本月训练天数（中性计数）
    }

    /// 构建 `anchorISO` 所在自然月的月历（周一起始）。`trainedDatesISO` 用 yyyy-MM-dd 匹配；
    /// `anchorISO` 非法返回 nil。
    public static func month(containing anchorISO: String, todayISO: String, trainedDatesISO: Set<String>) -> Month? {
        guard anchorISO.count >= 10,
              let year = Int(anchorISO.prefix(4)),
              let month = Int(anchorISO.dropFirst(5).prefix(2)),
              (1...12).contains(month)
        else { return nil }

        let firstISO = "\(pad4(year))-\(pad2(month))-01"
        guard let firstZ = SnapshotDayMath.dayNumber(of: firstISO),
              let mondayISO = SnapshotDayMath.isoWeekStart(of: firstISO),
              let mondayZ = SnapshotDayMath.dayNumber(of: mondayISO)
        else { return nil }

        // 本月天数 = 下月一号 − 本月一号（复用 dayNumber，免再写月长表）。
        let nextYear = month == 12 ? year + 1 : year
        let nextMonth = month == 12 ? 1 : month + 1
        guard let nextFirstZ = SnapshotDayMath.dayNumber(of: "\(pad4(nextYear))-\(pad2(nextMonth))-01")
        else { return nil }
        let daysInMonth = nextFirstZ - firstZ
        let leadingPad = firstZ - mondayZ  // 0...6：月初一号距本周周一的天数

        var cells: [Day] = Array(repeating: Day(dateISO: nil, isTrained: false, isToday: false), count: leadingPad)
        var trainedCount = 0
        for offset in 0..<daysInMonth {
            let iso = SnapshotDayMath.isoString(fromDayNumber: firstZ + offset)
            let trained = trainedDatesISO.contains(iso)
            if trained { trainedCount += 1 }
            cells.append(Day(dateISO: iso, isTrained: trained, isToday: iso == todayISO))
        }
        while cells.count % 7 != 0 {
            cells.append(Day(dateISO: nil, isTrained: false, isToday: false))
        }

        var weeks: [[Day]] = []
        var i = 0
        while i < cells.count {
            weeks.append(Array(cells[i..<i + 7]))
            i += 7
        }
        return Month(year: year, month: month, weeks: weeks, trainedCount: trainedCount)
    }

    // MARK: - 本周分段条（N3a 今日页状态行，2026-07-14）

    /// 周分段条一格的状态。`trained` 优先于 `today`（今天已练显实心，同 dayCell 训练优先语义）。
    public enum WeekDayStatus: Equatable, Sendable {
        case trained   // 该日有训练
        case today     // 今天，尚未练
        case past      // 已过去，无训练
        case future    // 未来
    }

    /// `todayISO` 所在 ISO 周（周一起始）7 天的状态数组——与 `month(containing:)`/周量图同口径
    /// （civil-days、yyyy-MM-dd 匹配、无 Calendar/时区）。`todayISO` 非法返回 nil。
    public static func weekStatus(todayISO: String, trainedDatesISO: Set<String>) -> [WeekDayStatus]? {
        guard let todayZ = SnapshotDayMath.dayNumber(of: todayISO),
              let mondayISO = SnapshotDayMath.isoWeekStart(of: todayISO),
              let mondayZ = SnapshotDayMath.dayNumber(of: mondayISO)
        else { return nil }
        return (0..<7).map { offset in
            let z = mondayZ + offset
            if trainedDatesISO.contains(SnapshotDayMath.isoString(fromDayNumber: z)) { return .trained }
            if z == todayZ { return .today }
            return z < todayZ ? .past : .future
        }
    }

    private static func pad2(_ v: Int) -> String { v < 10 ? "0\(v)" : "\(v)" }
    private static func pad4(_ v: Int) -> String {
        let s = String(v)
        return s.count >= 4 ? s : String(repeating: "0", count: 4 - s.count) + s
    }
}
