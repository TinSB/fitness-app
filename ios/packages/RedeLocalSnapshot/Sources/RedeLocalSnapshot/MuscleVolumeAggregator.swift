// MuscleVolumeAggregator — 贡献行 → 每肌群每 ISO 周 fractional 组数时序（MLE-1b 2026-07-07）。
//
// 输入是**原始值行**（muscleRaw 字符串 + 权重 + 组数 + 日期）：贡献计算在
// RedeTrainingDecision（MuscleContributionTable，认识目录），本包 Foundation-only
// 零依赖（Master §5），两侧经 rawValue 桥接、app 层摊平接线（批次 B）。
// 纯派生：同输入必同输出；未知 muscleRaw / 坏日期防御跳过（不猜不崩）。

import Foundation

public enum MuscleVolumeAggregator {
    /// 单条贡献行：某日期某动作对某肌群的 fractional 贡献 × 完成组数。
    public struct ContributionRow: Equatable, Sendable {
        public let dateISO: String
        public let muscleRaw: String
        public let weight: Double
        public let setCount: Int
        public init(dateISO: String, muscleRaw: String, weight: Double, setCount: Int) {
            self.dateISO = dateISO
            self.muscleRaw = muscleRaw
            self.weight = weight
            self.setCount = setCount
        }
    }

    /// 聚合为 [肌群: [ISO 周一: fractional 组数]]。键值内容确定（同输入必同输出），
    /// 但 Dictionary 遍历顺序不保证——消费方渲染/golden 前需自行排序。
    public static func weeklyFractionalSets(
        rows: [ContributionRow]
    ) -> [MuscleGroupID: [String: Double]] {
        var series: [MuscleGroupID: [String: Double]] = [:]
        for row in rows {
            guard row.setCount > 0, row.weight > 0,
                  let muscle = MuscleGroupID(rawValue: row.muscleRaw),
                  let weekStart = SnapshotDayMath.isoWeekStart(of: row.dateISO) else { continue }
            let fractional = Double(row.setCount) * row.weight
            series[muscle, default: [:]][weekStart, default: 0] += fractional
        }
        return series
    }
}
