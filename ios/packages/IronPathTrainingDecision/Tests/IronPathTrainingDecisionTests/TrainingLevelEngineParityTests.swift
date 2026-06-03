// AN-5 — trainingLevelEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `training-level/*` golden case, decode the echoed
// engineInput (history + optional painPatterns / techniqueQualitySummary / calendarData
// overrides), run the PORTED TrainingLevelEngine on the SAME inputs, and assert:
//   - buildTrainingLevelAssessment == golden `assessment` (level / confidence /
//     readinessForAdvancedFeatures / every signal name+score+confidence+reason / limitations /
//     nextDataNeeded — full struct `==`)
//   - buildTechniqueQualitySummary(history) == golden `techniqueQualitySummaryProbe`
//   - formatAutoTrainingLevel(level) == golden `levelLabelProbe`
//
// The goldens are GENERATED from the REAL TS engine (scripts/generate-parity-goldens.mjs),
// never hand-edited (§22). PURE / read-only — zero `: Date` (the frequency week-bucketing
// uses AN-1 civil math), no IO beyond reading the committed golden.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingLevelEngineParityTests: XCTestCase {

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
        let url = Self.repoRoot.appendingPathComponent("tests/fixtures/parity/golden/\(id).json", isDirectory: false)
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

    private func decodeTechnique(_ o: OrderedJSONObject) -> PlateauDetectionEngine.TechniqueQualitySummary {
        PlateauDetectionEngine.TechniqueQualitySummary(
            totalSets: o.optionalDouble("totalSets") ?? .nan,
            good: o.optionalDouble("good") ?? .nan,
            acceptable: o.optionalDouble("acceptable") ?? .nan,
            poor: o.optionalDouble("poor") ?? .nan,
            goodOrAcceptableRate: o.optionalDouble("goodOrAcceptableRate") ?? .nan,
            poorRate: o.optionalDouble("poorRate") ?? .nan,
            rirRecordedRate: o.optionalDouble("rirRecordedRate") ?? .nan
        )
    }

    private func decodeCalendar(_ o: OrderedJSONObject) -> TrainingLevelEngine.TrainingCalendarData {
        let weeklyFrequency = (o.optionalArray("weeklyFrequency") ?? []).compactMap { $0.objectValue }.map {
            TrainingLevelEngine.TrainingCalendarData.WeeklyFrequencyEntry(sessionCount: $0.optionalDouble("sessionCount"))
        }
        return TrainingLevelEngine.TrainingCalendarData(weeklyFrequency: weeklyFrequency)
    }

    private func decodeSignal(_ o: OrderedJSONObject) -> TrainingLevelEngine.TrainingLevelSignal {
        TrainingLevelEngine.TrainingLevelSignal(
            name: o.optionalString("name") ?? "",
            score: o.optionalInt("score") ?? Int.min,
            confidence: o.optionalString("confidence") ?? "",
            reason: o.optionalString("reason") ?? ""
        )
    }

    private func decodeReadiness(_ o: OrderedJSONObject) -> TrainingLevelEngine.ReadinessForAdvancedFeatures {
        TrainingLevelEngine.ReadinessForAdvancedFeatures(
            topBackoff: o.optionalBool("topBackoff") ?? false,
            higherVolume: o.optionalBool("higherVolume") ?? false,
            advancedExerciseSelection: o.optionalBool("advancedExerciseSelection") ?? false,
            aggressiveProgression: o.optionalBool("aggressiveProgression") ?? false
        )
    }

    private func decodeAssessment(_ o: OrderedJSONObject) throws -> TrainingLevelEngine.TrainingLevelAssessment {
        TrainingLevelEngine.TrainingLevelAssessment(
            level: TrainingLevelEngine.AutoTrainingLevel(rawValue: o.optionalString("level") ?? "") ?? .unknown,
            confidence: o.optionalString("confidence") ?? "",
            readinessForAdvancedFeatures: decodeReadiness(try XCTUnwrap(o.optionalObject("readinessForAdvancedFeatures"))),
            signals: (o.optionalArray("signals") ?? []).compactMap { $0.objectValue.map(decodeSignal) },
            limitations: o.optionalStringArray("limitations") ?? [],
            nextDataNeeded: o.optionalStringArray("nextDataNeeded") ?? []
        )
    }

    // MARK: - driver

    func testBuildTrainingLevelAssessmentParity() throws {
        let id = "training-level/assessment-cases-v1"
        let root = try goldenRoot(id)
        XCTAssertEqual(root.optionalString("sourceFixtureId"), id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 12, "\(id): expected the declared cases")

        for caseValue in cases {
            let c = try caseValue.requireObject("training-level case")
            let label = c.optionalString("label") ?? "(unlabeled)"

            let history = try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }

            // Thread ONLY the overrides the case provides (mirrors the generator); absent →
            // nil → the engine computes from history.
            var painPatterns: [PainPatternEngine.PainPattern]?
            if let arr = c.optionalArray("painPatterns") {
                painPatterns = arr.compactMap { $0.objectValue.map(decodePattern) }
            }
            var technique: PlateauDetectionEngine.TechniqueQualitySummary?
            if let o = c.optionalObject("techniqueQualitySummary") { technique = decodeTechnique(o) }
            var calendar: TrainingLevelEngine.TrainingCalendarData?
            if let o = c.optionalObject("calendarData") { calendar = decodeCalendar(o) }

            let params = TrainingLevelEngine.Params(
                history: history,
                painPatterns: painPatterns,
                techniqueQualitySummary: technique,
                calendarData: calendar
            )

            // ---- buildTrainingLevelAssessment ----
            let actual = TrainingLevelEngine.buildTrainingLevelAssessment(params)
            let expected = try decodeAssessment(try XCTUnwrap(c.optionalObject("assessment"), "\(label): assessment"))
            XCTAssertEqual(actual, expected, "\(id)/\(label): buildTrainingLevelAssessment mismatch")

            // ---- buildTechniqueQualitySummary probe ----
            let actualTechnique = TrainingLevelEngine.buildTechniqueQualitySummary(history)
            let expectedTechnique = decodeTechnique(try XCTUnwrap(c.optionalObject("techniqueQualitySummaryProbe"), "\(label): techniqueQualitySummaryProbe"))
            XCTAssertEqual(actualTechnique, expectedTechnique, "\(id)/\(label): buildTechniqueQualitySummary mismatch")

            // ---- formatAutoTrainingLevel probe ----
            XCTAssertEqual(TrainingLevelEngine.formatAutoTrainingLevel(actual.level), c.optionalString("levelLabelProbe"), "\(id)/\(label): formatAutoTrainingLevel mismatch")
        }
    }
}
