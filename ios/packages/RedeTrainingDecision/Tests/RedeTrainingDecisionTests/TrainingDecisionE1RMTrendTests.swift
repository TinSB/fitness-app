// iOS-4B3 — isE1rmTrendUp unit tests (drives the internal port directly).

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TrainingDecisionE1RMTrendTests: XCTestCase {

    private func sessions(_ weights: [(gap: Int, w: Double)]) -> [TrainingSession] {
        weights.enumerated().map { CoreSliceTestKit.weightedSession(id: "e\($0.offset)", gap: $0.element.gap, topWeight: $0.element.w) }
    }

    func test_fewerThanFour_sessions_is_false() {
        XCTAssertFalse(TrainingDecisionE1RMTrend.isE1rmTrendUp(history: sessions([(9, 60), (6, 62), (3, 64)])))
        XCTAssertFalse(TrainingDecisionE1RMTrend.isE1rmTrendUp(history: []))
    }

    func test_strictly_increasing_is_true() {
        // The controlled-reload-v1 shape: 60 -> 62.5 -> 65 -> 67.5 -> 70.
        let h = sessions([(14, 60), (11, 62.5), (8, 65), (5, 67.5), (2, 70)])
        XCTAssertTrue(TrainingDecisionE1RMTrend.isE1rmTrendUp(history: h))
    }

    func test_flat_weights_is_false() {
        let h = sessions([(14, 60), (11, 60), (8, 60), (5, 60), (2, 60)])
        XCTAssertFalse(TrainingDecisionE1RMTrend.isE1rmTrendUp(history: h))
    }

    func test_decreasing_weights_is_false() {
        let h = sessions([(14, 70), (11, 67.5), (8, 65), (5, 62.5), (2, 60)])
        XCTAssertFalse(TrainingDecisionE1RMTrend.isE1rmTrendUp(history: h))
    }

    func test_incomplete_sessions_are_skipped() {
        // 4 completed increasing tops + a trailing incomplete heavy session that must
        // be ignored (so the trend is still evaluated on the 4 completed ones).
        var h = sessions([(14, 60), (11, 62.5), (8, 65), (5, 67.5)])
        h.append(TrainingSession(
            id: "incomplete", date: CoreSliceTestKit.dateOnly(daysBefore: 1), completed: false,
            exercises: [ExercisePrescription(id: "x", name: "Bench", sets: [TrainingSetLog(weight: .double(200))])]
        ))
        XCTAssertTrue(TrainingDecisionE1RMTrend.isE1rmTrendUp(history: h)) // 200 ignored; 60..67.5 still up
    }
}
