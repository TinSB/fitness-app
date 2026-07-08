// MuscleLevelEstimator — developmentScore 双主轴计分 + Lv 曲线 + 校准/置信判定（MLE-2 2026-07-07）。
//
// V1 权重（§6.5.7 八子分数结构保留）：exposure（0-60，Pelland 效率折算后的周均有效量）
// + performance（0-30，近窗峰 e1RM / 基线窗峰 e1RM 相对自身进步）主轴；coverage/consistency
// （各 0-5）低权；milestone/progression/recovery/goal 四项 V1 恒 0 留位（milestone 锚 MLE-4
// 接入，其余后置）。全部锚点在 MuscleLevelModelConfig（modelVersion 纪律）。
//
// 诚实边界：等级是「训练量 × 相对自身进步」的 Rede 专有口径（EVIDENCE_LEDGER MLE-SCI-3：
// 文献不存在肌群 Lv 标准）——不比人群、不测围度；无力量信号（自重类）performance=0 并
// 留 limitation，不编。校准未解锁产 isCalibrating 计算体（level 占位 1，UI 灰显），
// 解锁门槛满足其一即过（§6.5.6：≥3 次触及 或 ≥8 有效组）。同输入必同输出。

import Foundation

/// 单肌群观察输入（调用方从聚合器/趋势摊平；批次 B 接线）。
public struct MuscleObservations: Equatable, Sendable {
    public struct E1RMObservation: Equatable, Sendable {
        public let dateISO: String
        public let e1RmKg: Double
        public init(dateISO: String, e1RmKg: Double) {
            self.dateISO = dateISO
            self.e1RmKg = e1RmKg
        }
    }

    public let muscleId: MuscleGroupID
    /// [ISO 周一: fractional 组数]（MuscleVolumeAggregator 输出的单肌群切片）。
    public let weeklyFractionalSets: [String: Double]
    public let sessionsTouched: Int
    public let movementFamiliesTouched: Int
    public let e1rmPoints: [E1RMObservation]

    public init(muscleId: MuscleGroupID, weeklyFractionalSets: [String: Double],
                sessionsTouched: Int, movementFamiliesTouched: Int,
                e1rmPoints: [E1RMObservation]) {
        self.muscleId = muscleId
        self.weeklyFractionalSets = weeklyFractionalSets
        self.sessionsTouched = sessionsTouched
        self.movementFamiliesTouched = movementFamiliesTouched
        self.e1rmPoints = e1rmPoints
    }
}

/// MLE-2 计算中间体（trend/peak/decision/tier 由 MLE-3 组装成完整 Estimate）。
public struct MuscleLevelComputation: Equatable, Sendable {
    public let muscleId: MuscleGroupID
    public let isCalibrating: Bool
    public let level: Int
    /// 修饰前曲线级（置信封顶/milestone floor 都不吃）：balance 的唯一输入——
    /// cap 把「全压到 5」的方差归零当均衡=假均衡（mle-v2 实拍抓获），与 floor
    /// 「不能强行美化」同款语义，balance 一律看原始曲线级。
    public let curveLevel: Int
    public let progress: Double
    public let confidence: EstimateConfidence
    public let breakdown: MuscleLevelScoreBreakdown
    public let evidence: [MuscleLevelEvidence]
    public let limitations: [MuscleLevelLimitation]
}

public enum MuscleLevelEstimator {
    // MARK: 效率折算（Pelland 分档）

    public static func effectiveSets(rawWeeklySets: Double, config: MuscleLevelModelConfig) -> Double {
        guard rawWeeklySets > 0 else { return 0 }
        let tier1 = min(rawWeeklySets, config.effectiveSetsTier1Cap)
        let tier2 = max(0, min(rawWeeklySets, config.effectiveSetsTier2Cap) - config.effectiveSetsTier1Cap)
        let tier3 = max(0, rawWeeklySets - config.effectiveSetsTier2Cap)
        return tier1 + tier2 * config.effectiveSetsTier2Rate + tier3 * config.effectiveSetsTier3Rate
    }

    // MARK: 等级曲线

    /// T(n) = a·n + b·n²（增量线性递增；v1 参数下 T(20)=100）。
    public static func levelThreshold(_ level: Int, config: MuscleLevelModelConfig) -> Double {
        let n = Double(level)
        return config.levelCurveLinear * n + config.levelCurveQuadratic * n * n
    }

