// MuscleLevelTypes — MLE 契约输出类型骨架（MLE-0 2026-07-07，系统逻辑 §6.5.3 落包）。
//
// 等级输出是 read-only projection：纯派生、不写 canonical（§6.5.12）、同输入必同输出、
// 必须本地可审计复算（§6.5.14 禁 LLM 判定）。本文件只有类型与常量，估计逻辑在
// MLE-1~3 逐片落地。
//
// 架构决策（收口规格写回项）：契约 §6.5.1 原文「等级系统属于 RedeTrainingDecision」，
// 实现落 RedeLocalSnapshot——估计器消费 snapshot 层输入（statsRecords/e1RM 趋势）且
// 输出为展示投影，与本包既有职责（ProgressSnapshot/分享快照）同域；收口时回写 §6.5.1。
//
// MuscleGroupID 与 RedeTrainingDecision.MuscleGroupID 是**两份同值枚举**：本包
// Foundation-only 零依赖是 Master §5 硬合同（与 canonical 强制解耦），禁跨包
// re-export（D1 审查指路 2026-07-07）。两侧测试各自锚同一组 rawValue 字面量防漂移。
//
// 契约有意偏离（收口规格写回）：`MuscleDevelopmentProfile.balanceScore` 契约为
// Double，实现为 Double?——少于 3 个已解锁肌群时均衡度在统计上无意义，nil 如实
// 优于编一个数（「不给用户看编造数据」红线在输出层的执行）。

import Foundation

/// MLE 契约 10 值肌群（§6.5.3；与 RedeTrainingDecision 同值副本，见文件头）。
public enum MuscleGroupID: String, CaseIterable, Equatable, Sendable, Codable {
    case chest, back, quads, hamstrings, glutes
    case shoulders, biceps, triceps, calves, core
}

public enum MuscleLevelTrend: String, CaseIterable, Equatable, Sendable {
    case rising, stable, declining, detraining, calibrating
}

/// 给计划引擎的动作语义（非 UI 文案，§6.5.3）。
public enum MuscleDevelopmentDecision: String, CaseIterable, Equatable, Sendable {
    case prioritize, maintain, reduce, recover, insufficientData
}

public enum TrainingTier: String, CaseIterable, Equatable, Sendable {
    case calibrating, beginner, novicePlus, intermediate, advanced, elite
}

/// 估计置信（引擎内部量：UI 不作读数显示，走行为表达——Copy Baseline §3.4 红线）。
public enum EstimateConfidence: String, CaseIterable, Equatable, Sendable {
    case low, medium, high
}

public enum LevelBreakthroughKind: String, CaseIterable, Equatable, Sendable {
    case muscleLevel, trainingTier, strengthMilestone, balanceMilestone, consistencyMilestone
}

public enum StrengthMilestoneAchievementMethod: String, CaseIterable, Equatable, Sendable {
    case actualCompletedSet, estimatedOneRepMax
}

/// 等级依据条目（零文案：引擎产 code，UI 层翻译——同 reasonCode 模式）。
public struct MuscleLevelEvidence: Equatable, Sendable {
    public let code: String
    public let muscleId: MuscleGroupID?
    public init(code: String, muscleId: MuscleGroupID? = nil) {
        self.code = code
        self.muscleId = muscleId
    }
}

/// 不确定性说明条目（历史不足/器械未校准/缺权重等，§6.5.3）。
public struct MuscleLevelLimitation: Equatable, Sendable {
    public let code: String
    public init(code: String) { self.code = code }
}

/// §6.5.7 八子分数（V1 权重规则模型在 MLE-2；结构完整先行，四项恒零留位）。
public struct MuscleLevelScoreBreakdown: Equatable, Sendable {
    public let exposureScore: Double
    public let performanceScore: Double
    public let milestoneScore: Double
    public let progressionScore: Double
    public let coverageScore: Double
    public let consistencyScore: Double
    public let recoveryPenalty: Double
    public let goalAdjustment: Double

    public var total: Double {
        exposureScore + performanceScore + milestoneScore + progressionScore
            + coverageScore + consistencyScore - recoveryPenalty + goalAdjustment
    }

