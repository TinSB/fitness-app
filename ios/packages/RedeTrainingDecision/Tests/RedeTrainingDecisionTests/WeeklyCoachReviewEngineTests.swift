// Weekly Coach Review（FR-SUB3）决策合同：纯派生、坏数据优先、零因果夸大、最多三条依据。

import XCTest
@testable import RedeTrainingDecision

final class WeeklyCoachReviewEngineTests: XCTestCase {
    private func makeInput(
        weekStartISO: String = "2026-07-06",
        trainingDays: Int = 3,
        sessions: Int = 3,
        cleanVolumeKg: Double = 8_400,
        recentMedianTrainingDays: Double? = 3,
        lift: WeeklyCoachLiftSignal? = WeeklyCoachLiftSignal(
            exerciseId: "barbell-bench-press",
            call: .up,
            deltaKg: 2.5
        ),
        dataFindings: Int = 0
    ) -> WeeklyCoachReviewInput {
        WeeklyCoachReviewInput(
            reviewWeekStartISO: weekStartISO,
            trainingDayCount: trainingDays,
            sessionCount: sessions,
            cleanVolumeKg: cleanVolumeKg,
            recentMedianTrainingDays: recentMedianTrainingDays,
            keyLift: lift,
            dataFindingCount: dataFindings
        )
    }

