// CC-2 — coachActionEngine TOP-LEVEL aggregator parity tests.
//
// FUNCTION-LEVEL compute-assert over the three `coach-action/*` goldens: for each case,
// decode the echoed engine input, run the PORTED CoachActionEngine on the SAME inputs, and
// assert the produced output equals the golden case's `result`:
//   • build-actions     → buildCoachActions → ordered [CoachAction], each canonical-JSON-equal
//     (pins every source builder + dedupe + the priority/dataHealth-first/id sort + the
//     active-session noise gate + tomorrowIso expiresAt).
//   • adjustment-draft  → buildCoachActionAdjustmentDraftInput → { recommendation, sourceTemplate }
//     | null, canonical-JSON-equal (pins the muscle/exercise branches + formatExerciseName +
//     every null short-circuit).
//   • source-fingerprint → buildCoachActionSourceFingerprint → exact fingerprint string.
//
// The goldens are GENERATED from the retired legacy coachActionEngine (frozen legacy fixture generator),
// never hand-edited (§22). PURE / read-only — the only clock is the INJECTED `now` (no `: Date`
// on the engine path; tomorrowIso is integer civil arithmetic), no IO beyond the committed goldens.

import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class CoachActionEngineParityTests: XCTestCase {

    private typealias Engine = CoachActionEngine

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

    // MARK: - consumed result-type decoders (reuse the AN-6 paradigm: memberwise init via @testable)

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

    private func decodeRecovery(_ o: OrderedJSONObject) -> RecoveryAwareScheduler.RecoveryAwareRecommendation {
        let kind = RecoveryAwareScheduler.DailyRecommendationKind(rawValue: o.optionalString("kind") ?? "") ?? .train
        return RecoveryAwareScheduler.RecoveryAwareRecommendation(
            kind: kind,
            templateId: o.optionalString("templateId"),
            templateName: o.optionalString("templateName"),
            title: o.optionalString("title") ?? "",
            summary: o.optionalString("summary") ?? "",
            conflictLevel: RecoveryAwareScheduler.RecoveryConflictLevel.none,
            affectedAreas: o.optionalStringArray("affectedAreas") ?? [],
            reasons: o.optionalStringArray("reasons") ?? [],
            suggestedChanges: [],
            templateRecoveryConflict: nil,
            requiresConfirmationToOverride: o.optionalBool("requiresConfirmationToOverride") ?? false
        )
    }

    private func decodeNextWorkout(_ o: OrderedJSONObject) -> NextWorkoutScheduler.NextWorkoutRecommendation {
        let recovery = o.optionalObject("recovery").map(decodeRecovery)
        return NextWorkoutScheduler.NextWorkoutRecommendation(
            kind: nil,
            plannedTemplateId: nil,
            plannedTemplateName: nil,
            recommendedTemplateId: nil,
            overrideReason: nil,
            templateId: o.optionalString("templateId"),
            templateName: o.optionalString("templateName") ?? "",
            confidence: .medium,
            reason: o.optionalString("reason") ?? "",
            warnings: o.optionalStringArray("warnings") ?? [],
            conflictLevel: nil,
            recovery: recovery,
            alternatives: []
        )
    }

    private func decodeAppData(_ o: OrderedJSONObject) -> AppData {
        // The engine reads only root["templates"] / root["activeSession"]; the schemaVersion
        // guard is irrelevant to it, so carry the echoed object verbatim as `root`.
        AppData(schemaVersion: .current, root: o)
    }

    private func decodeRecConfInput(_ v: JSONValue?) throws -> Engine.RecommendationConfidenceInput? {
        guard let v, !v.isNull else { return nil }
        if let arr = v.arrayValue {
            return .list(try arr.map { try decodeConfidence($0.requireObject("recommendationConfidence")) })
        }
        if let obj = v.objectValue {
            return .single(try decodeConfidence(obj))
        }
        return nil
    }

    private func decodeBuildInput(_ o: OrderedJSONObject) throws -> Engine.BuildCoachActionsInput {
        let appData = decodeAppData(try XCTUnwrap(o.optionalObject("appData"), "appData"))

        var dailyAdjustment: DailyTrainingAdjustment? = nil
        if let v = o.rawValue("dailyAdjustment"), !v.isNull { dailyAdjustment = try DailyTrainingAdjustment(decoding: v) }

        var dataHealthReport: DataHealthReport? = nil
        if let v = o.rawValue("dataHealthReport"), !v.isNull { dataHealthReport = try DataHealthReport(decoding: v) }

        let nextWorkout = o.optionalObject("nextWorkout").map(decodeNextWorkout)
        let sessionQuality = o.optionalObject("sessionQuality").map(decodeSessionQuality)

        var plateauResults: [PlateauDetectionEngine.PlateauDetectionResult]? = nil
        if let arr = o.optionalArray("plateauResults") {
            plateauResults = try arr.map { try decodePlateau($0.requireObject("plateauResult")) }
        }

        var volumeAdaptation: VolumeAdaptationEngine.VolumeAdaptationReport? = nil
        if let vo = o.optionalObject("volumeAdaptation") { volumeAdaptation = try decodeVolumeReport(vo) }

        let recommendationConfidence = try decodeRecConfInput(o.rawValue("recommendationConfidence"))

        var setAnomalies: [SetAnomaly]? = nil
        if let arr = o.optionalArray("setAnomalies") { setAnomalies = try arr.map { try SetAnomaly(decoding: $0) } }

        let recoveryRecommendation = o.optionalObject("recoveryRecommendation").map(decodeRecovery)

        return Engine.BuildCoachActionsInput(
            appData: appData,
            dailyAdjustment: dailyAdjustment,
            nextWorkout: nextWorkout,
            dataHealthReport: dataHealthReport,
            sessionQuality: sessionQuality,
            plateauResults: plateauResults,
            volumeAdaptation: volumeAdaptation,
            recommendationConfidence: recommendationConfidence,
            setAnomalies: setAnomalies,
            recoveryRecommendation: recoveryRecommendation,
            now: o.optionalString("now")
        )
    }

    private func decodeCoachAction(_ o: OrderedJSONObject) -> Engine.CoachAction {
        Engine.CoachAction(
            id: o.optionalString("id") ?? "",
            title: o.optionalString("title") ?? "",
            description: o.optionalString("description") ?? "",
            source: o.optionalString("source") ?? "",
            actionType: o.optionalString("actionType") ?? "",
            priority: o.optionalString("priority") ?? "",
            status: o.optionalString("status") ?? "pending",
            requiresConfirmation: o.optionalBool("requiresConfirmation") ?? false,
            reversible: o.optionalBool("reversible") ?? false,
            createdAt: o.optionalString("createdAt") ?? "",
            expiresAt: o.optionalString("expiresAt"),
            targetId: o.optionalString("targetId"),
            targetType: o.optionalString("targetType"),
            reason: o.optionalString("reason") ?? "",
            confirmTitle: o.optionalString("confirmTitle"),
            confirmDescription: o.optionalString("confirmDescription"),
            sourceFingerprint: o.optionalString("sourceFingerprint")
        )
    }

    private func decodeContext(_ o: OrderedJSONObject?) throws -> Engine.AdjustmentDraftContext {
        guard let o else { return Engine.AdjustmentDraftContext() }
        var templates: [TrainingTemplate]? = nil
        if let arr = o.optionalArray("templates") { templates = try arr.map { try TrainingTemplate(decoding: $0) } }
        var volumeAdaptation: VolumeAdaptationEngine.VolumeAdaptationReport? = nil
        if let vo = o.optionalObject("volumeAdaptation") { volumeAdaptation = try decodeVolumeReport(vo) }
        var plateauResults: [PlateauDetectionEngine.PlateauDetectionResult]? = nil
        if let arr = o.optionalArray("plateauResults") {
            plateauResults = try arr.map { try decodePlateau($0.requireObject("plateauResult")) }
        }
        return Engine.AdjustmentDraftContext(templates: templates, volumeAdaptation: volumeAdaptation, plateauResults: plateauResults)
    }

    private func decodeFingerprintContext(_ o: OrderedJSONObject?) -> CoachActionIdentityEngine.CoachActionFingerprintContext {
        guard let o else { return CoachActionIdentityEngine.CoachActionFingerprintContext() }
        var suggestedChange: CoachActionIdentityEngine.SuggestedChange? = nil
        if let sc = o.optionalObject("suggestedChange") {
            suggestedChange = CoachActionIdentityEngine.SuggestedChange(
                muscleId: sc.optionalString("muscleId"),
                setsDelta: sc.optionalInt("setsDelta").map { NumberRepr.integer(Int64($0)) },
                exerciseIds: sc.optionalStringArray("exerciseIds"),
                removeExerciseIds: sc.optionalStringArray("removeExerciseIds"),
                supportDoseAdjustment: sc.optionalString("supportDoseAdjustment")
            )
        }
        return CoachActionIdentityEngine.CoachActionFingerprintContext(
            sourceTemplateId: o.optionalString("sourceTemplateId"),
            suggestedChange: suggestedChange,
            suggestedChangeType: o.optionalString("suggestedChangeType"),
            muscleId: o.optionalString("muscleId"),
            exerciseId: o.optionalString("exerciseId"),
            templateId: o.optionalString("templateId"),
            weekId: o.optionalString("weekId"),
            cycleId: o.optionalString("cycleId")
        )
    }

    // MARK: - envelopes

    func testGoldenEnvelopes() throws {
        let ids = [
            "coach-action/build-actions-cases-v1",
            "coach-action/adjustment-draft-cases-v1",
            "coach-action/source-fingerprint-cases-v1",
        ]
        for id in ids {
            XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL(id).path), "missing coach-action golden: \(id)")
            XCTAssertEqual(try root(id).optionalString("sourceFixtureId"), id)
        }
    }

    // MARK: - buildCoachActions

    func testBuildActionsParity() throws {
        let id = "coach-action/build-actions-cases-v1"
        let root = try root(id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 6, "\(id): expected the declared cases")
        for value in cases {
            let c = try value.requireObject("coach-action buildCoachActions case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "buildCoachActions", "\(label): kind")
            let input = try decodeBuildInput(try XCTUnwrap(c.optionalObject("input"), "\(label): input"))
            let computed = Engine.buildCoachActions(input)
            let golden = c.optionalArray("result") ?? []
            XCTAssertEqual(computed.count, golden.count, "\(label): count")
            for (i, action) in computed.enumerated() where i < golden.count {
                let computedStr = try action.encoded().canonicalJSONString()
                let goldenStr = try golden[i].canonicalJSONString()
                XCTAssertEqual(computedStr, goldenStr, "\(label) #\(i): CoachAction canonical mismatch")
            }
        }
    }

    // MARK: - buildCoachActionAdjustmentDraftInput

    func testAdjustmentDraftParity() throws {
        let id = "coach-action/adjustment-draft-cases-v1"
        let root = try root(id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 7, "\(id): expected the declared cases")
        for value in cases {
            let c = try value.requireObject("coach-action adjustmentDraft case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "adjustmentDraft", "\(label): kind")
            let action = decodeCoachAction(try XCTUnwrap(c.optionalObject("action"), "\(label): action"))
            let context = try decodeContext(c.optionalObject("context"))
            let computed = Engine.buildCoachActionAdjustmentDraftInput(action, context)
            let goldenResult = c.rawValue("result")
            if let computed {
                let computedStr = try computed.encoded().canonicalJSONString()
                let goldenStr = try (goldenResult ?? .null).canonicalJSONString()
                XCTAssertEqual(computedStr, goldenStr, "\(label): adjustment-draft canonical mismatch")
            } else {
                XCTAssertTrue(goldenResult == nil || goldenResult!.isNull, "\(label): expected null result, golden was non-null")
            }
        }
    }

    // MARK: - buildCoachActionSourceFingerprint

    func testSourceFingerprintParity() throws {
        let id = "coach-action/source-fingerprint-cases-v1"
        let root = try root(id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 3, "\(id): expected the declared cases")
        for value in cases {
            let c = try value.requireObject("coach-action sourceFingerprint case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "sourceFingerprint", "\(label): kind")
            let action = decodeCoachAction(try XCTUnwrap(c.optionalObject("action"), "\(label): action"))
            let options = decodeFingerprintContext(c.optionalObject("options"))
            let computed = Engine.buildCoachActionSourceFingerprint(action, options)
            XCTAssertEqual(computed, c.optionalString("result"), "\(label): fingerprint mismatch")
        }
    }
}
