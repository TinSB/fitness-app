// MuscleSubLevelBuilder — 子肌群等级（钻取层，2026-07-09 owner 拍板「详情页+效果优先」）。
//
// 两层结构：概览层 10 大块（人话，MLE 契约不动）；钻取层=详情页子肌群等级——
// back=[背阔 lats/上背 upper-back/斜方 traps]、shoulders=[前中后束]。胸腿等无子层
//（目录无该粒度，等真实需求）。**子层纯展示**：不进 tier/balance/记忆/决策/分享
//（防子块低置信污染整体判断）。
//
// 子分数口径：子暴露（满分锚 subExposureFullScoreWeeklyEffectiveSets=12 组/周——
// 大块的量分给 2-3 个子块，锚随之缩小）× 频率折减（同大块公式）+ **有量才继承
// 大块 performance 分**（强度是大块属性子块共享，但 0 量子块不吃——审查 S1：
// 没练过的部位显示 Lv.6 自相矛盾）；等级曲线/置信封顶沿大块同款。
// 0 量子块如实落 Lv.1 + 0 组（「你的斜方 0 组」正是钻取的价值）。
//
// 输入 = 归并前的细粒度贡献行（fineRows，muscleRaw=目录原始值）——数据在翻译层
// 本就流过，归并是 10 块层的主动选择；此处按原始值直接聚合。

import Foundation

/// 一个子肌群的等级结果（纯展示值对象）。
public struct MuscleSubLevel: Equatable, Sendable {
    public let muscleRaw: String          // 目录细粒度值（UI 经 L10n 镜像本地化）
    public let level: Int
    public let progress: Double
    public let weeklyEffectiveAvg: Double // 近窗周均有效组（详情页「每周 N 组」行）
}

public enum MuscleSubLevelBuilder {
    /// 子肌群满分锚：周均有效组达此值拿满子暴露分（大块锚 20 的子块缩放）。
    static let subExposureFullScoreWeeklyEffectiveSets = 12.0

    /// children 表（V1 只背/肩——目录粒度所在；胸腿无子层返回 nil）。
    public static func children(of muscle: MuscleGroupID) -> [String]? {
        switch muscle {
        case .back: return ["lats", "upper-back", "traps"]
        case .shoulders: return ["front-delt", "side-delt", "rear-delt"]
        default: return nil
        }
    }

    /// 子肌群等级：按 children 表固定顺序全量输出（0 量子块也出——如实）。
    /// 非本大块的细粒度行忽略；parent 校准中时调用方不应调用（详情页不开子区）。
    public static func subLevels(
        parent: MuscleGroupID,
        fineRows: [MuscleVolumeAggregator.ContributionRow],
        parentPerformanceScore: Double,
        parentConfidence: EstimateConfidence,
        nowISO: String,
        config: MuscleLevelModelConfig
    ) -> [MuscleSubLevel] {
        guard let childRaws = children(of: parent) else { return [] }
        let childSet = Set(childRaws)
        // 按子肌群 × ISO 周聚合 fractional 组数（同 MuscleVolumeAggregator 口径，String 键）
        var weeklyByChild: [String: [String: Double]] = [:]
        for row in fineRows where childSet.contains(row.muscleRaw) {
            guard let weekStart = SnapshotDayMath.isoWeekStart(of: row.dateISO) else { continue }
            weeklyByChild[row.muscleRaw, default: [:]][weekStart, default: 0] += Double(row.setCount) * row.weight
        }
        return childRaws.map { raw in
            let weekly = weeklyByChild[raw] ?? [:]
            let recorded = weekly.values.filter { $0 > 0 }
            let weeklyEffectiveAvg = recorded.isEmpty ? 0
                : recorded.map { MuscleLevelEstimator.effectiveSets(rawWeeklySets: $0, config: config) }
                    .reduce(0, +) / Double(recorded.count)
            let frequencyFactor = min(Double(recorded.count) / Double(config.recentWindowWeeks), 1)
            let exposure = min(weeklyEffectiveAvg / subExposureFullScoreWeeklyEffectiveSets, 1)
                * config.exposureScoreMax * frequencyFactor
            // 0 量子块不继承大块 performance（审查 S1：否则「斜方 Lv.6 · 每周 0 组」
            // 自相矛盾——没练过的部位不吃大块强度分，如实落 Lv.1 下限）
            let score = weeklyEffectiveAvg > 0 ? exposure + parentPerformanceScore : 0
            let (curveLevel, curveProgress) = MuscleLevelEstimator.level(forScore: score, config: config)
            // 置信封顶沿大块（§3.4 行为表达同口径）
            let cap: Int
            switch parentConfidence {
            case .high: cap = config.levelRange.upperBound
            case .medium: cap = config.mediumConfidenceLevelCap
            case .low: cap = config.lowConfidenceLevelCap
            }
            let level = min(curveLevel, cap)
            return MuscleSubLevel(
                muscleRaw: raw, level: level,
                progress: level < curveLevel ? 1 : curveProgress,
                weeklyEffectiveAvg: weeklyEffectiveAvg)
        }
    }
}
