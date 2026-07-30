import XCTest
@testable import RedeLocalSnapshot

final class MuscleEventShareBuilderTests: XCTestCase {
    private let zeroScore = MuscleLevelScoreBreakdown(
        exposureScore: 0,
        performanceScore: 0,
        milestoneScore: 0,
        progressionScore: 0,
        coverageScore: 0,
        consistencyScore: 0,
        recoveryPenalty: 0,
        goalAdjustment: 0
    )

    private func estimate(
        _ muscle: MuscleGroupID,
        confidence: EstimateConfidence,
        level: Int = 9
    ) -> MuscleLevelEstimate {
        MuscleLevelEstimate(
            muscleId: muscle,
            currentLevel: level,
            peakLevel: level,
            levelProgress: 0,
            trend: .rising,
            confidence: confidence,
            decision: .maintain,
            score: zeroScore,
            evidence: [],
            limitations: []
        )
    }

    private func profile(_ estimates: [MuscleLevelEstimate]) -> MuscleDevelopmentProfile {
        MuscleDevelopmentProfile(
            estimates: estimates,
            overallTier: .novicePlus,
            balanceScore: 80,
            strongestMuscleIds: [],
            priorityMuscleIds: [],
            strengthMilestones: [],
            breakthroughs: [],
            generatedAtIso: "2026-07-29",
            modelVersion: "test-only"
        )
    }

    private func levelEvent(
        muscle: String = "back",
        confidenceDate: String = "2026-07-29"
    ) -> LevelBreakthrough {
        LevelBreakthrough(
            kind: .muscleLevel,
            targetId: muscle,
            fromLevel: 8,
            toLevel: 9,
            fromTier: nil,
            toTier: nil,
            evidence: [],
            achievedAtIso: confidenceDate
        )
    }

    func testTodayMediumConfidenceLevelEventBuildsCardAndOldEventDoesNot() {
        let snapshots = MuscleEventShareBuilder.snapshots(
            pending: [
                levelEvent(muscle: "chest", confidenceDate: "2026-07-28"),
                levelEvent(),
            ],
            profile: profile([estimate(.back, confidence: .medium)]),
            generatedDateISO: "2026-07-29",
            recentTrainingDays: 9
        )

        XCTAssertEqual(snapshots.count, 1)
        guard case .levelUp(let card) = snapshots[0].content else {
            return XCTFail("应为 levelUp")
        }
        XCTAssertEqual(card.changes.map(\.muscleRaw), ["back"])
        XCTAssertEqual(card.recentTrainingDays, 9)
    }

    func testLowConfidenceMuscleUpgradeDoesNotBuildCard() {
        let snapshots = MuscleEventShareBuilder.snapshots(
            pending: [levelEvent()],
            profile: profile([estimate(.back, confidence: .low)]),
            generatedDateISO: "2026-07-29",
            recentTrainingDays: 9
        )
        XCTAssertTrue(snapshots.isEmpty)
    }

    func testTierUpgradeUsesConservativeMedianConfidenceGate() {
        let tier = LevelBreakthrough(
            kind: .trainingTier,
            targetId: "overall",
            fromLevel: nil,
            toLevel: nil,
            fromTier: .beginner,
            toTier: .novicePlus,
            evidence: [],
            achievedAtIso: "2026-07-29"
        )
        let lowMedian = profile([
            estimate(.back, confidence: .low),
            estimate(.chest, confidence: .medium),
        ])
        XCTAssertTrue(MuscleEventShareBuilder.snapshots(
            pending: [tier],
            profile: lowMedian,
            generatedDateISO: "2026-07-29",
            recentTrainingDays: 4
        ).isEmpty, "偶数 confidence 中位取低侧，与 tier 惯例一致")

        let mediumMedian = profile([
            estimate(.back, confidence: .medium),
            estimate(.chest, confidence: .medium),
        ])
        let snapshots = MuscleEventShareBuilder.snapshots(
            pending: [tier],
            profile: mediumMedian,
            generatedDateISO: "2026-07-29",
            recentTrainingDays: 4
        )
        XCTAssertEqual(snapshots.count, 1)
    }

    func testBalanceMilestoneBuildsOneCardWithEvidenceDirections() {
        let balance = LevelBreakthrough(
            kind: .balanceMilestone,
            targetId: "back",
            fromLevel: 71,
            toLevel: 82,
            fromTier: nil,
            toTier: nil,
            evidence: [
                .init(code: "balanceImproved", muscleId: .back),
                .init(code: "balanceImproved", muscleId: .quads),
            ],
            achievedAtIso: "2026-07-29"
        )
        let snapshots = MuscleEventShareBuilder.snapshots(
            pending: [balance],
            profile: profile([]),
            generatedDateISO: "2026-07-29",
            recentTrainingDays: 0
        )

        XCTAssertEqual(snapshots.count, 1)
        guard case .balanceImprovement(let card) = snapshots[0].content else {
            return XCTFail("应为 balanceImprovement")
        }
        XCTAssertEqual(card.fromScore, 71)
        XCTAssertEqual(card.toScore, 82)
        XCTAssertEqual(card.improvingMuscleRaws, ["back", "quads"])
    }

    func testRecentTrainingDaysCountsUniqueDatesInInclusiveFourWeekWindow() {
        XCTAssertEqual(
            MuscleEventShareBuilder.recentTrainingDayCount(
                dateISOs: [
                    "2026-07-29",
                    "2026-07-29",
                    "2026-07-02", // 相差 27 天，计入
                    "2026-07-01", // 相差 28 天，不计
                    "bad",
                    "2026-07-30", // 未来，不计
                ],
                throughISO: "2026-07-29"
            ),
            2
        )
    }
}
