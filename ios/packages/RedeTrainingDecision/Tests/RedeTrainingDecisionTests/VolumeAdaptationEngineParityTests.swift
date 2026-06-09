// AN-5b — volumeAdaptationEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `volume-adaptation/*` golden case, decode the echoed
// engineInput (the optional external summaries — weeklyVolumeSummary / effectiveSetSummary /
// adherenceReport / painPatterns / loadFeedback / sessionQualityResults / trainingLevel), run the
// PORTED `VolumeAdaptationEngine.buildVolumeAdaptationReport` on the SAME inputs, and assert the
// produced `VolumeAdaptationReport` equals the golden case's `report` — full struct `==` (the
// ordered `muscles` list muscleId+decision+setsDelta+title+reason+confidence+ordered
// suggestedActions AND `summary`).
//
// The golden is GENERATED from the retired legacy volumeAdaptationEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — zero
// `: Date` (the engine consumes only opaque summaries and reads no clock), no IO beyond reading
// the committed golden. The fixture covers every decision (insufficient_data / hold / decrease /
// increase / maintain) + the confidence bands + formatMuscleName (mapped / unmapped→未标注肌群 /
// row.muscleName override / byMuscle lookup / CJK passthrough) + the weeklyVolumeSummary array vs
// {muscles} shapes + the multi-muscle summaryParts join.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class VolumeAdaptationEngineParityTests: XCTestCase {

    private typealias Engine = VolumeAdaptationEngine

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // RedeTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // RedeTrainingDecision/
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

    private func decodeSignal(_ o: OrderedJSONObject) -> SessionQualityEngine.SessionQualitySignal {
        SessionQualityEngine.SessionQualitySignal(
            id: o.optionalString("id") ?? "",
            label: o.optionalString("label") ?? "",
            tone: o.optionalString("tone") ?? "",
            reason: o.optionalString("reason") ?? ""
        )
    }

    private func sessionQualityResults(_ c: OrderedJSONObject) throws -> [SessionQualityEngine.SessionQualityResult]? {
        guard let arr = c.optionalArray("sessionQualityResults") else { return nil }
        return try arr.map { value -> SessionQualityEngine.SessionQualityResult in
            let o = try value.requireObject("sessionQualityResult")
            let positives = (o.optionalArray("positives") ?? []).compactMap { $0.objectValue.map(decodeSignal) }
            let issues = (o.optionalArray("issues") ?? []).compactMap { $0.objectValue.map(decodeSignal) }
            return SessionQualityEngine.SessionQualityResult(
                level: o.optionalString("level") ?? "",
                score: o.optionalInt("score") ?? 0,
                title: o.optionalString("title") ?? "",
                summary: o.optionalString("summary") ?? "",
                positives: positives,
                issues: issues,
                nextSuggestions: o.optionalStringArray("nextSuggestions") ?? [],
                confidence: o.optionalString("confidence") ?? ""
            )
        }
    }

    private func params(_ c: OrderedJSONObject) throws -> Engine.Params {
        Engine.Params(
            weeklyVolumeSummary: c.rawValue("weeklyVolumeSummary"),
            effectiveSetSummary: c.rawValue("effectiveSetSummary"),
            adherenceReport: c.rawValue("adherenceReport"),
            painPatterns: try painPatterns(c),
            loadFeedback: c.rawValue("loadFeedback"),
            sessionQualityResults: try sessionQualityResults(c),
            trainingLevel: c.optionalString("trainingLevel")
        )
    }

    // MARK: - Golden result decoders

    private func decodeMuscle(_ o: OrderedJSONObject) throws -> Engine.MuscleVolumeAdaptation {
        let decisionString = o.optionalString("decision") ?? ""
        let decision = try XCTUnwrap(Engine.VolumeAdaptationDecision(rawValue: decisionString), "unknown decision \(decisionString)")
        return Engine.MuscleVolumeAdaptation(
            muscleId: o.optionalString("muscleId") ?? "",
            decision: decision,
            setsDelta: o.optionalInt("setsDelta"),
            title: o.optionalString("title") ?? "",
            reason: o.optionalString("reason") ?? "",
            confidence: o.optionalString("confidence") ?? "",
            suggestedActions: o.optionalStringArray("suggestedActions") ?? []
        )
    }

    private func decodeReport(_ o: OrderedJSONObject) throws -> Engine.VolumeAdaptationReport {
        let muscles = try (o.optionalArray("muscles") ?? []).map { try decodeMuscle($0.requireObject("muscle")) }
        return Engine.VolumeAdaptationReport(
            muscles: muscles,
            summary: o.optionalString("summary") ?? ""
        )
    }

    // MARK: - Per-fixture compute-assert

    func testReportCasesParity() throws {
        let id = "volume-adaptation/report-cases-v1"
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL(id).path), "missing golden \(id)")
        let root = try root(id)
        XCTAssertEqual(root.optionalString("sourceFixtureId"), id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 10, "\(id): expected the declared cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("volume-adaptation case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let actual = Engine.buildVolumeAdaptationReport(try params(c))
            let golden = try decodeReport(try XCTUnwrap(c.optionalObject("report"), "\(label): report"))
            XCTAssertEqual(actual, golden, "\(id)/\(label): buildVolumeAdaptationReport mismatch")
        }
    }
}
