// AN-5 — painPatternEngine (trainingLevel-consumed subset) parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `pain-pattern/*` golden case, decode the echoed
// engineInput (history + optional currentDate/lookbackDays/maxSessions), run the PORTED
// PainPatternEngine.buildPainPatterns on the SAME inputs, and assert the full ordered
// `[PainPattern]` == golden `patterns` (area / exerciseId / frequency / severityAvg /
// lastOccurredAt / suggestedAction — full struct `==`, so the severityAvg-desc/frequency-desc
// sort order is pinned too).
//
// The goldens are GENERATED from the retired legacy engine (frozen legacy fixture generator),
// never hand-edited (§22). PURE / read-only — zero `: Date`, no IO beyond reading the
// committed golden.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class PainPatternEngineParityTests: XCTestCase {

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private func goldenRoot(_ id: String) throws -> OrderedJSONObject {
        let url = Self.repoRoot.appendingPathComponent("ios/ParityFixtures/parity/golden/\(id).json", isDirectory: false)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
        return try JSONValue(decoding: try Data(contentsOf: url)).requireObject(id)
    }

    // MARK: - decode helpers

    private func decodePattern(_ o: OrderedJSONObject) -> PainPatternEngine.PainPattern {
        PainPatternEngine.PainPattern(
            area: o.optionalString("area") ?? "",
            exerciseId: o.optionalString("exerciseId"),
            frequency: o.optionalInt("frequency") ?? Int.min,
            severityAvg: o.optionalDouble("severityAvg") ?? .nan,
            lastOccurredAt: o.optionalString("lastOccurredAt") ?? "",
            suggestedAction: PainPatternEngine.PainSuggestedAction(rawValue: o.optionalString("suggestedAction") ?? "") ?? .watch
        )
    }

    // MARK: - driver

    func testBuildPainPatternsParity() throws {
        let id = "pain-pattern/aggregation-cases-v1"
        let root = try goldenRoot(id)
        XCTAssertEqual(root.optionalString("sourceFixtureId"), id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 10, "\(id): expected the declared cases")

        for caseValue in cases {
            let c = try caseValue.requireObject("pain-pattern case")
            let label = c.optionalString("label") ?? "(unlabeled)"

            let history = try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }

            var options = PainPatternEngine.BuildPainPatternsOptions()
            if let o = c.optionalObject("options") {
                options = PainPatternEngine.BuildPainPatternsOptions(
                    currentDate: o.optionalString("currentDate"),
                    lookbackDays: o.optionalInt("lookbackDays"),
                    maxSessions: o.optionalInt("maxSessions")
                )
            }

            let actual = PainPatternEngine.buildPainPatterns(history, options)
            let expected = (c.optionalArray("patterns") ?? []).compactMap { $0.objectValue.map(decodePattern) }
            XCTAssertEqual(actual, expected, "\(id)/\(label): buildPainPatterns mismatch")
        }
    }
}