    public init(exposureScore: Double, performanceScore: Double, milestoneScore: Double,
                progressionScore: Double, coverageScore: Double, consistencyScore: Double,
                recoveryPenalty: Double, goalAdjustment: Double) {
        self.exposureScore = exposureScore
        self.performanceScore = performanceScore
        self.milestoneScore = milestoneScore
        self.progressionScore = progressionScore
        self.coverageScore = coverageScore
        self.consistencyScore = consistencyScore
        self.recoveryPenalty = recoveryPenalty
        self.goalAdjustment = goalAdjustment
    }
}

/// 公认重量突破（契约版；MLE-4 扩既有 FR-PR7 catalog 时消费）。
public struct StrengthMilestoneAchievement: Equatable, Sendable {
    public let milestoneId: String
    public let exerciseId: String
    public let displayName: String
    public let thresholdKg: Double
    public let thresholdLb: Double?
    public let achievedBy: StrengthMilestoneAchievementMethod
    public let sourceSetId: String?
    public let achievedAtIso: String
    public let linkedMuscleIds: [MuscleGroupID]
    public let levelFloor: Int?
    public let tierFloor: TrainingTier?
    public let confidence: EstimateConfidence

    public init(milestoneId: String, exerciseId: String, displayName: String,
                thresholdKg: Double, thresholdLb: Double?,
                achievedBy: StrengthMilestoneAchievementMethod, sourceSetId: String?,
                achievedAtIso: String, linkedMuscleIds: [MuscleGroupID],
                levelFloor: Int?, tierFloor: TrainingTier?, confidence: EstimateConfidence) {
        self.milestoneId = milestoneId
        self.exerciseId = exerciseId
        self.displayName = displayName
        self.thresholdKg = thresholdKg
        self.thresholdLb = thresholdLb
        self.achievedBy = achievedBy
        self.sourceSetId = sourceSetId
        self.achievedAtIso = achievedAtIso
        self.linkedMuscleIds = linkedMuscleIds
        self.levelFloor = levelFloor
        self.tierFloor = tierFloor
        self.confidence = confidence
    }
}

public struct LevelBreakthrough: Equatable, Sendable {
    public let kind: LevelBreakthroughKind
    public let targetId: String
    public let fromLevel: Int?
    public let toLevel: Int?
    public let fromTier: TrainingTier?
    public let toTier: TrainingTier?
    public let evidence: [MuscleLevelEvidence]
    public let achievedAtIso: String

    public init(kind: LevelBreakthroughKind, targetId: String, fromLevel: Int?, toLevel: Int?,
                fromTier: TrainingTier?, toTier: TrainingTier?,
                evidence: [MuscleLevelEvidence], achievedAtIso: String) {
        self.kind = kind
        self.targetId = targetId
        self.fromLevel = fromLevel
        self.toLevel = toLevel
        self.fromTier = fromTier
        self.toTier = toTier
        self.evidence = evidence
        self.achievedAtIso = achievedAtIso
    }
}

/// 单肌群等级估计（§6.5.3 输出语义：peakLevel 单调、levelProgress 0...1、trend 需平滑）。
public struct MuscleLevelEstimate: Equatable, Sendable {
    public let muscleId: MuscleGroupID
    public let currentLevel: Int
    public let peakLevel: Int
    public let levelProgress: Double
    public let trend: MuscleLevelTrend
    public let confidence: EstimateConfidence
    public let decision: MuscleDevelopmentDecision
    public let score: MuscleLevelScoreBreakdown
    public let evidence: [MuscleLevelEvidence]
    public let limitations: [MuscleLevelLimitation]

    public init(muscleId: MuscleGroupID, currentLevel: Int, peakLevel: Int, levelProgress: Double,
                trend: MuscleLevelTrend, confidence: EstimateConfidence,
                decision: MuscleDevelopmentDecision, score: MuscleLevelScoreBreakdown,
                evidence: [MuscleLevelEvidence], limitations: [MuscleLevelLimitation]) {
        self.muscleId = muscleId
        self.currentLevel = currentLevel
        self.peakLevel = peakLevel
        self.levelProgress = levelProgress
        self.trend = trend
        self.confidence = confidence
        self.decision = decision
        self.score = score
        self.evidence = evidence
        self.limitations = limitations
    }
}

