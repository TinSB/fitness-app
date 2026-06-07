// CC-1 — weeklyCoachActionEngine parity tests.
//
// FUNCTION-LEVEL compute-assert over the three `weekly-coach/*` goldens: for each case,
// decode the echoed engine input, run the PORTED WeeklyCoachActionEngine on the SAME
// inputs, and assert the produced output equals the golden case's `result`:
//   • exercise-recommendations → recommendExercisesForMuscleGap → ordered list, each
//     field (exerciseId/label/reason/fatigueCost/priority) EXACT.
//   • weekly-actions → buildWeeklyActionRecommendations → ordered [WeeklyActionRecommendation],
//     each canonical-JSON-equal to the golden rec (pins every field + the suggestedChange
//     subtree + the priorityScore/localeCompare sort + slice(0,10)).
//   • program-adjustment-preview → buildProgramAdjustmentPreview → ordered previews, each
//     field + the nested changes (type/muscleId/exerciseId/setsDelta/reason) EXACT.
//
// The goldens are GENERATED from the retired legacy weeklyCoachActionEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only —
// zero `: Date` (the engine carries no clock), no IO beyond reading the committed goldens.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class WeeklyCoachActionEngineParityTests: XCTestCase {

    private typealias Engine = WeeklyCoachActionEngine

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static func goldenURL(_ name: String) -> URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/weekly-coach/\(name).json", isDirectory: false
        )
    }

    private func root(_ fixtureId: String, _ name: String) throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL(name))
        return try JSONValue(decoding: data).requireObject(fixtureId)
    }

    // MARK: - input decode helpers

    private func decodeLibrary(_ o: OrderedJSONObject?) -> Engine.Library? {
        guard let o else { return nil }
        return o.keys.map { id in
            let e = o.optionalObject(id) ?? OrderedJSONObject()
            var mc: [String: Double]? = nil
            if let mcObj = e.optionalObject("muscleContribution") {
                var d: [String: Double] = [:]
                for k in mcObj.keys { if let v = mcObj.optionalDouble(k) { d[k] = v } }
                mc = d
            }
            return (id: id, entry: Engine.ExerciseLibraryEntry(
                alias: e.optionalString("alias"),
                name: e.optionalString("name"),
                muscle: e.optionalString("muscle"),
                fatigueCost: e.optionalString("fatigueCost"),
                primaryMuscles: e.optionalStringArray("primaryMuscles"),
                secondaryMuscles: e.optionalStringArray("secondaryMuscles"),
                muscleContribution: mc
            ))
        }
    }

    private func decodePain(_ arr: [JSONValue]?) -> [Engine.PainSignal]? {
        guard let arr else { return nil }
        return arr.compactMap { v in
            guard let o = v.objectValue else { return nil }
            return Engine.PainSignal(
                area: o.optionalString("area") ?? "",
                exerciseId: o.optionalString("exerciseId"),
                frequency: o.optionalDouble("frequency") ?? 0,
                severityAvg: o.optionalDouble("severityAvg") ?? 0,
                suggestedAction: o.optionalString("suggestedAction")
            )
        }
    }

    private func decodeLoadFeedback(_ o: OrderedJSONObject) -> Engine.LoadFeedbackSummarySignal {
        let counts = o.optionalObject("counts") ?? OrderedJSONObject()
        return Engine.LoadFeedbackSummarySignal(
            tooHeavy: counts.optionalDouble("too_heavy") ?? 0,
            good: counts.optionalDouble("good") ?? 0
        )
    }

    private func decodeLoadFeedbackByExercise(_ o: OrderedJSONObject?) -> [String: Engine.LoadFeedbackSummarySignal]? {
        guard let o else { return nil }
        var d: [String: Engine.LoadFeedbackSummarySignal] = [:]
        for k in o.keys { if let s = o.optionalObject(k) { d[k] = decodeLoadFeedback(s) } }
        return d
    }

    private func decodeE1RM(_ arr: [JSONValue]?) -> [Engine.E1RMSignal]? {
        guard let arr else { return nil }
        return arr.compactMap { v in
            guard let o = v.objectValue else { return nil }
            let cur = o.optionalObject("current")
            let best = o.optionalObject("best")
            return Engine.E1RMSignal(
                exerciseId: o.optionalString("exerciseId") ?? "",
                currentE1rmKg: cur?.optionalDouble("e1rmKg"),
                currentConfidence: cur?.optionalString("confidence"),
                bestE1rmKg: best?.optionalDouble("e1rmKg")
            )
        }
    }

    private func decodeMuscleRow(_ o: OrderedJSONObject) -> Engine.MuscleVolumeRow {
        Engine.MuscleVolumeRow(
            muscleId: o.optionalString("muscleId") ?? "",
            muscleName: o.optionalString("muscleName") ?? "",
            status: o.optionalString("status") ?? "",
            targetSets: o.optionalDouble("targetSets") ?? 0,
            completedSets: o.optionalDouble("completedSets") ?? 0,
            effectiveSets: o.optionalDouble("effectiveSets") ?? 0,
            highConfidenceEffectiveSets: o.optionalDouble("highConfidenceEffectiveSets") ?? 0,
            weightedEffectiveSets: o.optionalDouble("weightedEffectiveSets") ?? 0,
            remainingSets: o.optionalDouble("remainingSets") ?? 0
        )
    }

    private func decodeContext(_ o: OrderedJSONObject?) -> Engine.ExerciseRecommendationContext {
        guard let o else { return Engine.ExerciseRecommendationContext() }
        return Engine.ExerciseRecommendationContext(
            exerciseLibrary: decodeLibrary(o.optionalObject("exerciseLibrary")),
            painPatterns: decodePain(o.optionalArray("painPatterns")),
            restrictedExercises: o.optionalStringArray("restrictedExercises"),
            loadFeedbackByExercise: decodeLoadFeedbackByExercise(o.optionalObject("loadFeedbackByExercise")),
            recentLowAdherenceExerciseIds: o.optionalStringArray("recentLowAdherenceExerciseIds")
        )
    }

    private func decodeInput(_ o: OrderedJSONObject) throws -> Engine.WeeklyCoachActionInput {
        let rows = (o.optionalArray("muscleVolumeDashboard") ?? []).compactMap { $0.objectValue.map(decodeMuscleRow) }
        let adherence = o.optionalObject("adherenceReport").map {
            Engine.AdherenceSignal(overallRate: $0.optionalDouble("overallRate") ?? 0, confidence: $0.optionalString("confidence") ?? "")
        }
        let lfs = o.optionalObject("loadFeedbackSummary").map(decodeLoadFeedback)
        let meso = o.optionalObject("mesocycleWeek").map { Engine.MesocycleWeekSignal(phase: $0.optionalString("phase")) }
        var tpl: ProgramTemplate? = nil
        if let v = o.rawValue("programTemplate"), !v.isNull { tpl = try ProgramTemplate(decoding: v) }
        var screen: ScreeningProfile? = nil
        if let v = o.rawValue("screeningProfile"), !v.isNull { screen = try ScreeningProfile(decoding: v) }
        return Engine.WeeklyCoachActionInput(
            muscleVolumeDashboard: rows,
            adherenceReport: adherence,
            loadFeedbackSummary: lfs,
            painPatterns: decodePain(o.optionalArray("painPatterns")),
            e1rmProfiles: decodeE1RM(o.optionalArray("e1rmProfiles")),
            mesocycleWeek: meso,
            programTemplate: tpl,
            exerciseLibrary: decodeLibrary(o.optionalObject("exerciseLibrary")),
            screeningProfile: screen
        )
    }

    // MARK: - envelopes

    func testGoldenEnvelopes() throws {
        let names = [
            "exercise-recommendations-cases-v1",
            "weekly-actions-cases-v1",
            "program-adjustment-preview-cases-v1",
        ]
        for name in names {
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: Self.goldenURL(name).path),
                "missing weekly-coach golden: \(name)"
            )
            XCTAssertEqual(
                try root("weekly-coach/\(name)", name).optionalString("sourceFixtureId"),
                "weekly-coach/\(name)"
            )
        }
    }

    // MARK: - recommendExercisesForMuscleGap

    func testExerciseRecommendationsParity() throws {
        let fixtureId = "weekly-coach/exercise-recommendations-cases-v1"
        let root = try root(fixtureId, "exercise-recommendations-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 6, "expected the recommendExercises cases")
        for value in cases {
            let c = try value.requireObject("weekly-coach recommendExercises case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "recommendExercises", "\(label): kind")
            let muscleId = c.optionalString("muscleId") ?? ""
            let context = decodeContext(c.optionalObject("context"))
            let computed = Engine.recommendExercisesForMuscleGap(muscleId, context)
            let golden = c.optionalArray("result") ?? []
            XCTAssertEqual(computed.count, golden.count, "\(label): count")
            for (i, rec) in computed.enumerated() where i < golden.count {
                let g = try golden[i].requireObject("\(label) #\(i)")
                XCTAssertEqual(rec.exerciseId, g.optionalString("exerciseId"), "\(label) #\(i): exerciseId")
                XCTAssertEqual(rec.label, g.optionalString("label"), "\(label) #\(i): label")
                XCTAssertEqual(rec.reason, g.optionalString("reason"), "\(label) #\(i): reason")
                XCTAssertEqual(rec.fatigueCost, g.optionalString("fatigueCost"), "\(label) #\(i): fatigueCost")
                XCTAssertEqual(rec.priority, g.optionalString("priority"), "\(label) #\(i): priority")
            }
        }
    }

    // MARK: - buildWeeklyActionRecommendations

    func testWeeklyActionsParity() throws {
        let fixtureId = "weekly-coach/weekly-actions-cases-v1"
        let root = try root(fixtureId, "weekly-actions-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 4, "expected the weeklyActions cases")
        for value in cases {
            let c = try value.requireObject("weekly-coach weeklyActions case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "weeklyActions", "\(label): kind")
            let input = try decodeInput(try XCTUnwrap(c.optionalObject("input"), "\(label): input"))
            let computed = Engine.buildWeeklyActionRecommendations(input)
            let golden = c.optionalArray("result") ?? []
            XCTAssertEqual(computed.count, golden.count, "\(label): count")
            for (i, rec) in computed.enumerated() where i < golden.count {
                let computedStr = try rec.encoded().canonicalJSONString()
                let goldenStr = try golden[i].canonicalJSONString()
                XCTAssertEqual(computedStr, goldenStr, "\(label) #\(i): WeeklyActionRecommendation canonical mismatch")
            }
        }
    }

    // MARK: - buildProgramAdjustmentPreview

    func testProgramAdjustmentPreviewParity() throws {
        let fixtureId = "weekly-coach/program-adjustment-preview-cases-v1"
        let root = try root(fixtureId, "program-adjustment-preview-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 3, "expected the programPreview cases")
        for value in cases {
            let c = try value.requireObject("weekly-coach programPreview case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "programPreview", "\(label): kind")
            let recommendations = try (c.optionalArray("recommendations") ?? []).map {
                try WeeklyActionRecommendation(decoding: $0)
            }
            var tpl: ProgramTemplate? = nil
            if let v = c.rawValue("programTemplate"), !v.isNull { tpl = try ProgramTemplate(decoding: v) }
            let computed = Engine.buildProgramAdjustmentPreview(recommendations, tpl)
            let golden = c.optionalArray("result") ?? []
            XCTAssertEqual(computed.count, golden.count, "\(label): preview count")
            for (i, preview) in computed.enumerated() where i < golden.count {
                let g = try golden[i].requireObject("\(label) preview #\(i)")
                XCTAssertEqual(preview.id, g.optionalString("id"), "\(label) #\(i): id")
                XCTAssertEqual(preview.title, g.optionalString("title"), "\(label) #\(i): title")
                XCTAssertEqual(preview.summary, g.optionalString("summary"), "\(label) #\(i): summary")
                XCTAssertEqual(preview.confidence, g.optionalString("confidence"), "\(label) #\(i): confidence")
                let gChanges = g.optionalArray("changes") ?? []
                XCTAssertEqual(preview.changes.count, gChanges.count, "\(label) #\(i): changes count")
                for (j, ch) in preview.changes.enumerated() where j < gChanges.count {
                    let gc = try gChanges[j].requireObject("\(label) change #\(j)")
                    XCTAssertEqual(ch.type, gc.optionalString("type"), "\(label) #\(i).\(j): type")
                    XCTAssertEqual(ch.muscleId, gc.optionalString("muscleId"), "\(label) #\(i).\(j): muscleId")
                    XCTAssertEqual(ch.exerciseId, gc.optionalString("exerciseId"), "\(label) #\(i).\(j): exerciseId")
                    XCTAssertEqual(ch.setsDelta, gc.optionalDouble("setsDelta"), "\(label) #\(i).\(j): setsDelta")
                    XCTAssertEqual(ch.reason, gc.optionalString("reason"), "\(label) #\(i).\(j): reason")
                }
            }
        }
    }

    // MARK: - ② audit fix — e1RM confidence is faithful (no fabricated "medium" fallback)

    /// Pins the ②/CC-4 audit fix at WeeklyCoachActionEngine.swift:`confidence: current.confidence`
    /// (ts:340). The flattened `E1RMSignal` carries `currentE1rmKg` and `currentConfidence` as
    /// SEPARATE optionals projected from the one `EstimatedOneRepMax current`; the engine's guard
    /// (ts:328 `!profile.current`) only binds `currentE1rmKg`. On every faithful input the required
    /// `current.confidence` rides along (so the goldens are unchanged), but the old `?? "medium"`
    /// SILENTLY fabricated a confidence the legacy web schema never has whenever the projection lacked one. The fix
    /// drops to `?? ""` → `EstimateConfidence(rawValue: "")` is nil → the key is OMITTED, exactly as
    /// legacy web schema emits for an absent `confidence` (`undefined`). This test feeds the malformed projection
    /// (currentE1rmKg present, currentConfidence nil) and asserts the recommendation OMITS confidence
    /// — a regression to `?? "medium"` would surface here as `.medium`, not `nil`.
    func testE1RMConfidenceIsFaithfulNoMediumFallback() {
        // A NON-empty muscleVolumeDashboard is required so the engine does not short-circuit on the
        // empty-dashboard adherence fallback (ts:255) and actually reaches the e1rmProfiles loop
        // (ts:327). current(100) present + best(110) > current+5 then qualifies the ts:330-341 e1RM
        // recovery recommendation; it is the ONLY rec with category "recovery" + targetId "bench-press",
        // so we locate it directly (the neutral volume row may emit its own, unrelated, recs).
        let neutralRow = Engine.MuscleVolumeRow(
            muscleId: "chest", muscleName: "胸", status: "on_target",
            targetSets: 10, completedSets: 0, effectiveSets: 0,
            highConfidenceEffectiveSets: 0, weightedEffectiveSets: 0, remainingSets: 0
        )
        func e1rmRec(_ confidence: String?) -> WeeklyActionRecommendation? {
            Engine.buildWeeklyActionRecommendations(Engine.WeeklyCoachActionInput(
                muscleVolumeDashboard: [neutralRow],
                e1rmProfiles: [Engine.E1RMSignal(
                    exerciseId: "bench-press", currentE1rmKg: 100, currentConfidence: confidence, bestE1rmKg: 110
                )]
            )).first { $0.category == "recovery" && $0.targetId == "bench-press" }
        }

        // ②: a confidence-less current must OMIT confidence (the legacy web schema reads required `current.confidence`),
        // NEVER fabricate .medium — a regression to `?? "medium"` surfaces here as `.medium`, not `nil`.
        let missing = e1rmRec(nil)
        XCTAssertNotNil(missing, "the e1RM profile yields a recovery recommendation")
        XCTAssertNil(missing?.confidence, "②: a confidence-less current must OMIT confidence, never fabricate .medium")

        // Control: a present confidence flows through verbatim (the golden path, asserted directly).
        XCTAssertEqual(e1rmRec("low")?.confidence, .low, "ts:340: a present current.confidence flows through unchanged")
    }
}
