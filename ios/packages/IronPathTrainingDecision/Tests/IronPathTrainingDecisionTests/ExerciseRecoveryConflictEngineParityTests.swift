// SC-1b — exerciseRecoveryConflictEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for the `exercise-recovery-conflict/conflict-cases-v1` golden,
// decode each case's echoed engineInput (exercise + sorenessAreas + painAreas), run the PORTED
// `ExerciseRecoveryConflictEngine.buildExerciseRecoveryConflict` on the SAME inputs, and assert
// the produced `Conflict` equals the golden case's `result` field-by-field (exerciseId /
// exerciseName / conflictLevel / affectedAreas / reason / recommendedAction). Every field is
// String / [String] / enum-string, so equality is plain struct `==` — the float scoring is
// internal to the engine and never surfaces in the golden.
//
// The golden is GENERATED from the REAL TS exerciseRecoveryConflictEngine
// (scripts/generate-parity-goldens.mjs), never hand-edited (§22). PURE / read-only — zero
// `: Date`, no IO beyond reading the committed golden. The real-id cases (bench-press / squat /
// leg-press) drive the EXERCISE_KNOWLEDGE_OVERRIDES merge end-to-end, reconciling the reused
// SR-3 / SR-2 / SC-0 override slices through the engine.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class ExerciseRecoveryConflictEngineParityTests: XCTestCase {

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static var goldenURL: URL {
        repoRoot.appendingPathComponent(
            "tests/fixtures/parity/golden/exercise-recovery-conflict/conflict-cases-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        return try JSONValue(decoding: data).requireObject("exercise-recovery-conflict/conflict-cases-v1")
    }

    private func decodeExercise(_ o: OrderedJSONObject) -> ExerciseRecoveryConflictEngine.ExerciseInput {
        ExerciseRecoveryConflictEngine.ExerciseInput(
            id: o.optionalString("id") ?? "",
            name: o.optionalString("name"),
            muscle: o.optionalString("muscle"),
            movementPattern: o.optionalString("movementPattern"),
            primaryMuscles: o.optionalStringArray("primaryMuscles"),
            secondaryMuscles: o.optionalStringArray("secondaryMuscles"),
            muscleContribution: decodeContribution(o.optionalObject("muscleContribution")),
            fatigueCost: o.optionalString("fatigueCost"),
            skillDemand: o.optionalString("skillDemand")
        )
    }

    /// A `Record<string, number>` decode (the muscleContribution shape).
    private func decodeContribution(_ o: OrderedJSONObject?) -> [String: Double]? {
        guard let o else { return nil }
        var dict: [String: Double] = [:]
        for entry in o.entries {
            if let d = entry.value.doubleValue { dict[entry.key] = d }
        }
        return dict
    }

    private func decodeResult(_ o: OrderedJSONObject) throws -> ExerciseRecoveryConflictEngine.Conflict {
        let levelRaw = o.optionalString("conflictLevel") ?? ""
        let actionRaw = o.optionalString("recommendedAction") ?? ""
        return ExerciseRecoveryConflictEngine.Conflict(
            exerciseId: o.optionalString("exerciseId") ?? "",
            exerciseName: o.optionalString("exerciseName") ?? "",
            conflictLevel: try XCTUnwrap(ExerciseRecoveryConflictEngine.ConflictLevel(rawValue: levelRaw), "conflictLevel \(levelRaw)"),
            affectedAreas: o.optionalStringArray("affectedAreas") ?? [],
            reason: o.optionalString("reason") ?? "",
            recommendedAction: try XCTUnwrap(ExerciseRecoveryConflictEngine.Action(rawValue: actionRaw), "recommendedAction \(actionRaw)")
        )
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing recovery-conflict golden")
        let root = try root()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "exercise-recovery-conflict/conflict-cases-v1")
        XCTAssertGreaterThanOrEqual((root.optionalArray("cases") ?? []).count, 28, "expected the 28 recovery-conflict cases")
    }

    func testBuildExerciseRecoveryConflictParityForEveryCase() throws {
        let root = try root()
        let cases = root.optionalArray("cases") ?? []
        XCTAssertFalse(cases.isEmpty, "no cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("recovery-conflict case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let exercise = decodeExercise(try XCTUnwrap(c.optionalObject("exercise"), "\(label): exercise"))
            let sorenessAreas = c.optionalStringArray("sorenessAreas") ?? []
            let painAreas = c.optionalStringArray("painAreas") ?? []

            let actual = ExerciseRecoveryConflictEngine.buildExerciseRecoveryConflict(
                exercise: exercise,
                sorenessAreas: sorenessAreas,
                painAreas: painAreas
            )
            let golden = try decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "exercise-recovery-conflict/\(label): buildExerciseRecoveryConflict mismatch")
        }
    }
}
