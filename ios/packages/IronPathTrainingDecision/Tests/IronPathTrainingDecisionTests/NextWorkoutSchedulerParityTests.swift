// SC-C — nextWorkoutScheduler parity tests.
//
// FUNCTION-LEVEL compute-assert for the three exports. For each `next-workout/*-cases-v1` golden,
// decode every case's echoed engineInput, run the PORTED NextWorkoutScheduler export on the SAME
// inputs, and assert the produced value equals the golden case's `result` field-by-field
// (struct `==`). The recommendation result nests the full SC-A RecoveryAwareRecommendation
// (`recovery`) + its templateRecoveryConflict; those decode with the same shape the SC-A parity
// tests use. The ordering exports only reorder (never transform) elements, so the ordered id
// sequence (+ usedProgramOrder) is the faithful pin.
//
// The goldens are GENERATED from the REAL TS nextWorkoutScheduler (scripts/parityGoldensEntry.ts),
// never hand-edited (§22). PURE / read-only — zero `: Date` (todayState.date is the only "today",
// an explicit input), no IO beyond reading the committed goldens.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class NextWorkoutSchedulerParityTests: XCTestCase {

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

    private func decodeSession(_ value: JSONValue?) throws -> TrainingSession? {
        guard let value, !value.isNull else { return nil }
        return try TrainingSession(decoding: value)
    }

    private func decodeProgram(_ value: JSONValue?) throws -> ProgramTemplate? {
        guard let value, !value.isNull else { return nil }
        return try ProgramTemplate(decoding: value)
    }

    private func decodeTemplate(_ value: JSONValue?) throws -> TrainingTemplate? {
        guard let value, !value.isNull else { return nil }
        return try TrainingTemplate(decoding: value)
    }

    private func decodeTodayState(_ o: OrderedJSONObject?) -> TodayStateEngine.TodayTrainingState? {
        guard let o else { return nil }
        return TodayStateEngine.TodayTrainingState(
            status: o.optionalString("status") ?? "",
            date: o.optionalString("date") ?? "",
            primaryAction: o.optionalString("primaryAction") ?? "",
            plannedTemplateId: o.optionalString("plannedTemplateId"),
            activeSessionId: o.optionalString("activeSessionId"),
            completedSessionIds: o.optionalStringArray("completedSessionIds"),
            lastCompletedSessionId: o.optionalString("lastCompletedSessionId")
        )
    }

    private func decodeVolumeRow(_ o: OrderedJSONObject) -> NextWorkoutScheduler.VolumeRow {
        NextWorkoutScheduler.VolumeRow(
            muscle: o.optionalString("muscle"),
            muscleId: o.optionalString("muscleId"),
            target: o.optionalDouble("target"),
            targetSets: o.optionalDouble("targetSets"),
            sets: o.optionalDouble("sets"),
            completedSets: o.optionalDouble("completedSets"),
            effectiveSets: o.optionalDouble("effectiveSets"),
            weightedEffectiveSets: o.optionalDouble("weightedEffectiveSets"),
            remaining: o.optionalDouble("remaining"),
            remainingSets: o.optionalDouble("remainingSets")
        )
    }

    private func decodeWeeklyVolumeSummary(_ o: OrderedJSONObject?) -> NextWorkoutScheduler.WeeklyVolumeSummaryInput? {
        guard let o else { return nil }
        // The port reads `muscles ?? []` / `byMuscle ?? []`, so an absent key (decoded to []) is
        // value-identical to nil — no need to distinguish them here.
        let muscles = (o.optionalArray("muscles") ?? []).compactMap { $0.objectValue.map { decodeVolumeRow($0) } }
        let byMuscle: [(key: String, row: NextWorkoutScheduler.VolumeRow)] = (o.optionalObject("byMuscle")?.entries ?? []).compactMap { entry in
            entry.value.objectValue.map { (key: entry.key, row: decodeVolumeRow($0)) }
        }
        return NextWorkoutScheduler.WeeklyVolumeSummaryInput(byMuscle: byMuscle, muscles: muscles)
    }

    private func decodePainPattern(_ o: OrderedJSONObject) -> PainPatternEngine.PainPattern {
        PainPatternEngine.PainPattern(
            area: o.optionalString("area") ?? "",
            exerciseId: o.optionalString("exerciseId"),
            frequency: o.optionalInt("frequency") ?? 0,
            severityAvg: o.optionalDouble("severityAvg") ?? .nan,
            lastOccurredAt: o.optionalString("lastOccurredAt") ?? "",
            suggestedAction: PainPatternEngine.PainSuggestedAction(rawValue: o.optionalString("suggestedAction") ?? "") ?? .watch
        )
    }

    private func decodeReadiness(_ o: OrderedJSONObject?) -> ReadinessResult? {
        guard let o else { return nil }
        // Only score + trainingAdjustment are read; level / reasons are inert placeholders.
        let adj = ReadinessTrainingAdjustment(rawValue: o.optionalString("trainingAdjustment") ?? "normal") ?? .normal
        return ReadinessResult(score: o.optionalInt("score") ?? 0, level: .medium, trainingAdjustment: adj, reasons: [])
    }

    // MARK: - Output decoders (the nested SC-A RecoveryAwareRecommendation shape)

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

    private func decodeRecovery(_ o: OrderedJSONObject) throws -> RecoveryAwareScheduler.RecoveryAwareRecommendation {
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

    private func decodeAlternative(_ o: OrderedJSONObject) -> NextWorkoutScheduler.NextWorkoutRecommendation.Alternative {
        NextWorkoutScheduler.NextWorkoutRecommendation.Alternative(
            templateId: o.optionalString("templateId") ?? "",
            templateName: o.optionalString("templateName") ?? "",
            reason: o.optionalString("reason") ?? ""
        )
    }

    private func decodeRecommendation(_ o: OrderedJSONObject) throws -> NextWorkoutScheduler.NextWorkoutRecommendation {
        NextWorkoutScheduler.NextWorkoutRecommendation(
            kind: o.optionalString("kind").flatMap { RecoveryAwareScheduler.DailyRecommendationKind(rawValue: $0) },
            plannedTemplateId: o.optionalString("plannedTemplateId"),
            plannedTemplateName: o.optionalString("plannedTemplateName"),
            recommendedTemplateId: o.optionalString("recommendedTemplateId"),
            overrideReason: o.optionalString("overrideReason"),
            templateId: o.optionalString("templateId"),
            templateName: o.optionalString("templateName") ?? "",
            confidence: try XCTUnwrap(NextWorkoutScheduler.NextWorkoutRecommendation.Confidence(rawValue: o.optionalString("confidence") ?? "")),
            reason: o.optionalString("reason") ?? "",
            warnings: o.optionalStringArray("warnings") ?? [],
            conflictLevel: o.optionalString("conflictLevel").flatMap { RecoveryAwareScheduler.RecoveryConflictLevel(rawValue: $0) },
            recovery: try o.optionalObject("recovery").map { try decodeRecovery($0) },
            alternatives: (o.optionalArray("alternatives") ?? []).compactMap { $0.objectValue.map { decodeAlternative($0) } }
        )
    }

    // MARK: - Envelope guards

    func testGoldenEnvelopes() throws {
        XCTAssertGreaterThanOrEqual(try cases("next-workout/recommendation-cases-v1").count, 15, "recommendation cases")
        XCTAssertGreaterThanOrEqual(try cases("next-workout/ordered-templates-cases-v1").count, 7, "ordered-templates cases")
    }

    // MARK: - buildNextWorkoutRecommendation

    func testRecommendationParityForEveryCase() throws {
        for c in try cases("next-workout/recommendation-cases-v1") {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let actual = NextWorkoutScheduler.buildNextWorkoutRecommendation(
                history: (c.optionalArray("history") ?? []).compactMap { try? TrainingSession(decoding: $0) },
                activeSession: try decodeSession(c.rawValue("activeSession")),
                programTemplate: try decodeProgram(c.rawValue("programTemplate")),
                templates: (c.optionalArray("templates") ?? []).compactMap { try? TrainingTemplate(decoding: $0) },
                todayState: decodeTodayState(c.optionalObject("todayState")),
                weeklyVolumeSummary: decodeWeeklyVolumeSummary(c.optionalObject("weeklyVolumeSummary")),
                painPatterns: (c.optionalArray("painPatterns") ?? []).compactMap { $0.objectValue.map { decodePainPattern($0) } },
                sorenessAreas: c.optionalStringArray("sorenessAreas") ?? [],
                painAreas: c.optionalStringArray("painAreas") ?? [],
                readinessResult: decodeReadiness(c.optionalObject("readinessResult")),
                trainingMode: c.optionalString("trainingMode")
            )
            let golden = try decodeRecommendation(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "next-workout/recommendation/\(label): mismatch")
        }
    }

    // MARK: - getOrderedProgramDayTemplates / getOrderedTrainingTemplates

    func testOrderedTemplatesParityForEveryCase() throws {
        for c in try cases("next-workout/ordered-templates-cases-v1") {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let kind = c.optionalString("kind") ?? ""
            switch kind {
            case "getOrderedProgramDayTemplates":
                let program = try decodeProgram(c.rawValue("programTemplate"))
                let actual = NextWorkoutScheduler.getOrderedProgramDayTemplates(program).map { $0.id ?? "" }
                let golden = (c.optionalArray("orderedDayIds") ?? []).map { $0.stringValue ?? "" }
                XCTAssertEqual(actual, golden, "next-workout/ordered/\(label): orderedDayIds mismatch")
            case "getOrderedTrainingTemplates":
                let program = try decodeProgram(c.rawValue("programTemplate"))
                let templates = (c.optionalArray("templates") ?? []).compactMap { try? TrainingTemplate(decoding: $0) }
                let result = NextWorkoutScheduler.getOrderedTrainingTemplates(templates, program)
                XCTAssertEqual(
                    result.templates.map { $0.id ?? "" },
                    (c.optionalArray("orderedTemplateIds") ?? []).map { $0.stringValue ?? "" },
                    "next-workout/ordered/\(label): orderedTemplateIds mismatch"
                )
                XCTAssertEqual(result.usedProgramOrder, c.optionalBool("usedProgramOrder") ?? false, "next-workout/ordered/\(label): usedProgramOrder mismatch")
            default:
                XCTFail("next-workout/ordered/\(label): unknown kind \(kind)")
            }
        }
    }
}
