// MuscleProfileAssembler — trend/peakLevel/balanceScore/TrainingTier/breakthroughs 组装
//（MLE-3 2026-07-07，§6.5.4 拍板表实现）。
//
// 输入 = MLE-2 计算体 + 原始观察 + 上一次快照记忆（previousLevels/Peaks/Tier 由调用方
// 提供——peak 的跨次记忆存储层归批次 B 决定，引擎只保 max 单调，禁写 canonical §6.5.12）。
// trend 平滑：近 N 周均 vs 前 N 周均 ±阈值才改向（单次训练波动不动，§6.5.3）。
// balanceScore：<门槛解锁肌群 nil 如实（MLE-0 契约偏离留痕的执行处）。
// tier：中位解锁等级落 §6.5.4 区间 + intermediate 起需力量进步信号（V1 用 e1RM 进步
// 替代 milestone 条件，MLE-4 合并后 milestone 并入同一信号位）+ balance 低于阈值下调
// 一档 + 数据不足/全低置信 calibrating 兜底。V1 无 safety 输入（recovery 后置），
// elite 仅展示语义不改训练风险（契约红线）。

import Foundation

public enum MuscleProfileAssembler {
    // MARK: trend

    /// nowISO 锚定日历窗（审查 MAJOR：聚合器缺周不产 key，按「有记录周」切窗会让
    /// prior 窗漂到很久以前、且 detraining 结构性不可达）——近/前 N 个**日历周**
    /// 缺周按 0 计，停练真实可测。prior 窗全零 = 历史不足，保守 stable
    ///（数据不够≠没变化的语义收口写回，O1）。
    public static func trend(
        weeklySets: [String: Double], isCalibrating: Bool, nowISO: String,
        config: MuscleLevelModelConfig
    ) -> MuscleLevelTrend {
        guard !isCalibrating else { return .calibrating }
        guard let anchorWeekStart = SnapshotDayMath.isoWeekStart(of: nowISO),
              let anchorDay = SnapshotDayMath.dayNumber(of: anchorWeekStart) else { return .stable }
        let window = config.trendWindowWeeks
        func weekValue(_ weeksBack: Int) -> Double {
            weeklySets[SnapshotDayMath.isoString(fromDayNumber: anchorDay - 7 * weeksBack)] ?? 0
        }
        let recentAvg = (0..<window).map(weekValue).reduce(0, +) / Double(window)
        let priorAvg = (window..<(window * 2)).map(weekValue).reduce(0, +) / Double(window)
        if recentAvg <= 0, priorAvg > 0 { return .detraining }
        guard priorAvg > 0 else { return .stable }
        let delta = (recentAvg - priorAvg) / priorAvg
        if delta > config.trendDeltaThreshold { return .rising }
        if delta < -config.trendDeltaThreshold { return .declining }
        return .stable
    }

    // MARK: peak

    public static func peakLevel(current: Int, previousPeak: Int?) -> Int {
        max(current, previousPeak ?? current)
    }

    // MARK: balance

    public static func balanceScore(unlockedLevels: [Int], config: MuscleLevelModelConfig) -> Double? {
        guard unlockedLevels.count >= config.balanceMinUnlockedMuscles else { return nil }
        let mean = Double(unlockedLevels.reduce(0, +)) / Double(unlockedLevels.count)
        guard mean > 0 else { return nil }
        let variance = unlockedLevels
            .map { (Double($0) - mean) * (Double($0) - mean) }
            .reduce(0, +) / Double(unlockedLevels.count)
        let cv = variance.squareRoot() / mean
        return max(0, 1 - cv / config.balanceCvScale) * 100
    }

    // MARK: tier

