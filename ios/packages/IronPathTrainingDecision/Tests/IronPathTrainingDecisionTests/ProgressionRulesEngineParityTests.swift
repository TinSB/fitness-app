// iOS-17e-3 — progressionRulesEngine progressive-suggestion parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `progression-suggestion/*` golden, decode the
// echoed engineInput (templateExercise + history) and probe inputs, run the PORTED
// `ProgressionRulesEngine` functions on the SAME inputs, and assert the produced outputs
// equal the golden values item-by-item:
//   - makeSuggestion(exercise, history)        == golden.suggestion        (weight/reps/
//                                                  lastSummary/targetSummary/note)
//   - shouldUseTopBackoff(exercise)            == golden.shouldUseTopBackoff (+ probes)
//   - buildSetPrescription(exercise, sugg)     == golden.setPrescription    (top/backoff
//                                                  weight+reps+summary; + probes)
//   - golden.fineTuneNeutrality.fallbackReason == "insufficient_history"    (asserts the
//                                                  DEFERRED fineTune is golden-neutral)
// The goldens are GENERATED from the REAL TS progressionRulesEngine
// (scripts/generate-parity-goldens.mjs), never hand-edited (§22). This is the 17e-3 slice
// of the progression-cluster parity; it does NOT touch the decision output / existing
// decision goldens (that wiring is 17e-5). Zero `: Date`, no IO beyond reading the
// committed golden files.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class ProgressionRulesEngineParityTests: XCTestCase {

    enum Goldens {
        /// The 6 progression-suggestion OUTPUT fixture short ids (without the prefix).
        static let outputIds: [String] = [
            "no-history-baseline-v1",
            "increase-double-top-v1",
            "hold-stable-v1",
            "backoff-volume-drop-v1",
            "backoff-technique-streak-v1",
            "top-backoff-compound-v1",
        ]

        /// Repo root, resolved from this test file's compile-time path (6 levels up).
        static var repoRoot: URL {
            URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
                .deletingLastPathComponent()  // Tests/
                .deletingLastPathComponent()  // IronPathTrainingDecision/
                .deletingLastPathComponent()  // packages/
                .deletingLastPathComponent()  // ios/
                .deletingLastPathComponent()  // repo root
        }

        static func goldenURL(_ shortId: String) -> URL {
            repoRoot.appendingPathComponent(
                "tests/fixtures/parity/golden/progression-suggestion/\(shortId).json", isDirectory: false
            )
        }

        static func root(_ shortId: String) throws -> OrderedJSONObject {
            let data = try Data(contentsOf: goldenURL(shortId))
            return try JSONValue(decoding: data).requireObject("progression-suggestion/\(shortId)")
        }
    }

    // MARK: - Golden decode helpers (decode the generated golden into the SAME
    // ProgressionRulesEngine value types so each parity check is a struct equality).

    private func decodeExercise(_ o: OrderedJSONObject) -> ProgressionRulesEngine.ExerciseForProgression {
        ProgressionRulesEngine.ExerciseForProgression(
            id: o.optionalString("id") ?? "",
            baseId: o.optionalString("baseId"),
            name: o.optionalString("name"),
            kind: o.optionalString("kind") ?? "",
            sets: o.optionalDouble("sets"),
            repMin: o.optionalDouble("repMin"),
            repMax: o.optionalDouble("repMax"),
            startWeight: o.optionalDouble("startWeight"),
            rest: o.optionalDouble("rest"),
            targetRir: (o.optionalArray("targetRir"))?.compactMap { $0.doubleValue },
            targetRirText: o.optionalString("targetRirText"),
            progressionUnitKg: o.optionalDouble("progressionUnitKg"),
            progressionPercent: (o.optionalArray("progressionPercent"))?.compactMap { $0.doubleValue },
            conservativeTopSet: o.optionalBool("conservativeTopSet"),
            progressLocked: o.optionalBool("progressLocked"),
            replacementSuggested: o.optionalString("replacementSuggested"),
            fatigueCost: o.optionalString("fatigueCost"),
            adaptiveTopSetFactor: o.optionalDouble("adaptiveTopSetFactor"),
            adaptiveBackoffFactor: o.optionalDouble("adaptiveBackoffFactor"),
            regressionIds: o.optionalStringArray("regressionIds")
        )
    }

    private func decodeSuggestion(_ o: OrderedJSONObject) -> ProgressionRulesEngine.Suggestion {
        ProgressionRulesEngine.Suggestion(
            weight: o.optionalDouble("weight") ?? 0,
            reps: o.optionalDouble("reps") ?? 0,
            lastSummary: o.optionalString("lastSummary") ?? "",
            targetSummary: o.optionalString("targetSummary") ?? "",
            note: o.optionalString("note") ?? ""
        )
    }

    private func decodeSetPrescription(_ o: OrderedJSONObject) -> ProgressionRulesEngine.SetPrescription {
        ProgressionRulesEngine.SetPrescription(
            topWeight: o.optionalDouble("topWeight") ?? 0,
            topReps: o.optionalDouble("topReps") ?? 0,
            backoffWeight: o.optionalDouble("backoffWeight") ?? 0,
            backoffReps: o.optionalDouble("backoffReps") ?? 0,
            summary: o.optionalString("summary") ?? ""
        )
    }

    private func decodeSuggestionInput(_ o: OrderedJSONObject) -> ProgressionRulesEngine.SuggestionInput {
        ProgressionRulesEngine.SuggestionInput(
            weight: o.optionalDouble("weight") ?? 0,
            reps: o.optionalDouble("reps") ?? 0
        )
    }

    private func history(_ root: OrderedJSONObject, _ id: String) throws -> [TrainingSession] {
        let engineInput = try XCTUnwrap(root.optionalObject("engineInput"), "\(id): engineInput")
        return try (engineInput.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func exercise(_ root: OrderedJSONObject, _ id: String) throws -> ProgressionRulesEngine.ExerciseForProgression {
        let engineInput = try XCTUnwrap(root.optionalObject("engineInput"), "\(id): engineInput")
        let exerciseObject = try XCTUnwrap(engineInput.optionalObject("exercise"), "\(id): engineInput.exercise")
        return decodeExercise(exerciseObject)
    }

    // MARK: - (0) all goldens present + decode envelope

    func testAllGoldensDiscovered() throws {
        XCTAssertEqual(Goldens.outputIds.count, 6)
        for id in Goldens.outputIds {
            let url = Goldens.goldenURL(id)
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
            let root = try Goldens.root(id)
            XCTAssertEqual(root.optionalString("sourceFixtureId"), "progression-suggestion/\(id)", "\(id): sourceFixtureId")
        }
    }

    // MARK: - (1) makeSuggestion parity

    func testMakeSuggestionParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let exercise = try exercise(root, id)
            let history = try history(root, id)

            let actual = ProgressionRulesEngine.makeSuggestion(exercise, history)
            let golden = decodeSuggestion(try XCTUnwrap(root.optionalObject("suggestion"), "\(id): suggestion"))
            XCTAssertEqual(actual, golden, "\(id): makeSuggestion mismatch")
        }
    }

    // MARK: - (2) shouldUseTopBackoff parity (engine input + probes)

    func testShouldUseTopBackoffParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let exercise = try exercise(root, id)

            let actual = ProgressionRulesEngine.shouldUseTopBackoff(exercise)
            let golden = try XCTUnwrap(root.rawValue("shouldUseTopBackoff")?.boolValue, "\(id): shouldUseTopBackoff")
            XCTAssertEqual(actual, golden, "\(id): shouldUseTopBackoff mismatch")

            for probe in root.optionalArray("topBackoffProbes") ?? [] {
                let o = try probe.requireObject("\(id): topBackoffProbe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let probeExercise = decodeExercise(try XCTUnwrap(o.optionalObject("exercise"), "\(id)/\(label): exercise"))
                let probeActual = ProgressionRulesEngine.shouldUseTopBackoff(probeExercise)
                let probeGolden = try XCTUnwrap(o.rawValue("shouldUseTopBackoff")?.boolValue, "\(id)/\(label): shouldUseTopBackoff")
                XCTAssertEqual(probeActual, probeGolden, "\(id)/\(label): shouldUseTopBackoff probe mismatch")
            }
        }
    }

    // MARK: - (3) buildSetPrescription parity (engine suggestion + probes)

    func testBuildSetPrescriptionParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let exercise = try exercise(root, id)

            // The primary prescription consumes the fixture's makeSuggestion {weight,reps}.
            let suggestion = decodeSuggestion(try XCTUnwrap(root.optionalObject("suggestion"), "\(id): suggestion"))
            let actual = ProgressionRulesEngine.buildSetPrescription(
                exercise,
                ProgressionRulesEngine.SuggestionInput(weight: suggestion.weight, reps: suggestion.reps)
            )
            let golden = decodeSetPrescription(try XCTUnwrap(root.optionalObject("setPrescription"), "\(id): setPrescription"))
            XCTAssertEqual(actual, golden, "\(id): buildSetPrescription mismatch")

            for probe in root.optionalArray("setPrescriptionProbes") ?? [] {
                let o = try probe.requireObject("\(id): setPrescriptionProbe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let probeExercise = decodeExercise(try XCTUnwrap(o.optionalObject("exercise"), "\(id)/\(label): exercise"))
                let probeSuggestion = decodeSuggestionInput(try XCTUnwrap(o.optionalObject("suggestion"), "\(id)/\(label): suggestion"))
                let probeActual = ProgressionRulesEngine.buildSetPrescription(probeExercise, probeSuggestion)
                let probeGolden = decodeSetPrescription(try XCTUnwrap(o.optionalObject("setPrescription"), "\(id)/\(label): setPrescription"))
                XCTAssertEqual(probeActual, probeGolden, "\(id)/\(label): buildSetPrescription probe mismatch")
            }
        }
    }

    // MARK: - (4) fineTune deferral premise — every fixture keeps the live projection inert

    func testFineTuneNeutralityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let neutrality = try XCTUnwrap(root.optionalObject("fineTuneNeutrality"), "\(id): fineTuneNeutrality")
            XCTAssertEqual(
                neutrality.optionalString("fallbackReason"), "insufficient_history",
                "\(id): fineTune must be golden-neutral (insufficient_history) for the deferral to be faithful"
            )
            XCTAssertEqual(neutrality.optionalDouble("samplesUsed"), 0, "\(id): fineTune samplesUsed must be 0")
        }
    }
}
