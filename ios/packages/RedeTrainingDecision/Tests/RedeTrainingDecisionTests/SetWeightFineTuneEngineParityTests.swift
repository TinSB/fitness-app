// iOS-17e-4 — setWeightFineTuneEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `set-weight-fine-tune/*` golden, decode the
// echoed engineInput (scalar fine-tune params + history) and the param-only probes, run
// the PORTED `SetWeightFineTuneEngine.buildSetWeightFineTune` on the SAME inputs, and
// assert the produced `SetWeightFineTuneResult` equals the golden value item-by-item
// (suggestedWeightKg + basis.samplesUsed/windowWeeks/currentE1rmKg/projectedE1rmKg/
// weeklySlopeKg/fallbackReason). Equality is EXACT Double `==`: every golden number is a
// JSON round-trip of the IEEE-754 double the legacy web schema engine produced, and the Swift port runs
// the identical elementary ops, so the bits match (e.g. currentE1rmKg 74.39999999999999).
//
// The goldens are GENERATED from the retired legacy setWeightFineTuneEngine
// (frozen legacy fixture generator), never hand-edited (§22). This is the 17e-4 slice
// of the fine-tune-cluster parity; it does NOT touch the decision output / existing
// decision goldens (that wiring is 17e-5). Zero `: Date`, no IO beyond reading the
// committed golden files.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class SetWeightFineTuneEngineParityTests: XCTestCase {

    enum Goldens {
        /// The 4 set-weight-fine-tune OUTPUT fixture short ids (without the prefix).
        static let outputIds: [String] = [
            "upward-trend-v1",
            "downward-capped-v1",
            "noisy-trend-v1",
            "insufficient-history-v1",
        ]

        /// Repo root, resolved from this test file's compile-time path (6 levels up).
        static var repoRoot: URL {
            URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()  // RedeTrainingDecisionTests/
                .deletingLastPathComponent()  // Tests/
                .deletingLastPathComponent()  // RedeTrainingDecision/
                .deletingLastPathComponent()  // packages/
                .deletingLastPathComponent()  // ios/
                .deletingLastPathComponent()  // repo root
        }

        static func goldenURL(_ shortId: String) -> URL {
            repoRoot.appendingPathComponent(
                "ios/ParityFixtures/parity/golden/set-weight-fine-tune/\(shortId).json", isDirectory: false
            )
        }

        static func root(_ shortId: String) throws -> OrderedJSONObject {
            let data = try Data(contentsOf: goldenURL(shortId))
            return try JSONValue(decoding: data).requireObject("set-weight-fine-tune/\(shortId)")
        }
    }

    // MARK: - Golden decode helpers (decode the generated golden into the SAME
    // SetWeightFineTuneEngine value types so each parity check is a struct equality).

    private func decodeResult(_ o: OrderedJSONObject) -> SetWeightFineTuneEngine.SetWeightFineTuneResult {
        let basis = o.optionalObject("basis") ?? OrderedJSONObject()
        return SetWeightFineTuneEngine.SetWeightFineTuneResult(
            suggestedWeightKg: o.optionalDouble("suggestedWeightKg") ?? 0,
            basis: SetWeightFineTuneEngine.Basis(
                samplesUsed: basis.optionalInt("samplesUsed") ?? 0,
                windowWeeks: basis.optionalDouble("windowWeeks") ?? 0,
                currentE1rmKg: basis.optionalDouble("currentE1rmKg"),
                projectedE1rmKg: basis.optionalDouble("projectedE1rmKg"),
                weeklySlopeKg: basis.optionalDouble("weeklySlopeKg") ?? 0,
                fallbackReason: basis.optionalString("fallbackReason")
            )
        )
    }

    private func decodeInput(_ o: OrderedJSONObject, history: [TrainingSession]) -> SetWeightFineTuneEngine.SetWeightFineTuneInput {
        SetWeightFineTuneEngine.SetWeightFineTuneInput(
            history: history,
            exerciseId: o.optionalString("exerciseId") ?? "",
            baseExerciseId: o.optionalString("baseExerciseId"),
            targetReps: o.optionalDouble("targetReps") ?? 0,
            repMin: o.optionalDouble("repMin") ?? 0,
            repMax: o.optionalDouble("repMax") ?? 0,
            windowWeeks: o.optionalDouble("windowWeeks"),
            asOfDate: o.optionalString("asOfDate")
        )
    }

    private func history(_ root: OrderedJSONObject, _ id: String) throws -> [TrainingSession] {
        let engineInput = try XCTUnwrap(root.optionalObject("engineInput"), "\(id): engineInput")
        return try (engineInput.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    // MARK: - (0) all goldens present + decode envelope

    func testAllGoldensDiscovered() throws {
        XCTAssertEqual(Goldens.outputIds.count, 4)
        for id in Goldens.outputIds {
            let url = Goldens.goldenURL(id)
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
            let root = try Goldens.root(id)
            XCTAssertEqual(root.optionalString("sourceFixtureId"), "set-weight-fine-tune/\(id)", "\(id): sourceFixtureId")
        }
    }

    // MARK: - (1) buildSetWeightFineTune parity (engine input + probes)

    func testFineTuneParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let history = try history(root, id)
            let engineInput = try XCTUnwrap(root.optionalObject("engineInput"), "\(id): engineInput")
            let inputObject = try XCTUnwrap(engineInput.optionalObject("input"), "\(id): engineInput.input")

            let actual = SetWeightFineTuneEngine.buildSetWeightFineTune(decodeInput(inputObject, history: history))
            let golden = decodeResult(try XCTUnwrap(root.optionalObject("result"), "\(id): result"))
            XCTAssertEqual(actual, golden, "\(id): buildSetWeightFineTune mismatch")

            for probe in root.optionalArray("probes") ?? [] {
                let o = try probe.requireObject("\(id): probe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let probeInput = decodeInput(
                    try XCTUnwrap(o.optionalObject("input"), "\(id)/\(label): input"),
                    history: history
                )
                let probeActual = SetWeightFineTuneEngine.buildSetWeightFineTune(probeInput)
                let probeGolden = decodeResult(try XCTUnwrap(o.optionalObject("result"), "\(id)/\(label): result"))
                XCTAssertEqual(probeActual, probeGolden, "\(id)/\(label): buildSetWeightFineTune probe mismatch")
            }
        }
    }
}
