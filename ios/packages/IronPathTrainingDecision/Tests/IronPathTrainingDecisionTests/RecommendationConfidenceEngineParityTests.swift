// AN-5b — recommendationConfidenceEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `recommendation-confidence/*` golden case, decode the
// echoed engineInput (history + the optional external inputs — exerciseId / e1rmProfile /
// effectiveSetSummary / loadFeedback / techniqueQualitySummary / painPatterns / trainingLevel /
// recentEdits), run the PORTED `RecommendationConfidenceEngine.buildRecommendationConfidence` on
// the SAME inputs, and assert the produced `RecommendationConfidenceResult` equals the golden
// case's `result` — full struct `==` (level / score / title / summary AND the ordered `reasons`
// list id+label+effect+reason AND `missingData`).
//
// The golden is GENERATED from the REAL TS recommendationConfidenceEngine
// (scripts/generate-parity-goldens.mjs), never hand-edited (§22). PURE / read-only — zero
// `: Date` (the engine never reads the wall clock; every date comparison is over the session's
// OWN date strings), no IO beyond reading the committed golden. The fixture covers the level
// bands (forced-low ≤1 session / high / medium-plain) + every reason / missingData branch + the
// pain 74 cap + the loadFeedback array/summary/record-of-values + recentEdits number/array union
// shapes + the no-exerciseId match-all path.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class RecommendationConfidenceEngineParityTests: XCTestCase {

    private typealias Engine = RecommendationConfidenceEngine

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static func goldenURL(_ id: String) -> URL {
        repoRoot.appendingPathComponent("tests/fixtures/parity/golden/\(id).json", isDirectory: false)
    }

    private func root(_ id: String) throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL(id))
        return try JSONValue(decoding: data).requireObject(id)
    }

    // MARK: - Input decoders (echoed engineInput → ported types)

    private func history(_ c: OrderedJSONObject) throws -> [TrainingSession] {
        try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func effectiveSetSummary(_ c: OrderedJSONObject) -> Engine.EffectiveVolumeSummary? {
        guard let o = c.optionalObject("effectiveSetSummary") else { return nil }
        return Engine.EffectiveVolumeSummary(
            completedSets: o.optionalDouble("completedSets"),
            effectiveSets: o.optionalDouble("effectiveSets"),
            highConfidenceEffectiveSets: o.optionalDouble("highConfidenceEffectiveSets")
        )
    }

    private func techniqueQualitySummary(_ c: OrderedJSONObject) -> Engine.TechniqueQualitySummary? {
        guard let o = c.optionalObject("techniqueQualitySummary") else { return nil }
        return Engine.TechniqueQualitySummary(
            totalSets: o.optionalDouble("totalSets") ?? 0,
            good: o.optionalDouble("good") ?? 0,
            acceptable: o.optionalDouble("acceptable") ?? 0,
            poor: o.optionalDouble("poor") ?? 0,
            goodOrAcceptableRate: o.optionalDouble("goodOrAcceptableRate") ?? 0,
            poorRate: o.optionalDouble("poorRate") ?? 0,
            rirRecordedRate: o.optionalDouble("rirRecordedRate") ?? 0
        )
    }

    private func painPatterns(_ c: OrderedJSONObject) throws -> [PainPatternEngine.PainPattern]? {
        guard let arr = c.optionalArray("painPatterns") else { return nil }
        return try arr.map { value -> PainPatternEngine.PainPattern in
            let o = try value.requireObject("painPattern")
            return PainPatternEngine.PainPattern(
                area: o.optionalString("area") ?? "",
                exerciseId: o.optionalString("exerciseId"),
                frequency: o.optionalInt("frequency") ?? 0,
                severityAvg: o.optionalDouble("severityAvg") ?? 0,
                lastOccurredAt: o.optionalString("lastOccurredAt") ?? "",
                suggestedAction: PainPatternEngine.PainSuggestedAction(rawValue: o.optionalString("suggestedAction") ?? "") ?? .watch
            )
        }
    }

    private func params(_ c: OrderedJSONObject) throws -> Engine.Params {
        Engine.Params(
            exerciseId: c.optionalString("exerciseId"),
            history: try history(c),
            e1rmProfile: c.rawValue("e1rmProfile"),
            effectiveSetSummary: effectiveSetSummary(c),
            loadFeedback: c.rawValue("loadFeedback"),
            techniqueQualitySummary: techniqueQualitySummary(c),
            painPatterns: try painPatterns(c),
            trainingLevel: c.optionalString("trainingLevel"),
            recentEdits: c.rawValue("recentEdits")
        )
    }

    // MARK: - Golden result decoders

    private func decodeReason(_ o: OrderedJSONObject) -> Engine.RecommendationConfidenceReason {
        Engine.RecommendationConfidenceReason(
            id: o.optionalString("id") ?? "",
            label: o.optionalString("label") ?? "",
            effect: o.optionalString("effect") ?? "",
            reason: o.optionalString("reason") ?? ""
        )
    }

    private func decodeResult(_ o: OrderedJSONObject) throws -> Engine.RecommendationConfidenceResult {
        let levelString = o.optionalString("level") ?? ""
        let level = try XCTUnwrap(Engine.RecommendationConfidenceLevel(rawValue: levelString), "unknown level \(levelString)")
        let reasons = try (o.optionalArray("reasons") ?? []).map { decodeReason(try $0.requireObject("reason")) }
        return Engine.RecommendationConfidenceResult(
            level: level,
            score: o.optionalInt("score") ?? Int.min,
            title: o.optionalString("title") ?? "",
            summary: o.optionalString("summary") ?? "",
            reasons: reasons,
            missingData: o.optionalStringArray("missingData") ?? []
        )
    }

    // MARK: - Per-fixture compute-assert

    func testAssessmentCasesParity() throws {
        let id = "recommendation-confidence/assessment-cases-v1"
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL(id).path), "missing golden \(id)")
        let root = try root(id)
        XCTAssertEqual(root.optionalString("sourceFixtureId"), id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 11, "\(id): expected the declared cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("recommendation-confidence case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let actual = Engine.buildRecommendationConfidence(try params(c))
            let golden = try decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "\(id)/\(label): buildRecommendationConfidence mismatch")
        }
    }
}
