// AN-6 — trainingIntelligenceSummaryEngine TOP-LEVEL parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `intelligence-summary/*` golden case, decode the echoed
// engineInput (optional latestSession + history + the opaque external inputs — weeklyVolumeSummary /
// e1rmProfiles / effectiveSetSummary / loadFeedback / painPatterns / trainingLevel), run the
// PORTED `TrainingIntelligenceSummaryEngine.buildTrainingIntelligenceSummary` on the SAME inputs,
// and assert the produced `TrainingIntelligenceSummary` equals the golden case's `summary` — full
// struct `==` over the entire aggregate: sessionQuality? + the ordered recommendationConfidence[] +
// plateauResults[] + the volumeAdaptation report + keyInsights + recommendedActions.
//
// The golden is GENERATED from the retired legacy trainingIntelligenceSummaryEngine
// (frozen legacy fixture generator), never hand-edited (§22). This is the INTEGRATION pin that
// closes the analysis engine layer: it proves the ported top aggregator + its already-pinned AN-1~5
// leaves reproduce the legacy web schema pipeline end-to-end. PURE / read-only — zero `: Date` (the only date reads
// are inside the reused E1RMEngine.filterAnalyticsHistory, over each session's OWN date strings), no
// IO beyond reading the committed golden.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingIntelligenceSummaryEngineParityTests: XCTestCase {

    private typealias Engine = TrainingIntelligenceSummaryEngine

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

    // MARK: - Input decoders (echoed engineInput → ported Params)

    private func params(_ c: OrderedJSONObject) throws -> Engine.Params {
        let latestSession: TrainingSession?
        if let lv = c.rawValue("latestSession"), lv.objectValue != nil {
            latestSession = try TrainingSession(decoding: lv)
        } else {
            latestSession = nil
        }
        let history = try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
        return Engine.Params(
            latestSession: latestSession,
            history: history,
            weeklyVolumeSummary: c.rawValue("weeklyVolumeSummary"),
            e1rmProfiles: c.optionalArray("e1rmProfiles") ?? [],
            effectiveSetSummary: c.rawValue("effectiveSetSummary"),
            loadFeedback: c.rawValue("loadFeedback"),
            painPatterns: c.optionalArray("painPatterns"),
            trainingLevel: c.optionalString("trainingLevel")
        )
    }

    // MARK: - Golden result decoders (one per consumed sub-result + the aggregate)

    private func decodeSessionSignal(_ o: OrderedJSONObject) -> SessionQualityEngine.SessionQualitySignal {
        SessionQualityEngine.SessionQualitySignal(
            id: o.optionalString("id") ?? "",
            label: o.optionalString("label") ?? "",
            tone: o.optionalString("tone") ?? "",
            reason: o.optionalString("reason") ?? ""
        )
    }

    private func decodeSessionQuality(_ o: OrderedJSONObject) -> SessionQualityEngine.SessionQualityResult {
        let positives = (o.optionalArray("positives") ?? []).compactMap { $0.objectValue.map(decodeSessionSignal) }
        let issues = (o.optionalArray("issues") ?? []).compactMap { $0.objectValue.map(decodeSessionSignal) }
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

    private func decodeConfidenceReason(_ o: OrderedJSONObject) -> RecommendationConfidenceEngine.RecommendationConfidenceReason {
        RecommendationConfidenceEngine.RecommendationConfidenceReason(
            id: o.optionalString("id") ?? "",
            label: o.optionalString("label") ?? "",
            effect: o.optionalString("effect") ?? "",
            reason: o.optionalString("reason") ?? ""
        )
    }

    private func decodeConfidence(_ o: OrderedJSONObject) throws -> RecommendationConfidenceEngine.RecommendationConfidenceResult {
        let levelString = o.optionalString("level") ?? ""
        let level = try XCTUnwrap(RecommendationConfidenceEngine.RecommendationConfidenceLevel(rawValue: levelString), "unknown level \(levelString)")
        let reasons = try (o.optionalArray("reasons") ?? []).map { decodeConfidenceReason(try $0.requireObject("reason")) }
        return RecommendationConfidenceEngine.RecommendationConfidenceResult(
            level: level,
            score: o.optionalInt("score") ?? 0,
            title: o.optionalString("title") ?? "",
            summary: o.optionalString("summary") ?? "",
            reasons: reasons,
            missingData: o.optionalStringArray("missingData") ?? []
        )
    }

    private func decodePlateauSignal(_ o: OrderedJSONObject) -> PlateauDetectionEngine.PlateauSignal {
        PlateauDetectionEngine.PlateauSignal(
            id: o.optionalString("id") ?? "",
            label: o.optionalString("label") ?? "",
            reason: o.optionalString("reason") ?? "",
            severity: o.optionalString("severity") ?? ""
        )
    }

    private func decodePlateau(_ o: OrderedJSONObject) throws -> PlateauDetectionEngine.PlateauDetectionResult {
        let statusString = o.optionalString("status") ?? ""
        let status = try XCTUnwrap(PlateauDetectionEngine.PlateauStatus(rawValue: statusString), "unknown status \(statusString)")
        let signals = try (o.optionalArray("signals") ?? []).map { decodePlateauSignal(try $0.requireObject("signal")) }
        return PlateauDetectionEngine.PlateauDetectionResult(
            exerciseId: o.optionalString("exerciseId") ?? "",
            status: status,
            title: o.optionalString("title") ?? "",
            summary: o.optionalString("summary") ?? "",
            signals: signals,
            suggestedActions: o.optionalStringArray("suggestedActions") ?? [],
            confidence: o.optionalString("confidence") ?? ""
        )
    }

    private func decodeMuscle(_ o: OrderedJSONObject) throws -> VolumeAdaptationEngine.MuscleVolumeAdaptation {
        let decisionString = o.optionalString("decision") ?? ""
        let decision = try XCTUnwrap(VolumeAdaptationEngine.VolumeAdaptationDecision(rawValue: decisionString), "unknown decision \(decisionString)")
        return VolumeAdaptationEngine.MuscleVolumeAdaptation(
            muscleId: o.optionalString("muscleId") ?? "",
            decision: decision,
            setsDelta: o.optionalInt("setsDelta"),
            title: o.optionalString("title") ?? "",
            reason: o.optionalString("reason") ?? "",
            confidence: o.optionalString("confidence") ?? "",
            suggestedActions: o.optionalStringArray("suggestedActions") ?? []
        )
    }

    private func decodeVolumeReport(_ o: OrderedJSONObject) throws -> VolumeAdaptationEngine.VolumeAdaptationReport {
        let muscles = try (o.optionalArray("muscles") ?? []).map { try decodeMuscle($0.requireObject("muscle")) }
        return VolumeAdaptationEngine.VolumeAdaptationReport(
            muscles: muscles,
            summary: o.optionalString("summary") ?? ""
        )
    }

    private func decodeAction(_ o: OrderedJSONObject) -> Engine.Action {
        Engine.Action(
            id: o.optionalString("id") ?? "",
            label: o.optionalString("label") ?? "",
            reason: o.optionalString("reason") ?? "",
            actionType: o.optionalString("actionType") ?? "",
            requiresConfirmation: o.optionalBool("requiresConfirmation") ?? false
        )
    }

    private func decodeSummary(_ o: OrderedJSONObject) throws -> Engine.TrainingIntelligenceSummary {
        let sessionQuality = o.optionalObject("sessionQuality").map(decodeSessionQuality)
        let recommendationConfidence = try (o.optionalArray("recommendationConfidence") ?? []).map { try decodeConfidence($0.requireObject("recommendationConfidence")) }
        let plateauResults = try (o.optionalArray("plateauResults") ?? []).map { try decodePlateau($0.requireObject("plateauResult")) }
        let volumeAdaptation = try decodeVolumeReport(try XCTUnwrap(o.optionalObject("volumeAdaptation"), "volumeAdaptation"))
        let recommendedActions = (o.optionalArray("recommendedActions") ?? []).compactMap { $0.objectValue.map(decodeAction) }
        return Engine.TrainingIntelligenceSummary(
            sessionQuality: sessionQuality,
            recommendationConfidence: recommendationConfidence,
            plateauResults: plateauResults,
            volumeAdaptation: volumeAdaptation,
            keyInsights: o.optionalStringArray("keyInsights") ?? [],
            recommendedActions: recommendedActions
        )
    }

    // MARK: - Per-fixture compute-assert

    func testSummaryCasesParity() throws {
        let id = "intelligence-summary/summary-cases-v1"
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL(id).path), "missing golden \(id)")
        let root = try root(id)
        XCTAssertEqual(root.optionalString("sourceFixtureId"), id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 11, "\(id): expected the declared cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("intelligence-summary case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let actual = Engine.buildTrainingIntelligenceSummary(try params(c))
            let golden = try decodeSummary(try XCTUnwrap(c.optionalObject("summary"), "\(label): summary"))
            XCTAssertEqual(actual, golden, "\(id)/\(label): buildTrainingIntelligenceSummary mismatch")
        }
    }
}
