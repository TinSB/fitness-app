import Foundation
import XCTest
@testable import RedeLocalSnapshot

final class BalanceImprovementPolicyTests: XCTestCase {
    private let referenceLevels = [
        "chest": 2,
        "back": 6,
        "quads": 10,
    ]

    private func contributor(
        _ id: String,
        level: Int,
        trend: MuscleLevelTrend = .stable,
        confidence: EstimateConfidence = .medium
    ) -> BalanceImprovementContributor {
        BalanceImprovementContributor(
            id: id,
            level: level,
            trend: trend,
            confidence: confidence
        )
    }

    private func observation(
        score: Double,
        sessionCount: Int,
        contributors: [BalanceImprovementContributor]
    ) -> BalanceImprovementObservation {
        BalanceImprovementObservation(
            score: score,
            completedSessionCount: sessionCount,
            contributors: contributors
        )
    }

    private func reference(
        score: Double = 50,
        levels: [String: Int]? = nil,
        medianConfidence: EstimateConfidence = .medium
    ) -> BalanceImprovementReference {
        BalanceImprovementReference(
            score: score,
            levelsByContributorID: levels ?? referenceLevels,
            medianConfidence: medianConfidence
        )
    }

    private func eligibleContributors(
        lowLevel: Int = 3,
        lowTrend: MuscleLevelTrend = .rising,
        lowConfidence: EstimateConfidence = .medium
    ) -> [BalanceImprovementContributor] {
        [
            contributor("chest", level: lowLevel, trend: lowTrend, confidence: lowConfidence),
            contributor("back", level: 6),
            contributor("quads", level: 10),
        ]
    }

    func testMissingReferenceSeedsQualifiedObservationWithoutCreatingCandidate() {
        let result = BalanceImprovementPolicy.evaluate(
            previousState: BalanceImprovementState(),
            observation: observation(
                score: 47.25,
                sessionCount: 8,
                contributors: [
                    contributor("chest", level: 2, confidence: .medium),
                    contributor("back", level: 6, confidence: .high),
                    contributor("quads", level: 10, confidence: .medium),
                ]
            )
        )

        XCTAssertNil(result.confirmedEvent)
        XCTAssertNil(result.state.candidate)
        XCTAssertEqual(result.state.reference?.score, 47.25)
        XCTAssertEqual(
            result.state.reference?.levelsByContributorID,
            ["chest": 2, "back": 6, "quads": 10]
        )
        XCTAssertEqual(result.state.reference?.medianConfidence, .medium)
    }

    func testMissingReferenceDoesNotSeedWhenInitialMedianConfidenceIsLow() {
        let result = BalanceImprovementPolicy.evaluate(
            previousState: BalanceImprovementState(),
            observation: observation(
                score: 50,
                sessionCount: 1,
                contributors: [
                    contributor("chest", level: 2, confidence: .low),
                    contributor("back", level: 6, confidence: .low),
                    contributor("quads", level: 10, confidence: .high),
                ]
            )
        )

        XCTAssertEqual(result.state, BalanceImprovementState())
        XCTAssertNil(result.confirmedEvent)
    }

    func testConfidenceMedianUsesConservativeLowerMiddleForEvenAndMiddleForOdd() {
        let evenLow = BalanceImprovementPolicy.evaluate(
            previousState: BalanceImprovementState(),
            observation: observation(
                score: 40,
                sessionCount: 1,
                contributors: [
                    contributor("a", level: 2, confidence: .low),
                    contributor("b", level: 4, confidence: .high),
                ]
            )
        )
        XCTAssertNil(evenLow.state.reference)

        let evenMedium = BalanceImprovementPolicy.evaluate(
            previousState: BalanceImprovementState(),
            observation: observation(
                score: 40,
                sessionCount: 1,
                contributors: [
                    contributor("a", level: 2, confidence: .medium),
                    contributor("b", level: 4, confidence: .high),
                ]
            )
        )
        XCTAssertEqual(evenMedium.state.reference?.medianConfidence, .medium)

        let oddMedium = BalanceImprovementPolicy.evaluate(
            previousState: BalanceImprovementState(),
            observation: observation(
                score: 40,
                sessionCount: 1,
                contributors: [
                    contributor("a", level: 2, confidence: .low),
                    contributor("b", level: 4, confidence: .medium),
                    contributor("c", level: 6, confidence: .high),
                ]
            )
        )
        XCTAssertEqual(oddMedium.state.reference?.medianConfidence, .medium)
    }

