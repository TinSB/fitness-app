// TodayVerdictEngine — 今日裁决（M2-1）：练 / 轻 / 休 / 减载。
//
// 纯函数：同输入必同输出（goldens 锁定）；无 clock（today 注入）、无 IO、
// 不写回 AppData。规则是「安全优先」的瀑布仲裁（先命中先裁决），输入面
// 只有训练历史（负荷/间隔/上次表现）与计划结构——PRD 开放决策 #2 的拍板口径。
//
// 阈值是 MVP 自定的最小集（系统逻辑正文不含数值阈值），由 goldens 守护；
// 调整阈值 = 调整产品行为，必须让 goldens 红一次。

import RedeDataHealth

/// "yyyy-MM-dd" → 天序号。纯整数历法运算（civil-from-days 反演），无
/// DateFormatter——线程安全（可并发求值）、解析严格（拒绝 "2026-6-9"、
/// "2026-13-40" 这类 DateFormatter 默认会宽容接受的输入）、无时区歧义。
enum TrainingDay {
    static func dayNumber(fromISO iso: String) -> Int? {
        let s = String(iso.prefix(10))
        let parts = s.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
              (1...12).contains(month),
              (1...daysInMonth(year: year, month: month)).contains(day)
        else { return nil }

        // Howard Hinnant days_from_civil：1970-01-01 = 0
        var y = year
        if month <= 2 { y -= 1 }
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    private static func daysInMonth(year: Int, month: Int) -> Int {
        switch month {
        case 1, 3, 5, 7, 8, 10, 12: return 31
        case 4, 6, 9, 11: return 30
        default:
            let isLeap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
            return isLeap ? 29 : 28
        }
    }
}

public enum TodayVerdictEngine {
    // MVP 阈值（goldens 锁定）
    private static let longGapLightDays = 14
    private static let consecutiveRestDays = 3
    private static let sustainedWindowDays = 21
    private static let sustainedMaxInternalGap = 2
    private static let nearFailureMeanRir = 0.5
    private static let fallbackPlannedDaysPerWeek = 6

    public static func evaluate(_ input: CleanTrainingDecisionInput) -> TodayVerdict {
        guard let today = TrainingDay.dayNumber(fromISO: input.todayISO) else {
            // make(from:todayISO:) 已在工厂处校验；此分支不可达，但不 fake。
            return TodayVerdict(call: .train, reason: .noHistoryCalibration, signals: [.noTrainingHistory])
        }

        // 训练日序号集合：去重、忽略未来日期（时钟漂移/脏数据）与不可解析日期。
        let trainedDays = Set(
            input.sessions.compactMap { TrainingDay.dayNumber(fromISO: $0.date) }.filter { $0 <= today }
        ).sorted()

        let planned = input.program.daysPerWeek
            ?? input.profile.weeklyTrainingDays
            ?? fallbackPlannedDaysPerWeek

        // 可观察事实
        var signals: [VerdictSignal] = []
        let gap: Int? = trainedDays.last.map { today - $0 }
        if let gap {
            signals.append(.daysSinceLastSession(gap))
        } else {
            signals.append(.noTrainingHistory)
        }
        let last7 = trainedDays.filter { $0 > today - 7 }.count
        signals.append(.sessionsInLast7Days(last7))
        signals.append(.plannedDaysPerWeek(planned))

        var consecutive = 0
        var cursor = today - 1
        while trainedDays.contains(cursor) {
            consecutive += 1
            cursor -= 1
        }
        if consecutive > 0 { signals.append(.consecutiveTrainingDays(consecutive)) }

        let meanRir = lastSessionMeanRir(input: input, trainedDays: trainedDays, today: today)
        if let meanRir { signals.append(.lastSessionMeanRir(meanRir)) }

        // 瀑布仲裁（先命中先裁决，安全信号优先）
        if gap == 0 {
            return TodayVerdict(call: .rest, reason: .alreadyTrainedToday, signals: signals)
        }
        guard let gap else {
            return TodayVerdict(call: .train, reason: .noHistoryCalibration, signals: signals)
        }
        if gap >= longGapLightDays {
            return TodayVerdict(call: .light, reason: .longGapReentry(days: gap), signals: signals)
        }
        // 减载先于连练休息：21 天高频无间断是结构性超量，比 3 天连练这种
        // 短窗口恢复信号更强——连练 20 天的人需要的是一周减载，不只是歇一天。
        if isSustainedLoad(trainedDays: trainedDays, today: today, planned: planned) {
            return TodayVerdict(call: .deload, reason: .sustainedLoadDeload(days: sustainedWindowDays), signals: signals)
        }
        if consecutive >= consecutiveRestDays {
            return TodayVerdict(call: .rest, reason: .consecutiveDaysNeedRest(days: consecutive), signals: signals)
        }
        if last7 >= planned {
            return TodayVerdict(call: .light, reason: .weeklyPlanReached(sessions: last7, planned: planned), signals: signals)
        }
        if gap <= 1, let meanRir, meanRir <= nearFailureMeanRir {
            return TodayVerdict(call: .light, reason: .lastSessionNearFailure(meanRir: meanRir), signals: signals)
        }
        return TodayVerdict(call: .train, reason: .normalProgression, signals: signals)
    }

    /// 减载条件：21 天窗口内训练日 ≥ 3×计划频次，且窗口内最长休息间隔 ≤ 2 天。
    private static func isSustainedLoad(trainedDays: [Int], today: Int, planned: Int) -> Bool {
        let window = trainedDays.filter { $0 > today - sustainedWindowDays }
        guard window.count >= 3 * planned, window.count >= 2 else { return false }
        var longestGap = 0
        for (previous, next) in zip(window, window.dropFirst()) {
            longestGap = max(longestGap, next - previous)
        }
        longestGap = max(longestGap, today - (window.last ?? today))
        return longestGap <= sustainedMaxInternalGap
    }

    /// 最近一个训练日全部 set 的 RIR 均值；该日没有任何带 RIR 的 set 时为 nil（不猜）。
    private static func lastSessionMeanRir(
        input: CleanTrainingDecisionInput,
        trainedDays: [Int],
        today: Int
    ) -> Double? {
        guard let lastDay = trainedDays.last else { return nil }
        let rirs = input.sessions
            .filter { TrainingDay.dayNumber(fromISO: $0.date) == lastDay }
            .flatMap { $0.exercises.flatMap { $0.sets.compactMap(\.rir) } }
        guard !rirs.isEmpty else { return nil }
        return rirs.reduce(0, +) / Double(rirs.count)
    }
}
