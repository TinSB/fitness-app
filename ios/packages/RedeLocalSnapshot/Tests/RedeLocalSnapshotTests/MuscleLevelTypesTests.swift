// MLE-0（2026-07-07）：契约类型骨架 + MuscleLevelModelConfig 锚句。
// 语义锁：①MuscleGroupID 与 RedeTrainingDecision.MuscleGroupID 是**两份同值枚举**
//（本包 Foundation-only 零依赖是 Master §5 硬合同，禁跨包 re-export——D1 审查指路）；
// 两侧各自锚同一组 rawValue 字面量，漂移时至少一侧转红。②全部 V1 常量集中
// MuscleLevelModelConfig 带 modelVersion（§6.5.6 起点值照录），禁散落魔法数字。

import XCTest
@testable import RedeLocalSnapshot

final class MuscleLevelTypesTests: XCTestCase {
    // 与 RedeTrainingDecisionTests.MuscleGroupMappingTests 锚同一组字面量（跨包防漂移）。
    func testMuscleGroupIDMatchesContractTenValues() {
        XCTAssertEqual(MuscleGroupID.allCases.count, 10)
        XCTAssertEqual(
            Set(MuscleGroupID.allCases.map(\.rawValue)),
            ["chest", "back", "quads", "hamstrings", "glutes",
             "shoulders", "biceps", "triceps", "calves", "core"]
        )
    }

    func testTrainingTierContractSixValues() {
        XCTAssertEqual(
            TrainingTier.allCases.map(\.rawValue),
            ["calibrating", "beginner", "novicePlus", "intermediate", "advanced", "elite"]
        )
    }

    func testTrendAndDecisionAndConfidenceContractValues() {
        XCTAssertEqual(
            MuscleLevelTrend.allCases.map(\.rawValue),
            ["rising", "stable", "declining", "detraining", "calibrating"]
        )
        XCTAssertEqual(
            MuscleDevelopmentDecision.allCases.map(\.rawValue),
            ["prioritize", "maintain", "reduce", "recover", "insufficientData"]
        )
        XCTAssertEqual(EstimateConfidence.allCases.map(\.rawValue), ["low", "medium", "high"])
    }

    // §6.5.6 起点值照录（V1 模型常量，待真实数据校准——集中 Config 便于 modelVersion 纪律）。
    func testModelConfigV1Anchors() {
        let c = MuscleLevelModelConfig.v1
        XCTAssertEqual(c.modelVersion, "mle-v1")
        XCTAssertEqual(c.recentWindowWeeks, 6)
        XCTAssertEqual(c.baselineWindowWeeks, 24)
        XCTAssertEqual(c.calibrationMinSessions, 3)
        XCTAssertEqual(c.calibrationMinEffectiveSets, 8)
        XCTAssertEqual(c.mediumConfidenceMinSessions, 6)
        XCTAssertEqual(c.mediumConfidenceMinSets, 18)
        XCTAssertEqual(c.mediumConfidenceMinMovementFamilies, 2)
        XCTAssertEqual(c.highConfidenceMinSessions, 12)
        XCTAssertEqual(c.highConfidenceMinSets, 36)
        XCTAssertEqual(c.highConfidenceMinMovementFamilies, 3) // 「2 个以上」= ≥3（§6.5.6 原文）
        XCTAssertEqual(c.levelRange, 1...20)
    }

    func testRecoveryPenaltyIsSubtractive() {
        // 「Safety/recovery 永远优先于升级」（§6.5.7）：penalty 必须压低 total——
        // 手滑改成加项时此测试转红。
        func breakdown(penalty: Double) -> MuscleLevelScoreBreakdown {
            MuscleLevelScoreBreakdown(
                exposureScore: 40, performanceScore: 30, milestoneScore: 5, progressionScore: 5,
                coverageScore: 5, consistencyScore: 5, recoveryPenalty: penalty, goalAdjustment: 0)
        }
        XCTAssertEqual(breakdown(penalty: 10).total, breakdown(penalty: 0).total - 10)
        XCTAssertLessThan(breakdown(penalty: 20).total, breakdown(penalty: 5).total)
    }

    func testBreakthroughKindAndMilestoneMethodContractValues() {
        XCTAssertEqual(
            LevelBreakthroughKind.allCases.map(\.rawValue),
            ["muscleLevel", "trainingTier", "strengthMilestone", "balanceMilestone", "consistencyMilestone"]
        )
        XCTAssertEqual(
            StrengthMilestoneAchievementMethod.allCases.map(\.rawValue),
            ["actualCompletedSet", "estimatedOneRepMax"]
        )
    }

    func testScoreBreakdownHasEightContractComponents() {
        // §6.5.7 八子分数结构保留（V1 四项恒零由 MLE-2 实现，结构先行）
        let b = MuscleLevelScoreBreakdown(
            exposureScore: 40, performanceScore: 30, milestoneScore: 0, progressionScore: 0,
            coverageScore: 5, consistencyScore: 5, recoveryPenalty: 0, goalAdjustment: 0)
        XCTAssertEqual(b.total, 80)
    }

    func testProfileAndEstimateAreEquatableValueTypes() {
        let estimate = MuscleLevelEstimate(
            muscleId: .chest, currentLevel: 3, peakLevel: 4, levelProgress: 0.5,
            trend: .rising, confidence: .medium, decision: .maintain,
            score: MuscleLevelScoreBreakdown(
                exposureScore: 50, performanceScore: 20, milestoneScore: 0, progressionScore: 0,
                coverageScore: 5, consistencyScore: 5, recoveryPenalty: 0, goalAdjustment: 0),
            evidence: [MuscleLevelEvidence(code: "exposureRecentSets", muscleId: .chest)],
            limitations: [MuscleLevelLimitation(code: "shortHistory")])
        let profile = MuscleDevelopmentProfile(
            estimates: [estimate], overallTier: .beginner, balanceScore: nil,
            strongestMuscleIds: [.chest], priorityMuscleIds: [],
            strengthMilestones: [], breakthroughs: [],
            generatedAtIso: "2026-07-07", modelVersion: MuscleLevelModelConfig.v1.modelVersion)
        // 两次独立构造字段全同 → 相等；改一个字段 → 不等（真区分度，非重言式）
        let profileTwin = MuscleDevelopmentProfile(
            estimates: [estimate], overallTier: .beginner, balanceScore: nil,
            strongestMuscleIds: [.chest], priorityMuscleIds: [],
            strengthMilestones: [], breakthroughs: [],
            generatedAtIso: "2026-07-07", modelVersion: MuscleLevelModelConfig.v1.modelVersion)
        XCTAssertEqual(profile, profileTwin)
        let profileOtherTier = MuscleDevelopmentProfile(
            estimates: [estimate], overallTier: .intermediate, balanceScore: nil,
            strongestMuscleIds: [.chest], priorityMuscleIds: [],
            strengthMilestones: [], breakthroughs: [],
            generatedAtIso: "2026-07-07", modelVersion: MuscleLevelModelConfig.v1.modelVersion)
        XCTAssertNotEqual(profile, profileOtherTier)
        XCTAssertEqual(profile.estimates.first?.muscleId, .chest)
    }
}
