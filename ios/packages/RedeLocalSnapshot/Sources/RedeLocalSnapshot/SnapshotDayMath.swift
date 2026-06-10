// 纯整数日期数学（Howard Hinnant civil-days 算法）——无 Calendar/时区/Locale，
// 固定输入产出固定结果（M4-1 验收）。与 RedeTrainingDecision.TrainingDay 同源
// 算法的本包独立副本：Master 强制本包与其他包解耦，不得共享依赖。
// 刻意零 import：连 Foundation 都不进，注释里的「纯」由编译面背书。

enum SnapshotDayMath {
    /// 严格解析 yyyy-MM-dd；非法格式/非法日期（如 02-30）返回 nil。
    static func dayNumber(of dateISO: String) -> Int? {
        let parts = dateISO.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
              (1...12).contains(month), day >= 1, day <= daysInMonth(year: year, month: month)
        else { return nil }
        return daysFromCivil(year: year, month: month, day: day)
    }

    /// 该日所在 ISO 周（周一起始）的周一，yyyy-MM-dd；输入非法返回 nil。
    static func isoWeekStart(of dateISO: String) -> String? {
        guard let z = dayNumber(of: dateISO) else { return nil }
        // 1970-01-01（z=0）是周四，周一比周四早 3 天 → mondayOffset = (z+3) mod 7
        //（floor 取模处理负 z），即该日距本周周一的天数。
        let mondayOffset = ((z + 3) % 7 + 7) % 7
        return civilString(fromDayNumber: z - mondayOffset)
    }

    // MARK: - Hinnant 算法

    private static func daysInMonth(year: Int, month: Int) -> Int {
        switch month {
        case 1, 3, 5, 7, 8, 10, 12: return 31
        case 4, 6, 9, 11: return 30
        default: return isLeap(year) ? 29 : 28
        }
    }

    private static func isLeap(_ y: Int) -> Bool {
        y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)
    }

    /// days_from_civil：1970-01-01 = 0。
    private static func daysFromCivil(year: Int, month: Int, day: Int) -> Int {
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    /// civil_from_days 反推 yyyy-MM-dd。
    private static func civilString(fromDayNumber z0: Int) -> String {
        var z = z0 + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        z -= era * 146_097
        let yoe = (z - z / 1460 + z / 36_524 - z / 146_096) / 365
        let y = yoe + era * 400
        let doy = z - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let day = doy - (153 * mp + 2) / 5 + 1
        let month = mp + (mp < 10 ? 3 : -9)
        let year = month <= 2 ? y + 1 : y
        return "\(padded(year, 4))-\(padded(month, 2))-\(padded(day, 2))"
    }

    private static func padded(_ value: Int, _ width: Int) -> String {
        let digits = String(value)
        guard digits.count < width else { return digits }
        return String(repeating: "0", count: width - digits.count) + digits
    }
}