    func testRawDeltaNinePointNineNineNineRejectsButTenCreatesCandidate() {
        let initial = BalanceImprovementState(reference: reference(), candidate: nil)

        let below = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 59.999,
                sessionCount: 10,
                contributors: eligibleContributors()
            )
        )
        XCTAssertNil(below.state.candidate)
        XCTAssertEqual(below.state.reference, initial.reference)
        XCTAssertNil(below.confirmedEvent)

        let boundary = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 60.0,
                sessionCount: 10,
                contributors: eligibleContributors()
            )
        )
        XCTAssertEqual(boundary.state.candidate?.score, 60.0)
        XCTAssertEqual(boundary.state.candidate?.completedSessionCount, 10)
        XCTAssertEqual(boundary.state.reference, initial.reference)
        XCTAssertNil(boundary.confirmedEvent)
    }

    func testOneTenPointObservationOnlyCreatesCandidateAndSameSessionCannotConfirm() {
        let initial = BalanceImprovementState(reference: reference(), candidate: nil)
        let current = observation(
            score: 60,
            sessionCount: 10,
            contributors: eligibleContributors()
        )

        let first = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: current
        )
        let repeated = BalanceImprovementPolicy.evaluate(
            previousState: first.state,
            observation: current
        )

        XCTAssertNil(first.confirmedEvent)
        XCTAssertNil(repeated.confirmedEvent)
        XCTAssertEqual(repeated.state, first.state)
    }

    func testStrictlyNewerSessionConfirmsAndReturnsRawScoresAndTopTwoDirections() {
        let levels = [
            "chest": 1,
            "back": 2,
            "quads": 3,
            "hamstrings": 8,
            "glutes": 9,
            "shoulders": 10,
        ]
        let initial = BalanceImprovementState(
            reference: reference(score: 50, levels: levels),
            candidate: nil
        )
        let contributors = [
            contributor("chest", level: 4, trend: .rising),
            contributor("back", level: 4, trend: .rising),
            contributor("quads", level: 4, trend: .rising),
            contributor("hamstrings", level: 8),
            contributor("glutes", level: 9),
            contributor("shoulders", level: 10),
        ]

        let candidate = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 60.125,
                sessionCount: 20,
                contributors: contributors
            )
        )
        let confirmed = BalanceImprovementPolicy.evaluate(
            previousState: candidate.state,
            observation: observation(
                score: 61.875,
                sessionCount: 21,
                contributors: contributors
            )
        )

        XCTAssertEqual(confirmed.confirmedEvent?.fromScore, 50)
        XCTAssertEqual(confirmed.confirmedEvent?.toScore, 61.875)
        XCTAssertEqual(confirmed.confirmedEvent?.directionIDs, ["chest", "back"])
        XCTAssertNil(confirmed.state.candidate)
        XCTAssertEqual(confirmed.state.reference?.score, 61.875)
        XCTAssertEqual(
            confirmed.state.reference?.levelsByContributorID,
            Dictionary(uniqueKeysWithValues: contributors.map { ($0.id, $0.level) })
        )
    }

    func testNextIndependentObservationFailureClearsCandidateWithoutMovingRisingReference() {
        let initial = BalanceImprovementState(
            reference: reference(),
            candidate: BalanceImprovementCandidate(score: 60, completedSessionCount: 10)
        )

        let result = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 59.999,
                sessionCount: 11,
                contributors: eligibleContributors()
            )
        )

        XCTAssertNil(result.confirmedEvent)
        XCTAssertNil(result.state.candidate)
        XCTAssertEqual(result.state.reference, initial.reference)
    }

    func testStaleSessionCountPreservesCandidateStateAndCannotConfirm() {
        let initial = BalanceImprovementState(
            reference: reference(),
            candidate: BalanceImprovementCandidate(score: 60, completedSessionCount: 10)
        )

        let result = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 62,
                sessionCount: 9,
                contributors: eligibleContributors()
            )
        )

        XCTAssertEqual(result.state, initial)
        XCTAssertNil(result.confirmedEvent)
    }

    func testContributorSetChangeResetsReferenceAndCandidate() {
        let initial = BalanceImprovementState(
            reference: reference(),
            candidate: BalanceImprovementCandidate(score: 60, completedSessionCount: 10)
        )
        let changed = [
            contributor("chest", level: 3, trend: .rising),
            contributor("back", level: 6),
            contributor("glutes", level: 8),
        ]

        let result = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 65,
                sessionCount: 11,
                contributors: changed
            )
        )

        XCTAssertNil(result.confirmedEvent)
        XCTAssertNil(result.state.candidate)
        XCTAssertEqual(result.state.reference?.score, 65)
        XCTAssertEqual(
            result.state.reference?.levelsByContributorID,
            ["chest": 3, "back": 6, "glutes": 8]
        )
    }

    func testLowReferenceConfidenceCannotQualifyAndCurrentObservationBecomesFreshReference() {
        let initial = BalanceImprovementState(
            reference: reference(medianConfidence: .low),
            candidate: nil
        )

        let result = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 61,
                sessionCount: 11,
                contributors: eligibleContributors()
            )
        )

        XCTAssertNil(result.confirmedEvent)
        XCTAssertNil(result.state.candidate)
        XCTAssertEqual(result.state.reference?.score, 61)
        XCTAssertEqual(result.state.reference?.medianConfidence, .medium)
    }

    func testLowConfidenceCurrentObservationClearsCandidateButKeepsQualifiedReference() {
        let initial = BalanceImprovementState(
            reference: reference(),
            candidate: BalanceImprovementCandidate(score: 60, completedSessionCount: 10)
        )

        let result = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 62,
                sessionCount: 11,
                contributors: [
                    contributor("chest", level: 3, trend: .rising, confidence: .low),
                    contributor("back", level: 6, confidence: .low),
                    contributor("quads", level: 10, confidence: .medium),
                ]
            )
        )

        XCTAssertNil(result.confirmedEvent)
        XCTAssertNil(result.state.candidate)
        XCTAssertEqual(result.state.reference, initial.reference)
    }

    func testQualifiedTroughMovesReferenceAndClearsCandidate() {
        let initial = BalanceImprovementState(
            reference: reference(),
            candidate: BalanceImprovementCandidate(score: 60, completedSessionCount: 10)
        )
        let current = [
            contributor("chest", level: 2),
            contributor("back", level: 5, trend: .declining),
            contributor("quads", level: 9, trend: .declining),
        ]

        let result = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 45.5,
                sessionCount: 11,
                contributors: current
            )
        )

        XCTAssertNil(result.confirmedEvent)
        XCTAssertNil(result.state.candidate)
        XCTAssertEqual(result.state.reference?.score, 45.5)
        XCTAssertEqual(
            result.state.reference?.levelsByContributorID,
            ["chest": 2, "back": 5, "quads": 9]
        )
    }

    func testStrongSideDeclineWithoutLowSideRiseCannotCreateCandidate() {
        let result = BalanceImprovementPolicy.evaluate(
            previousState: BalanceImprovementState(reference: reference(), candidate: nil),
            observation: observation(
                score: 62,
                sessionCount: 10,
                contributors: [
                    contributor("chest", level: 2),
                    contributor("back", level: 6),
                    contributor("quads", level: 8, trend: .declining),
                ]
            )
        )

        XCTAssertNil(result.confirmedEvent)
        XCTAssertNil(result.state.candidate)
        XCTAssertEqual(result.state.reference?.score, 50)
    }

    func testLowSideMustBeStrictlyBelowReferenceMedianAndCurrentlyRising() {
        let initial = BalanceImprovementState(reference: reference(), candidate: nil)

        let stableLowSide = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 62,
                sessionCount: 10,
                contributors: eligibleContributors(lowTrend: .stable)
            )
        )
        XCTAssertNil(stableLowSide.state.candidate)

        let exactlyMedian = BalanceImprovementPolicy.evaluate(
            previousState: initial,
            observation: observation(
                score: 62,
                sessionCount: 10,
                contributors: [
                    contributor("chest", level: 2),
                    contributor("back", level: 7, trend: .rising),
                    contributor("quads", level: 10),
                ]
            )
        )
        XCTAssertNil(exactlyMedian.state.candidate)
    }

    func testRisingLowSideMustHaveAtLeastMediumConfidenceEvenWhenOverallMedianQualifies() {
        let result = BalanceImprovementPolicy.evaluate(
            previousState: BalanceImprovementState(reference: reference(), candidate: nil),
            observation: observation(
                score: 62,
                sessionCount: 10,
                contributors: eligibleContributors(lowConfidence: .low)
            )
        )

        XCTAssertNil(result.confirmedEvent)
        XCTAssertNil(result.state.candidate)
        XCTAssertEqual(result.state.reference?.score, 50)
    }

    func testFourPointStepsAccumulateAgainstStableReferenceUntilCandidateThenConfirmation() {
        var state = BalanceImprovementState(reference: reference(), candidate: nil)

        for (score, sessionCount) in [(54.0, 1), (58.0, 2)] {
            let result = BalanceImprovementPolicy.evaluate(
                previousState: state,
                observation: observation(
                    score: score,
                    sessionCount: sessionCount,
                    contributors: eligibleContributors()
                )
            )
            XCTAssertNil(result.state.candidate)
            XCTAssertNil(result.confirmedEvent)
            XCTAssertEqual(result.state.reference?.score, 50)
            state = result.state
        }

        let candidate = BalanceImprovementPolicy.evaluate(
            previousState: state,
            observation: observation(
                score: 62,
                sessionCount: 3,
                contributors: eligibleContributors()
            )
        )
        XCTAssertEqual(candidate.state.candidate?.score, 62)
        XCTAssertEqual(candidate.state.candidate?.completedSessionCount, 3)
        XCTAssertNil(candidate.confirmedEvent)
        XCTAssertEqual(candidate.state.reference?.score, 50)

        let confirmed = BalanceImprovementPolicy.evaluate(
            previousState: candidate.state,
            observation: observation(
                score: 62,
                sessionCount: 4,
                contributors: eligibleContributors()
            )
        )
        XCTAssertEqual(confirmed.confirmedEvent?.fromScore, 50)
        XCTAssertEqual(confirmed.confirmedEvent?.toScore, 62)
        XCTAssertNil(confirmed.state.candidate)
        XCTAssertEqual(confirmed.state.reference?.score, 62)
    }

    func testPersistedStateRoundTripsReferenceConfidenceLevelsAndCandidateFacts() throws {
        let state = BalanceImprovementState(
            reference: reference(score: 42.75, medianConfidence: .high),
            candidate: BalanceImprovementCandidate(score: 53, completedSessionCount: 12)
        )

        let data = try JSONEncoder().encode(state)
        let decoded = try JSONDecoder().decode(BalanceImprovementState.self, from: data)

        XCTAssertEqual(decoded, state)
        XCTAssertEqual(decoded.reference?.medianConfidence, .high)
        XCTAssertEqual(decoded.reference?.levelsByContributorID, referenceLevels)
        XCTAssertEqual(decoded.candidate?.score, 53)
        XCTAssertEqual(decoded.candidate?.completedSessionCount, 12)
    }
}
