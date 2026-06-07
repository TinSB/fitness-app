// AN-2 — plateauDetectionEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `plateau-detection/*` golden, decode every
// case's echoed engineInput (history + the optional external summaries — e1rmProfile /
// loadFeedback / effectiveSetSummary / techniqueQualitySummary / painPatterns), run the
// PORTED `PlateauDetectionEngine.detectExercisePlateau` on the SAME inputs, and assert the
// produced `PlateauDetectionResult` equals the golden case's `result` — field-by-field
// (status / title / summary / confidence) AND the ordered `signals` list (id / label /
// reason / severity, in the engine's emit order after the id-dedup) AND `suggestedActions`.
//
// The golden is GENERATED from the retired legacy plateauDetectionEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — zero
// `: Date` (the engine never reads the wall clock; every date comparison is over the
// session's OWN date strings), no IO beyond reading the committed golden. The two fixtures
// jointly cover all eight PlateauStatus values + the branch/boundary debt (count<4 sets &
// perf boundaries, the e1rm recentValues / current-best / e1rmKg union shapes, the
// loadFeedback array / summary-object / record-of-values union shapes, painPatterns-param
// fatigue, and the techniqueQualitySummary-param override).

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class PlateauDetectionEngineParityTests: XCTestCase {

    private typealias Engine = PlateauDetectionEngine

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
        repoRoot.appendingPathComponent("ios/ParityFixtures/parity/golden/\(id).json", isDirectory: false)
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

    private func painPatterns(_ c: OrderedJSONObject) throws -> [Engine.PainPattern]? {
        guard let arr = c.optionalArray("painPatterns") else { return nil }
        return try arr.map { value -> Engine.PainPattern in
            let o = try value.requireObject("painPattern")
            return Engine.PainPattern(
                exerciseId: o.optionalString("exerciseId"),
                severityAvg: o.optionalDouble("severityAvg")
            )
        }
    }

    private func params(_ c: OrderedJSONObject) throws -> Engine.DetectExercisePlateauParams {
        Engine.DetectExercisePlateauParams(
            exerciseId: c.optionalString("exerciseId") ?? "",
            history: try history(c),
            e1rmProfile: c.rawValue("e1rmProfile"),
            loadFeedback: c.rawValue("loadFeedback"),
            effectiveSetSummary: effectiveSetSummary(c),
            techniqueQualitySummary: techniqueQualitySummary(c),
            painPatterns: try painPatterns(c)
        )
    }

    // MARK: - Golden result decoders

    private func decodeSignal(_ o: OrderedJSONObject) -> Engine.PlateauSignal {
        Engine.PlateauSignal(
            id: o.optionalString("id") ?? "",
            label: o.optionalString("label") ?? "",
            reason: o.optionalString("reason") ?? "",
            severity: o.optionalString("severity") ?? ""
        )
    }

    private func decodeResult(_ o: OrderedJSONObject) throws -> Engine.PlateauDetectionResult {
        let statusString = o.optionalString("status") ?? ""
        let status = try XCTUnwrap(Engine.PlateauStatus(rawValue: statusString), "unknown status \(statusString)")
        let signals = try (o.optionalArray("signals") ?? []).map { decodeSignal(try $0.requireObject("signal")) }
        return Engine.PlateauDetectionResult(
            exerciseId: o.optionalString("exerciseId") ?? "",
            status: status,
            title: o.optionalString("title") ?? "",
            summary: o.optionalString("summary") ?? "",
            signals: signals,
            suggestedActions: o.optionalStringArray("suggestedActions") ?? [],
            confidence: o.optionalString("confidence") ?? ""
        )
    }

    // MARK: - Per-fixture compute-assert

    private func assertParity(_ id: String, minCases: Int) throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL(id).path), "missing golden \(id)")
        let root = try root(id)
        XCTAssertEqual(root.optionalString("sourceFixtureId"), id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, minCases, "\(id): expected at least \(minCases) cases")
        XCTAssertFalse(cases.isEmpty, "\(id): no cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("plateau case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let actual = Engine.detectExercisePlateau(try params(c))
            let golden = try decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "plateau/\(label): detectExercisePlateau mismatch")
        }
    }

    func testStatusCasesParityForEveryStatus() throws {
        // 8 cases, one per PlateauStatus, exercising the arbitration precedence.
        try assertParity("plateau-detection/plateau-status-cases-v1", minCases: 8)
    }

    func testBoundaryCasesParityForEveryBranch() throws {
        // 8 cases pinning the count/union/param branch debt.
        try assertParity("plateau-detection/plateau-boundary-cases-v1", minCases: 8)
    }
}