    /// score → (level, 到下一级进度)。封顶 levelRange 上界；解锁后至少下界。
    public static func level(forScore score: Double, config: MuscleLevelModelConfig)
        -> (level: Int, progress: Double) {
        let top = config.levelRange.upperBound
        let bottom = config.levelRange.lowerBound
        if score >= levelThreshold(top, config: config) { return (top, 1.0) }
        var current = bottom
        for n in config.levelRange where score >= levelThreshold(n, config: config) {
            current = n
        }
        // bottom 桶 floor 恒 0（解锁即 Lv1，进度从 0 分起步连续爬到 T(2)）——若按
        // 「score ≥ T(1) 才取 T(1) 作 floor」会在跨 T(1) 瞬间进度回跳（审查 MAJOR，
        // 0.001 步进扫描实测 0.43→0 唯一非单调点）。Lv2+ 的 current 必满足
        // score ≥ T(current)，floor/ceiling 天然一致。
        let floor = current == bottom ? 0 : levelThreshold(current, config: config)
        let ceiling = levelThreshold(min(current + 1, top), config: config)
        let span = ceiling - floor
        let progress = span > 0 ? min(max((score - floor) / span, 0), 1) : 1
        return (current, progress)
    }

    // MARK: 主计算

    public static func compute(
        observations: MuscleObservations,
        config: MuscleLevelModelConfig,
        nowISO: String? = nil
    ) -> MuscleLevelComputation {
        let totalFractionalSets = observations.weeklyFractionalSets.values.reduce(0, +)

        // 校准解锁（满足其一）：≥N 次触及 或 ≥M 有效组（§6.5.6）
        let unlocked = observations.sessionsTouched >= config.calibrationMinSessions
            || totalFractionalSets >= Double(config.calibrationMinEffectiveSets)

        var evidence: [MuscleLevelEvidence] = []
        var limitations: [MuscleLevelLimitation] = []

        // exposure：全史有记录周的周均有效组 → 线性映射封顶（对账注 2026-07-08：无近窗
        // 裁剪——长停练旧周量仍计入周均，等级下降现靠 performance→0 与 trend/decision；
        // 是否加窗口衰减列批次 C 拍板，改行为须 modelVersion v3）
        let recordedWeeks = observations.weeklyFractionalSets.values.filter { $0 > 0 }
        let weeklyEffectiveAvg = recordedWeeks.isEmpty ? 0
            : recordedWeeks.map { effectiveSets(rawWeeklySets: $0, config: config) }
                .reduce(0, +) / Double(recordedWeeks.count)
        // 频率折减（审查 MAJOR：单次/单周暴量曾可刷到 Lv.11-14）：周均有效量再乘
        // 触及周占比（与 consistency 同源比值、零新常量）——「一周狂练」拿不满
        // exposure，量必须跨周持续才算数（契约 §6.5.9 冷启动精神）。
        let frequencyFactor = min(Double(recordedWeeks.count) / Double(config.recentWindowWeeks), 1)
        let exposure = min(weeklyEffectiveAvg / config.exposureFullScoreWeeklyEffectiveSets, 1)
            * config.exposureScoreMax * frequencyFactor
        if weeklyEffectiveAvg > 0 {
            evidence.append(MuscleLevelEvidence(code: "exposureRecentSets", muscleId: observations.muscleId))
        }

        // performance：近窗峰 / 基线窗峰（相对自身；窗锚 = nowISO 或最新观测日）
        let performance = performanceScore(
            points: observations.e1rmPoints, nowISO: nowISO, config: config,
            muscleId: observations.muscleId, evidence: &evidence, limitations: &limitations)

        // coverage / consistency（V1 低权）
        let coverage = observations.movementFamiliesTouched >= config.coverageFullScoreFamilies
            ? config.coverageScoreMax : 0
        let touchedWeeks = Double(recordedWeeks.count)
        let consistency = min(touchedWeeks / Double(config.recentWindowWeeks), 1) * config.consistencyScoreMax

        let breakdown = MuscleLevelScoreBreakdown(
            exposureScore: exposure, performanceScore: performance,
            milestoneScore: 0, progressionScore: 0,
            coverageScore: coverage, consistencyScore: consistency,
            recoveryPenalty: 0, goalAdjustment: 0)

        guard unlocked else {
            limitations.append(MuscleLevelLimitation(code: "shortHistory"))
            return MuscleLevelComputation(
                muscleId: observations.muscleId, isCalibrating: true,
                level: config.levelRange.lowerBound, curveLevel: config.levelRange.lowerBound,
                progress: 0,
                confidence: .low, breakdown: breakdown,
                evidence: evidence, limitations: limitations)
        }

        // 置信三维（§6.5.6）：次数 × 组数 × 动作族，逐档全满才升
        let confidence: EstimateConfidence
        if observations.sessionsTouched >= config.highConfidenceMinSessions,
           totalFractionalSets >= Double(config.highConfidenceMinSets),
           observations.movementFamiliesTouched >= config.highConfidenceMinMovementFamilies {
            confidence = .high
        } else if observations.sessionsTouched >= config.mediumConfidenceMinSessions,
                  totalFractionalSets >= Double(config.mediumConfidenceMinSets),
                  observations.movementFamiliesTouched >= config.mediumConfidenceMinMovementFamilies {
            confidence = .medium
        } else {
            confidence = .low
        }

        let (curveLevel, curveProgress) = level(forScore: breakdown.total, config: config)
        // 置信等级封顶（mle-v2，§3.4 行为表达）：数据量撑不起的高等级不出——low 封
        // beginner 顶、medium 封 intermediate 门口、high 放开。命中时 progress 顶格 1
        //（分数已超、等数据解锁——非「刚进入此级」）+ 专用 evidence 供依据行解释；
        // milestone floor 在组装层后应用，实测成就胜过数据量保守（有意排序）。
        let cap: Int
        switch confidence {
        case .high: cap = config.levelRange.upperBound
        case .medium: cap = config.mediumConfidenceLevelCap
        case .low: cap = config.lowConfidenceLevelCap
        }
        let capped = min(curveLevel, cap)
        if capped < curveLevel {
            evidence.append(MuscleLevelEvidence(code: "confidenceLevelCapApplied",
                                                muscleId: observations.muscleId))
        }
        return MuscleLevelComputation(
            muscleId: observations.muscleId, isCalibrating: false,
            level: capped, curveLevel: curveLevel,
            progress: capped < curveLevel ? 1 : curveProgress,
            confidence: confidence, breakdown: breakdown,
            evidence: evidence, limitations: limitations)
    }

