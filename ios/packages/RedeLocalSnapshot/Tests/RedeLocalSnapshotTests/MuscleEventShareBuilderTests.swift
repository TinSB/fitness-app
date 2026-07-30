import XCTest
@testable import RedeLocalSnapshot

final class MuscleEventShareBuilderTests: XCTestCase {
    private func eventFacts(
        confidence: String,
        decisions: [String] = ["maintain"],
        limitations: [String] = [],
        recoveryPenalty: Double = 0
    ) -> LevelBreakthroughEventFacts {
        LevelBreakthroughEventFacts(
            confidenceAtEventRaw: confidence,
            decisionRawsAtEvent: decisions,
            limitationCodesAtEvent: limitations,
            recoveryPenaltyAtEvent: recoveryPenalty
        )
    }

    private func levelEvent(
        muscle: String = "back",
        confidenceDate: String = "2026-07-29",
        facts: LevelBreakthroughEventFacts? = nil
    ) -> LevelBreakthrough {
        LevelBreakthrough(
            kind: .muscleLevel,
            targetId: muscle,
            fromLevel: 8,
            toLevel: 9,
            fromTier: nil,
            toTier: nil,
            evidence: [],
            achievedAtIso: confidenceDate,
            eventFacts: facts
        )
    }

    func testTodayEventTimeMediumConfidenceBuildsCardAndOldEventDoesNot() {
        let snapshots = MuscleEventShareBuilder.snapshots(
            pending: [
                levelEvent(
                    muscle: "chest",
                    confidenceDate: "2026-07-28",
                    facts: eventFacts(confidence: "medium")
                ),
                levelEvent(facts: eventFacts(
                    confidence: "medium",
                    limitations: ["noBaselineWindow"]
                )),
            ],
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

    func testLowConfidenceAtFirstAppendRemainsFactOnlyAfterLaterSameKeyBecomesMedium() {
        let lowAtAppend = levelEvent(facts: eventFacts(confidence: "low"))
        let laterMedium = levelEvent(facts: eventFacts(confidence: "medium"))
        let pending = MuscleLevelMemory.mergingPending(
            existing: [lowAtAppend],
            new: [laterMedium]
        )

        let snapshots = MuscleEventShareBuilder.snapshots(
            pending: pending,
            generatedDateISO: "2026-07-29",
            recentTrainingDays: 9
        )

        XCTAssertEqual(
            MuscleEventShareBuilder.todayEvents(
                pending: pending,
                generatedDateISO: "2026-07-29"
            ),
            [lowAtAppend],
            "事实行必须保留"
        )
        XCTAssertTrue(snapshots.isEmpty)
    }

    func testLegacyMissingFactsAndRecoveryOrSafetyFactsFailClosed() {
        let legacy = levelEvent()
        let recovering = levelEvent(
            muscle: "chest",
            facts: eventFacts(confidence: "medium", decisions: ["recover"])
        )
        let recoveryPenalty = levelEvent(
            muscle: "quads",
            facts: eventFacts(confidence: "high", recoveryPenalty: 1)
        )
        let unknownLimitation = levelEvent(
            muscle: "shoulders",
            facts: eventFacts(confidence: "medium", limitations: ["painSignal"])
        )
        let reducing = levelEvent(
            muscle: "biceps",
            facts: eventFacts(confidence: "medium", decisions: ["reduce"])
        )
        let nonFinitePenalty = levelEvent(
            muscle: "triceps",
            facts: eventFacts(confidence: "high", recoveryPenalty: .infinity)
        )

        for event in [
            legacy,
            recovering,
            recoveryPenalty,
            unknownLimitation,
            reducing,
            nonFinitePenalty,
        ] {
            XCTAssertFalse(LevelBreakthroughShareEligibility.isEligible(event))
        }
        XCTAssertTrue(MuscleEventShareBuilder.snapshots(
            pending: [
                legacy,
                recovering,
                recoveryPenalty,
                unknownLimitation,
                reducing,
                nonFinitePenalty,
            ],
            generatedDateISO: "2026-07-29",
            recentTrainingDays: 4
        ).isEmpty)
    }

    func testTierUpgradeUsesLockedEventTimeMedianConfidence() {
        let lowTier = LevelBreakthrough(
            kind: .trainingTier,
            targetId: "overall",
            fromLevel: nil,
            toLevel: nil,
            fromTier: .beginner,
            toTier: .novicePlus,
            evidence: [],
            achievedAtIso: "2026-07-29",
            eventFacts: eventFacts(confidence: "low")
        )
        XCTAssertTrue(MuscleEventShareBuilder.snapshots(
            pending: [lowTier],
            generatedDateISO: "2026-07-29",
            recentTrainingDays: 4
        ).isEmpty)

        let mediumTier = LevelBreakthrough(
            kind: .trainingTier,
            targetId: "overall",
            fromLevel: nil,
            toLevel: nil,
            fromTier: .beginner,
            toTier: .novicePlus,
            evidence: [],
            achievedAtIso: "2026-07-29",
            eventFacts: eventFacts(confidence: "medium")
        )
        let snapshots = MuscleEventShareBuilder.snapshots(
            pending: [mediumTier],
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
