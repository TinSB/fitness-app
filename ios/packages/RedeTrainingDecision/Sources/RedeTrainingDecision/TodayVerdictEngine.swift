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
    /// ISO 周一锚（纯算术，无 Foundation 日历）：day 0 = 1970-01-01 周四 →
    /// weekStart = day − ((day + 3) mod 7)（每周循环模式 2026-07-08）。
    static func isoWeekStartDay(of dayNumber: Int) -> Int {
        dayNumber - (((dayNumber + 3) % 7) + 7) % 7
    }

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
    private static let deloadWeekDays = 7
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
        // 本日历周（ISO 周一始）已训练天数：trainedDays 已去重并滤掉未来日期，
        // 窗口即周一..今天。周口径迁移（2026-07-15）：滚动 7 天 → 日历周，与今日页
        // 分段条 / WeeklyAdherence / volumeBoost 按周抑制键同源；周日练满 → 下周一
        // 重新计 train（有意语义变化，行为锁测试守护）。
        let weekStart = TrainingDay.isoWeekStartDay(of: today)
        let trainedThisWeek = trainedDays.filter { $0 >= weekStart }.count
        signals.append(.trainedDaysThisWeek(trainedThisWeek))
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
        // 连练几天必休：按计划的每周天数，最少 3 天（2026-10-20 引擎审查，owner 拍板）。每周 5 天的计划
        // 连练第 4 天以前会被挡成休息、一周练不满；不知道计划时照旧按 3 天（不用 6 天兜底值——那会放得太宽）。
        let consecutiveLimit = max(consecutiveRestDays,
                                   input.program.daysPerWeek ?? input.profile.weeklyTrainingDays ?? consecutiveRestDays)
        if consecutive >= consecutiveLimit {
            return TodayVerdict(call: .rest, reason: .consecutiveDaysNeedRest(days: consecutive), signals: signals)
        }
        if trainedThisWeek >= planned {
            return TodayVerdict(call: .light, reason: .weeklyPlanReached(days: trainedThisWeek, planned: planned), signals: signals)
        }
        if gap <= 1, let meanRir, meanRir <= nearFailureMeanRir {
            return TodayVerdict(call: .light, reason: .lastSessionNearFailure(meanRir: meanRir), signals: signals)
        }
        return TodayVerdict(call: .train, reason: .normalProgression, signals: signals)
    }

    /// 减载条件：21 天窗口内训练日 ≥ 3×计划频次，且窗口内最长休息间隔 ≤ 2 天。在某个训练日（或今天）成立，
    /// 就从那天起减载 7 天；减载周里练的那几天不算进下一轮，之后从头再数。减载周里已经连歇了 2 天以上，
    /// 就提前解除（歇够了，与「窗口里有超过 2 天的间隔就不算高频」同一个口径）。
    ///
    /// 以前没有「一周就结束」：减载那几天自己也算训练日，窗口一直是满的——比计划练得勤、中间最多歇一天的人
    ///（如每周 3 天的计划隔天练）之后每一场都是减载（×0.8、少一组），直到连休两天才解除（2026-10-20 引擎审查
    /// 第二批）。严格按计划天数练的人，训练日那天之前的 20 天里凑不满，这条基本只在休息日亮。
    ///
    /// trainedDays 升序、全在今天之前（今天已练时上面已经返回「今天练过了」）。单趟扫描：窗口左端只往前走。
    private static func isSustainedLoad(trainedDays: [Int], today: Int, planned: Int) -> Bool {
        var deloadEnd = Int.min   // 上一个减载周结束后的第一天；之前的训练日不再计入
        var low = 0               // 窗口左端（trainedDays 下标）
        for (index, day) in (trainedDays + [today]).enumerated() where day >= deloadEnd {
            // 窗口：这一天之前 20 天内、上一个减载周之后的训练日（下标 low..<index，那天当天还没练）。
            while low < index, trainedDays[low] < max(deloadEnd, day - sustainedWindowDays + 1) { low += 1 }
            if sustained(window: trainedDays[low..<index], asOf: day, planned: planned) {
                deloadEnd = day + deloadWeekDays
            }
        }
        let restedSinceLast = today - (trainedDays.last ?? today)
        return today < deloadEnd && restedSinceLast <= sustainedMaxInternalGap
    }

    private static func sustained(window: ArraySlice<Int>, asOf day: Int, planned: Int) -> Bool {
        guard window.count >= 3 * planned, window.count >= 2, let last = window.last else { return false }
        let longestGap = zip(window, window.dropFirst()).map { $1 - $0 }.max() ?? 0
        return max(longestGap, day - last) <= sustainedMaxInternalGap
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
