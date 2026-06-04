// SC-A — recoveryAwareScheduler parity tests.
//
// FUNCTION-LEVEL compute-assert for the three exported scorers. For each
// `recovery-aware/*-cases-v1` golden, decode every case's echoed engineInput, run the PORTED
// RecoveryAwareScheduler function on the SAME inputs, and assert the produced value equals the
// golden case's `result` field-by-field (struct `==`). Every output is String / [String] /
// number / enum-string / nested SC-1b Conflict, so equality is plain struct equality.
//
// The goldens are GENERATED from the REAL TS recoveryAwareScheduler (scripts/parityGoldensEntry.ts),
// never hand-edited (§22). PURE / read-only — zero `: Date`, no IO beyond reading the committed
// goldens. The real-id (bench-press) and external-library cases drive the EXERCISE_KNOWLEDGE_OVERRIDES
// merge; the template-conflict / recommendation cases drive the consumed SC-1b engine end-to-end.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class RecoveryAwareSchedulerParityTests: XCTestCase {

    // MARK: - Golden plumbing

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

    private func cases(_ id: String) throws -> [OrderedJSONObject] {
        let data = try Data(contentsOf: Self.goldenURL(id))
        let root = try JSONValue(decoding: data).requireObject(id)
        XCTAssertEqual(root.optionalString("sourceFixtureId"), id, "\(id): sourceFixtureId")
        let arr = root.optionalArray("cases") ?? []
        return try arr.map { try $0.requireObject("\(id) case") }
    }

    // MARK: - Input decoders

    private func decodeTemplate(_ value: JSONValue?) -> TrainingTemplate? {
        guard let value, !value.isNull else { return nil }
        return try? TrainingTemplate(decoding: value)
    }

    private func decodeReadiness(_ o: OrderedJSONObject?) -> ReadinessResult? {
        guard let o else { return nil }
        // Only score + trainingAdjustment are read by the engine; level / reasons are inert
        // placeholders (the golden never echoes them — lowReadiness ignores them).
        let adj = ReadinessTrainingAdjustment(rawValue: o.optionalString("trainingAdjustment") ?? "normal") ?? .normal
        return ReadinessResult(score: o.optionalInt("score") ?? 0, level: .medium, trainingAdjustment: adj, reasons: [])
    }

    private func decodeContribution(_ o: OrderedJSONObject?) -> [String: Double]? {
        guard let o else { return nil }
        var dict: [String: Double] = [:]
        for entry in o.entries where entry.value.doubleValue != nil { dict[entry.key] = entry.value.doubleValue }
        return dict
    }

    private func decodeMetaInput(_ o: OrderedJSONObject) -> RecoveryAwareScheduler.ExerciseMetaInput {
        RecoveryAwareScheduler.ExerciseMetaInput(
            id: o.optionalString("id"),
            name: o.optionalString("name"),
            muscle: o.optionalString("muscle"),
            movementPattern: o.optionalString("movementPattern"),
            primaryMuscles: o.optionalStringArray("primaryMuscles"),
            secondaryMuscles: o.optionalStringArray("secondaryMuscles"),
            muscleContribution: decodeContribution(o.optionalObject("muscleContribution"))
        )
    }

    private func decodeExerciseLibrary(_ o: OrderedJSONObject?) -> [String: RecoveryAwareScheduler.ExerciseMetaInput]? {
        guard let o else { return nil }
        var dict: [String: RecoveryAwareScheduler.ExerciseMetaInput] = [:]
        for entry in o.entries where entry.value.objectValue != nil {
            dict[entry.key] = decodeMetaInput(entry.value.objectValue!)
        }
        return dict
    }

    // MARK: - Output decoders

    private func decodeConflict(_ o: OrderedJSONObject) throws -> ExerciseRecoveryConflictEngine.Conflict {
        ExerciseRecoveryConflictEngine.Conflict(
            exerciseId: o.optionalString("exerciseId") ?? "",
            exerciseName: o.optionalString("exerciseName") ?? "",
            conflictLevel: try XCTUnwrap(ExerciseRecoveryConflictEngine.ConflictLevel(rawValue: o.optionalString("conflictLevel") ?? "")),
            affectedAreas: o.optionalStringArray("affectedAreas") ?? [],
            reason: o.optionalString("reason") ?? "",
            recommendedAction: try XCTUnwrap(ExerciseRecoveryConflictEngine.Action(rawValue: o.optionalString("recommendedAction") ?? ""))
        )
    }

    private func decodeBodyPart(_ o: OrderedJSONObject) throws -> RecoveryAwareScheduler.TemplateBodyPartConflict {
        let conflicts = try (o.optionalArray("conflictingExercises") ?? []).map { v -> RecoveryAwareScheduler.TemplateBodyPartConflict.ConflictingExercise in
            let co = try v.requireObject("conflictingExercise")
            return .init(
                exerciseId: co.optionalString("exerciseId") ?? "",
                exerciseName: co.optionalString("exerciseName") ?? "",
                reason: co.optionalString("reason") ?? ""
            )
        }
        return RecoveryAwareScheduler.TemplateBodyPartConflict(
            score: o.optionalDouble("score") ?? 0,
            level: try XCTUnwrap(RecoveryAwareScheduler.RecoveryConflictLevel(rawValue: o.optionalString("level") ?? "")),
            affectedAreas: o.optionalStringArray("affectedAreas") ?? [],
            conflictingExercises: conflicts
        )
    }

    private func decodeTemplateChange(_ o: OrderedJSONObject) throws -> RecoveryAwareScheduler.TemplateChange {
        RecoveryAwareScheduler.TemplateChange(
            type: try XCTUnwrap(RecoveryAwareScheduler.TemplateChange.ChangeType(rawValue: o.optionalString("type") ?? "")),
            exerciseId: o.optionalString("exerciseId"),
            reason: o.optionalString("reason") ?? ""
        )
    }

    private func decodeTemplateConflict(_ o: OrderedJSONObject) throws -> RecoveryAwareScheduler.TemplateRecoveryConflict {
        RecoveryAwareScheduler.TemplateRecoveryConflict(
            templateId: o.optionalString("templateId") ?? "",
            templateName: o.optionalString("templateName") ?? "",
            conflictLevel: try XCTUnwrap(RecoveryAwareScheduler.RecoveryConflictLevel(rawValue: o.optionalString("conflictLevel") ?? "")),
            kind: try XCTUnwrap(RecoveryAwareScheduler.DailyRecommendationKind(rawValue: o.optionalString("kind") ?? "")),
            conflictingExercises: try (o.optionalArray("conflictingExercises") ?? []).map { try decodeConflict(try $0.requireObject("conflict")) },
            safeExercises: try (o.optionalArray("safeExercises") ?? []).map { try decodeConflict(try $0.requireObject("conflict")) },
            suggestedChanges: try (o.optionalArray("suggestedChanges") ?? []).map { try decodeTemplateChange(try $0.requireObject("change")) },
            summary: o.optionalString("summary") ?? ""
        )
    }

    private func decodeRecChange(_ o: OrderedJSONObject) throws -> RecoveryAwareScheduler.RecommendationChange {
        RecoveryAwareScheduler.RecommendationChange(
            type: try XCTUnwrap(RecoveryAwareScheduler.RecommendationChange.ChangeType(rawValue: o.optionalString("type") ?? "")),
            target: o.optionalString("target"),
            reason: o.optionalString("reason") ?? ""
        )
    }

    private func decodeRecommendation(_ o: OrderedJSONObject) throws -> RecoveryAwareScheduler.RecoveryAwareRecommendation {
        RecoveryAwareScheduler.RecoveryAwareRecommendation(
            kind: try XCTUnwrap(RecoveryAwareScheduler.DailyRecommendationKind(rawValue: o.optionalString("kind") ?? "")),
            templateId: o.optionalString("templateId"),
            templateName: o.optionalString("templateName"),
            title: o.optionalString("title") ?? "",
            summary: o.optionalString("summary") ?? "",
            conflictLevel: try XCTUnwrap(RecoveryAwareScheduler.RecoveryConflictLevel(rawValue: o.optionalString("conflictLevel") ?? "")),
            affectedAreas: o.optionalStringArray("affectedAreas") ?? [],
            reasons: o.optionalStringArray("reasons") ?? [],
            suggestedChanges: try (o.optionalArray("suggestedChanges") ?? []).map { try decodeRecChange(try $0.requireObject("change")) },
            templateRecoveryConflict: try o.optionalObject("templateRecoveryConflict").map { try decodeTemplateConflict($0) },
            requiresConfirmationToOverride: o.optionalBool("requiresConfirmationToOverride") ?? false
        )
    }

    // MARK: - Envelope guards

    func testGoldenEnvelopes() throws {
        XCTAssertGreaterThanOrEqual(try cases("recovery-aware/body-part-conflict-cases-v1").count, 22, "body-part cases")
        XCTAssertGreaterThanOrEqual(try cases("recovery-aware/template-recovery-conflict-cases-v1").count, 14, "template-conflict cases")
        XCTAssertGreaterThanOrEqual(try cases("recovery-aware/recommendation-cases-v1").count, 13, "recommendation cases")
    }

    // MARK: - buildTemplateBodyPartConflictScore

    func testBodyPartConflictParityForEveryCase() throws {
        for c in try cases("recovery-aware/body-part-conflict-cases-v1") {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let template = decodeTemplate(c.rawValue("template"))
            let actual = RecoveryAwareScheduler.buildTemplateBodyPartConflictScore(
                template: template,
                sorenessAreas: c.optionalStringArray("sorenessAreas") ?? [],
                painAreas: c.optionalStringArray("painAreas") ?? [],
                exerciseLibrary: decodeExerciseLibrary(c.optionalObject("exerciseLibrary"))
            )
            let golden = try decodeBodyPart(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "recovery-aware/body-part/\(label): mismatch")
        }
    }

    // MARK: - buildTemplateRecoveryConflict

    func testTemplateRecoveryConflictParityForEveryCase() throws {
        for c in try cases("recovery-aware/template-recovery-conflict-cases-v1") {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let template = try XCTUnwrap(decodeTemplate(c.rawValue("template")), "\(label): template")
            let actual = RecoveryAwareScheduler.buildTemplateRecoveryConflict(
                template: template,
                sorenessAreas: c.optionalStringArray("sorenessAreas") ?? [],
                painAreas: c.optionalStringArray("painAreas") ?? [],
                readinessResult: decodeReadiness(c.optionalObject("readinessResult"))
            )
            let golden = try decodeTemplateConflict(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "recovery-aware/template-conflict/\(label): mismatch")
        }
    }

    // MARK: - buildRecoveryAwareRecommendation

    func testRecommendationParityForEveryCase() throws {
        for c in try cases("recovery-aware/recommendation-cases-v1") {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let templates = (c.optionalArray("templates") ?? []).compactMap { decodeTemplate($0) }
            let actual = RecoveryAwareScheduler.buildRecoveryAwareRecommendation(
                preferredTemplate: decodeTemplate(c.rawValue("preferredTemplate")),
                template: decodeTemplate(c.rawValue("template")),
                templates: templates,
                sorenessAreas: c.optionalStringArray("sorenessAreas") ?? [],
                painAreas: c.optionalStringArray("painAreas") ?? [],
                exerciseLibrary: decodeExerciseLibrary(c.optionalObject("exerciseLibrary")),
                readinessResult: decodeReadiness(c.optionalObject("readinessResult")),
                availableTimeMin: c.optionalDouble("availableTimeMin")
            )
            let golden = try decodeRecommendation(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "recovery-aware/recommendation/\(label): mismatch")
        }
    }
}
