// ProgressInsight — 判断先行的 typed 推导（M4-3）：verdict 句子的数据源。
// 纯函数、零文案（句子由 RedeL10n 渲染）。规则是 MVP 起步值（测试锁定待校准）：
// · 趋势：窗口 = 最近 4 个 e1RM 点，delta = 末−首；|delta| < 2.5 → flat；
//   <2 点 → calibrating（校准期不下结论，与首练不发奖同哲学）。
// · 关键动作（趋势图画谁）：点数最多，平手取 exerciseId 字典序（确定性）。
// · 周对比：本周 vs 严格上一个 ISO 周；上周缺席或为 0 → noComparison（不硬比）。

public enum TrendCall: Equatable, Sendable {
    case calibrating
    case up
    case flat
    case down
}

public struct TrendAssessment: Equatable, Sendable {
    public let exerciseId: String
    public let call: TrendCall
    /// 窗口末−首（calibrating 时为 0）。
    public let deltaKg: Double
    public let windowSessionCount: Int
}

public enum TrendInsight {
    private static let windowSize = 4
    private static let flatBandKg = 2.5

    public static func assess(_ trend: ProgressSnapshot.ExerciseTrend) -> TrendAssessment {
        let window = Array(trend.points.suffix(windowSize))
        guard window.count >= 2, let first = window.first, let last = window.last else {
            return TrendAssessment(
                exerciseId: trend.exerciseId, call: .calibrating,
                deltaKg: 0, windowSessionCount: window.count
            )
        }
        let delta = last.e1RmKg - first.e1RmKg
        let call: TrendCall = abs(delta) < flatBandKg ? .flat : (delta > 0 ? .up : .down)
        return TrendAssessment(
            exerciseId: trend.exerciseId, call: call,
            deltaKg: delta, windowSessionCount: window.count
        )
    }

    /// 趋势图主角：练得最多的动作（点数最多，平手取字典序）。
    public static func keyExercise(of snapshot: ProgressSnapshot) -> ProgressSnapshot.ExerciseTrend? {
        snapshot.exerciseTrends.max { a, b in
            (a.points.count, b.exerciseId) < (b.points.count, a.exerciseId)
        }
    }
}

public enum WeeklyComparison: Equatable, Sendable {
    /// 与严格上一个 ISO 周的吨位变化（整数百分比，四舍五入）。
    case vsPreviousWeek(deltaPercent: Int)
    /// 历史只有当前一周（真·第一周）。
    case firstWeek
    /// 有更早历史，但严格上一周缺席或无有效吨位（跳周/休整）——不硬比。
    case previousWeekMissing
}

public enum WeeklyInsight {
    public static func compare(
        latest: ProgressSnapshot.WeeklyVolume,
        weeks: [ProgressSnapshot.WeeklyVolume]
    ) -> WeeklyComparison {
        let hasEarlierWeeks = weeks.contains { $0.weekStartISO < latest.weekStartISO }
        guard let latestStart = SnapshotDayMath.dayNumber(of: latest.weekStartISO) else {
            return hasEarlierWeeks ? .previousWeekMissing : .firstWeek
        }
        let previousStartISO = SnapshotDayMath.isoString(fromDayNumber: latestStart - 7)
        guard let previous = weeks.first(where: { $0.weekStartISO == previousStartISO }),
              previous.totalVolumeKg > 0
        else { return hasEarlierWeeks ? .previousWeekMissing : .firstWeek }
        let delta = (latest.totalVolumeKg - previous.totalVolumeKg) / previous.totalVolumeKg * 100
        return .vsPreviousWeek(deltaPercent: Int(delta.rounded()))
    }
}
