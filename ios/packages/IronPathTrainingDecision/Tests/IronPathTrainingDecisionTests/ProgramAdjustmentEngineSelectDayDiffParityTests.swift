// PA-S8 (PA-1b) — programAdjustmentEngine selectBestDayForNewExercise +
// buildAdjustmentDiff function-level parity tests.
//
// FUNCTION-LEVEL compute-assert over the two `program-adjust/*` goldens: for each
// case decode the echoed engineInput, run the PORTED ProgramAdjustmentEngine on the
// SAME inputs, and assert the produced output equals the golden —
//   select-day-cases → DaySelectionResult field-by-field EXACT `==`
//                      (dayTemplateId / dayTemplateName / confidence / note /
//                       insertAfterExerciseId / insertPositionLabel; absent golden
//                       keys ⇒ nil), covering pain/restricted, score<2 candidate,
//                       longDay medium (incl. the duration==85 boundary), keyword
//                       high, sourceTemplateId weight, compound penalty, string vs
//                       ExerciseTemplate input, the back/chest/quads/biceps/shoulders
//                       + null + Chinese-muscle keyword branches, the rich vs empty
//                       dayTemplates projections, and chooseInsertAnchor's three forms.
//   build-diff-cases → ProgramAdjustmentDiff canonical-equality (title/summary + each
//                      change row changeId/type/label/before/after/reason/riskLevel),
//                      covering every change type / branch (add/remove_sets found &
//                      not-found, add_new with/without dayTemplateId, swap with/without
//                      replacement, reduce/increase_support applied & not-applied, keep),
//                      the previewNote→high path, the riskLevel tiers, and the default
//                      programTemplate / templates params (omitted ⇒ DEFAULT_*).
//
// The goldens are GENERATED from the REAL TS programAdjustmentEngine
// (scripts/generate-parity-goldens.mjs), never hand-edited (§22). PURE / read-only —
// zero `: Date`, zero clock, no IO beyond reading the committed goldens.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class ProgramAdjustmentEngineSelectDayDiffParityTests: XCTestCase {

    private typealias Engine = ProgramAdjustmentEngine

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
            "tests/fixtures/parity/golden/program-adjust/\(name).json", isDirectory: false
        )
    }

    private func root(_ fixtureId: String, _ name: String) throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL(name))
        return try JSONValue(decoding: data).requireObject(fixtureId)
    }

    // MARK: - envelopes

    func testGoldenEnvelopes() throws {
        for name in ["select-day-cases-v1", "build-diff-cases-v1"] {
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: Self.goldenURL(name).path),
                "missing program-adjust golden: \(name)"
            )
            let id = "program-adjust/\(name)"
            XCTAssertEqual(try root(id, name).optionalString("sourceFixtureId"), id)
        }
    }

    // MARK: - select-day-cases (selectBestDayForNewExercise)

    func testSelectDayCasesParity() throws {
        let fixtureId = "program-adjust/select-day-cases-v1"
        let root = try root(fixtureId, "select-day-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 9, "expected the declared select-day cases")
        for value in cases {
            let c = try value.requireObject("program-adjust select-day case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "select-day", "\(label): kind")

            let exercise = try decodeExercise(try XCTUnwrap(c.rawValue("exercise"), "\(label): exercise"))
            let program = try ProgramTemplate(decoding: try XCTUnwrap(c.rawValue("programTemplate"), "\(label): programTemplate"))
            let targetMuscleId = c.optionalString("targetMuscleId")
            let context = try decodeContext(c.optionalObject("context"))

            let result = Engine.selectBestDayForNewExercise(
                exercise, programTemplate: program, targetMuscleId: targetMuscleId, context: context
            )

            let golden = try XCTUnwrap(c.rawValue("result"), "\(label): result").requireObject("\(label): result")
            XCTAssertEqual(result.dayTemplateId, golden.optionalString("dayTemplateId"), "\(fixtureId)/\(label): dayTemplateId")
            XCTAssertEqual(result.dayTemplateName, golden.optionalString("dayTemplateName"), "\(fixtureId)/\(label): dayTemplateName")
            XCTAssertEqual(result.confidence.rawValue, golden.optionalString("confidence"), "\(fixtureId)/\(label): confidence")
            XCTAssertEqual(result.note, golden.optionalString("note"), "\(fixtureId)/\(label): note")
            XCTAssertEqual(result.insertAfterExerciseId, golden.optionalString("insertAfterExerciseId"), "\(fixtureId)/\(label): insertAfterExerciseId")
            XCTAssertEqual(result.insertPositionLabel, golden.optionalString("insertPositionLabel"), "\(fixtureId)/\(label): insertPositionLabel")
        }
    }

    // MARK: - build-diff-cases (buildAdjustmentDiff)

    func testBuildDiffCasesParity() throws {
        let fixtureId = "program-adjust/build-diff-cases-v1"
        let root = try root(fixtureId, "build-diff-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 13, "expected the declared build-diff cases")
        for value in cases {
            let c = try value.requireObject("program-adjust build-diff case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "build-diff", "\(label): kind")

            let draft = try ProgramAdjustmentDraft(decoding: try XCTUnwrap(c.rawValue("draft"), "\(label): draft"))
            let source = try TrainingTemplate(decoding: try XCTUnwrap(c.rawValue("sourceProgramTemplate"), "\(label): sourceProgramTemplate"))

            // Omitted (null) programTemplate / templates ⇒ the TS default params
            // (DEFAULT_PROGRAM_TEMPLATE / [sourceProgramTemplate]); pass nil so the Swift
            // port substitutes the same defaults.
            let programValue = c.rawValue("programTemplate")
            let program: ProgramTemplate? = (programValue == nil || programValue!.isNull)
                ? nil : try ProgramTemplate(decoding: programValue!)
            let templatesValue = c.rawValue("templates")
            let templates: [TrainingTemplate]? = (templatesValue == nil || templatesValue!.isNull)
                ? nil : try (templatesValue!.arrayValue ?? []).map { try TrainingTemplate(decoding: $0) }

            let result = Engine.buildAdjustmentDiff(
                draft: draft, sourceProgramTemplate: source, programTemplate: program, templates: templates
            )

            let computed = try result.encoded().canonicalJSONString()
            let goldenResult = try XCTUnwrap(c.rawValue("result"), "\(label): result").canonicalJSONString()
            XCTAssertEqual(computed, goldenResult, "\(fixtureId)/\(label): ProgramAdjustmentDiff canonical mismatch")
        }
    }

    // MARK: - decoders

    /// The TS `exercise: string | ExerciseTemplate` first param.
    private func decodeExercise(_ value: JSONValue) throws -> Engine.ExerciseRef {
        if case .string(let s) = value { return .id(s) }
        return .template(try ExerciseTemplate(decoding: value))
    }

    /// `NewExerciseSelectionContext` from the echoed `context` object.
    private func decodeContext(_ obj: OrderedJSONObject?) throws -> Engine.NewExerciseSelectionContext {
        guard let obj else { return Engine.NewExerciseSelectionContext() }
        let templates: [TrainingTemplate]? = try obj.optionalArray("templates")?.map { try TrainingTemplate(decoding: $0) }
        let screening: ScreeningProfile? = try obj.optionalObject("screeningProfile").map { try ScreeningProfile(decoding: .object($0)) }
        let program: ProgramTemplate? = try obj.optionalObject("programTemplate").map { try ProgramTemplate(decoding: .object($0)) }
        let painPatterns: [Engine.DraftPainPattern]? = obj.optionalArray("painPatterns")?.map { pv in
            let po = pv.objectValue
            return Engine.DraftPainPattern(
                exerciseId: po?.optionalString("exerciseId"),
                suggestedAction: po?.optionalString("suggestedAction")
            )
        }
        return Engine.NewExerciseSelectionContext(
            programTemplate: program,
            templates: templates,
            screeningProfile: screening,
            painPatterns: painPatterns,
            sourceTemplateId: obj.optionalString("sourceTemplateId")
        )
    }
}