/// 全身发展档案（read-only projection 根类型）。
public struct MuscleDevelopmentProfile: Equatable, Sendable {
    public let estimates: [MuscleLevelEstimate]
    public let overallTier: TrainingTier
    /// 契约偏离（见文件头）：<3 已解锁肌群时 nil 如实，不编均衡度。
    public let balanceScore: Double?
    public let strongestMuscleIds: [MuscleGroupID]
    public let priorityMuscleIds: [MuscleGroupID]
    public let strengthMilestones: [StrengthMilestoneAchievement]
    public let breakthroughs: [LevelBreakthrough]
    public let generatedAtIso: String
    public let modelVersion: String

    public init(estimates: [MuscleLevelEstimate], overallTier: TrainingTier, balanceScore: Double?,
                strongestMuscleIds: [MuscleGroupID], priorityMuscleIds: [MuscleGroupID],
                strengthMilestones: [StrengthMilestoneAchievement], breakthroughs: [LevelBreakthrough],
                generatedAtIso: String, modelVersion: String) {
        self.estimates = estimates
        self.overallTier = overallTier
        self.balanceScore = balanceScore
        self.strongestMuscleIds = strongestMuscleIds
        self.priorityMuscleIds = priorityMuscleIds
        self.strengthMilestones = strengthMilestones
        self.breakthroughs = breakthroughs
        self.generatedAtIso = generatedAtIso
        self.modelVersion = modelVersion
    }
}

/// 现役模型常量（modelVersion 为真版本；mle-v2 = MLE-8 首轮校准 2026-07-08，owner 真机 E3「3 场 Lv.9 太快」→ 无基线 0 分 + 暴露锚 20 + 置信封顶；变更必须递增 modelVersion + 更新 goldens）。
public struct MuscleLevelModelConfig: Sendable {
    public let modelVersion: String
    public let recentWindowWeeks: Int
    public let baselineWindowWeeks: Int
    /// 每肌群独立解锁门槛（满足其一）：≥N 次训练触及 或 ≥M 有效组。
    public let calibrationMinSessions: Int
    public let calibrationMinEffectiveSets: Int
    public let mediumConfidenceMinSessions: Int
    public let mediumConfidenceMinSets: Int
    /// medium 第三维（§6.5.6）：覆盖 ≥2 个动作族。
    public let mediumConfidenceMinMovementFamilies: Int
    public let highConfidenceMinSessions: Int
    public let highConfidenceMinSets: Int
    /// high 第三维（§6.5.6）：覆盖 2 个以上动作族（≥3）。契约的第四维「关键动作
    /// identity 稳定」**V1 未实现**（置信只判三维；原注释称「由 MLE-2 直接判」与
    /// 代码不符——对账修正 2026-07-08，补齐列批次 C 拍板）。
    public let highConfidenceMinMovementFamilies: Int
    public let levelRange: ClosedRange<Int>

    // MARK: V1 计分锚点（MLE-2；Pelland 效率分档见 EVIDENCE_LEDGER MLE-SCI-2）
    /// 效率折算：≤tier1 全效；(tier1, tier2] ×tier2Rate；>tier2 ×tier3Rate。
    public let effectiveSetsTier1Cap: Double
    public let effectiveSetsTier2Cap: Double
    public let effectiveSetsTier2Rate: Double
    public let effectiveSetsTier3Rate: Double
    /// exposure：全史有记录周的周均有效组达此值拿满 exposureScoreMax（无近窗裁剪，对账注 2026-07-08）。
    public let exposureFullScoreWeeklyEffectiveSets: Double
    public let exposureScoreMax: Double
    /// performance：比率 1.0 = base 分；每 +10% 进步 +perTenPercentGain；封顶 max。
    public let performanceBaseScore: Double
    public let performancePerTenPercentGain: Double
    public let performanceScoreMax: Double
    public let performanceMinPoints: Int
    /// 无基线窗（新用户）时的 performance 分（mle-v2 = 0：强度维度零证据不给分——
    /// 推翻 v1 的 base 15 中性假设，依据 owner 真机 E3 反馈「3 场 Lv.9 太快」；
    /// 新用户等级的保守表达由置信封顶承担，此 0 分非罚分）。
    public let performanceNoBaselineScore: Double
    /// coverage/consistency（V1 低权）：满足动作族数得满 coverage；触及周比例 × consistencyMax。
    public let coverageFullScoreFamilies: Int
    public let coverageScoreMax: Double
    public let consistencyScoreMax: Double
    /// 等级阈值曲线 T(n) = a·n + b·n²（增量线性递增 ≈ 前快后慢；T(20)=100）。
    public let levelCurveLinear: Double
    public let levelCurveQuadratic: Double

