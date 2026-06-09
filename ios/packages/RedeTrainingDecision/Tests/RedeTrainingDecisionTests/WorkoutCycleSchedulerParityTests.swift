// SC-1 — workoutCycleScheduler parity tests.
//
// FUNCTION-LEVEL compute-assert: for the `workout-cycle/cycle-cases-v1` golden, decode each
// case's echoed engineInput (orderedTemplateIds + currentDate + history), run the PORTED
// `WorkoutCycleScheduler.buildWorkoutCycleState` on the SAME inputs, and assert the produced
// `WorkoutCycleState` equals the golden case's `result` field-by-field (orderedTemplateIds /
// completedInCurrentCycle / missingInCurrentCycle / lastCompletedTemplateId / isCycleComplete /
// nextTemplateId / reason). Every field is [String] / String? / Bool / String, so equality is
// plain struct `==`. The golden's drop-undefined `lastCompletedTemplateId` / `nextTemplateId`
// decode to nil, which the port also returns for the empty-ordered branch.
//
// The golden is GENERATED from the retired legacy workoutCycleScheduler
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — zero
// `: Date` (currentDate is an explicit input, the only "clock"), no IO beyond reading the
// committed golden.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class WorkoutCycleSchedulerParityTests: XCTestCase {

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // RedeTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // RedeTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static var goldenURL: URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/workout-cycle/cycle-cases-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        return try JSONValue(decoding: data).requireObject("workout-cycle/cycle-cases-v1")
    }

    private func history(_ c: OrderedJSONObject) throws -> [TrainingSession] {
        try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func decodeResult(_ o: OrderedJSONObject) -> WorkoutCycleScheduler.WorkoutCycleState {
        WorkoutCycleScheduler.WorkoutCycleState(
            orderedTemplateIds: o.optionalStringArray("orderedTemplateIds") ?? [],
            completedInCurrentCycle: o.optionalStringArray("completedInCurrentCycle") ?? [],
            missingInCurrentCycle: o.optionalStringArray("missingInCurrentCycle") ?? [],
            lastCompletedTemplateId: o.optionalString("lastCompletedTemplateId"),
            isCycleComplete: o.optionalBool("isCycleComplete") ?? false,
            nextTemplateId: o.optionalString("nextTemplateId"),
            reason: o.optionalString("reason") ?? ""
        )
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing workout-cycle golden")
        let root = try root()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "workout-cycle/cycle-cases-v1")
        XCTAssertGreaterThanOrEqual((root.optionalArray("cases") ?? []).count, 11, "expected the 11 cycle cases")
    }

    func testBuildWorkoutCycleStateParityForEveryCase() throws {
        let root = try root()
        let cases = root.optionalArray("cases") ?? []
        XCTAssertFalse(cases.isEmpty, "no cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("workout-cycle case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let orderedTemplateIds = c.optionalStringArray("orderedTemplateIds") ?? []
            let currentDate = c.optionalString("currentDate")
            let history = try history(c)

            let actual = WorkoutCycleScheduler.buildWorkoutCycleState(
                history: history,
                orderedTemplateIds: orderedTemplateIds,
                currentDate: currentDate
            )
            let golden = decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "workout-cycle/\(label): buildWorkoutCycleState mismatch")
        }
    }
}
