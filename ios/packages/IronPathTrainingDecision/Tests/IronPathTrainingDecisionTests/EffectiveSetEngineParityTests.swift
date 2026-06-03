// AN-3 — effectiveSetEngine (analytics-consumed subset) parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `effective-set/*` golden, decode each case's echoed
// engineInput (set / exercise / context / history / dateRange / probes), run the PORTED
// EffectiveSetEngine function on the SAME inputs, and assert the produced result equals the
// golden case's `result` field-by-field — EffectiveSetResult (isEffective / score / confidence /
// flags / reasons), EffectiveVolumeSummary (counts / effectiveScore / byMuscle / reasons, EXACT
// Double `==`), countEffectiveSets, and getMuscleContribution.
//
// The goldens are GENERATED from the REAL TS effectiveSetEngine (scripts/generate-parity-
// goldens.mjs), never hand-edited (§22). PURE / read-only — zero `: Date`, no IO beyond reading
// the committed golden.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class EffectiveSetEngineParityTests: XCTestCase {

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

    private func history(_ c: OrderedJSONObject) throws -> [TrainingSession] {
        try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func decodeEffectiveResult(_ o: OrderedJSONObject) -> EffectiveSetEngine.EffectiveSetResult {
        EffectiveSetEngine.EffectiveSetResult(
            isEffective: o.optionalBool("isEffective") ?? false,
            score: o.optionalDouble("score") ?? 0,
            confidence: o.optionalString("confidence") ?? "",
            flags: o.optionalStringArray("flags") ?? [],
            reasons: o.optionalStringArray("reasons") ?? []
        )
    }

    private func decodeMuscleSummary(_ o: OrderedJSONObject) -> EffectiveSetEngine.MuscleSummary {
        EffectiveSetEngine.MuscleSummary(
            completedSets: o.optionalInt("completedSets") ?? 0,
            effectiveSets: o.optionalInt("effectiveSets") ?? 0,
            highConfidenceEffectiveSets: o.optionalInt("highConfidenceEffectiveSets") ?? 0,
            mediumConfidenceEffectiveSets: o.optionalInt("mediumConfidenceEffectiveSets") ?? 0,
            lowConfidenceEffectiveSets: o.optionalInt("lowConfidenceEffectiveSets") ?? 0,
            effectiveScore: o.optionalDouble("effectiveScore") ?? 0,
            weightedEffectiveSets: o.optionalDouble("weightedEffectiveSets") ?? 0,
            highConfidenceWeightedSets: o.optionalDouble("highConfidenceWeightedSets") ?? 0
        )
    }

    // MARK: - effective-set/evaluate-cases-v1

    func testEvaluateEffectiveSetParityForEveryCase() throws {
        let root = try goldenRoot("effective-set/evaluate-cases-v1")
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "effective-set/evaluate-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 18, "expected the evaluate branch cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("evaluate case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let set = try TrainingSetLog(decoding: try XCTUnwrap(c["set"], "\(label): set"))
            let exercise = try c["exercise"].map { try ExercisePrescription(decoding: $0) }
            var context: EffectiveSetEngine.EvaluateContext? = nil
            if let ctx = c.optionalObject("context") {
                context = EffectiveSetEngine.EvaluateContext(
                    plannedReps: ctx.optionalArray("plannedReps")?.map { $0.doubleValue ?? 0 }
                )
            }
            let actual = EffectiveSetEngine.evaluateEffectiveSet(set, exercise, context: context)
            let golden = decodeEffectiveResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "effective-set/evaluate/\(label): evaluateEffectiveSet mismatch")
        }
    }

    // MARK: - effective-set/volume-summary-cases-v1

    func testBuildEffectiveVolumeSummaryParityForEveryCase() throws {
        let root = try goldenRoot("effective-set/volume-summary-cases-v1")
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "effective-set/volume-summary-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 4, "expected the volume-summary cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("volume-summary case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)

            var dateRange: EffectiveSetEngine.DateRange? = nil
            if let dr = c.optionalObject("dateRange") {
                dateRange = EffectiveSetEngine.DateRange(from: dr.optionalString("from"), to: dr.optionalString("to"))
            }

            let actual = EffectiveSetEngine.buildEffectiveVolumeSummary(history, dateRange: dateRange)
            let goldenObj = try XCTUnwrap(c.optionalObject("summary"), "\(label): summary")

            // Scalars + reasons (reasons order is first-encounter, preserved by canonicalStringify).
            XCTAssertEqual(actual.completedSets, goldenObj.optionalInt("completedSets") ?? 0, "\(label): completedSets")
            XCTAssertEqual(actual.effectiveSets, goldenObj.optionalInt("effectiveSets") ?? 0, "\(label): effectiveSets")
            XCTAssertEqual(actual.highConfidenceEffectiveSets, goldenObj.optionalInt("highConfidenceEffectiveSets") ?? 0, "\(label): highConf")
            XCTAssertEqual(actual.mediumConfidenceEffectiveSets, goldenObj.optionalInt("mediumConfidenceEffectiveSets") ?? 0, "\(label): medConf")
            XCTAssertEqual(actual.lowConfidenceEffectiveSets, goldenObj.optionalInt("lowConfidenceEffectiveSets") ?? 0, "\(label): lowConf")
            XCTAssertEqual(actual.effectiveScore, goldenObj.optionalDouble("effectiveScore") ?? 0, "\(label): effectiveScore")
            XCTAssertEqual(actual.reasons, goldenObj.optionalStringArray("reasons") ?? [], "\(label): reasons")

            // byMuscle compared order-independently (golden keys are canonicalised/sorted).
            var actualByMuscle: [String: EffectiveSetEngine.MuscleSummary] = [:]
            for entry in actual.byMuscle { actualByMuscle[entry.muscle] = entry.summary }
            var goldenByMuscle: [String: EffectiveSetEngine.MuscleSummary] = [:]
            if let bm = goldenObj.optionalObject("byMuscle") {
                for key in bm.keys {
                    if let mo = bm[key]?.objectValue { goldenByMuscle[key] = decodeMuscleSummary(mo) }
                }
            }
            XCTAssertEqual(actualByMuscle, goldenByMuscle, "\(label): byMuscle")

            // countEffectiveSets probes.
            for probeValue in (c.optionalArray("countProbes") ?? []) {
                let p = try probeValue.requireObject("countProbe")
                let plabel = p.optionalString("label") ?? "(probe)"
                let sessionIndex = p.optionalInt("sessionIndex") ?? 0
                let minScore = p.optionalDouble("minScore")
                let actualCount = EffectiveSetEngine.countEffectiveSets(history[sessionIndex], minScore: minScore)
                XCTAssertEqual(actualCount, p.optionalInt("count") ?? -1, "\(label)/\(plabel): countEffectiveSets")
            }

            // getMuscleContribution probes (compared as a muscle→value map).
            for probeValue in (c.optionalArray("contributionProbes") ?? []) {
                let p = try probeValue.requireObject("contributionProbe")
                let plabel = p.optionalString("label") ?? "(probe)"
                let exercise = try ExercisePrescription(decoding: try XCTUnwrap(p["exercise"], "\(plabel): exercise"))
                var actualMap: [String: Double] = [:]
                for (muscle, value) in EffectiveSetEngine.getMuscleContribution(exercise) { actualMap[muscle] = value }
                var goldenMap: [String: Double] = [:]
                if let co = p.optionalObject("contribution") {
                    for key in co.keys { goldenMap[key] = co[key]?.doubleValue ?? 0 }
                }
                XCTAssertEqual(actualMap, goldenMap, "\(label)/\(plabel): getMuscleContribution")
            }
        }
    }
}