    // MARK: - private

    private static func performanceScore(
        points: [MuscleObservations.E1RMObservation], nowISO: String?,
        config: MuscleLevelModelConfig, muscleId: MuscleGroupID,
        evidence: inout [MuscleLevelEvidence], limitations: inout [MuscleLevelLimitation]
    ) -> Double {
        guard points.count >= config.performanceMinPoints else {
            limitations.append(MuscleLevelLimitation(code: "noStrengthSignal"))
            return 0
        }
        let anchor = nowISO ?? points.map(\.dateISO).max() ?? ""
        guard let anchorDay = SnapshotDayMath.dayNumber(of: anchor) else {
            // 锚点日期解析失败（调用方格式错误）与点数不足共用 code：都表达
            // 「无可用力量信号」，UI 语义相同（有意共用，非遗漏）
            limitations.append(MuscleLevelLimitation(code: "noStrengthSignal"))
            return 0
        }
        let recentStart = SnapshotDayMath.isoString(fromDayNumber: anchorDay - 7 * config.recentWindowWeeks)
        let baselineStart = SnapshotDayMath.isoString(fromDayNumber: anchorDay - 7 * config.baselineWindowWeeks)
        let recentPeak = points.filter { $0.dateISO >= recentStart && $0.dateISO <= anchor }
            .map(\.e1RmKg).max()
        let baselinePeak = points.filter { $0.dateISO >= baselineStart && $0.dateISO < recentStart }
            .map(\.e1RmKg).max()
        guard let recent = recentPeak else {
            // 停练：基线在、近窗零训练——真实缺席信号，0 分如实（审查 MODERATE 拆分）
            limitations.append(MuscleLevelLimitation(code: "noRecentWindow"))
            return 0
        }
        guard let baseline = baselinePeak, baseline > 0 else {
            // 新用户：近窗在练、基线窗尚未积累。mle-v2 反转 v1 的「中性 base 15」拍板
            //（owner 真机 E3：base 白送是「3 场 Lv.9-12」三因素之一）——强度维度零证据
            // = 0 分；这不是罚分：新用户的保守等级表达由置信封顶承担（compute 尾部），
            // 语义与 balanceScore nil「不编也不罚」重新对齐。
            _ = recent
            limitations.append(MuscleLevelLimitation(code: "noBaselineWindow"))
            return config.performanceNoBaselineScore
        }
        let ratio = recent / baseline
        let score = config.performanceBaseScore
            + (ratio - 1) * 10 * config.performancePerTenPercentGain
        // 三分（MLE-3 审查 N2）：rising=严格进步（供 tier 进步信号）；holding=持平不退。
        let code = ratio > config.e1rmRisingMinRatio ? "e1rmRising"
            : (ratio >= 1 ? "e1rmHolding" : "e1rmDeclining")
        evidence.append(MuscleLevelEvidence(code: code, muscleId: muscleId))
        return min(max(score, 0), config.performanceScoreMax)
    }
}
