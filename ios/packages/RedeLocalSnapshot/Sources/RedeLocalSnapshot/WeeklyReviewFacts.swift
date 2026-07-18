// Weekly Review Facts — FR-SUB3 的只读周事实投影。
//
// 输入由 app 组合层从 canonical clean view 映射而来：allSessions 保留训练事实，
// cleanSessions 已排除可疑组。这里仅做日期截断与统计，不读时钟、不写盘、不生成文案，
// 也不接触计划、entitlement 或 StoreKit。

public struct WeeklyReviewFacts: Equatable, Sendable {
    public let reviewWeekStartISO: String
    public let reviewWeekEndExclusiveISO: String
    public let trainingDayCount: Int
    public let sessionCount: Int
    public let cleanVolumeKg: Double
    /// Review week 之前最近最多四个完整周的训练日中位数；无历史为 nil。
    public let recentMedianTrainingDays: Double?
    /// 截止 review week 周末的关键动作趋势；当前周与未来数据已排除。
    public let keyLiftTrend: TrendAssessment?

    public init(
        reviewWeekStartISO: String,
        reviewWeekEndExclusiveISO: String,
        trainingDayCount: Int,
        sessionCount: Int,
        cleanVolumeKg: Double,
        recentMedianTrainingDays: Double?,
        keyLiftTrend: TrendAssessment?
    ) {
        self.reviewWeekStartISO = reviewWeekStartISO
        self.reviewWeekEndExclusiveISO = reviewWeekEndExclusiveISO
        self.trainingDayCount = trainingDayCount
        self.sessionCount = sessionCount
        self.cleanVolumeKg = cleanVolumeKg
        self.recentMedianTrainingDays = recentMedianTrainingDays
        self.keyLiftTrend = keyLiftTrend
    }
}

public enum WeeklyReviewFactsBuilder {
    private static let rhythmWindowWeeks = 4

    /// `todayISO` 所在周视为进行中；只返回它之前一个完整 ISO 周的事实。
    /// 非法 today 失败关闭为 nil；单条非法 session 日期跳过。
    public static func build(
        allSessions: [SnapshotSessionRecord],
        cleanSessions: [SnapshotSessionRecord],
        facts: [String: ExerciseStatsFacts] = [:],
        todayISO: String
    ) -> WeeklyReviewFacts? {
        guard let currentWeekStartISO = SnapshotDayMath.isoWeekStart(of: todayISO),
              let currentWeekStartDay = SnapshotDayMath.dayNumber(of: currentWeekStartISO) else {
            return nil
        }
        let reviewWeekStartDay = currentWeekStartDay - 7
        let reviewWeekStartISO = SnapshotDayMath.isoString(fromDayNumber: reviewWeekStartDay)

        let datedAll = allSessions.compactMap { record -> (SnapshotSessionRecord, Int)? in
            guard let day = SnapshotDayMath.dayNumber(of: record.dateISO) else { return nil }
            return (record, day)
        }
        let reviewSessions = datedAll.filter {
            $0.1 >= reviewWeekStartDay && $0.1 < currentWeekStartDay
        }
        let trainingDays = Set(reviewSessions.map(\.1))

        // 趋势与吨位都只能看到 review week 周末；cleanSessions 中当前周/未来记录在此截断。
        let cleanThroughReview = cleanSessions.filter { record in
            guard let day = SnapshotDayMath.dayNumber(of: record.dateISO) else { return false }
            return day < currentWeekStartDay
        }
        let cleanSnapshot = ProgressSnapshotBuilder.build(sessions: cleanThroughReview, facts: facts)
        let reviewVolume = cleanSnapshot.weeklyVolume.first {
            $0.weekStartISO == reviewWeekStartISO
        }?.totalVolumeKg ?? 0
        let keyTrend = TrendInsight.keyExercise(of: cleanSnapshot, facts: facts).map(TrendInsight.assess)

        return WeeklyReviewFacts(
            reviewWeekStartISO: reviewWeekStartISO,
            reviewWeekEndExclusiveISO: currentWeekStartISO,
            trainingDayCount: trainingDays.count,
            sessionCount: reviewSessions.count,
            cleanVolumeKg: reviewVolume,
            recentMedianTrainingDays: recentMedian(
                datedSessions: datedAll,
                before: reviewWeekStartDay
            ),
            keyLiftTrend: keyTrend
        )
    }

    private static func recentMedian(
        datedSessions: [(SnapshotSessionRecord, Int)],
        before reviewWeekStartDay: Int
    ) -> Double? {
        let priorDays = datedSessions.map(\.1).filter { $0 < reviewWeekStartDay }
        guard let earliestDay = priorDays.min() else { return nil }
        let earliestISO = SnapshotDayMath.isoString(fromDayNumber: earliestDay)
        guard let earliestWeekISO = SnapshotDayMath.isoWeekStart(of: earliestISO),
              let earliestWeekDay = SnapshotDayMath.dayNumber(of: earliestWeekISO) else {
            return nil
        }

        let firstWindowWeek = reviewWeekStartDay - rhythmWindowWeeks * 7
        let firstWeek = max(firstWindowWeek, earliestWeekDay)
        let uniqueDays = Set(priorDays)
        var counts: [Int] = []
        var weekStart = firstWeek
        while weekStart < reviewWeekStartDay {
            counts.append(uniqueDays.filter { $0 >= weekStart && $0 < weekStart + 7 }.count)
            weekStart += 7
        }
        guard !counts.isEmpty else { return nil }
        let sorted = counts.sorted()
        let middle = sorted.count / 2
        if sorted.count.isMultiple(of: 2) {
            return Double(sorted[middle - 1] + sorted[middle]) / 2
        }
        return Double(sorted[middle])
    }
}