    public static func overallTier(
        unlockedLevels: [Int], anyStrengthProgressSignal: Bool,
        dominantConfidence: EstimateConfidence, balanceScore: Double?,
        config: MuscleLevelModelConfig
    ) -> TrainingTier {
        guard unlockedLevels.count >= config.balanceMinUnlockedMuscles,
              dominantConfidence != .low else { return .calibrating }
        let median = medianOf(unlockedLevels)
        var tier: TrainingTier
        switch median {
        case ..<Double(config.tierBeginnerMaxLevel):
            tier = .beginner
        case ..<Double(config.tierNovicePlusMaxLevel):
            tier = .novicePlus
        case ..<Double(config.tierIntermediateMaxLevel):
            // intermediate 起需至少一路力量进步信号（§6.5.4：milestone 或稳定 e1RM 进步）。
            // 无信号时**封顶 novicePlus**（含 advanced/elite 区间）——这是资格门槛非降档，
            // 与 balance 的单步下调语义不同（审查 N1，有意为之，收口写回）。
            tier = anyStrengthProgressSignal ? .intermediate : .novicePlus
        case ..<Double(config.tierAdvancedMaxLevel):
            tier = anyStrengthProgressSignal ? .advanced : .novicePlus
        default:
            tier = anyStrengthProgressSignal ? .elite : .novicePlus
        }
        // balance 下调一档（契约：卧推很强但背/腿长期缺口大 → 整体仍在进阶初期）
        if let balance = balanceScore, balance < config.tierBalanceDowngradeBelow {
            tier = downgraded(tier)
        }
        return tier
    }

    // MARK: breakthroughs

    /// 首次解锁（previous 无记录）不产 breakthrough——「解锁」时刻的庆祝归批次 B UI
    /// 层，breakthrough 语义留给已解锁后的提升（有意不对称，审查 N3，收口写回）。
    public static func breakthroughs(
        currentLevels: [MuscleGroupID: Int], previousLevels: [MuscleGroupID: Int],
        currentTier: TrainingTier, previousTier: TrainingTier?, atIso: String
    ) -> [LevelBreakthrough] {
        var out: [LevelBreakthrough] = []
        for (muscle, level) in currentLevels.sorted(by: { $0.key.rawValue < $1.key.rawValue }) {
            guard let previous = previousLevels[muscle], level > previous else { continue }
            out.append(LevelBreakthrough(
                kind: .muscleLevel, targetId: muscle.rawValue,
                fromLevel: previous, toLevel: level, fromTier: nil, toTier: nil,
                evidence: [MuscleLevelEvidence(code: "levelUp", muscleId: muscle)],
                achievedAtIso: atIso))
        }
        if let previousTier, tierRank(currentTier) > tierRank(previousTier) {
            out.append(LevelBreakthrough(
                kind: .trainingTier, targetId: currentTier.rawValue,
                fromLevel: nil, toLevel: nil, fromTier: previousTier, toTier: currentTier,
                evidence: [MuscleLevelEvidence(code: "tierUp")],
                achievedAtIso: atIso))
        }
        return out
    }

    // MARK: 全量组装