    // MARK: V1 组装参数（MLE-3；§6.5.4 tier 区间 + trend 平滑 + balance）
    /// trend：近 N 周均 vs 前 N 周均，超 ±阈值才改向（单次波动不动，§6.5.3 平滑要求）。
    public let trendWindowWeeks: Int
    public let trendDeltaThreshold: Double
    /// balance：已解锁肌群 < 门槛 → nil 如实；cv 达 scale → 0 分。
    public let balanceMinUnlockedMuscles: Int
    public let balanceCvScale: Double
    /// tier 区间上界（§6.5.4 表 V1 起点；elite = advanced 上界之上）。
    public let tierBeginnerMaxLevel: Int
    public let tierNovicePlusMaxLevel: Int
    public let tierIntermediateMaxLevel: Int
    public let tierAdvancedMaxLevel: Int
    /// balance 低于此值 tier 下调一档（契约「必须可被 balanceScore 下调」）。
    public let tierBalanceDowngradeBelow: Double
    /// decision：level 低于解锁中位数此距离 → prioritize（弱项补足信号）。
    public let priorityLevelGapBelowMedian: Int
    /// e1RM 严格进步判定比率（>此值才算 rising，供 tier 进步信号；≈2% 防噪音）。
    public let e1rmRisingMinRatio: Double
    /// 置信等级封顶（mle-v2，§3.4 行为表达「低可信→判断更保守」的等级面）：
    /// low 封 beginner 顶、medium 封 novicePlus→intermediate 门口、high 放开。
    /// milestone floor 在组装层后应用，实测成就胜过数据量保守（有意排序）。
    public let lowConfidenceLevelCap: Int
    public let mediumConfidenceLevelCap: Int

    public static let current = MuscleLevelModelConfig(
        modelVersion: "mle-v2",
        recentWindowWeeks: 6,
        baselineWindowWeeks: 24,
        calibrationMinSessions: 3,
        calibrationMinEffectiveSets: 8,
        mediumConfidenceMinSessions: 6,
        mediumConfidenceMinSets: 18,
        mediumConfidenceMinMovementFamilies: 2,
        highConfidenceMinSessions: 12,
        highConfidenceMinSets: 36,
        highConfidenceMinMovementFamilies: 3,
        levelRange: 1...20,
        effectiveSetsTier1Cap: 10,
        effectiveSetsTier2Cap: 18,
        effectiveSetsTier2Rate: 0.7,
        effectiveSetsTier3Rate: 0.5,
        exposureFullScoreWeeklyEffectiveSets: 20,
        exposureScoreMax: 60,
        performanceBaseScore: 15,
        performancePerTenPercentGain: 7.5,
        performanceScoreMax: 30,
        performanceMinPoints: 2,
        performanceNoBaselineScore: 0,
        coverageFullScoreFamilies: 2,
        coverageScoreMax: 5,
        consistencyScoreMax: 5,
        levelCurveLinear: 1.0,
        levelCurveQuadratic: 0.2,
        trendWindowWeeks: 3,
        trendDeltaThreshold: 0.15,
        balanceMinUnlockedMuscles: 3,
        balanceCvScale: 1.0,
        tierBeginnerMaxLevel: 5,
        tierNovicePlusMaxLevel: 8,
        tierIntermediateMaxLevel: 12,
        tierAdvancedMaxLevel: 16,
        tierBalanceDowngradeBelow: 40,
        priorityLevelGapBelowMedian: 3,
        e1rmRisingMinRatio: 1.02,
        lowConfidenceLevelCap: 5,
        mediumConfidenceLevelCap: 10
    )
}