    private func unwrapReview(
        _ outcome: WeeklyCoachReviewOutcome,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws -> WeeklyCoachReview {
        guard case let .review(review) = outcome else {
            XCTFail("Expected a rendered review, got \(outcome)", file: file, line: line)
            throw TestError.unexpectedOutcome
        }
        return review
    }

    func testDataFindingWinsOverPositiveLiftAndRoutesToReviewData() throws {
        let review = try unwrapReview(
            WeeklyCoachReviewEngine.evaluate(makeInput(dataFindings: 2))
        )

        XCTAssertEqual(review.verdict, .dataNeedsReview)
        XCTAssertEqual(review.action, .reviewData)
        XCTAssertEqual(review.evidence.first, .dataFindings(count: 2))
        XCTAssertLessThanOrEqual(review.evidence.count, 3)
    }

    func testNoHistoryReturnsTypedEmptyStateInsteadOfInventingATrend() {
        let outcome = WeeklyCoachReviewEngine.evaluate(makeInput(
            trainingDays: 0,
            sessions: 0,
            cleanVolumeKg: 0,
            recentMedianTrainingDays: nil,
            lift: nil
        ))

        XCTAssertEqual(outcome, .empty(.noCompletedTraining))
    }

    func testZeroTrainingAfterPriorHistoryRebuildsRhythm() throws {
        let review = try unwrapReview(WeeklyCoachReviewEngine.evaluate(makeInput(
            trainingDays: 0,
            sessions: 0,
            cleanVolumeKg: 0,
            recentMedianTrainingDays: 3,
            lift: nil
        )))

        XCTAssertEqual(review.verdict, .rebuildRhythm)
        XCTAssertEqual(review.action, .openToday)
        XCTAssertEqual(review.evidence.first, .trainingDays(count: 0))
    }

    func testOneFullDayBelowRecentMedianRebuildsRhythmBeforeLiftTrend() throws {
        let review = try unwrapReview(WeeklyCoachReviewEngine.evaluate(makeInput(
            trainingDays: 2,
            sessions: 2,
            recentMedianTrainingDays: 3,
            lift: WeeklyCoachLiftSignal(exerciseId: "deadlift", call: .up, deltaKg: 5)
        )))

        XCTAssertEqual(review.verdict, .rebuildRhythm)
        XCTAssertEqual(review.action, .openToday)
        XCTAssertTrue(review.evidence.contains(.recentMedianTrainingDays(count: 3)))
    }

    func testReliableLiftCallsMapToVerdictsAndProgressAction() throws {
        let cases: [(WeeklyCoachLiftCall, Double?, WeeklyCoachReviewVerdict)] = [
            (.up, 2.5, .progressing),
            (.flat, 0, .holding),
            (.down, -2.5, .easing),
        ]

        for (call, deltaKg, expectedVerdict) in cases {
            let review = try unwrapReview(WeeklyCoachReviewEngine.evaluate(makeInput(
                lift: WeeklyCoachLiftSignal(
                    exerciseId: "barbell-bench-press",
                    call: call,
                    deltaKg: deltaKg
                )
            )))

            XCTAssertEqual(review.verdict, expectedVerdict, "call=\(call)")
            XCTAssertEqual(review.action, .viewProgress)
        }
    }

    func testCalibratingLiftDoesNotClaimProgress() throws {
        let review = try unwrapReview(WeeklyCoachReviewEngine.evaluate(makeInput(
            lift: WeeklyCoachLiftSignal(
                exerciseId: "barbell-bench-press",
                call: .calibrating,
                deltaKg: nil
            )
        )))

        XCTAssertEqual(review.verdict, .calibrating)
        XCTAssertEqual(review.action, .viewProgress)
    }

    func testFirstCompletedWeekCannotClaimProgressWithoutComparableHistory() throws {
        let review = try unwrapReview(WeeklyCoachReviewEngine.evaluate(makeInput(
            trainingDays: 1,
            sessions: 1,
            cleanVolumeKg: 1_200,
            recentMedianTrainingDays: nil,
            lift: WeeklyCoachLiftSignal(exerciseId: "squat", call: .up, deltaKg: 5)
        )))

        XCTAssertEqual(review.verdict, .calibrating)
        XCTAssertEqual(review.action, .viewProgress)
        XCTAssertFalse(
            review.evidence.contains(.keyLift(exerciseId: "squat", call: .up, deltaKg: 5)),
            "没有前一可比历史时不得把单周内部变化包装成周趋势"
        )
    }

    func testVolumeIncreaseAloneNeverChangesHoldingVerdict() throws {
        let lowVolume = try unwrapReview(WeeklyCoachReviewEngine.evaluate(makeInput(
            cleanVolumeKg: 1_000,
            lift: WeeklyCoachLiftSignal(exerciseId: "squat", call: .flat, deltaKg: 0)
        )))
        let highVolume = try unwrapReview(WeeklyCoachReviewEngine.evaluate(makeInput(
            cleanVolumeKg: 100_000,
            lift: WeeklyCoachLiftSignal(exerciseId: "squat", call: .flat, deltaKg: 0)
        )))

        XCTAssertEqual(lowVolume.verdict, .holding)
        XCTAssertEqual(highVolume.verdict, .holding)
    }

    func testEvidenceIsDeterministicAndCappedAtThreeItems() throws {
        let review = try unwrapReview(WeeklyCoachReviewEngine.evaluate(makeInput()))

        XCTAssertEqual(review.evidence, [
            .trainingDays(count: 3),
            .keyLift(exerciseId: "barbell-bench-press", call: .up, deltaKg: 2.5),
            .cleanVolumeKg(8_400),
        ])
    }

    func testInvalidCountsDateAndNonFiniteNumbersFailClosed() {
        let invalidInputs = [
            makeInput(weekStartISO: "not-a-date"),
            makeInput(weekStartISO: "2026-07-07"),
            makeInput(trainingDays: -1),
            makeInput(sessions: -1),
            makeInput(trainingDays: 2, sessions: 1),
            makeInput(cleanVolumeKg: -.infinity),
            makeInput(recentMedianTrainingDays: .nan),
            makeInput(dataFindings: -1),
            makeInput(lift: WeeklyCoachLiftSignal(exerciseId: "", call: .up, deltaKg: 2.5)),
            makeInput(lift: WeeklyCoachLiftSignal(exerciseId: "squat", call: .up, deltaKg: .infinity)),
        ]

        for input in invalidInputs {
            XCTAssertEqual(
                WeeklyCoachReviewEngine.evaluate(input),
                .unavailable(.invalidInput),
                "invalid input must not render a confident review: \(input)"
            )
        }
    }
}

private enum TestError: Error {
    case unexpectedOutcome
}
