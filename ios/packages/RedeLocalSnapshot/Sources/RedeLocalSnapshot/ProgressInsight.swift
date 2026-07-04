// ProgressInsight — 判断先行的 typed 推导（M4-3）：verdict 句子的数据源。
// 纯函数、零文案（句子由 RedeL10n 渲染）。规则是 MVP 起步值（测试锁定待校准）：
// · 趋势：窗口 = 最近 4 个 e1RM 点，delta = 末−首；|delta| < 带宽 → flat；
//   带宽 = max(1.25, 窗口首点 e1RM × 3%)（§6.2 改相对值 2026-06-11：
//   绝对 2.5 对小重量动作永远 flat——侧平举 e1RM 10kg 时 ±25% 都被吃掉）；
//   <2 点 → calibrating（校准期不下结论，与首练不发奖同哲学）。
// · 关键动作（趋势图画谁）：复合优先（§6.2：孤立动作天然点数多，100 条
//   目录下会抢走深蹲的趋势主角位），same 层级内点数最多，平手取字典序。
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
    /// 相对带宽比例（§6.2 定案）：窗口首点 e1RM 的 3%；下限 1.25（半个最小步长，
    /// 防 e1RM 极小时带宽趋零把噪声当趋势）。
    private static let flatBandRatio = 0.03
    private static let flatBandFloorKg = 1.25

    public static func assess(_ trend: ProgressSnapshot.ExerciseTrend) -> TrendAssessment {
        let window = Array(trend.points.suffix(windowSize))
        guard window.count >= 2, let first = window.first, let last = window.last else {
            return TrendAssessment(
                exerciseId: trend.exerciseId, call: .calibrating,
                deltaKg: 0, windowSessionCount: window.count
            )
        }
        let delta = last.e1RmKg - first.e1RmKg
        let band = max(flatBandFloorKg, first.e1RmKg * flatBandRatio)
        let call: TrendCall = abs(delta) < band ? .flat : (delta > 0 ? .up : .down)
        return TrendAssessment(
            exerciseId: trend.exerciseId, call: call,
            deltaKg: delta, windowSessionCount: window.count
        )
    }

    /// 趋势图主角：复合优先 → 点数最多 → 平手取字典序（facts 缺省 = 全部
    /// 非复合，退化为旧「点数最多」口径）。
    public static func keyExercise(
        of snapshot: ProgressSnapshot,
        facts: [String: ExerciseStatsFacts] = [:]
    ) -> ProgressSnapshot.ExerciseTrend? {
        snapshot.exerciseTrends.max { a, b in
            let ac = facts[a.exerciseId]?.isCompound == true ? 1 : 0
            let bc = facts[b.exerciseId]?.isCompound == true ? 1 : 0
            return (ac, a.points.count, b.exerciseId) < (bc, b.points.count, a.exerciseId)
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
    /// 最新一周还在进行中（today 仍落在该 ISO 周内，含周日当天）——只报
    /// 「本周至今」事实，不与完整上周硬比（周中天然显负增长，2026-07-03
    /// 审查 MAJOR #3）。周一起该周收口，恢复 vsPreviousWeek。
    case currentWeekInProgress
}

public enum WeeklyInsight {
    public static func compare(
        latest: ProgressSnapshot.WeeklyVolume,
        weeks: [ProgressSnapshot.WeeklyVolume],
        todayISO: String
    ) -> WeeklyComparison {
        let hasEarlierWeeks = weeks.contains { $0.weekStartISO < latest.weekStartISO }
        guard let latestStart = SnapshotDayMath.dayNumber(of: latest.weekStartISO) else {
            return hasEarlierWeeks ? .previousWeekMissing : .firstWeek
        }
        let previousStartISO = SnapshotDayMath.isoString(fromDayNumber: latestStart - 7)
        guard let previous = weeks.first(where: { $0.weekStartISO == previousStartISO }),
              previous.totalVolumeKg > 0
        else { return hasEarlierWeeks ? .previousWeekMissing : .firstWeek }
        // 进行中抢占只压 vsPreviousWeek（唯一会下错误结论的 case）；firstWeek /
        // previousWeekMissing 文案本就中性如实，不改道。todayISO 解析失败回退对比（不吞数据）。
        if let today = SnapshotDayMath.dayNumber(of: todayISO), today <= latestStart + 6 {
            return .currentWeekInProgress
        }
        let delta = (latest.totalVolumeKg - previous.totalVolumeKg) / previous.totalVolumeKg * 100
        return .vsPreviousWeek(deltaPercent: Int(delta.rounded()))
    }
}