    public static func assemble(
        computations: [MuscleLevelComputation],
        observations: [MuscleGroupID: MuscleObservations],
        previousLevels: [MuscleGroupID: Int],
        previousPeaks: [MuscleGroupID: Int],
        previousTier: TrainingTier?,
        generatedAtIso: String,
        config: MuscleLevelModelConfig
    ) -> MuscleDevelopmentProfile {
        let ordered = computations.sorted { $0.muscleId.rawValue < $1.muscleId.rawValue }
        let unlocked = ordered.filter { !$0.isCalibrating }
        let unlockedLevels = unlocked.map(\.level)
        let median = medianOf(unlockedLevels)

        var estimates: [MuscleLevelEstimate] = []
        for comp in ordered {
            let weekly = observations[comp.muscleId]?.weeklyFractionalSets ?? [:]
            let trendValue = trend(weeklySets: weekly, isCalibrating: comp.isCalibrating,
                                   nowISO: generatedAtIso, config: config)
            // V1 四支：reduce（超量回调）依赖 MRV 超量判定，留白后置（审查 O3）。
            let decision: MuscleDevelopmentDecision
            if comp.isCalibrating {
                decision = .insufficientData
            } else if trendValue == .detraining {
                decision = .recover
            } else if Double(comp.level) < median - Double(config.priorityLevelGapBelowMedian) {
                decision = .prioritize
            } else {
                decision = .maintain
            }
            estimates.append(MuscleLevelEstimate(
                muscleId: comp.muscleId,
                currentLevel: comp.level,
                peakLevel: peakLevel(current: comp.level, previousPeak: previousPeaks[comp.muscleId]),
                levelProgress: comp.progress,
                trend: trendValue,
                confidence: comp.confidence,
                decision: decision,
                score: comp.breakdown,
                evidence: comp.evidence,
                limitations: comp.limitations))
        }

        let balance = balanceScore(unlockedLevels: unlockedLevels, config: config)
        // 严格进步信号（审查 MODERATE：holding=「没退步」≠契约「稳定 e1RM 进步」）
        let progressSignal = unlocked.contains { comp in
            comp.evidence.contains { $0.code == "e1rmRising" } || comp.breakdown.milestoneScore > 0
        }
        // 中位置信（审查 MAJOR：「任一 high 即 high」可被单个专项肌群绕过 calibrating
        // 安全网）——与 tier 的中位等级同口径，偶数取低侧保守。
        let medianConfidence = medianConfidenceOf(unlocked.map(\.confidence))
        let tierValue = overallTier(
            unlockedLevels: unlockedLevels, anyStrengthProgressSignal: progressSignal,
            dominantConfidence: medianConfidence, balanceScore: balance, config: config)

        var currentLevels: [MuscleGroupID: Int] = [:]
        for comp in unlocked { currentLevels[comp.muscleId] = comp.level }
        let maxLevel = unlockedLevels.max() ?? Int.min
        let strongest: [MuscleGroupID] = unlocked.filter { $0.level == maxLevel }.map { $0.muscleId }
        let priority: [MuscleGroupID] = estimates.filter { $0.decision == .prioritize }.map { $0.muscleId }

        return MuscleDevelopmentProfile(
            estimates: estimates,
            overallTier: tierValue,
            balanceScore: balance,
            strongestMuscleIds: strongest,
            priorityMuscleIds: priority,
            strengthMilestones: [],   // MLE-4 接入
            breakthroughs: breakthroughs(
                currentLevels: currentLevels, previousLevels: previousLevels,
                currentTier: tierValue, previousTier: previousTier, atIso: generatedAtIso),
            generatedAtIso: generatedAtIso,
            modelVersion: config.modelVersion)
    }

    // MARK: - private

    private static func medianOf(_ values: [Int]) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        return sorted.count % 2 == 0
            ? Double(sorted[mid - 1] + sorted[mid]) / 2
            : Double(sorted[mid])
    }

    private static func medianConfidenceOf(_ values: [EstimateConfidence]) -> EstimateConfidence {
        guard !values.isEmpty else { return .low }
        let ranked = values.map(confidenceRank).sorted()
        let median = ranked[(ranked.count - 1) / 2]   // 偶数取低侧（保守）
        switch median {
        case 2: return .high
        case 1: return .medium
        default: return .low
        }
    }

    private static func confidenceRank(_ c: EstimateConfidence) -> Int {
        switch c {
        case .low: return 0
        case .medium: return 1
        case .high: return 2
        }
    }

    private static func tierRank(_ tier: TrainingTier) -> Int {
        switch tier {
        case .calibrating: return 0
        case .beginner: return 1
        case .novicePlus: return 2
        case .intermediate: return 3
        case .advanced: return 4
        case .elite: return 5
        }
    }

    private static func downgraded(_ tier: TrainingTier) -> TrainingTier {
        switch tier {
        case .elite: return .advanced
        case .advanced: return .intermediate
        case .intermediate: return .novicePlus
        case .novicePlus: return .beginner
        case .beginner, .calibrating: return tier
        }
    }
}
